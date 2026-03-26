from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    scan_timeout_seconds: int = 1200
    per_table_timeout_seconds: int = 300
    default_concurrency: int = 4
    default_top_n: int = 20
    default_sample_rows: int = 100_000
    result_ttl_seconds: int = 1800  # 30 minutes
    host: str = "0.0.0.0"
    port: int = 8090

    model_config = {"env_prefix": "BLACKRABBIT_"}


settings = Settings()
