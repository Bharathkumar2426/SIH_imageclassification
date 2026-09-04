"""Real YOLO Side-Scan Sonar Object Detection Module (SIH 26057).

Wraps Ultralytics YOLO with PyTorch, CUDA/CPU device auto-detection, coordinate
rescaling from letterboxed space to original pixel space, configurable NMS/IoU,
and individual tight target annotation rendering.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
import torch
import yaml
from ultralytics import YOLO

from ml.preprocessing.sonar_preprocessor import PreprocessedSonarStages, to_png_base64

logger = logging.getLogger("SonarDetector")

DEFAULT_CLASSES_PATH = Path("ml/configs/sonar_classes.yaml")


class SonarObjectDetector:
    """Production YOLO Detector for Side-Scan Sonar Imagery."""

    def __init__(
        self,
        weights_path: Optional[str | Path] = None,
        config_path: str | Path = DEFAULT_CLASSES_PATH,
        default_conf: float = 0.25,
        default_iou: float = 0.45,
    ):
        self.config_path = Path(config_path)
        self.default_conf = default_conf
        self.default_iou = default_iou
        self.device = "cuda:0" if torch.cuda.is_available() else "cpu"
        
        # Load taxonomy and palette from config
        self._load_config()

        # Resolve weights path
        self.weights_path = self._resolve_weights_path(weights_path)
        self.model: Optional[YOLO] = None
        self.is_loaded = False
        self.is_sonar_trained = False
        self.model_version = "unloaded"
        self.model_summary = "Initializing..."

        # Load weights
        self._load_model()

    def _load_config(self) -> None:
        """Loads class taxonomy and display properties from YAML."""
        if self.config_path.exists():
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    cfg = yaml.safe_load(f)
                tax = cfg.get("taxonomy", {})
                self.class_taxonomy = tax.get("classes", {})
                self.display_names = tax.get("display_names", {})
                self.color_palette = tax.get("color_palette", {})
                self.inference_defaults = cfg.get("inference_defaults", {})
                return
            except Exception as e:
                logger.error(f"Error loading sonar_classes.yaml: {e}")

        # Fallback defaults
        self.class_taxonomy = {
            0: "metal_debris", 1: "plastic_debris", 2: "fishing_gear",
            3: "rope_or_net", 4: "container", 5: "pipe", 6: "tire",
            7: "vehicle_or_large_structure", 8: "wreckage",
            9: "unknown_debris", 10: "natural_anomaly",
        }
        self.display_names = {v: v.replace("_", " ").title() for v in self.class_taxonomy.values()}
        self.color_palette = {}
        self.inference_defaults = {"low_confidence_threshold": 0.35}

    def _resolve_weights_path(self, explicit_path: Optional[str | Path]) -> Path:
        """Finds the most suitable model weights, prioritizing sonar-trained checkpoints."""
        candidates = []
        if explicit_path:
            candidates.append(Path(explicit_path))

        # Standard project weights locations
        candidates.extend([
            Path("ml/weights/sonar_best.pt"),
            Path("backend/models/sonar_best.pt"),
            Path("ml/weights/best.pt"),
            Path("yolov8n.pt"),
        ])

        for p in candidates:
            if p.exists():
                return p

        # Default target even if it doesn't yet exist
        return Path("ml/weights/sonar_best.pt")

    def _load_model(self) -> bool:
        """Loads YOLO model and determines if it is sonar-trained or base architecture."""
        if not self.weights_path.exists():
            # Try to load base yolov8n as fallback
            try:
                logger.warning(
                    f"Sonar weights not found at {self.weights_path}. Loading base architecture 'yolov8n.pt'..."
                )
                self.model = YOLO("yolov8n.pt")
                self.is_loaded = True
                self.is_sonar_trained = False
                self.model_version = "yolov8n-base-awaiting-sonar-training"
                self.model_summary = "Base YOLOv8 (Awaiting Sonar Training Dataset Checkpoint)"
                logger.info("Base YOLOv8 loaded successfully.")
                return True
            except Exception as e:
                logger.error(f"Failed to load base YOLO: {e}")
                self.is_loaded = False
                return False

        try:
            self.model = YOLO(str(self.weights_path))
            self.is_loaded = True
            
            # Verify if this model is trained on sonar classes
            model_classes = self.model.names
            sonar_class_names = set(self.class_taxonomy.values())
            is_sonar = any(c in sonar_class_names for c in model_classes.values())

            self.is_sonar_trained = is_sonar
            if is_sonar:
                self.model_version = f"sonar_yolo_{self.weights_path.stem}"
                self.model_summary = f"Verified Sonar Detector ({self.weights_path.name})"
                # Update class names from model if trained
                self.class_names = model_classes
            else:
                self.model_version = f"base_{self.weights_path.name}"
                self.model_summary = f"Base Weights ({self.weights_path.name}) - Prototype Mode"
                self.class_names = model_classes

            logger.info(
                f"Model loaded: {self.weights_path} (Device: {self.device}, Sonar-Trained: {self.is_sonar_trained})"
            )
            return True
        except Exception as e:
            logger.error(f"Failed to load weights from {self.weights_path}: {e}")
            self.is_loaded = False
            return False

    def predict(
        self,
        stages: PreprocessedSonarStages,
        confidence_threshold: Optional[float] = None,
        iou_threshold: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Runs real YOLO object detection and extracts individual target bounding boxes."""
        if not self.is_loaded or self.model is None:
            raise RuntimeError("YOLO Sonar model is not loaded. Please verify model weights.")

        conf = confidence_threshold if confidence_threshold is not None else self.default_conf
        iou = iou_threshold if iou_threshold is not None else self.default_iou

        orig_w, orig_h = stages.original_dims
        scale_r = stages.scale_ratio
        pad_w, pad_h = stages.pad_offsets

        # Run model inference on preprocessed letterbox image
        results = self.model.predict(
            source=stages.model_input,
            conf=conf,
            iou=iou,
            device=self.device,
            verbose=False,
        )

        boxes = results[0].boxes
        detections: List[Dict[str, Any]] = []

        # Prepare canvas for annotated output (drawn on enhanced image for maximum visibility)
        annotated_canvas = stages.enhanced_bgr.copy()

        palette_defaults = [
            (56, 189, 248),   # Sky Blue
            (16, 185, 129),   # Emerald
            (245, 158, 11),   # Amber
            (239, 68, 68),    # Rose
            (168, 85, 247),   # Purple
            (14, 165, 233),   # Cyan
        ]

        low_conf_thresh = self.inference_defaults.get("low_confidence_threshold", 0.35)

        # Class-agnostic NMS to prevent duplicate overlapping boxes on the same target
        keep_boxes = []
        raw_boxes_list = []
        for box in boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            conf_val = float(box.conf[0].item())
            cid_val = int(box.cls[0].item())
            raw_boxes_list.append({
                "box": box,
                "xyxy": [x1, y1, x2, y2],
                "conf": conf_val,
                "cid": cid_val
            })

        # Sort by confidence descending
        raw_boxes_list.sort(key=lambda x: x["conf"], reverse=True)

        def is_duplicate_box(b1, b2, iou_thresh):
            xa = max(b1[0], b2[0])
            ya = max(b1[1], b2[1])
            xb = min(b1[2], b2[2])
            yb = min(b1[3], b2[3])
            inter = max(0, xb - xa) * max(0, yb - ya)
            if inter <= 0:
                return False
            area1 = (b1[2] - b1[0]) * (b1[3] - b1[1])
            area2 = (b2[2] - b2[0]) * (b2[3] - b2[1])
            union = area1 + area2 - inter
            iou_score = inter / union if union > 0 else 0
            ios_score = inter / min(area1, area2) if min(area1, area2) > 0 else 0
            return iou_score > iou_thresh or ios_score > 0.35

        filtered_boxes = []
        for item in raw_boxes_list:
            overlap = False
            for kept in filtered_boxes:
                if is_duplicate_box(item["xyxy"], kept["xyxy"], iou):
                    overlap = True
                    break
            if not overlap:
                filtered_boxes.append(item)

        for idx, item in enumerate(filtered_boxes):
            box = item["box"]
            cid = item["cid"]
            score = item["conf"]

            # Get class name directly from active model
            if hasattr(self, "class_names") and cid in self.class_names:
                raw_cname = self.class_names[cid]
            elif hasattr(self.model, "names") and cid in self.model.names:
                raw_cname = self.model.names[cid]
            else:
                raw_cname = self.class_taxonomy.get(cid, f"debris_{cid}")

            # Recognize specific debris type cleanly matching Image 1
            display_name = self.display_names.get(raw_cname, raw_cname.replace("_", " ").title())
            cname = raw_cname
            anomaly_type = "KNOWN_OBJECT"

            # Unscale coordinates from letterbox back to original image coordinates
            x1_lb, y1_lb, x2_lb, y2_lb = item["xyxy"]

            x1_orig = (x1_lb - pad_w) / scale_r
            y1_orig = (y1_lb - pad_h) / scale_r
            x2_orig = (x2_lb - pad_w) / scale_r
            y2_orig = (y2_lb - pad_h) / scale_r

            # Clamp coordinates to original image bounds
            x1 = max(0, min(orig_w, int(round(x1_orig))))
            y1 = max(0, min(orig_h, int(round(y1_orig))))
            x2 = max(0, min(orig_w, int(round(x2_orig))))
            y2 = max(0, min(orig_h, int(round(y2_orig))))

            bw = max(1, x2 - x1)
            bh = max(1, y2 - y1)
            area = bw * bh
            cx = round(x1 + (bw / 2.0), 1)
            cy = round(y1 + (bh / 2.0), 1)

            det_item = {
                "id": idx + 1,
                "class": cname,
                "display_name": display_name,
                "class_id": cid,
                "confidence": round(score, 4),
                "bbox": {
                    "x": x1,
                    "y": y1,
                    "width": bw,
                    "height": bh,
                },
                "center": {
                    "x": cx,
                    "y": cy,
                },
                "area": area,
                "anomaly_type": anomaly_type,
            }
            detections.append(det_item)

            # Get color for rendering
            if cname in self.color_palette:
                color = tuple(self.color_palette[cname])
            else:
                color = palette_defaults[cid % len(palette_defaults)]

            # Section 8: Bounding Box Quality - Draw tight bounding box
            thickness = max(2, int(round(min(orig_w, orig_h) / 300.0)))
            cv2.rectangle(annotated_canvas, (x1, y1), (x2, y2), color, thickness)

            # Draw acoustic center crosshair / dot
            cv2.circle(annotated_canvas, (int(cx), int(cy)), max(3, thickness), (0, 255, 128), -1)

            # Draw label banner matching Image 1: <Type> — <Confidence>%
            label_text = f"{display_name} — {int(round(score * 100))}%"
            font_scale = max(0.45, min(orig_w, orig_h) / 1100.0)
            (text_w, text_h), baseline = cv2.getTextSize(
                label_text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, 1
            )

            # Banner background rectangle with dark pill backing
            banner_y1 = max(0, y1 - text_h - 10)
            banner_y2 = y1
            cv2.rectangle(
                annotated_canvas,
                (x1, banner_y1),
                (x1 + text_w + 12, banner_y2),
                (6, 78, 59),  # Dark emerald/teal backing
                -1,
            )
            cv2.rectangle(
                annotated_canvas,
                (x1, banner_y1),
                (x1 + text_w + 12, banner_y2),
                color,  # Border matching class
                1,
            )
            # Text label in crisp white
            cv2.putText(
                annotated_canvas,
                label_text,
                (x1 + 6, banner_y2 - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                font_scale,
                (255, 255, 255),
                1,
                cv2.LINE_AA,
            )

        annotated_b64 = to_png_base64(annotated_canvas)

        return {
            "detections": detections,
            "total_objects": len(detections),
            "annotated_bgr": annotated_canvas,
            "annotated_b64": annotated_b64,
            "model_metadata": {
                "version": self.model_version,
                "weights_path": str(self.weights_path),
                "is_sonar_trained": self.is_sonar_trained,
                "summary": self.model_summary,
                "device": self.device,
                "confidence_threshold": conf,
                "iou_threshold": iou,
            },
        }
