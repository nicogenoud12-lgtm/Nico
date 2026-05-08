from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/suscripciones", tags=["suscripciones"])


@router.get("", response_model=list[schemas.SuscripcionRead])
def list_subs(db: Session = Depends(get_db)):
    return crud.list_suscripciones(db)


@router.post("", response_model=schemas.SuscripcionRead, status_code=201)
def create_sub(payload: schemas.SuscripcionCreate, db: Session = Depends(get_db)):
    return crud.create_suscripcion(db, payload)


@router.put("/{sid}", response_model=schemas.SuscripcionRead)
def update_sub(sid: int, payload: schemas.SuscripcionUpdate, db: Session = Depends(get_db)):
    s = crud.update_suscripcion(db, sid, payload)
    if not s:
        raise HTTPException(404, "Suscripcion not found")
    return s


@router.delete("/{sid}", status_code=204)
def delete_sub(sid: int, db: Session = Depends(get_db)):
    if not crud.delete_suscripcion(db, sid):
        raise HTTPException(404, "Suscripcion not found")
    return None


@router.post("/reorder", status_code=204)
def reorder_subs(payload: schemas.ReorderPayload, db: Session = Depends(get_db)):
    crud.reorder_suscripciones(db, payload.ids)
    return None
