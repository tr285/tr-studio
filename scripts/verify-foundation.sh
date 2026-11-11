#!/usr/bin/env bash
# ==============================================================================
# TR STUDIO — End-to-End Verification Script (Step 1 Foundation)
# ==============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== [1/4] Validating Docker Compose Configuration ==="
docker compose config --quiet
echo "✓ docker-compose.yml is syntactically valid."

echo "=== [2/4] Running Backend Alembic Migrations ==="
cd "$ROOT_DIR/backend"
source .venv/bin/activate
alembic upgrade head
echo "✓ Alembic migrations are at head."

echo "=== [3/4] Running Automated Backend Pytest Suite ==="
pytest -v
echo "✓ Backend tests passed."

echo "=== [4/4] Running Frontend TypeScript Check ==="
cd "$ROOT_DIR"
npm run typecheck
echo "✓ Frontend TypeScript check passed."

echo ""
echo "🎉 All TR STUDIO Step 1 Foundation checks passed!"
