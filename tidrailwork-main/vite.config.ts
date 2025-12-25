import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/auth": "http://localhost:3000",
      "/time-entries": "http://localhost:3000",
      "/companies": "http://localhost:3000",
      "/public": "http://localhost:3000",
      "/customers": "http://localhost:3000",
      "/projects": "http://localhost:3000",
      "/profiles": "http://localhost:3000",
      "/subprojects": "http://localhost:3000",
      "/job-roles": "http://localhost:3000",
      "/material-types": "http://localhost:3000",
      "/admin": "http://localhost:3000",
      "/superadmin": "http://localhost:3000",
      "/plans": "http://localhost:3000",
      "/scheduled-assignments": "http://localhost:3000",
      "/deviation-reports": "http://localhost:3000",
      "/welding-reports": "http://localhost:3000",
      "/welding_reports": "http://localhost:3000",
      "/uploads": "http://localhost:3000",
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
