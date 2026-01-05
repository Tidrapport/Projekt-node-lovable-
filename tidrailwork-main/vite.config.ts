import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const isDocumentRequest = (req: { headers?: Record<string, string | string[] | undefined> }) => {
  const headers = req.headers || {};
  const accept = String(headers.accept || "");
  const secFetchDest = String(headers["sec-fetch-dest"] || "");
  return accept.includes("text/html") || secFetchDest === "document";
};

const shouldServeSpa = (req: { url?: string; headers?: Record<string, string | string[] | undefined> }) => {
  if (!isDocumentRequest(req)) return false;
  const url = req.url || "/";
  if (url.startsWith("/uploads")) return false;
  if (url.startsWith("/fortnox")) return false;
  if (path.extname(url)) return false;
  return true;
};

export default defineConfig({
  server: {
    port: 5174,
    strictPort: true,
    host: true,
    allowedHosts: true,
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.method !== "GET" || !shouldServeSpa(req)) return next();
        req.url = "/";
        next();
      });
    },

    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/admin": {
        target: "http://localhost:3000",
        changeOrigin: true,
        bypass: (req) => (shouldServeSpa(req) ? "/" : undefined),
      },
      // Note: we keep an explicit proxy for `/admin` API endpoints so
      // frontend requests like `fetch('/admin/ob-settings')` reach the
      // backend. The middleware above rewrites browser navigation requests
      // (those with `Accept: text/html`) to `/` so SPA refresh still works.
      "/auth": { target: "http://localhost:3000", changeOrigin: true },
      "/fortnox": { target: "http://localhost:3000", changeOrigin: true },
      "/help": { target: "http://localhost:3000", changeOrigin: true },

      // Common backend endpoints used by the frontend (both hyphen and underscore variants)
      "/welding-reports": { target: "http://localhost:3000", changeOrigin: true },
      "/welding_reports": { target: "http://localhost:3000", changeOrigin: true },
      "/projects": { target: "http://localhost:3000", changeOrigin: true },
      "/subprojects": { target: "http://localhost:3000", changeOrigin: true },
      "/plans": { target: "http://localhost:3000", changeOrigin: true },
      "/time-entries": { target: "http://localhost:3000", changeOrigin: true },
      "/time_entries": { target: "http://localhost:3000", changeOrigin: true },
      "/job-roles": { target: "http://localhost:3000", changeOrigin: true },
      "/job_roles": { target: "http://localhost:3000", changeOrigin: true },
      "/companies": { target: "http://localhost:3000", changeOrigin: true },
      "/customers": { target: "http://localhost:3000", changeOrigin: true },
      "/price-list": { target: "http://localhost:3000", changeOrigin: true },
      "/work-orders": { target: "http://localhost:3000", changeOrigin: true },
      "/work_orders": { target: "http://localhost:3000", changeOrigin: true },
      "/material-types": { target: "http://localhost:3000", changeOrigin: true },
      "/material_types": { target: "http://localhost:3000", changeOrigin: true },
      "/fortnox_salary_codes": { target: "http://localhost:3000", changeOrigin: true },
      "/fortnox_company_mappings": { target: "http://localhost:3000", changeOrigin: true },
      "/fortnox_export_logs": { target: "http://localhost:3000", changeOrigin: true },
      "/profiles": { target: "http://localhost:3000", changeOrigin: true },
      "/shift_types_config": { target: "http://localhost:3000", changeOrigin: true },
      "/uploads": { target: "http://localhost:3000", changeOrigin: true },
    },
  },

  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
