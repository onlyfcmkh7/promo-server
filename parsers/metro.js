const puppeteer = require("puppeteer");

async function scrapeMetro() {
  console.log("🚀 METRO INTERCEPT");

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ]
  });

  try {
    const page = await browser.newPage();

    let apiData = null;

    // 🔥 ловимо API
    page.on("response", async (response) => {
      const url = response.url();

      if (url.includes("/products") && url.includes("promo")) {
        try {
          const json = await response.json();
          apiData = json;
        } catch (_) {}
      }
    });

    await page.goto("https://metro.zakaz.ua/uk/promotions/", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    // даємо час API прогрузитись
    await new Promise((r) => setTimeout(r, 5000));

    if (!apiData || !apiData.results) {
      console.log("❌ NO API DATA");
      return [];
    }

    const items = apiData.results
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
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeMetro };
