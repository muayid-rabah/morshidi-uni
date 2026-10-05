# Multi-stage Dockerfile for Fake University Backend & Portal
# Stage 1: Build frontend portal assets
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY src/ ./src/
COPY server/seed-data/manifest.json ./server/seed-data/manifest.json

RUN npm run build:portal

# Stage 2: Production runtime
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4101 \
    UNI_DATABASE_PATH=/data/university.sqlite \
    UNI_ALLOW_SYNTHETIC_SEED=false

# Create data directory for persistent SQLite database
RUN mkdir -p /data && chown -R node:node /data /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy server code, shared src data/types, and prebuilt portal
COPY server/ ./server/
COPY src/ ./src/
COPY --from=builder /app/dist ./dist

USER node

VOLUME ["/data"]

EXPOSE 4101

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "const port = process.env.PORT || 4101; fetch('http://127.0.0.1:' + port + '/healthz').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "--import", "tsx", "server/index.ts"]
