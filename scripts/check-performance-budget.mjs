import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";

/**
 * Bundle-size gate.
 *
 * The rule that matters is about *first paint*: what every visitor downloads before the app shows
 * anything. Chunks that only load when someone opts into a feature are a different trade — the
 * Smart tab's three.js renderer costs ~600 KB, and that is fine precisely because nobody who
 * doesn't open that tab ever fetches it.
 *
 * So the budget is tiered. Anything reachable from the entry HTML is held to the tight limit and
 * must stay free of the heavy 3D stack; lazily-fetched chunks get a larger ceiling. Loosening this
 * to a single global limit would quietly surrender the protection for the whole app.
 */

const root = join(process.cwd(), "out");
const staticRoot = join(root, "_next", "static");

const limits = {
  /** Chunks on the first-paint path. */
  js: 450_000,
  css: 100_000,
  /** Chunks fetched only after a deliberate user action (opening the Smart tab, connecting). */
  jsLazy: 900_000,
};

/**
 * Total bytes on the first-paint path, across all chunks. The per-file limits above don't catch
 * death by a thousand small chunks, and this number is the one a visitor actually waits for.
 *
 * Measured 1,199,370 on 2026-11-07 (adding the Smart tab cost 4,068 bytes here — its nav entry
 * and the stubs for its lazy imports; three.js and the Bluetooth stack are not in this total).
 * Raising this should be a deliberate decision, not a reflex to make the build green.
 */
const FIRST_PAINT_TOTAL_BUDGET = 1_240_000;

/** Heavy rendering stacks must never reach first paint. */
const FORBIDDEN_ON_FIRST_PAINT = ["threeJSScene", "WebGLRenderer"];

async function walk(directory, out = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path, out);
    else out.push(path);
  }
  return out;
}

/**
 * Chunks the browser is told to load up front: anything referenced by a prerendered HTML file,
 * plus whatever those chunks statically import. Everything else arrives only on demand.
 */
async function firstPaintChunks() {
  const htmlFiles = (await walk(root)).filter((p) => p.endsWith(".html"));
  const referenced = new Set();
  for (const file of htmlFiles) {
    const html = await readFile(file, "utf8");
    for (const match of html.matchAll(/\/_next\/static\/[^"'\s)]+?\.(?:js|css)/g)) {
      referenced.add(basename(match[0]));
    }
  }

  // Follow static imports one level at a time until the set stops growing: a first-paint chunk
  // that imports another makes that one first-paint too.
  const assets = await walk(staticRoot);
  const byName = new Map(assets.map((p) => [basename(p), p]));
  let grew = true;
  while (grew) {
    grew = false;
    for (const name of [...referenced]) {
      const path = byName.get(name);
      if (!path || !path.endsWith(".js")) continue;
      const source = await readFile(path, "utf8");
      for (const match of source.matchAll(/["'`]([A-Za-z0-9_-]+\.js)["'`]/g)) {
        if (byName.has(match[1]) && !referenced.has(match[1])) {
          referenced.add(match[1]);
          grew = true;
        }
      }
    }
  }
  return referenced;
}

const assets = (await walk(staticRoot)).filter((p) => p.endsWith(".js") || p.endsWith(".css"));
const firstPaint = await firstPaintChunks();

let failed = false;
let lazyCount = 0;
let firstPaintBytes = 0;

for (const path of assets) {
  const name = basename(path);
  const relative = path.slice(process.cwd().length + 1);
  const isCss = path.endsWith(".css");
  const eager = isCss || firstPaint.has(name);
  if (!eager) lazyCount++;

  const limit = isCss ? limits.css : eager ? limits.js : limits.jsLazy;
  const bytes = (await stat(path)).size;
  if (eager) firstPaintBytes += bytes;
  if (bytes > limit) {
    const tier = isCss ? "css" : eager ? "first-paint js" : "lazy js";
    console.error(`${relative} is ${bytes} bytes (${tier} budget ${limit})`);
    failed = true;
  }

  if (!isCss && eager) {
    const source = await readFile(path, "utf8");
    for (const marker of FORBIDDEN_ON_FIRST_PAINT) {
      if (source.includes(marker)) {
        console.error(`${relative} puts "${marker}" on the first-paint path — it must stay lazy-loaded`);
        failed = true;
      }
    }
  }
}

if (firstPaintBytes > FIRST_PAINT_TOTAL_BUDGET) {
  console.error(
    `First-paint payload is ${firstPaintBytes} bytes across ${assets.length - lazyCount} assets ` +
      `(budget ${FIRST_PAINT_TOTAL_BUDGET}). Move something behind a dynamic import, or raise the ` +
      `budget deliberately and say why.`
  );
  failed = true;
}

if (failed) process.exit(1);
console.log(
  `Performance budgets passed for ${assets.length} static assets ` +
    `(${assets.length - lazyCount} on the first-paint path totalling ${firstPaintBytes} bytes, ` +
    `${lazyCount} lazy).`
);
