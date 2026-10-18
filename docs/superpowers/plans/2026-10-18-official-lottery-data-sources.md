# Official Lottery Data Sources Implementation Plan

> 远程验收修订（2026-10-18）：GitHub 托管 Runner 实测无法稳定访问中国福彩网和中国体彩网，最终运行时改用两种彩票均认可的新浪开奖发布渠道，并在 `alpha` / `mix` 两个同源网关间容灾。下文保留初始实施步骤，最终实现与验收以设计文档中的修订说明和当前代码为准。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all live 17500 requests with official China Welfare Lottery and China Sports Lottery APIs, safely merge missing draws into the existing history, backfill 13 missing issues, and restore the scheduled GitHub Pages update chain.

**Architecture:** Keep parsing and validation pure in the existing history modules, and add one small shared import utility for retrying JSON requests, incremental pagination, conflict-safe merging, and atomic writes. Each CLI reads the current CSV, fetches official pages from newest to oldest until it reaches a known issue, validates overlap and the merged dataset, then atomically replaces the CSV. Existing historical rows retain their recorded provenance while new rows use `cwl` or `sporttery`.

**Tech Stack:** Node.js 22 ESM, built-in `fetch`, `node:test`, CSV files, GitHub Actions, GitHub Pages.

---

## File map

- Create `src/historyImport.mjs`: shared HTTP retry, incremental pagination, merge, and atomic-write primitives.
- Create `tests/historyImport.test.mjs`: focused tests for retry policy, pagination stop conditions, conflict detection, and atomic replacement.
- Modify `src/ssqHistory.mjs`: replace legacy live-source parsers with China Welfare Lottery JSON parsing and SSQ draw signatures.
- Modify `tests/ssqHistory.test.mjs`: replace 17500/HTML fixtures with official JSON fixtures and validation cases.
- Modify `src/dltHistory.mjs`: replace the 17500 parser with China Sports Lottery JSON parsing and DLT draw signatures.
- Modify `tests/dltHistory.test.mjs`: replace 17500 fixtures with official JSON fixtures, including decimal pool values.
- Modify `scripts/import-ssq-history.mjs`: read existing CSV and incrementally import from `www.cwl.gov.cn`.
- Modify `scripts/import-dlt-history.mjs`: read existing CSV and incrementally import from `webapi.sporttery.cn`.
- Modify `tests/h5Content.test.mjs`: assert the scheduled workflow points only to official-source importers.
- Modify `tests/ssqHistoryData.test.mjs`: assert backfill through issue `2026118`.
- Modify `tests/dltHistoryData.test.mjs`: assert backfill through issue `26118`.
- Modify `README.md` and `README.en.md`: document official source ownership and failure behavior.
- Modify `data/ssq-history.csv`, `data/dlt-history.csv`, `data/ssq-arena.csv`, and `data/dlt-arena.csv`: add missing draws and regenerate strategy records.

### Task 1: Shared resilient JSON fetcher

**Files:**
- Create: `src/historyImport.mjs`
- Create: `tests/historyImport.test.mjs`

- [ ] **Step 1: Write failing retry-policy tests**

Create `tests/historyImport.test.mjs` with tests using Node's real `Response` class and an injected transport:

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { fetchJsonWithRetry } from "../src/historyImport.mjs";

