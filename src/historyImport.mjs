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
