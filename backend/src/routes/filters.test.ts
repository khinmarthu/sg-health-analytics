import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { RawHealthRecord } from "@sg-health/types";

const fakeRecords: RawHealthRecord[] = [
  {
    _id: 1,
    epi_year: "2023",
    epi_week: "2023-09",
    clinical_status: "Hospitalised",
    age_groups: "0 - 11 years old",
    count: "1.7",
  },
  {
    _id: 2,
    epi_year: "2023",
    epi_week: "2023-10",
    clinical_status: "ICU",
    age_groups: "60 years old and above",
    count: "2.3",
  },
];

vi.mock("../cache/insightsDatasetCache.js", () => ({
  getCachedFullDataset: vi.fn(async () => fakeRecords),
}));

const { createApp } = await import("../app.js");

describe("GET /api/filters", () => {
  it("returns unique values per filterable field", async () => {
    const res = await request(createApp()).get("/api/filters");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      clinical_status: ["Hospitalised", "ICU"],
      age_groups: ["0 - 11 years old", "60 years old and above"],
      epi_week: ["2023-09", "2023-10"],
    });
  });
});
