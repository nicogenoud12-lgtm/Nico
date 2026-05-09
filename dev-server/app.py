"""Dev server FastAPI con storage JSON.

Replica el contrato HTTP del backend de prod (`/transactions`, `/categories`,
etc.) para que el frontend funcione tal cual, y agrega endpoints de simulación
(`/bot/gasto`, `/cron/recurrentes`, `/dev/reset`) para validar features
planificadas sin tocar la DB real.
"""
from __future__ import annotations

import datetime as dt
import sys
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

# Permitir `python app.py` y también `uvicorn app:app` desde el dir
sys.path.insert(0, str(Path(__file__).parent))
import bot_parser  # noqa: E402
import recurrentes  # noqa: E402
import schemas  # noqa: E402
import storage  # noqa: E402


app = FastAPI(title="Gastos Dev Server", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── helpers ──────────────────────────────────────────────────
def _date_to_month(d: dt.date) -> str:
    return f"{d.month:02d}{d.year % 100:02d}"


def _serialize_tx(tx: dict) -> dict:
    """Devuelve la tx en el shape que espera el frontend (con `amount` y `cat_kind`)."""
    state = storage.load()
    cats_by_id = {c["id"]: c for c in state["categories"]}
    mediums_by_id = {m["id"]: m for m in state["mediums"]}
    cat = cats_by_id.get(tx.get("cat_id")) or {}
    medio = mediums_by_id.get(tx.get("medio_id")) or {}
    return {
        "id": tx["id"],
        "month": tx["month"],
        "date": tx["date"],
        "desc": tx.get("desc", ""),
        "cat": cat.get("name", tx.get("cat", "")),
        "cat_kind": cat.get("kind", tx.get("cat_kind", "gasto")),
        "medio": medio.get("name", tx.get("medio", "")),
        "amount": tx.get("amt", tx.get("amount", 0.0)),
        "type": tx.get("type", "g"),
        "currency": tx.get("currency", "ARS"),
        "cuota_num": tx.get("cuota_num"),
        "cuota_total": tx.get("cuota_total"),
        "tarjeta_id": tx.get("tarjeta_id"),
        "parent_tx_id": tx.get("parent_tx_id"),
        "source": tx.get("source", "web"),
    }


def _get_or_create_category(name: str, kind: str = "gasto") -> dict:
    state = storage.load()
    for c in state["categories"]:
        if c["name"] == name:
            return c
    cat = {
        "id": storage.next_id("categories"),
        "name": name,
        "color": "#b0aaaa",
        "kind": kind,
        "position": storage.next_position("categories"),
    }
    state["categories"].append(cat)
    storage.persist()
    return cat


def _get_or_create_medium(name: str) -> Optional[dict]:
    if not name:
        return None
    state = storage.load()
    for m in state["mediums"]:
        if m["name"] == name:
            return m
    m = {
        "id": storage.next_id("mediums"),
        "name": name,
        "position": storage.next_position("mediums"),
    }
    state["mediums"].append(m)
    storage.persist()
    return m


# ════════════════════════════════════════════════════════════
# Health
# ════════════════════════════════════════════════════════════
@app.get("/health")
def health():
    return {"ok": True, "mode": "dev"}


# ════════════════════════════════════════════════════════════
# Transactions
# ════════════════════════════════════════════════════════════
def _list_txs():
    state = storage.load()
    txs = sorted(state["transactions"], key=lambda t: (t.get("date", ""), t.get("id", 0)), reverse=True)
    return [_serialize_tx(t) for t in txs]


@app.get("/transactions")
def get_transactions():
    return _list_txs()


@app.get("/movimientos")
def get_movimientos():
    """Alias en español pedido en el plan."""
    return _list_txs()


@app.post("/transactions", status_code=201)
def post_transaction(payload: schemas.TransactionCreate):
    state = storage.load()
    cat = _get_or_create_category(
        payload.cat, kind="ingreso" if payload.type == "i" else "gasto"
    )
    medium = _get_or_create_medium(payload.medio or "")
    tx_date = payload.date
    if isinstance(tx_date, str):
        tx_date = dt.date.fromisoformat(tx_date)
    month = payload.month or _date_to_month(tx_date)
    tx = {
        "id": storage.next_id("transactions"),
        "month": month,
        "date": tx_date.isoformat(),
        "desc": payload.desc or "",
        "cat_id": cat["id"],
        "medio_id": (medium or {}).get("id"),
        "medio": (medium or {}).get("name", ""),
        "tarjeta_id": payload.tarjeta_id,
        "amt": float(payload.amount),
        "type": payload.type,
        "currency": payload.currency,
        "cuota_num": payload.cuota_num,
        "cuota_total": payload.cuota_total,
        "parent_tx_id": payload.parent_tx_id,
        "source": "web",
        "created_at": dt.datetime.utcnow().isoformat(),
    }
    state["transactions"].append(tx)
    storage.persist()
    return _serialize_tx(tx)


@app.put("/transactions/{tx_id}")
def put_transaction(tx_id: int, payload: schemas.TransactionUpdate):
    state = storage.load()
    tx = next((t for t in state["transactions"] if t["id"] == tx_id), None)
    if not tx:
        raise HTTPException(404, "Transaction not found")
    data = payload.model_dump(exclude_unset=True)
    if "cat" in data and data["cat"]:
        kind = "ingreso" if (data.get("type") or tx.get("type")) == "i" else "gasto"
        cat = _get_or_create_category(data.pop("cat"), kind=kind)
        tx["cat_id"] = cat["id"]
    if "medio" in data:
        medium = _get_or_create_medium(data.pop("medio") or "")
        tx["medio_id"] = (medium or {}).get("id")
        tx["medio"] = (medium or {}).get("name", "")
    if "amount" in data:
        tx["amt"] = float(data.pop("amount"))
    if "date" in data and data["date"] is not None:
        d = data["date"]
        if isinstance(d, str):
            d = dt.date.fromisoformat(d)
        tx["date"] = d.isoformat()
        tx["month"] = _date_to_month(d)
        data.pop("date", None)
    for k, v in data.items():
        if v is not None:
            tx[k] = v
    storage.persist()
    return _serialize_tx(tx)


@app.delete("/transactions/{tx_id}", status_code=204)
def delete_transaction(tx_id: int):
    state = storage.load()
    before = len(state["transactions"])
    state["transactions"] = [t for t in state["transactions"] if t["id"] != tx_id]
    if len(state["transactions"]) == before:
        raise HTTPException(404, "Transaction not found")
    storage.persist()
    return None


# ════════════════════════════════════════════════════════════
# Categories / Mediums / Tarjetas / Recurrentes / Months
# ════════════════════════════════════════════════════════════
def _crud_factory(collection: str, create_schema, update_schema):
    """Genera handlers genéricos para colecciones simples."""
    def list_all():
        state = storage.load()
        return sorted(state[collection], key=lambda r: (r.get("position", 0), r.get("id", 0)))

    def create(payload):
        state = storage.load()
        row = payload.model_dump()
        row["id"] = storage.next_id(collection)
        row["position"] = storage.next_position(collection)
        state[collection].append(row)
        storage.persist()
        return row

    def update(item_id: int, payload):
        state = storage.load()
        row = next((r for r in state[collection] if r["id"] == item_id), None)
        if not row:
            raise HTTPException(404, f"{collection} not found")
        for k, v in payload.model_dump(exclude_unset=True).items():
            if v is not None:
                row[k] = v
        storage.persist()
        return row

    def delete(item_id: int):
        state = storage.load()
        before = len(state[collection])
        state[collection] = [r for r in state[collection] if r["id"] != item_id]
        if len(state[collection]) == before:
            raise HTTPException(404, f"{collection} not found")
        storage.persist()
        return None

    def reorder(payload: schemas.ReorderPayload):
        state = storage.load()
        for pos, rid in enumerate(payload.ids):
            for r in state[collection]:
                if r["id"] == rid:
                    r["position"] = pos
        storage.persist()
        return None

    return list_all, create, update, delete, reorder


# Categories
_cat_list, _cat_create, _cat_update, _cat_delete, _cat_reorder = _crud_factory(
    "categories", schemas.CategoryCreate, schemas.CategoryUpdate
)


@app.get("/categories")
def get_categories():
    return _cat_list()


@app.post("/categories", status_code=201)
def post_category(payload: schemas.CategoryCreate):
    return _cat_create(payload)


@app.put("/categories/{cat_id}")
def put_category(cat_id: int, payload: schemas.CategoryUpdate):
    return _cat_update(cat_id, payload)


@app.delete("/categories/{cat_id}", status_code=204)
def del_category(cat_id: int):
    return _cat_delete(cat_id)


@app.post("/categories/reorder", status_code=204)
def reorder_categories(payload: schemas.ReorderPayload):
    return _cat_reorder(payload)


# Mediums
_med_list, _med_create, _med_update, _med_delete, _med_reorder = _crud_factory(
    "mediums", schemas.MediumCreate, schemas.MediumUpdate
)


@app.get("/mediums")
def get_mediums():
    return _med_list()


@app.post("/mediums", status_code=201)
def post_medium(payload: schemas.MediumCreate):
    return _med_create(payload)


@app.put("/mediums/{mid}")
def put_medium(mid: int, payload: schemas.MediumUpdate):
    return _med_update(mid, payload)


@app.delete("/mediums/{mid}", status_code=204)
def del_medium(mid: int):
    return _med_delete(mid)


@app.post("/mediums/reorder", status_code=204)
def reorder_mediums(payload: schemas.ReorderPayload):
    return _med_reorder(payload)


# Tarjetas
_tar_list, _tar_create, _tar_update, _tar_delete, _tar_reorder = _crud_factory(
    "tarjetas", schemas.TarjetaCreate, schemas.TarjetaUpdate
)


@app.get("/tarjetas")
def get_tarjetas():
    return _tar_list()


@app.post("/tarjetas", status_code=201)
def post_tarjeta(payload: schemas.TarjetaCreate):
    row = _tar_create(payload)
    # Auto-crear medium homónimo (paridad con backend prod)
    _get_or_create_medium(row["nombre"])
    return row


@app.put("/tarjetas/{tid}")
def put_tarjeta(tid: int, payload: schemas.TarjetaUpdate):
    return _tar_update(tid, payload)


@app.delete("/tarjetas/{tid}", status_code=204)
def del_tarjeta(tid: int):
    return _tar_delete(tid)


@app.post("/tarjetas/reorder", status_code=204)
def reorder_tarjetas(payload: schemas.ReorderPayload):
    return _tar_reorder(payload)


# Recurrentes
_rec_list, _rec_create, _rec_update, _rec_delete, _rec_reorder = _crud_factory(
    "recurrentes", schemas.RecurrenteCreate, schemas.RecurrenteUpdate
)


@app.get("/recurrentes")
def get_recurrentes():
    return _rec_list()


@app.post("/recurrentes", status_code=201)
def post_recurrente(payload: schemas.RecurrenteCreate):
    return _rec_create(payload)


@app.put("/recurrentes/{rid}")
def put_recurrente(rid: int, payload: schemas.RecurrenteUpdate):
    return _rec_update(rid, payload)


@app.delete("/recurrentes/{rid}", status_code=204)
def del_recurrente(rid: int):
    return _rec_delete(rid)


@app.post("/recurrentes/reorder", status_code=204)
def reorder_recurrentes(payload: schemas.ReorderPayload):
    return _rec_reorder(payload)


# Months
@app.get("/months")
def get_months():
    state = storage.load()
    return state.get("months", [])


# ════════════════════════════════════════════════════════════
# Bot mock
# ════════════════════════════════════════════════════════════
@app.post("/bot/gasto")
def bot_gasto(payload: schemas.BotGastoIn):
    state = storage.load()
    tarjetas_names = [t["nombre"] for t in state["tarjetas"]]
    parsed = bot_parser.parse(payload.text, known_tarjetas=tarjetas_names)

    if "total_amt" not in parsed or not parsed.get("desc"):
        return JSONResponse(
            status_code=422,
            content={
                "parsed": parsed,
                "transactions": [],
                "reply": "No pude identificar el gasto. Probá: 'Compré X con tarjeta Y en N cuotas de M'",
            },
        )

    cuota_total = int(parsed.get("cuota_total", 1)) or 1
    unit_amt = float(parsed.get("unit_amt") or (parsed["total_amt"] / cuota_total))

    # Resolver tarjeta → tarjeta_id, medio_id
    tarjeta_row = None
    if parsed.get("tarjeta"):
        for t in state["tarjetas"]:
            if t["nombre"].lower() == parsed["tarjeta"].lower():
                tarjeta_row = t
                break

    medio_name = tarjeta_row["nombre"] if tarjeta_row else "Contado"
    medium = _get_or_create_medium(medio_name)
    cat = _get_or_create_category("Otros", kind="gasto")

    base_date = dt.date.today()
    parent_id = None
    created: list[dict] = []
    for i in range(cuota_total):
        d = base_date.replace(day=min(base_date.day, 28))
        # Sumar i meses
        month = d.month + i
        year = d.year + (month - 1) // 12
        month = ((month - 1) % 12) + 1
        d_i = dt.date(year, month, min(d.day, 28))
        tx_id = storage.next_id("transactions")
        if i == 0:
            parent_id = tx_id
        tx = {
            "id": tx_id,
            "month": _date_to_month(d_i),
            "date": d_i.isoformat(),
            "desc": parsed["desc"],
            "cat_id": cat["id"],
            "medio_id": (medium or {}).get("id"),
            "medio": medio_name,
            "tarjeta_id": (tarjeta_row or {}).get("id"),
            "amt": float(unit_amt),
            "type": "g",
            "currency": "ARS",
            "cuota_num": (i + 1) if cuota_total > 1 else None,
            "cuota_total": cuota_total if cuota_total > 1 else None,
            "parent_tx_id": parent_id if i > 0 else None,
            "source": "telegram",
            "created_at": dt.datetime.utcnow().isoformat(),
        }
        state["transactions"].append(tx)
        created.append(tx)

    storage.persist()

    if cuota_total > 1:
        reply = (
            f"✅ {parsed['desc']} ${parsed['total_amt']:.0f} con {medio_name}, "
            f"{cuota_total} cuotas de ${unit_amt:.0f}."
        )
    else:
        reply = f"✅ {parsed['desc']} ${parsed['total_amt']:.0f} con {medio_name}."

    return {
        "parsed": parsed,
        "transactions": [_serialize_tx(t) for t in created],
        "reply": reply,
    }


# ════════════════════════════════════════════════════════════
# Cron simulado
# ════════════════════════════════════════════════════════════
@app.post("/cron/recurrentes")
def cron_recurrentes(month: Optional[str] = Query(None, description="MMYY; default=mes actual")):
    created = recurrentes.run_for_month(month)
    return {
        "target_month": month or "current",
        "created": [_serialize_tx(t) for t in created],
        "count": len(created),
    }


# ════════════════════════════════════════════════════════════
# Dev utilities
# ════════════════════════════════════════════════════════════
@app.post("/dev/reset")
def dev_reset():
    storage.reset_to_seed()
    state = storage.load()
    return {
        "ok": True,
        "transactions": len(state["transactions"]),
        "categories": len(state["categories"]),
    }


# ════════════════════════════════════════════════════════════
# Static files (SIEMPRE último)
# ════════════════════════════════════════════════════════════
_STATIC_DIR = Path(__file__).parent / "static"
if _STATIC_DIR.exists() and any(_STATIC_DIR.iterdir()):
    app.mount("/", StaticFiles(directory=str(_STATIC_DIR), html=True), name="static")
else:
    @app.get("/")
    def root_no_static():
        return {
            "ok": True,
            "msg": "Dev server activo. El frontend no fue buildeado todavía. "
                   "Corré ./run_dev_server.sh o usá Vite por separado.",
        }
