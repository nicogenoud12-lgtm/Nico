#!/bin/bash
# Levanta el dev server FastAPI + frontend buildeado en un solo proceso.
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
DEV="$ROOT/dev-server"
FRONT="$ROOT/frontend"

echo "================================"
echo "  GASTOS DEV SERVER"
echo "================================"

# 1. Build frontend
echo ""
echo "📦 Buildeando frontend (VITE_API_BASE_URL=relativo)..."
cd "$FRONT"
npm install
# URL vacía → el frontend usa rutas relativas, mismo origen
VITE_API_BASE_URL="" npm run build

# 2. Copiar dist al dev-server
echo ""
echo "📂 Copiando dist/ a dev-server/static/..."
rm -rf "$DEV/static"
cp -r "$FRONT/dist" "$DEV/static"

# 3. Setup venv
echo ""
echo "🐍 Setup Python venv..."
cd "$DEV"
if [ ! -d "venv" ]; then
  python3 -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt

# 4. Levantar uvicorn
echo ""
echo "================================"
echo "  Listo: http://localhost:8010"
echo "  Health: http://localhost:8010/health"
echo "  Docs:   http://localhost:8010/docs"
echo "================================"
echo ""
exec uvicorn app:app --host 0.0.0.0 --port 8010
