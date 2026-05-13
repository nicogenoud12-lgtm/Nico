from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/tarjetas", tags=["tarjetas"])


@router.get("", response_model=list[schemas.TarjetaRead])
def list_tarjs(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return crud.list_tarjetas(db, user.id)


@router.post("", response_model=schemas.TarjetaRead, status_code=201)
def create_tarj(payload: schemas.TarjetaCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return crud.create_tarjeta(db, payload, user.id)


@router.put("/{tid}", response_model=schemas.TarjetaRead)
def update_tarj(tid: int, payload: schemas.TarjetaUpdate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    t = crud.update_tarjeta(db, tid, payload, user.id)
    if not t:
        raise HTTPException(404, "Tarjeta not found")
    return t


@router.delete("/{tid}", status_code=204)
def delete_tarj(tid: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if not crud.delete_tarjeta(db, tid, user.id):
        raise HTTPException(404, "Tarjeta not found")
    return None


@router.post("/reorder", status_code=204)
def reorder_tarjs(payload: schemas.ReorderPayload, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    crud.reorder_tarjetas(db, payload.ids, user.id)
    return None
