"""SQLAlchemy ORM Models matching Section 13 of Requirements (SIH 26057)."""

from datetime import datetime, timezone
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class ImageRecord(Base):
    """Stores side-scan sonar image upload and path metadata."""
    __tablename__ = "images"

    # Schema strictly adhering to Section 13
    image_id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    upload_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    original_image_path: Mapped[str] = mapped_column(String(512), nullable=False)
    processed_image_path: Mapped[str] = mapped_column(String(512), nullable=False)
    annotated_image_path: Mapped[str] = mapped_column(String(512), nullable=False)
    image_width: Mapped[int] = mapped_column(Integer, nullable=False)
    image_height: Mapped[int] = mapped_column(Integer, nullable=False)

    # One-to-many relationship with detections
    detections: Mapped[list["DetectionRecord"]] = relationship(
        "DetectionRecord",
        back_populates="image",
        cascade="all, delete-orphan",
    )


class DetectionRecord(Base):
    """Stores individual target detection records matching Section 13."""
    __tablename__ = "detections"

    # Schema strictly adhering to Section 13
    detection_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    image_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("images.image_id", ondelete="CASCADE"), index=True, nullable=False
    )
    class_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    x: Mapped[int] = mapped_column(Integer, nullable=False)
    y: Mapped[int] = mapped_column(Integer, nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    area: Mapped[int] = mapped_column(Integer, nullable=False)
    model_version: Mapped[str] = mapped_column(String(64), nullable=False)
    inference_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationship back to ImageRecord
    image: Mapped["ImageRecord"] = relationship("ImageRecord", back_populates="detections")
