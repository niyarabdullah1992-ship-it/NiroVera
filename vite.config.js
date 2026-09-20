import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import dns from 'node:dns'

dns.setDefaultResultOrder("ipv4first");

const normalizeRawUrl = (value = "") => value.replace(/([?&])raw=(?=(&|$))/g, "$1raw");

const normalizeRawQuery = {
  name: "normalize-empty-raw-query",
  enforce: "pre",
  resolveId(source, importer, options) {
    const normalized = normalizeRawUrl(source);
    if (normalized === source) return null;
    return this.resolve(normalized, importer, { ...options, skipSelf: true });
  },
  load(id) {
    const [filePath, query = ""] = id.split("?");
    const isRawText = /\.(html|css)$/i.test(filePath) && /(^|&)raw(?:=)?(?:&|$)/.test(query);
    if (!isRawText) return null;
    return `export default ${JSON.stringify(readFileSync(filePath, "utf8"))};`;
  },
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      request.url = normalizeRawUrl(request.url);
      next();
    });
  },
};

const PROXY_RESET_CODES = new Set(["ECONNRESET", "EPIPE", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND"]);

function hardenDevProxy() {
  return {
    name: "harden-dev-proxy",
    configureServer(server) {
      const ignore = (err) => PROXY_RESET_CODES.has(err?.code);
      const onUncaught = (err) => {
        if (ignore(err)) {
          console.warn(`[vite] ignored ${err.code} from the upstream proxy`);
          return;
        }
        process.off("uncaughtException", onUncaught);
        throw err;
      };
      process.on("uncaughtException", onUncaught);
      const drop = (err, socket) => {
        if (!ignore(err)) return;
        try { socket?.destroy?.(); } catch { /* already closed */ }
      };
      server.httpServer?.on("clientError", drop);
      server.httpServer?.on("error", (err) => {
        if (ignore(err)) return;
      });
      server.httpServer?.once("close", () => process.off("uncaughtException", onUncaught));
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    normalizeRawQuery,
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: false
    }),
    hardenDevProxy(),
    react(),
  ],
  optimizeDeps: {
    include: ["qrcode"],
  },
  // Claude Design handoff zips lock files on Windows; watching them crashes Vite (EBUSY).
  // Bind IPv4 as well as IPv6 — Windows localhost often fails if Vite listens on [::1] only.
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/design-handoff-claude/**", "**/.tmp-*", "**/.tmp-*/**"],
    },
  },
});