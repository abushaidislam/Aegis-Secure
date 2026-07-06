// Second Vite entry point — builds the MV3 browser extension into
// `dist-ext/`. Kept intentionally separate from the web app's TanStack
// Start build so extension bundling can't perturb SSR output.
//
// The vault modules under `src/lib/*` are consumed verbatim via the `@/`
// alias — no copying, no forking. If a vault primitive changes, both the
// web app and the extension pick it up on the next build.

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";

const ROOT = path.resolve(__dirname);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.resolve(PROJECT_ROOT, "dist-ext");

// Read the same VITE_* env the web app uses so we bake the correct
// Supabase URL into the manifest's CSP `connect-src`.
function readEnv(name: string, fallback = ""): string {
  const raw = process.env[name];
  if (raw && raw.length > 0) return raw;
  try {
    const dotenv = fs.readFileSync(path.join(PROJECT_ROOT, ".env"), "utf8");
    const line = dotenv.split("\n").find((l) => l.startsWith(`${name}=`));
    if (line) return line.slice(name.length + 1).replace(/^"|"$/g, "");
  } catch {
    /* .env missing is fine in CI */
  }
  return fallback;
}

const SUPABASE_URL = readEnv("VITE_SUPABASE_URL");
const SUPABASE_ORIGIN = SUPABASE_URL ? new URL(SUPABASE_URL).origin : "https://*.supabase.co";

/**
 * Emit `manifest.json` + `content.js` alongside the JS bundles. Vite's
 * HTML pipeline handles the popup; background & content need explicit
 * inputs (they're not referenced from any HTML).
 */
function extensionManifestPlugin() {
  return {
    name: "aegis-extension-manifest",
    apply: "build" as const,
    generateBundle() {
      const source = fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8");
      const rendered = source
        .replaceAll("__SUPABASE_ORIGIN__", SUPABASE_ORIGIN);
      // @ts-expect-error - rollup plugin context is untyped here
      this.emitFile({ type: "asset", fileName: "manifest.json", source: rendered });
    },
  };
}

export default defineConfig({
  root: ROOT,
  plugins: [react(), extensionManifestPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(PROJECT_ROOT, "src"),
    },
  },
  define: {
    // The vault modules read `import.meta.env.VITE_SUPABASE_*` transitively
    // via the shared Supabase client. Populate them at build time so the
    // extension SW/popup can talk to the same backend the web app uses.
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(SUPABASE_URL),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
      readEnv("VITE_SUPABASE_PUBLISHABLE_KEY"),
    ),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(
      readEnv("VITE_SUPABASE_PROJECT_ID"),
    ),
  },
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    sourcemap: false,
    target: "chrome110",
    // Extension pages must not contain inline scripts (MV3 CSP forbids
    // 'unsafe-inline'). Vite would otherwise inline the modulepreload
    // polyfill and small chunks.
    modulePreload: { polyfill: false },
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        popup: path.join(ROOT, "src/popup/index.html"),
        background: path.join(ROOT, "src/background.ts"),
        content: path.join(ROOT, "src/content.ts"),
        announce: path.join(ROOT, "src/announce.ts"),
      },
      output: {
        // Service worker + content scripts must live at stable paths the
        // manifest can reference. Everything else gets Vite's hashed name.
        entryFileNames: (chunk) => {
          if (chunk.name === "background") return "background.js";
          if (chunk.name === "content") return "content.js";
          if (chunk.name === "announce") return "announce.js";
          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
