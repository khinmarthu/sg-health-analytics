# SG Health Analytics — Project Plan

**Status**: Steps 0–7 complete and verified. Step 8 (documentation) remaining.

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
  - Public; an optional API key raises the rate limit, sent when present (Decisions Log #6). `limit`/`offset` pagination, response has `result.records`, `result.total`, `result._links.next`.
  - Known limitation: 1 year of data (Sep 2023 – Aug 2024), source is MOH via data.gov.sg, no realtime updates.

## Decisions Log

| # | Decision | Choice | Why |
|---|---|---|---|
| 1 | Package manager | pnpm | workspace protocol, faster installs via content-addressable store |
| 2 | Repo structure | pnpm workspaces monorepo | shared types, one install, one lockfile |
| 3 | AWS compute (IaC) | ECS Fargate | container parity with local Docker |
| 4 | Frontend test runner | Vitest + RTL | native Vite integration, no extra transform config |
| 5 | Backend test runner | Vitest + Supertest | one test toolchain across the monorepo instead of a Jest/Vitest split |
| 6 | Secrets | Optional `x-api-key` header, app works with no key | data.gov.sg had transient failures during testing (surfaced as our own 502); the key raises its rate limit. Local: `backend/.env` (gitignored). CI (not yet built): a GitHub Actions repo secret, not AWS Secrets Manager, since nothing is deployed. Note: this legacy endpoint didn't reject an invalid key in testing, so the benefit is unconfirmed but harmless. |
| 7 | Local dev without Docker | `pnpm dev` runs FE (Vite) + BE (`tsx watch`) directly; Dockerfile exists for Fargate parity but isn't required locally |
| 8 | Cache | `node-cache` (in-process, TTL) | small, proven, avoids hand-rolling TTL-map expiry for a single-process local run |
| 9 | Shared types | Emergent, not contract-first | write types inline where first needed; promote into `packages/types` only once a second consumer needs the identical shape — avoids speculative shared shapes |
| 10 | Endpoints | Two only: `GET /api/filters`, `GET /api/records` — no separate `/api/insights` | `insights` is embedded in `/api/records`'s response since it must reflect the full matching set regardless of page; computing it in the same request avoids a second round trip that would redo the same filter step |
| 11 | Cache design | Three caches, one per concern | (a) **Dataset cache**: full raw dataset, fixed key — owned by `/api/filters`, reused by `/api/records` for no-filter insights (already holds what's needed). (b) **Records proxy cache** (`recordsCache.ts`): keyed by exact query (`filters`+`limit`+`offset`+`sort`), pushes filters to data.gov.sg's own `filters` param, serves `items`. (c) **Filtered-insights cache**: keyed by `filters` only — fetches all matching rows, computes insights once, caches the result (not the raw rows). |
| 12 | Transient upstream errors | Basic retry in `fetchPage` (3 attempts, 300ms delay) | one real transient failure observed during testing (succeeded on manual retry); no backoff/jitter since caching already means most requests never reach data.gov.sg live |
| 13 | `/api/records` filter shape | One `filters` query param, a JSON string matching data.gov.sg's own `filters` shape | simpler than a translation layer since it's the same shape already verified upstream. Each field: one value or an array (OR-match). Validated server-side with zod (`.strict()`, known enums, a `YYYY-WW` pattern for `epi_week`) — a different boundary from trusting data.gov.sg's response. `RecordsFilters` shared via `packages/types`. |
| 14 | MUI table component | Plain `@mui/material` Table | pagination/filtering logic already lives in backend + component state; `@mui/x-data-grid`'s features would mostly go unused at this scale (312 rows) |
| 15 | Filter selection state | Redux Toolkit slice (`filtersSlice.ts`), not local `useState` | demonstrates Redux Toolkit slice usage alongside RTK Query (already in use for server state) |
| 16 | Page layout | Full-height flex column (page itself never scrolls); title/filters/insight fixed at top, only the table's rows scroll, pagination always visible | avoids needing to scroll the whole page to reach pagination controls |
| 17 | Table column sorting | Server-side, pushed to data.gov.sg's own `sort` param — not a client-side re-sort of the current page | sort affects which rows land on which page, so sorting only the visible ~100 rows would be wrong across pages. `sort_by` (`epi_year`\|`epi_week`\|`clinical_status`\|`age_groups`\|`count`) + `sort_dir`, included in the cache key; doesn't touch insights (order-independent). `TableSortLabel` on clickable headers — same column toggles direction, different column resets to ascending. Defaults to `epi_year asc`. |
| 18 | Table columns | Added `epi_year` as its own column | previously implied only inside `epi_week`; needed to be independently visible and sortable |
| 19 | Test scope | Deliberately minimal: `calculateInsights` unit tests + a handful of route tests (cache mocked) on the backend; one component render test on the frontend | backend's insights math is the highest-value thing to test and is fully covered; `dataGovClient`'s real behavior was verified manually against the live API throughout. Broader coverage (MSW, filter-interaction tests) would help but is disproportionate effort here. |
| 20 | CDK stack structure | One Stack, composed of two Constructs (`BackendConstruct`, `FrontendConstruct`) | nothing here needs an independent deployment lifecycle — that's the only reason to split into separate Stacks, and this project doesn't deploy at all |
| 21 | ECS pattern | `aws-ecs-patterns`' `ApplicationLoadBalancedFargateService` instead of manually wiring Cluster/Service/TaskDefinition/ALB/Listener/TargetGroup | the official high-level construct for exactly this shape — far less code, still fully inspectable |
| 22 | Docker build context | Monorepo root, not `backend/` alone, with a root `.dockerignore` | `backend` depends on the workspace package `@sg-health/types`, invisible from a `backend/`-only context. `.dockerignore` also fixed a real bug: without it, CDK's asset-staging recursed into its own `infra/cdk.out` (which lives inside the root being copied), hitting `ENAMETOOLONG`. |
| 23 | pnpm workspace + Docker | `pnpm deploy --prod` in the Dockerfile, not a plain copy of `backend/node_modules` | pnpm links sibling workspace packages as symlinks into its store; copying `node_modules` alone would carry broken symlinks into the runtime image. `pnpm deploy` resolves them into a self-contained, real-files-only folder. |
| 24 | Lint | One shared root `eslint.config.js` (flat config), `pnpm lint` runs `eslint .` directly | root `package.json` had claimed a `lint` script since Step 0 that was never backed by any config (it failed outright); one shared file is simpler than duplicating config per package, and still applies different rules per path (React rules scoped to `frontend/`) |

---

## Step 0 — Repo init ✅
- `git init`, initial commit
- `pnpm-workspace.yaml` (`frontend`, `backend`, `infra`, `packages/*`)
- `.gitignore`, `.editorconfig`, shared `tsconfig.base.json`
- Root `package.json` workspace scripts: `dev`, `build`, `test`, `lint`

## Step 1 — Shared types ✅
- Decision only (Decisions Log #9): emergent, not contract-first

## Step 2 — Backend scaffold ✅
- `backend/`: TS Node project, `tsx watch` (verified: `/health` responds)
- `.env`/`.env.example` in `backend/` (matches `dotenv`'s cwd-based lookup)
- `src/config/env.ts` — dotenv + zod validation, fails fast on missing/invalid
- `src/app.ts` (`createApp`, no listen) / `src/index.ts` (listen) split for testability
- `src/services`, `src/cache`, `src/insights` folders
- `Dockerfile` (multi-stage, monorepo-root build context — see Step 7)

## Step 3 — Data integration layer ✅ (verified against live data.gov.sg)
- `dataGovClient.ts`: `fetchPage` (filters, sort, retries ×3), `fetchAllRecords`
- Three caches (Decisions Log #11): `recordsCache.ts`, `insightsDatasetCache.ts`, `filteredInsightsCache.ts`
- `calculateInsights.ts`: average by age group, week-over-week change, peak week, ICU:Hospitalised ratio (omitted when `clinical_status` is the active filter — nothing to compare)
- `GET /api/filters`, `GET /api/records` (Decisions Log #10, #13, #17)
- zod validation on all query params, consistent error shape
- Dataset coverage corrected: 52 weeks, `2023-09`→`2024-08`

## Step 4 — Frontend scaffold ✅ (verified: renders real API data in browser)
- Vite + React + TS, hand-authored (extends shared `tsconfig.base.json`)
- `packages/types` created for real (Decisions Log #9): `RawHealthRecord`, `InsightsSummary`+parts, `RecordsResponseData`, `FiltersResponseData`, `ApiResponse<T>` — backend refactored to import from here too
- `redux/api.ts` — one RTK Query `createApi` (`getFilters`, `getRecords`), baseUrl = backend, not data.gov.sg
- `redux/store.ts`, `main.tsx`, `App.tsx` (placeholder — real UI is Step 5)
- `.env`/`.env.example` (`VITE_API_BASE_URL`)

## Step 5 — State & UI ✅ (verified live via HMR)
- Folder split: `redux/` (store, hooks, api, `filtersSlice`) · `containers/` (`FilterFieldSelect`, `FilterBar` — wired to Redux/data-fetching) · `components/` (`InsightSummary`, `RecordsTable` — pure, props-only)
- `FilterFieldSelect`/`FilterBar`: MUI multi-select checkboxes per field (`clinical_status`, `age_groups`, `epi_week`), values from `/api/filters`, clear-filters button
- `InsightSummary`: renders `/api/records`'s embedded `insights`; omitted fields simply aren't rendered
- `RecordsTable`: paginated MUI Table (page 1 / 100 default), sortable columns (Decisions Log #17), sticky header
- Full-height layout (Decisions Log #16): only table rows scroll
- Loading/error states via RTK Query hooks; resets to page 1 on filter change

## Step 6 — Testing ✅ (Decisions Log #19: deliberately minimal)
- Backend (Vitest + Supertest), 13 tests: `calculateInsights` unit tests, route tests for `/api/records`/`/api/filters`/`/health` (cache layer mocked)
- Frontend (Vitest + RTL), 2 tests: `InsightSummary` render test
- Root `pnpm test` runs both workspaces

## Step 7 — IaC (AWS CDK, TypeScript) ✅ (`cdk synth` verified: exit 0, full CloudFormation template)
- `infra/`: `bin/app.ts` → `SgHealthAnalyticsStack` → `BackendConstruct` + `FrontendConstruct` (Decisions Log #20)
- `BackendConstruct`: VPC (2 AZs, 1 NAT gateway) + ECS Cluster + `ApplicationLoadBalancedFargateService` (Decisions Log #21)
- `FrontendConstruct`: private S3 bucket (Origin Access Control) + CloudFront distribution
- `backend/Dockerfile`: monorepo-root build context, `pnpm deploy` (Decisions Log #22, #23)
- `RESOURCE_ID`/`CACHE_TTL_SECONDS` via CDK context (`cdk.json`); `DATA_GOV_API_KEY` referenced from Secrets Manager by name, not created in CDK (Decisions Log #6)

## Step 8 — Documentation
- [ ] `README.md`: setup (`pnpm install`, env files, `pnpm dev`), architecture diagram (Mermaid), API contract (`/api/filters`, `/api/records`), known limitations
- [ ] `ADR.md`: backend proxy (no direct FE→gov API calls), caching, Fargate over Lambda, secrets approach
- [ ] Worked example in ADR: average-by-age-group calculation logic
