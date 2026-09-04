"""End-to-End Sonar Detection Orchestration Service (SIH 26057).

Implements the 12-stage pipeline defined in Section 7 of the user requirements:
 1. Validate image
 2. Save original image
 3. Run sonar preprocessing (modular stages)
 4. Run model inference
 5. Apply confidence threshold
 6. Apply NMS/IoU filtering
 7. Extract every detection
 8. Generate bounding boxes
 9. Generate confidence scores
 10. Generate annotated image
 11. Store detection metadata in SQLite
 12. Return structured JSON matching Section 7
"""

from __future__ import annotations

import logging
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

import cv2
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import settings
from backend.models.schemas import (
    BoundingBox,
    CenterPoint,
    DetectionItem,
    DetectionSummaryStats,
    DetectResponse,
)
from backend.services.storage_service import StorageService
from ml.inference.detector import SonarObjectDetector
from ml.preprocessing.sonar_preprocessor import SonarPreprocessor

logger = logging.getLogger("DetectionService")

_global_detector: Optional[SonarObjectDetector] = None


def get_detector() -> SonarObjectDetector:
    """Lazy singleton instantiation of the YOLO Sonar Detector."""
    global _global_detector
    if _global_detector is None:
        _global_detector = SonarObjectDetector()
    return _global_detector


class DetectionService:
    """Orchestrates side-scan sonar image ingestion, preprocessing, inference, and persistence."""

    def __init__(self):
        self.preprocessor = SonarPreprocessor(target_size=640)
        self.detector = get_detector()

    def generate_image_id(self) -> str:
        """Generates a clean sequential-styled identifier for the sonar inspection."""
        random_suffix = uuid.uuid4().hex[:6].upper()
        timestamp = time.strftime("%Y%m%d%H%M%S")
        return f"SONAR_{timestamp}_{random_suffix}"

    async def execute_detection_pipeline(
        self,
        image_bytes: bytes,
        filename: str,
        confidence_threshold: Optional[float] = None,
        iou_threshold: Optional[float] = None,
        enable_preprocessing: bool = True,
        session: Optional[AsyncSession] = None,
    ) -> DetectResponse:
        """Executes the complete 12-step pipeline and persists structured results."""
        total_start = time.time()
        image_id = self.generate_image_id()

        # Step 1: Validate Image
        logger.info(f"[{image_id}] Beginning inspection for file: {filename} ({len(image_bytes)} bytes)")
        if len(image_bytes) == 0:
            raise ValueError("Uploaded sonar image is empty.")

        # Step 2: Save original raw file to storage
        safe_name = Path(filename).name
        ext = Path(safe_name).suffix or ".png"
        raw_filename = f"{image_id}_orig{ext}"
        orig_file_path = settings.UPLOAD_DIR / raw_filename
        orig_file_path.write_bytes(image_bytes)

        # Step 3: Run Modular Sonar Preprocessing
        prep_start = time.time()
        stages = self.preprocessor.process(
            input_data=image_bytes,
            enable_preprocessing=enable_preprocessing,
        )
        prep_time_ms = round((time.time() - prep_start) * 1000.0, 2)
        orig_w, orig_h = stages.original_dims

        # Save preprocessed/enhanced image
        proc_filename = f"{image_id}_enhanced.png"
        proc_file_path = settings.UPLOAD_DIR / proc_filename
        cv2.imwrite(str(proc_file_path), stages.enhanced_bgr)

        # Steps 4-9: Run YOLO Inference, NMS, and Individual Bounding Box Extraction
        infer_start = time.time()
        prediction_result = self.detector.predict(
            stages=stages,
            confidence_threshold=confidence_threshold,
            iou_threshold=iou_threshold,
        )
        infer_time_ms = round((time.time() - infer_start) * 1000.0, 2)

        raw_detections = prediction_result["detections"]
        annotated_bgr = prediction_result["annotated_bgr"]

        # Step 10: Save Annotated Image
        anno_filename = f"{image_id}_annotated.png"
        anno_file_path = settings.UPLOAD_DIR / anno_filename
        cv2.imwrite(str(anno_file_path), annotated_bgr)

        # Build schema items & stats
        detection_items: list[DetectionItem] = []
        high_conf, med_conf, low_conf = 0, 0, 0

        for d in raw_detections:
            conf = d["confidence"]
            if conf >= 0.70:
                high_conf += 1
            elif conf >= 0.40:
                med_conf += 1
            else:
                low_conf += 1

            bbox_obj = BoundingBox(
                x=d["bbox"]["x"],
                y=d["bbox"]["y"],
                width=d["bbox"]["width"],
                height=d["bbox"]["height"],
            )
            center_obj = CenterPoint(
                x=d["center"]["x"],
                y=d["center"]["y"],
            )
            item = DetectionItem(
                id=d["id"],
                class_name=d["class"],
                display_name=d["display_name"],
                confidence=d["confidence"],
                bbox=bbox_obj,
                center=center_obj,
                area=d["area"],
                anomaly_type=d["anomaly_type"],
            )
            detection_items.append(item)

        # Step 11: Store Detection Metadata in SQLite
        model_version = prediction_result["model_metadata"]["version"]
        if session is not None:
            await StorageService.create_image_record(
                session=session,
                image_id=image_id,
                original_filename=filename,
                original_path=str(orig_file_path),
                processed_path=str(proc_file_path),
                annotated_path=str(anno_file_path),
                image_width=orig_w,
                image_height=orig_h,
            )
            await StorageService.save_detections(
                session=session,
                image_id=image_id,
                detections=raw_detections,
                model_version=model_version,
            )
            logger.info(f"[{image_id}] Successfully persisted to SQLite database.")

        total_time_ms = round((time.time() - total_start) * 1000.0, 2)

        # Step 12: Construct structured response strictly matching Section 7
        stage_images = {
            "original": stages.stage_b64["original"],
            "enhanced": stages.stage_b64["enhanced"],
            "denoised": stages.stage_b64["denoised"],
            "annotated": prediction_result["annotated_b64"],
        }

        response = DetectResponse(
            image_id=image_id,
            model=model_version,
            detections=detection_items,
            total_objects=len(detection_items),
            annotated_image_url=f"/api/images/{image_id}/annotated",
            original_image_url=f"/api/images/{image_id}/original",
            enhanced_image_url=f"/api/images/{image_id}/enhanced",
            processing_time_ms=total_time_ms,
            preprocessing_time_ms=prep_time_ms,
            inference_time_ms=infer_time_ms,
            summary=DetectionSummaryStats(
                total=len(detection_items),
                high_confidence=high_conf,
                medium_confidence=med_conf,
                low_confidence=low_conf,
            ),
            model_metadata=prediction_result["model_metadata"],
            stage_images=stage_images,
        )

        return response


def get_detection_service() -> DetectionService:
    return DetectionService()
