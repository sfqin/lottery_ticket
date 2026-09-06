// 生成 mock 策略擂台数据：覆盖多期已开奖记录与多种命中场景
// 用法：node scripts/seed-mock-arena.mjs
import { readFileSync, writeFileSync } from "node:fs";

import { parseSsqCsv } from "../src/ssqHistory.mjs";
import { parseDltCsv } from "../src/dltHistory.mjs";
import {
  buildArenaTicketsForIssue,
  evaluateArenaEntries,
  nextIssue,
  serializeArenaCsv,
  STRATEGY_ORDER,
} from "../src/strategyArena.mjs";

const ssqHistoryPath = new URL("../data/ssq-history.csv", import.meta.url);
const dltHistoryPath = new URL("../data/dlt-history.csv", import.meta.url);
const ssqArenaPath = new URL("../data/ssq-arena.csv", import.meta.url);
const dltArenaPath = new URL("../data/dlt-arena.csv", import.meta.url);

const ssqDraws = parseSsqCsv(readFileSync(ssqHistoryPath, "utf8"));
const dltDraws = parseDltCsv(readFileSync(dltHistoryPath, "utf8"));

// 双色球：取最近 13 期作为已归档（2026052..2026064），plus 下一期 2026065 待开奖
const ssqIssues = [
  "2026052", "2026053", "2026054", "2026055", "2026056",
  "2026057", "2026058", "2026059", "2026060", "2026061",
  "2026062", "2026063", "2026064",
];

// 大乐透：取最近 13 期（26051..26063），plus 26064 待开奖
const dltIssues = [
  "26051", "26052", "26053", "26054", "26055",
  "26056", "26057", "26058", "26059", "26060",
  "26061", "26062", "26063",
];

// 每期注入命中模式：strategy → [linesIndex, redCount, blueCount]
// 双色球场景库（红匹配数, 蓝匹配数）
const ssqInjectionPatterns = [
  // 第 1 期：全部未中
  [],
  // 第 2 期：1 张 5 元
  [["trend", 1, 0, 1]],
  // 第 3 期：2 张小奖
  [["balanced", 2, 1, 1], ["data", 3, 4, 0]],
  // 第 4 期：1 张 200 元
  [["theory", 4, 5, 0]],
  // 第 5 期：未中
  [],
  // 第 6 期：3 张 10 元
  [["random", 1, 4, 0], ["data", 2, 3, 1], ["trend", 3, 4, 0]],
  // 第 7 期：1 张 3000 元
  [["balanced", 5, 5, 1]],
  // 第 8 期：未中
  [],
  // 第 9 期：1 张 200 元 + 1 张 5 元
  [["data", 1, 4, 1], ["theory", 2, 0, 1]],
  // 第 10 期：未中
  [],
  // 第 11 期：1 张 5 元
  [["random", 4, 1, 1]],
  // 第 12 期：1 张 200 + 2 张 10
  [["trend", 2, 5, 0], ["data", 1, 4, 1], ["balanced", 5, 4, 0]],
  // 第 13 期：1 张 3000 + 1 张 200 + 1 张 5
  [["balanced", 5, 5, 1], ["data", 1, 4, 1], ["theory", 3, 2, 1]],
];

// 大乐透场景库（前匹配数, 后匹配数）
const dltInjectionPatterns = [
  [],
  [["trend", 1, 0, 2]],
  [["balanced", 3, 3, 1], ["data", 2, 4, 0]],
  [["theory", 4, 4, 1]],
  [],
  [["random", 1, 3, 0], ["data", 2, 2, 1], ["trend", 3, 0, 2]],
  [["balanced", 5, 4, 2]],
  [],
  [["data", 1, 4, 0], ["theory", 2, 3, 1]],
  [],
  [["random", 4, 0, 2]],
  [["trend", 2, 4, 1], ["data", 1, 4, 0], ["balanced", 5, 3, 1]],
  [["theory", 5, 4, 2], ["data", 1, 2, 1]],
];

writeFileSync(ssqArenaPath, serializeArenaCsv(buildSsqMock(ssqDraws)), "utf8");
writeFileSync(dltArenaPath, serializeArenaCsv(buildDltMock(dltDraws)), "utf8");

console.log("Mock arena data written.");

