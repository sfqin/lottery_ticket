import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateTicket } from "../src/lotteryCatalog.mjs";
import { generateTicket } from "../src/numberGenerator.mjs";
import { buildTierWeightedTheory } from "../src/recommendationTheory.mjs";

const sequenceRng = (values) => {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
};

const ssqDraws = [
  { type: "ssq", issue: "2026001", date: "2026-01-01", red: [1, 5, 9, 12, 18, 28], blue: [6] },
  { type: "ssq", issue: "2026002", date: "2026-01-03", red: [2, 5, 10, 16, 22, 30], blue: [8] },
  { type: "ssq", issue: "2026003", date: "2026-01-05", red: [3, 7, 11, 18, 24, 31], blue: [6] },
  { type: "ssq", issue: "2026004", date: "2026-01-07", red: [4, 8, 12, 19, 25, 33], blue: [9] },
];

const dltDraws = [
  { type: "dlt", issue: "26001", date: "2026-01-01", front: [1, 5, 9, 12, 18], back: [6, 11] },
  { type: "dlt", issue: "26002", date: "2026-01-03", front: [2, 5, 10, 16, 22], back: [8, 12] },
  { type: "dlt", issue: "26003", date: "2026-01-05", front: [3, 7, 11, 18, 24], back: [6, 9] },
  { type: "dlt", issue: "26004", date: "2026-01-07", front: [4, 8, 12, 19, 25], back: [9, 10] },
];

describe("tier-weighted recommendation theory", () => {
  it("summarizes double color ball as a six-tier entertainment model", () => {
    const theory = buildTierWeightedTheory({ typeId: "ssq", draws: ssqDraws });

    assert.equal(theory.prizeTierCount, 6);
    assert.match(theory.summary, /一到六等奖/);
    assert.match(theory.complianceNote, /不构成中奖预测/);
    assert.equal(theory.weights.frequency > theory.weights.mystic, true);
  });

  it("summarizes super lotto as a seven-tier entertainment model", () => {
    const theory = buildTierWeightedTheory({ typeId: "dlt", draws: dltDraws });

    assert.equal(theory.prizeTierCount, 7);
    assert.match(theory.summary, /一到七等奖/);
    assert.match(theory.methodNotes.join(""), /官方奖级命中结构/);
  });

  it("generates valid theory-based tickets without promising predictive value", () => {
    const result = generateTicket({
      typeId: "dlt",
      strategy: "theory",
      draws: dltDraws,
      rng: sequenceRng([0.01, 0.22, 0.41, 0.63, 0.84, 0.16, 0.92]),
    });

    assert.equal(validateTicket("dlt", result.ticket).valid, true);
    assert.equal(result.strategy, "theory");
    assert.match(result.explanation.summary, /分层理论模型/);
    assert.ok(result.explanation.items.some((item) => item.includes("不构成中奖预测")));
  });
});
