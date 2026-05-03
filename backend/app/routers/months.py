from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/months", tags=["months"])


@router.get("", response_model=list[schemas.MonthRead])
def list_months(db: Session = Depends(get_db)):
    return crud.list_months(db)
