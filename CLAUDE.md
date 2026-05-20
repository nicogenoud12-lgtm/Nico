# Nico — App de Gastos

Aplicación de finanzas personales con frontend web dark mode + bot de Telegram conversacional con Gemini. Soporta múltiples usuarios con datos completamente aislados.

## Repositorio

- **GitHub**: `nicogenoud12-lgtm/Nico`
- **Rama default**: `main` (protegida — requiere PR para mergear, no push directo)

## Arquitectura

```
Nico/
├── frontend/        # Vite + React, dark mode, responsive
│   ├── public/
│   │   └── icons/
│   │       ├── {id}.svg         # íconos del sidebar (movimientos, gastos, etc.)
│   │       └── cat/{name}.svg   # íconos de categorías (comida, ocio, etc.)
│   └── src/
│       ├── auth/            # AuthContext.jsx — manejo de sesión JWT
│       ├── api/             # client.js, auth.js, transactions.js, etc.
│       ├── components/
│       │   ├── CatIconBadge.jsx  # ícono SVG coloreado por categoría (mask-image)
│       │   ├── SidebarDesktop.jsx / Sidebar.jsx  # usan navItems.js + NavIcon SVG
│       │   └── TxRow.jsx         # usa CatIconBadge
│       ├── navItems.js       # array NAV_ITEMS compartido entre ambos sidebars
│       └── screens/         # ScreenLogin + 8 pantallas de la app
├── backend/         # FastAPI + SQLAlchemy + SQLite
│   ├── app/
│   │   ├── routers/         # auth, categories, mediums, transactions,
│   │   │                    # tarjetas, recurrentes, backup, telegram, months
│   │   ├── auth.py          # bcrypt hash + JWT HS256 + get_current_user dep
│   │   ├── gemini.py        # cliente Gemini API (REST + httpx)
│   │   ├── models.py        # User, Invitation, Category, Medium, Transaction,
│   │   │                    # Tarjeta, Recurrente, Month, PendingTransaction, BotRule
│   │   ├── crud.py          # todas las funciones reciben user_id y filtran
│   │   ├── database.py      # WAL mode + busy_timeout
│   │   └── config.py        # Settings con JWT_SECRET, TELEGRAM_BOT_OWNER_ID
│   ├── alembic/versions/    # 001_inversion_kind, 002_multiuser_auth
│   ├── scripts/
│   │   └── set_admin_password.py  # CLI para setear password del admin
│   └── .env                 # GEMINI_API_KEY, TELEGRAM_BOT_TOKEN, JWT_SECRET, etc.
├── docker-compose.yml       # env_file: ./backend/.env
└── CLAUDE.md
```

### Frontend (9 pantallas)

- **Login** (sin sesión) → tabs Entrar / Crear cuenta con código de invitación
- **App** (con sesión): Movimientos · Gastos · Ingresos · Tarjetas · Suscripciones · Anual · Inversiones · Ajustes
- Sidebar fijo desktop (≥768px) / hamburguesa drawer mobile
- **Íconos del sidebar**: SVGs en `frontend/public/icons/{id}.svg` (movimientos, gastos, ingresos, tarjetas, recurrentes, anual, inversiones, ajustes). Si no existe el archivo → fallback a símbolo de texto. Activo: blanco; inactivo: gris (CSS filter).
- **Íconos de categorías**: SVGs en `frontend/public/icons/cat/{name}.svg`, coloreados con el color de la categoría vía CSS `mask-image`. Mapeo nombre→archivo en `CatIconBadge.jsx`. Si no hay ícono → punto de color como fallback.
- Theme tokens en `frontend/src/theme.js` (`C.bg`, `C.surface`, etc.)
- API client base: `VITE_API_BASE_URL` → `https://apigastos.genoud-nube.com.ar`
- Token JWT guardado en `localStorage('auth_token')`; axios lo inyecta en cada request

### Backend

- **Auth**: `POST /auth/login`, `POST /auth/register`, `GET /auth/me`
- **Invitaciones (admin)**: `GET/POST /auth/invitations`, `DELETE /auth/invitations/{id}`
- **Endpoints CRUD** (todos requieren Bearer token): `/categories`, `/mediums`, `/tarjetas`, `/recurrentes`, `/transactions`, `/months`
- **Backup**: `GET /backup/export` y `POST /backup/import` (scoped al usuario autenticado)
- **Telegram**: `POST /telegram/webhook` (con header `X-Telegram-Bot-Api-Secret-Token`)

### Base de datos

SQLite en volumen Docker `backend_data`, con:
- WAL mode (`PRAGMA journal_mode=WAL`) para escrituras concurrentes
- `busy_timeout=5000` ms
- Migraciones vía Alembic (corren automáticamente al iniciar el contenedor)
- `Category` tiene UniqueConstraint compuesta `(user_id, name, kind)`
- `Medium` tiene UniqueConstraint `(user_id, name)`
- `Month` tiene PK compuesta `(user_id, mmyy)` — serializado como `id` en el JSON para no romper el frontend
- `Transaction`, `Category`, `Medium`, `Tarjeta`, `Recurrente` tienen `user_id FK → users.id ON DELETE CASCADE`
- `PendingTransaction` y `BotRule` no tienen user_id (solo usa el bot, que es del owner)

### Multi-usuario

