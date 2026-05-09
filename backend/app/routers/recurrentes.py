from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/recurrentes", tags=["recurrentes"])


@router.get("", response_model=list[schemas.RecurrenteRead])
def list_recs(db: Session = Depends(get_db)):
    return crud.list_recurrentes(db)


@router.post("", response_model=schemas.RecurrenteRead, status_code=201)
def create_rec(payload: schemas.RecurrenteCreate, db: Session = Depends(get_db)):
    return crud.create_recurrente(db, payload)


@router.put("/{rid}", response_model=schemas.RecurrenteRead)
def update_rec(rid: int, payload: schemas.RecurrenteUpdate, db: Session = Depends(get_db)):
    r = crud.update_recurrente(db, rid, payload)
    if not r:
        raise HTTPException(404, "Recurrente not found")
    return r


@router.delete("/{rid}", status_code=204)
def delete_rec(rid: int, db: Session = Depends(get_db)):
    if not crud.delete_recurrente(db, rid):
        raise HTTPException(404, "Recurrente not found")
    return None


@router.post("/reorder", status_code=204)
def reorder_recs(payload: schemas.ReorderPayload, db: Session = Depends(get_db)):
    crud.reorder_recurrentes(db, payload.ids)
    return None
