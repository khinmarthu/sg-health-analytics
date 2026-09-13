# SG Health Analytics — Project Plan

## Dataset

- **Title**: Average daily hospitalised / ICU cases by Epi-week
- **Resource ID**: `d_0d1da54a73733d33e40f662f757af537`
- **Coverage**: 52 epi-weeks, `2023-09` through `2024-08` (an epi-year crossing the calendar boundary, not calendar-year-aligned — verified via real data, not assumed) — 312 records = 52 weeks × 3 age groups × 2 clinical statuses
- **Fields** (raw API — all values arrive as strings, incl. numeric ones):
  - `epi_year`: `"2023"`
  - `epi_week`: `"2023-09"` (year-week, zero-padded, lexically sortable within a year)
  - `clinical_status`: `"ICU"` | `"Hospitalised"`
  - `age_groups`: `"0 - 11 years old"` | `"12 - 59 years old"` | `"60 years old and above"`
  - `count`: numeric string, e.g. `"1.7"` (average daily count, decimal)
- **API**: `GET https://data.gov.sg/api/action/datastore_search?resource_id=d_0d1da54a73733d33e40f662f757af537&limit=&offset=&filters=`
  - Public, **no API key required** (optional key only raises rate limits — skipped, see Decisions Log #6). `limit`/`offset` pagination, response has `result.records`, `result.total`, `result._links.next`.
  - Known limitation to document: 1 year of data (2023 only), source is MOH via data.gov.sg, no realtime updates.

## Decisions Log

| # | Decision | Choice | Why |
|---|---|---|---|
| 1 | Package manager | pnpm | workspace protocol, faster installs via content-addressable store |
| 2 | Repo structure | pnpm workspaces monorepo | shared types, one install, one lockfile |
| 3 | AWS compute (IaC) | ECS Fargate | container parity with local Docker |
| 4 | Frontend test runner | Vitest + RTL | native Vite integration, no extra transform config |
| 5 | Backend test runner | Vitest + Supertest | one test toolchain across the monorepo instead of Jest+Vitest split |
| 6 | Secrets | API key sent as optional `x-api-key` header (app works with no key — `dataGovApiKey` is `undefined`-safe throughout) | data.gov.sg returned transient failures during testing (surfaced to the frontend as our own 502 wrapper); the key raises data.gov.sg's rate-limit ceiling. Locally: `backend/.env` (gitignored, real value present; `.env.example` has a blank placeholder). In CI (not yet built): a GitHub Actions repository secret, not AWS Secrets Manager — no infrastructure is deployed yet (Step 7 IaC is `cdk synth`-only), so nothing running would need to read it at runtime. Note: this legacy `datastore_search` endpoint doesn't appear to reject invalid keys (tested), so the rate-limit benefit couldn't be positively confirmed — kept anyway since it's harmless. |
| 7 | Local dev without Docker | `pnpm dev` runs FE (Vite) + BE (tsx/ts-node-dev) directly; Dockerfile exists for Fargate parity/testing but isn't required to run locally |
| 8 | Cache | `node-cache` library (in-process, TTL) | proven, small, avoids hand-rolling/testing our own TTL-map expiry logic; fine for single-process local run |
| 9 | Shared types | Emergent, not contract-first | write types inline where first needed (backend); promote a type into `packages/types` only once a second consumer (frontend, or a test) needs the identical shape — avoids speculative/wrong-guessed shared shapes |
| 10 | Endpoints | Two only: `GET /api/filters`, `GET /api/records` (no separate `/api/insights` — folded into `/api/records`'s response) | `/api/records` response includes an `insights` field alongside `items`, since insights must reflect the full matching set regardless of page — computing it as part of the same request avoids a second round trip that would just redo the same filter step. |
| 11 | Cache design | Three separate caches, one per concern | (a) **Dataset cache**: full raw dataset, fixed key, owned by `/api/filters` (computes unique field values) — also reused directly by `/api/records` to compute insights when *no* filter is selected (no-filter insights = full-dataset aggregation, already held here, no extra fetch). (b) **Records proxy cache** (`recordsCache.ts`, unchanged): keyed by exact query (`filters`+`limit`+`offset`), pushes filters to data.gov.sg's own `filters` param, serves `items`. (c) **Filtered-insights cache** (new): keyed by `filters` only (no pagination) — populated only when a filter is passed; fetches *all* matching rows (own internal pagination loop against data.gov.sg), computes insights once, caches the computed insight object (not the raw rows) under that key. |
| 12 | Transient upstream errors | Basic retry in `fetchPage` (3 attempts, 300ms delay) | Observed one real transient failure from data.gov.sg during testing (succeeded on manual retry). Kept minimal — no backoff/jitter — since caching already means most requests never reach data.gov.sg live anyway; this only matters on a cache miss. |
| 13 | `/api/records` filter query shape | One `filters` query param, a JSON string matching the exact shape data.gov.sg's own `filters` accepts (`{"clinical_status":"ICU","age_groups":[...]}`) — not our own separate-param-per-field convention | Simpler than a translation layer since it's the same shape already verified to work upstream. Each field accepts one value or an array (OR-match). Validated server-side with zod (`.strict()`, known enums for `clinical_status`/`age_groups`, a `YYYY-WW` pattern for `epi_week`) — this is validating *our* API's input, a different boundary from trusting data.gov.sg's response. `RecordsFilters` type added to `packages/types` since both FE and BE construct/consume this exact shape. |
| 14 | MUI table component | Plain `@mui/material` Table | Pagination/filtering logic already lives in backend + component state; `@mui/x-data-grid`'s built-in features would mostly go unused at this scale (312 rows) |
| 15 | Filter selection state | Redux Toolkit slice (`filtersSlice.ts`), not local `useState` | Matches original plan; demonstrates Redux Toolkit slice usage alongside RTK Query (already in use for server state) |
| 16 | Page layout | Full-height flex column (`html`/`body`/`#root` at 100%, page itself never scrolls) — title/filters/insight fixed at top, only the table's rows scroll internally, pagination always visible | Avoids needing to scroll the whole page to reach pagination controls |
| 17 | Table column sorting | Server-side, pushed to data.gov.sg's own `sort` param (verified: `"count desc"` and `"epi_year asc"` syntax, works standalone and combined with `filters`) — not client-side re-sort of the current page | Sort affects which rows land on which page, so client-side sorting the visible ~100 rows would be incorrect/incomplete across pages. `/api/records` gains `sort_by` (enum: `epi_year`\|`epi_week`\|`clinical_status`\|`age_groups`\|`count`) + `sort_dir` (`asc`\|`desc`); included in `recordsCache.ts`'s cache key. Doesn't touch insights (aggregation is order-independent). MUI `TableSortLabel` on clickable headers; click same column toggles direction, different column resets to ascending. Defaults to `epi_year asc` on load (was unsorted). |
| 18 | Table columns | Added `epi_year` as its own column (was previously omitted as redundant with `epi_week`, which already encodes the year) | Visible and sortable on its own, not just implied inside `epi_week` |
| 19 | Test scope | Deliberately minimal: `calculateInsights` unit tests + a handful of route tests (cache layer mocked) on the backend; one component render test on the frontend. No MSW, no `DataGovClient`-level HTTP mocking, no chart tests (no charts exist) | Backend's real business logic (the insights math) is the highest-value thing to test and is fully covered; `dataGovClient`'s actual behavior was already verified manually against the live API throughout development. Broader coverage (MSW-mocked RTK Query, filter-interaction tests, etc.) would add real value but also real effort disproportionate to this project's scope. |
| 20 | CDK stack structure | One Stack, composed of two Constructs (`BackendConstruct`, `FrontendConstruct`) rather than two separate Stacks | Nothing here needs independent deployment lifecycles; splitting into Stacks matters when pieces are deployed/torn down separately, which doesn't apply since this project doesn't deploy at all |
| 21 | ECS pattern | `aws-ecs-patterns`' `ApplicationLoadBalancedFargateService` instead of manually wiring Cluster + Service + TaskDefinition + ALB + Listener + TargetGroup individually | The official high-level construct for exactly this shape (one load-balanced Fargate service) — far less code, still fully inspectable, not a black box |
| 22 | Docker build context | Monorepo root, not `backend/` alone, with a root `.dockerignore` (excludes `node_modules`, `**/dist`, `infra/cdk.out`, `.git`) | `backend` depends on the workspace package `@sg-health/types`; a `backend/`-only build context can't see it. The `.dockerignore` also fixes a real bug hit during this build: without it, CDK's asset-staging copy recursed into its own `infra/cdk.out` output directory (which lives inside the root being copied), hitting `ENAMETOOLONG` from the resulting infinite nesting. |
| 23 | pnpm workspace + Docker | `pnpm deploy --prod` in the Dockerfile's build stage, not a plain copy of `backend/node_modules` | pnpm workspaces link sibling packages (like `@sg-health/types`) as symlinks into the pnpm store; copying `node_modules` alone into the runtime stage would carry broken symlinks. `pnpm deploy` resolves them into a self-contained, real-files-only folder. |

---

## Step 0 — Repo init
- [x] `git init`, initial commit baseline
- [x] Root `pnpm-workspace.yaml` (`frontend`, `backend`, `infra`, `packages/*`)
- [x] Root `.gitignore` (node_modules, dist, .env, cdk.out, coverage)
- [x] Root `.editorconfig` + shared `tsconfig.base.json`
- [x] Root `package.json` with workspace-wide scripts (`dev`, `build`, `test`, `lint`)

## Step 1 — Shared types (emergent, deferred)
- [x] Decision made: no upfront contract package. Types are written inline where first needed (backend, Step 2/3) and only promoted into `packages/types/src/index.ts` (type-only, no build — see Decisions Log #9) once frontend or a test needs the identical shape. Revisit this checklist item at that point.

## Step 2 — Backend scaffold
- [x] `backend/`: TS Node project, `tsconfig.json`, `tsx watch` for dev (verified: server starts, `/health` responds)
- [x] `.env` / `.env.example` moved into `backend/` (matches `dotenv`'s cwd-based lookup, avoids path hacks)
- [x] `src/config/env.ts` — load with dotenv, validate with zod, fail fast on missing/invalid
- [x] `GET /health` route, `src/app.ts` (createApp, no listen) / `src/index.ts` (listen) split for testability
- [x] Folders `src/services`, `src/cache`, `src/insights`
- [x] `Dockerfile` (multi-stage; build context is the monorepo root, not required for local run — see Step 7)

## Step 3 — Data integration layer ✅ (all verified against live data.gov.sg)
- [x] `DataGovClient` (`services/dataGovClient.ts`): `fetchPage` (single page, optional exact-match `filters`, retries up to 3x on transient failure), `fetchAllRecords(filters?)` (loops until `total` reached)
- [x] `recordsCache.ts` — per-query proxy cache (Cache b)
- [x] `insightsDatasetCache.ts` — full-dataset cache (Cache a), shared by `/api/filters` and no-filter insights
- [x] `filteredInsightsCache.ts` — Cache (c): keyed by `filters` only, stores the computed insight object
- [x] `insights/calculateInsights.ts`: average by age group, week-over-week % change, peak week, ICU:Hospitalised ratio — ICU:Hospitalised ratio omitted from the response when `clinical_status` is the active filter (decided: degenerate, nothing to compare)
- [x] `GET /api/filters` — unique values per filterable field (`clinical_status`, `age_groups`, `epi_week`), from Cache (a), no request payload
- [x] `GET /api/records` — `{ items, total, limit, offset, insights }`: `items`/pagination from Cache (b); `insights` from Cache (a) when no filter, else Cache (c); optional `sort_by`/`sort_dir` pushed to data.gov.sg's own `sort` param (Decisions Log #17)
- [x] Input validation (zod) on all query params; consistent error shape
- [x] Dataset coverage corrected: 52 epi-weeks `2023-09`→`2024-08` (not calendar-year 2023 — see Dataset section above)

## Step 4 — Frontend scaffold ✅ (verified: renders real /api/filters + /api/records data in browser)
- [x] Vite + React + TS in `frontend/`, hand-authored (extends shared `tsconfig.base.json`, matches `backend/` conventions)
- [x] `packages/types` created for real (promoted from backend once frontend needed the identical shapes — see Decisions Log #9): `RawHealthRecord`, `InsightsSummary` + parts, `RecordsResponseData`, `FiltersResponseData`, `ApiResponse<T>`. Backend refactored to import from here too (single source of truth).
- [x] `redux/api.ts` — one RTK Query `createApi` (standard pattern: one slice per backend, not per feature) with `getFilters`/`getRecords`, baseUrl = backend (**not** data.gov.sg directly)
- [x] `redux/store.ts`, `main.tsx`, `App.tsx` (placeholder — real UI is Step 5)
- [x] `.env` / `.env.example` for FE (`VITE_API_BASE_URL`) — only `VITE_`-prefixed vars reach client code, by Vite's own design

## Step 5 — State & UI ✅ (verified live via HMR)
- [x] Folder split (container/presentational convention):
  - `redux/` — all Redux/RTK Query wiring: `store.ts`, `hooks.ts` (typed `useAppDispatch`/`useAppSelector`), `api.ts` (RTK Query), `filtersSlice.ts` (+ `selectRecordsFilters`, builds the `RecordsFilters` object for the API call)
  - `containers/` — components wired to Redux/data-fetching: `FilterFieldSelect.tsx`, `FilterBar.tsx`
  - `components/` — pure, props-only, no Redux/API calls: `InsightSummary.tsx`, `RecordsTable.tsx`
- [x] `FilterFieldSelect.tsx` — one reusable MUI `<Select multiple>` w/ checkboxes; `FilterBar.tsx` — one per filterable field (`clinical_status`, `age_groups`, `epi_week`), values from `/api/filters`, + a clear-filters button
- [x] `InsightSummary.tsx` — renders `/api/records`'s embedded `insights`; fields the backend omits (see Step 3's `calculateInsights` note on the ICU:Hospitalised ratio) are simply not rendered, not shown as null/zero
- [x] `RecordsTable.tsx` — paginated MUI `Table` (page 1 / 100 per page default), backend-driven pagination (offset/limit), sticky table header
- [x] Column sorting: clickable headers (`TableSortLabel`), server-side via `sort_by`/`sort_dir` (Decisions Log #17), sort state lives in `App.tsx` alongside pagination state
- [x] Charts: still deferred, not building
- [x] Loading/error states via RTK Query hooks (`isLoading`, `error`)
- [x] MUI: plain `@mui/material` Table (Decisions Log #14)
- [x] Full-height layout: only table rows scroll, header + pagination always visible (Decisions Log #16) — `index.css` reset, `App.tsx`/`RecordsTable.tsx` flex layout
- [x] `App.tsx` resets to page 1 whenever the filter selection changes

## Step 6 — Testing ✅ (kept deliberately minimal — see Decisions Log #19)
- [x] Backend (Vitest + Supertest), 13 tests: `calculateInsights` unit tests (7 — averages, week-over-week, peak week, ICU:Hospitalised ratio incl. both omission cases), route tests for `/api/records`/`/api/filters`/`/health` (6 — cache layer mocked, not `fetch`/the real API)
- [x] Frontend (Vitest + RTL), 2 tests: `InsightSummary` render test — all metrics present, and an omitted metric correctly absent
- [x] Root `pnpm test` runs both workspaces

## Step 7 — IaC (AWS CDK, TypeScript) ✅ (cdk synth verified: exit 0, full CloudFormation template generated)
- [x] `infra/` CDK app: `bin/app.ts` (entry point) → `SgHealthAnalyticsStack` → `BackendConstruct` + `FrontendConstruct`
- [x] `BackendConstruct`: VPC (2 AZs, 1 NAT gateway) + ECS Cluster + `ApplicationLoadBalancedFargateService` (bundles Fargate Service + Task Definition + ALB + Listener + Target Group) — backend
- [x] `FrontendConstruct`: private S3 bucket (Origin Access Control, no public access) + CloudFront distribution — frontend static hosting
- [x] `backend/Dockerfile` (multi-stage; build context is the monorepo root via `.dockerignore`, so the workspace package `@sg-health/types` is visible; `pnpm deploy` resolves workspace symlinks into a self-contained runtime image)
- [x] `cdk synth` succeeds standalone: resource counts match expectations (VPC/subnets/NAT, ECS, ALB, IAM, S3, CloudFront), container image resolves to a CloudFormation `Fn::Sub` ECR reference (built only at real `cdk deploy` time, which this project doesn't do)
- [x] `RESOURCE_ID`/`CACHE_TTL_SECONDS` parameterized via CDK context (`cdk.json`), not hardcoded; `DATA_GOV_API_KEY` referenced from Secrets Manager by name (not created/stored in CDK — see Decisions Log #6)

## Step 8 — Documentation
- [ ] `README.md`: setup (pnpm install, env files, `pnpm dev`), architecture diagram (Mermaid), API contract (`/api/filters`, `/api/records`), known limitations
- [ ] `ADR.md`: backend proxy (no direct FE→gov API calls, security + caching), why caching, why Fargate over Lambda, why no secrets manager yet
- [ ] Worked example in ADR: average-age-group calculation logic (business logic lives in backend `src/insights`, not FE)

---

## Working agreement
We go step by step; I implement, explain what/why briefly, you review before moving to the next step. Checkboxes above get ticked as we complete them.
