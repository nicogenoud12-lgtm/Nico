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
│       ├── api/             # client.js, auth.js, transactions.js, dollar.js,
│       │                    # importStatements.js, suscripciones.js, etc.
│       ├── components/
│       │   ├── CatIconBadge.jsx   # ícono SVG coloreado por categoría (mask-image)
│       │   ├── CuotaDetailModal.jsx  # detalle de cuotas + editar/eliminar (una o todas)
│       │   ├── ImportResumen.jsx  # pantalla de revisión del import de resúmenes PDF
│       │   ├── TxForm.jsx         # alta/edición de tx (monto acepta coma decimal)
│       │   ├── SidebarDesktop.jsx / Sidebar.jsx  # usan navItems.js + NavIcon SVG
│       │   └── TxRow.jsx          # usa CatIconBadge
│       ├── navItems.js       # array NAV_ITEMS compartido entre ambos sidebars
│       ├── index.css         # reset + @media (pointer:coarse) inputs 16px (anti-zoom iOS)
│       └── screens/         # ScreenLogin + pantallas de la app (incl. ScreenDolares)
├── backend/         # FastAPI + SQLAlchemy + SQLite
│   ├── app/
│   │   ├── routers/         # auth, categories, mediums, transactions, tarjetas,
│   │   │                    # recurrentes, suscripciones, backup, telegram, months,
│   │   │                    # dollar, import_statements
│   │   ├── auth.py          # bcrypt hash + JWT HS256 + get_current_user dep
│   │   ├── gemini.py        # cliente Gemini (bot + extract_statement de PDFs)
│   │   ├── statement_import.py  # lógica pura del import PDF (dedup, cuotas, alias)
│   │   ├── models.py        # User, Invitation, Category, Medium, Month, Tarjeta,
│   │   │                    # Recurrente, Transaction, DollarOp, PendingTransaction,
│   │   │                    # BotRule, ImportAlias
│   │   ├── crud.py          # todas las funciones reciben user_id y filtran
│   │   ├── database.py      # WAL mode + busy_timeout
│   │   └── config.py        # Settings con JWT_SECRET, TELEGRAM_BOT_OWNER_ID
│   ├── alembic/versions/    # 001..006 (origin_ref=004, dollar_ops=005, import_aliases=006)
│   ├── tests/               # test_statement_import.py (lógica pura, sin Gemini)
│   ├── scripts/
│   │   └── set_admin_password.py  # CLI para setear password del admin
│   └── .env                 # GEMINI_API_KEY, TELEGRAM_BOT_TOKEN, JWT_SECRET, etc.
├── docker-compose.yml       # env_file: ./backend/.env
└── CLAUDE.md
```


### Frontend (pantallas)

- **Login** (sin sesión) → tabs Entrar / Crear cuenta con código de invitación
- **App** (con sesión): Movimientos · Gastos · Ingresos · Tarjetas · Suscripciones · Anual · Inversiones · Dólares · Ajustes
- Sidebar fijo desktop (≥768px) / hamburguesa drawer mobile
- **Cuotas**: al tocar una tx en cuotas se abre `CuotaDetailModal` con la lista de cuotas y botones **editar cuota / editar todas / eliminar cuota / eliminar todas** (en Movimientos y Gastos). "Editar todas" propaga cat/desc/monto/medio a todas las cuotas del grupo conservando fecha y `cuota_num` de cada una.
- **Inputs en mobile**: los campos numéricos (monto en `TxForm`, cotización del import, montos del baúl de Dólares) son `type="text"` + `inputMode="decimal"` y aceptan **coma** como separador decimal (se normaliza a punto). `index.css` fuerza `font-size:16px` en inputs solo en pantallas táctiles para que iOS Safari no haga zoom al enfocar.
- **Íconos del sidebar**: SVGs en `frontend/public/icons/{id}.svg` (movimientos, gastos, ingresos, tarjetas, recurrentes, anual, inversiones, ajustes). Si no existe el archivo → fallback a símbolo de texto. Activo: blanco; inactivo: gris (CSS filter).
- **Íconos de categorías**: SVGs en `frontend/public/icons/cat/{name}.svg`, coloreados con el color de la categoría vía CSS `mask-image`. Mapeo nombre→archivo en `CatIconBadge.jsx`. Si no hay ícono → punto de color como fallback.
- Theme tokens en `frontend/src/theme.js` (`C.bg`, `C.surface`, etc.)
- API client base: `VITE_API_BASE_URL` → `https://apigastos.genoud-nube.com.ar`
- Token JWT guardado en `localStorage('auth_token')`; axios lo inyecta en cada request

### Backend

