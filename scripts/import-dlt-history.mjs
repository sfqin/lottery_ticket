import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  parseDlt17500Text,
  serializeDltCsv,
  validateDltDraws,
} from "../src/dltHistory.mjs";

const TEXT_URL = "https://data.17500.cn/dlt_asc.txt";
const outputPath = new URL("../data/dlt-history.csv", import.meta.url);

const draws = parseDlt17500Text(fetchText(TEXT_URL));
const uniqueDraws = [...new Map(draws.map((draw) => [draw.issue, draw])).values()];
const validation = validateDltDraws(uniqueDraws);

if (!validation.valid) {
  throw new Error(`DLT history validation failed:\n${validation.errors.join("\n")}`);
}

mkdirSync(dirname(outputPath.pathname), { recursive: true });
writeFileSync(outputPath, serializeDltCsv(uniqueDraws), "utf8");

console.log(
  `Imported ${uniqueDraws.length} 大乐透 draws from 17500 into ${outputPath.pathname}`,
);

function fetchText(url) {
  return execFileSync("curl", ["-fsSL", "--retry", "3", "--retry-delay", "1", url], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}
