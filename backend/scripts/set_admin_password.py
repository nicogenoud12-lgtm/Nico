#!/usr/bin/env python3
"""
Setea el password del usuario admin (id=1) después de la migración 002.

Uso (desde el directorio /app dentro del contenedor):
    docker exec -it nico-backend-1 python scripts/set_admin_password.py

O en el servidor:
    cd /home/genoud/Nico
    docker compose exec backend python scripts/set_admin_password.py
"""
import sys
import os

# Agregar el directorio raíz al path para poder importar app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import getpass
from app.database import SessionLocal
from app.models import User
from app.auth import hash_password


def main():
    print("=== Setear contraseña del admin ===")
    username = input("Username del admin [admin]: ").strip() or "admin"

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            print(f"Usuario '{username}' no encontrado.")
            sys.exit(1)

        password = getpass.getpass("Nueva contraseña: ")
        if len(password) < 6:
            print("La contraseña debe tener al menos 6 caracteres.")
            sys.exit(1)

        confirm = getpass.getpass("Confirmar contraseña: ")
        if password != confirm:
            print("Las contraseñas no coinciden.")
            sys.exit(1)

        user.password_hash = hash_password(password)
        db.commit()
        print(f"Contraseña actualizada para '{username}'. Ya podés loguearte.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
