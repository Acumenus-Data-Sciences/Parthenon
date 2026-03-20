from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="MORPHEUS_")

    database_url: str = "postgresql://smudoshi:acumenus@pgsql.acumenus.net:5432/parthenon"
    staging_schema: str = "inpatient_staging"
    cdm_schema: str = "inpatient"
    ext_schema: str = "inpatient_ext"
    vocab_schema: str = "omop"
    mimic_schema: str = "mimiciv"
    min_mapping_coverage: float = 0.70
    max_error_rate: float = 0.20
    batch_size: int = 1000


settings = Settings()
