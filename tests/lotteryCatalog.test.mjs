import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  LOTTERY_TYPES,
  formatTicket,
  validateTicket,
} from "../src/lotteryCatalog.mjs";

describe("lottery catalog", () => {
  it("defines rules for super lotto and double color ball", () => {
    assert.equal(LOTTERY_TYPES.dlt.name, "超级大乐透");
    assert.equal(LOTTERY_TYPES.ssq.name, "双色球");
    assert.equal(LOTTERY_TYPES.dlt.groups.front.max, 35);
    assert.equal(LOTTERY_TYPES.dlt.groups.front.color, "red");
    assert.equal(LOTTERY_TYPES.dlt.groups.back.count, 2);
    assert.equal(LOTTERY_TYPES.ssq.groups.red.count, 6);
    assert.equal(LOTTERY_TYPES.ssq.groups.blue.max, 16);
  });

  it("accepts a valid super lotto ticket", () => {
    const result = validateTicket("dlt", {
      front: [1, 8, 17, 23, 35],
      back: [4, 12],
    });

    assert.equal(result.valid, true);
    assert.deepEqual(result.normalized, {
      front: [1, 8, 17, 23, 35],
      back: [4, 12],
    });
  });

  it("rejects duplicate and out-of-range numbers", () => {
    const result = validateTicket("ssq", {
      red: [1, 1, 7, 13, 22, 33],
      blue: [17],
    });

    assert.equal(result.valid, false);
    assert.match(result.errors.join("\n"), /red must not contain duplicates/);
    assert.match(result.errors.join("\n"), /blue numbers must be between 1 and 16/);
  });

  it("formats ticket groups with two digit numbers", () => {
    const ticket = formatTicket("ssq", {
      red: [1, 12, 3, 22, 9, 33],
      blue: [8],
    });

    assert.deepEqual(ticket.red, ["01", "03", "09", "12", "22", "33"]);
    assert.deepEqual(ticket.blue, ["08"]);
  });
});
