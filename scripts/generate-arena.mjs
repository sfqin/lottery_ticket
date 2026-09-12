import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { parseSsqCsv } from "../src/ssqHistory.mjs";
import { parseDltCsv } from "../src/dltHistory.mjs";
import {
  buildArenaTicketsForIssue,
  evaluateArenaEntries,
  nextIssue,
  parseArenaCsv,
  serializeArenaCsv,
} from "../src/strategyArena.mjs";

const TARGETS = [
  {
    typeId: "ssq",
    historyPath: new URL("../data/ssq-history.csv", import.meta.url),
    arenaPath: new URL("../data/ssq-arena.csv", import.meta.url),
    parseHistory: parseSsqCsv,
  },
  {
    typeId: "dlt",
    historyPath: new URL("../data/dlt-history.csv", import.meta.url),
    arenaPath: new URL("../data/dlt-arena.csv", import.meta.url),
    parseHistory: parseDltCsv,
  },
];

for (const target of TARGETS) {
  generateForTarget(target);
}

function generateForTarget({ typeId, historyPath, arenaPath, parseHistory }) {
  if (!existsSync(historyPath)) {
    console.warn(`Skip ${typeId}: history file missing at ${historyPath.pathname}`);
    return;
  }

  const draws = parseHistory(readFileSync(historyPath, "utf8"));
  if (draws.length === 0) {
    console.warn(`Skip ${typeId}: no draws found`);
    return;
  }

  const latestIssue = draws
    .map((draw) => String(draw.issue))
    .sort((a, b) => b.localeCompare(a))[0];

  let entries = existsSync(arenaPath)
    ? parseArenaCsv(readFileSync(arenaPath, "utf8"))
    : [];

  // 1. 评估上一期（及更早未评估）号码的命中情况
  entries = evaluateArenaEntries(entries, draws);

  // 2. 为下一期生成号码（若尚未生成）
  const upcomingIssue = nextIssue(latestIssue);
  const hasUpcoming = entries.some((entry) => entry.issue === upcomingIssue);
  if (!hasUpcoming) {
    entries.push(...buildArenaTicketsForIssue({ typeId, issue: upcomingIssue, draws }));
    console.log(`Generated arena tickets for ${typeId} 第${upcomingIssue}期`);
  } else {
    console.log(`Arena tickets for ${typeId} 第${upcomingIssue}期 already exist`);
  }

  mkdirSync(dirname(arenaPath.pathname), { recursive: true });
  writeFileSync(arenaPath, serializeArenaCsv(entries), "utf8");
  console.log(`Wrote ${entries.length} arena entries into ${arenaPath.pathname}`);
}
