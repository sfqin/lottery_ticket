import { validateTicket } from "./lotteryCatalog.mjs";

export const SSQ_CSV_HEADER = [
  "type",
  "issue",
  "date",
  "red1",
  "red2",
  "red3",
  "red4",
  "red5",
  "red6",
  "blue",
  "sales",
  "firstPrizeCount",
  "secondPrizeCount",
  "source",
];

export function parseCwlSsqResponse(payload) {
  if (payload?.state !== 0) {
    throw new Error(`Welfare Lottery API failed: ${payload?.message ?? "unknown error"}`);
  }
  if (!Array.isArray(payload.result) || !Number.isInteger(Number(payload.pageNum))) {
    throw new Error("Welfare Lottery API returned an invalid history page");
  }

  return {
    totalPages: Number(payload.pageNum),
    draws: payload.result.map((row) => {
      const date = String(row.date ?? "").match(/^\d{4}-\d{2}-\d{2}/)?.[0];
      if (!date) {
        throw new Error(`Invalid SSQ date for issue ${row.code ?? "unknown"}`);
      }

      const red = String(row.red ?? "").split(",").map(Number);
      const blue = String(row.blue ?? "").split(",").map(Number);
      if (
        red.length !== 6 ||
        blue.length !== 1 ||
        [...red, ...blue].some((number) => !Number.isInteger(number))
      ) {
        throw new Error(`Invalid SSQ result for issue ${row.code ?? "unknown"}`);
      }

      const prize = (type) => row.prizegrades?.find((item) => Number(item.type) === type);
      return {
        type: "ssq",
        issue: String(row.code ?? ""),
        date,
        red,
        blue,
        sales: parseNullableNumber(row.sales),
        firstPrizeCount: parseNullableNumber(prize(1)?.typenum),
        secondPrizeCount: parseNullableNumber(prize(2)?.typenum),
        source: "cwl",
      };
    }),
  };
}

export function ssqDrawSignature(draw) {
  return `${draw.date}|${draw.red.join(",")}|${draw.blue.join(",")}`;
}

export function serializeSsqCsv(draws) {
  const sorted = [...draws].sort((a, b) => b.issue.localeCompare(a.issue));
  const lines = [
    SSQ_CSV_HEADER.join(","),
    ...sorted.map((draw) =>
      [
        draw.type,
        draw.issue,
        draw.date,
        ...draw.red,
        draw.blue[0],
        draw.sales ?? "",
        draw.firstPrizeCount ?? "",
        draw.secondPrizeCount ?? "",
        draw.source,
      ].join(","),
    ),
  ];
  return `${lines.join("\n")}\n`;
}

export function parseSsqCsv(csv) {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  const header = lines.shift();
  if (header !== SSQ_CSV_HEADER.join(",")) {
    throw new Error("Unexpected SSQ CSV header");
  }

  return lines.map((line) => {
    const [
      type,
      issue,
      date,
      red1,
      red2,
      red3,
      red4,
      red5,
      red6,
      blue,
      sales,
      firstPrizeCount,
      secondPrizeCount,
      source,
    ] = line.split(",");

    return {
      type,
      issue,
      date,
      red: [red1, red2, red3, red4, red5, red6].map(Number),
      blue: [Number(blue)],
      sales: parseNullableNumber(sales),
      firstPrizeCount: parseNullableNumber(firstPrizeCount),
      secondPrizeCount: parseNullableNumber(secondPrizeCount),
      source,
    };
  });
}

export function validateSsqDraws(draws) {
  const errors = [];
  const issues = new Set();

  for (const draw of draws) {
    if (draw.type !== "ssq") {
      errors.push(`${draw.issue ?? "unknown"} type must be ssq`);
    }

    if (!/^\d{7}$/.test(draw.issue)) {
      errors.push(`${draw.issue ?? "unknown"} issue must be 7 digits`);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(draw.date)) {
      errors.push(`${draw.issue ?? "unknown"} date must be YYYY-MM-DD`);
    }

    if (issues.has(draw.issue)) {
      errors.push(`duplicate issue ${draw.issue}`);
    }
    issues.add(draw.issue);

    const ticket = validateTicket("ssq", { red: draw.red, blue: draw.blue });
    errors.push(...ticket.errors.map((error) => `${draw.issue}: ${error}`));
  }

  return { valid: errors.length === 0, errors };
}

function parseNullableNumber(value) {
  const normalized = String(value ?? "").replaceAll(",", "").trim();
  return normalized ? Number(normalized) : null;
}
