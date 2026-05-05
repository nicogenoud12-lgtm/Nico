# Nico — Gastos App

## Deploy (servidor de producción)

**Host:** `familia` (CasaOS, 10.0.0.69)
**Usuario:** `genoud`
**Ruta del repo:** `/home/genoud/Nico`

Para deployar:
```bash
# 1. Conectarse al servidor
ssh genoud@familia

# 2. Ir al repo y actualizar
cd /home/genoud/Nico
git fetch origin
git checkout claude/refactor-html-app-6Qyuy   # o main cuando se merge
git pull origin claude/refactor-html-app-6Qyuy

# 3. Reconstruir y levantar contenedores
docker compose up -d --build
```

## Arquitectura

- **Frontend:** Vite + React (`frontend/`), sirve en el root
- **Backend:** FastAPI + SQLAlchemy + SQLite (`backend/`), API en `apigastos.genoud-nube.com.ar`
- **Bot Telegram:** integrado al backend (`backend/bot/`)
- **Reverse proxy:** Cloudflare Tunnel → CasaOS

## Ramas de desarrollo

- `claude/refactor-html-app-6Qyuy` — rediseño dark/responsive v2 (en curso)

## Variables de entorno

`VITE_API_BASE_URL` en el frontend apunta a `https://apigastos.genoud-nube.com.ar`.
