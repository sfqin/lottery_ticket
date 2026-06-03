import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createEntitlementState,
  getRemainingGenerations,
  recordAdUnlock,
  recordAppreciation,
  useGeneration,
} from "../src/entitlements.mjs";

describe("entitlements", () => {
  it("allows three free generations per day", () => {
    let state = createEntitlementState("2026-06-03");

    state = useGeneration(state, "2026-06-03").state;
    state = useGeneration(state, "2026-06-03").state;
    state = useGeneration(state, "2026-06-03").state;
    const fourth = useGeneration(state, "2026-06-03");

    assert.equal(fourth.allowed, false);
    assert.equal(getRemainingGenerations(fourth.state, "2026-06-03"), 0);
  });

  it("simulated ad unlock adds extra generation quota", () => {
    let state = createEntitlementState("2026-06-03");
    state = useGeneration(state, "2026-06-03").state;
    state = useGeneration(state, "2026-06-03").state;
    state = useGeneration(state, "2026-06-03").state;
    state = recordAdUnlock(state, "2026-06-03", 3);

    assert.equal(getRemainingGenerations(state, "2026-06-03"), 3);
    assert.equal(useGeneration(state, "2026-06-03").allowed, true);
  });

  it("voluntary appreciation never grants generation quota", () => {
    let state = createEntitlementState("2026-06-03");
    state = recordAppreciation(state, { amount: 6, date: "2026-06-03" });

    assert.equal(getRemainingGenerations(state, "2026-06-03"), 3);
    assert.equal(state.appreciations[0].grantsEntitlement, false);
  });
});
