from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "sqlite:///./gastos.db"
    CORS_ORIGINS: str = "*"

    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_WEBHOOK_SECRET: str = ""
    ALLOWED_TELEGRAM_USER_IDS: str = ""
    TELEGRAM_BOT_OWNER_ID: int = 0  # user.id (tabla users) dueño del bot

    # Alexa — opera en nombre de TELEGRAM_BOT_OWNER_ID (mismo dueño).
    ALEXA_SKILL_ID: str = ""  # applicationId de la skill, para validar requests

    # Redes desde las que se acepta CF-Connecting-IP (el túnel de cloudflared llega
    # por el gateway de la red Docker). Pedidos de otras IPs usan su IP real, así
    # nadie de la LAN puede inventarse el header para esquivar el freno de login.
    TRUSTED_PROXY_CIDRS: str = "172.16.0.0/12"

    SEED_DEMO_TX: bool = False

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 días

    @property
    def cors_origins_list(self) -> list[str]:
        if self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def trusted_proxy_networks(self) -> list:
        import ipaddress
        nets = []
        for c in self.TRUSTED_PROXY_CIDRS.split(","):
            c = c.strip()
            if c:
                nets.append(ipaddress.ip_network(c, strict=False))
        return nets

    @property
    def allowed_user_ids(self) -> set[int]:
        return {
            int(x.strip())
            for x in self.ALLOWED_TELEGRAM_USER_IDS.split(",")
            if x.strip().isdigit()
        }


settings = Settings()
