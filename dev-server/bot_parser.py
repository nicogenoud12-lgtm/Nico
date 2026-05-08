"""Mock del NLP del bot Telegram, sin Gemini.

Reconoce patrones tipo:
  - "Compré X con tarjeta Y en N cuotas de M"
  - "Compré X con Y en N cuotas"
  - "Compré X en N cuotas"
  - "Gasté $X en Y" (sin cuotas)
  - "Pagué N en Y" (sin cuotas)

Retorna un dict con: desc, tarjeta, cuotas, total_amt, unit_amt.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Optional


def _normalize(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower().strip()


# Captura cuotas — versión más permisiva, busca componentes de a uno
_CUOTAS_NUM = re.compile(r"\b(\d+)\s+cuotas?\b", re.IGNORECASE)
_CUOTAS_DE = re.compile(r"cuotas?\s+de\s*\$?\s*([\d.,]+)", re.IGNORECASE)
_TARJETA_HINT = re.compile(
    r"(?:con\s+(?:la\s+)?(?:tarjeta\s+)?|en\s+(?:la\s+)?tarjeta\s+)([A-Za-zÁÉÍÓÚáéíóúñÑ][\w\sÁÉÍÓÚáéíóúñÑ]{1,30}?)(?=\s+(?:en|por|de|y)\b|\s*$)",
    re.IGNORECASE,
)
_DESC_COMPRE = re.compile(
    r"(?:compr[éeo]|adquir[ií])\s+(?:una?\s+|el\s+|la\s+|los\s+|las\s+)?([A-Za-zÁÉÍÓÚáéíóúñÑ][\w\sÁÉÍÓÚáéíóúñÑ]+?)(?=\s+(?:con|en|por|y|de\s+\$?\d)|\s*$)",
    re.IGNORECASE,
)
_AMT_TOTAL = re.compile(r"(?:de\s+)?\$?\s*([\d.,]+)\s*(?:k|mil|m)?\b", re.IGNORECASE)
_GASTE = re.compile(
    r"(?:gast[éeo]|pagu[éeo])\s+\$?\s*([\d.,]+)\s+(?:en\s+|por\s+)?([A-Za-zÁÉÍÓÚáéíóúñÑ][\w\sÁÉÍÓÚáéíóúñÑ]+)",
    re.IGNORECASE,
)


def _parse_amount(raw: str) -> Optional[float]:
    if raw is None:
        return None
    raw = raw.strip().lower()
    multiplier = 1.0
    if raw.endswith(("k", "mil", "m")):
        multiplier = 1000.0
        raw = re.sub(r"(k|mil|m)$", "", raw).strip()
    raw = raw.replace(".", "").replace(",", ".")
    try:
        return float(raw) * multiplier
    except ValueError:
        return None


def parse(text: str, known_tarjetas: list[str] | None = None) -> dict:
    """Parsea un texto del usuario. Retorna dict con campos detectados.

    Campos posibles: desc, tarjeta, cuota_total, total_amt, unit_amt.
    Siempre setea tx_type='g'. Si no detecta nada, retorna {} y el caller decide.
    """
    known_tarjetas = known_tarjetas or []
    known_norm = {_normalize(t): t for t in known_tarjetas}

    out: dict = {"tx_type": "g"}
    raw = text.strip()

    # 1) Patrón "Gasté $X en Y" — más simple, sin cuotas
    m = _GASTE.search(raw)
    if m:
        amt = _parse_amount(m.group(1))
        desc = m.group(2).strip()
        if amt:
            out["total_amt"] = amt
            out["unit_amt"] = amt
            out["desc"] = desc
            out["cuota_total"] = 1
            return out

    # 2) Patrón "Compré ... cuotas ..."
    desc_m = _DESC_COMPRE.search(raw)
    if desc_m:
        out["desc"] = desc_m.group(1).strip()

    cuotas_m = _CUOTAS_NUM.search(raw)
    if cuotas_m:
        out["cuota_total"] = int(cuotas_m.group(1))

    cuotas_de_m = _CUOTAS_DE.search(raw)
    if cuotas_de_m:
        unit = _parse_amount(cuotas_de_m.group(1))
        if unit:
            out["unit_amt"] = unit

    tarjeta_m = _TARJETA_HINT.search(raw)
    if tarjeta_m:
        candidate = tarjeta_m.group(1).strip()
        # Match contra tarjetas conocidas
        norm = _normalize(candidate)
        for k_norm, k_orig in known_norm.items():
            if k_norm == norm or k_norm in norm or norm in k_norm:
                out["tarjeta"] = k_orig
                break
        else:
            out["tarjeta"] = candidate

    # Calcular total si tenemos cuotas + unit
    if "cuota_total" in out and "unit_amt" in out and "total_amt" not in out:
        out["total_amt"] = out["unit_amt"] * out["cuota_total"]

    # Si solo tenemos un monto suelto (sin "cuotas de"), tomarlo como total
    if "total_amt" not in out and "cuota_total" in out:
        # Buscar un número grande en el texto que no sea el de cuotas
        nums = re.findall(r"\$?\s*([\d.,]+)\s*(k|mil|m)?", raw)
        for raw_num, suffix in nums:
            val = _parse_amount(raw_num + (suffix or ""))
            if val and val > out["cuota_total"]:  # filtramos el conteo de cuotas
                out["total_amt"] = val
                if "unit_amt" not in out:
                    out["unit_amt"] = val / out["cuota_total"]
                break

    if "total_amt" in out and "unit_amt" not in out:
        out["unit_amt"] = out["total_amt"] / out.get("cuota_total", 1)

    return out
