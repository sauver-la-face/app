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
# le runner (voir .github/workflows/ci.yml, job build-web, ou la version de Node
# est fixee explicitement) : `bun run` lance le script, et Next trouve Node pour
# son propre runtime. Cette image reproduit donc le meme environnement.
#
# Bun reste present : c'est lui qui gere les dependances workspace et le
# lockfile. Sa version suit celle de l'image backend.
#
# Le contexte de build est la racine du monorepo : @sauver-la-face/shared est
# une dependance workspace, elle doit etre presente a l'installation.

# ── ETAPE 1 : base commune ──────────────────────────────────────────────────────
FROM node:24-slim AS base

# Bun est installe dans /usr/local pour rester accessible a l'utilisateur `node`
# une fois les privileges abandonnes. La version est epinglee : un `latest`
# rendrait l'image non reproductible d'un build a l'autre.
ENV BUN_INSTALL=/usr/local
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl unzip ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.12"

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY packages/ ./packages/

# Meme contrainte que pour l'image backend : bun.lock doit etre present dans le
# contexte de build (voir .dockerignore) pour que les versions resolues ici soient
# celles du verrou. Le glob a ete retire volontairement — son absence doit faire
# echouer le build plutot que de le laisser resoudre chaque plage ^x.y.z vers la
# derniere version publiee. --frozen-lockfile reste inutilisable : le Dockerfile ne
# copie que apps/web et packages, alors que le verrou decrit tout le workspace.
RUN bun install

COPY apps/web/ ./apps/web/

WORKDIR /app/apps/web

EXPOSE 3000

# ── ETAPE 2 : developpement (hot reload) ────────────────────────────────────────
FROM base AS dev
CMD ["bun", "run", "dev"]

# ── ETAPE 3 : production ────────────────────────────────────────────────────────
FROM base AS prod

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

USER node

CMD ["bun", "run", "start"]
