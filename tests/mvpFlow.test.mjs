import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { generateTicket } from "../src/numberGenerator.mjs";
import {
  createEntitlementState,
  getRemainingGenerations,
  recordAdUnlock,
  recordAppreciation,
  useGeneration,
} from "../src/entitlements.mjs";
import { SAMPLE_DRAWS } from "../src/sampleDraws.mjs";

describe("MVP user flow", () => {
  it("generates three free tickets, unlocks with simulated ad, and ignores appreciation for quota", () => {
    const date = "2026-06-03";
    let entitlement = createEntitlementState(date);
    const generated = [];

    for (let index = 0; index < 3; index += 1) {
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

    assert.equal(generated.length, 3);
    assert.equal(useGeneration(entitlement, date).allowed, false);

    entitlement = recordAppreciation(entitlement, { amount: 0, date });
    assert.equal(getRemainingGenerations(entitlement, date), 0);

    entitlement = recordAdUnlock(entitlement, date, 3);
    assert.equal(getRemainingGenerations(entitlement, date), 3);
    assert.equal(useGeneration(entitlement, date).allowed, true);
  });
});
