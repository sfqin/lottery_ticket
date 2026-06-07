import { getLotteryType, validateTicket } from "./lotteryCatalog.mjs";
import { evaluateTicketAgainstDraw } from "./prizeRules.mjs";

export const SUPPORTED_TICKET_SCAN_TYPES = ["ssq", "dlt"];

export function isSupportedTicketScanType(typeId) {
  return SUPPORTED_TICKET_SCAN_TYPES.includes(typeId);
}

export function parseTicketNumbers(typeId, values = {}) {
  assertSupportedType(typeId);
  const type = getLotteryType(typeId);
  const ticket = {};

  for (const [groupName, rule] of Object.entries(type.groups)) {
    ticket[groupName] = parseNumberList(values[groupName], rule.count);
  }

  return ticket;
}

export function parseTicketLines(typeId, text = "") {
  assertSupportedType(typeId);
  const type = getLotteryType(typeId);
  const groupNames = Object.keys(type.groups);
  const primaryGroup = groupNames[0];
  const secondaryGroup = groupNames[1];
  const primaryRule = type.groups[primaryGroup];
  const secondaryRule = type.groups[secondaryGroup];

  return String(text)
    .split(/\n+/)
    .map((line) => parseTicketLine(line, primaryGroup, primaryRule, secondaryGroup, secondaryRule))
    .filter(Boolean);
}

export function checkTicketByIssue({ typeId, issue, ticket, draws = [] } = {}) {
  assertSupportedType(typeId);
  const normalizedIssue = normalizeIssue(issue);
  const draw = draws.find((item) => item.type === typeId && normalizeIssue(item.issue) === normalizedIssue);
  const type = getLotteryType(typeId);

  if (!draw) {
    return {
      typeId,
      issue: normalizedIssue,
      found: false,
      summary: `未找到${type.shortName}${normalizedIssue}期开奖记录，请确认期号或等待历史数据更新。`,
      complianceNote: "查询结果仅供参考，实际开奖与实体票信息以官方公告为准。本平台不提供奖金领取、代领等服务。",
    };
  }

  const validation = validateTicket(typeId, ticket);
  if (!validation.valid) {
    throw new Error(`票面号码不符合${type.shortName}规则：${validation.errors.join("; ")}`);
  }

  const evaluation = evaluateTicketAgainstDraw(typeId, validation.normalized, draw);
  const summary = evaluation.hit
    ? `${type.shortName}${draw.issue}期模拟查询：命中${evaluation.tierName}，${evaluation.matchText}。`
    : `${type.shortName}${draw.issue}期模拟查询：未达到奖级，${evaluation.matchText}。`;

  return {
    typeId,
    issue: draw.issue,
    date: draw.date ?? "",
    found: true,
    draw,
    ticket: validation.normalized,
    evaluation,
    summary,
    complianceNote: "查询结果仅供参考，实际开奖与实体票信息以官方公告为准。本平台不提供奖金领取、代领等服务。",
  };
}

export function checkTicketLinesByIssue({ typeId, issue, ticketText = "", draws = [] } = {}) {
  assertSupportedType(typeId);
  const normalizedIssue = normalizeIssue(issue);
  const draw = draws.find((item) => item.type === typeId && normalizeIssue(item.issue) === normalizedIssue);
  const type = getLotteryType(typeId);

  if (!draw) {
    return {
      typeId,
      issue: normalizedIssue,
      found: false,
      lines: [],
      summary: `未找到${type.shortName}${normalizedIssue}期开奖记录，请确认期号或等待历史数据更新。`,
      complianceNote: "查询结果仅供参考，实际开奖与实体票信息以官方公告为准。本平台不提供奖金领取、代领等服务。",
    };
  }

  const tickets = parseTicketLines(typeId, ticketText);
  if (!tickets.length) {
    throw new Error("请至少输入一注完整号码。");
  }

  const lines = tickets.map((ticket, index) => {
    const validation = validateTicket(typeId, ticket);
    if (!validation.valid) {
      throw new Error(`第 ${index + 1} 注号码不符合${type.shortName}规则：${validation.errors.join("; ")}`);
    }

    const evaluation = evaluateTicketAgainstDraw(typeId, validation.normalized, draw);
    return {
      index: index + 1,
      ticket: validation.normalized,
      evaluation,
      matchedNumbers: getMatchedNumbers(type, validation.normalized, draw),
    };
  });

  const hitCount = lines.filter((line) => line.evaluation.hit).length;
  return {
    typeId,
    issue: draw.issue,
    date: draw.date ?? "",
    found: true,
    draw,
    lines,
    hitCount,
    summary: `${type.shortName}${draw.issue}期共核对 ${lines.length} 注，命中奖级 ${hitCount} 注。`,
    complianceNote: "查询结果仅供参考，实际开奖与实体票信息以官方公告为准。本平台不提供奖金领取、代领等服务。",
  };
}

function assertSupportedType(typeId) {
  if (!isSupportedTicketScanType(typeId)) {
    throw new Error("验票辅助只支持双色球和超级大乐透。");
  }
}

function normalizeIssue(issue) {
  return String(issue ?? "").replace(/\D/g, "");
}

function parseNumberList(value, expectedCount) {
  if (Array.isArray(value)) {
    return value.map(Number).filter(Number.isInteger);
  }

  const digits = String(value ?? "").match(/\d{1,2}/g) ?? [];
  return digits.slice(0, expectedCount).map(Number);
}

function parseTicketLine(line, primaryGroup, primaryRule, secondaryGroup, secondaryRule) {
  const cleaned = String(line ?? "")
    .replace(/^\s*(?:[A-Z①②③④⑤⑥⑦⑧⑨⑩]|[一二三四五六七八九十]+|第?\d+注?)\s*[).、：:-]\s*/i, "")
    .replace(/[＋]/g, "+");

  if (!cleaned.trim()) return null;

  const parts = cleaned.split("+");
  const allNumbers = extractNumbers(cleaned);
  const expectedTotal = primaryRule.count + secondaryRule.count;
  if (allNumbers.length < expectedTotal) return null;

  const ticket = {};
  if (parts.length >= 2) {
    ticket[primaryGroup] = extractNumbers(parts[0]).slice(-primaryRule.count);
    ticket[secondaryGroup] = extractNumbers(parts.slice(1).join(" ")).slice(0, secondaryRule.count);
  } else {
    const selected = allNumbers.slice(0, expectedTotal);
    ticket[primaryGroup] = selected.slice(0, primaryRule.count);
    ticket[secondaryGroup] = selected.slice(primaryRule.count, expectedTotal);
  }

  return ticket;
}

function extractNumbers(value) {
  return (String(value ?? "").match(/\d{1,2}/g) ?? []).map(Number);
}

function getMatchedNumbers(type, ticket, draw) {
  const matched = {};
  for (const groupName of Object.keys(type.groups)) {
    const drawSet = new Set(draw[groupName] ?? []);
    matched[groupName] = ticket[groupName].filter((number) => drawSet.has(number));
  }
  return matched;
}
