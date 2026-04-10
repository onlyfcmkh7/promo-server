const axios = require("axios");

const STORE_ID = "482320001";

async function scrapeVostorg(query = "молоко") {
  console.log("🚀 START VOSTORG API");

  try {
    const url = `https://stores-api.zakaz.ua/stores/${STORE_ID}/products/search?q=${encodeURIComponent(query)}`;

    const res = await axios.get(url);

    const products = res.data.results || [];

    const items = products.map((p, i) => {
      const price = p.price / 100;

      return {
        id: p.id || String(i),
        storeId: 5,
        title: p.title,
        price,
        oldPrice: null, // поки нема
        discountPercent: null,
        imageUrl: p.image_url || null,
        createdAt: Date.now()
      };
    });

    console.log("✅ VOSTORG:", items.length);

    return items;
  } catch (e) {
    console.log("❌ VOSTORG ERROR:", e.message);
    return [];
  }
}

module.exports = { scrapeVostorg };
