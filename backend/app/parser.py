"""
Parser de lenguaje natural para mensajes de Telegram.

Acepta frases con orden libre, ej:
- "15000 asado comida mp"
- "hoy gasté 15000 en una hamburguesa y pagué con transferencia"
- "gasté en una hamburguesa 15000, pagué con transferencia"
- "me tomé un café 4500 efectivo"
- "cobré 750000 sueldo"

Devuelve un dict con: amt, type, medio, cat, desc, date, month, missing[]
"""
from __future__ import annotations

import re
import unicodedata
from datetime import date, timedelta
from typing import Optional


# ── normalización ────────────────────────────────────────────
def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def _normalize(s: str) -> str:
    return _strip_accents(s.lower()).strip()


# ── alias / keywords ─────────────────────────────────────────
# Cada entrada: (canonical_name, [regex_patterns]) — se matchea sobre texto normalizado.
MEDIO_ALIASES: list[tuple[str, list[str]]] = [
    ("Transferencia", [r"\btransfer(encia)?\b", r"\btransf\b", r"\bcbu\b", r"\bcvu\b"]),
    ("MP Crédito",    [r"\bmp\s*credito\b", r"\bmercado\s*pago\s*credito\b"]),
    ("MP",            [r"\bmp\b", r"\bmercado\s*pago\b"]),
    ("Naranja X",     [r"\bnaranja(\s*x)?\b"]),
    ("Ualá Crédito",  [r"\buala\s*credito\b"]),
    ("Ualá",          [r"\buala\b"]),
    ("Astropay",      [r"\bastropay\b"]),
    ("Personal Pay",  [r"\bpersonal\s*pay\b"]),
    ("Contado",       [r"\bcontado\b", r"\befectivo\b", r"\befe\b", r"\bcash\b", r"\bplata\s+en\s+mano\b", r"\bmano\b"]),
    ("Crédito",       [r"\bcredito\b", r"\btarjeta\s*credito\b"]),
    ("Débito",        [r"\bdebito\b", r"\btarjeta\s*debito\b"]),
]

CAT_KEYWORDS: list[tuple[str, list[str]]] = [
    ("Comida",        [r"\bcomida\b", r"\bhambur\w*", r"\basado\b", r"\bempan\w*", r"\bpizza\b",
                       r"\balm[ueo]rzo\b", r"\bcena\b", r"\bdesayuno\b", r"\bcaf[eé]\b", r"\bcafe\b",
                       r"\bmcdonald\w*", r"\bburger\b", r"\bsushi\b", r"\bbulliban\b", r"\bpan\b",
                       r"\bhelado\b", r"\brappi\b", r"\bpedidos\s*ya\b"]),
    ("Combustible",   [r"\bcombust\w*", r"\bnafta\b", r"\bgnc\b", r"\bypf\b", r"\bshell\b", r"\baxion\b"]),
    ("Gimnasio",      [r"\bgimnasio\b", r"\bgym\b"]),
    ("Recurrentes",   [r"\brecurrent\w*", r"\bsuscrip\w*", r"\bspotify\b", r"\bnetflix\b", r"\bgoogle\s*one\b",
                       r"\bdisney\b", r"\bhbo\b", r"\bprime\b", r"\bicloud\b"]),
    ("Ropa",          [r"\bropa\b", r"\bremera\b", r"\bcampera\b", r"\bzapatill\w*", r"\bjean\b",
                       r"\bpantalon\b", r"\bbuzo\b"]),
    ("Viajes",        [r"\bviaje\b", r"\bpasaje\b", r"\bvuelo\b", r"\bhotel\b", r"\bairbnb\b",
                       r"\buber\b", r"\bcabify\b", r"\bdidi\b", r"\bbrasil\b", r"\buruguay\b"]),
    ("Ocio",          [r"\bocio\b", r"\bcine\b", r"\bteatro\b", r"\bsalida\b", r"\bboliche\b",
                       r"\bjuego\b", r"\bsteam\b", r"\bplaystation\b", r"\bxbox\b"]),
    ("Salud",         [r"\bsalud\b", r"\bfarmacia\b", r"\bm[eé]dico\b", r"\bremedio\b", r"\bobra\s*social\b",
                       r"\bdentista\b"]),
    ("Compras",       [r"\bcompra\w*", r"\bmercado\s*libre\b", r"\bml\b", r"\btemu\b", r"\baliexpress\b",
                       r"\bamazon\b"]),
    ("Suplementos",   [r"\bsuplement\w*", r"\bproteina\b", r"\bcreatina\b"]),
    ("Peluquería",    [r"\bpeluqueri\w*", r"\bbarber\w*", r"\bcorte\b"]),
    ("Art. Higiene",  [r"\bhigiene\b", r"\bshampoo\b", r"\bjabon\b", r"\bdeso?dorante\b"]),
    ("Impuestos",     [r"\bimpuesto\w*", r"\bafip\b", r"\bmonotributo\b", r"\barba\b"]),
    ("Regalo",        [r"\bregalo\w*", r"\bcumple\w*"]),
    ("Donación",      [r"\bdonaci\w*", r"\bcaridad\b"]),
    ("Inversiones",   [r"\binversion\w*", r"\binvers[ií]\w*", r"\bplazo\s*fijo\b", r"\bcedear\w*"]),
]

