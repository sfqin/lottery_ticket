import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseSsq17500Text,
  parseSsqCsv,
  parseSsqHistoryPage,
  serializeSsqCsv,
  validateSsqDraws,
} from "../src/ssqHistory.mjs";

const pageHtml = `
<table>
  <tr>
    <td align="center">2026-06-04</td>
    <td align="center">2026063</td>
    <td align="center" style="padding-left:10px;">
      <em class="rr">02</em><em class="rr">08</em><em class="rr">25</em>
      <em class="rr">28</em><em class="rr">30</em><em class="rr">31</em>
      <em>02</em>
    </td>
    <td><strong> </strong></td>
    <td align="left"><strong></strong></td>
    <td align="center"><strong class="rc"></strong></td>
  </tr>
  <tr>
    <td align="center">2026-06-02</td>
    <td align="center">2026062</td>
    <td align="center" style="padding-left:10px;">
      <em class="rr">02</em><em class="rr">04</em><em class="rr">07</em>
      <em class="rr">14</em><em class="rr">28</em><em class="rr">29</em>
      <em>09</em>
    </td>
    <td><strong>402,189,304</strong></td>
    <td align="left"><strong>30</strong></td>
    <td align="center"><strong class="rc">139</strong></td>
  </tr>
</table>
<p class="pg"> 共<strong>173</strong> 页 /<strong>3460 </strong>条记录 当前第<strong> 1 </strong>页</p>
`;

describe("ssq history import", () => {
  it("parses 17500 plain text rows", () => {
    const text = [
      "2003001 2003-02-23 10 11 12 13 26 28 11 26 28 11 13 10 12 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0",
      "2026063 2026-06-04 02 08 25 28 30 31 02 25 02 31 30 08 28 393294950 816837950 20 5000000 117 234108 2107 3000 98547 200 1692061 10 12886954 5 10218082 5",
    ].join("\n");

    const draws = parseSsq17500Text(text);

    assert.equal(draws.length, 2);
    assert.deepEqual(draws[0], {
      type: "ssq",
      issue: "2003001",
      date: "2003-02-23",
      red: [10, 11, 12, 13, 26, 28],
      blue: [11],
      sales: 0,
      firstPrizeCount: 0,
      secondPrizeCount: 0,
      source: "17500",
    });
    assert.deepEqual(draws[1].red, [2, 8, 25, 28, 30, 31]);
    assert.deepEqual(draws[1].blue, [2]);
    assert.equal(draws[1].sales, 393294950);
    assert.equal(draws[1].firstPrizeCount, 20);
    assert.equal(draws[1].secondPrizeCount, 117);
  });

  it("parses official history table rows and page count", () => {
    const result = parseSsqHistoryPage(pageHtml);

    assert.equal(result.totalPages, 173);
    assert.equal(result.draws.length, 2);
    assert.deepEqual(result.draws[0], {
      type: "ssq",
      issue: "2026063",
      date: "2026-06-04",
      red: [2, 8, 25, 28, 30, 31],
      blue: [2],
      sales: null,
      firstPrizeCount: null,
      secondPrizeCount: null,
      source: "zhcw",
    });
    assert.equal(result.draws[1].sales, 402189304);
    assert.equal(result.draws[1].firstPrizeCount, 30);
    assert.equal(result.draws[1].secondPrizeCount, 139);
  });

  it("serializes and parses CSV without losing draw fields", () => {
    const draws = parseSsqHistoryPage(pageHtml).draws;
    const csv = serializeSsqCsv(draws);
    const parsed = parseSsqCsv(csv);

    assert.equal(csv.split("\n")[0], "type,issue,date,red1,red2,red3,red4,red5,red6,blue,sales,firstPrizeCount,secondPrizeCount,source");
    assert.deepEqual(parsed, draws);
  });

  it("validates draw shape, issue uniqueness, and ticket legality", () => {
    const draws = parseSsqHistoryPage(pageHtml).draws;
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
