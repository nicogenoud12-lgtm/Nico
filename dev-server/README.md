# Dev Server — Gastos App

Servidor mock liviano (FastAPI + JSON) para validar el frontend y la lógica de
features planificadas (cuotas, gastos recurrentes, bot NLP) **sin tocar la DB
real ni el backend de prod**.

## Levantar

### Modo "todo en uno" (un solo proceso, frontend buildeado)
```bash
./run_dev_server.sh
```
Abre `http://localhost:8010` con el frontend servido.

### Modo "hot reload" (Vite dev server + dev API)
Terminal 1:
```bash
cd dev-server
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8010
```

Terminal 2:
```bash
cd frontend
VITE_API_BASE_URL=http://localhost:8010 npm run dev
```

Abre `http://localhost:5173`.

## Endpoints

### CRUD (mismo contrato que el backend de prod)
| Método | Path | Descripción |
|---|---|---|
| `GET` | `/transactions` | Lista todas las transacciones |
| `GET` | `/movimientos` | Alias en español de `/transactions` |
| `POST` | `/transactions` | Crea una transacción |
| `PUT` | `/transactions/{id}` | Modifica |
| `DELETE` | `/transactions/{id}` | Elimina |
| `GET/POST/PUT/DELETE` | `/categories` | CRUD categorías |
| `POST` | `/categories/reorder` | Reordena |
| `GET/POST/PUT/DELETE` | `/mediums` | CRUD medios |
| `GET/POST/PUT/DELETE` | `/tarjetas` | CRUD tarjetas |
| `GET/POST/PUT/DELETE` | `/suscripciones` | CRUD recurrentes |
| `GET` | `/months` | Lista de meses |
| `GET` | `/health` | Health check |

### Simulación
| Método | Path | Descripción |
|---|---|---|
| `POST` | `/bot/gasto` | Simula el webhook del bot. Body: `{"text": "..."}`. Parsea cuotas y tarjeta, crea N transacciones. |
| `POST` | `/cron/suscripciones?month=MMYY` | Ejecuta el cron de gastos recurrentes para el mes objetivo (default: actual). |
| `POST` | `/dev/reset` | Resetea `dev_data.json` desde `seed_data.json`. |

## Ejemplos

### Bot — gasto en cuotas con tarjeta
```bash
curl -X POST http://localhost:8010/bot/gasto \
  -H "Content-Type: application/json" \
  -d '{"text":"Compré tele con tarjeta Naranja X en 6 cuotas de 100000"}'
```
Respuesta (resumida):
```json
{
  "parsed": {"desc": "tele", "tarjeta": "Naranja X", "cuota_total": 6, "unit_amt": 100000, "total_amt": 600000},
  "transactions": [...6 txs con cuota_num 1..6, parent_tx_id encadenado...],
  "reply": "✅ tele $600000 con Naranja X, 6 cuotas de $100000."
}
```

### Bot — gasto simple, default Contado
```bash
curl -X POST http://localhost:8010/bot/gasto \
  -H "Content-Type: application/json" \
  -d '{"text":"Gasté 5000 en kiosko"}'
```

### Cron — inyectar Internet (suscripcion auto_create) en junio 2026
```bash
curl -X POST 'http://localhost:8010/cron/suscripciones?month=0626'
```
Llamarlo dos veces consecutivas: la segunda no debe duplicar (idempotencia por `last_run_month`).

### Reset
```bash
curl -X POST http://localhost:8010/dev/reset
```

## Datos

- `seed_data.json` — estado inicial (committed). Editalo para cambiar fixtures.
- `dev_data.json` — estado vivo, mutable. **Está en `.gitignore`** (no se sube).
- Para volver al seed: `POST /dev/reset` o eliminar `dev_data.json`.

## Estructura

```
dev-server/
├── app.py              # FastAPI app + endpoints + static mount
├── storage.py          # I/O JSON atómico, ids auto-incrementales
├── bot_parser.py       # Regex parser tipo NLP del bot
├── recurrentes.py      # Simulador del cron de suscripciones
├── schemas.py          # Pydantic models (con cat_kind y campos forward-looking)
├── seed_data.json      # Fixtures iniciales
├── requirements.txt    # fastapi, uvicorn, pydantic
└── README.md
```

## Notas

- El parser del bot es **regex**, no Gemini. Cubre los patrones más comunes
  ("Compré X con tarjeta Y en N cuotas de M", "Gasté $X en Y").
- Los campos `parent_tx_id`, `dia_mes`, `auto_create`, `last_run_month` son
  **forward-looking**: existen para que podamos validar el flujo aunque la DB
  de prod todavía no los tenga.
- No reemplaza al backend de prod. Es un sandbox.
