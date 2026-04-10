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

const cache = {
  atb: { items: [], updatedAt: null, loading: false, error: null },
  silpo: { items: [], updatedAt: null, loading: false, error: null },
  metro: { items: [], updatedAt: null, loading: false, error: null },
  klass: { items: [], updatedAt: null, loading: false, error: null },
  vostorg: { items: [], updatedAt: null, loading: false, error: null },
  rost: { items: [], updatedAt: null, loading: false, error: null }
};

function isFresh(entry) {
  if (!entry.updatedAt) return false;
  return Date.now() - new Date(entry.updatedAt).getTime() < CACHE_TTL_MS;
}

async function refreshStore(key, fn, name) {
  const entry = cache[key];

  if (entry.loading) {
    console.log(`⏳ ${name} refresh skipped: already loading`);
    return;
  }

  entry.loading = true;
  entry.error = null;

  try {
    console.log(`🔄 ${name} refresh start`);
    const items = await fn();

    entry.items = Array.isArray(items) ? items : [];
    entry.updatedAt = new Date().toISOString();

    console.log(`✅ ${name} refresh done:`, entry.items.length);
  } catch (e) {
    entry.error = e.message;
    console.error(`❌ ${name} refresh error:`, e.message);
  } finally {
    entry.loading = false;
  }
}

function buildResponse(entry) {
  return {
    updatedAt: entry.updatedAt,
    loading: entry.loading,
    count: entry.items.length,
    error: entry.error,
    items: entry.items
  };
}

function makeCachedRoute(key, fn, name) {
  return async (_req, res) => {
    const entry = cache[key];

    if (!isFresh(entry) && !entry.loading) {
      refreshStore(key, fn, name).catch((e) => {
        console.error(`${name} background refresh error:`, e.message);
      });
    }

    return res.json(buildResponse(entry));
  };
}

function makeRefreshRoute(key, fn, name) {
  return async (_req, res) => {
    refreshStore(key, fn, name).catch((e) => {
      console.error(`${name} manual refresh error:`, e.message);
    });

    return res.json({
      ok: true,
      message: `${name} refresh started`
    });
  };
}

app.get("/promotions/atb", makeCachedRoute("atb", scrapeATB, "ATB"));
app.get("/promotions/silpo", makeCachedRoute("silpo", scrapeSilpo, "SILPO"));
app.get("/promotions/metro", makeCachedRoute("metro", scrapeMetro, "METRO"));
app.get("/promotions/klass", makeCachedRoute("klass", scrapeKlass, "KLASS"));
app.get("/promotions/vostorg", makeCachedRoute("vostorg", scrapeVostorg, "VOSTORG"));
app.get("/promotions/rost", makeCachedRoute("rost", scrapeRost, "ROST"));

app.post("/promotions/atb/refresh", makeRefreshRoute("atb", scrapeATB, "ATB"));
app.post("/promotions/silpo/refresh", makeRefreshRoute("silpo", scrapeSilpo, "SILPO"));
app.post("/promotions/metro/refresh", makeRefreshRoute("metro", scrapeMetro, "METRO"));
app.post("/promotions/klass/refresh", makeRefreshRoute("klass", scrapeKlass, "KLASS"));
app.post("/promotions/vostorg/refresh", makeRefreshRoute("vostorg", scrapeVostorg, "VOSTORG"));
app.post("/promotions/rost/refresh", makeRefreshRoute("rost", scrapeRost, "ROST"));

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

app.listen(PORT, async () => {
  console.log("🚀 Server running on", PORT);

  refreshStore("silpo", scrapeSilpo, "SILPO").catch((e) => {
    console.error("SILPO initial refresh error:", e.message);
  });

  refreshStore("atb", scrapeATB, "ATB").catch((e) => {
    console.error("ATB initial refresh error:", e.message);
  });

  refreshStore("metro", scrapeMetro, "METRO").catch((e) => {
    console.error("METRO initial refresh error:", e.message);
  });

  refreshStore("klass", scrapeKlass, "KLASS").catch((e) => {
    console.error("KLASS initial refresh error:", e.message);
  });

  refreshStore("vostorg", scrapeVostorg, "VOSTORG").catch((e) => {
    console.error("VOSTORG initial refresh error:", e.message);
  });

  refreshStore("rost", scrapeRost, "ROST").catch((e) => {
    console.error("ROST initial refresh error:", e.message);
  });

  setInterval(() => {
    refreshStore("silpo", scrapeSilpo, "SILPO").catch((e) => {
      console.error("SILPO interval refresh error:", e.message);
    });
  }, CACHE_TTL_MS);

  setInterval(() => {
    refreshStore("atb", scrapeATB, "ATB").catch((e) => {
      console.error("ATB interval refresh error:", e.message);
    });
  }, CACHE_TTL_MS);

  setInterval(() => {
    refreshStore("metro", scrapeMetro, "METRO").catch((e) => {
      console.error("METRO interval refresh error:", e.message);
    });
  }, CACHE_TTL_MS);

  setInterval(() => {
    refreshStore("klass", scrapeKlass, "KLASS").catch((e) => {
      console.error("KLASS interval refresh error:", e.message);
    });
  }, CACHE_TTL_MS);

  setInterval(() => {
    refreshStore("vostorg", scrapeVostorg, "VOSTORG").catch((e) => {
      console.error("VOSTORG interval refresh error:", e.message);
    });
  }, CACHE_TTL_MS);

  setInterval(() => {
    refreshStore("rost", scrapeRost, "ROST").catch((e) => {
      console.error("ROST interval refresh error:", e.message);
    });
  }, CACHE_TTL_MS);
});
