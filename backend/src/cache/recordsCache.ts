import type { RawHealthRecord } from "@sg-health/types";
import NodeCache from "node-cache";
import { env } from "../config/env.js";
import { fetchPage } from "../services/dataGovClient.js";

const cache = new NodeCache({ stdTTL: env.cacheTtlSeconds });

interface RecordsParams {
  limit: number;
  offset: number;
  filters?: Record<string, string>;
}

/** Cache key: the exact query params, so identical requests hit cache
 * and different ones (different page, different filter) don't collide. */
function cacheKey({ limit, offset, filters }: RecordsParams): string {
  return JSON.stringify({ limit, offset, filters: filters ?? {} });
}

export async function getCachedRecords(
  params: RecordsParams,
): Promise<{ records: RawHealthRecord[]; total: number }> {
  const key = cacheKey(params);
  const cached = cache.get<{ records: RawHealthRecord[]; total: number }>(key);
  if (cached) return cached;

  const result = await fetchPage(params);
  cache.set(key, result);
  return result;
}
