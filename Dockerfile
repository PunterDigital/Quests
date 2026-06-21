# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Base — Debian slim (Prisma engines are most reliable on glibc + openssl).
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------------------------------------------------------------------------
# Full dependencies — used to build the app.
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# Migrator deps — an isolated Prisma CLI (+ engines) used only to run
# `migrate deploy` on startup, kept out of the runtime node_modules.
# ---------------------------------------------------------------------------
FROM base AS migrator-deps
WORKDIR /migrator
RUN npm init -y >/dev/null 2>&1 && npm install --omit=dev prisma@6

# ---------------------------------------------------------------------------
# Builder — generate the Prisma client and build the standalone server.
# ---------------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL must be present for `prisma generate` / `next build`; no DB is
# contacted at build time (API routes are force-dynamic, the page is client-side).
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public"
RUN npx prisma generate
RUN npm run build
# Drop the build cache (often >1GB) so it never reaches the runtime image.
RUN rm -rf .next/cache

# ---------------------------------------------------------------------------
# Runner — minimal production image.
# `COPY --chown` sets ownership inline (a final `chown -R` would duplicate the
# whole tree into an extra image layer).
# ---------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Next.js standalone server (bundles a minimal node_modules) + static assets.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Ensure the generated Prisma client + query engine are present for the runtime
# (Next's file tracing can miss the native engine binary).
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Prisma schema + migrations and the isolated CLI for `migrate deploy` at startup.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=migrator-deps --chown=nextjs:nodejs /migrator/node_modules ./migrator/node_modules

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
