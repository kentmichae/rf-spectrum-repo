from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional
import secrets


class Settings(BaseSettings):
    POSTGRES_USER: Optional[str] = None
    POSTGRES_PASSWORD: Optional[str] = None
    POSTGRES_DB: Optional[str] = None
    DATABASE_URL: Optional[str] = None
    API_SECRET_KEY: Optional[str] = None
    API_DEBUG: bool = False
    CORS_ORIGINS: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @field_validator("POSTGRES_USER")
    @classmethod
    def validate_pg_user(cls, v):
        if not v:
            raise ValueError("POSTGRES_USER must be set via environment variable")
        return v

    @field_validator("POSTGRES_PASSWORD")
    @classmethod
    def validate_pg_password(cls, v):
        if not v:
            raise ValueError("POSTGRES_PASSWORD must be set via environment variable (never use defaults)")
        if len(v) < 16:
            raise ValueError("POSTGRES_PASSWORD must be at least 16 characters")
        return v

    @field_validator("API_SECRET_KEY")
    @classmethod
    def validate_api_key(cls, v):
        if not v:
            raise ValueError("API_SECRET_KEY must be set via environment variable")
        if len(v) < 32:
            raise ValueError("API_SECRET_KEY must be at least 32 characters. Generate with: python -c 'import secrets; print(secrets.token_urlsafe(48))'")
        return v

    @field_validator("POSTGRES_DB")
    @classmethod
    def validate_pg_db(cls, v):
        if not v:
            raise ValueError("POSTGRES_DB must be set via environment variable")
        return v


settings = Settings()

# Runtime assertions - pyright doesn't understand pydantic validators narrow
# Optional types to non-Optional at runtime.
assert settings.POSTGRES_USER is not None, "POSTGRES_USER must be set in .env"
assert settings.POSTGRES_PASSWORD is not None, "POSTGRES_PASSWORD must be set in .env"
assert settings.POSTGRES_DB is not None, "POSTGRES_DB must be set in .env"
assert settings.API_SECRET_KEY is not None, "API_SECRET_KEY must be set in .env"

# Auto-generate DATABASE_URL if not explicitly provided (but credentials must still be set above)
if not settings.DATABASE_URL:
    settings.DATABASE_URL = f"postgresql+psycopg2://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}@db:5432/{settings.POSTGRES_DB}"


def generate_secure_secret_key(length: int = 48) -> str:
    """Generate a cryptographically secure secret key for production use.

    Usage:
        python -c "from app.config import generate_secret_key; print(generate_secret_key())"
    """
    return secrets.token_urlsafe(length)


if __name__ == "__main__":
    # Safe CLI utility for generating config values without importing settings
    # (which would fail validation without env vars)
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "generate-secret":
        key = secrets.token_urlsafe(48)
        print(f"# Add to your .env file:")
        print(f"API_SECRET_KEY={key}")
        print(f"\n# Minimum 32 characters. Generated token: {len(key)} chars")
    else:
        print("Usage: python -m app.config generate-secret")
        print("  Generates a cryptographically secure API_SECRET_KEY for .env")
