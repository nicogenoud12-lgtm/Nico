"""Tests de la lógica determinística post-extracción (sin llamar a Gemini).

Las fixtures imitan la salida estructurada de Gemini para un resumen de
Mercado Pago y uno de Ualá. Toda la lógica de negocio (filtrar pagos/ajustes,
consolidar impuestos, parsear cuota, calcular dedup) se prueba acá.
"""
from app import statement_import
from app.statement_import import (
    IMPUESTOS_CAT,
    compute_origin_ref,
    mark_duplicates,
    normalize_movimientos,
)


# Salida simulada de Gemini para un resumen de Mercado Pago.
MP_RAW = {
    "periodo": "2026-04",
    "movimientos": [
        {"fecha": "2026-04-05", "descripcion": "Adidas", "monto": 41666.33,
         "moneda": "ARS", "tipo": "consumo", "cuota_num": 4, "cuota_total": 6,
         "cat_sugerida": "Ropa"},
        {"fecha": "2026-04-13", "descripcion": "Spotify", "monto": 8413.47,
         "moneda": "ARS", "tipo": "consumo", "cat_sugerida": "Suscripciones"},
        {"fecha": "2026-04-18", "descripcion": "Claude.ai", "monto": 20.0,
         "moneda": "USD", "tipo": "consumo", "cat_sugerida": ""},
        {"fecha": "2026-04-20", "descripcion": "IVA", "monto": 1000.0,
         "moneda": "ARS", "tipo": "impuesto"},
        {"fecha": "2026-04-20", "descripcion": "Percepción RG 4815", "monto": 500.0,
         "moneda": "ARS", "tipo": "impuesto"},
        {"fecha": "2026-04-21", "descripcion": "Intereses financiación", "monto": 250.5,
         "moneda": "ARS", "tipo": "impuesto"},
        {"fecha": "2026-04-10", "descripcion": "Su pago en pesos", "monto": 99999.0,
         "moneda": "ARS", "tipo": "pago"},
        {"fecha": "2026-04-12", "descripcion": "Reintegro promo", "monto": 300.0,
         "moneda": "ARS", "tipo": "ajuste"},
    ],
}

# Salida simulada de Gemini para un resumen de Ualá.
UALA_RAW = {
    "periodo": "2026-04",
    "movimientos": [
        {"fecha": "2026-04-29", "descripcion": "SHOPNOW (10/12)", "monto": 150000.0,
         "moneda": "ARS", "tipo": "consumo", "cuota_num": 10, "cuota_total": 12,
         "cat_sugerida": "Otros"},
        {"fecha": "2026-04-15", "descripcion": "Mercadito", "monto": 5000.0,
         "moneda": "ARS", "tipo": "consumo", "cat_sugerida": "Comida"},
        {"fecha": "2026-04-30", "descripcion": "Impuesto de sellos", "monto": 750.0,
         "moneda": "ARS", "tipo": "impuesto"},
        {"fecha": "2026-04-08", "descripcion": "Pago recibido", "monto": 50000.0,
         "moneda": "ARS", "tipo": "pago"},
    ],
}


def _consumos(rows):
    return [r for r in rows if r["tipo"] == "consumo"]


def _impuestos(rows):
    return [r for r in rows if r["tipo"] == "impuesto"]


# ── Filtrado de pagos/ajustes ────────────────────────────────
def test_excluye_pagos_y_ajustes_mp():
    rows = normalize_movimientos(MP_RAW, tarjeta_id=7)
    descs = [r["desc"] for r in rows]
    assert "Su pago en pesos" not in descs
    assert "Reintegro promo" not in descs


def test_excluye_pagos_uala():
    rows = normalize_movimientos(UALA_RAW, tarjeta_id=3)
    assert all("Pago recibido" != r["desc"] for r in rows)


# ── Consolidación de impuestos ───────────────────────────────
def test_impuestos_consolidados_en_una_fila_mp():
    rows = normalize_movimientos(MP_RAW, tarjeta_id=7)
    imp = _impuestos(rows)
    assert len(imp) == 1
    assert imp[0]["desc"] == IMPUESTOS_CAT
    assert imp[0]["cat"] == IMPUESTOS_CAT
    assert imp[0]["currency"] == "ARS"
    assert imp[0]["amount"] == 1750.5  # 1000 + 500 + 250.5


