"""Tests de la lógica determinística post-extracción (sin llamar a Gemini).

Las fixtures imitan la salida estructurada de Gemini para un resumen de
Mercado Pago y uno de Ualá. Toda la lógica de negocio (filtrar pagos/ajustes,
consolidar impuestos, parsear cuota, calcular dedup) se prueba acá.
"""
from datetime import date

from app import statement_import
from app.statement_import import (
    IMPUESTOS_CAT,
    add_months,
    alias_key,
    compute_origin_ref,
    expand_row,
    impuestos_origin_ref,
    impuestos_sig,
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


def test_origin_ref_cuota_ignora_monto():
    # Para cuotas el ref no incluye el monto (puede variar por intereses).
    a = compute_origin_ref(7, "2026-04-05", "Adidas", "ARS", 41666.33, 4, 6)
    b = compute_origin_ref(7, "2026-04-05", "Adidas", "ARS", 99999.99, 4, 6)
    assert a == b


# ── add_months ───────────────────────────────────────────────
def test_add_months_simple():
    assert add_months(date(2026, 4, 5), 2) == date(2026, 6, 5)


def test_add_months_cruza_anio():
    assert add_months(date(2026, 11, 15), 3) == date(2027, 2, 15)


def test_add_months_recorta_fin_de_mes():
    # 31/ene + 1 mes → 28/feb (no existe 31/feb)
    assert add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)


# ── expand_row: cuota actual + siguientes ────────────────────
def _row(**kw):
    base = {
        "date": date(2026, 4, 27), "desc": "MERCADOLIBRE", "amount": 51231.37,
        "currency": "ARS", "cat": "Otros", "cuota_num": 3, "cuota_total": 6,
        "origin_ref": "ref-actual", "rate": None,
    }
    base.update(kw)
    return base


def test_expand_cuota_crea_actual_y_siguientes():
    out = expand_row(_row(), tarjeta_id=7)
    # 3/6 → cuotas 3,4,5,6 (4 movimientos), nunca 1 ni 2.
    nums = [r["cuota_num"] for r in out]
    assert nums == [3, 4, 5, 6]
    assert all(r["cuota_total"] == 6 for r in out)


def test_expand_cuota_fechas_mensuales():
    out = expand_row(_row(), tarjeta_id=7)
    fechas = [r["date"] for r in out]
    # _row: compra 27/04 = cuota 1; importando 3/6 → cuotas 3..6 = compra +2..+5 meses
    assert fechas == [
        date(2026, 6, 27), date(2026, 7, 27), date(2026, 8, 27), date(2026, 9, 27)
    ]


def test_expand_cuota_ancla_en_fecha_de_compra():
    # Caso real reportado: compra 31/ene = cuota 1. Importando 4/6, deben crearse
    # cuota 4 en abril, 5 en mayo, 6 en junio (NO en ene/feb/mar).
    out = expand_row(_row(
        date=date(2025, 1, 31), desc="KINDERLAND", amount=16665.0,
        cuota_num=4, cuota_total=6, origin_ref="x",
    ), tarjeta_id=7)
    assert [(r["cuota_num"], r["date"]) for r in out] == [
        (4, date(2025, 4, 30)),   # 31/abr no existe → 30
        (5, date(2025, 5, 31)),
        (6, date(2025, 6, 30)),
    ]


def test_expand_cuota_actual_reusa_ref_y_futuras_distintas():
    out = expand_row(_row(), tarjeta_id=7)
    assert out[0]["origin_ref"] == "ref-actual"          # la actual reusa el ref
    refs = [r["origin_ref"] for r in out]
    assert len(set(refs)) == 4                            # todas distintas


def test_expand_cuota_futura_ref_coincide_con_la_del_proximo_resumen():
    # La cuota 4 que proyectamos ahora debe tener el MISMO ref que tendría la
    # cuota 4 cuando aparezca en el resumen del mes que viene → no se duplica.
    out = expand_row(_row(), tarjeta_id=7)
    cuota4 = next(r for r in out if r["cuota_num"] == 4)
    ref_proximo_resumen = compute_origin_ref(
        7, date(2026, 4, 27), "MERCADOLIBRE", "ARS", 0, 4, 6
    )
    assert cuota4["origin_ref"] == ref_proximo_resumen


def test_expand_consumo_simple_una_sola_tx():
    out = expand_row(_row(cuota_num=None, cuota_total=None, origin_ref="x"), tarjeta_id=7)
    assert len(out) == 1
    assert out[0]["cuota_num"] is None


def test_expand_usd_convierte_a_ars_y_anota_desc():
    out = expand_row(_row(
        desc="CLAUDE.AI", currency="USD", amount=20.0, rate=1200.0,
        cuota_num=None, cuota_total=None, origin_ref="x",
    ), tarjeta_id=7)
    assert out[0]["amount"] == 24000.0
    assert "US$ 20" in out[0]["desc"]


