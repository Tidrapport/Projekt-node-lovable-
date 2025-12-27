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
      "^/(auth|time-entries|companies|public|customers|projects|profiles|subprojects|job-roles|material-types|price-list|admin|superadmin|help|plans|scheduled-assignments|deviation-reports|comp-time-balance|welding-reports|welding_reports|uploads|work-orders)": {
        target: "http://localhost:3000",
        changeOrigin: true,
        bypass(req) {
          const accept = req.headers?.accept || "";
          if (accept.includes("text/html")) return "/index.html";
          return undefined;
        },
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
