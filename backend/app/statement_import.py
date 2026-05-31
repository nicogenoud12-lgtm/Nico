"""Lógica determinística post-extracción de resúmenes de tarjeta en PDF.

Este módulo NO llama a Gemini ni a la DB: recibe la salida estructurada ya
parseada (dict) y produce las filas propuestas para la pantalla de revisión.
Todo lo testeable vive acá (filtrado de pagos/ajustes, consolidación de
impuestos, parseo de cuota, cálculo de origin_ref para dedup).
"""
from __future__ import annotations

import re

# REQUIREMENT: todos los impuestos/percepciones/IIBB/IVA/sello/intereses se
# consolidan en UNA sola transacción con esta categoría (tipo gasto).
IMPUESTOS_CAT = "Impuestos Tarjetas"

# Movimientos que NO son gastos y se descartan al importar.
_SKIP_TIPOS = {"pago", "ajuste"}


def _slug(text: str) -> str:
    """Normaliza una descripción para que el origin_ref sea estable."""
    return re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")


def compute_origin_ref(
    tarjeta_id: int,
    fecha: str | None,
    desc: str,
    moneda: str,
    monto: float,
    cuota_num: int | None,
    cuota_total: int | None,
) -> str:
    """Referencia de origen estable de un consumo (datos ORIGINALES, pre-conversión).

    Se calcula sobre el monto/moneda del resumen (no sobre el valor en ARS que
    define el usuario) para que reimportar el mismo resumen sea idempotente.
    """
    return (
        f"{tarjeta_id}|{fecha or ''}|{_slug(desc)}|{moneda}|{monto:.2f}"
        f"|{cuota_num or ''}/{cuota_total or ''}"
    )


def impuestos_origin_ref(tarjeta_id: int, periodo: str | None) -> str:
    """origin_ref de la fila consolidada de impuestos del período."""
    return f"{tarjeta_id}|{periodo or ''}|impuestos-tarjetas"


def normalize_movimientos(raw: dict, tarjeta_id: int) -> list[dict]:
    """Convierte la salida de Gemini en filas propuestas para la revisión.

    - Descarta pagos y ajustes.
    - Cada consumo → una fila (con su cuota del período si aplica).
    - Todos los impuestos → una sola fila consolidada "Impuestos Tarjetas".
    Nada se persiste acá.
    """
    periodo = raw.get("periodo")
    rows: list[dict] = []

    impuesto_total = 0.0
    impuesto_fechas: list[str] = []
    has_impuesto = False

    for m in raw.get("movimientos") or []:
        tipo = (m.get("tipo") or "consumo").lower()
        if tipo in _SKIP_TIPOS:
            continue

        fecha = m.get("fecha")
        try:
            monto = float(m.get("monto") or 0)
        except (TypeError, ValueError):
            continue

        if tipo == "impuesto":
            has_impuesto = True
            impuesto_total += monto
            if fecha:
                impuesto_fechas.append(fecha)
            continue

        # consumo
        moneda = (m.get("moneda") or "ARS").upper()
        cuota_num = m.get("cuota_num")
        cuota_total = m.get("cuota_total")
        desc = (m.get("descripcion") or "").strip()
        cat = (m.get("cat_sugerida") or "").strip() or "Otros"
        rows.append({
            "date": fecha,
            "desc": desc,
            "amount": monto,
            "currency": moneda,
            "cuota_num": cuota_num,
            "cuota_total": cuota_total,
            "cat": cat,
            "tipo": "consumo",
            "needs_rate": moneda == "USD",
            "origin_ref": compute_origin_ref(
                tarjeta_id, fecha, desc, moneda, monto, cuota_num, cuota_total
            ),
        })

    if has_impuesto and round(impuesto_total, 2) != 0:
        rows.append({
            "date": max(impuesto_fechas) if impuesto_fechas else None,
            "desc": IMPUESTOS_CAT,
            "amount": round(impuesto_total, 2),
            "currency": "ARS",
            "cuota_num": None,
            "cuota_total": None,
            "cat": IMPUESTOS_CAT,
            "tipo": "impuesto",
            "needs_rate": False,
            "origin_ref": impuestos_origin_ref(tarjeta_id, periodo),
        })

    return rows


def mark_duplicates(rows: list[dict], existing_refs: set[str]) -> list[dict]:
    """Marca cada fila cuyo origin_ref ya existe (para no reimportar)."""
    for r in rows:
        r["duplicate"] = r.get("origin_ref") in existing_refs
    return rows
