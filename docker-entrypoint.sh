#!/bin/sh
set -e

# Apply pending database migrations on startup unless disabled.
# Set RUN_MIGRATIONS=false to skip (e.g. when migrations run as a separate step).
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  if [ -z "$DATABASE_URL" ]; then
    echo "[entrypoint] DATABASE_URL is not set; skipping migrations."
  else
    echo "[entrypoint] Applying database migrations (prisma migrate deploy)..."
    # Use the isolated migrator CLI; --schema points at the bundled schema.
    node ./migrator/node_modules/prisma/build/index.js migrate deploy \
      --schema ./prisma/schema.prisma
  fi
fi

echo "[entrypoint] Starting server..."
exec "$@"
