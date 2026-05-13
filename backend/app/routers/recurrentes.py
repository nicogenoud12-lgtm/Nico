from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/recurrentes", tags=["recurrentes"])


@router.get("", response_model=list[schemas.RecurrenteRead])
def list_recs(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return crud.list_recurrentes(db, user.id)


@router.post("", response_model=schemas.RecurrenteRead, status_code=201)
def create_rec(payload: schemas.RecurrenteCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return crud.create_recurrente(db, payload, user.id)


@router.put("/{rid}", response_model=schemas.RecurrenteRead)
def update_rec(rid: int, payload: schemas.RecurrenteUpdate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    r = crud.update_recurrente(db, rid, payload, user.id)
    if not r:
        raise HTTPException(404, "Recurrente not found")
    return r


@router.delete("/{rid}", status_code=204)
def delete_rec(rid: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if not crud.delete_recurrente(db, rid, user.id):
        raise HTTPException(404, "Recurrente not found")
    return None


@router.post("/reorder", status_code=204)
def reorder_recs(payload: schemas.ReorderPayload, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    crud.reorder_recurrentes(db, payload.ids, user.id)
    return None
