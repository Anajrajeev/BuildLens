from functools import lru_cache
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    cloud_run_data_api_url: str = ""
    cloud_run_data_api_secret_key: str = ""
    database_url: str = ""
    jwt_audience: str = "authenticated"
    jwt_issuer: str = ""
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    gemini_api_key: str = Field(default="", validation_alias=AliasChoices("GEMINI_API_KEY", "GEMINI_KEY", "gemini_api_key"))
    gemini_model: str = "gemini-3.8-flash"
    auth_disabled: bool = False
    data_backend: str = "firestore"
    firebase_project_id: str = "buildlens-20261018"
    firebase_credentials_file: str = ""
    site_timezone: str = "Asia/Kolkata"

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
