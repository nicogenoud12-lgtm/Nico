"""Simulador del CRON de gastos recurrentes.

Recorre `suscripciones` con `auto_create=true`, `dia_mes` definido y `estado='activo'`.
Para cada una que no haya sido procesada para el `target_month` (MMYY), crea una
Transaction con la fecha del día indicado y actualiza `last_run_month`.
"""
from __future__ import annotations

import datetime as dt
from typing import Any

import storage


def _build_date(month_id: str, day: int) -> dt.date:
    """month_id es 'MMYY'. Devuelve fecha clamped al último día del mes si hace falta."""
    mm = int(month_id[:2])
    yy = 2000 + int(month_id[2:])
    # Último día del mes
    if mm == 12:
        next_month = dt.date(yy + 1, 1, 1)
    else:
        next_month = dt.date(yy, mm + 1, 1)
    last = (next_month - dt.timedelta(days=1)).day
    safe_day = max(1, min(day, last))
    return dt.date(yy, mm, safe_day)


def _current_month_id() -> str:
    today = dt.date.today()
    return f"{today.month:02d}{today.year % 100:02d}"


def run_for_month(target_month: str | None = None) -> list[dict]:
    """Ejecuta el cron para el mes objetivo. Retorna las transacciones creadas."""
    target_month = target_month or _current_month_id()
    state = storage.load()

    cats_by_id = {c["id"]: c for c in state.get("categories", [])}
    mediums_by_id = {m["id"]: m for m in state.get("mediums", [])}

    created: list[dict] = []
    for s in state.get("suscripciones", []):
        if s.get("estado") != "activo":
            continue
        if not s.get("auto_create"):
            continue
        if not s.get("dia_mes"):
            continue
        if s.get("last_run_month") == target_month:
            continue
        cat = cats_by_id.get(s.get("cat_id"))
        medio = mediums_by_id.get(s.get("medio_id"))
        if not cat:
            continue

        date = _build_date(target_month, int(s["dia_mes"]))
        tx_id = storage.next_id("transactions")
        tx = {
            "id": tx_id,
            "month": target_month,
            "date": date.isoformat(),
            "desc": s["nombre"],
            "cat_id": cat["id"],
            "cat": cat["name"],
            "cat_kind": cat.get("kind", "gasto"),
            "medio_id": (medio or {}).get("id"),
            "medio": (medio or {}).get("name", ""),
            "tarjeta_id": s.get("tarjeta_id"),
            "amt": float(s["monto"]),
            "type": "g",
            "currency": s.get("moneda", "ARS"),
            "cuota_num": None,
            "cuota_total": None,
            "parent_tx_id": None,
            "source": "cron",
            "created_at": dt.datetime.utcnow().isoformat(),
        }
        state["transactions"].append(tx)
        s["last_run_month"] = target_month
        created.append(tx)

    storage.persist()
    return created
