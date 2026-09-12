import { Router } from "express";
import { z } from "zod";
import { getCachedRecords } from "../cache/recordsCache.js";
import { getCachedFullDataset } from "../cache/insightsDatasetCache.js";
import { getCachedFilteredInsights } from "../cache/filteredInsightsCache.js";
import { calculateInsights } from "../insights/calculateInsights.js";

export const recordsRouter = Router();

// Validates OUR API's own incoming query params (not the gov data response —
// that's a separate boundary). A client could send anything, so this
// rejects bad/out-of-range input with a clear 400 instead of it silently
// producing a weird filter or a huge cache entry.
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  clinical_status: z.enum(["ICU", "Hospitalised"]).optional(),
  age_groups: z
    .enum(["0 - 11 years old", "12 - 59 years old", "60 years old and above"])
    .optional(),
});

recordsRouter.get("/api/records", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { message: parsed.error.message } });
    return;
  }

  const { limit, offset, clinical_status, age_groups } = parsed.data;
  const filters: Record<string, string> = {};
  if (clinical_status) filters.clinical_status = clinical_status;
  if (age_groups) filters.age_groups = age_groups;

  const hasFilters = Object.keys(filters).length > 0;

  try {
    const { records, total } = await getCachedRecords({ limit, offset, filters });

    // insights always reflect every matching row, not just this page —
    // no filter: reuse the already-cached full dataset; filtered: use the
    // filters-only cache (see Decisions Log #11).
    const insights = hasFilters
      ? await getCachedFilteredInsights(filters)
      : calculateInsights(await getCachedFullDataset());

    res.json({ success: true, data: { items: records, total, limit, offset, insights } });
  } catch (err) {
    res.status(502).json({ success: false, error: { message: (err as Error).message } });
  }
});
