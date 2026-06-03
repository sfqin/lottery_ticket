import { getLotteryType } from "./lotteryCatalog.mjs";

export function getLatestDraw(draws, typeId) {
  return draws
    .filter((draw) => draw.type === typeId)
    .toSorted((a, b) => a.date.localeCompare(b.date))
    .at(-1) ?? null;
}

export function analyzeDraws(draws, typeId) {
  const type = getLotteryType(typeId);
  const filtered = draws
    .filter((draw) => draw.type === typeId)
    .toSorted((a, b) => a.date.localeCompare(b.date));

  const hot = {};
  const cold = {};
  const omissions = {};
  const parity = {};
  const size = {};
  const regions = {};

  for (const [groupName, rule] of Object.entries(type.groups)) {
    const counts = initializeCounts(rule);
    const lastSeen = initializeLastSeen(rule);
    let odd = 0;
    let even = 0;
    let small = 0;
    let large = 0;
    const regionSummary = { low: 0, mid: 0, high: 0 };

    filtered.forEach((draw, drawIndex) => {
      for (const number of draw[groupName] ?? []) {
        counts.set(number, counts.get(number) + 1);
        lastSeen.set(number, drawIndex);
        if (number % 2 === 1) odd += 1;
        else even += 1;
        if (number <= midpoint(rule)) small += 1;
        else large += 1;
        regionSummary[regionOf(number, rule)] += 1;
      }
    });

    const ranked = [...counts.entries()]
      .map(([number, count]) => ({ number, count }))
      .sort((a, b) => b.count - a.count || a.number - b.number);

    hot[groupName] = ranked.slice(0, 8);
    cold[groupName] = [...ranked].sort((a, b) => a.count - b.count || a.number - b.number).slice(0, 8);
    omissions[groupName] = [...lastSeen.entries()]
      .map(([number, index]) => ({
        number,
        miss: index === -1 ? filtered.length : filtered.length - 1 - index,
      }))
      .sort((a, b) => b.miss - a.miss || a.number - b.number);
    parity[groupName] = { odd, even };
    size[groupName] = { small, large };
    regions[groupName] = regionSummary;
  }

  return {
    typeId,
    totalDraws: filtered.length,
    latest: getLatestDraw(draws, typeId),
    hot,
    cold,
    omissions,
    parity,
    size,
    regions,
  };
}

function initializeCounts(rule) {
  const counts = new Map();
  for (let number = rule.min; number <= rule.max; number += 1) {
    counts.set(number, 0);
  }
  return counts;
}

function initializeLastSeen(rule) {
  const lastSeen = new Map();
  for (let number = rule.min; number <= rule.max; number += 1) {
    lastSeen.set(number, -1);
  }
  return lastSeen;
}

function midpoint(rule) {
  return Math.floor((rule.min + rule.max) / 2);
}

function regionOf(number, rule) {
  const span = rule.max - rule.min + 1;
  const lowEdge = rule.min + Math.floor(span / 3) - 1;
  const midEdge = rule.min + Math.floor((span * 2) / 3) - 1;
  if (number <= lowEdge) return "low";
  if (number <= midEdge) return "mid";
  return "high";
}
