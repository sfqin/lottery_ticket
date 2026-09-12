const CACHE_NAME = "lottery-h5-v29";
const SCOPE_URL = new URL("./", self.location.href);
const DATA_PATHNAME = new URL("data/", SCOPE_URL).pathname;
const APP_SHELL = [
  "./",
  "styles.css?v=20260614-arena-date",
  "app.js?v=20260614-arena-date",
  "manifest.webmanifest",
  "icon.svg",
  "zanshang.png",
  "zhifubaozanshang.png",
  "src/compliance.mjs?v=20260614-arena-date",
  "src/drawAnalysis.mjs?v=20260614-arena-date",
  "src/dltHistory.mjs?v=20260614-arena-date",
  "src/entitlements.mjs?v=20260614-arena-date",
  "src/lotteryCatalog.mjs?v=20260614-arena-date",
  "src/numberGenerator.mjs?v=20260614-arena-date",
  "src/prizeRules.mjs?v=20260614-arena-date",
  "src/redeemableDraws.mjs?v=20260614-arena-date",
  "src/recommendationTheory.mjs?v=20260614-arena-date",
  "src/sampleDraws.mjs?v=20260614-arena-date",
  "src/simulationTracker.mjs?v=20260614-arena-date",
  "src/ssqHistory.mjs?v=20260614-arena-date",
  "src/ticketCheck.mjs?v=20260614-arena-date",
  "src/strategyArena.mjs?v=20260614-arena-date",
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
  // data 请求带时间戳 query，缓存时统一用去掉 query 的路径作为键，避免缓存膨胀
  const cacheKey = new URL(request.url);
  cacheKey.search = "";

  try {
    const response = await fetch(request);
    cache.put(cacheKey.toString(), response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(cacheKey.toString());
    if (cached) return cached;
    throw error;
  }
}
