import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // React Testing Library's automatic cleanup between tests relies on a
    // true global `afterEach` — without this, DOM from one test leaks
    // into the next.
    globals: true,
  },
});
