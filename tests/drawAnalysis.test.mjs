import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { analyzeDraws, getLatestDraw } from "../src/drawAnalysis.mjs";

const draws = [
  { type: "ssq", issue: "2026001", date: "2026-01-01", red: [1, 2, 3, 11, 22, 33], blue: [6] },
  { type: "ssq", issue: "2026002", date: "2026-01-03", red: [2, 4, 6, 12, 22, 30], blue: [8] },
  { type: "ssq", issue: "2026003", date: "2026-01-05", red: [2, 5, 7, 13, 23, 31], blue: [6] },
  { type: "dlt", issue: "26001", date: "2026-01-02", front: [1, 8, 12, 24, 35], back: [3, 12] },
];

describe("draw analysis", () => {
  it("returns the latest draw for a lottery type", () => {
    const latest = getLatestDraw(draws, "ssq");

    assert.equal(latest.issue, "2026003");
    assert.deepEqual(latest.red, [2, 5, 7, 13, 23, 31]);
  });

  it("calculates hot, cold, omission, parity, size, and region stats", () => {
    const analysis = analyzeDraws(draws, "ssq");

    assert.equal(analysis.totalDraws, 3);
    assert.equal(analysis.hot.red[0].number, 2);
    assert.equal(analysis.hot.red[0].count, 3);
    assert.equal(analysis.omissions.red.find((item) => item.number === 2).miss, 0);
    assert.equal(analysis.omissions.red.find((item) => item.number === 1).miss, 2);
    assert.equal(analysis.parity.red.odd, 9);
    assert.equal(analysis.parity.red.even, 9);
    assert.equal(analysis.size.red.small, 12);
    assert.equal(analysis.size.red.large, 6);
    assert.deepEqual(analysis.regions.red, { low: 10, mid: 4, high: 4 });
  });
});
