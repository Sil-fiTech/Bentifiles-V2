from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    port: int = 8000
    PROJECT_NAME: str = "BentiFiles Quality Microservice"
    
    # Thresholds
    MIN_SCORE: float = 70.0
    MIN_LAPLACIAN: float = 50.0
    MIN_TENENGRAD: float = 1000.0
    MIN_BRIGHTNESS: float = 60.0
    MAX_BRIGHTNESS: float = 210.0
    MAX_GLARE_RATIO: float = 0.05
    MIN_DOCUMENT_AREA_RATIO: float = 0.20
    MIN_OCR_CONFIDENCE: float = 30.0
    MIN_TEXT_BLOCKS: int = 2
    
    # Weights for scoring
    WEIGHT_BLUR: float = 30.0
    WEIGHT_GLARE_BRIGHTNESS: float = 15.0
    WEIGHT_CONTRAST: float = 10.0
    WEIGHT_FRAMING: float = 25.0
    WEIGHT_OCR: float = 20.0

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        case_sensitive=False
    )

settings = Settings()
