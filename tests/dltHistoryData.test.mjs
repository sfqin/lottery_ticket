import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { parseDltCsv, validateDltDraws } from "../src/dltHistory.mjs";

describe("stored DLT history data", () => {
  it("contains validated historical draws through the latest imported issue", () => {
    const csv = readFileSync(new URL("../data/dlt-history.csv", import.meta.url), "utf8");
    const draws = parseDltCsv(csv);
    const validation = validateDltDraws(draws);

    assert.equal(validation.valid, true);
    assert.equal(draws.length, 2879);
    assert.equal(draws[0].issue, "26061");
    assert.equal(draws[0].date, "2026-06-03");
    assert.deepEqual(draws[0].front, [10, 12, 26, 31, 35]);
    assert.deepEqual(draws[0].back, [2, 12]);
  });
});
