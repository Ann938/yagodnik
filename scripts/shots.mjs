// Скриншоты страницы по долям прокрутки: node scripts/shots.mjs <out> [w h] [webkit]
// Нужен PW_CHROME (путь к chromium из ms-playwright) для chromium.
import { chromium, webkit } from "playwright";
import fs from "node:fs";

const [out = "shots", W = "1440", H = "900", eng] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const w = +W, h = +H;
const mob = w < 1024;
const b = eng === "webkit"
  ? await webkit.launch()
  : await chromium.launch({ executablePath: process.env.PW_CHROME, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob && eng !== "webkit" ? true : undefined, hasTouch: mob });
const errs = [];
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
p.on("pageerror", (e) => errs.push(String(e)));
await p.goto(process.env.URL || "http://localhost:3500/", { waitUntil: "networkidle" });
await p.waitForTimeout(3000);
const H2 = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
const stops = (process.env.STOPS || "0,0.08,0.14,0.2,0.3,0.38,0.46,0.55,0.66,0.78,0.9,1").split(",").map(Number);
for (const [i, k] of stops.entries()) {
  await p.evaluate((y) => window.scrollTo(0, y), Math.round(H2 * k));
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `${out}/${String(i).padStart(2, "0")}.jpg`, type: "jpeg", quality: 70 });
}
const hs = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
console.log("height", H2, "hscroll", hs, "errors", errs.slice(0, 5));
await b.close();
