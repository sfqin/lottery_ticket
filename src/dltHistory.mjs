import { validateTicket } from "./lotteryCatalog.mjs";

export const DLT_CSV_HEADER = [
  "type",
  "issue",
  "date",
  "front1",
  "front2",
  "front3",
  "front4",
  "front5",
  "back1",
  "back2",
  "sales",
  "pool",
  "firstPrizeCount",
  "secondPrizeCount",
  "source",
];

export function parseSportteryDltResponse(payload) {
  if (payload?.success !== true) {
    throw new Error(`Sports Lottery API failed: ${payload?.errorMessage ?? "unknown error"}`);
  }
  if (!Array.isArray(payload.value?.list) || !Number.isInteger(Number(payload.value.pages))) {
    throw new Error("Sports Lottery API returned an invalid history page");
  }

  return {
    totalPages: Number(payload.value.pages),
    draws: payload.value.list.map((row) => {
      const numbers = String(row.lotteryDrawResult ?? "").trim().split(/\s+/).map(Number);
      if (numbers.length !== 7 || numbers.some((number) => !Number.isInteger(number))) {
        throw new Error(`Invalid DLT result for issue ${row.lotteryDrawNum ?? "unknown"}`);
      }

      const prize = (group) =>
        row.prizeLevelList?.find((item) => String(item.group) === group);
      return {
        type: "dlt",
        issue: String(row.lotteryDrawNum ?? ""),
        date: String(row.lotteryDrawTime ?? ""),
        front: numbers.slice(0, 5),
        back: numbers.slice(5),
        sales: parseNullableNumber(row.totalSaleAmount),
        pool: parseNullableNumber(row.poolBalanceAfterdraw),
        firstPrizeCount: parseNullableNumber(prize("101")?.stakeCount),
        secondPrizeCount: parseNullableNumber(prize("301")?.stakeCount),
        source: "sporttery",
      };
    }),
  };
}

export function dltDrawSignature(draw) {
  return `${draw.date}|${draw.front.join(",")}|${draw.back.join(",")}`;
}

export function serializeDltCsv(draws) {
  const sorted = [...draws].sort((a, b) => b.issue.localeCompare(a.issue));
  const lines = [
    DLT_CSV_HEADER.join(","),
    ...sorted.map((draw) =>
      [
        draw.type,
        draw.issue,
        draw.date,
        ...draw.front,
        ...draw.back,
        draw.sales ?? "",
        draw.pool ?? "",
        draw.firstPrizeCount ?? "",
        draw.secondPrizeCount ?? "",
        draw.source,
      ].join(","),
    ),
  ];
  return `${lines.join("\n")}\n`;
}

export function parseDltCsv(csv) {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  const header = lines.shift();
  if (header !== DLT_CSV_HEADER.join(",")) {
    throw new Error("Unexpected DLT CSV header");
  }

  return lines.map((line) => {
    const [
      type,
      issue,
      date,
      front1,
      front2,
      front3,
      front4,
      front5,
      back1,
      back2,
      sales,
      pool,
      firstPrizeCount,
      secondPrizeCount,
      source,
    ] = line.split(",");

    return {
      type,
      issue,
      date,
      front: [front1, front2, front3, front4, front5].map(Number),
      back: [back1, back2].map(Number),
      sales: parseNullableNumber(sales),
      pool: parseNullableNumber(pool),
      firstPrizeCount: parseNullableNumber(firstPrizeCount),
      secondPrizeCount: parseNullableNumber(secondPrizeCount),
      source,
    };
  });
}

export function validateDltDraws(draws) {
  const errors = [];
  const issues = new Set();

  for (const draw of draws) {
    if (draw.type !== "dlt") {
      errors.push(`${draw.issue ?? "unknown"} type must be dlt`);
    }

    if (!/^\d{5}$/.test(draw.issue)) {
      errors.push(`${draw.issue ?? "unknown"} issue must be 5 digits`);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(draw.date)) {
      errors.push(`${draw.issue ?? "unknown"} date must be YYYY-MM-DD`);
    }

    if (issues.has(draw.issue)) {
      errors.push(`duplicate issue ${draw.issue}`);
    }
    issues.add(draw.issue);

    const ticket = validateTicket("dlt", { front: draw.front, back: draw.back });
    errors.push(...ticket.errors.map((error) => `${draw.issue}: ${error}`));
  }

  return { valid: errors.length === 0, errors };
}

function parseNullableNumber(value) {
  const normalized = String(value ?? "").replaceAll(",", "").trim();
  return normalized === "-" || normalized === "" ? null : Number(normalized);
}
