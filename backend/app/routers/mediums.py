from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/mediums", tags=["mediums"])


@router.get("", response_model=list[schemas.MediumRead])
def list_meds(db: Session = Depends(get_db)):
    return crud.list_mediums(db)


@router.post("", response_model=schemas.MediumRead, status_code=201)
def create_med(payload: schemas.MediumCreate, db: Session = Depends(get_db)):
    return crud.create_medium(db, payload)


@router.put("/{mid}", response_model=schemas.MediumRead)
def update_med(mid: int, payload: schemas.MediumUpdate, db: Session = Depends(get_db)):
    m = crud.update_medium(db, mid, payload)
    if not m:
        raise HTTPException(404, "Medium not found")
    return m


@router.delete("/{mid}", status_code=204)
def delete_med(mid: int, db: Session = Depends(get_db)):
    if not crud.delete_medium(db, mid):
        raise HTTPException(404, "Medium not found")
    return None


@router.post("/reorder", status_code=204)
def reorder_meds(payload: schemas.ReorderPayload, db: Session = Depends(get_db)):
    crud.reorder_mediums(db, payload.ids)
    return None
