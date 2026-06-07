import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createSimulationRecord, summarizeSimulationRecords } from "../src/simulationTracker.mjs";

const draw = {
  type: "ssq",
  issue: "2026001",
  date: "2026-01-01",
  red: [1, 2, 3, 4, 5, 6],
  blue: [7],
};

describe("simulation tracker", () => {
  it("records a simulated prize evaluation for a generated ticket", () => {
    const record = createSimulationRecord({
      recommendation: {
        typeId: "ssq",
        ticket: { red: [1, 2, 3, 4, 5, 6], blue: [7] },
      },
      draw,
    });

    assert.equal(record.issue, "2026001");
    assert.equal(record.evaluation.tierName, "一等奖");
    assert.match(record.lesson, /模拟命中一等奖/);
    assert.match(record.complianceNote, /不代表未来命中概率/);
  });

  it("summarizes simulated records without claiming future improvement", () => {
    const records = [
      createSimulationRecord({
        recommendation: { typeId: "ssq", ticket: { red: [1, 2, 3, 4, 5, 6], blue: [7] } },
        draw,
      }),
      createSimulationRecord({
        recommendation: { typeId: "ssq", ticket: { red: [9, 10, 11, 12, 13, 14], blue: [8] } },
        draw,
      }),
    ];

    const summary = summarizeSimulationRecords("ssq", records);

    assert.equal(summary.total, 2);
    assert.equal(summary.hitCount, 1);
    assert.equal(summary.bestTierName, "一等奖");
    assert.match(summary.lesson, /只用于观察组合结构/);
  });
});
