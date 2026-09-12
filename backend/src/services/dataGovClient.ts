import { env } from "../config/env.js";

// Raw shape as data.gov.sg actually returns it: every field is a string
// except _id, even the numeric-looking ones (epi_year, count).
export interface RawHealthRecord {
  _id: number;
  epi_year: string;
  epi_week: string;
  clinical_status: string;
  age_groups: string;
  count: string;
}

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
  // exact-match only, e.g. { clinical_status: "ICU" } — no ranges/comparisons.
  filters?: Record<string, string>;
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
  filters?: Record<string, string>,
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
