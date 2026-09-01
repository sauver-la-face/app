# ── ÉTAPE 1 : base commune ──────────────────────────────────────────────────────
FROM oven/bun:1.4.0 AS base

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/ ./packages/

# bun.lock doit etre present dans le contexte de build (voir .dockerignore) pour
# que les versions resolues ici soient celles du verrou. --frozen-lockfile n'est
# pas utilisable : le Dockerfile ne copie que apps/backend et packages, alors que
# le verrou decrit tout le workspace (web, mobile) — bun le considere alors modifie.
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
