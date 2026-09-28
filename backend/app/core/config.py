import os
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve the backend directory (3 levels up from this file: core → app → backend)
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# In production the hosting platform injects real env vars — no file needed.
# In local dev we load from .env.local. Fall back to .env for backwards compat.
_env_local = os.path.join(base_dir, ".env.local")
_env_fallback = os.path.join(base_dir, ".env")
env_path = _env_local if os.path.exists(_env_local) else _env_fallback

class Settings(BaseSettings):
    supabase_url: str
    supabase_secret_key: str
    database_url: str
    frontend_url: str = "http://localhost:5173"
    backend_sentry_dsn: str = ""
    app_env: str = "development"
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_id: str = ""
    billing_onboarding_enabled: bool = False
    billing_notifications_enabled: bool = False
    billing_usage_finalization_enabled: bool = False
    billing_settlement_enabled: bool = False
    billing_settlement_live_enabled: bool = False
    billing_usage_tax_mode: str = "unconfigured"
    stripe_usage_tax_code: str = ""
    billing_operator_user_ids: list[str] = []
    stripe_standard_monthly_v1_price_id: str = ""
    stripe_standard_annual_v1_price_id: str = ""
    stripe_founding_monthly_v1_price_id: str = ""

    model_config = SettingsConfigDict(env_file=env_path, env_file_encoding="utf-8", extra="ignore")

settings = Settings()
