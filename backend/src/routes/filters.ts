import { Router } from "express";
import { getCachedFullDataset } from "../cache/insightsDatasetCache.js";
import type { RawHealthRecord } from "../services/dataGovClient.js";

export const filtersRouter = Router();

filtersRouter.get("/api/filters", async (_req, res) => {
  try {
    const records = await getCachedFullDataset();

    const uniqueValues = (field: keyof RawHealthRecord): string[] =>
      [...new Set(records.map((r) => String(r[field])))].sort();

    res.json({
      success: true,
      data: {
        clinical_status: uniqueValues("clinical_status"),
        age_groups: uniqueValues("age_groups"),
        epi_week: uniqueValues("epi_week"),
      },
    });
  } catch (err) {
    res.status(502).json({ success: false, error: { message: (err as Error).message } });
  }
});
