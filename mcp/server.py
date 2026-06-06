"""MCP server for Nico — app de gastos personales.

Expone las operaciones de la API REST como herramientas de Claude.
Requiere: NICO_API_URL, NICO_USERNAME, NICO_PASSWORD (env vars o mcp/.env).
"""
import os
import time
from collections import defaultdict
from pathlib import Path

import httpx
from mcp.server.fastmcp import FastMCP

# Carga .env si existe (para desarrollo local)
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

# ── Config ────────────────────────────────────────────────────────────────────
API_URL = os.environ.get("NICO_API_URL", "https://apigastos.genoud-nube.com.ar").rstrip("/")
_USERNAME = os.environ.get("NICO_USERNAME", "")
_PASSWORD = os.environ.get("NICO_PASSWORD", "")

# ── Token cache ───────────────────────────────────────────────────────────────
_token: str | None = None
_token_expires: float = 0.0  # unix timestamp; token dura 7 días, refrescamos antes


async def _login() -> str:
    global _token, _token_expires
    async with httpx.AsyncClient(timeout=15.0) as c:
        resp = await c.post(
            f"{API_URL}/auth/login",
            data={"username": _USERNAME, "password": _PASSWORD},
        )
        resp.raise_for_status()
    _token = resp.json()["access_token"]
    _token_expires = time.time() + 7 * 24 * 3600 - 3600  # 7 días menos 1h de margen
    return _token


async def _req(method: str, path: str, **kwargs) -> dict | list:
    """Realiza una request autenticada; re-autentica automáticamente en 401."""
    global _token, _token_expires
    if not _token or time.time() >= _token_expires:
        await _login()
    headers = {"Authorization": f"Bearer {_token}"}
    async with httpx.AsyncClient(timeout=30.0) as c:
        resp = await c.request(method, f"{API_URL}{path}", headers=headers, **kwargs)
    if resp.status_code == 401:
        await _login()
        headers = {"Authorization": f"Bearer {_token}"}
        async with httpx.AsyncClient(timeout=30.0) as c:
            resp = await c.request(method, f"{API_URL}{path}", headers=headers, **kwargs)
    if resp.status_code == 204:
        return {"ok": True}
    resp.raise_for_status()
    return resp.json()


# ── MCP server ────────────────────────────────────────────────────────────────
mcp = FastMCP("gastos")


# ─── Transacciones ────────────────────────────────────────────────────────────

@mcp.tool()
async def list_transactions(month: str | None = None) -> list[dict]:
    """Lista las transacciones del usuario.
    month: opcional, formato mmyy (ej: '0626' para junio 2026).
    Devuelve id, date, desc, cat, medio, amount, type (g/i), currency, cuota_num, cuota_total."""
    txs = await _req("GET", "/transactions")
    if month:
        txs = [t for t in txs if t.get("month") == month]
    return txs


@mcp.tool()
async def get_spending_summary(month: str | None = None) -> dict:
    """Resumen financiero: totales por categoría, total gastos, total ingresos y balance neto.
    month: opcional, formato mmyy (ej: '0626' para junio 2026).
    Excluye transacciones en USD (baúl de dólares)."""
    txs = await _req("GET", "/transactions")
    if month:
        txs = [t for t in txs if t.get("month") == month]
    txs = [t for t in txs if t.get("currency") != "USD"]

    by_cat: dict[str, float] = defaultdict(float)
    total_gastos = 0.0
    total_ingresos = 0.0

    for t in txs:
        amt = abs(t.get("amount", 0))
        cat = t.get("cat", "Sin categoría")
        if t.get("type") == "g":
            by_cat[cat] -= amt
            total_gastos += amt
        else:
            by_cat[cat] += amt
            total_ingresos += amt

    return {
        "month": month,
        "total_gastos": round(total_gastos, 2),
        "total_ingresos": round(total_ingresos, 2),
        "balance": round(total_ingresos - total_gastos, 2),
        "por_categoria": {k: round(v, 2) for k, v in sorted(by_cat.items(), key=lambda x: x[1])},
    }