describe("official history HTTP client", () => {
  it("retries HTTP 429 with exponential delays and returns JSON", async () => {
    const responses = [
      new Response("", { status: 429 }),
      new Response("", { status: 503 }),
      Response.json({ state: 0 }),
    ];
    const delays = [];

    const result = await fetchJsonWithRetry("https://example.test/history", {
      fetchImpl: async () => responses.shift(),
      sleep: async (milliseconds) => delays.push(milliseconds),
      baseDelayMs: 10,
    });

    assert.deepEqual(result, { state: 0 });
    assert.deepEqual(delays, [10, 20]);
  });

  it("does not retry a permanent HTTP 404", async () => {
    let calls = 0;
    await assert.rejects(
      fetchJsonWithRetry("https://example.test/missing", {
        fetchImpl: async () => {
          calls += 1;
          return new Response("missing", { status: 404 });
        },
        sleep: async () => {},
      }),
      /HTTP 404/,
    );
    assert.equal(calls, 1);
  });
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `node --test tests/historyImport.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/historyImport.mjs`.

- [ ] **Step 3: Implement the minimal fetcher**

Create `src/historyImport.mjs` with `fetchJsonWithRetry(url, options)`. It must:

```js
export async function fetchJsonWithRetry(
  url,
  {
    fetchImpl = globalThis.fetch,
    headers = {},
    attempts = 3,
    timeoutMs = 15_000,
    baseDelayMs = 1_000,
    sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  } = {},
) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(url, { headers, signal: controller.signal });
    } catch (error) {
      const retryableNetworkError = error.name === "AbortError" || error instanceof TypeError;
      if (!retryableNetworkError || attempt === attempts) throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (response?.ok) return await response.json();
    if (response) {
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === attempts) {
        throw new Error(`HTTP ${response.status} from ${url}`);
      }
    }
    await sleep(baseDelayMs * 2 ** (attempt - 1));
  }

  throw new Error(`Unable to fetch ${url}`);
}
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `node --test tests/historyImport.test.mjs`

Expected: 2 tests pass, 0 fail.

- [ ] **Step 5: Commit the HTTP helper**

```bash
git add src/historyImport.mjs tests/historyImport.test.mjs
git commit -m "feat: add resilient official data client"
```

### Task 2: Incremental page collection and conflict-safe merging

**Files:**
- Modify: `src/historyImport.mjs`
- Modify: `tests/historyImport.test.mjs`

- [ ] **Step 1: Add failing pagination and merge tests**

Append tests that exercise the desired public API:

```js
import {
  collectIncrementalDraws,
  mergeDrawHistory,
} from "../src/historyImport.mjs";

it("loads pages until an existing issue is reached", async () => {
  const requested = [];
  const pages = {
    1: { draws: [{ issue: "4" }, { issue: "3" }], totalPages: 3 },
    2: { draws: [{ issue: "2" }, { issue: "1" }], totalPages: 3 },
  };
  const draws = await collectIncrementalDraws({
    existingIssues: new Set(["2"]),
    fetchPage: async (pageNo) => {
      requested.push(pageNo);
      return pages[pageNo];
    },
  });
  assert.deepEqual(requested, [1, 2]);
  assert.deepEqual(draws.map(({ issue }) => issue), ["4", "3", "2", "1"]);
});

it("rejects a complete response with no overlap", async () => {
  await assert.rejects(
    collectIncrementalDraws({
      existingIssues: new Set(["old"]),
      fetchPage: async () => ({ draws: [{ issue: "new" }], totalPages: 1 }),
    }),
    /no overlap/i,
  );
});

it("keeps existing rows, adds missing rows, and rejects number conflicts", () => {
  const existing = [{ issue: "1", date: "2026-01-01", numbers: [1, 2] }];
  const signature = (draw) => `${draw.date}|${draw.numbers.join(",")}`;
  assert.deepEqual(
    mergeDrawHistory(existing, [existing[0], { issue: "2", date: "2026-01-02", numbers: [3, 4] }], signature)
      .map(({ issue }) => issue),
    ["1", "2"],
  );
  assert.throws(
    () => mergeDrawHistory(existing, [{ ...existing[0], numbers: [9, 9] }], signature),
    /conflict.*1/i,
  );
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/historyImport.test.mjs`

Expected: FAIL because `collectIncrementalDraws` and `mergeDrawHistory` are not exported.

- [ ] **Step 3: Implement collection and merging**

Add implementations with these contracts:

```js
export async function collectIncrementalDraws({ existingIssues, fetchPage }) {
  const collected = [];
  for (let pageNo = 1; ; pageNo += 1) {
    const page = await fetchPage(pageNo);
    if (!Array.isArray(page.draws) || page.draws.length === 0) {
      throw new Error(`Official history page ${pageNo} contained no draws`);
    }
    collected.push(...page.draws);
    if (page.draws.some((draw) => existingIssues.has(draw.issue))) return collected;
    if (pageNo >= page.totalPages) {
      throw new Error("Official history had no overlap with stored history");
    }
  }
}

export function mergeDrawHistory(existing, incoming, signature) {
  const merged = new Map(existing.map((draw) => [draw.issue, draw]));
  for (const draw of incoming) {
    const current = merged.get(draw.issue);
    if (current && signature(current) !== signature(draw)) {
      throw new Error(`Official draw conflict for issue ${draw.issue}`);
    }
    if (!current) merged.set(draw.issue, draw);
  }
  return [...merged.values()];
}
```

- [ ] **Step 4: Add and test atomic text replacement**

Add `existsSync`, `mkdtempSync`, `readFileSync`, and `rmSync` from `node:fs`, `tmpdir` from `node:os`, and `join` from `node:path` to the test imports, then add:

```js
it("atomically replaces a text file without leaving a temporary sibling", () => {
  const directory = mkdtempSync(join(tmpdir(), "lottery-history-"));
  const destination = join(directory, "history.csv");
  try {
    writeTextAtomically(destination, "new\n");
    assert.equal(readFileSync(destination, "utf8"), "new\n");
    assert.equal(existsSync(`${destination}.${process.pid}.tmp`), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
```

Run `node --test tests/historyImport.test.mjs` and verify it fails because `writeTextAtomically` is missing. Then add these imports and implementation to `src/historyImport.mjs`:

```js
import { renameSync, rmSync, writeFileSync } from "node:fs";

export function writeTextAtomically(path, text) {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temporaryPath, text, "utf8");
    renameSync(temporaryPath, path);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}
```

Add `writeTextAtomically` to the test module import and rerun the focused test. Expected: PASS.

- [ ] **Step 5: Run the focused suite**

Run: `node --test tests/historyImport.test.mjs`

Expected: all history-import utility tests pass.

- [ ] **Step 6: Commit shared import behavior**

```bash
git add src/historyImport.mjs tests/historyImport.test.mjs
git commit -m "feat: add safe incremental history merging"
```

### Task 3: Parse official China Welfare Lottery responses

**Files:**
- Modify: `src/ssqHistory.mjs`
- Modify: `tests/ssqHistory.test.mjs`

- [ ] **Step 1: Replace legacy-source fixtures with a failing official-response test**

Use a minimal response fixture containing `state`, `pageNum`, and one `result` row. Assert:

```js
const parsed = parseCwlSsqResponse({
  state: 0,
  pageNum: 70,
  result: [{
    code: "2026118",
    date: "2026-10-15(四)",
    red: "05,21,22,23,28,31",
    blue: "14",
    sales: "340890776",
    prizegrades: [
      { type: 1, typenum: "5" },
      { type: 2, typenum: "80" },
    ],
  }],
});
assert.equal(parsed.totalPages, 70);
assert.deepEqual(parsed.draws[0], {
  type: "ssq",
  issue: "2026118",
  date: "2026-10-15",
  red: [5, 21, 22, 23, 28, 31],
  blue: [14],
  sales: 340890776,
  firstPrizeCount: 5,
  secondPrizeCount: 80,
  source: "cwl",
});
assert.throws(
  () => parseCwlSsqResponse({ state: 1, message: "查询失败" }),
  /查询失败/,
);
assert.throws(
  () => parseCwlSsqResponse({ state: 0, pageNum: 1, result: [{ code: "1", date: "bad" }] }),
  /invalid SSQ date/i,
);
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/ssqHistory.test.mjs`

Expected: FAIL because `parseCwlSsqResponse` is not exported.

- [ ] **Step 3: Implement the official parser and signature**

Add `parseCwlSsqResponse(payload)` and `ssqDrawSignature(draw)`. The signature includes only the date and winning numbers so optional prize corrections do not falsely block imports:

```js
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
      if (!date) throw new Error(`Invalid SSQ date for issue ${row.code ?? "unknown"}`);
      const red = String(row.red ?? "").split(",").map(Number);
      const blue = String(row.blue ?? "").split(",").map(Number);
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
```

Remove `parseSsq17500Text`, `parseSsqHistoryPage`, and their private HTML helpers after the new parser tests are green. Keep CSV parsing, serialization, and validation unchanged.

- [ ] **Step 4: Run SSQ tests**

Run: `node --test tests/ssqHistory.test.mjs tests/ssqHistoryData.test.mjs`

Expected: all SSQ unit and stored-data tests pass.

- [ ] **Step 5: Commit SSQ parsing**

```bash
git add src/ssqHistory.mjs tests/ssqHistory.test.mjs
git commit -m "feat: parse official welfare lottery history"
```

### Task 4: Parse official China Sports Lottery responses

**Files:**
- Modify: `src/dltHistory.mjs`
- Modify: `tests/dltHistory.test.mjs`

- [ ] **Step 1: Replace the legacy fixture with a failing official-response test**

Replace the 17500 parser test with this official-response assertion:

```js
const parsed = parseSportteryDltResponse({
  success: true,
  value: {
    pages: 98,
    list: [{
      lotteryDrawNum: "26118",
      lotteryDrawTime: "2026-10-17",
      lotteryDrawResult: "02 09 21 26 32 06 12",
      totalSaleAmount: "316,189,166",
      poolBalanceAfterdraw: "796,723,787.40",
      prizeLevelList: [
        { group: "101", stakeCount: "2" },
        { group: "301", stakeCount: "96" },
      ],
    }],
  },
});

assert.equal(parsed.totalPages, 98);
assert.deepEqual(parsed.draws[0], {
  type: "dlt",
  issue: "26118",
  date: "2026-10-17",
  front: [2, 9, 21, 26, 32],
  back: [6, 12],
  sales: 316189166,
  pool: 796723787.4,
  firstPrizeCount: 2,
  secondPrizeCount: 96,
  source: "sporttery",
});
assert.throws(
  () => parseSportteryDltResponse({ success: false, errorMessage: "处理失败" }),
  /处理失败/,
);
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/dltHistory.test.mjs`

Expected: FAIL because `parseSportteryDltResponse` is not exported.

- [ ] **Step 3: Implement the official parser and signature**

Add `parseSportteryDltResponse(payload)` with strict `success === true`, `value.list` array, seven-number result, page count, and numeric normalization:

```js
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
      const prize = (group) => row.prizeLevelList?.find((item) => String(item.group) === group);
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
```

Remove `parseDlt17500Text` after the official parser test passes. Keep CSV and validation behavior unchanged.

- [ ] **Step 4: Run DLT tests**

Run: `node --test tests/dltHistory.test.mjs tests/dltHistoryData.test.mjs`

Expected: all DLT unit and stored-data tests pass.

- [ ] **Step 5: Commit DLT parsing**

```bash
git add src/dltHistory.mjs tests/dltHistory.test.mjs
git commit -m "feat: parse official sports lottery history"
```

### Task 5: Wire both CLI importers to official APIs

**Files:**
- Modify: `scripts/import-ssq-history.mjs`
- Modify: `scripts/import-dlt-history.mjs`
- Modify: `tests/h5Content.test.mjs`

- [ ] **Step 1: Add a failing source-boundary test**

Extend the scheduled-workflow test to read both importer files and assert:

```js
assert.match(ssqImporter, /www\.cwl\.gov\.cn/);
assert.match(dltImporter, /webapi\.sporttery\.cn/);
assert.doesNotMatch(`${ssqImporter}\n${dltImporter}`, /17500/);
assert.doesNotMatch(`${ssqImporter}\n${dltImporter}`, /execFileSync|curl/);
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/h5Content.test.mjs`

Expected: FAIL because the importers still reference 17500 and curl.

- [ ] **Step 3: Rewrite the SSQ CLI as incremental official import glue**

Replace `scripts/import-ssq-history.mjs` with:

```js
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
  "User-Agent": "lottery-ticket-history-updater/1.0",
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
    })) url.searchParams.set(name, value);
    return parseCwlSsqResponse(await fetchJsonWithRetry(url, { headers }));
  },
});
const merged = mergeDrawHistory(existing, incoming, ssqDrawSignature);
const validation = validateSsqDraws(merged);
if (!validation.valid) {
  throw new Error(`SSQ history validation failed:\n${validation.errors.join("\n")}`);
}
writeTextAtomically(outputPath, serializeSsqCsv(merged));
console.log(
  `Imported ${merged.length - existing.length} new 双色球 draws; ` +
  `${merged.length} total; latest ${merged.toSorted((a, b) => b.issue.localeCompare(a.issue))[0].issue}`,
);
```

- [ ] **Step 4: Rewrite the DLT CLI with the same safety flow**

Replace `scripts/import-dlt-history.mjs` with:

```js
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
    })) url.searchParams.set(name, value);
    return parseSportteryDltResponse(await fetchJsonWithRetry(url, { headers }));
  },
});
const merged = mergeDrawHistory(existing, incoming, dltDrawSignature);
const validation = validateDltDraws(merged);
if (!validation.valid) {
  throw new Error(`DLT history validation failed:\n${validation.errors.join("\n")}`);
}
writeTextAtomically(outputPath, serializeDltCsv(merged));
console.log(
  `Imported ${merged.length - existing.length} new 大乐透 draws; ` +
  `${merged.length} total; latest ${merged.toSorted((a, b) => b.issue.localeCompare(a.issue))[0].issue}`,
);
```

- [ ] **Step 5: Run focused tests and inspect runtime references**

Run:

```bash
node --test tests/historyImport.test.mjs tests/ssqHistory.test.mjs tests/dltHistory.test.mjs tests/h5Content.test.mjs
rg -n "data\.17500\.cn|execFileSync|curl" scripts src .github/workflows
```

Expected: tests pass; `rg` returns no matches.

- [ ] **Step 6: Commit importer migration**

```bash
git add scripts/import-ssq-history.mjs scripts/import-dlt-history.mjs tests/h5Content.test.mjs
git commit -m "fix: migrate lottery imports to official APIs"
```

### Task 6: Backfill missing data and regenerate the arena

**Files:**
- Modify: `data/ssq-history.csv`
- Modify: `data/dlt-history.csv`
- Modify: `data/ssq-arena.csv`
- Modify: `data/dlt-arena.csv`
- Modify: `tests/ssqHistoryData.test.mjs`
- Modify: `tests/dltHistoryData.test.mjs`

- [ ] **Step 1: Raise stored-data expectations first**

Update the data tests to require exact latest records:

```js
const latest = draws.find((draw) => draw.issue === "2026118");
assert.ok(latest);
assert.equal(latest.date, "2026-10-15");
assert.deepEqual(latest.red, [5, 21, 22, 23, 28, 31]);
assert.deepEqual(latest.blue, [14]);
```

```js
const latest = draws.find((draw) => draw.issue === "26118");
assert.ok(latest);
assert.equal(latest.date, "2026-10-17");
assert.deepEqual(latest.front, [2, 9, 21, 26, 32]);
assert.deepEqual(latest.back, [6, 12]);
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/ssqHistoryData.test.mjs tests/dltHistoryData.test.mjs`

Expected: both tests fail because the latest issues are absent.

- [ ] **Step 3: Run the official importers and arena generator**

```bash
npm run import:ssq
npm run import:dlt
npm run generate:arena
```

Expected: SSQ reports 6 added issues and latest `2026118`; DLT reports 7 added issues and latest `26118`; arena generation completes.

- [ ] **Step 4: Verify data tests and exact additions**

Run:

```bash
node --test tests/ssqHistoryData.test.mjs tests/dltHistoryData.test.mjs
git diff --numstat -- data/ssq-history.csv data/dlt-history.csv
```

Expected: both tests pass; history diffs contain exactly 6 added SSQ rows and 7 added DLT rows with no deleted historical rows.

- [ ] **Step 5: Verify idempotency**

Record `git diff -- data/ssq-history.csv data/dlt-history.csv`, rerun both importers, and compare the diff again. Expected: the second import reports 0 added issues and produces no additional diff.

- [ ] **Step 6: Commit the backfill**

```bash
git add data/ssq-history.csv data/dlt-history.csv data/ssq-arena.csv data/dlt-arena.csv tests/ssqHistoryData.test.mjs tests/dltHistoryData.test.mjs
git commit -m "data: backfill official lottery draws"
```

### Task 7: Document, verify, land, and observe remote automation

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`

