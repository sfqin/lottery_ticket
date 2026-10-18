import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  collectIncrementalDraws,
  fetchJsonWithRetry,
  mergeDrawHistory,
  writeTextAtomically,
} from "../src/historyImport.mjs";

describe("official history HTTP client", () => {
  it("retries HTTP 429 and 5xx responses with exponential delays", async () => {
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

  it("does not retry permanent HTTP errors", async () => {
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

describe("incremental official history import", () => {
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

  it("rejects a complete response with no stored-history overlap", async () => {
    await assert.rejects(
      collectIncrementalDraws({
        existingIssues: new Set(["old"]),
        fetchPage: async () => ({ draws: [{ issue: "new" }], totalPages: 1 }),
      }),
      /no overlap/i,
    );
  });

  it("keeps stored rows and appends missing official rows", () => {
    const existing = [{ issue: "1", date: "2026-01-01", numbers: [1, 2] }];
    const incoming = [
      { ...existing[0] },
      { issue: "2", date: "2026-01-02", numbers: [3, 4] },
    ];
    const signature = (draw) => `${draw.date}|${draw.numbers.join(",")}`;

    assert.deepEqual(
      mergeDrawHistory(existing, incoming, signature).map(({ issue }) => issue),
      ["1", "2"],
    );
  });

  it("rejects conflicting official winning numbers", () => {
    const existing = [{ issue: "1", date: "2026-01-01", numbers: [1, 2] }];
    const signature = (draw) => `${draw.date}|${draw.numbers.join(",")}`;

    assert.throws(
      () => mergeDrawHistory(existing, [{ ...existing[0], numbers: [9, 9] }], signature),
      /conflict.*1/i,
    );
  });

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
});
