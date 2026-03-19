FROM node:18-alpine

WORKDIR /app

# Copy all workspace package.json files first for layer caching
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

# Install with dev deps (needed for TypeScript compilation)
RUN npm install --include=dev

# Copy source
COPY shared/ shared/
COPY server/ server/

# Build shared types, then server
RUN npm run build:shared && npm run build:server

# Prune dev dependencies for smaller image
RUN npm prune --omit=dev

EXPOSE 3001

CMD ["node", "server/dist/server.js"]
