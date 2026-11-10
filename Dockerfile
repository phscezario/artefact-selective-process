# syntax=docker/dockerfile:1

# ---------- Dependencies ----------
FROM node:22-alpine AS deps
WORKDIR /app

# Only the manifests, so this layer is cached until a dependency actually changes.
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

RUN npm ci


# ---------- Build ----------
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build


# ---------- Runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# `output: 'standalone'` already contains the server, the traced node_modules and
# the workspace package, so the image does not need the sources or dev dependencies.
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./frontend/.next/static

USER node
EXPOSE 3000

CMD ["node", "frontend/server.js"]
