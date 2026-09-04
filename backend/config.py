"""Backend Application Configuration (SIH 26057)."""

from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings:
    PROJECT_NAME: str = "SIH26057 — Side-Scan Sonar Debris & Anomaly Detection"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    
    # Paths
    UPLOAD_DIR: Path = BASE_DIR / "data" / "uploads"
    SAMPLES_DIR: Path = BASE_DIR / "data" / "samples"
    WEIGHTS_DIR: Path = BASE_DIR / "ml" / "weights"
    DATASET_DIR: Path = BASE_DIR / "data" / "dataset"
    DB_PATH: Path = BASE_DIR / "sonar_detection.db"
    
    # Model defaults
    DEFAULT_CONFIDENCE: float = 0.25
    DEFAULT_IOU: float = 0.45
    
    # CORS
    CORS_ORIGINS: list[str] = ["*"]

settings = Settings()

# Ensure critical directories exist
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
settings.WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
settings.DATASET_DIR.mkdir(parents=True, exist_ok=True)