- [ ] **Step 1: Document official sources and safety behavior**

Add concise bullets stating that SSQ comes from China Welfare Lottery, DLT comes from China Sports Lottery, imports merge into stored history, and failed/invalid responses leave the prior CSV untouched.

- [ ] **Step 2: Remove stale source references from executable code**

Run:

```bash
rg -n "data\.17500\.cn|parseSsq17500|parseDlt17500|importFrom17500" scripts src tests .github/workflows
```

Expected: no matches. Historical CSV `source=17500` values are intentionally excluded from this search scope.

- [ ] **Step 3: Run fresh complete local verification**

```bash
npm test
npm run import:ssq
npm run import:dlt
npm run generate:arena
git diff --check
```

Expected: all tests pass, both importers report 0 newly added issues on the repeat run, arena generation succeeds, and `git diff --check` is clean.

- [ ] **Step 4: Commit documentation**

```bash
git add README.md README.en.md
git commit -m "docs: document official lottery imports"
```

- [ ] **Step 5: Review the complete change before landing**

```bash
git status --short
git log --oneline --decorate -8
git diff main...HEAD --stat
git diff main...HEAD -- scripts src tests .github/workflows README.md README.en.md
```

Expected: only planned files changed; the user's `.local-site/` remains untouched.

- [ ] **Step 6: Land and push the verified commits**

Use the repository's normal fast-forward/merge path from the isolated worktree, then push `main` to `origin`. Do not force-push. Confirm the pushed SHA with `git ls-remote origin refs/heads/main`.

- [ ] **Step 7: Trigger and monitor the updater**

```bash
workflow_run_url=$(gh workflow run "Update lottery data" --ref main)
workflow_run_id=${workflow_run_url##*/}
gh run watch "$workflow_run_id" --exit-status
```

Expected: the official import workflow succeeds and reports no missing draws after the committed backfill.

- [ ] **Step 8: Verify Pages deployment**

Find the `Deploy GitHub Pages` run triggered by `workflow_run`, watch it to completion, then request the public Pages URL and confirm HTTP 200. Report run URLs, deployed commit SHA, final issue counts, and latest issues.
