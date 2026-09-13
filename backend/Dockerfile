# Build context is the monorepo root (see infra/lib/backend-construct.ts) —
# every COPY path below is relative to the repo root, not this file's folder.

FROM node:22-alpine AS builder
WORKDIR /app

# Copy just the manifests first (better layer caching: this layer only
# re-runs when a package.json/lockfile actually changes, not on every
# source edit).
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/package.json backend/package.json
COPY packages/types/package.json packages/types/package.json

RUN corepack enable && corepack prepare pnpm@11.24.0 --activate
RUN pnpm install --frozen-lockfile --filter backend...

COPY backend backend
COPY packages/types packages/types

RUN pnpm --filter backend build

# pnpm workspaces link sibling packages (like @sg-health/types) as
# symlinks into the pnpm store. `pnpm deploy` resolves those into a
# self-contained folder with real files — plain `backend/node_modules`
# would carry broken symlinks once copied alone into the next stage.
RUN pnpm --filter backend deploy --prod /deploy

# --- runtime stage: only what's needed to actually run the server ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /deploy/dist ./dist
COPY --from=builder /deploy/node_modules ./node_modules
COPY --from=builder /deploy/package.json ./package.json

EXPOSE 5000
CMD ["node", "dist/index.js"]
