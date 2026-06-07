import { getLotteryType, normalizeTicket, validateTicket } from "./lotteryCatalog.mjs";

export const PRIZE_TIERS = {
  ssq: [
    {
      tier: 1,
      name: "一等奖",
      prize: "浮动奖金",
      weight: 64,
      conditions: [{ red: 6, blue: 1 }],
    },
    {
      tier: 2,
      name: "二等奖",
      prize: "浮动奖金",
      weight: 32,
      conditions: [{ red: 6, blue: 0 }],
    },
    {
      tier: 3,
      name: "三等奖",
      prize: "3000元",
      weight: 16,
      conditions: [{ red: 5, blue: 1 }],
    },
    {
      tier: 4,
      name: "四等奖",
      prize: "200元",
      weight: 8,
      conditions: [
        { red: 5, blue: 0 },
        { red: 4, blue: 1 },
      ],
    },
    {
      tier: 5,
      name: "五等奖",
      prize: "10元",
      weight: 4,
      conditions: [
        { red: 4, blue: 0 },
        { red: 3, blue: 1 },
      ],
    },
    {
      tier: 6,
      name: "六等奖",
      prize: "5元",
      weight: 2,
      conditions: [
        { red: 2, blue: 1 },
        { red: 1, blue: 1 },
        { red: 0, blue: 1 },
      ],
    },
  ],
  dlt: [
    {
      tier: 1,
      name: "一等奖",
      prize: "浮动奖金",
      weight: 128,
      conditions: [{ front: 5, back: 2 }],
    },
    {
      tier: 2,
      name: "二等奖",
      prize: "浮动奖金",
      weight: 64,
      conditions: [{ front: 5, back: 1 }],
    },
    {
      tier: 3,
      name: "三等奖",
      prize: "10000元",
      weight: 32,
      conditions: [
        { front: 5, back: 0 },
        { front: 4, back: 2 },
      ],
    },
    {
      tier: 4,
      name: "四等奖",
      prize: "3000元",
      weight: 16,
      conditions: [{ front: 4, back: 1 }],
    },
    {
      tier: 5,
      name: "五等奖",
      prize: "300元",
      weight: 8,
      conditions: [
        { front: 4, back: 0 },
        { front: 3, back: 2 },
      ],
    },
    {
      tier: 6,
      name: "六等奖",
      prize: "200元",
      weight: 4,
      conditions: [
        { front: 3, back: 1 },
        { front: 2, back: 2 },
      ],
    },
    {
      tier: 7,
      name: "七等奖",
      prize: "5元",
      weight: 2,
      conditions: [
        { front: 3, back: 0 },
        { front: 2, back: 1 },
        { front: 1, back: 2 },
        { front: 0, back: 2 },
      ],
    },
  ],
};

export function getPrizeTiers(typeId) {
  const tiers = PRIZE_TIERS[typeId];
  if (!tiers) {
    throw new Error(`Unknown prize rules for type: ${typeId}`);
  }
  return tiers.map((tier) => ({
    ...tier,
    conditions: tier.conditions.map((condition) => ({ ...condition })),
  }));
}

export function getPrizeRuleSummary(typeId) {
  const type = getLotteryType(typeId);
  return {
    typeId,
    title: `${type.shortName}中奖规则和奖金`,
    note: "浮动奖金以官方当期开奖公告为准；固定奖金为常见公开规则展示，实际兑奖以官方公告和实体票为准。",
    rows: getPrizeTiers(typeId).map((tier) => ({
      tier: tier.tier,
      name: tier.name,
      prize: tier.prize,
      conditionText: tier.conditions.map((condition) => formatCondition(type, condition)).join(" 或 "),
    })),
  };
}

export function evaluateTicketAgainstDraw(typeId, ticket, draw) {
  const type = getLotteryType(typeId);
  if (!draw || draw.type !== typeId) {
    throw new Error(`Draw must match lottery type: ${typeId}`);
  }

  const validation = validateTicket(typeId, ticket);
  if (!validation.valid) {
    throw new Error(`Invalid ticket: ${validation.errors.join("; ")}`);
  }

  const normalized = normalizeTicket(typeId, ticket);
  const matches = {};

  for (const groupName of Object.keys(type.groups)) {
    matches[groupName] = countMatches(normalized[groupName], draw[groupName] ?? []);
  }

  const matchedTier = getPrizeTiers(typeId).find((tier) =>
    tier.conditions.some((condition) =>
      Object.entries(condition).every(([groupName, expected]) => matches[groupName] === expected),
    ),
  );

  const groupNames = Object.keys(type.groups);
  const primaryGroup = groupNames[0];
  const secondaryGroup = groupNames[1];

  return {
    typeId,
    issue: draw.issue ?? "",
    date: draw.date ?? "",
    hit: Boolean(matchedTier),
    tier: matchedTier?.tier ?? 0,
    tierName: matchedTier?.name ?? "未命中",
    prizeLabel: matchedTier?.name ?? "未达到奖级",
    weight: matchedTier?.weight ?? 0,
    matches,
    primaryMatches: matches[primaryGroup] ?? 0,
    secondaryMatches: matches[secondaryGroup] ?? 0,
    matchText: Object.entries(type.groups)
      .map(([groupName, rule]) => `${rule.label}${matches[groupName] ?? 0}个`)
      .join("，"),
  };
}

function countMatches(ticketNumbers, drawNumbers) {
  const drawSet = new Set(drawNumbers);
  return ticketNumbers.filter((number) => drawSet.has(number)).length;
}

function formatCondition(type, condition) {
  return Object.entries(condition)
    .map(([groupName, count]) => `${type.groups[groupName].label}${count}个`)
    .join("，");
}
