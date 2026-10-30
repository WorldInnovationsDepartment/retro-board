// Inlines src/ into one self-contained page for publishing as a Claude artifact.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

// logic.mjs is an ES module for tests; in the page its exports become plain declarations.
const logic = read("src/logic.mjs").replace(/^export\s+/gm, "");
const html = read("src/index.html")
  .replace("/*__STYLES__*/", () => read("src/styles.css"))
  .replace("/*__SCRIPT__*/", () => `${logic}\n${read("src/app.js")}`);

const out = join(root, "dist/retro-board.html");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`wrote ${out} (${Buffer.byteLength(html)} bytes)`);
