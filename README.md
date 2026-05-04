# Nico – App de Gastos

Monorepo con frontend SPA y backend API para registro de gastos personales,
con bot de Telegram conversacional para cargar movimientos por chat.

```
.
├── viejo.html       # versión legacy (HTML monolítico, snapshot histórico)
├── index.html       # idem (snapshot previo a la migración)
├── frontend/        # SPA Vite + React (deploy: Vercel)
└── backend/         # FastAPI + SQLite + webhook Telegram (servidor local)
```

## Quick start

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Docs: http://localhost:8000/docs · ver [`backend/README.md`](backend/README.md) para Telegram.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env       # VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

Abrir http://localhost:5173.

## Deploy

- **Frontend (Vercel)**: conectar el repo, `Root Directory = frontend`, build `npm run build`, output `dist`. Setear `VITE_API_BASE_URL` apuntando al backend público.
- **Backend (server local)**: correr `uvicorn` y exponerlo con Cloudflare Tunnel / ngrok / VPS. Registrar el webhook de Telegram con la URL pública.
