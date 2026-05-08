#!/bin/bash

# Script para ejecutar la app Gastos localmente

echo "================================"
echo "  GASTOS APP - LOCAL SETUP"
echo "================================"
echo ""

# Detectar OS
OS_TYPE=$(uname)
PYTHON_CMD="python"

# Verificar Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python no instalado. Instálalo desde https://www.python.org"
    exit 1
fi

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no instalado. Instálalo desde https://nodejs.org"
    exit 1
fi

echo "✓ Python: $(python3 --version)"
echo "✓ Node: $(node --version)"
echo "✓ npm: $(npm --version)"
echo ""

# Setup Backend
echo "📦 Backend Setup..."
cd backend

if [ ! -d "venv" ]; then
    echo "  → Creando virtual environment..."
    python3 -m venv venv
fi

echo "  → Activando venv..."
if [ "$OS_TYPE" = "Windows" ]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi

echo "  → Instalando dependencias..."
pip install -q -r requirements.txt

cd ..

# Setup Frontend
echo "📦 Frontend Setup..."
cd frontend

if [ ! -d "node_modules" ]; then
    echo "  → Instalando npm packages..."
    npm install -q
fi

cd ..

echo ""
echo "================================"
echo "  LISTO PARA EJECUTAR"
echo "================================"
echo ""
echo "🚀 Para iniciar (en terminales diferentes):"
echo ""
echo "TERMINAL 1 - Backend:"
echo "  cd /home/user/Nico/backend"
echo "  source venv/bin/activate"
echo "  export DATABASE_URL=sqlite:///./gastos_local.db"
echo "  export CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000"
echo "  uvicorn app.main:app --reload --host 0.0.0.0 --port 8005"
echo ""
echo "TERMINAL 2 - Frontend:"
echo "  cd /home/user/Nico/frontend"
echo "  VITE_API_BASE_URL=http://localhost:8005 npm run dev"
echo ""
echo "TERMINAL 3 - Testing (opcional):"
echo "  curl -X POST http://localhost:8005/suscripciones \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"nombre\": \"Netflix\", \"monto\": 7.99, \"moneda\": \"USD\", \"frecuencia\": \"mensual\", \"estado\": \"activo\"}'"
echo ""
echo "Frontend en: http://localhost:5173"
echo "Backend API: http://localhost:8005/docs"
echo ""
