import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseDlt17500Text,
  parseDltCsv,
  serializeDltCsv,
  validateDltDraws,
} from "../src/dltHistory.mjs";

describe("DLT history import", () => {
  it("parses 17500 plain text rows", () => {
    const text = [
      "07001 2007-05-30 22 24 29 31 35 04 11 - - - - - - - 17086781 89168335 2 5000000 8 136558 9 24466 50 3000 682 500 2847 200 39943 10 443014 5 0 0 1 3000000 1 81934 1 14679 1049664 11075 60",
      "26061 2026-06-03 10 12 26 31 35 02 12 26 31 10 35 12 12 02 354547009 807705563 4 10000000 114 160534 888 5000 15220 300 59457 150 791901 15 8645244 5 0 0 0 0 0 0 30 128427 0 0 0 0 0",
    ].join("\n");

    const draws = parseDlt17500Text(text);

    assert.equal(draws.length, 2);
    assert.deepEqual(draws[0], {
      type: "dlt",
      issue: "07001",
      date: "2007-05-30",
      front: [22, 24, 29, 31, 35],
      back: [4, 11],
      sales: 17086781,
      pool: 89168335,
      firstPrizeCount: 2,
      secondPrizeCount: 8,
      source: "17500",
    });
    assert.deepEqual(draws[1].front, [10, 12, 26, 31, 35]);
    assert.deepEqual(draws[1].back, [2, 12]);
    assert.equal(draws[1].sales, 354547009);
    assert.equal(draws[1].pool, 807705563);
    assert.equal(draws[1].firstPrizeCount, 4);
    assert.equal(draws[1].secondPrizeCount, 114);
  });

  it("serializes and parses CSV without losing draw fields", () => {
    const draws = parseDlt17500Text(
      "26061 2026-06-03 10 12 26 31 35 02 12 26 31 10 35 12 12 02 354547009 807705563 4 10000000 114 160534 888 5000 15220 300 59457 150 791901 15 8645244 5 0 0 0 0 0 0 30 128427 0 0 0 0 0",
    );

    const csv = serializeDltCsv(draws);
    const parsed = parseDltCsv(csv);

    assert.equal(csv.split("\n")[0], "type,issue,date,front1,front2,front3,front4,front5,back1,back2,sales,pool,firstPrizeCount,secondPrizeCount,source");
    assert.deepEqual(parsed, draws);
  });

  it("validates draw shape, issue uniqueness, and ticket legality", () => {
    const draws = parseDlt17500Text(
      "26061 2026-06-03 10 12 26 31 35 02 12 26 31 10 35 12 12 02 354547009 807705563 4 10000000 114 160534 888 5000 15220 300 59457 150 791901 15 8645244 5 0 0 0 0 0 0 30 128427 0 0 0 0 0",
    );

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
