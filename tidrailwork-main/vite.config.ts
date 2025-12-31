import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    port: 5174,
    strictPort: true,
    host: true,
    allowedHosts: true,
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const accept = req.headers.accept || "";
        if (req.method === "GET" && accept.includes("text/html") && req.url?.startsWith("/admin")) {
          req.url = "/";
        }
        next();
      });
    },

    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/admin": { target: "http://localhost:3000", changeOrigin: true },
      "/auth": { target: "http://localhost:3000", changeOrigin: true },
      "/fortnox": { target: "http://localhost:3000", changeOrigin: true },

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
