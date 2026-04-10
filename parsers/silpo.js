const puppeteer = require("puppeteer");

const SILPO_URL = "https://silpo.ua/offers";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePrice(value) {
  if (!value) return null;

  const cleaned = String(value)
    .replace(/\s+/g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function detectBrand(title) {
  const safeTitle = String(title || "").trim();

  const quoted = safeTitle.match(/[«"](.*?)[»"]/);
  if (quoted && quoted[1]) {
    return quoted[1].trim();
  }

  return safeTitle.split(" ")[0] || "";
}

async function scrapeSilpo() {
  console.log("🚀 START SCRAPING SILPO");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    // 🔥 ЛОВИМО API
    page.on("response", async (response) => {
      try {
        const url = response.url();

        if (url.includes("api.catalog.ecom.silpo.ua")) {
          console.log("SILPO API URL:", url);
          console.log("SILPO API STATUS:", response.status());
        }
      } catch (_) {}
    });

    await page.goto(SILPO_URL, {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    console.log("SILPO PAGE URL:", page.url());

    await sleep(5000);

    // ❗ ПОКИ ЩО повертаємо пусто — ми тільки ловимо API
    return [];
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeSilpo };
