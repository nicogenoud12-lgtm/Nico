"""
Freno contra fuerza bruta en /auth/login: tras MAX_FALLOS intentos fallidos
desde la misma IP dentro de VENTANA segundos, responde 429 hasta que se liberen.
Estado en memoria (un solo worker de uvicorn); un login correcto lo limpia.
"""
import ipaddress
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from .config import settings

MAX_FALLOS = 10
VENTANA = 15 * 60

_fallos: dict[str, deque] = defaultdict(deque)
_lock = threading.Lock()


def _es_proxy_confiable(host: str) -> bool:
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return any(ip in net for net in settings.trusted_proxy_networks)


def client_ip(request: Request) -> str:
    # Detrás del túnel de Cloudflare la IP real viene en CF-Connecting-IP, pero
    # solo le creemos si el pedido llega desde la red del túnel: el backend
    # también está publicado en la LAN y ahí cualquiera podría inventar el header.
    peer = request.client.host if request.client else "?"
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip and _es_proxy_confiable(peer):
        return cf_ip
    return peer


def _purgar(q: deque, ahora: float) -> None:
    while q and ahora - q[0] > VENTANA:
        q.popleft()


def check(ip: str) -> None:
    with _lock:
        q = _fallos.get(ip)
        if not q:
            return
        _purgar(q, time.monotonic())
        if len(q) >= MAX_FALLOS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiados intentos fallidos. Probá de nuevo en unos minutos.",
            )


def fallo(ip: str) -> None:
    with _lock:
        ahora = time.monotonic()
        q = _fallos[ip]
        _purgar(q, ahora)
        q.append(ahora)
        if len(_fallos) > 10_000:
            # Purgar antes de filtrar: una IP que no volvió a intentar conserva
            # sus fallos viejos en la cola y nunca quedaría vacía por sí sola.
            for k in list(_fallos):
                _purgar(_fallos[k], ahora)
                if not _fallos[k]:
                    del _fallos[k]


def exito(ip: str) -> None:
    with _lock:
        _fallos.pop(ip, None)
