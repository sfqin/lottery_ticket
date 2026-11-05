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

export function parseSinaDltListResponse(payload) {
  const result = parseSinaResult(payload);
  const totalPages = Number(result.pagination?.totalPage);
  if (!Array.isArray(result.data) || !Number.isInteger(totalPages)) {
    throw new Error("Sina Lottery API returned an invalid history page");
  }

  return { totalPages, draws: result.data.map(parseSinaDltDraw) };
}

export function parseSinaDltDetailResponse(payload) {
  const result = parseSinaResult(payload);
  if (!result.data || Array.isArray(result.data)) {
    throw new Error("Sina Lottery API returned invalid DLT detail");
  }
  return parseSinaDltDraw(result.data);
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

function parseSinaResult(payload) {
  const status = payload?.result?.status;
  if (status?.code !== 0) {
    throw new Error(`Sina Lottery API failed: ${status?.msg ?? "unknown error"}`);
  }
  return payload.result;
}

function parseSinaDltDraw(row) {
  const issue = String(row.issueNo ?? "");
  const date = String(row.openTime ?? "").match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!date) {
    throw new Error(`Invalid DLT date for issue ${issue || "unknown"}`);
  }

  const front = Array.isArray(row.redResults) ? row.redResults.map(Number) : [];
  const back = Array.isArray(row.blueResults) ? row.blueResults.map(Number) : [];
  if (
    front.length !== 5 ||
    back.length !== 2 ||
    [...front, ...back].some((number) => !Number.isInteger(number))
  ) {
    throw new Error(`Invalid DLT result for issue ${issue || "unknown"}`);
  }

  const prize = (description) =>
    row.prizeList?.find((item) => String(item.prizeDesc) === description);
  return {
    type: "dlt",
    issue,
    date,
    front,
    back,
    sales: parseNullableNumber(row.saleMoney),
    pool: parseNullableNumber(row.poolMoney),
    firstPrizeCount: parseNullableNumber(prize("一等奖")?.prizeCount),
    secondPrizeCount: parseNullableNumber(prize("二等奖")?.prizeCount),
    source: "sina",
  };
}
