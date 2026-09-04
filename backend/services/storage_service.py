"""Storage Service for SQLite Persistence matching Section 13 (SIH 26057)."""

from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models.db_models import ImageRecord, DetectionRecord
from backend.models.schemas import DetectionItem, BoundingBox, CenterPoint


class StorageService:
    """Handles database transactions for Sonar Images and Detections."""

    @staticmethod
    async def create_image_record(
        session: AsyncSession,
        image_id: str,
        original_filename: str,
        original_path: str,
        processed_path: str,
        annotated_path: str,
        image_width: int,
        image_height: int,
    ) -> ImageRecord:
        """Persists image record into SQLite images table."""
        record = ImageRecord(
            image_id=image_id,
            original_filename=original_filename,
            upload_timestamp=datetime.now(timezone.utc),
            original_image_path=str(original_path),
            processed_image_path=str(processed_path),
            annotated_image_path=str(annotated_path),
            image_width=image_width,
            image_height=image_height,
        )
        session.add(record)
        await session.commit()
        await session.refresh(record)
        return record

    @staticmethod
    async def save_detections(
        session: AsyncSession,
        image_id: str,
        detections: List[dict],
        model_version: str,
    ) -> List[DetectionRecord]:
        """Persists individual target bounding boxes and confidences into detections table."""
        records = []
        now = datetime.now(timezone.utc)
        for det in detections:
            bbox = det["bbox"]
            rec = DetectionRecord(
                image_id=image_id,
                class_name=det["class"],
                confidence=float(det["confidence"]),
                x=int(bbox["x"]),
                y=int(bbox["y"]),
                width=int(bbox["width"]),
                height=int(bbox["height"]),
                area=int(det["area"]),
                model_version=model_version,
                inference_timestamp=now,
            )
            session.add(rec)
            records.append(rec)

        await session.commit()
        return records

    @staticmethod
    async def get_image_with_detections(
        session: AsyncSession,
        image_id: str,
    ) -> Optional[ImageRecord]:
        """Retrieves an image record along with all associated detection objects."""
        stmt = (
            select(ImageRecord)
            .where(ImageRecord.image_id == image_id)
            .options(selectinload(ImageRecord.detections))
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_detections_by_image(
        session: AsyncSession,
        image_id: str,
    ) -> List[DetectionRecord]:
        """Retrieves only detection records for a specific image."""
        stmt = (
            select(DetectionRecord)
            .where(DetectionRecord.image_id == image_id)
            .order_by(DetectionRecord.detection_id.asc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def list_recent_images(
        session: AsyncSession,
        limit: int = 50,
    ) -> List[ImageRecord]:
        """Returns the most recent image inspections."""
        stmt = (
            select(ImageRecord)
            .order_by(desc(ImageRecord.upload_timestamp))
            .limit(limit)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())
