import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { generateTicket } from "../src/numberGenerator.mjs";
import {
  createEntitlementState,
  recordAppreciation,
  useGeneration,
} from "../src/entitlements.mjs";
import { SAMPLE_DRAWS } from "../src/sampleDraws.mjs";

describe("MVP user flow", () => {
  it("generates more than three tickets without ad gating and ignores appreciation for access", () => {
    const date = "2026-06-03";
    let entitlement = createEntitlementState(date);
    const generated = [];

    for (let index = 0; index < 5; index += 1) {
      const attempt = useGeneration(entitlement, date);
      assert.equal(attempt.allowed, true);
      entitlement = attempt.state;
      generated.push(
        generateTicket({
          typeId: "ssq",
          strategy: "balanced",
          draws: SAMPLE_DRAWS.filter((draw) => draw.type === "ssq"),
        }),
      );
    }

    assert.equal(generated.length, 5);
    assert.equal(useGeneration(entitlement, date).allowed, true);

    entitlement = recordAppreciation(entitlement, { amount: 0, date });
    assert.equal(useGeneration(entitlement, date).allowed, true);
  });
});
