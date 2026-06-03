"""Lógica determinística post-extracción de resúmenes de tarjeta en PDF.

Este módulo NO llama a Gemini ni a la DB: recibe la salida estructurada ya
parseada (dict) y produce las filas propuestas para la pantalla de revisión.
Todo lo testeable vive acá (filtrado de pagos/ajustes, consolidación de
impuestos, parseo de cuota, cálculo de origin_ref para dedup).
"""
from __future__ import annotations

import calendar
import re
from datetime import date

# REQUIREMENT: todos los impuestos/percepciones/IIBB/IVA/sello/intereses se
# consolidan en UNA sola transacción con esta categoría (tipo gasto).
IMPUESTOS_CAT = "Impuestos Tarjetas"

# Movimientos que NO son gastos y se descartan al importar.
_SKIP_TIPOS = {"pago", "ajuste"}


def _slug(text: str) -> str:
    """Normaliza una descripción para que el origin_ref sea estable."""
    return re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")


# Marcador de cuota embebido en la descripción que varía mes a mes
# (ej. "(11/12)" o "11 de 12") y rompería el dedup si quedara en el ref.
_CUOTA_MARKER = re.compile(r"\(?\b\d+\s*(?:/|de)\s*\d+\b\)?")


def _canonical_desc(text: str) -> str:
    """Desc canónica para el origin_ref: saca el marcador de cuota volátil.

    Así "X (11/12)" y "X (12/12)" producen el mismo ref base, y una cuota futura
    proyectada coincide con la que aparece en el resumen del mes siguiente. Los
    consumos sin marcador no cambian (dedup existente intacto).
    """
    return re.sub(r"\s+", " ", _CUOTA_MARKER.sub("", text or "")).strip()


def alias_key(desc: str) -> str:
    """Clave de alias por comercio: canónica + sin números de referencia.

    Agrupa "…JULERIAQUE…(11/12) 807692" y "…JULERIAQUE…(12/12)" en la misma
    clave, para recordar el nombre que el usuario le puso al comercio.
    """
    base = re.sub(r"\b\d{3,}\b", "", _canonical_desc(desc))
    return _slug(base)