INGRESO_KEYWORDS = [
    r"\bcobr[eé]\b", r"\brecib[ií]\b", r"\bme\s*pagaron\b", r"\bme\s*entr[oó]\b",
    r"\bsueldo\b", r"\baguinaldo\b", r"\bingreso\b", r"\bingres[eé]\b",
]
INGRESO_CAT_DEFAULT = "Ingresos"

STOPWORDS = {
    "hoy", "ayer", "anteayer", "anoche", "esta", "manana",
    "gaste", "gastamos", "gaste,", "pague", "pague,", "pagamos", "compre", "compre,",
    "me", "tome", "comi", "comimos",
    "en", "con", "de", "del", "la", "el", "los", "las", "un", "una", "unos", "unas",
    "y", "o", "por", "para", "al", "a", "que", "lo", "le", "se",
    "fue", "fueron", "esto", "eso", "una", "es",
    "$", "ar$", "ars",
}


# ── extractores ──────────────────────────────────────────────
_AMT_RE = re.compile(r"\b(\d{1,3}(?:[.\s]\d{3})+|\d+)([,.]\d+)?(k)?\b", re.IGNORECASE)


def extract_amount(text_norm: str) -> Optional[tuple[float, tuple[int, int]]]:
    """Retorna (valor, (start, end)) del primer monto encontrado, o None."""
    for m in _AMT_RE.finditer(text_norm):
        raw = m.group(0)
        # ignoramos "años" sueltos tipo "2024" si están aislados? por simplicidad, primer match gana
        # normalizar: sacar puntos/espacios de miles, convertir coma a punto, manejar k
        val = raw.lower()
        is_k = val.endswith("k")
        if is_k:
            val = val[:-1]
        # caso "15.000" o "15 000" → quitar separadores de miles
        if re.match(r"^\d{1,3}([.\s]\d{3})+$", val):
            val = re.sub(r"[.\s]", "", val)
        else:
            # podría ser decimal con coma o punto: "1.5", "1,5"
            val = val.replace(",", ".")
        try:
            num = float(val)
        except ValueError:
            continue
        if is_k:
            num *= 1000
        if num <= 0:
            continue
        return num, m.span()
    return None


def extract_medio(text_norm: str) -> Optional[tuple[str, tuple[int, int]]]:
    """Match más largo gana entre los aliases."""
    best: Optional[tuple[str, tuple[int, int]]] = None
    best_len = 0
    for canonical, patterns in MEDIO_ALIASES:
        for pat in patterns:
            for m in re.finditer(pat, text_norm, re.IGNORECASE):
                length = m.end() - m.start()
                if length > best_len:
                    best = (canonical, m.span())
                    best_len = length
    return best


