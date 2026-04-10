const axios = require("axios");

const STORE_ID = "482320001";

function parsePrice(value) {
  if (value === null || value === undefined) return null;

  const num = Number(value);
  if (!Number.isFinite(num)) return null;

  return num / 100;
}

async function scrapeVostorg(query = "молоко") {
  console.log("🚀 START VOSTORG API");

  try {
    const url = `https://stores-api.zakaz.ua/stores/${STORE_ID}/products/search?q=${encodeURIComponent(query)}`;

    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      },
      timeout: 30000
    });

    const products = Array.isArray(res.data?.results) ? res.data.results : [];

    const items = products
      .map((p, i) => {
        const price = parsePrice(p.price);
        const oldPrice = parsePrice(p.old_price);

        if (!price) return null;

        const discountPercent =
          oldPrice && oldPrice > price
            ? Math.round(((oldPrice - price) / oldPrice) * 100)
            : null;

        return {
          id: String(p.id || i + 1),
          storeId: 5,
          title: p.title || "",
          price,
          oldPrice,
          discountPercent,
          imageUrl: p.image_url || null,
          createdAt: Date.now()
        };
      })
      .filter(Boolean);

    console.log("✅ FINAL VOSTORG:", items.length);

    return items;
  } catch (e) {
    console.log("❌ VOSTORG ERROR:", e.message);
    return [];
  }
}

module.exports = { scrapeVostorg };
