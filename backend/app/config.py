from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "sqlite:///./gastos.db"
    CORS_ORIGINS: str = "*"

    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_WEBHOOK_SECRET: str = ""
    ALLOWED_TELEGRAM_USER_IDS: str = ""

    SEED_DEMO_TX: bool = False

    @property
    def cors_origins_list(self) -> list[str]:
        if self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def allowed_user_ids(self) -> set[int]:
        return {
            int(x.strip())
            for x in self.ALLOWED_TELEGRAM_USER_IDS.split(",")
            if x.strip().isdigit()
        }


settings = Settings()
