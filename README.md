# Nico – App de Gastos

Monorepo con frontend dark mode + responsive y backend API para registro de gastos personales.
Incluye bot de Telegram conversacional con Gemini API para cargar movimientos por chat, soporte para crear reglas personalizadas (ej. "LUTOVA es comida"), y capacidad de borrar transacciones.

```
.
├── frontend/        # Vite + React (dark mode, responsive, 6 pantallas)
├── backend/         # FastAPI + SQLAlchemy + SQLite + webhook Telegram
├── docker-compose.yml
└── CLAUDE.md        # notas de desarrollo
```

## Features

- **App web**: Movimientos, Gastos, Ingresos, Tarjetas, Anual, Ajustes
- **Bot Telegram**: Entiende lenguaje natural con Gemini; crea/borra/aprende
- **Reglas personalizadas**: "LUTOVA es comida" → la próxima vez aplica automáticamente
- **Concurrencia**: WAL mode en SQLite para lecturas/escrituras simultáneas

## Development (local)

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                      # editar con GEMINI_API_KEY, TELEGRAM_BOT_TOKEN
uvicorn app.main:app --reload --port 8000
```

Docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
cp .env.example .env                      # VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

Abrir http://localhost:5173.

## Deploy (CasaOS servidor local)

```bash
ssh genoud@familia
cd /home/genoud/Nico
git pull origin claude/refactor-html-app-6Qyuy
docker compose up -d --build
```

Frontend: https://gastos.genoud-nube.com.ar  
Backend API: https://apigastos.genoud-nube.com.ar

**Nota**: Cloudflare Tunnel expone los contenedores Docker. Webhook de Telegram apunta a `/telegram/webhook`.
