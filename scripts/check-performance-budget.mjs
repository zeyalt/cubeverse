import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const root = join(process.cwd(), "out", "_next", "static");
const limits = { js: 450_000, css: 100_000 };
const assets = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.name.endsWith(".js") || entry.name.endsWith(".css")) assets.push(path);
  }
}

await walk(root);
let failed = false;
for (const path of assets) {
  const extension = path.endsWith(".css") ? "css" : "js";
  const bytes = (await stat(path)).size;
  if (bytes > limits[extension]) {
    console.error(`${path.slice(process.cwd().length + 1)} is ${bytes} bytes (budget ${limits[extension]})`);
    failed = true;
  }
  if (extension === "js") {
    const source = await readFile(path, "utf8");
    if (source.includes("threeJSScene") || source.includes("WebGLRenderer")) {
      console.error(`${path.slice(process.cwd().length + 1)} contains the removed Three.js preview stack`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log(`Performance budgets passed for ${assets.length} static assets.`);
