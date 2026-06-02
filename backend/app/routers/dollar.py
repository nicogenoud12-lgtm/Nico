"""Caja fuerte de dólares: operaciones del baúl + cotizaciones en vivo."""
import logging
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..auth import get_current_user
from ..database import get_db

log = logging.getLogger(__name__)
router = APIRouter(prefix="/dollar", tags=["dollar"])

# Cache de cotizaciones a nivel de proceso (la cotización es global, no por usuario).
_QUOTE_CACHE: dict = {"data": None, "ts": 0.0}
_CACHE_TTL = 300  # 5 minutos
_URLS = {
    "oficial": "https://dolarapi.com/v1/dolares/oficial",
    "cripto": "https://dolarapi.com/v1/dolares/cripto",
}


@router.get("/ops", response_model=list[schemas.DollarOpRead])
def list_ops(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return [crud.serialize_dollar_op(o) for o in crud.list_dollar_ops(db, user.id)]


@router.post("/ops", response_model=schemas.DollarOpRead, status_code=201)
def create_op(
    payload: schemas.DollarOpCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    try:
        op = crud.create_dollar_op(db, payload, user_id=user.id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return crud.serialize_dollar_op(op)


@router.delete("/ops/{op_id}", status_code=204)
def delete_op(
    op_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if not crud.delete_dollar_op(db, op_id, user.id):
        raise HTTPException(404, "Dollar op not found")
    return None


@router.get("/quotes", response_model=schemas.QuotesRead)
async def quotes(user: models.User = Depends(get_current_user)):
    now = time.time()
    if _QUOTE_CACHE["data"] and now - _QUOTE_CACHE["ts"] < _CACHE_TTL:
        return _QUOTE_CACHE["data"]
    try:
        results = {}
        async with httpx.AsyncClient(timeout=10.0) as client:
            for key, url in _URLS.items():
                resp = await client.get(url)
                resp.raise_for_status()
                j = resp.json()
                results[key] = {"compra": j.get("compra"), "venta": j.get("venta")}
        data = {**results, "fetched_at": str(int(now)), "stale": False}
        _QUOTE_CACHE["data"] = data
        _QUOTE_CACHE["ts"] = now
        return data
    except (httpx.HTTPError, httpx.TimeoutException) as e:
        log.error("[dollar] fetch quotes failed: %s", e)
        if _QUOTE_CACHE["data"]:
            return {**_QUOTE_CACHE["data"], "stale": True}
        raise HTTPException(503, "No se pudo obtener cotizaciones")