function pickDraw(draws, issue) {
  const found = draws.find((draw) => String(draw.issue) === String(issue));
  if (!found) throw new Error(`Draw not found: ${issue}`);
  return found;
}

function buildSsqMock(draws) {
  const entries = [];

  ssqIssues.forEach((issue, idx) => {
    const draw = pickDraw(draws, issue);
    for (const strategy of STRATEGY_ORDER) {
      const lines = buildArenaTicketsForIssue({
        typeId: "ssq",
        issue,
        draws,
        rng: seededRng(idx * 1000 + strategy.length * 17 + 7),
      }).filter((entry) => entry.strategy === strategy);
      entries.push(...lines);
    }

    const patterns = ssqInjectionPatterns[idx] || [];
    for (const [strategy, line, redCount, blueCount] of patterns) {
      injectSsqLine(
        entries,
        issue,
        strategy,
        line,
        ssqTicket(draw.red.slice(0, redCount), blueCount > 0 ? [draw.blue[0]] : []),
      );
    }
  });

  const evaluated = evaluateArenaEntries(entries, draws);

  // 下一期未开奖
  const upcoming = nextIssue(ssqIssues[ssqIssues.length - 1]);
  evaluated.push(...buildArenaTicketsForIssue({ typeId: "ssq", issue: upcoming, draws, rng: seededRng(999) }));

  return evaluated;
}

function buildDltMock(draws) {
  const entries = [];

  dltIssues.forEach((issue, idx) => {
    const draw = pickDraw(draws, issue);
    for (const strategy of STRATEGY_ORDER) {
      const lines = buildArenaTicketsForIssue({
        typeId: "dlt",
        issue,
        draws,
        rng: seededRng(idx * 1000 + strategy.length * 13 + 11),
      }).filter((entry) => entry.strategy === strategy);
      entries.push(...lines);
    }

    const patterns = dltInjectionPatterns[idx] || [];
    for (const [strategy, line, frontCount, backCount] of patterns) {
      injectDltLine(
        entries,
        issue,
        strategy,
        line,
        dltTicket(draw.front.slice(0, frontCount), draw.back.slice(0, backCount)),
      );
    }
  });

  const evaluated = evaluateArenaEntries(entries, draws);

  const upcoming = nextIssue(dltIssues[dltIssues.length - 1]);
  evaluated.push(...buildArenaTicketsForIssue({ typeId: "dlt", issue: upcoming, draws, rng: seededRng(888) }));

  return evaluated;
}

function injectSsqLine(entries, issue, strategy, line, ticket) {
  const target = entries.find(
    (entry) => entry.type === "ssq" && entry.issue === issue && entry.strategy === strategy && entry.line === line,
  );
  if (!target) throw new Error(`Entry not found: ssq ${issue} ${strategy} ${line}`);
  target.ticket = ticket;
}

function injectDltLine(entries, issue, strategy, line, ticket) {
  const target = entries.find(
    (entry) => entry.type === "dlt" && entry.issue === issue && entry.strategy === strategy && entry.line === line,
  );
  if (!target) throw new Error(`Entry not found: dlt ${issue} ${strategy} ${line}`);
  target.ticket = ticket;
}

function ssqTicket(redMatched, blueMatched) {
  const fillerRed = pickFillers(redMatched, 6, 1, 33);
  const fillerBlue = pickFillers(blueMatched, 1, 1, 16);
  return {
    red: [...redMatched, ...fillerRed].sort((a, b) => a - b),
    blue: [...blueMatched, ...fillerBlue],
  };
}

function dltTicket(frontMatched, backMatched) {
  const fillerFront = pickFillers(frontMatched, 5, 1, 35);
  const fillerBack = pickFillers(backMatched, 2, 1, 12);
  return {
    front: [...frontMatched, ...fillerFront].sort((a, b) => a - b),
    back: [...backMatched, ...fillerBack].sort((a, b) => a - b),
  };
}

function pickFillers(existing, total, min, max) {
  const need = total - existing.length;
  const taken = new Set(existing);
  const result = [];
  for (let n = min; n <= max && result.length < need; n += 1) {
    if (taken.has(n)) continue;
    result.push(n);
    taken.add(n);
  }
  return result;
}

function seededRng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}
