from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[schemas.CategoryRead])
def list_cats(db: Session = Depends(get_db)):
    return crud.list_categories(db)


@router.post("", response_model=schemas.CategoryRead, status_code=201)
def create_cat(payload: schemas.CategoryCreate, db: Session = Depends(get_db)):
    return crud.create_category(db, payload)


@router.put("/{cat_id}", response_model=schemas.CategoryRead)
def update_cat(cat_id: int, payload: schemas.CategoryUpdate, db: Session = Depends(get_db)):
    cat = crud.update_category(db, cat_id, payload)
    if not cat:
        raise HTTPException(404, "Category not found")
    return cat


@router.delete("/{cat_id}", status_code=204)
def delete_cat(cat_id: int, db: Session = Depends(get_db)):
    if not crud.delete_category(db, cat_id):
        raise HTTPException(404, "Category not found")
    return None


@router.post("/reorder", status_code=204)
def reorder_cats(payload: schemas.ReorderPayload, db: Session = Depends(get_db)):
    crud.reorder_categories(db, payload.ids)
    return None
