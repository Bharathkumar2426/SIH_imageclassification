"""Side-Scan Sonar Dataset Builder & Quality Auditor (SIH 26057).

Handles:
1. Verification of YOLO dataset structure:
   dataset/
       images/{train,val,test}
       labels/{train,val,test}
2. Quality audit:
   - image/label matching
   - corrupt images
   - missing labels
   - invalid bounding boxes (out-of-bounds, negative, w/h <= 0)
   - duplicate labels
   - class IDs verification
   - train/val/test split summary
   - class imbalance
3. Physics-based synthetic sonar sample generator to bootstrap initial sonar models.
"""

from __future__ import annotations

import json
import logging
import math
import random
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image
import yaml

logger = logging.getLogger("DatasetBuilder")


class SonarDatasetAuditor:
    """Audits YOLO dataset integrity, annotations, and class distributions."""

    def __init__(self, data_yaml_path: str | Path):
        self.data_yaml_path = Path(data_yaml_path)
        self.classes: Dict[int, str] = {}
        self.dataset_root: Path = Path(".")
        self._load_config()

    def _load_config(self) -> None:
        if not self.data_yaml_path.exists():
            raise FileNotFoundError(f"YAML config not found: {self.data_yaml_path}")
        with open(self.data_yaml_path, "r", encoding="utf-8") as f:
            cfg = yaml.safe_load(f)
        
        if "path" in cfg and cfg["path"]:
            p = Path(cfg["path"])
            if p.is_absolute() and p.exists():
                self.dataset_root = p
            elif (self.data_yaml_path.parent / p).exists():
                self.dataset_root = (self.data_yaml_path.parent / p).resolve()
            elif p.exists():
                self.dataset_root = p.resolve()
            else:
                self.dataset_root = self.data_yaml_path.parent
        else:
            self.dataset_root = self.data_yaml_path.parent

        names = cfg.get("names", {})
        if isinstance(names, list):
            self.classes = {i: n for i, n in enumerate(names)}
        elif isinstance(names, dict):
            self.classes = {int(k): str(v) for k, v in names.items()}

        self.splits = {
            "train": cfg.get("train", "images/train"),
            "val": cfg.get("val", "images/val"),
            "test": cfg.get("test", "images/test"),
        }

    def audit(self) -> Dict[str, Any]:
        """Runs thorough audit across all splits."""
        report = {
            "total_images": 0,
            "splits": {},
            "classes_defined": len(self.classes),
            "objects_per_class": {c: 0 for c in self.classes.values()},
            "empty_images": 0,
            "corrupt_images": 0,
            "missing_labels": 0,
            "invalid_annotations": 0,
            "duplicate_annotations": 0,
        }

        image_extensions = {".png", ".jpg", ".jpeg", ".tif", ".tiff"}

        for split_name, rel_path in self.splits.items():
            img_dir = self.dataset_root / rel_path
            if not img_dir.exists():
                # Try sibling resolution: images/{split}
                img_dir = self.dataset_root / "images" / split_name

            split_stats = {
                "images": 0,
                "labels": 0,
                "empty_labels": 0,
                "missing_labels": 0,
                "corrupt": 0,
                "invalid_boxes": 0,
            }

            if not img_dir.exists():
                split_stats["status"] = "directory_missing"
                report["splits"][split_name] = split_stats
                continue

            # Check matching labels directory
            lbl_dir = img_dir.parent / "labels"
            if not lbl_dir.exists():
                lbl_dir = img_dir.parent.parent / "labels" / split_name
            if not lbl_dir.exists():
                lbl_dir = self.dataset_root / "labels" / split_name

            img_files = [f for f in img_dir.iterdir() if f.suffix.lower() in image_extensions]
            split_stats["images"] = len(img_files)
            report["total_images"] += len(img_files)

            for img_path in img_files:
                # 1. Check image corruption
                try:
                    with Image.open(img_path) as im:
                        im.verify()
                except Exception:
                    report["corrupt_images"] += 1
                    split_stats["corrupt"] += 1
                    continue

                # 2. Check label file
                lbl_path = lbl_dir / f"{img_path.stem}.txt"
                if not lbl_path.exists():
                    report["missing_labels"] += 1
                    split_stats["missing_labels"] += 1
                    continue

                split_stats["labels"] += 1
                try:
                    content = lbl_path.read_text(encoding="utf-8").strip()
                except Exception:
                    content = ""

                if not content:
                    report["empty_images"] += 1
                    split_stats["empty_labels"] += 1
                    continue

                lines = content.splitlines()
                seen_boxes = set()

                for line_idx, line in enumerate(lines):
                    parts = line.strip().split()
                    if len(parts) != 5:
                        report["invalid_annotations"] += 1
                        split_stats["invalid_boxes"] += 1
                        continue

                    try:
                        cid = int(parts[0])
                        cx, cy, w, h = [float(v) for v in parts[1:]]
                    except ValueError:
                        report["invalid_annotations"] += 1
                        split_stats["invalid_boxes"] += 1
                        continue

                    # Validate bounds
                    if not (0.0 <= cx <= 1.0 and 0.0 <= cy <= 1.0 and 0.0 < w <= 1.0 and 0.0 < h <= 1.0):
                        report["invalid_annotations"] += 1
                        split_stats["invalid_boxes"] += 1
                        continue

                    # Check duplicate
                    box_key = (cid, round(cx, 4), round(cy, 4), round(w, 4), round(h, 4))
                    if box_key in seen_boxes:
                        report["duplicate_annotations"] += 1
                    seen_boxes.add(box_key)

                    # Update class count
                    cname = self.classes.get(cid, f"class_{cid}")
                    if cname in report["objects_per_class"]:
                        report["objects_per_class"][cname] += 1
                    else:
                        report["objects_per_class"][cname] = 1

            report["splits"][split_name] = split_stats

        return report


