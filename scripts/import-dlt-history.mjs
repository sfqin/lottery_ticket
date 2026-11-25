import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  dltDrawSignature,
  parseDltCsv,
  parseSinaDltDetailResponse,
  parseSinaDltListResponse,
  serializeDltCsv,
  validateDltDraws,
} from "../src/dltHistory.mjs";
import {
  collectIncrementalDraws,
  fetchJsonFromMirrors,
  mergeDrawHistory,
  writeTextAtomically,
} from "../src/historyImport.mjs";

const API_URLS = [
  "https://alpha.lottery.sina.com.cn/gateway/index/entry",
  "https://mix.lottery.sina.com.cn/gateway/index/entry",
];
const headers = {
  Accept: "application/json",
  Referer: "https://lottery.sina.com.cn/",
  "User-Agent": "lottery-ticket-history-updater/1.0",
};

const outputPath = fileURLToPath(new URL("../data/dlt-history.csv", import.meta.url));
const existing = parseDltCsv(readFileSync(outputPath, "utf8"));
const existingIssues = new Set(existing.map((draw) => draw.issue));
const candidates = await collectIncrementalDraws({
  existingIssues,
  fetchPage: async (pageNo) => {
    return parseSinaDltListResponse(
      await fetchSinaJson({
        cat1: "gameOpenList",
        lottoType: "201",
        paginationType: "1",
        page: String(pageNo),
        pageSize: "30",
        dpc: "1",
      }),
    );
  },
});

const incoming = [];
for (const candidate of candidates) {
  if (existingIssues.has(candidate.issue)) {
    incoming.push(candidate);
    continue;
  }

  const draw = parseSinaDltDetailResponse(
    await fetchSinaJson({
      cat1: "gameOpenInfo",
      lottoType: "201",
      issueNo: candidate.issue,
      dpc: "1",
    }),
  );
  if (draw.issue !== candidate.issue) {
    throw new Error(`Sina DLT detail issue mismatch: expected ${candidate.issue}, got ${draw.issue}`);
  }
  incoming.push(draw);
}

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

function fetchSinaJson(parameters) {
  const urls = API_URLS.map((baseUrl) => {
    const url = new URL(baseUrl);
    for (const [name, value] of Object.entries({
      format: "json",
      __caller__: "web",
      __version__: "1.0.0",
      __verno__: "1",
      ...parameters,
    })) {
      url.searchParams.set(name, value);
    }
    return url;
  });
  return fetchJsonFromMirrors(urls, { headers });
}
