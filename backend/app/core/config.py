import os
from pydantic_settings import BaseSettings, SettingsConfigDict

# Securely find the exact path to your .env file no matter where you run the server from
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
env_path = os.path.join(base_dir, ".env")

class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    database_url: str

    model_config = SettingsConfigDict(env_file=env_path, env_file_encoding="utf-8", extra="ignore")

settings = Settings()
