from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/mediums", tags=["mediums"])


@router.get("", response_model=list[schemas.MediumRead])
def list_meds(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return crud.list_mediums(db, user.id)


@router.post("", response_model=schemas.MediumRead, status_code=201)
def create_med(payload: schemas.MediumCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return crud.create_medium(db, payload, user.id)


@router.put("/{mid}", response_model=schemas.MediumRead)
def update_med(mid: int, payload: schemas.MediumUpdate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    m = crud.update_medium(db, mid, payload, user.id)
    if not m:
        raise HTTPException(404, "Medium not found")
    return m


@router.delete("/{mid}", status_code=204)
def delete_med(mid: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if not crud.delete_medium(db, mid, user.id):
        raise HTTPException(404, "Medium not found")
    return None


@router.post("/reorder", status_code=204)
def reorder_meds(payload: schemas.ReorderPayload, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    crud.reorder_mediums(db, payload.ids, user.id)
    return None
