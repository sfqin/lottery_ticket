import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { fetchJsonWithRetry } from "../src/historyImport.mjs";

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
