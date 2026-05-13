from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=list[schemas.TransactionRead])
def list_txs(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return [crud.serialize_tx(t) for t in crud.list_transactions(db, user.id)]


@router.post("", response_model=schemas.TransactionRead, status_code=201)
def create_tx(payload: schemas.TransactionCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    tx = crud.create_transaction(db, payload, user_id=user.id, source="web")
    return crud.serialize_tx(tx)


@router.put("/{tx_id}", response_model=schemas.TransactionRead)
def update_tx(tx_id: int, payload: schemas.TransactionUpdate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    tx = crud.update_transaction(db, tx_id, payload, user.id)
    if not tx:
        raise HTTPException(404, "Transaction not found")
    return crud.serialize_tx(tx)


@router.delete("/{tx_id}", status_code=204)
def delete_tx(tx_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if not crud.delete_transaction(db, tx_id, user.id):
        raise HTTPException(404, "Transaction not found")
    return None
