#!/bin/sh
set -e

echo "[hrms-api] Running database migrate…"
node dist/scripts/migrate.js

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "[hrms-api] SEED_ON_START=true — seeding demo data…"
  node dist/scripts/seed.js
fi

echo "[hrms-api] Starting server on :${PORT:-5001}"
exec node dist/server.js
