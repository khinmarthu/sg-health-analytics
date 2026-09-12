import type { RawHealthRecord, RecordsFilters } from "@sg-health/types";
import { env } from "../config/env.js";

interface DatastoreSearchResponse {
  success: boolean;
  result?: {
    records: RawHealthRecord[];
    total: number;
  };
  error?: Record<string, unknown>;
}

interface FetchPageParams {
  limit: number;
  offset: number;
  // exact-match only; an array value OR-matches within that field (verified
  // against the real API — see PLAN.md chat history), no ranges/comparisons.
  filters?: RecordsFilters;
}

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fetches one page of raw records from data.gov.sg's datastore_search API.
 * Retries a couple of times on failure — we saw one transient error from
 * this API during testing, unrelated to our request itself. */
export async function fetchPage({ limit, offset, filters }: FetchPageParams) {
  const url = new URL(env.dataGovBaseUrl);
  url.searchParams.set("resource_id", env.resourceId);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  if (filters && Object.keys(filters).length > 0) {
    url.searchParams.set("filters", JSON.stringify(filters));
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url);
      const json = (await response.json()) as DatastoreSearchResponse;
      if (!json.success || !json.result) {
        throw new Error(`data.gov.sg returned an error: ${JSON.stringify(json.error)}`);
      }
      return json.result;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastError;
}

const PAGE_SIZE = 100;

/** Fetches every record matching `filters` (or the whole dataset if omitted),
 * paging until `total` is reached. */
export async function fetchAllRecords(
  filters?: RecordsFilters,
): Promise<RawHealthRecord[]> {
  const records: RawHealthRecord[] = [];
  let offset = 0;
  let total = Infinity; // unknown until the first response tells us

  while (offset < total) {
    const page = await fetchPage({ limit: PAGE_SIZE, offset, filters });
    records.push(...page.records);
    total = page.total;
    offset += PAGE_SIZE;
  }

  return records;
}
