"""Mensajes salientes del bot, en argentino coloquial."""

ASK_MEDIO = "Dale, ¿con qué pagaste? Decime: efectivo, transferencia, MP, Naranja, Ualá, Astropay…"
ASK_CAT = "¿En qué lo metés? (comida, nafta, ocio, ropa, salud, gimnasio…)"
ASK_AMT = "Che, ¿cuánto fue? Tirame el número 🙏"
ASK_DESC = "¿Y qué fue? Mandame una descripción cortita."

NOT_UNDERSTOOD_MEDIO = "Mmm no te re entendí 🤔. Probá con: efectivo, transferencia, MP, Naranja, Ualá, Astropay…"
NOT_UNDERSTOOD_CAT = "Mmm esa no la tengo. Probá con: comida, ocio, ropa, salud, gimnasio, viajes, suscripciones…"
NOT_UNDERSTOOD_AMT = "Eso no me parece un número. Tirame algo tipo 15000 o 1500."

NOT_UNDERSTOOD_GENERIC = "No te entendí. Probá algo tipo: \"hoy gasté 15000 en una hamburguesa con MP\""

CONFIRM_GASTO = "Listo, te lo anoté ✅\n−$ {amt} · {desc}\n📂 {cat} · 💳 {medio}"
CONFIRM_INGRESO = "Anotado el ingreso 💸\n+$ {amt} · {desc}\n📂 {cat} · 💳 {medio}"


GEMINI_ERROR = "Uy, no pude procesar tu mensaje ahora 🤖💥. Probá de nuevo en un toque."
CONFIRM_DELETE = "Borré el movimiento 🗑️\n{summary}"
NOT_FOUND_DELETE = "No encontré ese movimiento 🤔. Probá ser más específico."


def fmt_amount(n: float) -> str:
    return f"{int(abs(n)):,}".replace(",", ".")
