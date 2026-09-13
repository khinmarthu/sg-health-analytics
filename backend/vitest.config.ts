import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Non-secret placeholders so tests never depend on a local .env file
    // (which doesn't exist in CI — it's gitignored). Tests mock the cache
    // layer, so DATA_GOV_BASE_URL is never actually called.
    env: {
      RESOURCE_ID: "d_test_resource_id",
      DATA_GOV_BASE_URL: "https://example.invalid/api/action/datastore_search",
      CACHE_TTL_SECONDS: "300",
      PORT: "5000",
    },
  },
});
