export function createEntitlementState(date) {
  return {
    currentDate: date,
    generated: 0,
    events: [],
    appreciations: [],
  };
}

export function resetIfNewDate(state, date) {
  if (state.currentDate === date) {
    return state;
  }

  return {
    ...state,
    currentDate: date,
    generated: 0,
  };
}

export function getRemainingGenerations(state, date) {
  resetIfNewDate(state, date);
  return Number.POSITIVE_INFINITY;
}

export function useGeneration(state, date) {
  const current = resetIfNewDate(state, date);

  return {
    allowed: true,
    source: "unrestricted",
    state: {
      ...current,
      generated: (current.generated ?? 0) + 1,
      events: [...(current.events ?? []), { type: "generation", source: "unrestricted", date }],
    },
  };
}

export function recordAppreciation(state, appreciation) {
  const event = {
    ...appreciation,
    type: "appreciation",
    grantsEntitlement: false,
  };

  return {
    ...state,
    appreciations: [...(state.appreciations ?? []), event],
    events: [...(state.events ?? []), event],
  };
}
