async function scrapeMetro() {
  console.log("🚀 METRO API");

  const url =
    "https://metro.zakaz.ua/api/stores/48215685/products/?promo=1&page=1&page_size=100";

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Referer": "https://metro.zakaz.ua/uk/promotions/"
      }
    });

    const text = await res.text();

    // якщо прийшов HTML (блок)
    if (!text || text.startsWith("<")) {
      console.log("❌ METRO BLOCKED");
      return [];
    }

    const data = JSON.parse(text);

    const items = (data.results || [])
      .map((item, i) => {
        const price = item.price;
        const oldPrice = item.old_price;

        if (!price || !oldPrice || oldPrice <= price) return null;

        return {
          id: String(i + 1),
          storeId: 3,
          title: item.title,
          brand: (item.title || "").split(" ")[0],
          price,
          oldPrice,
          discountPercent: Math.round(
            ((oldPrice - price) / oldPrice) * 100
          ),
          imageUrl: item.image?.s350 || item.image?.s200 || ""
        };
      })
      .filter(Boolean);

    console.log("✅ METRO:", items.length);

    return items;
  } catch (e) {
    console.error("❌ METRO ERROR:", e);
    return [];
  }
}

module.exports = { scrapeMetro };
