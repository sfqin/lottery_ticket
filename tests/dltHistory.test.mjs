import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseDltCsv,
  parseSinaDltDetailResponse,
  parseSinaDltListResponse,
  serializeDltCsv,
  validateDltDraws,
} from "../src/dltHistory.mjs";

const sinaListResponse = {
  result: {
    status: { code: 0, msg: "success" },
    pagination: { totalPage: 98 },
    data: [
      {
        issueNo: "26118",
        openTime: "2026-10-17 21:25:00",
        redResults: ["02", "09", "21", "26", "32"],
        blueResults: ["06", "12"],
        status: "1",
      },
      {
        issueNo: "26117",
        openTime: "2026-10-14 21:25:00",
        redResults: ["04", "13", "19", "29", "31"],
        blueResults: ["02", "12"],
        status: "1",
      },
    ],
  },
};

const sinaDetailResponse = {
  result: {
    status: { code: 0, msg: "success" },
    data: {
      issueNo: "26118",
      openTime: "2026-10-17 21:25:00",
      redResults: ["02", "09", "21", "26", "32"],
      blueResults: ["06", "12"],
      saleMoney: "316189166",
      poolMoney: "796723787.40",
      prizeList: [
        { prizeDesc: "一等奖", prizeCount: "2" },
        { prizeDesc: "追加一等奖", prizeCount: "0" },
        { prizeDesc: "二等奖", prizeCount: "96" },
      ],
      status: "1",
    },
  },
};

describe("DLT history import", () => {
  it("parses Sina lottery history list responses", () => {
    const parsed = parseSinaDltListResponse(sinaListResponse);

    assert.equal(parsed.totalPages, 98);
    assert.deepEqual(parsed.draws[0], {
      type: "dlt",
      issue: "26118",
      date: "2026-10-17",
      front: [2, 9, 21, 26, 32],
      back: [6, 12],
      sales: null,
      pool: null,
      firstPrizeCount: null,
      secondPrizeCount: null,
      source: "sina",
    });
  });

  it("parses Sina lottery detail responses with prize fields", () => {
    assert.deepEqual(parseSinaDltDetailResponse(sinaDetailResponse), {
      type: "dlt",
      issue: "26118",
      date: "2026-10-17",
      front: [2, 9, 21, 26, 32],
      back: [6, 12],
      sales: 316189166,
      pool: 796723787.4,
      firstPrizeCount: 2,
      secondPrizeCount: 96,
      source: "sina",
    });
  });

  it("rejects failed or malformed Sina lottery responses", () => {
    assert.throws(
      () => parseSinaDltListResponse({ result: { status: { code: 1, msg: "处理失败" } } }),
      /处理失败/,
    );
    assert.throws(
      () =>
        parseSinaDltListResponse({
          result: {
            status: { code: 0, msg: "success" },
            pagination: { totalPage: 1 },
            data: [{ issueNo: "26118", openTime: "2026-10-17", redResults: ["02"] }],
          },
        }),
      /invalid DLT result/i,
    );
    assert.throws(
      () => parseSinaDltListResponse({ result: { status: { code: 0 } } }),
      /invalid history page/i,
    );
  });

  it("serializes and parses CSV without losing draw fields", () => {
    const draws = parseSinaDltListResponse(sinaListResponse).draws;

    const csv = serializeDltCsv(draws);
    const parsed = parseDltCsv(csv);

    assert.equal(csv.split("\n")[0], "type,issue,date,front1,front2,front3,front4,front5,back1,back2,sales,pool,firstPrizeCount,secondPrizeCount,source");
    assert.deepEqual(parsed, draws);
  });

  it("validates draw shape, issue uniqueness, and ticket legality", () => {
    const draws = parseSinaDltListResponse(sinaListResponse).draws;

    const report = validateDltDraws(draws);
    assert.equal(report.valid, true);
    assert.deepEqual(report.errors, []);

    const bad = validateDltDraws([
      ...draws,
      { ...draws[0], issue: draws[0].issue, front: [1, 1, 2, 3, 4] },
    ]);
    assert.equal(bad.valid, false);
    assert.match(bad.errors.join("\n"), /duplicate issue/);
    assert.match(bad.errors.join("\n"), /front must not contain duplicates/);
  });
});
