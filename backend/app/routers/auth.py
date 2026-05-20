"""Endpoints de autenticación: register, login, me, invitaciones."""
from __future__ import annotations

import secrets
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..auth import create_access_token, get_admin_user, get_current_user, hash_password, verify_password
from ..database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Schemas locales ───────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    password: str
    invitation_code: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    is_admin: bool


class UserRead(BaseModel):
    id: int
    username: str
    is_admin: bool
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class InvitationCreate(BaseModel):
    note: Optional[str] = None
    expires_at: Optional[datetime] = None


class InvitationRead(BaseModel):
    id: int
    code: str
    note: Optional[str]
    created_at: datetime
    expires_at: Optional[datetime]
    used_at: Optional[datetime]
    used_by: Optional[int]
    status: str  # "disponible" | "usada" | "expirada"

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────────

def _validate_invitation(db: Session, code: str) -> models.Invitation:
    inv = db.query(models.Invitation).filter(models.Invitation.code == code).first()
    if not inv:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Código de invitación inválido")
    if inv.used_at is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="El código ya fue usado")
    if inv.expires_at and inv.expires_at < datetime.utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="El código expiró")
    return inv


def _inv_status(inv: models.Invitation) -> str:
    if inv.used_at is not None:
        return "usada"
    if inv.expires_at and inv.expires_at < datetime.utcnow():
        return "expirada"
    return "disponible"


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    inv = _validate_invitation(db, payload.invitation_code)

    if db.query(models.User).filter(models.User.username == payload.username).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="El nombre de usuario ya existe")

    if len(payload.password) < 6:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="La contraseña debe tener al menos 6 caracteres")

    user = models.User(
        username=payload.username.strip(),
        password_hash=hash_password(payload.password),
        is_admin=False,
        is_active=True,
    )
    db.add(user)
    db.flush()  # genera user.id antes de commit

    inv.used_at = datetime.utcnow()
    inv.used_by = user.id
    db.commit()
    db.refresh(user)

    # Sembrar categorías/medios/meses default para el nuevo usuario
    from ..main import seed_defaults_for_user
    seed_defaults_for_user(db, user.id)

    token = create_access_token(user)
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        is_admin=user.is_admin,
    )


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form.username).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Usuario o contraseña incorrectos")
    if not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Cuenta desactivada")

    token = create_access_token(user)
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        is_admin=user.is_admin,
    )


@router.get("/me", response_model=UserRead)
def me(user: models.User = Depends(get_current_user)):
    return user


@router.get("/invitations", response_model=list[InvitationRead])
def list_invitations(
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_admin_user),
):
    invs = db.query(models.Invitation).order_by(models.Invitation.created_at.desc()).all()
    result = []
    for inv in invs:
        d = InvitationRead(
            id=inv.id,
            code=inv.code,
            note=inv.note,
            created_at=inv.created_at,
            expires_at=inv.expires_at,
            used_at=inv.used_at,
            used_by=inv.used_by,
            status=_inv_status(inv),
        )
        result.append(d)
    return result


@router.post("/invitations", response_model=InvitationRead, status_code=201)
def create_invitation(
    payload: InvitationCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user),
):
    inv = models.Invitation(
        code=secrets.token_urlsafe(16),
        created_by=admin.id,
        note=payload.note,
        expires_at=payload.expires_at,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return InvitationRead(
        id=inv.id,
        code=inv.code,
        note=inv.note,
        created_at=inv.created_at,
        expires_at=inv.expires_at,
        used_at=inv.used_at,
        used_by=inv.used_by,
        status=_inv_status(inv),
    )


@router.delete("/invitations/{inv_id}", status_code=204)
def delete_invitation(
    inv_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_admin_user),
):
    inv = db.get(models.Invitation, inv_id)
    if not inv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invitación no encontrada")
    if inv.used_at is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No se puede eliminar una invitación ya usada")
    db.delete(inv)
    db.commit()


@router.get("/users", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_admin_user),
):
    return db.query(models.User).order_by(models.User.id).all()


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user),
):
    if user_id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No podés eliminar tu propia cuenta")
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    # Verificar que no sea el último admin
    if user.is_admin:
        admin_count = db.query(models.User).filter(models.User.is_admin == True, models.User.is_active == True).count()
        if admin_count <= 1:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No se puede eliminar el último admin")
    db.delete(user)
    # Borrar la invitación que fue usada para crear esta cuenta
    inv = db.query(models.Invitation).filter(models.Invitation.used_by == user_id).first()
    if inv:
        db.delete(inv)
    db.commit()
