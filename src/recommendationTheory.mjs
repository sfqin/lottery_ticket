import { getLotteryType, validateTicket } from "./lotteryCatalog.mjs";
import { getPrizeTiers } from "./prizeRules.mjs";

const THEORY_WEIGHTS = {
  prizeTier: 0.34,
  frequency: 0.26,
  recency: 0.18,
  omission: 0.12,
  structure: 0.07,
  mystic: 0.03,
};

export function buildTierWeightedTheory({ typeId, draws = [] } = {}) {
  const type = getLotteryType(typeId);
  const tiers = getPrizeTiers(typeId);
  const tierRangeLabel = `一到${numberToChinese(tiers.length)}等奖`;
  const filtered = draws
    .filter((draw) => draw.type === typeId)
    .toSorted((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const groupPriority = deriveGroupPriority(type, tiers);
  const groups = {};

  for (const [groupName, rule] of Object.entries(type.groups)) {
    groups[groupName] = scoreNumbersForGroup({
      draws: filtered,
      groupName,
      rule,
      groupPriority: groupPriority[groupName],
    });
  }

  return {
    typeId,
    typeName: type.name,
    totalDraws: filtered.length,
    prizeTierCount: tiers.length,
    tierRangeLabel,
    weights: { ...THEORY_WEIGHTS },
    groupPriority,
    groups,
    summary: `${type.name}按官方${tierRangeLabel}命中结构、历史频次、近期开奖衰减、遗漏与组合均衡形成娱乐型评分。`,
    methodNotes: [
      "官方公开开奖数据只有每期开奖号码，不包含每张中奖票的低奖级号码；系统用官方奖级命中结构做加权。",
      "频次使用拉普拉斯平滑，近期数据使用指数衰减，避免单期波动过度放大。",
      "奇偶、大小、区间、相邻号只做组合结构约束，不代表未来开奖会按这些结构出现。",
      "玄学扰动权重很低，只用于打散同分号码，不能被解释为预测能力。",
    ],
    complianceNote: "该理论仅用于娱乐参考和模拟复盘，不构成中奖预测，不保证或暗示提高命中概率。",
  };
}

export function generateTheoryTicket({ typeId, draws = [], rng = Math.random } = {}) {
  const type = getLotteryType(typeId);
  const theory = buildTierWeightedTheory({ typeId, draws });
  const ticket = {};

  for (const [groupName, rule] of Object.entries(type.groups)) {
    const scoredNumbers = theory.groups[groupName].numbers;
    ticket[groupName] = pickBestStructuredGroup({
      scoredNumbers,
      rule,
      rng,
      power: theory.groupPriority[groupName],
    });
  }

  const validation = validateTicket(typeId, ticket);
  if (!validation.valid) {
    throw new Error(`Generated invalid theory ticket: ${validation.errors.join("; ")}`);
  }

  return {
    ticket: validation.normalized,
    theory,
  };
}

function scoreNumbersForGroup({ draws, groupName, rule, groupPriority }) {
  const counts = new Map();
  const recency = new Map();
  const lastSeen = new Map();

  for (let number = rule.min; number <= rule.max; number += 1) {
    counts.set(number, 1);
    recency.set(number, 0);
    lastSeen.set(number, -1);
  }

  draws.forEach((draw, index) => {
    const age = draws.length - 1 - index;
    const recencyBoost = Math.exp(-age / 36);
    for (const number of draw[groupName] ?? []) {
      counts.set(number, (counts.get(number) ?? 1) + 1);
      recency.set(number, (recency.get(number) ?? 0) + recencyBoost);
      lastSeen.set(number, index);
    }
  });

  const maxCount = Math.max(...counts.values(), 1);
  const maxRecency = Math.max(...recency.values(), 1);
  const maxMiss = Math.max(draws.length, 1);

  const numbers = [];
  for (let number = rule.min; number <= rule.max; number += 1) {
    const miss = lastSeen.get(number) === -1 ? draws.length : draws.length - 1 - lastSeen.get(number);
    const frequencyScore = (counts.get(number) ?? 1) / maxCount;
    const recencyScore = (recency.get(number) ?? 0) / maxRecency;
    const omissionScore = Math.min(miss / maxMiss, 1);
    const structureScore = structureNumberScore(number, rule);
    const mysticScore = mysticNumberScore(number);
    const score =
      THEORY_WEIGHTS.prizeTier * groupPriority +
      THEORY_WEIGHTS.frequency * frequencyScore +
      THEORY_WEIGHTS.recency * recencyScore +
      THEORY_WEIGHTS.omission * omissionScore +
      THEORY_WEIGHTS.structure * structureScore +
      THEORY_WEIGHTS.mystic * mysticScore;

    numbers.push({
      number,
      score,
      frequency: counts.get(number) ?? 1,
      miss,
      recencyScore,
    });
  }

  return {
    label: rule.label,
    priority: groupPriority,
    numbers: numbers.sort((a, b) => b.score - a.score || a.number - b.number),
  };
}

function deriveGroupPriority(type, tiers) {
  const totals = {};
  for (const groupName of Object.keys(type.groups)) {
    totals[groupName] = 0;
  }

  for (const tier of tiers) {
    for (const [groupName, rule] of Object.entries(type.groups)) {
      const strongestTarget = Math.max(
        ...tier.conditions.map((condition) => condition[groupName] ?? 0),
      );
      totals[groupName] += tier.weight * (strongestTarget / rule.count);
    }
  }

  const average = Object.values(totals).reduce((sum, value) => sum + value, 0) / Object.keys(totals).length;
  const priorities = {};
  for (const [groupName, total] of Object.entries(totals)) {
    priorities[groupName] = Number((total / average).toFixed(3));
  }
  return priorities;
}

function pickBestStructuredGroup({ scoredNumbers, rule, rng, power }) {
  let bestNumbers = weightedUniqueDraw(scoredNumbers, rule.count, rng, power);
  let bestScore = scoreSelectedGroup(bestNumbers, scoredNumbers, rule);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = weightedUniqueDraw(scoredNumbers, rule.count, rng, power);
    const score = scoreSelectedGroup(candidate, scoredNumbers, rule);
    if (score > bestScore) {
      bestNumbers = candidate;
      bestScore = score;
    }
  }

  return bestNumbers.sort((a, b) => a - b);
}

function weightedUniqueDraw(scoredNumbers, count, rng, power) {
  const entries = scoredNumbers.map((item) => ({
    number: item.number,
    weight: Math.max(Math.pow(item.score, Math.max(power, 0.5)), 0.01),
  }));
  const selected = [];

  while (selected.length < count && entries.length) {
    const totalWeight = entries.reduce((sum, item) => sum + item.weight, 0);
    let pick = rng() * totalWeight;
    const index = entries.findIndex((item) => {
      pick -= item.weight;
      return pick <= 0;
    });
    const safeIndex = index >= 0 ? index : entries.length - 1;
    selected.push(entries[safeIndex].number);
    entries.splice(safeIndex, 1);
  }

  return selected;
}

function scoreSelectedGroup(numbers, scoredNumbers, rule) {
  const scoreMap = new Map(scoredNumbers.map((item) => [item.number, item.score]));
  const averageScore = numbers.reduce((sum, number) => sum + (scoreMap.get(number) ?? 0), 0) / numbers.length;
  const oddCount = numbers.filter((number) => number % 2 === 1).length;
  const evenCount = numbers.length - oddCount;
  const parityScore = 1 - Math.abs(oddCount - evenCount) / numbers.length;
  const regionScore = new Set(numbers.map((number) => regionOf(number, rule))).size / Math.min(rule.count, 3);
  const consecutivePenalty =
    numbers
      .toSorted((a, b) => a - b)
      .filter((number, index, sorted) => index > 0 && number === sorted[index - 1] + 1).length / numbers.length;

  return averageScore + THEORY_WEIGHTS.structure * (parityScore + regionScore - consecutivePenalty);
}

function structureNumberScore(number, rule) {
  const regionScore = regionOf(number, rule) === "mid" ? 1 : 0.78;
  const edgePenalty = number === rule.min || number === rule.max ? 0.85 : 1;
  return regionScore * edgePenalty;
}

function mysticNumberScore(number) {
  const luckyDigits = new Set([3, 6, 8, 9]);
  const digits = String(number).split("").map(Number);
  const luckyCount = digits.filter((digit) => luckyDigits.has(digit)).length;
  const digitalRoot = digits.reduce((sum, digit) => sum + digit, 0) % 9 || 9;
  return Math.min((luckyCount + digitalRoot / 9) / 3, 1);
}

function regionOf(number, rule) {
  const span = rule.max - rule.min + 1;
  const lowEdge = rule.min + Math.floor(span / 3) - 1;
  const midEdge = rule.min + Math.floor((span * 2) / 3) - 1;
  if (number <= lowEdge) return "low";
  if (number <= midEdge) return "mid";
  return "high";
}

function numberToChinese(number) {
  return ["零", "一", "二", "三", "四", "五", "六", "七"][number] ?? String(number);
}
