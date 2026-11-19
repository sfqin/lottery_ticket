import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseSinaSsqDetailResponse,
  parseSinaSsqListResponse,
  parseSsqCsv,
  serializeSsqCsv,
  validateSsqDraws,
} from "../src/ssqHistory.mjs";

const sinaListResponse = {
  result: {
    status: { code: 0, msg: "success" },
    pagination: { totalPage: 118 },
    data: [
      {
        issueNo: "2026118",
        openTime: "2026-10-15 21:15:00",
        redResults: ["05", "21", "22", "23", "28", "31"],
        blueResults: ["14"],
        status: "1",
      },
      {
        issueNo: "2026117",
        openTime: "2026-10-13 21:15:00",
        redResults: ["04", "11", "14", "22", "26", "27"],
        blueResults: ["04"],
        status: "1",
      },
    ],
  },
};

const sinaDetailResponse = {
  result: {
    status: { code: 0, msg: "success" },
    data: {
      issueNo: "2026118",
      openTime: "2026-10-15 21:15:00",
      redResults: ["05", "21", "22", "23", "28", "31"],
      blueResults: ["14"],
      saleMoney: "340890776",
      prizeList: [
        { prizeDesc: "一等奖", prizeCount: "5" },
        { prizeDesc: "二等奖", prizeCount: "80" },
      ],
      status: "1",
    },
  },
};

describe("ssq history import", () => {
  it("parses Sina lottery history list responses", () => {
    const parsed = parseSinaSsqListResponse(sinaListResponse);

    assert.equal(parsed.totalPages, 118);
    assert.deepEqual(parsed.draws[0], {
      type: "ssq",
      issue: "2026118",
      date: "2026-10-15",
      red: [5, 21, 22, 23, 28, 31],
      blue: [14],
      sales: null,
      firstPrizeCount: null,
      secondPrizeCount: null,
      source: "sina",
    });
  });

  it("parses Sina lottery detail responses with prize fields", () => {
    assert.deepEqual(parseSinaSsqDetailResponse(sinaDetailResponse), {
      type: "ssq",
      issue: "2026118",
      date: "2026-10-15",
      red: [5, 21, 22, 23, 28, 31],
      blue: [14],
      sales: 340890776,
      firstPrizeCount: 5,
      secondPrizeCount: 80,
      source: "sina",
    });
  });

  it("rejects failed or malformed Sina lottery responses", () => {
    assert.throws(
      () => parseSinaSsqListResponse({ result: { status: { code: 1, msg: "查询失败" } } }),
      /查询失败/,
    );
    assert.throws(
      () =>
        parseSinaSsqListResponse({
          result: {
            status: { code: 0, msg: "success" },
            pagination: { totalPage: 1 },
            data: [{ issueNo: "2026118", openTime: "bad" }],
          },
        }),
      /invalid SSQ date/i,
    );
    assert.throws(
      () => parseSinaSsqListResponse({ result: { status: { code: 0 } } }),
      /invalid history page/i,
    );
  });

  it("serializes and parses CSV without losing draw fields", () => {
    const draws = parseSinaSsqListResponse(sinaListResponse).draws;
    const csv = serializeSsqCsv(draws);
    const parsed = parseSsqCsv(csv);

    assert.equal(csv.split("\n")[0], "type,issue,date,red1,red2,red3,red4,red5,red6,blue,sales,firstPrizeCount,secondPrizeCount,source");
    assert.deepEqual(parsed, draws);
  });

  it("validates draw shape, issue uniqueness, and ticket legality", () => {
    const draws = parseSinaSsqListResponse(sinaListResponse).draws;
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
