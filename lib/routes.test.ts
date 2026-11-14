import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every internal link must point at a page that exists.
 *
 * The app is a static export, so a link to a page that isn't built is a 404 in production — and
 * nothing else catches it: the types are just strings. When the per-competition route
 * `app/competitions/[id]` was replaced by `app/competition?id=`, the Analytics tab's
 * "Competition improvements" links kept pointing at the old path and every one of them 404'd.
 */

const ROOT = join(__dirname, "..");

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, out);
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name)) out.push(path);
  }
  return out;
}

/** Routes the static export builds: every page.tsx under app/, as its URL path. */
const routes = new Set(
  files(join(ROOT, "app"))
    .filter((f) => f.endsWith("page.tsx"))
    .map((f) => "/" + relative(join(ROOT, "app"), f).replace(/\/?page\.tsx$/, ""))
    .map((r) => (r === "/" ? "/" : r.replace(/\/$/, "")))
);

/** Internal paths used in `href`, `router.push/replace` and `location.href`, up to any `?` or `#`. */
function linkTargets(): Array<{ file: string; path: string }> {
  const pattern = /(?:href=\{?|router\.(?:push|replace)\(|location\.href\s*=\s*)[`"'](\/[^`"'?#$]*)/g;
  const out: Array<{ file: string; path: string }> = [];
  for (const file of [...files(join(ROOT, "components")), ...files(join(ROOT, "app")), ...files(join(ROOT, "lib"))]) {
    for (const match of readFileSync(file, "utf8").matchAll(pattern)) {
      out.push({ file: relative(ROOT, file), path: match[1].replace(/\/$/, "") || "/" });
    }
  }
  return out;
}

describe("internal links", () => {
  it("finds the app's routes", () => {
    // Guards the test itself: if route discovery broke, every link would look broken or none would.
    expect(routes.has("/")).toBe(true);
    expect(routes.has("/competition")).toBe(true);
  });

  it("all point at a page the static export builds", () => {
    const broken = linkTargets().filter(({ path }) => {
      // A template literal can end the static part mid-path (`/competition/${id}`); the static
      // prefix must still be a real route or the start of one.
      return !routes.has(path) && ![...routes].some((r) => r.startsWith(path + "/") && path !== "");
    });
    expect(broken).toEqual([]);
  });
});
