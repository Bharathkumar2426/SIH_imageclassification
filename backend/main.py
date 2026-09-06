"""Main FastAPI Application Entrypoint (SIH 26057)."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.api.routes import router as api_router
from backend.api.geospatial_routes import router as geospatial_router
from backend.api.ais_routes import router as ais_router
from backend.config import settings
from backend.database import init_db
from backend.services.ais_service import get_ais_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("MainApp")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initializes SQLite database schema and starts AISStream tracking service."""
    logger.info("Initializing SQLite database tables...")
    await init_db()
    logger.info("Database initialized successfully.")
    
    # Start isolated live AISStream ingestion service
    ais_svc = get_ais_service()
    await ais_svc.start()
    
    yield
    
    # Graceful shutdown of AISStream service
    await ais_svc.stop()
    logger.info("Application shutting down.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="AI-Powered Side-Scan Sonar Marine Debris and Underwater Anomaly Detection Pipeline.",
    lifespan=lifespan,
)

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(api_router, prefix=settings.API_PREFIX)
app.include_router(geospatial_router, prefix=settings.API_PREFIX)
app.include_router(ais_router, prefix=settings.API_PREFIX)

# Serve uploaded / processed static files if needed
app.mount("/static/uploads", StaticFiles(directory=str(settings.UPLOAD_DIR)), name="uploads")


@app.get("/", summary="Root Health Status")
async def root():
    return {
        "service": settings.PROJECT_NAME,
        "status": "online",
        "docs": "/docs",
        "api": f"{settings.API_PREFIX}/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=False)
