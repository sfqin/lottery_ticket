import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  parseCwlSsqResponse,
  parseSsqCsv,
  serializeSsqCsv,
  ssqDrawSignature,
  validateSsqDraws,
} from "../src/ssqHistory.mjs";
import {
  collectIncrementalDraws,
  fetchJsonWithRetry,
  mergeDrawHistory,
  writeTextAtomically,
} from "../src/historyImport.mjs";

const API_URL = "https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice";
const headers = {
  Accept: "application/json",
  Referer: "https://www.cwl.gov.cn/ssq/wqkj/",
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
};

const outputPath = fileURLToPath(new URL("../data/ssq-history.csv", import.meta.url));
const existing = parseSsqCsv(readFileSync(outputPath, "utf8"));
const existingIssues = new Set(existing.map((draw) => draw.issue));
const incoming = await collectIncrementalDraws({
  existingIssues,
  fetchPage: async (pageNo) => {
    const url = new URL(API_URL);
    for (const [name, value] of Object.entries({
      name: "ssq",
      issueCount: "",
      issueStart: "",
      issueEnd: "",
      dayStart: "",
      dayEnd: "",
      pageNo: String(pageNo),
      pageSize: "30",
      week: "",
      systemType: "PC",
    })) {
      url.searchParams.set(name, value);
    }
    return parseCwlSsqResponse(await fetchJsonWithRetry(url, { headers }));
  },
});

const merged = mergeDrawHistory(existing, incoming, ssqDrawSignature);
const validation = validateSsqDraws(merged);
if (!validation.valid) {
  throw new Error(`SSQ history validation failed:\n${validation.errors.join("\n")}`);
}

writeTextAtomically(outputPath, serializeSsqCsv(merged));
const latest = merged.toSorted((a, b) => b.issue.localeCompare(a.issue))[0];
console.log(
  `Imported ${merged.length - existing.length} new 双色球 draws; ` +
    `${merged.length} total; latest ${latest.issue}`,
);
