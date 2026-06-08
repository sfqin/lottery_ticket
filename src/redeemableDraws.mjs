const DAY_MS = 86400000;

export function getRedeemableDraws(draws, now = new Date(), validityDays = 60) {
  const todayTime = startOfDay(now).getTime();
  return [...draws]
    .map((draw) => {
      const drawDate = parseDrawDate(draw.date, now);
      const deadline = addDays(drawDate, validityDays);
      const daysLeft = Math.floor((deadline.getTime() - todayTime) / DAY_MS);
      return { draw, deadline, daysLeft };
    })
    .filter((item) => item.daysLeft >= 0)
    .sort((a, b) => String(b.draw.issue).localeCompare(String(a.draw.issue)));
}

export function parseDrawDate(value, fallback = new Date()) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? startOfDay(fallback) : date;
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