@mcp.tool()
async def create_transaction(
    date: str,
    cat: str,
    amount: float,
    type: str,
    desc: str = "",
    medio: str = "",
    currency: str = "ARS",
    cuota_num: int | None = None,
    cuota_total: int | None = None,
    tarjeta_id: int | None = None,
) -> dict:
    """Crea una nueva transacción.
    - date: formato YYYY-MM-DD
    - cat: nombre de la categoría (ej: 'Comida'). Usar list_categories para ver disponibles.
    - amount: monto positivo
    - type: 'g' para gasto, 'i' para ingreso
    - medio: nombre del medio de pago (ej: 'Efectivo'). Usar list_mediums para ver disponibles.
    - currency: 'ARS' (default) o 'USD'
    - cuota_num / cuota_total: para cuotas (ej: cuota_num=1, cuota_total=12 para 1/12)"""
    payload: dict = {
        "date": date,
        "cat": cat,
        "amount": amount,
        "type": type,
        "desc": desc,
        "medio": medio,
        "currency": currency,
    }
    if cuota_num is not None:
        payload["cuota_num"] = cuota_num
    if cuota_total is not None:
        payload["cuota_total"] = cuota_total
    if tarjeta_id is not None:
        payload["tarjeta_id"] = tarjeta_id
    return await _req("POST", "/transactions", json=payload)


@mcp.tool()
async def update_transaction(
    tx_id: int,
    date: str | None = None,
    desc: str | None = None,
    cat: str | None = None,
    medio: str | None = None,
    amount: float | None = None,
    type: str | None = None,
    currency: str | None = None,
    cuota_num: int | None = None,
    cuota_total: int | None = None,
    tarjeta_id: int | None = None,
) -> dict:
    """Edita una transacción existente. Solo se actualizan los campos que se provean."""
    payload = {k: v for k, v in {
        "date": date, "desc": desc, "cat": cat, "medio": medio,
        "amount": amount, "type": type, "currency": currency,
        "cuota_num": cuota_num, "cuota_total": cuota_total, "tarjeta_id": tarjeta_id,
    }.items() if v is not None}
    return await _req("PUT", f"/transactions/{tx_id}", json=payload)


@mcp.tool()
async def delete_transaction(tx_id: int) -> dict:
    """Elimina UNA transacción por su ID.
    IMPORTANTE: solo acepta un ID a la vez — no existe borrado masivo.
    Siempre confirmar con el usuario qué transacción se va a borrar antes de llamar."""
    return await _req("DELETE", f"/transactions/{tx_id}")


# ─── Categorías ───────────────────────────────────────────────────────────────

@mcp.tool()
async def list_categories() -> list[dict]:
    """Lista todas las categorías del usuario (id, name, color, kind, position).
    kind puede ser 'gasto', 'ingreso' o 'inversion'."""
    return await _req("GET", "/categories")


@mcp.tool()
async def create_category(name: str, kind: str = "gasto", color: str = "#b0aaaa") -> dict:
    """Crea una categoría nueva.
    - kind: 'gasto', 'ingreso' o 'inversion'
    - color: hex (ej: '#e05c5c')"""
    return await _req("POST", "/categories", json={"name": name, "kind": kind, "color": color})


@mcp.tool()
async def update_category(
    cat_id: int,
    name: str | None = None,
    color: str | None = None,
    kind: str | None = None,
) -> dict:
    """Edita una categoría existente. Solo se actualizan los campos provistos."""
    payload = {k: v for k, v in {"name": name, "color": color, "kind": kind}.items() if v is not None}
    return await _req("PUT", f"/categories/{cat_id}", json=payload)


@mcp.tool()
async def delete_category(cat_id: int) -> dict:
    """Elimina una categoría por su ID."""
    return await _req("DELETE", f"/categories/{cat_id}")


# ─── Medios de pago ───────────────────────────────────────────────────────────

@mcp.tool()
async def list_mediums() -> list[dict]:
    """Lista todos los medios de pago del usuario (id, name, position)."""
    return await _req("GET", "/mediums")


@mcp.tool()
async def create_medium(name: str) -> dict:
    """Crea un medio de pago (ej: 'Efectivo', 'Débito Galicia', 'Naranja X')."""
    return await _req("POST", "/mediums", json={"name": name})


@mcp.tool()
async def delete_medium(medium_id: int) -> dict:
    """Elimina un medio de pago por su ID."""
    return await _req("DELETE", f"/mediums/{medium_id}")


# ─── Tarjetas ─────────────────────────────────────────────────────────────────

@mcp.tool()
async def list_tarjetas() -> list[dict]:
    """Lista todas las tarjetas de crédito registradas (id, nombre, banco, ultimos4, cierre, vence)."""
    return await _req("GET", "/tarjetas")


