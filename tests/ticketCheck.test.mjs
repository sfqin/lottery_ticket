import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  checkTicketByIssue,
  isSupportedTicketScanType,
  parseTicketNumbers,
} from "../src/ticketCheck.mjs";

const draws = [
  {
    type: "ssq",
    issue: "2026063",
    date: "2026-06-04",
    red: [8, 13, 17, 21, 24, 29],
    blue: [3],
  },
  {
    type: "dlt",
    issue: "26061",
    date: "2026-06-03",
    front: [2, 8, 13, 21, 30],
    back: [4, 11],
  },
];

describe("ticket check", () => {
  it("only supports double color ball and super lotto scan checks", () => {
    assert.equal(isSupportedTicketScanType("ssq"), true);
    assert.equal(isSupportedTicketScanType("dlt"), true);
    assert.equal(isSupportedTicketScanType("pl3"), false);
  });

  it("parses ticket number fields by the selected fixed lottery type", () => {
    assert.deepEqual(
      parseTicketNumbers("ssq", {
        red: "08 13 17 21 24 29",
        blue: "03",
      }),
      { red: [8, 13, 17, 21, 24, 29], blue: [3] },
    );

    assert.deepEqual(
      parseTicketNumbers("dlt", {
        front: "02,08,13,21,30",
        back: "04 11",
      }),
      { front: [2, 8, 13, 21, 30], back: [4, 11] },
    );
  });

  it("checks a supported ticket against its issue and returns prize evaluation", () => {
    const result = checkTicketByIssue({
      typeId: "ssq",
      issue: "2026063",
      ticket: { red: [8, 13, 17, 21, 24, 29], blue: [3] },
      draws,
    });

    assert.equal(result.found, true);
    assert.equal(result.evaluation.tierName, "一等奖");
    assert.match(result.summary, /命中一等奖/);
    assert.match(result.complianceNote, /不提供奖金领取/);
  });

  it("reports missing issues without evaluating the ticket", () => {
    const result = checkTicketByIssue({
      typeId: "dlt",
      issue: "26062",
      ticket: { front: [2, 8, 13, 21, 30], back: [4, 11] },
      draws,
    });

    assert.equal(result.found, false);
    assert.match(result.summary, /未找到/);
  });

  it("rejects unsupported lottery types for ticket checks", () => {
    assert.throws(
      () =>
        checkTicketByIssue({
          typeId: "pl3",
          issue: "2026001",
          ticket: {},
          draws,
        }),
      /只支持双色球和超级大乐透/,
    );
  });
});
