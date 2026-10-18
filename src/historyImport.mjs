import { renameSync, rmSync, writeFileSync } from "node:fs";

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
      if (!retryableNetworkError || attempt === attempts) {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }

    if (response?.ok) {
      return response.json();
    }

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

export async function collectIncrementalDraws({ existingIssues, fetchPage }) {
  const collected = [];

  for (let pageNo = 1; ; pageNo += 1) {
    const page = await fetchPage(pageNo);
    if (!Array.isArray(page.draws) || page.draws.length === 0) {
      throw new Error(`Official history page ${pageNo} contained no draws`);
    }

    collected.push(...page.draws);
    if (page.draws.some((draw) => existingIssues.has(draw.issue))) {
      return collected;
    }

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
    if (!current) {
      merged.set(draw.issue, draw);
    }
  }

  return [...merged.values()];
}

export function writeTextAtomically(path, text) {
  const temporaryPath = `${path}.${process.pid}.tmp`;

  try {
    writeFileSync(temporaryPath, text, "utf8");
    renameSync(temporaryPath, path);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}
