# Gastos – Backend

API FastAPI + SQLite + webhook conversacional de Telegram.

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                # editar TELEGRAM_BOT_TOKEN, etc.
uvicorn app.main:app --reload --port 8000
```

Docs interactivas: http://localhost:8000/docs

## Endpoints REST

| Método | Path | Descripción |
| --- | --- | --- |
| GET | `/transactions` | Listar movimientos |
| POST | `/transactions` | Crear movimiento |
| PUT | `/transactions/{id}` | Editar movimiento |
| DELETE | `/transactions/{id}` | Eliminar movimiento |
| GET/POST/PUT/DELETE | `/categories` | CRUD categorías |
| POST | `/categories/reorder` | Reordenar (`{ ids: [] }`) |
| GET/POST/PUT/DELETE | `/mediums` | CRUD medios de pago |
| POST | `/mediums/reorder` | Reordenar |
| GET | `/months` | Meses con saldo inicial / cuotas |
| POST | `/telegram/webhook` | Webhook de Telegram |
| GET | `/health` | Liveness |

Las transacciones se serializan al shape `{ id, month, date, desc, cat, medio, amt, type, source }`.

## Bot de Telegram

### 1. Crear bot

Hablar con [@BotFather](https://t.me/BotFather) → `/newbot` → guardar el token en `.env`:

```
TELEGRAM_BOT_TOKEN=123456789:AA...
TELEGRAM_WEBHOOK_SECRET=algo-larguito-y-aleatorio
ALLOWED_TELEGRAM_USER_IDS=123456789      # tu user id (sacalo de @userinfobot)
```

### 2. Exponer el backend a internet

```bash
# Cloudflare tunnel (rápido y sin cuenta)
cloudflared tunnel --url http://localhost:8000

# o ngrok
ngrok http 8000
```

### 3. Registrar el webhook

```bash
TOKEN="<TELEGRAM_BOT_TOKEN>"
SECRET="<TELEGRAM_WEBHOOK_SECRET>"
URL="https://<tu-tunel>/telegram/webhook"

curl -X POST "https://api.telegram.org/bot${TOKEN}/setWebhook" \
  -d "url=${URL}" \
  -d "secret_token=${SECRET}"
```

Verificar: `curl https://api.telegram.org/bot${TOKEN}/getWebhookInfo`

### 4. Hablarle al bot

El parser tolera lenguaje natural y orden libre:

| Mensaje | Resultado |
| --- | --- |
| `15000 asado comida mp` | tx: −15.000, Comida, MP, "asado" |
| `hoy gasté 15000 en una hamburguesa y pagué con transferencia` | tx: −15.000, Comida, Transferencia, "hamburguesa" |
| `cobré 750000 sueldo` | tx: +750.000, Ingresos, MP, "sueldo" |
| `me comí una hamburguesa de 15000` *(falta medio)* | bot: *"Dale, ¿con qué pagaste?…"* — respondés `transferencia` y se anota |
| `gasté 8000 en una cosita con MP` *(falta categoría)* | bot: *"¿En qué lo metés?"* — respondés `comida` y se anota |

El estado pendiente se guarda en la tabla `pending_transactions` (TTL 30 min).

## Configuración

Variables de entorno (ver `.env.example`):

- `DATABASE_URL` – default `sqlite:///./gastos.db`.
- `CORS_ORIGINS` – `*` en dev, en prod restringir al dominio Vercel.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `ALLOWED_TELEGRAM_USER_IDS`.
- `SEED_DEMO_TX` – flag (no implementado por ahora; categorías/medios/meses sí seedan).
