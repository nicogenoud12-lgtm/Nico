# Desarrollo Local - Gastos App

## Quick Start (Recomendado)

```bash
# 1. Ejecutar setup (instala dependencias)
./run_local.sh

# 2. En TERMINAL 1: Backend (uvicorn)
cd backend
source venv/bin/activate
export DATABASE_URL=sqlite:///./gastos_local.db
export CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
uvicorn app.main:app --reload --host 0.0.0.0 --port 8005

# 3. En TERMINAL 2: Frontend (Vite dev server)
cd frontend
VITE_API_BASE_URL=http://localhost:8005 npm run dev
```

## URLs

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8005
- **Swagger (Docs):** http://localhost:8005/docs

## Testing Rápido

### 1. Ver suscripciones vacías
```bash
curl http://localhost:8005/suscripciones
# → []
```

### 2. Crear suscripción en USD
```bash
curl -X POST http://localhost:8005/suscripciones \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Netflix",
    "monto": 7.99,
    "moneda": "USD",
    "frecuencia": "mensual",
    "estado": "activo",
    "logo_url": "https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg"
  }'
```

### 3. Crear suscripción en ARS
```bash
curl -X POST http://localhost:8005/suscripciones \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Spotify",
    "monto": 2500,
    "moneda": "ARS",
    "frecuencia": "mensual",
    "estado": "activo"
  }'
```

### 4. Abrir en navegador
- Ir a http://localhost:5173
- Click en "Suscripciones" (↻ en sidebar)
- Ver panel de totales ARS/USD
- Verificar conversión USD de CriptoYa

## Troubleshooting

### Backend no inicia
```bash
# Limpiar DB y reintentar
rm backend/gastos_local.db
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8005
```

### Error CORS
- Asegurar que CORS_ORIGINS incluya `http://localhost:3000` y `http://127.0.0.1:3000`
- Reiniciar backend

### Frontend no inicia
```bash
cd frontend
rm -rf node_modules
npm install
VITE_API_BASE_URL=http://localhost:8005 npm run dev
```

### Puerto en uso
```bash
# Backend en otro puerto
uvicorn app.main:app --reload --port 8000

# Frontend en otro puerto
npm run dev -- --port 3000
```

## Cambios Importantes

### Backend
- Nuevo modelo: `Suscripcion` en `backend/app/models.py`
- Nuevo router: `backend/app/routers/suscripciones.py`
- CRUD: funciones en `backend/app/crud.py`
- Backup incluye suscripciones

### Frontend
- Nueva pantalla: `frontend/src/screens/ScreenSuscripciones.jsx`
- Nuevo formulario: `frontend/src/components/SuscripcionForm.jsx`
- API module: `frontend/src/api/suscripciones.js`
- Sidebar: agregado ítem "Suscripciones"

## Base de Datos Local

Por defecto se usa SQLite en `backend/gastos_local.db`:
- Se crea automáticamente en el primer run
- Los datos persisten entre reinicios (en la misma máquina)
- Para resetear: `rm backend/gastos_local.db`

## Deploy a Producción

Ver `CLAUDE.md` para instrucciones de deploy a `familia` (CasaOS).

Resumido:
```bash
ssh genoud@familia
cd /home/genoud/Nico
git pull origin claude/refactor-html-app-6Qyuy
docker compose up -d --build
```
