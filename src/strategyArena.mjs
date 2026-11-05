import { getLotteryType } from "./lotteryCatalog.mjs";
import { generateTicket } from "./numberGenerator.mjs";
import { evaluateTicketAgainstDraw, getPrizeTiers } from "./prizeRules.mjs";

export const STRATEGY_ORDER = ["random", "balanced", "data", "theory", "trend"];

export const STRATEGY_LABELS = {
  random: "随机生成",
  balanced: "均衡生成",
  data: "数据参考",
  theory: "分层理论模型",
  trend: "趋势参考",
};

export const LINES_PER_STRATEGY = 5;

export const ARENA_CSV_HEADER = [
  "type",
  "issue",
  "strategy",
  "line",
  "numbers",
  "evaluated",
  "tier",
  "prizeLabel",
  "prizeYuan",
];

const FLOATING_LABEL = "浮动奖金";

export function labelStrategy(strategy) {
  return STRATEGY_LABELS[strategy] ?? strategy;
}

function serializeTicket(typeId, ticket) {
  const type = getLotteryType(typeId);
  return Object.keys(type.groups)
    .map((groupName) => [...(ticket[groupName] ?? [])].sort((a, b) => a - b).join(" "))
    .join("|");
}

function parseTicket(typeId, numbers) {
  const type = getLotteryType(typeId);
  const groupNames = Object.keys(type.groups);
  const parts = String(numbers).split("|");
  const ticket = {};
  groupNames.forEach((groupName, index) => {
    ticket[groupName] = String(parts[index] ?? "")
      .split(" ")
      .filter(Boolean)
      .map(Number);
  });
  return ticket;
}

export function nextIssue(latestIssue) {
  const text = String(latestIssue ?? "").trim();
  if (!/^\d+$/.test(text)) {
    throw new Error(`Cannot derive next issue from: ${latestIssue}`);
  }
  return String(Number(text) + 1).padStart(text.length, "0");
}

export function buildArenaTicketsForIssue({ typeId, issue, draws = [], rng = Math.random } = {}) {
  const type = getLotteryType(typeId);
  const typeDraws = draws.filter((draw) => draw.type === typeId);
  const entries = [];

  for (const strategy of STRATEGY_ORDER) {
    for (let line = 1; line <= LINES_PER_STRATEGY; line += 1) {
      const result = generateTicket({ typeId, strategy, draws: typeDraws, rng });
      entries.push({
        type: typeId,
        typeName: type.name,
        issue,
        strategy,
        line,
        ticket: result.ticket,
        evaluated: false,
        tier: 0,
        tierName: "未开奖",
        prizeLabel: "",
        prizeYuan: null,
      });
    }
  }

  return entries;
}

export function evaluateArenaEntries(entries = [], draws = []) {
  const drawByKey = new Map();
  for (const draw of draws) {
    drawByKey.set(`${draw.type}-${draw.issue}`, draw);
  }

  return entries.map((entry) => {
    if (entry.evaluated) return entry;
    const draw = drawByKey.get(`${entry.type}-${entry.issue}`);
    if (!draw) return entry;

    const evaluation = evaluateTicketAgainstDraw(entry.type, entry.ticket, draw);
    return {
      ...entry,
      evaluated: true,
      tier: evaluation.tier,
      tierName: evaluation.tierName,
      prizeLabel: evaluation.hit ? evaluation.prizeLabel : "未命中",
      prizeYuan: prizeYuanFromLabel(evaluation.hit ? evaluation.prizeLabel : "未命中"),
    };
  });
}

export function serializeArenaCsv(entries = []) {
  const sorted = [...entries].sort((a, b) => {
    if (a.issue !== b.issue) return String(b.issue).localeCompare(String(a.issue));
    if (a.strategy !== b.strategy) {
      return STRATEGY_ORDER.indexOf(a.strategy) - STRATEGY_ORDER.indexOf(b.strategy);
    }
    return a.line - b.line;
  });

  const lines = [
    ARENA_CSV_HEADER.join(","),
    ...sorted.map((entry) =>
      [
        entry.type,
        entry.issue,
        entry.strategy,
        entry.line,
        serializeTicket(entry.type, entry.ticket),
        entry.evaluated ? 1 : 0,
        entry.tier ?? 0,
        entry.prizeLabel ?? "",
        entry.prizeYuan ?? "",
      ].join(","),
    ),
  ];

  return `${lines.join("\n")}\n`;
}

export function parseArenaCsv(csv) {
  const lines = String(csv).trim().split(/\r?\n/).filter(Boolean);
  const header = lines.shift();
  if (header !== ARENA_CSV_HEADER.join(",")) {
    throw new Error("Unexpected arena CSV header");
  }

  return lines.map((rawLine) => {
    const [type, issue, strategy, line, numbers, evaluated, tier, prizeLabel, prizeYuan] =
      rawLine.split(",");
    const ticket = parseTicket(type, numbers);
    const isEvaluated = evaluated === "1";
    return {
      type,
      typeName: getLotteryType(type).name,
      issue,
      strategy,
      line: Number(line),
      ticket,
      evaluated: isEvaluated,
      tier: Number(tier) || 0,
      tierName: isEvaluated ? tierNameFromTier(type, Number(tier) || 0) : "未开奖",
      prizeLabel: prizeLabel ?? "",
      prizeYuan: prizeYuan === "" || prizeYuan == null ? null : Number(prizeYuan),
    };
  });
}

export function summarizeArena(typeId, entries = []) {
  const filtered = entries.filter((entry) => entry.type === typeId);
  const issues = [...new Set(filtered.map((entry) => entry.issue))].sort((a, b) =>
    String(b).localeCompare(String(a)),
  );

  return issues.map((issue) => {
    const issueEntries = filtered.filter((entry) => entry.issue === issue);
    const evaluated = issueEntries.every((entry) => entry.evaluated) && issueEntries.length > 0;

    const strategies = STRATEGY_ORDER.filter((strategy) =>
      issueEntries.some((entry) => entry.strategy === strategy),
    ).map((strategy) => {
      const lines = issueEntries
        .filter((entry) => entry.strategy === strategy)
        .sort((a, b) => a.line - b.line);
      const hasFloating = lines.some((entry) => entry.prizeLabel === FLOATING_LABEL);
      const totalYuan = lines.reduce((sum, entry) => sum + (entry.prizeYuan ?? 0), 0);
      const hitCount = lines.filter((entry) => entry.tier > 0).length;
      return {
        strategy,
        label: labelStrategy(strategy),
        evaluated: lines.every((entry) => entry.evaluated),
        hasFloating,
        totalYuan,
        hitCount,
        prizeText: formatPrizeText({ evaluated: lines.every((entry) => entry.evaluated), hasFloating, totalYuan }),
        lines,
      };
    });

    return {
      typeId,
      issue,
      evaluated,
      strategies,
    };
  });
}

export function formatPrizeText({ evaluated, hasFloating, totalYuan }) {
  if (!evaluated) return "待开奖";
  if (hasFloating) return totalYuan > 0 ? `${totalYuan}元+浮动` : "含浮动奖金";
  return `${totalYuan}元`;
}

export function prizeYuanFromLabel(prizeLabel) {
  if (prizeLabel === FLOATING_LABEL) return null;
  const match = String(prizeLabel).match(/^(\d+(?:\.\d+)?)元$/);
  return match ? Number(match[1]) : 0;
}

function tierNameFromTier(typeId, tier) {
  if (!tier) return "未命中";
  const matched = getPrizeTiers(typeId).find((entry) => entry.tier === tier);
  return matched?.name ?? "未命中";
}
