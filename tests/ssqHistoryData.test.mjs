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
    assert.ok(draws.length >= 3460);
    assert.ok(draws.some((draw) => draw.issue === "2026063"));

    const latestKnown = draws.find((draw) => draw.issue === "2026064");
    assert.ok(latestKnown);
    assert.equal(latestKnown.date, "2026-06-07");
    assert.deepEqual(latestKnown.red, [1, 9, 15, 18, 29, 33]);
    assert.deepEqual(latestKnown.blue, [15]);
  });
});
