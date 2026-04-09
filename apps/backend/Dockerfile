# Utilise l'image officielle Bun
FROM oven/bun:latest

# Définit le répertoire de travail racine du monorepo
WORKDIR /app

# Copie les fichiers de dépendances du monorepo
COPY package.json bun.lockb* ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/ ./packages/

# Installe les dépendances
RUN bun install

# Copie le reste du code
COPY apps/backend/ ./apps/backend/

WORKDIR /app/apps/backend

# Expose le port utilisé par Hono
EXPOSE 3001

# Commande de démarrage
CMD ["bun", "run", "dev"]

USER bun