- Cada usuario tiene sus propias categorías, medios, tarjetas, suscripciones, transacciones y meses
- **Signup por invitación**: el admin genera un código desde Ajustes → lo pasa al amigo → el amigo se registra con username + password + código
- **Anti-IDOR**: todas las queries filtran por `user_id` del token; nunca se usa `db.get(Model, id)` sin filtrar
- Al registrarse un usuario nuevo se le siembran las categorías/medios/meses default automáticamente
- `localStorage` namespaciado por user_id: `nav_screen:{id}`, `nav_month:{id}`

## Bot de Telegram (con Gemini API)

**No usa parser regex** — todo el entendimiento es vía Gemini.
**Opera siempre en nombre del owner** definido en `TELEGRAM_BOT_OWNER_ID` (su user.id en tabla users).

### Flujo

1. Webhook recibe mensaje → valida secret token + `ALLOWED_TELEGRAM_USER_IDS`
2. Carga desde DB: cats/medios/tarjetas/bot_rules/últimas 10 txs del owner
3. Recupera historial conversacional del `PendingTransaction`
4. Llama a Gemini con system prompt + historial + nuevo mensaje
5. Gemini devuelve JSON con `intent` ∈ {create, delete, learn, unknown} + `reply` natural
6. Branch según intent:
   - `create` completo → persiste tx en nombre del owner, limpia pending
   - `create` con `missing` → guarda historial, pide lo que falta
   - `delete` → borra tx del owner por `tx_id`
   - `learn` → guarda regla en `bot_rules`
   - `unknown` → responde naturalmente

### Gemini — detalles técnicos

- Timeout: **45 segundos** (Gemini 2.5 Flash con thinking puede tardar 20-60s)
- `thinkingConfig: {thinkingBudget: 1024}` — limita el thinking a ~1-3s sin perder calidad
- `responseMimeType: "application/json"` + `responseSchema` (structured output)
- Si Gemini falla → bot responde `GEMINI_ERROR`, no carga nada

### Variables de entorno (`backend/.env`)

```
# DB
DATABASE_URL=sqlite:////app/data/gastos.db

# CORS
CORS_ORIGINS=https://gastos.genoud-nube.com.ar,http://10.0.0.69:3000

# Telegram
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
ALLOWED_TELEGRAM_USER_IDS=...
TELEGRAM_BOT_OWNER_ID=1        # user.id del dueño del bot (tu usuario admin)

# Gemini
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash

# JWT
JWT_SECRET=...                  # generar con: openssl rand -hex 32
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080        # 7 días
```

## Deploy (CasaOS local)

**Host**: `familia` (10.0.0.69) · **User**: `genoud` · **Path**: `/home/genoud/Nico`

```bash
ssh genoud@familia
cd /home/genoud/Nico
git pull origin main
docker compose up -d --build
# Alembic corre automáticamente al iniciar el contenedor
```

URLs públicas (vía Cloudflare Tunnel):
- Frontend: https://gastos.genoud-nube.com.ar
- API: https://apigastos.genoud-nube.com.ar
- Webhook Telegram: https://apigastos.genoud-nube.com.ar/telegram/webhook

### Primera vez (setup inicial post-migración)

```bash
# Setear contraseña del admin (solo la primera vez)
docker compose exec -it backend python scripts/set_admin_password.py
# Username: admin (Enter para default)
# Contraseña: la que quieras (mín. 6 chars)
```

Después entrar a la app, ir a **Ajustes → Invitaciones** para generar códigos para otros usuarios.

## Decisiones técnicas

- **Auth**: JWT HS256 con `python-jose`, hashing con `bcrypt` directo (sin passlib — incompatibilidad con bcrypt 4.1+)
- **Sin fallback regex en bot**: si Gemini falla → `GEMINI_ERROR`, no carga nada
- **Cats/medios desde DB**: Gemini recibe la lista actual del usuario en cada prompt
- **`tx.cat`/`tx.medio` por nombre**: el frontend identifica por `name` (no por id)
- **Pending unificado**: `PendingTransaction.partial_json` guarda `{"history": [...]}` (lista de turnos)
- **Schema response Gemini**: structured output con `responseSchema` (tipos UPPERCASE)
- **`reply` siempre generado por Gemini**: `messages.py` solo como fallback de errores
- **Cron recurrentes**: APScheduler itera sobre todos los usuarios activos a las 00:05
- **Íconos SVG sidebar**: CSS `filter: brightness(0) invert(X)` sobre `<img>` — requiere SVGs monocromáticos
- **Íconos SVG categorías**: CSS `mask-image` + `background-color` — el SVG define la forma, el color lo pone el background con el color de la categoría. Fallback a punto de color si no hay ícono mapeado.
- **MiniCardBadge (tarjetas)**: muestra `logo_url` de la tarjeta si existe, sino iniciales de texto

### Agregar ícono a una categoría nueva
1. Poner el `.svg` (monocromático) en `frontend/public/icons/cat/`
2. Agregar la entrada en `CAT_ICON_MAP` dentro de `frontend/src/components/CatIconBadge.jsx`

## Workflow de cambios

1. Crear rama nueva desde `main`
2. Commit + push
3. Crear PR a `main` vía GitHub MCP (no se puede push directo a main)
4. Mergear PR → deployar al servidor con `git pull origin main && docker compose up -d --build`
