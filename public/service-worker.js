const CACHE_NAME = "lottery-h5-v2";
const SCOPE_URL = new URL("./", self.location.href);
const DATA_PATHNAME = new URL("data/", SCOPE_URL).pathname;
const APP_SHELL = [
  "./",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "icon.svg",
  "src/compliance.mjs",
  "src/drawAnalysis.mjs",
  "src/dltHistory.mjs",
  "src/entitlements.mjs",
  "src/lotteryCatalog.mjs",
  "src/numberGenerator.mjs",
  "src/prizeRules.mjs",
  "src/recommendationTheory.mjs",
  "src/sampleDraws.mjs",
  "src/simulationTracker.mjs",
  "src/ssqHistory.mjs",
  "src/ticketCheck.mjs",
].map((path) => new URL(path, SCOPE_URL).toString());

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith(DATA_PATHNAME)) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}
