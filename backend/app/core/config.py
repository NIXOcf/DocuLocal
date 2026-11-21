from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

from pydantic_settings import BaseSettings, SettingsConfigDict

# Raíz del repo: backend/app/core/config.py -> subir 3 niveles
ROOT_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT_DIR / ".env", extra="ignore")

    postgres_user: str = "doculocal"
    postgres_password: str = "doculocal_dev"
    postgres_db: str = "doculocal"
    postgres_host: str = "localhost"
    postgres_port: int = 5432

    jwt_secret: str
    jwt_expires_minutes: int = 480
    cors_origins: str = "http://localhost:5173"

    storage_dir: str = "backend/storage"
    max_upload_mb: int = 20

    embedding_model: str = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"
    rerank_model: str = "jinaai/jina-reranker-v2-base-multilingual"
    # Logit del cross-encoder; calibrado con consultas reales (relevantes hasta -1.2 en preguntas coloquiales; ruido < -1.4). Ver .env.example
    rerank_min_score: float = -1.3
    retrieval_top_k: int = 8

    # Clave del proveedor LLM (se llama GROQ_API_KEY por compatibilidad); en modo local puede ir vacía.
    groq_api_key: str = ""
    llm_base_url: str = "https://api.groq.com/openai/v1"
    llm_model: str = "openai/gpt-oss-120b"
    llm_fast_model: str = "openai/gpt-oss-20b"
    # Detector de inyección; vacío = desactivado (solo existe en Groq)
    llm_guard_model: str = "meta-llama/llama-prompt-guard-2-86m"
    llm_timeout_seconds: int = 30
    llm_max_retries: int = 2

    # Swagger/ReDoc/openapi.json: true solo en desarrollo
    enable_docs: bool = True

    log_level: str = "INFO"
    log_dir: str = "backend/logs"

    @property
    def llm_is_local(self) -> bool:
        return urlparse(self.llm_base_url).hostname in ("localhost", "127.0.0.1", "::1")

    @property
    def llm_host(self) -> str:
        """host[:puerto] sin userinfo, seguro para logs (la URL podría traer usuario:clave@)."""
        u = urlparse(self.llm_base_url)
        return f"{u.hostname}:{u.port}" if u.port else (u.hostname or "?")

    @property
    def llm_mode(self) -> str:
        return "local" if self.llm_is_local else "groq"

    @property
    def database_dsn(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def storage_path(self) -> Path:
        path = Path(self.storage_dir)
        return path if path.is_absolute() else ROOT_DIR / path

    @property
    def log_path(self) -> Path:
        path = Path(self.log_dir)
        return path if path.is_absolute() else ROOT_DIR / path


@lru_cache
def get_settings() -> Settings:
    return Settings()
