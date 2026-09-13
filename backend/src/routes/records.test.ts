import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { RawHealthRecord } from "@sg-health/types";

const fakeRecord: RawHealthRecord = {
  _id: 1,
  epi_year: "2023",
  epi_week: "2023-09",
  clinical_status: "Hospitalised",
  age_groups: "0 - 11 years old",
  count: "1.7",
};

// Mocking the cache layer (not fetch/the real API) keeps these tests fast
// and independent of data.gov.sg's actual response shape — we're testing
// that the route wires cache + insights together correctly, not the
// upstream client (that's calculateInsights.test.ts's job, and
// dataGovClient's own behavior was verified manually against the real API).
vi.mock("../cache/recordsCache.js", () => ({
  getCachedRecords: vi.fn(async () => ({ records: [fakeRecord], total: 1 })),
}));
vi.mock("../cache/insightsDatasetCache.js", () => ({
  getCachedFullDataset: vi.fn(async () => [fakeRecord]),
}));
vi.mock("../cache/filteredInsightsCache.js", () => ({
  getCachedFilteredInsights: vi.fn(async () => ({ averageByAgeGroup: [] })),
}));

const { createApp } = await import("../app.js");

describe("GET /api/records", () => {
  it("returns items and insights for the default (no-filter) request", async () => {
    const res = await request(createApp()).get("/api/records");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toEqual([fakeRecord]);
    expect(res.body.data.insights).toBeDefined();
  });

  it("rejects an out-of-range limit with 400", async () => {
    const res = await request(createApp()).get("/api/records").query({ limit: 9999 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rejects malformed filters JSON with 400", async () => {
    const res = await request(createApp()).get("/api/records").query({ filters: "not-json" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rejects an unknown filter field with 400", async () => {
    const res = await request(createApp())
      .get("/api/records")
      .query({ filters: JSON.stringify({ not_a_real_field: "x" }) });

    expect(res.status).toBe(400);
  });
});
