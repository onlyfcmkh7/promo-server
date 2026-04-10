async function scrapeVostorg() {
  console.log("🚀 VOSTORG API");

  const url =
    "https://vostorg.zakaz.ua/api/stores/48215685/products/?promo=1&page=1&page_size=100";

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json",
        "Referer": "https://vostorg.zakaz.ua/"
      }
    });

    const text = await res.text();

    if (!text || text.startsWith("<")) {
      console.log("❌ VOSTORG BLOCKED");
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
          storeId: 5,
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

    console.log("✅ VOSTORG:", items.length);

    return items;
  } catch (e) {
    console.error("❌ VOSTORG ERROR:", e);
    return [];
  }
}

module.exports = { scrapeVostorg };
