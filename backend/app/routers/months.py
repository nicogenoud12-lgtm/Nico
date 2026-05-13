from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/months", tags=["months"])


@router.get("", response_model=list[schemas.MonthRead])
def list_months(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return crud.list_months(db, user.id)
