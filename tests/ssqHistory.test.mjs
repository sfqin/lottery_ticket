import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseCwlSsqResponse,
  parseSsqCsv,
  serializeSsqCsv,
  validateSsqDraws,
} from "../src/ssqHistory.mjs";

const officialResponse = {
  state: 0,
  pageNum: 70,
  result: [
    {
      code: "2026118",
      date: "2026-10-15(四)",
      red: "05,21,22,23,28,31",
      blue: "14",
      sales: "340890776",
      prizegrades: [
        { type: 1, typenum: "5" },
        { type: 2, typenum: "80" },
      ],
    },
    {
      code: "2026117",
      date: "2026-10-13(二)",
      red: "03,08,12,17,19,30",
      blue: "06",
      sales: "320000000",
      prizegrades: [
        { type: 1, typenum: "4" },
        { type: 2, typenum: "90" },
      ],
    },
  ],
};

describe("ssq history import", () => {
  it("parses official China Welfare Lottery history responses", () => {
    const parsed = parseCwlSsqResponse(officialResponse);

    assert.equal(parsed.totalPages, 70);
    assert.deepEqual(parsed.draws[0], {
      type: "ssq",
      issue: "2026118",
      date: "2026-10-15",
      red: [5, 21, 22, 23, 28, 31],
      blue: [14],
      sales: 340890776,
      firstPrizeCount: 5,
      secondPrizeCount: 80,
      source: "cwl",
    });
  });

  it("rejects failed or malformed China Welfare Lottery responses", () => {
    assert.throws(
      () => parseCwlSsqResponse({ state: 1, message: "查询失败" }),
      /查询失败/,
    );
    assert.throws(
      () =>
        parseCwlSsqResponse({
          state: 0,
          pageNum: 1,
          result: [{ code: "2026118", date: "bad" }],
        }),
      /invalid SSQ date/i,
    );
    assert.throws(
      () => parseCwlSsqResponse({ state: 0, pageNum: 1 }),
      /invalid history page/i,
    );
  });

  it("serializes and parses CSV without losing draw fields", () => {
    const draws = parseCwlSsqResponse(officialResponse).draws;
    const csv = serializeSsqCsv(draws);
    const parsed = parseSsqCsv(csv);

    assert.equal(csv.split("\n")[0], "type,issue,date,red1,red2,red3,red4,red5,red6,blue,sales,firstPrizeCount,secondPrizeCount,source");
    assert.deepEqual(parsed, draws);
  });

  it("validates draw shape, issue uniqueness, and ticket legality", () => {
    const draws = parseCwlSsqResponse(officialResponse).draws;
    const report = validateSsqDraws(draws);

    assert.equal(report.valid, true);
    assert.deepEqual(report.errors, []);

    const bad = validateSsqDraws([
      ...draws,
      { ...draws[0], issue: draws[1].issue, red: [1, 1, 2, 3, 4, 5] },
    ]);
    assert.equal(bad.valid, false);
    assert.match(bad.errors.join("\n"), /duplicate issue/);
    assert.match(bad.errors.join("\n"), /red must not contain duplicates/);
  });
});
