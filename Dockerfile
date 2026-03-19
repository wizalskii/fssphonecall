FROM node:18-alpine

WORKDIR /app

# Copy all workspace package.json files first for layer caching
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

# Install deps — skip postinstall since shared source isn't copied yet
RUN npm install --include=dev --ignore-scripts

# Copy source
COPY shared/ shared/
COPY server/ server/

# Build shared types, then server
RUN npm run build:shared && npm run build:server

EXPOSE 3001

CMD ["node", "server/dist/server.js"]
