import NodeCache from "node-cache";
import { env } from "../config/env.js";
import { fetchAllRecords } from "../services/dataGovClient.js";
import type { InsightsSummary } from "@sg-health/types";
import { calculateInsights } from "../insights/calculateInsights.js";

const cache = new NodeCache({ stdTTL: env.cacheTtlSeconds });

/** Keyed by filters only (no pagination) — used when /api/records has a
 * filter applied. On a miss: fetches every matching row (own pagination
 * loop, ignores page/pageSize), computes insights once, caches the
 * computed result (not the raw rows). */
export async function getCachedFilteredInsights(
  filters: Record<string, string>,
): Promise<InsightsSummary> {
  const key = JSON.stringify(filters);
  const cached = cache.get<InsightsSummary>(key);
  if (cached) return cached;

  const matchingRecords = await fetchAllRecords(filters);
  const insights = calculateInsights(matchingRecords);
  cache.set(key, insights);
  return insights;
}
