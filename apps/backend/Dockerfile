# Utilise l'image officielle Bun
FROM oven/bun:latest

# Définit le répertoire de travail
WORKDIR /app

# Copie les fichiers de dépendances
COPY package.json  ./

# Installe les dépendances
RUN bun install

# Copie le reste de l'application
COPY . .

# Expose le port utilisé par Hono (par défaut 3000)
EXPOSE 3001

# Commande de démarrage
CMD ["bun", "run", "start"]
