import type { ApiResponse, RecordsFilters, RecordsResponseData } from "@sg-health/types";
import { Router } from "express";
import { z } from "zod";
import { getCachedRecords } from "../cache/recordsCache.js";
import { getCachedFullDataset } from "../cache/insightsDatasetCache.js";
import { getCachedFilteredInsights } from "../cache/filteredInsightsCache.js";
import { calculateInsights } from "../insights/calculateInsights.js";

export const recordsRouter = Router();

// Each field accepts one value or an array (OR-match) — mirrors exactly
// what data.gov.sg's own `filters` param supports (verified earlier).
const clinicalStatusEnum = z.enum(["ICU", "Hospitalised"]);
const ageGroupEnum = z.enum([
  "0 - 11 years old",
  "12 - 59 years old",
  "60 years old and above",
]);
const epiWeekPattern = z.string().regex(/^\d{4}-\d{2}$/, "must look like YYYY-WW");

function oneOrMany<T extends z.ZodTypeAny>(schema: T) {
  return z.union([schema, z.array(schema)]);
}

// .strict() rejects unknown keys — a typo'd field name fails loudly
// instead of silently being ignored.
const filtersSchema = z
  .object({
    clinical_status: oneOrMany(clinicalStatusEnum).optional(),
    age_groups: oneOrMany(ageGroupEnum).optional(),
    epi_week: oneOrMany(epiWeekPattern).optional(),
  })
  .strict();

// Validates OUR API's own incoming query params (not the gov data response —
// that's a separate boundary). A client could send anything, so this
// rejects bad/out-of-range input with a clear 400 instead of it silently
// producing a weird filter or a huge cache entry.
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  filters: z.string().optional(), // JSON string, parsed+validated separately below
});

recordsRouter.get("/api/records", async (req, res) => {
  const parsedQuery = querySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ success: false, error: { message: parsedQuery.error.message } });
    return;
  }
  const { limit, offset, filters: filtersRaw } = parsedQuery.data;

  let filters: RecordsFilters = {};
  if (filtersRaw) {
    let json: unknown;
    try {
      json = JSON.parse(filtersRaw);
    } catch {
      res.status(400).json({ success: false, error: { message: "filters must be valid JSON" } });
      return;
    }
    const parsedFilters = filtersSchema.safeParse(json);
    if (!parsedFilters.success) {
      res.status(400).json({ success: false, error: { message: parsedFilters.error.message } });
      return;
    }
    filters = parsedFilters.data;
  }

  const hasFilters = Object.keys(filters).length > 0;

  try {
    const { records, total } = await getCachedRecords({ limit, offset, filters });

    // insights always reflect every matching row, not just this page —
    // no filter: reuse the already-cached full dataset; filtered: use the
    // filters-only cache (see Decisions Log #11).
    const insights = hasFilters
      ? await getCachedFilteredInsights(filters)
      : calculateInsights(await getCachedFullDataset());

    const data: RecordsResponseData = { items: records, total, limit, offset, insights };
    const body: ApiResponse<RecordsResponseData> = { success: true, data };
    res.json(body);
  } catch (err) {
    res.status(502).json({ success: false, error: { message: (err as Error).message } });
  }
});
