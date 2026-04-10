const express = require("express");
const cors = require("cors");

const { scrapeATB } = require("./parsers/atb");
const { scrapeSilpo } = require("./parsers/silpo");
const { scrapeMetro } = require("./parsers/metro");
const { scrapeKlass } = require("./parsers/klass");
const { scrapeVostorg } = require("./parsers/vostorg");
const { scrapeRost } = require("./parsers/rost");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const CACHE_TTL_MS = 30 * 60 * 1000;

const stores = {
  atb: { name: "ATB", scraper: scrapeATB },
  silpo: { name: "SILPO", scraper: scrapeSilpo },
  metro: { name: "METRO", scraper: scrapeMetro },
  klass: { name: "KLASS", scraper: scrapeKlass },
  vostorg: { name: "VOSTORG", scraper: scrapeVostorg },
  rost: { name: "ROST", scraper: scrapeRost }
};

const cache = Object.fromEntries(
  Object.keys(stores).map((key) => [
    key,
    {
      items: [],
      updatedAt: null,
      loading: false,
      error: null
    }
  ])
);

function isFresh(entry) {
  if (!entry.updatedAt) return false;
  return Date.now() - new Date(entry.updatedAt).getTime() < CACHE_TTL_MS;
}

async function refreshStore(key) {
  const store = stores[key];
  const entry = cache[key];

  if (!store) {
    throw new Error(`Unknown store: ${key}`);
  }

  if (entry.loading) {
    console.log(`⏳ ${store.name} refresh skipped: already loading`);
    return entry.items;
  }

  entry.loading = true;
  entry.error = null;

  try {
    console.log(`🔄 ${store.name} refresh start`);

    const items = await store.scraper();

    if (!Array.isArray(items)) {
      throw new Error(`${store.name} scraper returned invalid data`);
    }

    if (items.length > 0) {
      entry.items = items;
      entry.updatedAt = new Date().toISOString();
      console.log(`✅ ${store.name} refresh done: ${items.length}`);
    } else {
      console.log(`⚠️ ${store.name} returned 0 items, keeping previous cache`);
    }

    return entry.items;
  } catch (e) {
    entry.error = e.message;
    console.error(`❌ ${store.name} refresh error:`, e.message);
    return entry.items;
  } finally {
    entry.loading = false;
  }
}

function triggerRefreshIfNeeded(key) {
  const entry = cache[key];

  if (!isFresh(entry) && !entry.loading) {
    refreshStore(key).catch((e) => {
      console.error(`${stores[key].name} background refresh error:`, e.message);
    });
  }
}

function createCachedRoute(key) {
  return async (_req, res) => {
    triggerRefreshIfNeeded(key);
    res.json(cache[key].items);
  };
}

function createManualRefreshRoute(key) {
  return async (_req, res) => {
    refreshStore(key).catch((e) => {
      console.error(`${stores[key].name} manual refresh error:`, e.message);
    });

    res.json({ ok: true });
  };
}

app.get("/promotions/atb", createCachedRoute("atb"));
app.get("/promotions/silpo", createCachedRoute("silpo"));
app.get("/promotions/metro", createCachedRoute("metro"));
app.get("/promotions/klass", createCachedRoute("klass"));
app.get("/promotions/vostorg", createCachedRoute("vostorg"));
app.get("/promotions/rost", createCachedRoute("rost"));

app.post("/promotions/atb/refresh", createManualRefreshRoute("atb"));
app.post("/promotions/silpo/refresh", createManualRefreshRoute("silpo"));
app.post("/promotions/metro/refresh", createManualRefreshRoute("metro"));
app.post("/promotions/klass/refresh", createManualRefreshRoute("klass"));
app.post("/promotions/vostorg/refresh", createManualRefreshRoute("vostorg"));
app.post("/promotions/rost/refresh", createManualRefreshRoute("rost"));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    stores: Object.fromEntries(
      Object.entries(cache).map(([key, entry]) => [
        key,
        {
          updatedAt: entry.updatedAt,
          loading: entry.loading,
          count: entry.items.length,
          error: entry.error
        }
      ])
    )
  });
});

app.listen(PORT, () => {
  console.log("🚀 Server running on", PORT);

  refreshStore("silpo").catch((e) => {
    console.error("SILPO initial refresh error:", e.message);
  });

  refreshStore("vostorg").catch((e) => {
    console.error("VOSTORG initial refresh error:", e.message);
  });

  refreshStore("atb").catch((e) => {
    console.error("ATB initial refresh error:", e.message);
  });

  setInterval(() => {
    for (const key of Object.keys(stores)) {
      if (cache[key].updatedAt || cache[key].items.length > 0) {
        refreshStore(key).catch((e) => {
          console.error(`${stores[key].name} interval refresh error:`, e.message);
        });
      }
    }
  }, CACHE_TTL_MS);
});
