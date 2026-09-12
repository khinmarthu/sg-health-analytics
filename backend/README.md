# Backend

## Scripts

- `dev` — runs `src/index.ts` directly via `tsx watch`. No separate compile step: `tsx` (esbuild under the hood) transpiles TS on the fly and restarts on file changes. Fastest loop for local development.
- `build` — compiles `src/` to `dist/` with `tsc`, for a production-style run (also what CI/the Docker image will use).
- `start` — runs the compiled output (`dist/index.js`) with plain `node`. Requires `build` to have run first.

## Dependencies

- `express` — HTTP server/routing.
- `cors` — the frontend runs on a different port (Vite dev server) than this API, so the browser enforces CORS; this middleware sends the headers that allow it.
- `dotenv` — loads `.env` into `process.env` at startup.
- `zod` — validates env vars and (later) request query params at runtime, so bad/missing input fails fast with a clear message instead of an obscure crash further down.
