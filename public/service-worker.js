const CACHE_NAME = "lottery-h5-v13";
const SCOPE_URL = new URL("./", self.location.href);
const DATA_PATHNAME = new URL("data/", SCOPE_URL).pathname;
const APP_SHELL = [
  "./",
  "styles.css?v=20260609-mobile-polish",
  "app.js?v=20260609-mobile-polish",
  "manifest.webmanifest",
  "icon.svg",
  "zanshang.png",
  "zhifubaozanshang.png",
  "src/compliance.mjs?v=20260609-mobile-polish",
  "src/drawAnalysis.mjs?v=20260609-mobile-polish",
  "src/dltHistory.mjs?v=20260609-mobile-polish",
  "src/entitlements.mjs?v=20260609-mobile-polish",
  "src/lotteryCatalog.mjs?v=20260609-mobile-polish",
  "src/numberGenerator.mjs?v=20260609-mobile-polish",
  "src/prizeRules.mjs?v=20260609-mobile-polish",
  "src/redeemableDraws.mjs?v=20260609-mobile-polish",
  "src/recommendationTheory.mjs?v=20260609-mobile-polish",
  "src/sampleDraws.mjs?v=20260609-mobile-polish",
  "src/simulationTracker.mjs?v=20260609-mobile-polish",
  "src/ssqHistory.mjs?v=20260609-mobile-polish",
  "src/ticketCheck.mjs?v=20260609-mobile-polish",
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
