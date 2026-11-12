# Build context is the repo root (see fly.backend.toml and
# .github/workflows/backend.yml), since this needs shared/ and the root
# lockfile alongside backend/.
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY frontend/package.json frontend/
COPY backend/package.json backend/
RUN npm ci
COPY shared ./shared
COPY backend ./backend
RUN npm run build --workspace=shared && npm run build --workspace=backend

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/migrations ./backend/migrations
COPY --from=builder /app/backend/package.json ./backend/package.json
EXPOSE 8080
# able:begin observability
# Preload OpenTelemetry before the app, so it can patch http, pg and pino
# (see backend/src/telemetry.ts).
ENV NODE_OPTIONS="--import=/app/backend/dist/telemetry.js"
# able:end
CMD ["node", "backend/dist/main.js"]
