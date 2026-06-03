import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateTicket } from "../src/lotteryCatalog.mjs";
import { generateTicket } from "../src/numberGenerator.mjs";

const sequenceRng = (values) => {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
};

const sampleSsqDraws = [
  { type: "ssq", red: [1, 5, 9, 12, 18, 28], blue: [6] },
  { type: "ssq", red: [2, 5, 10, 16, 22, 30], blue: [8] },
  { type: "ssq", red: [3, 7, 11, 18, 24, 31], blue: [6] },
  { type: "ssq", red: [4, 8, 12, 19, 25, 33], blue: [9] },
];

describe("number generator", () => {
  it("generates a valid random double color ball ticket", () => {
    const result = generateTicket({
      typeId: "ssq",
      strategy: "random",
      rng: sequenceRng([0, 0.2, 0.4, 0.6, 0.8, 0.95, 0.3]),
    });

    assert.equal(validateTicket("ssq", result.ticket).valid, true);
    assert.equal(result.strategy, "random");
    assert.match(result.explanation.summary, /随机/);
  });

  it("generates a balanced super lotto ticket with distribution explanation", () => {
    const result = generateTicket({
      typeId: "dlt",
      strategy: "balanced",
      rng: sequenceRng([0.01, 0.18, 0.36, 0.55, 0.82, 0.1, 0.9]),
    });

    assert.equal(validateTicket("dlt", result.ticket).valid, true);
    assert.equal(result.strategy, "balanced");
    assert.ok(result.explanation.items.some((item) => item.includes("奇偶")));
    assert.ok(result.explanation.items.some((item) => item.includes("区间")));
  });

  it("generates a data reference ticket and mentions historical randomness", () => {
    const result = generateTicket({
      typeId: "ssq",
      strategy: "data",
      draws: sampleSsqDraws,
      rng: sequenceRng([0.01, 0.15, 0.25, 0.5, 0.75, 0.9, 0.2]),
    });

    assert.equal(validateTicket("ssq", result.ticket).valid, true);
    assert.equal(result.strategy, "data");
    assert.match(result.explanation.summary, /历史数据参考/);
    assert.ok(result.explanation.items.some((item) => item.includes("不构成中奖预测")));
  });
});