- **Auth**: `POST /auth/login`, `POST /auth/register`, `GET /auth/me`
- **Invitaciones (admin)**: `GET/POST /auth/invitations`, `DELETE /auth/invitations/{id}`
- **Endpoints CRUD** (todos requieren Bearer token): `/categories`, `/mediums`, `/tarjetas`, `/recurrentes`, `/suscripciones`, `/transactions`, `/months`
- **Dólares (baúl)**: `/dollar/*` — operaciones de tenencia en USD (ingreso/compra/venta/retiro) + cotizaciones (`/dollar/quotes`)
- **Import de resúmenes PDF**: `POST /import/extract` (sube PDF → Gemini extrae, no persiste) y `POST /import/confirm` (crea las txs aprobadas)
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
- `Transaction`, `Category`, `Medium`, `Tarjeta`, `Recurrente`, `DollarOp`, `ImportAlias` tienen `user_id FK → users.id ON DELETE CASCADE`
- `PendingTransaction` y `BotRule` no tienen user_id (solo usa el bot, que es del owner)
- `Transaction.origin_ref` (index): referencia de origen para dedup del import de resúmenes (migración 004)
- `DollarOp`: operaciones del baúl de dólares (migración 005). `kind ∈ {ingreso, compra, venta, retiro}`, `usd`, `rate`, `tx_id` (pata en pesos linkeada en Movimientos; al borrar la op se borra esa tx)
- `ImportAlias` (migración 006): `(user_id, pattern)` único — recuerda el nombre que el usuario le puso a un comercio al importar (`pattern` = clave normalizada del nombre original → `alias`)

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

# Alexa (opera en nombre de TELEGRAM_BOT_OWNER_ID)
ALEXA_SKILL_ID=amzn1.ask.skill.xxxx   # applicationId de la skill, para validar requests

# Gemini
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash

