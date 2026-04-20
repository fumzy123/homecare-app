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
    supabase_key: str
    database_url: str
    frontend_url: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=env_path, env_file_encoding="utf-8", extra="ignore")

settings = Settings()
