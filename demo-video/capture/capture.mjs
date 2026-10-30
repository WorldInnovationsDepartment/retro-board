// Renders the real built board (../dist/retro-board.html) against the mock
// runtime and screenshots each demo scene into public/shots/.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const page = readFileSync(join(root, "../dist/retro-board.html"), "utf8");
const mock = readFileSync(join(here, "mock-claude.js"), "utf8");
const harness = join(here, "harness.html");
writeFileSync(
  harness,
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><script>${mock}</script>${page}</body></html>`
);

const SCENES = [
  { name: "lobby" },
  { name: "write" },
  { name: "group" },
  { name: "grouping" },
  { name: "grouped" },
  { name: "vote" },
  { name: "results" },
  { name: "actions", scrollTo: 0 },
  { name: "history", hash: "history" },
];

const outDir = join(root, "public/shots");
mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--force-color-profile=srgb"],
});
for (const s of SCENES) {
  const tab = await browser.newPage();
  await tab.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await tab.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }, { name: "prefers-reduced-motion", value: "reduce" }]);
  const url = `file://${harness}?scene=${s.name}${s.hash ? "#" + s.hash : ""}`;
  await tab.goto(url, { waitUntil: "networkidle0" });
  await tab.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 600));
  await tab.screenshot({ path: join(outDir, `${s.name}.png`), fullPage: false });
  console.log("shot", s.name);
  await tab.close();
}
await browser.close();
