import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  parseSsq17500Text,
  parseSsqHistoryPage,
  serializeSsqCsv,
  validateSsqDraws,
} from "../src/ssqHistory.mjs";

const BASE_URL = "http://kaijiang.zhcw.com/zhcw/html/ssq/list.html";
const PAGE_URL = "http://kaijiang.zhcw.com/zhcw/inc/ssq/ssq_wqhg.jsp?pageNum=";
const TEXT_URL = "https://data.17500.cn/ssq_asc.txt";
const outputPath = new URL("../data/ssq-history.csv", import.meta.url);
const source = readArg("source") ?? "17500";

const allDraws = source === "zhcw" ? importFromZhcw() : importFrom17500();

const uniqueDraws = [...new Map(allDraws.map((draw) => [draw.issue, draw])).values()];
const validation = validateSsqDraws(uniqueDraws);

if (!validation.valid) {
  throw new Error(`SSQ history validation failed:\n${validation.errors.join("\n")}`);
}

mkdirSync(dirname(outputPath.pathname), { recursive: true });
writeFileSync(outputPath, serializeSsqCsv(uniqueDraws), "utf8");

console.log(
  `Imported ${uniqueDraws.length} 双色球 draws from ${source} into ${outputPath.pathname}`,
);

function fetchText(url) {
  return execFileSync("curl", ["-fsSL", "--retry", "3", "--retry-delay", "1", url], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

function importFrom17500() {
  return parseSsq17500Text(fetchText(TEXT_URL));
}

function importFromZhcw() {
  const firstPage = fetchText(BASE_URL);
  const firstResult = parseSsqHistoryPage(firstPage);
  const draws = [...firstResult.draws];

  for (let page = 2; page <= firstResult.totalPages; page += 1) {
    const html = fetchText(`${PAGE_URL}${page}`);
    draws.push(...parseSsqHistoryPage(html).draws);
  }

  return draws;
}

function readArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}
