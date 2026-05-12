# Nico — App de Gastos

Aplicación de finanzas personales con frontend web dark mode + bot de Telegram conversacional con Gemini.

## Repositorio

- **GitHub**: `nicogenoud12-lgtm/Nico`
- **Rama de desarrollo**: `claude/refactor-html-app-6Qyuy`
- **Rama default**: `main` (protegida — requiere PR para mergear, no push directo)

## Arquitectura

```
Nico/
├── frontend/        # Vite + React, dark mode, responsive
├── backend/         # FastAPI + SQLAlchemy + SQLite
│   ├── app/
│   │   ├── routers/ # categories, mediums, transactions, tarjetas,
│   │   │            # suscripciones, backup, telegram, months
│   │   ├── gemini.py        # cliente Gemini API (REST + httpx)
│   │   ├── models.py        # Category, Medium, Transaction, Tarjeta,
│   │   │                    # Suscripcion, PendingTransaction, BotRule
│   │   ├── crud.py
│   │   ├── database.py      # WAL mode + busy_timeout
│   │   └── routers/telegram.py  # webhook conversacional
│   └── .env                 # GEMINI_API_KEY, TELEGRAM_BOT_TOKEN, etc.
├── docker-compose.yml
└── CLAUDE.md
```

### Frontend (6 pantallas)

- Movimientos · Gastos · Ingresos · Tarjetas · Suscripciones · Anual · Ajustes
- Sidebar fijo desktop (≥768px) / hamburguesa drawer mobile
- Theme tokens en `frontend/src/theme.js` (`C.bg`, `C.surface`, etc.)
- API client base: `VITE_API_BASE_URL` → `https://apigastos.genoud-nube.com.ar`

### Backend

- **Endpoints CRUD**: `/categories`, `/mediums`, `/tarjetas`, `/suscripciones`, `/transactions`, `/months`
- **Backup**: `GET /backup/export` y `POST /backup/import` (atómico)
- **Telegram**: `POST /telegram/webhook` (con header `X-Telegram-Bot-Api-Secret-Token`)

### Base de datos

SQLite en volumen Docker `backend_data`, con:
- WAL mode (`PRAGMA journal_mode=WAL`) para escrituras concurrentes
- `busy_timeout=5000` ms
- Migraciones idempotentes en `init_db()` al startup
- `Category` tiene UniqueConstraint compuesta `(name, kind)` — permite "Otros" gasto e ingreso a la vez

## Bot de Telegram (con Gemini API)

**No usa parser regex** — todo el entendimiento es vía Gemini.

### Flujo

1. Webhook recibe mensaje
2. Carga desde DB: cats (gasto + ingreso), medios, bot_rules, últimas 10 txs
3. Recupera historial conversacional del `PendingTransaction` (formato multi-turno: `{"role": "user|model", "text": "..."}`)
4. Llama a Gemini con system prompt + historial + nuevo mensaje
5. Gemini devuelve JSON con `intent` ∈ {create, delete, learn, unknown} + `reply` natural
6. Branch según intent:
   - `create` completo → persiste tx, limpia pending, envía reply
   - `create` con `missing` → guarda historial actualizado, envía reply pidiendo lo que falta
   - `delete` → borra tx por `tx_id` de la lista de últimas
   - `learn` → guarda regla en `bot_rules` (keyword normalizada lowercase + sin acentos)
   - `unknown` → responde naturalmente (saludos, preguntas, etc.)

### Reglas personalizadas (bot_rules)

Tabla SQLite con `keyword` (PK) → `cat` + `tx_type`. Inyectadas en cada prompt para que Gemini las aplique automáticamente.

Ejemplo:
- Usuario: "LUTOVA es comida" → `intent=learn`, regla guardada
- Usuario: "lutova 5000 mp" → Gemini aplica la regla, crea gasto en Comida

### Variables de entorno

```
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
ALLOWED_TELEGRAM_USER_IDS=...
```

`docker-compose.yml` carga el `.env` del backend vía `env_file: - ./backend/.env`.

## Decisiones técnicas

- **Sin fallback regex**: si Gemini falla → bot responde `GEMINI_ERROR` y NO carga nada (predecible vs. fallback silencioso)
- **Cats/medios desde DB**: Gemini recibe la lista actual del usuario en cada prompt
- **`tx.cat`/`tx.medio` por nombre**: el frontend identifica por `name` (no por id/slug)
- **Pending unificado**: `PendingTransaction.partial_json` guarda `{"history": [...]}` (lista de turnos), no un dict de campos parseados
- **Schema response Gemini**: structured output con `responseSchema` (OpenAPI 3.0 subset, tipos UPPERCASE)
- **`reply` siempre generado por Gemini**: nunca se usan templates hardcodeados (`messages.py` existe solo como fallback de errores)

## Deploy (CasaOS local)

**Host**: `familia` (10.0.0.69) · **User**: `genoud` · **Path**: `/home/genoud/Nico`

```bash
ssh genoud@familia
cd /home/genoud/Nico
git pull origin main
docker compose up -d --build
```

URLs públicas (vía Cloudflare Tunnel):
- Frontend: https://gastos.genoud-nube.com.ar
- API: https://apigastos.genoud-nube.com.ar
- Webhook Telegram: https://apigastos.genoud-nube.com.ar/telegram/webhook

## Workflow de cambios

1. Trabajar en `claude/refactor-html-app-6Qyuy`
2. Commit + push a esa rama
3. Crear PR a `main` vía GitHub MCP (no se puede push directo a main)
4. Mergear PR → deployar al servidor con `git pull origin main && docker compose up -d --build`
