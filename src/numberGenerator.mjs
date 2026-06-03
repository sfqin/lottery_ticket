import { getLotteryType, validateTicket } from "./lotteryCatalog.mjs";

const DEFAULT_POSITIVE_MESSAGES = [
  "把期待放轻，把脚步走稳。",
  "今天适合稳稳前进，把好运留给有准备的自己。",
  "认真生活的人，也值得被温柔地照亮一下。",
  "保持清醒，也保留一点期待。",
  "愿今天的选择轻松、克制，也有一点明亮。",
];

export function generateTicket({
  typeId,
  strategy = "balanced",
  draws = [],
  rng = Math.random,
} = {}) {
  const type = getLotteryType(typeId);
  const ticket =
    strategy === "data"
      ? generateDataReferenceTicket(type, draws, rng)
      : strategy === "random"
        ? generateRandomTicket(type, rng)
        : generateBalancedTicket(type, rng);

  const validation = validateTicket(typeId, ticket);
  if (!validation.valid) {
    throw new Error(`Generated invalid ticket: ${validation.errors.join("; ")}`);
  }

  return {
    typeId,
    strategy,
    ticket: validation.normalized,
    explanation: explainTicket(typeId, validation.normalized, strategy),
    message: pickMessage(rng),
    complianceNote: "生成结果仅供娱乐参考，不构成中奖预测。彩票开奖具有随机性，请理性使用。",
  };
}

function generateRandomTicket(type, rng) {
  const ticket = {};
  for (const [groupName, rule] of Object.entries(type.groups)) {
    ticket[groupName] = drawUnique(rule.min, rule.max, rule.count, rng);
  }
  return ticket;
}

function generateBalancedTicket(type, rng) {
  let bestTicket = generateRandomTicket(type, rng);
  let bestScore = -Infinity;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const ticket = generateRandomTicket(type, rng);
    const score = Object.entries(type.groups).reduce((total, [groupName, rule]) => {
      return total + scoreGroup(ticket[groupName], rule);
    }, 0);

    if (score > bestScore) {
      bestTicket = ticket;
      bestScore = score;
    }
  }

  return bestTicket;
}

function generateDataReferenceTicket(type, draws, rng) {
  if (!draws.length) {
    return generateBalancedTicket(type, rng);
  }

  const ticket = {};
  for (const [groupName, rule] of Object.entries(type.groups)) {
    const frequency = new Map();
    for (let number = rule.min; number <= rule.max; number += 1) {
      frequency.set(number, 1);
    }

    for (const draw of draws) {
      for (const number of draw[groupName] ?? []) {
        frequency.set(number, (frequency.get(number) ?? 1) + 1);
      }
    }

    ticket[groupName] = weightedUniqueDraw(frequency, rule.count, rng);
  }
  return ticket;
}

function drawUnique(min, max, count, rng) {
  const values = [];
  const seen = new Set();
  let guard = 0;

  while (values.length < count && guard < 500) {
    const value = min + Math.floor(rng() * (max - min + 1));
    if (!seen.has(value)) {
      seen.add(value);
      values.push(value);
    }
    guard += 1;
  }

  for (let value = min; values.length < count && value <= max; value += 1) {
    if (!seen.has(value)) {
      seen.add(value);
      values.push(value);
    }
  }

  return values.sort((a, b) => a - b);
}

function weightedUniqueDraw(frequency, count, rng) {
  const entries = [...frequency.entries()];
  const selected = [];

  while (selected.length < count && entries.length) {
    const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let pick = rng() * totalWeight;
    const index = entries.findIndex(([, weight]) => {
      pick -= weight;
      return pick <= 0;
    });
    const safeIndex = index >= 0 ? index : entries.length - 1;
    selected.push(entries[safeIndex][0]);
    entries.splice(safeIndex, 1);
  }

  return selected.sort((a, b) => a - b);
}

function scoreGroup(numbers, rule) {
  const oddCount = numbers.filter((number) => number % 2 === 1).length;
  const parityBalance = rule.count - Math.abs(oddCount - (rule.count - oddCount));
  const regionCount = new Set(numbers.map((number) => regionOf(number, rule))).size;
  const consecutiveCount = numbers.filter((number, index) => index > 0 && number === numbers[index - 1] + 1).length;
  return parityBalance + regionCount - consecutiveCount;
}

export function explainTicket(typeId, ticket, strategy) {
  const type = getLotteryType(typeId);
  const items = [];

  for (const [groupName, rule] of Object.entries(type.groups)) {
    const numbers = ticket[groupName];
    const oddCount = numbers.filter((number) => number % 2 === 1).length;
    const evenCount = numbers.length - oddCount;
    const regions = summarizeRegions(numbers, rule);
    const consecutiveCount = numbers.filter((number, index) => index > 0 && number === numbers[index - 1] + 1).length;

    items.push(`${rule.label}奇偶比为 ${oddCount}:${evenCount}。`);
    items.push(`${rule.label}区间分布：低区 ${regions.low} 个，中区 ${regions.mid} 个，高区 ${regions.high} 个。`);
    items.push(consecutiveCount ? `${rule.label}包含 ${consecutiveCount} 组相邻号码。` : `${rule.label}未出现相邻号码。`);
  }

  const summary =
    strategy === "data"
      ? "历史数据参考生成：参考公开开奖分布，但历史数据不影响未来开奖结果。"
      : strategy === "random"
        ? "随机生成：按彩种规则生成合法号码。"
        : "均衡生成：在合法随机基础上筛选结构较均衡的组合。";

  items.push("历史数据仅用于娱乐分析，不构成中奖预测。");

  return { summary, items };
}

function summarizeRegions(numbers, rule) {
  return numbers.reduce(
    (summary, number) => {
      summary[regionOf(number, rule)] += 1;
      return summary;
    },
    { low: 0, mid: 0, high: 0 },
  );
}

function regionOf(number, rule) {
  const span = rule.max - rule.min + 1;
  const lowEdge = rule.min + Math.floor(span / 3) - 1;
  const midEdge = rule.min + Math.floor((span * 2) / 3) - 1;
  if (number <= lowEdge) return "low";
  if (number <= midEdge) return "mid";
  return "high";
}

function pickMessage(rng) {
  const index = Math.floor(rng() * DEFAULT_POSITIVE_MESSAGES.length);
  return DEFAULT_POSITIVE_MESSAGES[index] ?? DEFAULT_POSITIVE_MESSAGES[0];
}
