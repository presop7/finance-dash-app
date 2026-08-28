from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    DATABASE_URL: str
    SUPABASE_URL: str
    # Comma-separated list of allowed CORS origins, e.g. "https://myapp.com,http://localhost:8090".
    # Defaults to "*" since this API is Bearer-token authenticated (no cookies), so a wide-open
    # CORS policy doesn't carry the usual CSRF risk — tighten via env var if you want to restrict it.
    CORS_ORIGINS: str = "*"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


settings = Settings()
