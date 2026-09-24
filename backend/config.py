from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    DATABASE_URL: str
    SUPABASE_URL: str
    # Comma-separated list of allowed CORS origins, e.g. "https://myapp.com,http://localhost:8090".
    # Defaults to "*" since this API is Bearer-token authenticated (no cookies), so a wide-open
    # CORS policy doesn't carry the usual CSRF risk — tighten via env var if you want to restrict it.
    CORS_ORIGINS: str = "*"

    # In-app feedback (POST /feedback) is emailed via Resend's HTTP API — Render
    # blocks outbound SMTP on free instances, so SMTP isn't an option. All three
    # are optional: with them unset the app still boots and the endpoint just
    # answers 503 ("feedback isn't set up"), so deploying without them is safe.
    RESEND_API_KEY: str = ""
    # Where reports get delivered. Before a sending domain is verified in Resend,
    # its sandbox sender only delivers to the Resend account owner's own address,
    # so this should be that address.
    FEEDBACK_TO_EMAIL: str = ""
    FEEDBACK_FROM_EMAIL: str = "Finance Dash Feedback <onboarding@resend.dev>"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


settings = Settings()
