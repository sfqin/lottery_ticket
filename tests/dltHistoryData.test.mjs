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
    assert.ok(draws.length >= 2879);
    assert.ok(draws.some((draw) => draw.issue === "26061"));

    const latestKnown = draws.find((draw) => draw.issue === "26062");
    assert.ok(latestKnown);
    assert.equal(latestKnown.date, "2026-06-06");
    assert.deepEqual(latestKnown.front, [7, 15, 20, 24, 29]);
    assert.deepEqual(latestKnown.back, [4, 10]);
  });
});
