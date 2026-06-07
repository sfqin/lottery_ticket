import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { evaluateTicketAgainstDraw, getPrizeTiers, getPrizeRuleSummary } from "../src/prizeRules.mjs";

const ssqDraw = {
  type: "ssq",
  issue: "2026001",
  date: "2026-01-01",
  red: [1, 2, 3, 4, 5, 6],
  blue: [7],
};

const dltDraw = {
  type: "dlt",
  issue: "26001",
  date: "2026-01-01",
  front: [1, 2, 3, 4, 5],
  back: [6, 7],
};

describe("official prize rules", () => {
  it("models double color ball with six prize tiers", () => {
    const tiers = getPrizeTiers("ssq");

    assert.equal(tiers.length, 6);
    assert.equal(tiers[0].name, "一等奖");
    assert.equal(tiers.at(-1).name, "六等奖");
    assert.equal(tiers.at(-1).prize, "5元");
  });

  it("evaluates double color ball first, second, sixth, and no prize cases", () => {
    assert.equal(
      evaluateTicketAgainstDraw("ssq", { red: [1, 2, 3, 4, 5, 6], blue: [7] }, ssqDraw).tier,
      1,
    );
    assert.equal(
      evaluateTicketAgainstDraw("ssq", { red: [1, 2, 3, 4, 5, 6], blue: [8] }, ssqDraw).tier,
      2,
    );
    assert.equal(
      evaluateTicketAgainstDraw("ssq", { red: [9, 10, 11, 12, 13, 14], blue: [7] }, ssqDraw).tier,
      6,
    );
    assert.equal(
      evaluateTicketAgainstDraw("ssq", { red: [9, 10, 11, 12, 13, 14], blue: [8] }, ssqDraw).hit,
      false,
    );
  });

  it("models super lotto with seven prize tiers", () => {
    const tiers = getPrizeTiers("dlt");

    assert.equal(tiers.length, 7);
    assert.equal(tiers[0].name, "一等奖");
    assert.equal(tiers.at(-1).name, "七等奖");
    assert.equal(tiers.at(-1).prize, "5元");
  });

  it("summarizes prize rules and prize labels for display", () => {
    const ssqRules = getPrizeRuleSummary("ssq");
    const dltRules = getPrizeRuleSummary("dlt");

    assert.match(ssqRules.note, /浮动奖金以官方当期开奖公告为准/);
    assert.match(ssqRules.rows.find((row) => row.name === "六等奖").conditionText, /蓝球1个/);
    assert.equal(dltRules.rows.find((row) => row.name === "七等奖").prize, "5元");
  });

  it("evaluates super lotto first, third, seventh, and no prize cases", () => {
    assert.equal(
      evaluateTicketAgainstDraw("dlt", { front: [1, 2, 3, 4, 5], back: [6, 7] }, dltDraw).tier,
      1,
    );
    assert.equal(
      evaluateTicketAgainstDraw("dlt", { front: [1, 2, 3, 4, 5], back: [8, 9] }, dltDraw).tier,
      3,
    );
    assert.equal(
      evaluateTicketAgainstDraw("dlt", { front: [20, 21, 22, 23, 24], back: [6, 7] }, dltDraw).tier,
      7,
    );
    assert.equal(
      evaluateTicketAgainstDraw("dlt", { front: [20, 21, 22, 23, 24], back: [8, 9] }, dltDraw).hit,
      false,
    );
  });
});
