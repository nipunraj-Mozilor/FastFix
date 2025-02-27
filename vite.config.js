import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import unlighthouse from "@unlighthouse/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    unlighthouse({
      site: "http://localhost:5176",
      scanner: {
        device: "desktop",
        throttle: true,
        maxRoutes: 100, // Maximum number of routes to scan
        samples: 1, // Number of times to sample each route
        dynamicSampling: false, // Disable dynamic sampling to get exact count
      },
      ui: {
        enabled: true,
      },
      logger: {
        debug: true, // Enable debug logging to see page count
      },
    }),
  ],
  server: {
    port: 5176,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  define: {
    // If you need to use process.env anywhere else
    "process.env": {},
  },
});