# ── Impuestos: ref estable por fecha+monto (no por periodo) ──
def test_impuestos_origin_ref_estable_por_fecha_y_monto():
    a = impuestos_origin_ref(7, "2026-05-31", 179.9)
    b = impuestos_origin_ref(7, "2026-05-31", 179.9)
    assert a == b
    # No depende del periodo (texto libre de Gemini): mismo input → mismo ref.
    assert "impuestos-tarjetas" in a


def test_impuestos_origin_ref_difiere_por_monto():
    assert impuestos_origin_ref(7, "2026-05-31", 179.9) != impuestos_origin_ref(7, "2026-05-31", 200.0)


def test_impuestos_sig_estable():
    assert impuestos_sig("2026-05-31", 179.9) == impuestos_sig("2026-05-31", 179.90)
    assert impuestos_sig("2026-05-31", 179.9) == "2026-05-31|179.90"


def test_impuestos_ref_no_depende_del_periodo():
    # Dos extracciones del mismo resumen con periodo distinto → mismo ref de impuestos.
    raw_a = {"periodo": "Mayo 2026", "movimientos": [
        {"fecha": "2026-05-31", "descripcion": "IVA", "monto": 179.9, "tipo": "impuesto"},
    ]}
    raw_b = {"periodo": "30 Abr 2026 - 29 Mayo 2026", "movimientos": [
        {"fecha": "2026-05-31", "descripcion": "IVA", "monto": 179.9, "tipo": "impuesto"},
    ]}
    ra = next(r for r in normalize_movimientos(raw_a, 7) if r["tipo"] == "impuesto")
    rb = next(r for r in normalize_movimientos(raw_b, 7) if r["tipo"] == "impuesto")
    assert ra["origin_ref"] == rb["origin_ref"]


# ── Marcador de cuota volátil en la desc ─────────────────────
def test_origin_ref_ignora_marcador_de_cuota_en_desc():
    # "X (11/12)" y "X (12/12)" deben dar el MISMO ref para la cuota 12 → dedup cross-mes.
    a = compute_origin_ref(7, "2026-01-15", "PERFUME (11/12)", "ARS", 100.0, 12, 12)
    b = compute_origin_ref(7, "2026-01-15", "PERFUME (12/12)", "ARS", 100.0, 12, 12)
    assert a == b


def test_origin_ref_consumo_sin_marcador_no_cambia():
    # Regresión: consumos sin marcador conservan su ref (dedup existente intacto).
    assert compute_origin_ref(7, "2026-04-13", "Spotify", "ARS", 8413.47, None, None) == \
        "7|2026-04-13|spotify|ARS|8413.47"


# ── Cuotas renombradas: ref usa la desc ORIGINAL ─────────────
def test_expand_cuota_renombrada_usa_desc_original_para_ref():
    out = expand_row({
        "date": date(2026, 1, 15), "desc": "Perfume",
        "desc_orig": "MERPAGO*JULERIAQUE Rosario Nort ARG(11/12)",
        "amount": 100.0, "currency": "ARS", "cat": "Otros",
        "cuota_num": 11, "cuota_total": 12, "origin_ref": "ref-actual", "rate": None,
    }, tarjeta_id=7)
    # La desc guardada es la editada…
    assert all(r["desc"] == "Perfume" for r in out)
    # …pero el ref de la cuota 12 (futura) se calcula con la desc ORIGINAL y coincide
    # con la extracción del mes siguiente ("…(12/12)").
    cuota12 = next(r for r in out if r["cuota_num"] == 12)
    ref_prox = compute_origin_ref(
        7, date(2026, 1, 15), "MERPAGO*JULERIAQUE Rosario Nort ARG(12/12)", "ARS", 0, 12, 12
    )
    assert cuota12["origin_ref"] == ref_prox


# ── Alias de comercio ────────────────────────────────────────
def test_alias_key_agrupa_cuotas_y_referencias_del_mismo_comercio():
    a = alias_key("MERPAGO*JULERIAQUE Rosario Nort ARG(11/12) 807692")
    b = alias_key("MERPAGO*JULERIAQUE Rosario Nort ARG(12/12)")
    assert a == b


def test_normalize_aplica_alias_y_conserva_original():
    raw = {"periodo": "2026-05", "movimientos": [
        {"fecha": "2026-05-10", "descripcion": "MERPAGO*JULERIAQUE ARG(12/12)",
         "monto": 100.0, "moneda": "ARS", "tipo": "consumo",
         "cuota_num": 12, "cuota_total": 12},
    ]}
    aliases = {alias_key("MERPAGO*JULERIAQUE ARG(12/12)"): "Perfume"}
    row = normalize_movimientos(raw, 7, aliases)[0]
    assert row["desc"] == "Perfume"                       # se muestra el alias
    assert row["desc_orig"] == "MERPAGO*JULERIAQUE ARG(12/12)"  # original conservado


def test_normalize_sin_alias_usa_desc_original():
    rows = normalize_movimientos(MP_RAW, tarjeta_id=7)
    adidas = next(r for r in rows if r.get("desc") == "Adidas")
    assert adidas["desc_orig"] == "Adidas"
