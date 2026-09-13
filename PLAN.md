# SG Health Analytics — Project Plan

**Status**: All 8 steps complete and verified.

## Dataset

- **Title**: Average daily hospitalised / ICU cases by Epi-week
- **Resource ID**: `d_0d1da54a73733d33e40f662f757af537`
- **Coverage**: 52 epi-weeks, `2023-09` through `2024-08` (an epi-year crossing the calendar boundary, not calendar-year-aligned) — 312 records = 52 weeks × 3 age groups × 2 clinical statuses
- **Fields** (raw API — all values arrive as strings, incl. numeric ones):
  - `epi_year`: `"2023"`
  - `epi_week`: `"2023-09"` (year-week, zero-padded, lexically sortable within a year)
  - `clinical_status`: `"ICU"` | `"Hospitalised"`
  - `age_groups`: `"0 - 11 years old"` | `"12 - 59 years old"` | `"60 years old and above"`
  - `count`: numeric string, e.g. `"1.7"` (average daily count, decimal)
- **API**: `GET https://data.gov.sg/api/action/datastore_search?resource_id=d_0d1da54a73733d33e40f662f757af537&limit=&offset=&filters=`
  - Public; an optional API key raises the rate limit, sent when present (Decisions Log #5). `limit`/`offset` pagination, response has `result.records`, `result.total`, `result._links.next`.
  - Known limitation: 1 year of data (Sep 2023 – Aug 2024), source is MOH via data.gov.sg, no realtime updates.

## Decisions Log

| # | Decision | Choice | Why |
|---|---|---|---|
| 1 | Package manager | pnpm | workspace protocol, faster installs via content-addressable store |
| 2 | Repo structure | pnpm workspaces monorepo | shared types, one install, one lockfile |
| 3 | Frontend test runner | Vitest + RTL | native Vite integration, no extra transform config |
| 4 | Backend test runner | Vitest + Supertest | one test toolchain across the monorepo instead of a Jest/Vitest split |
| 5 | Secrets | Optional `x-api-key` header, app works with no key | data.gov.sg had transient failures during testing (surfaced as our own 502); the key raises its rate limit. Kept in `backend/.env` (gitignored). This legacy endpoint didn't reject an invalid key in testing, so the benefit is unconfirmed but harmless. |
| 6 | Local dev | `pnpm dev` runs FE (Vite) + BE (`tsx watch`) directly, no containers needed |
| 7 | Cache | `node-cache` (in-process, TTL) | small, proven, avoids hand-rolling TTL-map expiry for a single-process local run |
| 8 | Shared types | Emergent, not contract-first | write types inline where first needed; promote into `packages/types` only once a second consumer needs the identical shape — avoids speculative shared shapes |
| 9 | Endpoints | Two only: `GET /api/filters`, `GET /api/records` — no separate `/api/insights` | `insights` is embedded in `/api/records`'s response since it must reflect the full matching set regardless of page; computing it in the same request avoids a second round trip that would redo the same filter step |
| 10 | Cache design | Three caches, one per concern | (a) **Dataset cache**: full raw dataset, fixed key — owned by `/api/filters`, reused by `/api/records` for no-filter insights (already holds what's needed). (b) **Records proxy cache** (`recordsCache.ts`): keyed by exact query (`filters`+`limit`+`offset`+`sort`), pushes filters to data.gov.sg's own `filters` param, serves `items`. (c) **Filtered-insights cache**: keyed by `filters` only — fetches all matching rows, computes insights once, caches the result (not the raw rows). |
| 11 | Transient upstream errors | Basic retry in `fetchPage` (3 attempts, 300ms delay) | one real transient failure observed during testing (succeeded on manual retry); no backoff/jitter since caching already means most requests never reach data.gov.sg live |
| 12 | `/api/records` filter shape | One `filters` query param, a JSON string matching data.gov.sg's own `filters` shape | simpler than a translation layer since it's the same shape already verified upstream. Each field: one value or an array (OR-match). Validated server-side with zod (`.strict()`, known enums, a `YYYY-WW` pattern for `epi_week`) — a different boundary from trusting data.gov.sg's response. `RecordsFilters` shared via `packages/types`. |
| 13 | MUI table component | Plain `@mui/material` Table | pagination/filtering logic already lives in backend + component state; `@mui/x-data-grid`'s features would mostly go unused at this scale (312 rows) |
| 14 | Filter selection state | Redux Toolkit slice (`filtersSlice.ts`), not local `useState` | demonstrates Redux Toolkit slice usage alongside RTK Query (already in use for server state) |
| 15 | Page layout | Full-height flex column (page itself never scrolls); title/filters/insight fixed at top, only the table's rows scroll, pagination always visible | avoids needing to scroll the whole page to reach pagination controls |
| 16 | Table column sorting | Server-side, pushed to data.gov.sg's own `sort` param — not a client-side re-sort of the current page | sort affects which rows land on which page, so sorting only the visible ~100 rows would be wrong across pages. `sort_by` (`epi_year`\|`epi_week`\|`clinical_status`\|`age_groups`\|`count`) + `sort_dir`, included in the cache key; doesn't touch insights (order-independent). `TableSortLabel` on clickable headers — same column toggles direction, different column resets to ascending. Defaults to `epi_year asc`. |
| 17 | Table columns | Added `epi_year` as its own column | previously implied only inside `epi_week`; needed to be independently visible and sortable |
| 18 | Test scope | Deliberately minimal: `calculateInsights` unit tests + a handful of route tests (cache mocked) on the backend; one component render test on the frontend | backend's insights math is the highest-value thing to test and is fully covered; `dataGovClient`'s real behavior was verified manually against the live API throughout. Broader coverage (MSW, filter-interaction tests) would help but is disproportionate effort here. |
| 19 | Lint | One shared root `eslint.config.js` (flat config), `pnpm lint` runs `eslint .` directly | root `package.json` had claimed a `lint` script since Step 0 that was never backed by any config (it failed outright); one shared file is simpler than duplicating config per package, and still applies different rules per path (React rules scoped to `frontend/`) |

---

## Step 0 — Repo init ✅
- [x] `git init`, initial commit
- [x] `pnpm-workspace.yaml` (`frontend`, `backend`, `infra`, `packages/*`)
- [x] `.gitignore`, `.editorconfig`, shared `tsconfig.base.json`
- [x] Root `package.json` workspace scripts: `dev`, `build`, `test`, `lint`

## Step 1 — Shared types ✅
- [x] Decision only (Decisions Log #8): emergent, not contract-first

## Step 2 — Backend scaffold ✅
- [x] `backend/`: TS Node project, `tsx watch` (verified: `/health` responds)
- [x] `.env`/`.env.example` in `backend/` (matches `dotenv`'s cwd-based lookup)
- [x] `src/config/env.ts` — dotenv + zod validation, fails fast on missing/invalid
- [x] `src/app.ts` (`createApp`, no listen) / `src/index.ts` (listen) split for testability
- [x] `src/services`, `src/cache`, `src/insights` folders

## Step 3 — Data integration layer ✅ (verified against live data.gov.sg)
- [x] `dataGovClient.ts`: `fetchPage` (filters, sort, retries ×3), `fetchAllRecords`
- [x] Three caches (Decisions Log #10): `recordsCache.ts`, `insightsDatasetCache.ts`, `filteredInsightsCache.ts`
- [x] `calculateInsights.ts`: average by age group, week-over-week change, peak week, ICU:Hospitalised ratio (omitted when `clinical_status` is the active filter — nothing to compare)
- [x] `GET /api/filters`, `GET /api/records` (Decisions Log #9, #12, #16)
- [x] zod validation on all query params, consistent error shape
- [x] Dataset coverage corrected: 52 weeks, `2023-09`→`2024-08`

## Step 4 — Frontend scaffold ✅ (verified: renders real API data in browser)
- [x] Vite + React + TS, hand-authored (extends shared `tsconfig.base.json`)
- [x] `packages/types` created for real (Decisions Log #8): `RawHealthRecord`, `InsightsSummary`+parts, `RecordsResponseData`, `FiltersResponseData`, `ApiResponse<T>` — backend refactored to import from here too
- [x] `redux/api.ts` — one RTK Query `createApi` (`getFilters`, `getRecords`), baseUrl = backend, not data.gov.sg
- [x] `redux/store.ts`, `main.tsx`, `App.tsx` (placeholder — real UI is Step 5)
- [x] `.env`/`.env.example` (`VITE_API_BASE_URL`)

## Step 5 — State & UI ✅ (verified live via HMR)
- [x] Folder split: `redux/` (store, hooks, api, `filtersSlice`) · `containers/` (`FilterFieldSelect`, `FilterBar` — wired to Redux/data-fetching) · `components/` (`InsightSummary`, `RecordsTable` — pure, props-only)
- [x] `FilterFieldSelect`/`FilterBar`: MUI multi-select checkboxes per field (`clinical_status`, `age_groups`, `epi_week`), values from `/api/filters`, clear-filters button
- [x] `InsightSummary`: renders `/api/records`'s embedded `insights`; omitted fields simply aren't rendered
- [x] `RecordsTable`: paginated MUI Table (page 1 / 100 default), sortable columns (Decisions Log #16), sticky header
- [x] Full-height layout (Decisions Log #15): only table rows scroll
- [x] Loading/error states via RTK Query hooks; resets to page 1 on filter change

## Step 6 — Testing ✅ (Decisions Log #18: deliberately minimal)
- [x] Backend (Vitest + Supertest), 13 tests: `calculateInsights` unit tests, route tests for `/api/records`/`/api/filters`/`/health` (cache layer mocked)
- [x] Frontend (Vitest + RTL), 2 tests: `InsightSummary` render test
- [x] Root `pnpm test` runs both workspaces

## Step 7 — IaC ✅
- [x] `infra/` — AWS CDK (TypeScript) app defining the AWS infrastructure to run this app (VPC, ECS, load balancer, S3, CloudFront); `cdk synth` verified successfully. Not deployed (not required for this project).

## Step 8 — Documentation ✅
- [x] `README.md`: setup (`pnpm install`, env files, `pnpm dev`), architecture diagram (Mermaid), API contract (`/api/filters`, `/api/records`), known limitations
- [x] `ADR.md`: backend proxy (no direct FE→gov API calls), caching, secrets approach
- [x] Worked example in ADR: average-by-age-group calculation logic