def test_sello_uala_entra_en_impuestos():
    rows = normalize_movimientos(UALA_RAW, tarjeta_id=3)
    imp = _impuestos(rows)
    assert len(imp) == 1
    assert imp[0]["amount"] == 750.0
    assert imp[0]["cat"] == IMPUESTOS_CAT


def test_sin_impuestos_no_agrega_fila():
    raw = {"periodo": "2026-04", "movimientos": [
        {"fecha": "2026-04-01", "descripcion": "X", "monto": 100.0,
         "moneda": "ARS", "tipo": "consumo"},
    ]}
    rows = normalize_movimientos(raw, tarjeta_id=1)
    assert _impuestos(rows) == []


# ── Consumos + cuotas ────────────────────────────────────────
def test_cantidad_consumos_y_cuota_mp():
    rows = normalize_movimientos(MP_RAW, tarjeta_id=7)
    cons = _consumos(rows)
    assert len(cons) == 3  # Adidas, Spotify, Claude.ai
    adidas = next(r for r in cons if r["desc"] == "Adidas")
    assert adidas["cuota_num"] == 4
    assert adidas["cuota_total"] == 6


def test_cuota_embebida_uala():
    rows = normalize_movimientos(UALA_RAW, tarjeta_id=3)
    shop = next(r for r in _consumos(rows) if r["desc"].startswith("SHOPNOW"))
    assert shop["cuota_num"] == 10
    assert shop["cuota_total"] == 12


def test_consumo_sin_categoria_cae_en_otros():
    rows = normalize_movimientos(MP_RAW, tarjeta_id=7)
    claude = next(r for r in _consumos(rows) if r["desc"] == "Claude.ai")
    assert claude["cat"] == "Otros"


# ── USD ──────────────────────────────────────────────────────
def test_fila_usd_marca_needs_rate():
    rows = normalize_movimientos(MP_RAW, tarjeta_id=7)
    claude = next(r for r in _consumos(rows) if r["desc"] == "Claude.ai")
    assert claude["currency"] == "USD"
    assert claude["needs_rate"] is True


def test_fila_ars_no_necesita_cotizacion():
    rows = normalize_movimientos(MP_RAW, tarjeta_id=7)
    spotify = next(r for r in _consumos(rows) if r["desc"] == "Spotify")
    assert spotify["needs_rate"] is False


# ── origin_ref / dedup ───────────────────────────────────────
def test_origin_ref_estable():
    a = compute_origin_ref(7, "2026-04-05", "Adidas", "ARS", 41666.33, 4, 6)
    b = compute_origin_ref(7, "2026-04-05", "Adidas", "ARS", 41666.33, 4, 6)
    assert a == b


def test_origin_ref_difiere_por_tarjeta():
    a = compute_origin_ref(7, "2026-04-05", "Adidas", "ARS", 41666.33, 4, 6)
    b = compute_origin_ref(8, "2026-04-05", "Adidas", "ARS", 41666.33, 4, 6)
    assert a != b


def test_origin_ref_usd_no_depende_de_conversion():
    # El ref del consumo USD se basa en el monto ORIGINAL (20 USD), no en ARS.
    rows = normalize_movimientos(MP_RAW, tarjeta_id=7)
    claude = next(r for r in _consumos(rows) if r["desc"] == "Claude.ai")
    assert claude["origin_ref"] == compute_origin_ref(
        7, "2026-04-18", "Claude.ai", "USD", 20.0, None, None
    )


def test_mark_duplicates():
    rows = normalize_movimientos(MP_RAW, tarjeta_id=7)
    spotify = next(r for r in _consumos(rows) if r["desc"] == "Spotify")
    rows = mark_duplicates(rows, {spotify["origin_ref"]})
    assert spotify["duplicate"] is True
    adidas = next(r for r in rows if r["desc"] == "Adidas")
    assert adidas["duplicate"] is False


def test_reimport_completo_marca_todo_como_duplicado():
    rows = normalize_movimientos(MP_RAW, tarjeta_id=7)
    existing = {r["origin_ref"] for r in rows}
    # Re-extraer el mismo resumen → mismos refs → todo duplicado.
    rows2 = mark_duplicates(normalize_movimientos(MP_RAW, tarjeta_id=7), existing)
    assert all(r["duplicate"] for r in rows2)
