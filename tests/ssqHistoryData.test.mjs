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
    assert.ok(draws.length >= 3515);
    assert.ok(draws.some((draw) => draw.issue === "2026063"));

    const latestKnown = draws.find((draw) => draw.issue === "2026064");
    assert.ok(latestKnown);
    assert.equal(latestKnown.date, "2026-06-07");
    assert.deepEqual(latestKnown.red, [1, 9, 15, 18, 29, 33]);
    assert.deepEqual(latestKnown.blue, [15]);

    const latestImported = draws.find((draw) => draw.issue === "2026118");
    assert.ok(latestImported);
    assert.equal(latestImported.date, "2026-10-15");
    assert.deepEqual(latestImported.red, [5, 21, 22, 23, 28, 31]);
    assert.deepEqual(latestImported.blue, [14]);
  });
});
