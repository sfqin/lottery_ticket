import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  dltDrawSignature,
  parseDltCsv,
  parseSportteryDltResponse,
  serializeDltCsv,
  validateDltDraws,
} from "../src/dltHistory.mjs";
import {
  collectIncrementalDraws,
  fetchJsonWithRetry,
  mergeDrawHistory,
  writeTextAtomically,
} from "../src/historyImport.mjs";

const API_URL = "https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry";
const headers = {
  Accept: "application/json",
  Referer: "https://www.sporttery.cn/kj/kjlb.html?dlt",
  "User-Agent": "lottery-ticket-history-updater/1.0",
};

const outputPath = fileURLToPath(new URL("../data/dlt-history.csv", import.meta.url));
const existing = parseDltCsv(readFileSync(outputPath, "utf8"));
const existingIssues = new Set(existing.map((draw) => draw.issue));
const incoming = await collectIncrementalDraws({
  existingIssues,
  fetchPage: async (pageNo) => {
    const url = new URL(API_URL);
    for (const [name, value] of Object.entries({
      gameNo: "85",
      provinceId: "0",
      pageSize: "30",
      isVerify: "1",
      pageNo: String(pageNo),
    })) {
      url.searchParams.set(name, value);
    }
    return parseSportteryDltResponse(await fetchJsonWithRetry(url, { headers }));
  },
});

const merged = mergeDrawHistory(existing, incoming, dltDrawSignature);
const validation = validateDltDraws(merged);
if (!validation.valid) {
  throw new Error(`DLT history validation failed:\n${validation.errors.join("\n")}`);
}

writeTextAtomically(outputPath, serializeDltCsv(merged));
const latest = merged.toSorted((a, b) => b.issue.localeCompare(a.issue))[0];
console.log(
  `Imported ${merged.length - existing.length} new 大乐透 draws; ` +
    `${merged.length} total; latest ${latest.issue}`,
);
