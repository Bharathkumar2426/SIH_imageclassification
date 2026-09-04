"""Pydantic Request & Response Schemas matching Sections 2 & 7 of Requirements."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    """Bounding box format strictly matching Section 2 & 7 example."""
    x: int = Field(..., description="Top-left x coordinate")
    y: int = Field(..., description="Top-left y coordinate")
    width: int = Field(..., description="Bounding box width")
    height: int = Field(..., description="Bounding box height")


class CenterPoint(BaseModel):
    x: float
    y: float


class DetectionItem(BaseModel):
    """Detection item matching Section 2 & 7 format with SIH acoustic metadata."""
    id: int = Field(..., description="Detection target index (1, 2, ...)")
    class_name: str = Field(..., alias="class", description="Class name (e.g. metal_debris)")
    display_name: str = Field(..., description="Human-readable name (e.g. Metal Debris)")
    confidence: float = Field(..., description="Real model confidence score (0.0 to 1.0)")
    bbox: BoundingBox = Field(..., description="Bounding box coordinates")
    center: CenterPoint = Field(..., description="Target geometric acoustic center")
    area: int = Field(..., description="Bounding box pixel area")
    anomaly_type: str = Field("KNOWN_OBJECT", description="KNOWN_OBJECT or UNCLASSIFIED_ANOMALY")

    class Config:
        populate_by_name = True


class DetectionSummaryStats(BaseModel):
    total: int = 0
    high_confidence: int = 0      # >= 0.70
    medium_confidence: int = 0    # 0.40 - 0.70
    low_confidence: int = 0       # < 0.40


class DetectResponse(BaseModel):
    """Inference response schema matching Section 7 example."""
    image_id: str = Field(..., description="Unique sonar image identifier (e.g. SONAR_000001)")
    model: str = Field(..., description="Model version/name used for inference")
    detections: List[DetectionItem] = Field(..., description="List of detected targets")
    total_objects: int = Field(..., description="Total count of confident targets")
    annotated_image_url: str = Field(..., description="Relative or absolute URL to annotated image")
    original_image_url: str = Field(..., description="URL to original image")
    enhanced_image_url: str = Field(..., description="URL to preprocessed/enhanced image")
    processing_time_ms: float = Field(..., description="Total processing latency in milliseconds")
    preprocessing_time_ms: float = Field(..., description="Preprocessing latency in milliseconds")
    inference_time_ms: float = Field(..., description="Model inference latency in milliseconds")
    summary: DetectionSummaryStats = Field(..., description="High/medium/low confidence counts")
    model_metadata: Dict[str, Any] = Field(default_factory=dict)
    # Stage base64 data for immediate side-by-side comparison in UI
    stage_images: Dict[str, str] = Field(default_factory=dict)


class ImageDetailsResponse(BaseModel):
    image_id: str
    original_filename: str
    upload_timestamp: datetime
    image_width: int
    image_height: int
    original_url: str
    processed_url: str
    annotated_url: str
    total_detections: int
    detections: List[DetectionItem]


class HealthResponse(BaseModel):
    status: str = "ok"
    project: str
    version: str
    pytorch_version: str
    cuda_available: bool
    device_name: str
    model_version: str
    model_summary: str
    is_sonar_trained: bool
    classes_count: int
    classes: Dict[int, str]