def generate_synthetic_sonar_sample(
    width: int = 640,
    height: int = 640,
    debris_type: str = "metal_debris",
    seed: Optional[int] = None,
) -> Tuple[np.ndarray, List[Tuple[int, float, float, float, float]]]:
    """Generates a physics-realistic synthetic side-scan sonar image with acoustic shadows.
    
    Acoustic signatures implemented:
    - Specular highlight: High backscatter peak reflecting off target
    - Acoustic shadow: Low-backscatter occlusion trailing behind target along acoustic ray
    - Seafloor reverberation: Gaussian speckle + low-frequency bottom ripples
    """
    if seed is not None:
        np.random.seed(seed)
        random.seed(seed)

    # 1. Base seafloor with acoustic reverberation & ripples
    canvas = np.zeros((height, width), dtype=np.float32)
    
    # Slant range illumination gradient (brighter near nadir, falloff at far range)
    x_coords = np.linspace(0, 1, width)
    illumination = 35.0 + 20.0 * np.sin(x_coords * math.pi)
    canvas += illumination[np.newaxis, :]

    # Seafloor sediment wave ripples
    y_coords = np.linspace(0, 10 * math.pi, height)
    ripples = 10.0 * np.sin(y_coords)[:, np.newaxis]
    canvas += ripples

    # Acoustic speckle noise (Rayleigh-like distribution)
    speckle = np.random.gamma(shape=2.0, scale=6.0, size=(height, width)).astype(np.float32)
    canvas += speckle

    # Clip canvas to uint8 range
    canvas = np.clip(canvas, 10, 240)

    # 2. Inject target highlight and trailing acoustic shadow
    targets = []
    
    # Target size and coordinates
    tw = random.randint(30, 75)
    th = random.randint(25, 60)
    tx = random.randint(100, width - 200)
    ty = random.randint(100, height - 150)

    # Acoustic shadow length (dependent on object height and grazing angle)
    shadow_len = int(tw * random.uniform(1.8, 3.2))

    # Sound propagation assumed left-to-right or right-to-left
    direction = random.choice([1, -1])  # 1 = shadow cast right, -1 = shadow cast left

    if direction == 1:
        # Highlight on left, shadow on right
        # Shadow void (near 0 backscatter)
        sx1 = tx + tw
        sx2 = min(width - 5, sx1 + shadow_len)
        canvas[ty:ty+th, sx1:sx2] = np.random.uniform(2.0, 15.0, size=(th, sx2-sx1))

        # Specular highlight (strong reflection 220-255)
        canvas[ty:ty+th, tx:tx+tw] = np.random.uniform(215.0, 255.0, size=(th, tw))
    else:
        # Highlight on right, shadow on left
        sx2 = tx
        sx1 = max(5, sx2 - shadow_len)
        canvas[ty:ty+th, sx1:sx2] = np.random.uniform(2.0, 15.0, size=(th, sx2-sx1))
        canvas[ty:ty+th, tx:tx+tw] = np.random.uniform(215.0, 255.0, size=(th, tw))

    # Map class name to ID
    class_map = {
        "metal_debris": 0, "plastic_debris": 1, "fishing_gear": 2,
        "rope_or_net": 3, "container": 4, "pipe": 5, "tire": 6,
        "vehicle_or_large_structure": 7, "wreckage": 8,
        "unknown_debris": 9, "natural_anomaly": 10,
    }
    cid = class_map.get(debris_type, 0)

    # Encompass target highlight + acoustic shadow in YOLO bbox
    if direction == 1:
        bx1 = tx
        bx2 = min(width - 5, tx + tw + shadow_len)
    else:
        bx1 = max(5, tx - shadow_len)
        bx2 = tx + tw

    by1 = ty
    by2 = ty + th

    # Convert to normalized YOLO coordinates: [cid, cx, cy, bw, bh]
    cx = ((bx1 + bx2) / 2.0) / float(width)
    cy = ((by1 + by2) / 2.0) / float(height)
    bw = (bx2 - bx1) / float(width)
    bh = (by2 - by1) / float(height)

    targets.append((cid, cx, cy, bw, bh))

    canvas_uint8 = np.clip(canvas, 0, 255).astype(np.uint8)
    bgr_img = cv2.cvtColor(canvas_uint8, cv2.COLOR_GRAY2BGR)

    return bgr_img, targets
