# ── ÉTAPE 1 : base commune ──────────────────────────────────────────────────────
FROM oven/bun:1.4.0 AS base

WORKDIR /app

COPY package.json bun.lock* ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/ ./packages/

RUN bun install

COPY apps/backend/ ./apps/backend/

WORKDIR /app/apps/backend

EXPOSE 3001

RUN mkdir -p .logs && chown -R bun:bun .logs

USER bun

# ── ÉTAPE 2 : développement (hot reload) ────────────────────────────────────────
FROM base AS dev
CMD ["bun", "run", "dev"]

# ── ÉTAPE 3 : production ────────────────────────────────────────────────────────
FROM base AS prod
CMD ["bun", "run", "start"]
