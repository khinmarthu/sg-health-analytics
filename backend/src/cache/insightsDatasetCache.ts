import NodeCache from "node-cache";
import { env } from "../config/env.js";
import { fetchAllRecords, type RawHealthRecord } from "../services/dataGovClient.js";

const cache = new NodeCache({ stdTTL: env.cacheTtlSeconds });
const FULL_DATASET_KEY = "full-dataset";

/** Returns the entire dataset (all 312 rows), fetching+paging only on a
 * cache miss. Insights aggregations need every record at once, so this
 * is a single fixed-key entry rather than per-query like recordsCache. */
export async function getCachedFullDataset(): Promise<RawHealthRecord[]> {
  const cached = cache.get<RawHealthRecord[]>(FULL_DATASET_KEY);
  if (cached) return cached;

  const records = await fetchAllRecords();
  cache.set(FULL_DATASET_KEY, records);
  return records;
}
