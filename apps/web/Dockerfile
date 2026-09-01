# Dashboard medecin (Next.js).
#
# Contrairement a apps/backend/Dockerfile, la base est Node et non `oven/bun`.
#
# `next build` (Next 16, Turbopack) charge un runtime CommonJS compile que Bun
# ne sait pas evaluer : la construction echoue sur
#
#   Failed to load external module next/dist/compiled/next-server/
#   app-page-turbo.runtime.prod.js: Expected CommonJS module to have a function
#   wrapper. If you weren't messing around with Bun's internals, this is a bug
#   in Bun
#
# La CI ne rencontre pas ce probleme parce qu'elle installe Node 24 *et* Bun sur
# le runner (voir .github/workflows/ci.yml, job build-web) : `bun run` lance le
# script, et Next trouve Node pour son propre runtime. L'etape de construction
# reproduit donc cet environnement.
#
# Le contexte de build est la racine du monorepo : @sauver-la-face/shared est
# une dependance workspace, elle doit etre presente a l'installation.

# ── ETAPE 1 : base commune ──────────────────────────────────────────────────────
FROM node:24-slim AS base

# Bun est installe dans /usr/local pour rester accessible une fois les
# privileges abandonnes. La version est epinglee : un `latest` rendrait l'image
# non reproductible d'un build a l'autre.
ENV BUN_INSTALL=/usr/local
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl unzip ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.12"

WORKDIR /app

COPY package.json bun.lock* ./
COPY apps/web/package.json ./apps/web/
COPY packages/ ./packages/

RUN bun install

COPY apps/web/ ./apps/web/

WORKDIR /app/apps/web

EXPOSE 3000

# ── ETAPE 2 : developpement (hot reload) ────────────────────────────────────────
FROM base AS dev
CMD ["bun", "run", "dev"]

# ── ETAPE 3 : construction ──────────────────────────────────────────────────────
FROM base AS builder

# NEXT_PUBLIC_API_URL est lue dans des hooks client : Next l'inscrit dans le
# bundle JavaScript a la compilation. Elle ne peut donc pas etre injectee au
# demarrage du conteneur — d'ou un ARG, fourni par docker-compose.prod.yml.
# Une valeur erronee ici produit une image qui interroge la mauvaise API sans
# qu'aucune variable d'environnement ne puisse le corriger ensuite.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Le package partage est compile avant le build web : apps/web l'importe depuis
# son dist/, pas depuis ses sources.
RUN bun run --cwd /app/packages/shared build
RUN bun run build

# ── ETAPE 4 : production ────────────────────────────────────────────────────────
#
# Repart de l'image Node nue : ni Bun, ni les outils de construction, ni
# node_modules. Seule la sortie `standalone` est recopiee — un serveur autonome
# accompagne des seules dependances reellement atteintes par le code.
FROM node:24-slim AS prod

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# `outputFileTracingRoot` etant la racine du monorepo, la sortie reproduit cette
# arborescence : le serveur se trouve sous apps/web/, et les dependances tracees
# sous node_modules/ a la racine du dossier standalone.
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
# Les fichiers statiques et publics ne sont pas traces par Next : ils se
# recopient a part, aux emplacements que le serveur attend.
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /app/apps/web/public ./apps/web/public

USER node

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
