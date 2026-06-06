import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { parseSsqCsv, validateSsqDraws } from "../src/ssqHistory.mjs";

describe("stored SSQ history data", () => {
  it("contains validated historical draws through the latest imported issue", () => {
    const csv = readFileSync(new URL("../data/ssq-history.csv", import.meta.url), "utf8");
    const draws = parseSsqCsv(csv);
    const validation = validateSsqDraws(draws);

    assert.equal(validation.valid, true);
    assert.equal(draws.length, 3460);
    assert.equal(draws[0].issue, "2026063");
    assert.equal(draws[0].date, "2026-06-04");
    assert.deepEqual(draws[0].red, [2, 8, 25, 28, 30, 31]);
    assert.deepEqual(draws[0].blue, [2]);
  });
});
