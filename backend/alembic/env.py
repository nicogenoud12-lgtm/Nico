import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Sobreescribir URL desde variable de entorno si está disponible
db_url = os.getenv("DATABASE_URL")
if db_url:
    config.set_main_option("sqlalchemy.url", db_url)

from app.models import Base
target_metadata = Base.metadata


def run_migrations_online() -> None:
    from app.database import engine

    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # requerido para SQLite
        )
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()
