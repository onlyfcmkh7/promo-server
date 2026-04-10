const puppeteer = require("puppeteer");

const VOSTORG_URL = "https://vostorg.zakaz.ua/ru/custom-categories/promotions/";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapeVostorg() {
  console.log("🚀 START VOSTORG INTERCEPT");

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

    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    page.on("response", async (response) => {
      try {
        const url = response.url();
        const contentType = response.headers()["content-type"] || "";

        if (
          url.includes("/api/") &&
          url.includes("/products") &&
          url.includes("promo") &&
          contentType.includes("application/json")
        ) {
          const json = await response.json();
          if (json && json.results && Array.isArray(json.results)) {
            apiData = json;
            console.log("✅ VOSTORG API CAUGHT:", json.results.length);
          }
        }
      } catch (_) {}
    });

    await page.goto(VOSTORG_URL, {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    await sleep(5000);

    if (!apiData || !apiData.results) {
      console.log("❌ NO VOSTORG API DATA");
      return [];
    }

    const items = apiData.results
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

    console.log("✅ FINAL VOSTORG:", items.length);

    return items;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeVostorg };
