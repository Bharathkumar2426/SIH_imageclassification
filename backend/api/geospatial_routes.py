"""Geospatial, Severity, and Dynamic Geofencing REST API Endpoints (SIH 26057)."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models.geospatial_schemas import (
    GeospatialDetectionItem,
    GeospatialImageResponse,
    SeverityLevel,
)
from backend.services.geospatial_service import (
    BASE_GEOFENCE_RADII,
    DEFAULT_ALTITUDE_M,
    DEFAULT_SURVEY_LAT,
    DEFAULT_SURVEY_LNG,
    SEVERITY_COLORS,
    SEVERITY_RISK_SUMMARIES,
    GeospatialService,
)
from backend.services.storage_service import StorageService

logger = logging.getLogger("GeospatialRoutes")

router = APIRouter(prefix="/geospatial", tags=["Geospatial & Geofencing"])


@router.post(
    "/enrich",
    response_model=GeospatialImageResponse,
    summary="Enrich live detection results with Geospatial, Severity, and Dynamic Geofencing data",
    description="Consumes existing detection output without modifying original values and generates dynamic geofences and WGS84 coordinates.",
)
async def enrich_detection_results(
    payload: Dict[str, Any],
    latitude: Optional[float] = Query(DEFAULT_SURVEY_LAT, description="Survey Towfish Latitude"),
    longitude: Optional[float] = Query(DEFAULT_SURVEY_LNG, description="Survey Towfish Longitude"),
    depth: Optional[float] = Query(DEFAULT_ALTITUDE_M, description="Towfish Altitude / Depth (meters)"),
) -> GeospatialImageResponse:
    """Enriches detection results with geospatial coordinates, severity tier, and dynamic safety geofences."""
    try:
        lat = latitude if latitude is not None else DEFAULT_SURVEY_LAT
        lng = longitude if longitude is not None else DEFAULT_SURVEY_LNG
        dep = depth if depth is not None else DEFAULT_ALTITUDE_M

        enriched = GeospatialService.enrich_image_response(
            detect_response_dict=payload,
            towfish_lat=lat,
            towfish_lng=lng,
            depth_m=dep,
        )
        return enriched
    except Exception as e:
        logger.exception(f"Error enriching geospatial data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to enrich geospatial data: {str(e)}",
        ) from e


@router.get(
    "/{image_id}",
    response_model=GeospatialImageResponse,
    summary="Get geospatial & geofence data for a stored sonar image",
)
async def get_geospatial_by_image_id(
    image_id: str,
    latitude: Optional[float] = Query(DEFAULT_SURVEY_LAT),
    longitude: Optional[float] = Query(DEFAULT_SURVEY_LNG),
    depth: Optional[float] = Query(DEFAULT_ALTITUDE_M),
    db: AsyncSession = Depends(get_db),
) -> GeospatialImageResponse:
    """Retrieves image detections from SQLite and computes geospatial representation and geofences."""
    img = await StorageService.get_image_with_detections(db, image_id)
    if not img:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Image with ID '{image_id}' not found.",
        )

    raw_detections = []
    for idx, d in enumerate(img.detections):
        raw_detections.append({
            "id": idx + 1,
            "class_name": d.class_name,
            "display_name": d.class_name.replace("_", " ").title(),
            "confidence": d.confidence,
            "bbox": [d.x, d.y, d.x + d.width, d.y + d.height],
            "bbox_coords": {"x": d.x, "y": d.y, "width": d.width, "height": d.height},
            "center": {"x": d.x + (d.width / 2.0), "y": d.y + (d.height / 2.0)},
            "area": d.area,
            "anomaly_score": float(getattr(d, "anomaly_score", 0.0) or 0.0),
            "classification_source": str(getattr(d, "classification_source", "detector") or "detector"),
        })

    payload = {
        "image_id": img.image_id,
        "image_width": img.image_width,
        "image_height": img.image_height,
        "model": "sonar_v2.pt",
        "detections": raw_detections,
    }

    lat = latitude if latitude is not None else DEFAULT_SURVEY_LAT
    lng = longitude if longitude is not None else DEFAULT_SURVEY_LNG
    dep = depth if depth is not None else DEFAULT_ALTITUDE_M

    return GeospatialService.enrich_image_response(
        detect_response_dict=payload,
        towfish_lat=lat,
        towfish_lng=lng,
        depth_m=dep,
    )


@router.get(
    "/all/fleet",
    summary="Get all historical detections as a unified fleet geospatial collection",
)
async def get_all_fleet_geospatial(
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Aggregates all stored detections across historical survey runs for mission-level mapping."""
    from backend.models.db_models import ImageRecord
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    stmt = select(ImageRecord).options(selectinload(ImageRecord.detections))
    res = await db.execute(stmt)
    images = res.scalars().all()

    all_features = []
    for img_idx, img in enumerate(images):
        # Slight simulated survey track spacing per inspection run
        tow_lat = DEFAULT_SURVEY_LAT + (img_idx * 0.0012)
        tow_lng = DEFAULT_SURVEY_LNG + (img_idx * 0.0015)

        for d_idx, d in enumerate(img.detections):
            det_dict = {
                "id": d_idx + 1,
                "class_name": d.class_name,
                "display_name": d.class_name.replace("_", " ").title(),
                "confidence": d.confidence,
                "bbox": [d.x, d.y, d.x + d.width, d.y + d.height],
                "bbox_coords": {"x": d.x, "y": d.y, "width": d.width, "height": d.height},
                "center": {"x": d.x + (d.width / 2.0), "y": d.y + (d.height / 2.0)},
                "area": d.area,
                "anomaly_score": float(getattr(d, "anomaly_score", 0.0) or 0.0),
                "classification_source": str(getattr(d, "classification_source", "detector") or "detector"),
            }

            enriched_item = GeospatialService.enrich_detection_item(
                det_dict=det_dict,
                image_id=img.image_id,
                image_width=img.image_width,
                image_height=img.image_height,
                towfish_lat=tow_lat,
                towfish_lng=tow_lng,
                depth_m=DEFAULT_ALTITUDE_M,
            )
            all_features.append(enriched_item.model_dump())

    return {
        "survey_zone": "Palk Strait / Gulf of Mannar MoES Acoustic Survey",
        "total_targets": len(all_features),
        "features": all_features,
    }


@router.get(
    "/config/parameters",
    summary="Get geospatial, severity, and geofencing configuration constants",
)
async def get_geospatial_config() -> Dict[str, Any]:
    """Returns severity thresholds, color codes, base geofence radii, and GIS baseline."""
    return {
        "default_coordinates": {
            "latitude": DEFAULT_SURVEY_LAT,
            "longitude": DEFAULT_SURVEY_LNG,
            "altitude_depth_m": DEFAULT_ALTITUDE_M,
            "survey_zone": "Palk Strait, India (9.3142°N, 79.1821°E)",
        },
        "severity_levels": {
            "EXTREME": {
                "color": SEVERITY_COLORS[SeverityLevel.EXTREME],
                "base_radius_m": BASE_GEOFENCE_RADII[SeverityLevel.EXTREME],
                "description": SEVERITY_RISK_SUMMARIES[SeverityLevel.EXTREME],
            },
            "MEDIUM": {
                "color": SEVERITY_COLORS[SeverityLevel.MEDIUM],
                "base_radius_m": BASE_GEOFENCE_RADII[SeverityLevel.MEDIUM],
                "description": SEVERITY_RISK_SUMMARIES[SeverityLevel.MEDIUM],
            },
            "LOW": {
                "color": SEVERITY_COLORS[SeverityLevel.LOW],
                "base_radius_m": BASE_GEOFENCE_RADII[SeverityLevel.LOW],
                "description": SEVERITY_RISK_SUMMARIES[SeverityLevel.LOW],
            },
        },
    }
