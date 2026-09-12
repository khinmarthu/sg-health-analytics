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
| 1 | Package manager | pnpm | user preference |
| 2 | Repo structure | pnpm workspaces monorepo | shared types, one install, one lockfile |
| 3 | AWS compute (IaC) | ECS Fargate | container parity with local Docker, user's choice |
| 4 | Frontend test runner | Vitest + RTL | native Vite integration, no extra transform config |
| 5 | Backend test runner | Vitest + Supertest | one test toolchain across the monorepo instead of Jest+Vitest split |
| 6 | Secrets | data.gov.sg API key exists but is optional (only raises rate limits; not required for correctness). Skipped entirely — not worth the complexity for a cached, ~384-row dataset. `.env` holds non-secret config only (`RESOURCE_ID`, `DATA_GOV_BASE_URL`, `PORT`, `CACHE_TTL_SECONDS`). `.env` is gitignored, `.env.example` is committed. If a keyed source is ever added later, key goes in AWS Secrets Manager / SSM Parameter Store (referenced, not hardcoded, in CDK) — documented in ADR. |
| 7 | Local dev without Docker | `pnpm dev` runs FE (Vite) + BE (tsx/ts-node-dev) directly; Dockerfile exists for Fargate parity/testing but isn't required to run locally |
| 8 | Cache | `node-cache` library (in-process, TTL) | proven, small, avoids hand-rolling/testing our own TTL-map expiry logic; fine for single-process local run |
| 9 | Shared types | Emergent, not contract-first | write types inline where first needed (backend); promote a type into `packages/types` only once a second consumer (frontend, or a test) needs the identical shape — avoids speculative/wrong-guessed shared shapes |
| 10 | Endpoints | Two only: `GET /api/filters`, `GET /api/records` (no separate `/api/insights` — folded into `/api/records`'s response) | `/api/records` response includes an `insights` field alongside `items`, since insights must reflect the full matching set regardless of page — computing it as part of the same request avoids a second round trip that would just redo the same filter step. |
| 11 | Cache design | Three separate caches, one per concern | (a) **Dataset cache**: full raw dataset, fixed key, owned by `/api/filters` (computes unique field values) — also reused directly by `/api/records` to compute insights when *no* filter is selected (no-filter insights = full-dataset aggregation, already held here, no extra fetch). (b) **Records proxy cache** (`recordsCache.ts`, unchanged): keyed by exact query (`filters`+`limit`+`offset`), pushes filters to data.gov.sg's own `filters` param, serves `items`. (c) **Filtered-insights cache** (new): keyed by `filters` only (no pagination) — populated only when a filter is passed; fetches *all* matching rows (own internal pagination loop against data.gov.sg), computes insights once, caches the computed insight object (not the raw rows) under that key. |
| 12 | Transient upstream errors | Basic retry in `fetchPage` (3 attempts, 300ms delay) | Observed one real transient failure from data.gov.sg during testing (succeeded on manual retry). Kept minimal — no backoff/jitter — since caching already means most requests never reach data.gov.sg live anyway; this only matters on a cache miss. |

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
- [x] `.env` / `.env.example` moved into `backend/` (matches `dotenv`'s cwd-based lookup, avoids path hacks — see chat)
- [x] `src/config/env.ts` — load with dotenv, validate with zod, fail fast on missing/invalid
- [x] `GET /health` route, `src/app.ts` (createApp, no listen) / `src/index.ts` (listen) split for testability
- [ ] Folders still to add: `src/services` (data.gov.sg client), `src/cache`, `src/insights` — Step 3
- [ ] `Dockerfile` (multi-stage, for Fargate parity — not required for local run)

## Step 3 — Data integration layer ✅ (all verified against live data.gov.sg)
- [x] `DataGovClient` (`services/dataGovClient.ts`): `fetchPage` (single page, optional exact-match `filters`, retries up to 3x on transient failure), `fetchAllRecords(filters?)` (loops until `total` reached)
- [x] `recordsCache.ts` — per-query proxy cache (Cache b)
- [x] `insightsDatasetCache.ts` — full-dataset cache (Cache a), shared by `/api/filters` and no-filter insights
- [x] `filteredInsightsCache.ts` — Cache (c): keyed by `filters` only, stores the computed insight object
- [x] `insights/calculateInsights.ts`: average by age group, week-over-week % change, peak week, ICU:Hospitalised ratio — ICU:Hospitalised ratio omitted from the response when `clinical_status` is the active filter (decided: degenerate, nothing to compare)
- [x] `GET /api/filters` — unique values per filterable field (`clinical_status`, `age_groups`, `epi_week`), from Cache (a), no request payload
- [x] `GET /api/records` — `{ items, total, limit, offset, insights }`: `items`/pagination from Cache (b); `insights` from Cache (a) when no filter, else Cache (c)
- [x] Input validation (zod) on all query params; consistent error shape
- [x] Dataset coverage corrected: 52 epi-weeks `2023-09`→`2024-08` (not calendar-year 2023 — see Dataset section above)

## Step 4 — Frontend scaffold ✅ (verified: renders real /api/filters + /api/records data in browser)
- [x] Vite + React + TS in `frontend/`, hand-authored (extends shared `tsconfig.base.json`, matches `backend/` conventions)
- [x] `packages/types` created for real (promoted from backend once frontend needed the identical shapes — see Decisions Log #9): `RawHealthRecord`, `InsightsSummary` + parts, `RecordsResponseData`, `FiltersResponseData`, `ApiResponse<T>`. Backend refactored to import from here too (single source of truth).
- [x] `src/app/api.ts` — one RTK Query `createApi` (standard pattern: one slice per backend, not per feature) with `getFilters`/`getRecords`, baseUrl = backend (**not** data.gov.sg directly)
- [x] `src/app/store.ts`, `src/main.tsx`, `src/App.tsx` (placeholder — real UI is Step 5)
- [x] `.env` / `.env.example` for FE (`VITE_API_BASE_URL`) — only `VITE_`-prefixed vars reach client code, by Vite's own design
- [ ] Folders `src/features/*`, `src/components/*` — not created yet, deferred to Step 5 when real components exist (no `features/insights` — insights is embedded in the records feature's response, not a separate concern)

## Step 5 — State & UI
- [ ] Filter state: multi-select checkboxes per field, values from `/api/filters`
- [ ] Insight summary display, between filters and table, from `/api/records`'s embedded `insights` field
- [ ] Table (paginated, page 1 / 100 per page by default) for `/api/records`'s `items`
- [ ] Charts: deferred, not building for now
- [ ] Loading/error/empty states via RTK Query hooks
- [ ] MUI (`@mui/material`) for components — confirmed no compatibility issues with Vite/React/TS; specific table component (plain `Table` vs `@mui/x-data-grid`) to be decided when we build this step

## Step 6 — Testing
- [ ] Backend (Vitest + Supertest): `DataGovClient` unit tests (mocked HTTP), insights calculation tests (known input → expected output), route integration tests
- [ ] Frontend (Vitest + RTL + MSW): filter interaction tests, RTK Query mocked via MSW, chart/table render tests
- [ ] Coverage script at root (`pnpm test`, runs both workspaces)

## Step 7 — IaC (AWS CDK, TypeScript)
- [ ] `infra/` CDK app
- [ ] VPC (small, 1 AZ or 2 for realism) + ECS Cluster + Fargate Service + ALB — backend
- [ ] S3 + CloudFront — frontend static hosting
- [ ] `cdk synth` succeeds (no deploy)
- [ ] Parameterize dataset ID / cache TTL via CDK context or SSM (not hardcoded)

## Step 8 — Documentation
- [ ] `README.md`: setup (pnpm install, env files, `pnpm dev`), architecture diagram (Mermaid), API contract (`/api/records`, `/api/insights`), known limitations
- [ ] `ADR.md`: backend proxy (no direct FE→gov API calls, security + caching), why caching, why Fargate over Lambda, why no secrets manager yet
- [ ] Worked example in ADR: average-age-group calculation logic (business logic lives in backend `src/insights`, not FE)

---

## Working agreement
We go step by step; I implement, explain what/why briefly, you review before moving to the next step. Checkboxes above get ticked as we complete them.
