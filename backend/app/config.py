from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    POSTGRES_USER: str = "rf_user"
    POSTGRES_PASSWORD: str = "rf_password"
    POSTGRES_DB: str = "rf_sor_db"
    DATABASE_URL: Optional[str] = None
    API_SECRET_KEY: str = "dev-secret-key"
    API_DEBUG: bool = True
    CORS_ORIGINS: str = "http://localhost:3000"
    
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

settings = Settings()

# Construct DATABASE_URL if not explicitly provided from env
if not settings.DATABASE_URL:
    settings.DATABASE_URL = f"postgresql+psycopg2://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}@db:5432/{settings.POSTGRES_DB}"
