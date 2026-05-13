from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[schemas.CategoryRead])
def list_cats(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return crud.list_categories(db, user.id)


@router.post("", response_model=schemas.CategoryRead, status_code=201)
def create_cat(payload: schemas.CategoryCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    try:
        return crud.create_category(db, payload, user.id)
    except IntegrityError:
        raise HTTPException(409, f"Ya existe una categoría de {payload.kind} con ese nombre")


@router.put("/{cat_id}", response_model=schemas.CategoryRead)
def update_cat(cat_id: int, payload: schemas.CategoryUpdate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    try:
        cat = crud.update_category(db, cat_id, payload, user.id)
    except IntegrityError:
        raise HTTPException(409, "Ya existe una categoría con ese nombre y tipo")
    if not cat:
        raise HTTPException(404, "Category not found")
    return cat


@router.delete("/{cat_id}", status_code=204)
def delete_cat(cat_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if not crud.delete_category(db, cat_id, user.id):
        raise HTTPException(404, "Category not found")
    return None


@router.post("/reorder", status_code=204)
def reorder_cats(payload: schemas.ReorderPayload, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    crud.reorder_categories(db, payload.ids, user.id)
    return None
