import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseDltCsv,
  parseSportteryDltResponse,
  serializeDltCsv,
  validateDltDraws,
} from "../src/dltHistory.mjs";

const officialResponse = {
  success: true,
  value: {
    pages: 98,
    list: [
      {
        lotteryDrawNum: "26118",
        lotteryDrawTime: "2026-10-17",
        lotteryDrawResult: "02 09 21 26 32 06 12",
        totalSaleAmount: "316,189,166",
        poolBalanceAfterdraw: "796,723,787.40",
        prizeLevelList: [
          { group: "101", stakeCount: "2" },
          { group: "301", stakeCount: "96" },
        ],
      },
      {
        lotteryDrawNum: "26117",
        lotteryDrawTime: "2026-10-14",
        lotteryDrawResult: "01 08 15 22 35 03 09",
        totalSaleAmount: "300,000,000",
        poolBalanceAfterdraw: "746,384,997.05",
        prizeLevelList: [
          { group: "101", stakeCount: "3" },
          { group: "301", stakeCount: "88" },
        ],
      },
    ],
  },
};

describe("DLT history import", () => {
  it("parses official China Sports Lottery history responses", () => {
    const parsed = parseSportteryDltResponse(officialResponse);

    assert.equal(parsed.totalPages, 98);
    assert.deepEqual(parsed.draws[0], {
      type: "dlt",
      issue: "26118",
      date: "2026-10-17",
      front: [2, 9, 21, 26, 32],
      back: [6, 12],
      sales: 316189166,
      pool: 796723787.4,
      firstPrizeCount: 2,
      secondPrizeCount: 96,
      source: "sporttery",
    });
  });

  it("rejects failed or malformed China Sports Lottery responses", () => {
    assert.throws(
      () => parseSportteryDltResponse({ success: false, errorMessage: "处理失败" }),
      /处理失败/,
    );
    assert.throws(
      () =>
        parseSportteryDltResponse({
          success: true,
          value: {
            pages: 1,
            list: [{ lotteryDrawNum: "26118", lotteryDrawResult: "02 09" }],
          },
        }),
      /invalid DLT result/i,
    );
    assert.throws(
      () => parseSportteryDltResponse({ success: true, value: { pages: 1 } }),
      /invalid history page/i,
    );
  });

  it("serializes and parses CSV without losing draw fields", () => {
    const draws = parseSportteryDltResponse(officialResponse).draws;

    const csv = serializeDltCsv(draws);
    const parsed = parseDltCsv(csv);

    assert.equal(csv.split("\n")[0], "type,issue,date,front1,front2,front3,front4,front5,back1,back2,sales,pool,firstPrizeCount,secondPrizeCount,source");
    assert.deepEqual(parsed, draws);
  });

  it("validates draw shape, issue uniqueness, and ticket legality", () => {
    const draws = parseSportteryDltResponse(officialResponse).draws;

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