def add_months(d: date, n: int) -> date:
    """Suma n meses a una fecha, recortando el día al último válido del mes."""
    idx = d.month - 1 + n
    year = d.year + idx // 12
    month = idx % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


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

    Se calcula sobre los datos del resumen (no sobre el valor en ARS que define el
    usuario) para que reimportar el mismo resumen sea idempotente.

    Para CUOTAS la ref identifica la compra (tarjeta + fecha de compra + desc +
    nro/total de cuota) y NO incluye el monto: así, cuando una cuota futura ya fue
    proyectada y aparece en el resumen del mes siguiente, se detecta como
    duplicada aunque el monto haya variado por intereses.
    """
    slug = _slug(_canonical_desc(desc))
    if cuota_num and cuota_total and cuota_total > 1:
        return f"{tarjeta_id}|{fecha or ''}|{slug}|cuota|{cuota_num}/{cuota_total}"
    return f"{tarjeta_id}|{fecha or ''}|{slug}|{moneda}|{monto:.2f}"


def impuestos_origin_ref(tarjeta_id: int, fecha: str | None, monto: float) -> str:
    """origin_ref estable de la fila consolidada de impuestos.

    Se basa en fecha + monto (no en el `periodo`, que es texto libre de Gemini y
    cambia entre extracciones) para que reimportar el mismo resumen sea idempotente.
    """
    return f"{tarjeta_id}|{fecha or ''}|{monto:.2f}|impuestos-tarjetas"


def impuestos_sig(fecha: str | None, monto: float) -> str:
    """Firma de contenido (fecha + monto) para dedup de impuestos por contenido."""
    return f"{fecha or ''}|{monto:.2f}"


def normalize_movimientos(
    raw: dict, tarjeta_id: int, aliases: dict[str, str] | None = None,
) -> list[dict]:
    """Convierte la salida de Gemini en filas propuestas para la revisión.

    - Descarta pagos y ajustes.
    - Cada consumo → una fila (con su cuota del período si aplica).
    - Todos los impuestos → una sola fila consolidada "Impuestos Tarjetas".
    - `aliases` (clave de comercio → nombre del usuario): si el comercio ya tiene
      un alias guardado, la fila se muestra con ese nombre (`desc`), conservando
      el original en `desc_orig` para el dedup.
    Nada se persiste acá.
    """
    aliases = aliases or {}
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
        desc_orig = (m.get("descripcion") or "").strip()
        # Si el comercio ya tiene un alias guardado, mostramos ese nombre.
        desc = aliases.get(alias_key(desc_orig), desc_orig)
        cat = (m.get("cat_sugerida") or "").strip() or "Otros"
        rows.append({
            "date": fecha,
            "desc": desc,
            "desc_orig": desc_orig,
            "amount": monto,
            "currency": moneda,
            "cuota_num": cuota_num,
            "cuota_total": cuota_total,
            "cat": cat,
            "tipo": "consumo",
            "needs_rate": moneda == "USD",
            # El ref se calcula SIEMPRE con la desc original (no la del alias/edición).
            "origin_ref": compute_origin_ref(
                tarjeta_id, fecha, desc_orig, moneda, monto, cuota_num, cuota_total
            ),
        })

    if has_impuesto and round(impuesto_total, 2) != 0:
        imp_fecha = max(impuesto_fechas) if impuesto_fechas else None
        imp_monto = round(impuesto_total, 2)
        rows.append({
            "date": imp_fecha,
            "desc": IMPUESTOS_CAT,
            "desc_orig": IMPUESTOS_CAT,
            "amount": imp_monto,
            "currency": "ARS",
            "cuota_num": None,
            "cuota_total": None,
            "cat": IMPUESTOS_CAT,
            "tipo": "impuesto",
            "needs_rate": False,
            "origin_ref": impuestos_origin_ref(tarjeta_id, imp_fecha, imp_monto),
        })

    return rows


def mark_duplicates(rows: list[dict], existing_refs: set[str]) -> list[dict]:
    """Marca cada fila cuyo origin_ref ya existe (para no reimportar)."""
    for r in rows:
        r["duplicate"] = r.get("origin_ref") in existing_refs
    return rows


def expand_row(row: dict, tarjeta_id: int) -> list[dict]:
    """Expande una fila aprobada en las transacciones concretas a crear.

    REQUIREMENT: al aprobar una cuota "N/total" se crea la cuota actual y TODAS
    las siguientes (N..total) — nunca las anteriores. Cada cuota futura se fecha
    un mes después de la previa y lleva su propio origin_ref, de modo que cuando
    aparezca en el resumen del mes que viene se detecte como duplicada.

    `row` trae los datos ORIGINALES del resumen (date, desc, amount, currency,
    cuota_num, cuota_total, origin_ref) más las ediciones del usuario (cat y, para
    filas en USD, rate). El monto en USD se convierte a ARS con la cotización.
    """
    fecha = row["date"]                       # datetime.date
    desc = row.get("desc") or ""
    # Nombre ORIGINAL del resumen (para el ref); cae a `desc` si no vino.
    desc_orig = row.get("desc_orig") or desc
    currency = (row.get("currency") or "ARS").upper()
    monto = float(row["amount"])
    cat = row.get("cat") or "Otros"
    rate = row.get("rate")
    cuota_num = row.get("cuota_num")
    cuota_total = row.get("cuota_total")

    ars = monto * float(rate) if currency == "USD" and rate else monto
    stored_desc = f"{desc} (US$ {monto:g})" if currency == "USD" else desc

    is_cuota = bool(cuota_num and cuota_total and cuota_total > 1 and 1 <= cuota_num <= cuota_total)
    out: list[dict] = []

    if is_cuota:
        for j in range(cuota_num, cuota_total + 1):
            # La cuota actual reusa el origin_ref del extract (consistencia); las
            # futuras se calculan con la desc ORIGINAL (no la editada/alias), para
            # que coincidan con la extracción del mes siguiente.
            ref = row["origin_ref"] if j == cuota_num else compute_origin_ref(
                tarjeta_id, fecha, desc_orig, currency, monto, j, cuota_total
            )
            out.append({
                # En MP la fecha del resumen es la de COMPRA (cuota 1); la cuota j
                # se factura en compra + (j-1) meses.
                "date": add_months(fecha, j - 1),
                "desc": stored_desc,
                "cat": cat,
                "amount": ars,
                "cuota_num": j,
                "cuota_total": cuota_total,
                "origin_ref": ref,
            })
    else:
        out.append({
            "date": fecha,
            "desc": stored_desc,
            "cat": cat,
            "amount": ars,
            "cuota_num": None,
            "cuota_total": None,
            "origin_ref": row["origin_ref"],
        })

    return out
