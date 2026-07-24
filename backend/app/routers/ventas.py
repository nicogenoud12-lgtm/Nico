"""Ventas de muebles: precio al cliente + libro de pagos (cobros/pagos/ajustes).

- cobro → crea un ingreso en Movimientos (cat "Ventas Muebles").
- pago  → crea un egreso en Movimientos (cat "Muebles Fábrica").
- ajuste → no crea movimiento (descuentos de dueño, casos especiales).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/ventas", tags=["ventas"])


@router.get("", response_model=list[schemas.VentaRead])
def list_ventas(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return [crud.serialize_venta(v) for v in crud.list_ventas(db, user.id)]


@router.post("", response_model=schemas.VentaRead, status_code=201)
def create_venta(
    payload: schemas.VentaCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    venta = crud.create_venta(db, payload, user.id)
    return crud.serialize_venta(venta)


@router.put("/{venta_id}", response_model=schemas.VentaRead)
def update_venta(
    venta_id: int,
    payload: schemas.VentaUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    venta = crud.update_venta(db, venta_id, payload, user.id)
    if not venta:
        raise HTTPException(404, "Venta not found")
    return crud.serialize_venta(venta)


@router.delete("/{venta_id}", status_code=204)
def delete_venta(
    venta_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if not crud.delete_venta(db, venta_id, user.id):
        raise HTTPException(404, "Venta not found")
    return None


@router.post("/{venta_id}/pagos", response_model=schemas.VentaRead, status_code=201)
def add_pago(
    venta_id: int,
    payload: schemas.VentaPagoCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    try:
        pago = crud.create_venta_pago(db, venta_id, payload, user.id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if pago is None:
        raise HTTPException(404, "Venta not found")
    venta = crud.get_venta(db, venta_id, user.id)
    return crud.serialize_venta(venta)


@router.delete("/{venta_id}/pagos/{pago_id}", status_code=204)
def delete_pago(
    venta_id: int,
    pago_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if not crud.delete_venta_pago(db, pago_id, user.id):
        raise HTTPException(404, "Pago not found")
    return None