def extract_cat(text_norm: str) -> Optional[tuple[str, tuple[int, int]]]:
    best: Optional[tuple[str, tuple[int, int]]] = None
    best_len = 0
    for canonical, patterns in CAT_KEYWORDS:
        for pat in patterns:
            for m in re.finditer(pat, text_norm, re.IGNORECASE):
                length = m.end() - m.start()
                if length > best_len:
                    best = (canonical, m.span())
                    best_len = length
    return best


def detect_type(text_norm: str) -> str:
    for pat in INGRESO_KEYWORDS:
        if re.search(pat, text_norm, re.IGNORECASE):
            return "i"
    return "g"


def detect_date(text_norm: str) -> date:
    today = date.today()
    if re.search(r"\bayer\b", text_norm):
        return today - timedelta(days=1)
    if re.search(r"\banteayer\b", text_norm):
        return today - timedelta(days=2)
    m = re.search(r"\bhace\s+(\d+)\s+d[ií]as?\b", text_norm)
    if m:
        return today - timedelta(days=int(m.group(1)))
    return today


def _date_to_month_id(d: date) -> str:
    return f"{d.month:02d}{str(d.year)[-2:]}"


def _clean_desc(text_norm: str, removed_spans: list[tuple[int, int]]) -> str:
    """Remueve los spans detectados y stopwords; devuelve texto limpio."""
    chars = list(text_norm)
    for start, end in sorted(removed_spans, reverse=True):
        for i in range(start, end):
            if 0 <= i < len(chars):
                chars[i] = " "
    raw = "".join(chars)
    tokens = re.findall(r"[a-zA-Z0-9]+", raw)
    keep = [t for t in tokens if t not in STOPWORDS and len(t) > 1]
    return " ".join(keep).strip()


# ── API pública ──────────────────────────────────────────────
def parse_message(text: str) -> dict:
    """Parsea un mensaje libre. Devuelve dict con campos detectados + missing[]."""
    if not text or not text.strip():
        return {"missing": ["amt", "cat", "medio", "desc"]}

    text_norm = _normalize(text)
    spans: list[tuple[int, int]] = []

    amt_info = extract_amount(text_norm)
    medio_info = extract_medio(text_norm)
    cat_info = extract_cat(text_norm)
    tx_type = detect_type(text_norm)
    d = detect_date(text_norm)

    amt = amt_info[0] if amt_info else None
    medio = medio_info[0] if medio_info else None
    cat = cat_info[0] if cat_info else None

    # Solo removemos monto y medio del desc; conservamos la palabra de categoría
    # para tener descripciones más naturales ("hamburguesa" en vez de fallback "Comida").
    if amt_info: spans.append(amt_info[1])
    if medio_info: spans.append(medio_info[1])

    desc = _clean_desc(text_norm, spans)

    if tx_type == "i" and not cat:
        cat = INGRESO_CAT_DEFAULT
    if tx_type == "i" and not medio:
        # para ingresos, default razonable
        medio = "MP"

    missing: list[str] = []
    if amt is None:
        missing.append("amt")
    if cat is None:
        missing.append("cat")
    if medio is None:
        missing.append("medio")

    if amt is not None:
        amt_signed = abs(amt) if tx_type == "i" else -abs(amt)
    else:
        amt_signed = None

    return {
        "amt": amt_signed,
        "type": tx_type,
        "cat": cat,
        "medio": medio,
        "desc": desc or (cat or ""),
        "date": d.isoformat(),
        "month": _date_to_month_id(d),
        "missing": missing,
    }


def resolve_field(field: str, text: str) -> Optional[str | float]:
    """Resuelve un campo individual desde la respuesta del usuario."""
    text_norm = _normalize(text)
    if field == "medio":
        info = extract_medio(text_norm)
        return info[0] if info else None
    if field == "cat":
        info = extract_cat(text_norm)
        return info[0] if info else None
    if field == "amt":
        info = extract_amount(text_norm)
        return info[0] if info else None
    if field == "desc":
        return text.strip() or None
    return None
