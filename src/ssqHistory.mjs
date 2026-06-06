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

export function parseSsqHistoryPage(html) {
  const totalPages = parseTotalPages(html);
  const rows = [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)]
    .map((match) => match[0])
    .filter((row) => /<em[^>]*class="rr"/i.test(row));

  return {
    totalPages,
    draws: rows.map(parseSsqRow).filter(Boolean),
  };
}

export function parseSsq17500Text(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      if (parts.length < 21) {
        throw new Error(`Invalid 17500 SSQ line: ${line}`);
      }

      return {
        type: "ssq",
        issue: parts[0],
        date: parts[1],
        red: parts.slice(2, 8).map(Number),
        blue: [Number(parts[8])],
        sales: parseNullableNumber(parts[15]),
        firstPrizeCount: parseNullableNumber(parts[17]),
        secondPrizeCount: parseNullableNumber(parts[19]),
        source: "17500",
      };
    });
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

function parseSsqRow(row) {
  const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1]);
  if (cells.length < 6) {
    return null;
  }

  const date = cleanText(cells[0]);
  const issue = cleanText(cells[1]);
  const reds = [...cells[2].matchAll(/<em[^>]*class="rr"[^>]*>(\d{2})<\/em>/gi)].map((match) =>
    Number(match[1]),
  );
  const allNumbers = [...cells[2].matchAll(/<em[^>]*>(\d{2})<\/em>/gi)].map((match) => Number(match[1]));
  const blue = allNumbers.at(-1);

  return {
    type: "ssq",
    issue,
    date,
    red: reds,
    blue: [blue],
    sales: parseNullableNumber(cleanText(cells[3])),
    firstPrizeCount: parseNullableNumber(cleanText(cells[4])),
    secondPrizeCount: parseNullableNumber(cleanText(cells[5])),
    source: "zhcw",
  };
}

function parseTotalPages(html) {
  const match = html.match(/共\s*<strong>\s*(\d+)\s*<\/strong>\s*页/i);
  return match ? Number(match[1]) : 1;
}

function cleanText(html) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function parseNullableNumber(value) {
  const normalized = String(value ?? "").replaceAll(",", "").trim();
  return normalized ? Number(normalized) : null;
}
