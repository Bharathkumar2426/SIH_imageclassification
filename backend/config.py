"""Backend Application Configuration (SIH 26057)."""

from pathlib import Path
import os

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

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
    
    # AIS & Vessel Tracking Configuration
    AIS_API_KEY: str = os.getenv("AIS_API_KEY", "")
    AISSTREAM_API_KEY: str = os.getenv("AISSTREAM_API_KEY") or os.getenv("AIS_API_KEY", "")
    AISSTREAM_WS_URL: str = "wss://stream.aisstream.io/v0/stream"
    AIS_BBOX_MIN_LAT: float = float(os.getenv("AIS_BBOX_MIN_LAT", "-90.0"))
    AIS_BBOX_MIN_LON: float = float(os.getenv("AIS_BBOX_MIN_LON", "-180.0"))
    AIS_BBOX_MAX_LAT: float = float(os.getenv("AIS_BBOX_MAX_LAT", "90.0"))
    AIS_BBOX_MAX_LON: float = float(os.getenv("AIS_BBOX_MAX_LON", "180.0"))
    AIS_STALE_TIMEOUT_SECONDS: int = int(os.getenv("AIS_STALE_TIMEOUT_SECONDS", "300"))
    AIS_MAX_TRACK_POINTS: int = int(os.getenv("AIS_MAX_TRACK_POINTS", "100"))
    VESSEL_WARNING_DISTANCE_METERS: float = float(os.getenv("VESSEL_WARNING_DISTANCE_METERS", "500.0"))
    
    # CORS
    CORS_ORIGINS: list[str] = ["*"]

    # Maritime Incident Intelligence Configuration (SIH 26057)
    NEWS_API_KEY: str = os.getenv("NEWS_API_KEY", "")
    MEDIASTACK_API_KEY: str = os.getenv("MEDIASTACK_API_KEY", "")
    GLOBAL_FISHING_WATCH_API_TOKEN: str = os.getenv("GLOBAL_FISHING_WATCH_API_TOKEN", "")
    INCIDENT_CACHE_DIR: Path = BASE_DIR / "backend" / "data" / "incident_cache"
    INCIDENTS_DB_PATH: Path = BASE_DIR / "maritime_incidents.db"
    INCIDENT_POLL_INTERVAL_SECONDS: int = int(os.getenv("INCIDENT_POLL_INTERVAL_SECONDS", "300"))

settings = Settings()

# Ensure critical directories exist
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
settings.WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
settings.DATASET_DIR.mkdir(parents=True, exist_ok=True)
settings.INCIDENT_CACHE_DIR.mkdir(parents=True, exist_ok=True)
