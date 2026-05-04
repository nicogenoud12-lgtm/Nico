import httpx

from .config import settings


async def send_message(chat_id: int, text: str) -> None:
    """Envía un mensaje al chat de Telegram. No-op si no hay token configurado."""
    if not settings.TELEGRAM_BOT_TOKEN:
        return
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            await client.post(url, json={"chat_id": chat_id, "text": text})
        except httpx.HTTPError as e:
            print(f"[telegram] error enviando mensaje: {e}")
