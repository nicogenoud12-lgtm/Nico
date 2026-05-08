from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/tarjetas", tags=["tarjetas"])


@router.get("", response_model=list[schemas.TarjetaRead])
def list_tarjs(db: Session = Depends(get_db)):
    return crud.list_tarjetas(db)


@router.post("", response_model=schemas.TarjetaRead, status_code=201)
def create_tarj(payload: schemas.TarjetaCreate, db: Session = Depends(get_db)):
    return crud.create_tarjeta(db, payload)


@router.put("/{tid}", response_model=schemas.TarjetaRead)
def update_tarj(tid: int, payload: schemas.TarjetaUpdate, db: Session = Depends(get_db)):
    t = crud.update_tarjeta(db, tid, payload)
    if not t:
        raise HTTPException(404, "Tarjeta not found")
    return t


@router.delete("/{tid}", status_code=204)
def delete_tarj(tid: int, db: Session = Depends(get_db)):
    if not crud.delete_tarjeta(db, tid):
        raise HTTPException(404, "Tarjeta not found")
    return None


@router.post("/reorder", status_code=204)
def reorder_tarjs(payload: schemas.ReorderPayload, db: Session = Depends(get_db)):
    crud.reorder_tarjetas(db, payload.ids)
    return None