# JWT
JWT_SECRET=...                  # generar con: openssl rand -hex 32
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080        # 7 días
```

## Alexa (skill de voz, con Gemini)

Skill conversacional de Alexa que anota gastos/ingresos por voz, reutilizando el
**mismo entendimiento Gemini** que el bot de Telegram. "Alexa, abrí gastos" →
"gasté 10 mil en hamburguesa" → "Listo, anoté $10.000 en Comida".

- **Lógica compartida**: `backend/app/bot_core.py` (`handle_conversation`) — carga
  contexto del owner, llama a Gemini, hace branch por intent (create/delete/learn/
  unknown) y persiste. La usan tanto `routers/telegram.py` como `routers/alexa.py`
  (cada uno es un adaptador de transporte fino). `_persist` vive acá.
- **Endpoint**: `POST /alexa/webhook` (`routers/alexa.py`). Opera en nombre de
  `TELEGRAM_BOT_OWNER_ID` (mismo dueño). El historial conversacional (para
  repreguntar campos faltantes) viaja en `session.attributes` de Alexa — **no** usa
  `PendingTransaction`.
- **Variante rápida de Gemini**: Alexa exige responder en ~8s, así que
  `bot_core` llama `gemini.parse_message(..., thinking_budget=0, timeout=7.0)`
  (vs `1024`/`45s` de Telegram). `parse_telegram_message` queda como alias.
- **Seguridad** (endpoint público que escribe en DB): valida la firma de Amazon
  (cert chain + RSA/SHA1 sobre el body crudo), el timestamp (±150s, anti-replay) y
  `applicationId == ALEXA_SKILL_ID`.
- **Setup de la skill** (manual, en la Alexa Developer Console): ver
  [`docs/alexa.md`](docs/alexa.md). Modelo versionado en
  `backend/alexa/interaction_model.json` (invocation name `gastos`, intent
  `RegistrarGastoIntent` con slot `frase` = `AMAZON.SearchQuery`).

## Import de resúmenes de tarjeta (PDF)

Importa el resumen mensual de una tarjeta (Mercado Pago / Ualá) desde la web:
subir PDF → Gemini extrae los movimientos → pantalla de **revisión** (editar
categoría y nombre por fila, cotización para filas USD) → **aprobar** crea las txs.

### Flujo

1. **Entrada**: botón "Importar resumen" en `ScreenTarjetas` → `ImportResumen.jsx`
   (drag & drop del PDF o click para elegir; valida que sea PDF).
2. **`POST /import/extract`** (`UploadFile` + `tarjeta_id`): valida mime/tamaño,
   manda el PDF a Gemini como `inline_data` (sin parser de PDF; las fuentes son
   subset y no se extraen con librerías). `gemini.extract_statement` recibe la
   **fecha de hoy** para inferir el año de fechas sin año (resumen reciente → año
   actual, nunca años viejos). **No persiste**; marca duplicados.
3. **Revisión**: filas activas (editar cat + nombre, badge de cuota) y un bloque
   plegado **"Ya cargados"** arriba (duplicados, desmarcados). Filas USD: input de
   cotización (ARS = monto×cotización en vivo); el monto se guarda en ARS con
   `currency="ARS"` y `(US$ X)` anexado a la desc.
4. **`POST /import/confirm`**: expande cada fila y crea las txs (`source="import"`,
   `medio=tarjeta.nombre`, `tarjeta_id`).

### Lógica pura (`statement_import.py`, testeada sin Gemini)

- **Filtra** pagos/ajustes. **Consolida** todos los impuestos/percepciones/IVA/
  IIBB/sello/intereses en UNA fila "Impuestos Tarjetas" (cat tipo gasto).
- **Cuotas**: al aprobar una cuota "N/total" se crea la actual + TODAS las
  siguientes (N..total), nunca las anteriores. La fecha del resumen es la de
  COMPRA (cuota 1); la cuota j se factura en compra + (j-1) meses (`add_months`
  recorta al último día válido).
- **Dedup vía `origin_ref`** (`Transaction.origin_ref`):
  - Consumo: `tarjeta|fecha|slug(desc)|moneda|monto`. Cuota:
    `tarjeta|fecha|slug(desc)|cuota|N/total` (sin monto — varía por intereses).
  - El `slug` usa `_canonical_desc` que **saca el marcador de cuota** (`(11/12)`)
    para que el ref sea estable mes a mes.
  - El ref se calcula SIEMPRE con la desc **original** (no la editada/alias), así
    una cuota futura proyectada coincide con la extracción del mes siguiente.
  - Impuestos: ref estable por `fecha+monto` + **dedup por contenido**
    (`existing_impuestos_sigs`) para cubrir las ya creadas con ref viejo.
- **Alias de nombres** (`ImportAlias`): al confirmar, si la desc final ≠ original
  se guarda `alias_key(original) → desc`. En el próximo `extract`, los consumos
  del mismo comercio aparecen ya con el nombre elegido (`normalize_movimientos`
  recibe el dict de aliases). Cada fila lleva `desc` (mostrada/editable) y
  `desc_orig` (para ref/alias).

### Seguridad/privacidad

- El PDF tiene datos personales (CUIT/DNI/domicilio): se procesa **server-side**,
  **no se loguea** el contenido del PDF ni del resultado, y la `GEMINI_API_KEY`
  **nunca** se expone al frontend.

## Baúl de Dólares

`ScreenDolares` + `/dollar/*` + modelo `DollarOp`. Operaciones de tenencia en USD
(`ingreso`/`compra`/`venta`/`retiro`) con costo promedio móvil y G/P realizada/no
realizada. Las txs en USD **no** se mezclan en los totales en pesos de Movimientos/
Gastos (se filtran por `currency !== 'USD'`); su lugar es este baúl. Cotizaciones
vía `/dollar/quotes` (oficial/cripto, con cache).

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
- Webhook Alexa: https://apigastos.genoud-nube.com.ar/alexa/webhook

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
- **Import PDF sin librería de parseo**: el PDF va nativo a Gemini (`inline_data`, mime `application/pdf`) porque las fuentes subset no se extraen confiable con librerías
- **`origin_ref` sobre datos originales**: se calcula con la desc/fecha/monto originales del resumen (pre-conversión USD→ARS y pre-edición) para que el dedup sea idempotente al reimportar
- **Inputs decimales mobile**: `type="text"` + `inputMode="decimal"` + normalización coma→punto (el teclado en español muestra coma, pero `type="number"` solo acepta punto). Anti-zoom iOS: `font-size:16px` en inputs vía `@media (pointer:coarse)` en `index.css`

### Agregar ícono a una categoría nueva
1. Poner el `.svg` (monocromático) en `frontend/public/icons/cat/`
2. Agregar la entrada en `CAT_ICON_MAP` dentro de `frontend/src/components/CatIconBadge.jsx`.
   La **clave es el nombre de la categoría en minúsculas** (con espacios si los tiene,
   ej. `'impuestos tarjetas': 'impuestos-tarjetas'`). Sin esa entrada se muestra el
   punto de color de fallback aunque el SVG exista.

## Workflow de cambios

1. Crear rama nueva desde `main`
2. Commit + push
3. Crear PR a `main` vía GitHub MCP (no se puede push directo a main)
4. Mergear PR → deployar al servidor con `git pull origin main && docker compose up -d --build`
