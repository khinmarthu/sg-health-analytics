# Architecture Decision Records

Short writeups for the decisions substantial enough to warrant one. For the full, chronological list of every decision made during the build (including smaller ones), see `PLAN.md`'s Decisions Log — this file is the polished subset of that.

## ADR 1 — The frontend never calls data.gov.sg directly

**Context.** The frontend needs data.gov.sg's dataset to render anything. The simplest possible architecture would have the React app call `datastore_search` straight from the browser.

**Decision.** All data access goes through our own backend (`/api/filters`, `/api/records`). The frontend only ever talks to our Express server.

**Why.**
- **Caching.** data.gov.sg's data is static for long stretches (this dataset hasn't changed since mid-2024). A single backend-side cache serves every browser tab and every user, instead of each browser independently re-fetching and re-computing the same thing.
- **Business logic stays server-side.** The insight calculations (averages, week-over-week change, peak week, ICU:Hospitalised ratio) are real logic with real edge cases (see the worked example below, and the omission rule for degenerate filters). Keeping that in one place means one implementation to test and trust, instead of duplicating it in the browser too.
- **Input validation at a boundary we control.** The backend validates every query parameter with zod before it reaches any business logic — a different, narrower boundary than "trust whatever data.gov.sg returns."
- **A stable contract for the frontend.** If data.gov.sg ever changed its API shape, only the backend's `services/dataGovClient.ts` would need to change — the frontend's contract (`/api/records`'s response shape) stays the same.

**Consequences.** One more moving part to run locally (`pnpm dev` starts both), and the backend must be up for the frontend to show any data. Given this project's scope, that trade-off is clearly worth it — it's the standard shape for anything beyond a static site reading a public API directly.

## ADR 2 — Three caches, not one

**Context.** Two independent endpoints exist, with different natural access patterns: `/api/filters` needs the entire dataset (to enumerate unique values); `/api/records` needs a specific page of specific rows *and* an aggregate over every row matching the current filter.

**Decision.** Three separate in-memory caches (`node-cache`, TTL-based):

1. **Dataset cache** — the full 312-row dataset, one fixed key. Owned by `/api/filters`; reused directly by `/api/records` when no filter is active (a global aggregate is exactly what this cache already holds).
2. **Records proxy cache** — keyed by the exact query (`filters` + `limit` + `offset` + `sort`), serving `items`.
3. **Filtered-insights cache** — keyed by `filters` alone (no pagination), holding the *computed* insight result for that filter combination.

**Why not one cache?** `/api/records`'s `items` and `insights` need different data at different granularity for the same request — a page-shaped slice for one, a full-filtered-match aggregate for the other. Trying to serve both from one cache shape would mean either over-fetching (always loading everything, even for one page) or under-serving (insights computed from only the current page, which would be wrong).

**Why not push all filtering to data.gov.sg on every request and skip caching insight results?** Because insights need every matching row regardless of page, and data.gov.sg has no aggregation/groupBy capability — we can't ask it "give me the average" directly, only raw rows. Computing that aggregate ourselves, once per distinct filter combination, and caching the small result is cheaper than recomputing it from scratch on every request.

**Consequences — the scale caveat.** This works cleanly *because* the dataset is small (~20KB) and static. It is deliberately not the general answer: a larger or frequently-updated dataset would need either (a) pushing filtering to the source's own query capability and caching per-query with a short TTL, or (b) ETL'ing the data into a proper datastore on a schedule and querying that instead of holding it all in application memory. Both are real alternatives that were considered and explicitly not needed here.

## ADR 3 — Secrets: an optional key, nothing required to run

**Context.** data.gov.sg's API works with no key at all; an optional key only raises the rate-limit ceiling. During development, data.gov.sg did return a handful of transient failures (surfaced to the frontend as our own `502`), which motivated adding the key back after initially deciding it wasn't worth the complexity.

**Decision.** The key is read from `backend/.env` (gitignored) and sent as an optional `x-api-key` header — the app works identically with or without it (`env.dataGovApiKey` is `undefined`-safe throughout `dataGovClient.ts`). `.env.example` documents the variable with a blank placeholder so nothing sensitive is ever committed.

**An honest caveat.** Testing this legacy `datastore_search` endpoint directly (sending a deliberately invalid key) showed it doesn't reject bad keys at all — it returned `200 OK` regardless. So the rate-limit benefit of the real key couldn't be positively confirmed on this specific endpoint. It was kept anyway since sending it is harmless and costs nothing.

## Worked example — average count by age group

This is backend business logic (`backend/src/insights/calculateInsights.ts`), not frontend — per ADR 1, calculations like this live in exactly one place:

```ts
// 1. Average count by age group.
const countsByAgeGroup = new Map<string, number[]>();
for (const r of records) {
  const list = countsByAgeGroup.get(r.ageGroup) ?? [];
  list.push(r.count);
  countsByAgeGroup.set(r.ageGroup, list);
}
const averageByAgeGroup: AgeGroupAverage[] = [...countsByAgeGroup.entries()].map(
  ([ageGroup, counts]) => ({
    ageGroup,
    average: counts.reduce((sum, c) => sum + c, 0) / counts.length,
  }),
);
```

The function this lives in, `calculateInsights`, takes a plain array of records and has no idea whether the caller passed the full dataset or an already-filtered subset — **it just averages whatever rows it's given, grouped by `age_groups`**. That's deliberate: the same function serves both `/api/records`'s no-filter case (the full dataset) and its filtered case (a subset matching the current selection), with no special-casing between them. If a `clinical_status=ICU` filter is active, the rows passed in are already ICU-only, so the resulting averages are naturally "average ICU count by age group" — the function itself never needs to know that.

This "operate on whatever rows you're given" principle is what makes the insights consistently match whatever's currently filtered in the UI, and it's also why the ICU:Hospitalised ratio can be cleanly omitted rather than special-cased: that calculation checks whether both `clinical_status` values are actually present in the rows it received, and simply produces nothing if only one is — the same generic principle, not a one-off rule bolted on for that specific metric.
