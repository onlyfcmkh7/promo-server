const puppeteer = require("puppeteer");

const VOSTORG_URL = "https://vostorg.zakaz.ua/ru/custom-categories/promotions/";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapeVostorg() {
  console.log("🚀 START VOSTORG DEBUG");

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

    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    page.on("response", async (response) => {
      try {
        const req = response.request();
        const type = req.resourceType();
        const url = response.url();
        const ct = response.headers()["content-type"] || "";

        if (type === "xhr" || type === "fetch") {
          console.log("XHR:", url);
          console.log("TYPE:", ct);
        }
      } catch (_) {}
    });

    await page.goto(VOSTORG_URL, {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    await sleep(8000);

    return [];
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeVostorg };
