import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createEntitlementState,
  getRemainingGenerations,
  recordAppreciation,
  useGeneration,
} from "../src/entitlements.mjs";

describe("entitlements", () => {
  it("allows unrestricted generation attempts", () => {
    let state = createEntitlementState("2026-06-03");

    for (let index = 0; index < 8; index += 1) {
      const attempt = useGeneration(state, "2026-06-03");
      assert.equal(attempt.allowed, true);
      assert.equal(attempt.source, "unrestricted");
      state = attempt.state;
    }

    assert.equal(state.generated, 8);
    assert.equal(getRemainingGenerations(state, "2026-06-03"), Number.POSITIVE_INFINITY);
  });

  it("voluntary appreciation never grants generation privileges", () => {
    let state = createEntitlementState("2026-06-03");
    state = recordAppreciation(state, { amount: 6, date: "2026-06-03" });

    assert.equal(getRemainingGenerations(state, "2026-06-03"), Number.POSITIVE_INFINITY);
    assert.equal(state.appreciations[0].grantsEntitlement, false);
  });
});
