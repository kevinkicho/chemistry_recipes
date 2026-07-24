import { chromium } from "playwright";

const BASE =
  process.env.BASE_URL ||
  "https://chemrecipe--chemistryrecipes.us-central1.hosted.app";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Capture failed requests
const failed = [];
page.on("response", (res) => {
  if (res.status() >= 400) {
    failed.push({ url: res.url().slice(0, 160), status: res.status() });
  }
});

await page.goto(`${BASE}/compounds/pubchem/2244`, {
  waitUntil: "domcontentloaded",
  timeout: 60_000,
});

for (let i = 0; i < 50; i++) {
  const ready = await page.evaluate(() => !!document.getElementById("identity"));
  if (ready) break;
  await page.waitForTimeout(2000);
}
await page.waitForTimeout(4000);

const detail = await page.evaluate(() => {
  const ids = [
    "structure",
    "literature",
    "patents",
    "multi-source",
    "pubchem-manufacturing",
    "industry-briefs",
    "contradictions",
    "routes",
    "overview",
    "critical-board",
  ];
  const out = {};
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) {
      out[id] = { present: false };
      continue;
    }
    const img = el.querySelector("img");
    out[id] = {
      present: true,
      text: (el.innerText || "").trim().slice(0, 220),
      textLen: (el.innerText || "").trim().length,
      imgSrc: img?.getAttribute("src") || null,
      imgNatural: img
        ? { w: img.naturalWidth, h: img.naturalHeight, complete: img.complete }
        : null,
    };
  }
  const broken = [...document.images]
    .filter((i) => !i.complete || i.naturalWidth === 0)
    .map((i) => i.src)
    .slice(0, 15);
  return { panels: out, brokenImgs: broken, title: document.title };
});

// Probe structure PNG from browser context
const structureSrc = detail.panels.structure?.imgSrc;
let imgProbe = null;
if (structureSrc) {
  imgProbe = await page.evaluate(async (src) => {
    try {
      const r = await fetch(src, { mode: "cors" });
      return { status: r.status, ok: r.ok, type: r.headers.get("content-type") };
    } catch (e) {
      return { error: String(e) };
    }
  }, structureSrc);
}

console.log(
  JSON.stringify(
    {
      title: detail.title,
      panels: detail.panels,
      brokenImgs: detail.brokenImgs,
      imgProbe,
      failedHttp: failed.slice(0, 20),
    },
    null,
    2
  )
);

await browser.close();
