const DAILY_FREE_LIMIT = 3;

export function createEntitlementState(date) {
  return {
    currentDate: date,
    usedFree: 0,
    adUnlocked: 0,
    usedAdUnlocked: 0,
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
    usedFree: 0,
    adUnlocked: 0,
    usedAdUnlocked: 0,
  };
}

export function getRemainingGenerations(state, date) {
  const current = resetIfNewDate(state, date);
  const freeRemaining = Math.max(0, DAILY_FREE_LIMIT - current.usedFree);
  const adRemaining = Math.max(0, current.adUnlocked - current.usedAdUnlocked);
  return freeRemaining + adRemaining;
}

export function useGeneration(state, date) {
  const current = resetIfNewDate(state, date);
  const freeRemaining = Math.max(0, DAILY_FREE_LIMIT - current.usedFree);
  const adRemaining = Math.max(0, current.adUnlocked - current.usedAdUnlocked);

  if (freeRemaining > 0) {
    return {
      allowed: true,
      source: "free",
      state: {
        ...current,
        usedFree: current.usedFree + 1,
        events: [...current.events, { type: "generation", source: "free", date }],
      },
    };
  }

  if (adRemaining > 0) {
    return {
      allowed: true,
      source: "ad",
      state: {
        ...current,
        usedAdUnlocked: current.usedAdUnlocked + 1,
        events: [...current.events, { type: "generation", source: "ad", date }],
      },
    };
  }

  return { allowed: false, source: null, state: current };
}

export function recordAdUnlock(state, date, amount = 3) {
  const current = resetIfNewDate(state, date);
  return {
    ...current,
    adUnlocked: current.adUnlocked + amount,
    events: [...current.events, { type: "ad_unlock", amount, date }],
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
    appreciations: [...state.appreciations, event],
    events: [...state.events, event],
  };
}
