"""Almacenamiento JSON con escrituras atómicas y lock simple."""
from __future__ import annotations

import json
import os
import shutil
import threading
from pathlib import Path
from typing import Any

ROOT = Path(__file__).parent
SEED_PATH = ROOT / "seed_data.json"
DATA_PATH = ROOT / "dev_data.json"

_lock = threading.RLock()
_state: dict[str, Any] | None = None


def _ensure_data_file() -> None:
    if not DATA_PATH.exists():
        if not SEED_PATH.exists():
            raise RuntimeError(f"No existe {SEED_PATH}. Creá el seed primero.")
        shutil.copy(SEED_PATH, DATA_PATH)


def load() -> dict[str, Any]:
    """Carga el estado en memoria; lo refresca de disco la primera vez."""
    global _state
    with _lock:
        if _state is None:
            _ensure_data_file()
            with DATA_PATH.open("r", encoding="utf-8") as f:
                _state = json.load(f)
            # Asegurar todas las colecciones esperadas
            for key in ("categories", "mediums", "tarjetas", "recurrentes",
                         "transactions", "months"):
                _state.setdefault(key, [])
            _state.setdefault("counters", {})
        return _state


def persist() -> None:
    """Escritura atómica: tmp file → rename."""
    with _lock:
        if _state is None:
            return
        tmp = DATA_PATH.with_suffix(".tmp")
        with tmp.open("w", encoding="utf-8") as f:
            json.dump(_state, f, ensure_ascii=False, indent=2, default=str)
        os.replace(tmp, DATA_PATH)


def reset_to_seed() -> dict[str, Any]:
    """Resetea dev_data.json al estado del seed y refresca el cache."""
    global _state
    with _lock:
        if not SEED_PATH.exists():
            raise RuntimeError(f"No existe {SEED_PATH}.")
        shutil.copy(SEED_PATH, DATA_PATH)
        _state = None
        return load()


def next_id(collection: str) -> int:
    """Devuelve el próximo id autoincremental para la colección dada."""
    with _lock:
        st = load()
        counters = st.setdefault("counters", {})
        rows = st.get(collection, [])
        current_max = max((r.get("id", 0) for r in rows), default=0)
        nxt = max(counters.get(collection, 0), current_max) + 1
        counters[collection] = nxt
        return nxt


def next_position(collection: str) -> int:
    rows = load().get(collection, [])
    return max((r.get("position", 0) for r in rows), default=-1) + 1
