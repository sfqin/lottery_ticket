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

export function parseDlt17500Text(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      if (parts.length < 21) {
        throw new Error(`Invalid 17500 DLT line: ${line}`);
      }

      return {
        type: "dlt",
        issue: parts[0],
        date: parts[1],
        front: parts.slice(2, 7).map(Number),
        back: parts.slice(7, 9).map(Number),
        sales: parseNullableNumber(parts[16]),
        pool: parseNullableNumber(parts[17]),
        firstPrizeCount: parseNullableNumber(parts[18]),
        secondPrizeCount: parseNullableNumber(parts[20]),
        source: "17500",
      };
    });
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
