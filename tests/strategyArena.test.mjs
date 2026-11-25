import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  STRATEGY_ORDER,
  LINES_PER_STRATEGY,
  buildArenaTicketsForIssue,
  evaluateArenaEntries,
  nextIssue,
  parseArenaCsv,
  serializeArenaCsv,
  summarizeArena,
} from "../src/strategyArena.mjs";

const ssqDraw = {
  type: "ssq",
  issue: "2026001",
  date: "2026-01-01",
  red: [1, 2, 3, 4, 5, 6],
  blue: [7],
};

function seededRng() {
  let seed = 42;
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

describe("strategy arena", () => {
  it("derives the next issue while preserving zero padding", () => {
    assert.equal(nextIssue("2026064"), "2026065");
    assert.equal(nextIssue("26063"), "26064");
  });

  it("builds 5 strategies x 5 lines per issue", () => {
    const entries = buildArenaTicketsForIssue({
      typeId: "ssq",
      issue: "2026065",
      draws: [],
      rng: seededRng(),
    });

    assert.equal(entries.length, STRATEGY_ORDER.length * LINES_PER_STRATEGY);
    for (const strategy of STRATEGY_ORDER) {
      const lines = entries.filter((entry) => entry.strategy === strategy);
      assert.equal(lines.length, LINES_PER_STRATEGY);
    }
    assert.ok(entries.every((entry) => entry.evaluated === false));
  });

  it("round-trips through CSV serialization", () => {
    const entries = buildArenaTicketsForIssue({
      typeId: "ssq",
      issue: "2026065",
      draws: [],
      rng: seededRng(),
    });

    const csv = serializeArenaCsv(entries);
    const parsed = parseArenaCsv(csv);

    assert.equal(parsed.length, entries.length);
    assert.deepEqual(parsed[0].ticket, entries.find(
      (entry) => entry.strategy === parsed[0].strategy && entry.line === parsed[0].line,
    ).ticket);
  });

  it("evaluates entries against draws and summarizes prize per strategy", () => {
    const winningTicket = { red: [1, 2, 3, 4, 5, 6], blue: [7] };
    const losingTicket = { red: [10, 11, 12, 13, 14, 15], blue: [8] };

    const entries = [
      {
        type: "ssq",
        typeName: "双色球",
        issue: "2026001",
        strategy: "random",
        line: 1,
        ticket: winningTicket,
        evaluated: false,
        tier: 0,
        tierName: "未开奖",
        prizeLabel: "",
        prizeYuan: null,
      },
      {
        type: "ssq",
        typeName: "双色球",
        issue: "2026001",
        strategy: "balanced",
        line: 1,
        ticket: losingTicket,
        evaluated: false,
        tier: 0,
        tierName: "未开奖",
        prizeLabel: "",
        prizeYuan: null,
      },
    ];

    const evaluated = evaluateArenaEntries(entries, [ssqDraw]);
    const winning = evaluated.find((entry) => entry.strategy === "random");
    const losing = evaluated.find((entry) => entry.strategy === "balanced");

    assert.equal(winning.evaluated, true);
    assert.equal(winning.tier, 1);
    assert.equal(losing.tier, 0);
    assert.equal(losing.prizeLabel, "未命中");

    const summary = summarizeArena("ssq", evaluated);
    assert.equal(summary.length, 1);
    assert.equal(summary[0].issue, "2026001");
    const balancedSummary = summary[0].strategies.find((s) => s.strategy === "balanced");
    assert.equal(balancedSummary.prizeText, "0元");
  });

  it("marks unevaluated issues as 待开奖", () => {
    const entries = buildArenaTicketsForIssue({
      typeId: "dlt",
      issue: "26064",
      draws: [],
      rng: seededRng(),
    });

    const summary = summarizeArena("dlt", entries);
    assert.equal(summary[0].evaluated, false);
    assert.ok(summary[0].strategies.every((s) => s.prizeText === "待开奖"));
  });
});