@mcp.tool()
async def create_tarjeta(
    nombre: str,
    ultimos4: str = "",
    cierre: str = "",
    vence: str = "",
    banco: str = "",
    emisor: str | None = None,
    color_hex: str | None = None,
) -> dict:
    """Crea una tarjeta de crédito.
    - nombre: nombre descriptivo (ej: 'Visa Galicia')
    - ultimos4: últimos 4 dígitos
    - cierre: día de cierre (ej: '15')
    - vence: día de vencimiento (ej: '22')"""
    payload: dict = {
        "nombre": nombre, "ultimos4": ultimos4,
        "cierre": cierre, "vence": vence, "banco": banco,
    }
    if emisor:
        payload["emisor"] = emisor
    if color_hex:
        payload["color_hex"] = color_hex
    return await _req("POST", "/tarjetas", json=payload)


@mcp.tool()
async def delete_tarjeta(tarjeta_id: int) -> dict:
    """Elimina una tarjeta de crédito por su ID."""
    return await _req("DELETE", f"/tarjetas/{tarjeta_id}")


# ─── Meses ────────────────────────────────────────────────────────────────────

@mcp.tool()
async def list_months() -> list[dict]:
    """Lista todos los meses con saldo inicial y monto de cuotas.
    El campo 'id' está en formato mmyy (ej: '0626' = junio 2026)."""
    return await _req("GET", "/months")


# ─── Recurrentes / Suscripciones ──────────────────────────────────────────────

@mcp.tool()
async def list_recurrentes() -> list[dict]:
    """Lista todos los gastos recurrentes y suscripciones del usuario
    (Netflix, Spotify, gym, etc.)."""
    return await _req("GET", "/recurrentes")


@mcp.tool()
async def create_recurrente(
    nombre: str,
    monto: float,
    moneda: str = "ARS",
    frecuencia: str = "mensual",
    vencimiento: str | None = None,
    estado: str = "activo",
    dia_mes: int | None = None,
    auto_create: bool = False,
) -> dict:
    """Crea un gasto recurrente o suscripción.
    - moneda: 'ARS' o 'USD'
    - frecuencia: 'mensual' o 'anual'
    - vencimiento: fecha de vencimiento de la suscripción (YYYY-MM-DD, opcional)
    - dia_mes: día del mes en que se cobra (1-31)
    - auto_create: si True, genera la transacción automáticamente cada mes"""
    payload: dict = {
        "nombre": nombre, "monto": monto, "moneda": moneda,
        "frecuencia": frecuencia, "estado": estado, "auto_create": auto_create,
    }
    if vencimiento:
        payload["vencimiento"] = vencimiento
    if dia_mes is not None:
        payload["dia_mes"] = dia_mes
    return await _req("POST", "/recurrentes", json=payload)


@mcp.tool()
async def delete_recurrente(recurrente_id: int) -> dict:
    """Elimina un recurrente/suscripción por su ID."""
    return await _req("DELETE", f"/recurrentes/{recurrente_id}")


# ─── Baúl de dólares ──────────────────────────────────────────────────────────

@mcp.tool()
async def list_dollar_ops() -> list[dict]:
    """Lista todas las operaciones del baúl de dólares
    (ingresos de billetes, compras, ventas, retiros)."""
    return await _req("GET", "/dollar/ops")


@mcp.tool()
async def get_dollar_quotes() -> dict:
    """Cotizaciones actuales del dólar: oficial y cripto (compra y venta). Cache de 5 minutos."""
    return await _req("GET", "/dollar/quotes")


@mcp.tool()
async def create_dollar_op(
    kind: str,
    usd: float,
    date: str,
    rate: float | None = None,
    desc: str = "",
    cat: str | None = None,
    medio: str = "",
) -> dict:
    """Crea una operación en el baúl de dólares.
    - kind: 'ingreso' (billetes físicos), 'compra' (ARS→USD), 'venta' (USD→ARS), 'retiro'
    - usd: monto en dólares
    - rate: cotización ARS/USD — requerida para compra y venta
    - date: formato YYYY-MM-DD
    ATENCIÓN: compra/venta/retiro crean automáticamente una transacción en pesos vinculada."""
    payload: dict = {"kind": kind, "usd": usd, "date": date, "desc": desc, "medio": medio}
    if rate is not None:
        payload["rate"] = rate
    if cat:
        payload["cat"] = cat
    return await _req("POST", "/dollar/ops", json=payload)


@mcp.tool()
async def delete_dollar_op(op_id: int) -> dict:
    """Elimina una operación del baúl de dólares por su ID.
    ATENCIÓN: también elimina la transacción en pesos vinculada si existe."""
    return await _req("DELETE", f"/dollar/ops/{op_id}")


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    mcp.run()
