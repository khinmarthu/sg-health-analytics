# SG Health Analytics — Project Plan

## Dataset

- **Title**: Average daily hospitalised / ICU cases by Epi-week
- **Resource ID**: `d_0d1da54a73733d33e40f662f757af537`
- **Coverage**: Epi-week data, Jan 2023 – Jan 2024 (last updated 2024-06-06)
- **Fields**: `epi_year`, `epi_week`, `clinical_status` (`ICU` | `Hospitalised`), `age_group` (3 buckets: 0–11, 12–59, 60+), `count`
- **API**: `GET https://data.gov.sg/api/action/datastore_search?resource_id=d_0d1da54a73733d33e40f662f757af537&limit=&offset=&filters=`
  - Public, **no API key required**. `limit`/`offset` pagination, response has `result.records`, `result.total`, `result._links.next`.
  - Known limitation to document: ~1 year of data, source is MOH via data.gov.sg, no realtime updates.

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

---

## Step 0 — Repo init
- [ ] `git init`, initial commit baseline
- [ ] Root `pnpm-workspace.yaml` (`frontend`, `backend`, `infra`, `packages/*`)
- [ ] Root `.gitignore` (node_modules, dist, .env, cdk.out, coverage)
- [ ] Root `.editorconfig` + shared `tsconfig.base.json`
- [ ] Root `package.json` with workspace-wide scripts (`dev`, `build`, `test`, `lint`)

## Step 1 — Shared types package
- [ ] `packages/types`: `HealthRecord`, `ClinicalStatus`, `AgeGroup`, `InsightsSummary`, API response envelopes
- [ ] Exported via `packages/types/src/index.ts`, consumed by both FE and BE via workspace `link:` dependency

## Step 2 — Backend scaffold
- [ ] `backend/`: TS Node project, `tsconfig.json`, `tsx watch` for dev
- [ ] Folders: `src/routes`, `src/services` (data.gov.sg client), `src/cache`, `src/insights`, `src/config`
- [ ] `.env.example` (`DATASET_ID`, `API_BASE_URL=https://data.gov.sg/api/action`, `PORT`, `CACHE_TTL_SECONDS`)
- [ ] `src/config/env.ts` — load with dotenv, validate with zod, fail fast on missing/invalid
- [ ] `GET /health` route
- [ ] `Dockerfile` (multi-stage, for Fargate parity — not required for local run)

## Step 3 — Data integration layer
- [ ] `DataGovClient`: wraps `datastore_search`, handles pagination (loop until `total` records fetched), typed response parsing
- [ ] `node-cache` wrapper in `src/cache`: TTL from `CACHE_TTL_SECONDS`, key = query params hash, avoids re-hitting data.gov.sg per FE request
- [ ] `GET /api/records` — paginated/filtered (epi_week range, clinical_status, age_group) proxy over cached raw data
- [ ] `GET /api/insights` — precomputed aggregates:
  - average count by age group
  - week-over-week % change (latest vs prior epi-week)
  - peak epi-week (highest total count)
  - ICU-to-Hospitalised ratio (overall + by age group)
- [ ] Input validation (zod) on all query params; consistent error shape

## Step 4 — Frontend scaffold
- [ ] Vite + React + TS in `frontend/`
- [ ] Folders: `src/features/records`, `src/features/insights`, `src/components` (filters, table, charts), `src/app/store.ts`
- [ ] RTK Query `createApi` (baseUrl = backend, **not** data.gov.sg directly)
- [ ] `.env.example` for FE (`VITE_API_BASE_URL`)

## Step 5 — State & UI
- [ ] Redux slice: filter state (epi-week range, clinical_status, age_group)
- [ ] `FilterBar` component wired to slice + triggers RTK Query refetch
- [ ] `DataTable` (paginated) for `/api/records`
- [ ] Charts (Recharts): line chart weekly trend, bar chart age-group comparison, driven by `/api/insights`
- [ ] Loading/error/empty states via RTK Query hooks

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
