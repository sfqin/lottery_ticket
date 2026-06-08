export const LOTTERY_TYPES = {
  dlt: {
    id: "dlt",
    name: "超级大乐透",
    shortName: "大乐透",
    disclaimer: "前区 1-35 选 5 个，后区 1-12 选 2 个。",
    groups: {
      front: { label: "前区", min: 1, max: 35, count: 5, color: "red" },
      back: { label: "后区", min: 1, max: 12, count: 2, color: "back" },
    },
  },
  ssq: {
    id: "ssq",
    name: "双色球",
    shortName: "双色球",
    disclaimer: "红球 1-33 选 6 个，蓝球 1-16 选 1 个。",
    groups: {
      red: { label: "红球", min: 1, max: 33, count: 6, color: "red" },
      blue: { label: "蓝球", min: 1, max: 16, count: 1, color: "blue" },
    },
  },
};

export function getLotteryType(typeId) {
  const type = LOTTERY_TYPES[typeId];
  if (!type) {
    throw new Error(`Unknown lottery type: ${typeId}`);
  }
  return type;
}

export function normalizeTicket(typeId, ticket) {
  const type = getLotteryType(typeId);
  const normalized = {};

  for (const groupName of Object.keys(type.groups)) {
    normalized[groupName] = [...(ticket[groupName] ?? [])].sort((a, b) => a - b);
  }

  return normalized;
}

export function validateTicket(typeId, ticket) {
  const type = getLotteryType(typeId);
  const normalized = normalizeTicket(typeId, ticket);
  const errors = [];

  for (const [groupName, rule] of Object.entries(type.groups)) {
    const values = normalized[groupName];
    if (values.length !== rule.count) {
      errors.push(`${groupName} must contain ${rule.count} numbers`);
    }

    if (new Set(values).size !== values.length) {
      errors.push(`${groupName} must not contain duplicates`);
    }

    if (values.some((value) => !Number.isInteger(value) || value < rule.min || value > rule.max)) {
      errors.push(`${groupName} numbers must be between ${rule.min} and ${rule.max}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized,
  };
}

export function formatTicket(typeId, ticket) {
  const normalized = normalizeTicket(typeId, ticket);
  const formatted = {};

  for (const groupName of Object.keys(getLotteryType(typeId).groups)) {
    formatted[groupName] = normalized[groupName].map((number) =>
      String(number).padStart(2, "0"),
    );
  }

  return formatted;
}
