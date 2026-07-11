#!/usr/bin/env node
// Bundle-size gate — fails CI when the built client entry exceeds the
// perf budget documented in docs/roadmap.md ("Performance budget").
//
// Budgets (gzipped):
//   • Main JS entry chunk ≤ 250 KB
//   • Initial CSS         ≤  30 KB
//
// Usage:
//   bun run build && bun run check:bundlesize
//
// The script inspects TanStack Start's client output. It looks for the
// entry chunk under one of the well-known output paths and gzips it in
// memory (no dependency on `bundlesize` npm package).

import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const MAIN_JS_MAX = 250 * 1024;
const MAIN_CSS_MAX = 30 * 1024;

const CANDIDATES = [
  ".output/public/_build/assets",
  "dist/_build/assets",
  "dist/assets",
];

async function findAssetsDir() {
  for (const dir of CANDIDATES) {
    if (existsSync(dir)) return dir;
  }
  throw new Error(
    `No build output found. Ran \`bun run build\` first? Looked in:\n  ${CANDIDATES.join("\n  ")}`,
  );
}

async function gzippedSize(file) {
  const buf = await readFile(file);
  return gzipSync(buf, { level: 9 }).length;
}

function fmt(n) {
  return `${(n / 1024).toFixed(1)} KB`;
}

async function main() {
  const assets = await findAssetsDir();
  const files = await readdir(assets);
  const jsChunks = [];
  const cssChunks = [];
  for (const name of files) {
    const full = path.join(assets, name);
    const s = await stat(full);
    if (!s.isFile()) continue;
    if (name.endsWith(".js")) jsChunks.push({ name, full, size: s.size });
    else if (name.endsWith(".css")) cssChunks.push({ name, full, size: s.size });
  }

  // "Main entry" heuristic: the largest single JS chunk that isn't a
  // vendor split. TanStack Start emits `client-entry-*.js` / `index-*.js`.
  const entryHints = ["client-entry", "index", "main", "app"];
  const entryCandidates = jsChunks.filter((c) =>
    entryHints.some((h) => c.name.toLowerCase().startsWith(h)),
  );
  const mainJs =
    entryCandidates.sort((a, b) => b.size - a.size)[0] ??
    jsChunks.sort((a, b) => b.size - a.size)[0];

  const mainCss = cssChunks.sort((a, b) => b.size - a.size)[0];

  const failures = [];

  if (mainJs) {
    const gz = await gzippedSize(mainJs.full);
    const status = gz <= MAIN_JS_MAX ? "OK" : "FAIL";
    console.log(`[${status}] main JS  ${mainJs.name.padEnd(40)} ${fmt(gz).padStart(9)} gz  (budget ${fmt(MAIN_JS_MAX)})`);
    if (gz > MAIN_JS_MAX)
      failures.push(`Main JS ${fmt(gz)} gz exceeds ${fmt(MAIN_JS_MAX)} budget`);
  } else {
    failures.push("No JS entry chunk found in build output");
  }

  if (mainCss) {
    const gz = await gzippedSize(mainCss.full);
    const status = gz <= MAIN_CSS_MAX ? "OK" : "FAIL";
    console.log(`[${status}] main CSS ${mainCss.name.padEnd(40)} ${fmt(gz).padStart(9)} gz  (budget ${fmt(MAIN_CSS_MAX)})`);
    if (gz > MAIN_CSS_MAX)
      failures.push(`Main CSS ${fmt(gz)} gz exceeds ${fmt(MAIN_CSS_MAX)} budget`);
  }

  console.log("");
  if (failures.length) {
    console.error("Bundle-size budget FAILED:");
    for (const f of failures) console.error("  • " + f);
    process.exit(1);
  }
  console.log("Bundle-size budget passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
