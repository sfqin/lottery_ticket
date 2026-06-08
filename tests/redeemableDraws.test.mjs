import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { getRedeemableDraws, formatDate } from "../src/redeemableDraws.mjs";

describe("redeemable draws", () => {
  it("keeps all draws inside the 60 natural day claim window", () => {
    const draws = Array.from({ length: 30 }, (_, index) => ({
      type: "ssq",
      issue: String(2026039 + index),
      date: index === 0 ? "2026-04-09" : `2026-05-${String(index).padStart(2, "0")}`,
    }));

    const redeemable = getRedeemableDraws(draws, new Date("2026-06-08T12:00:00"));

    assert.equal(redeemable.some(({ draw }) => draw.issue === "2026039"), true);
    assert.equal(redeemable.length, 30);
  });

  it("expires the draw after the last claim day", () => {
    const redeemable = getRedeemableDraws(
      [{ type: "ssq", issue: "2026039", date: "2026-04-09" }],
      new Date("2026-06-09T00:00:00"),
    );

    assert.deepEqual(redeemable, []);
  });

  it("formats dates for compact draw selectors", () => {
    assert.equal(formatDate(new Date("2026-06-08T00:00:00")), "2026-06-08");
  });
});
