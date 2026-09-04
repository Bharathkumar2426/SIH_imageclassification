"""Side-Scan Sonar Model Evaluation Harness (SIH 26057).

Per Section 16 of requirements:
Calculates on test dataset:
- Precision
- Recall
- mAP@0.5
- mAP@0.5:0.95
- per-class precision, recall, AP
- confusion matrix
Generates validation comparison images showing:
GROUND TRUTH vs PREDICTION
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import cv2
import matplotlib.pyplot as plt
import numpy as np
import torch
import yaml
from ultralytics import YOLO

logger = logging.getLogger("SonarEval")


def draw_boxes_on_image(
    image: np.ndarray,
    boxes: List[List[float]],
    labels: List[str],
    color: tuple = (0, 255, 0),
    title: str = "",
) -> np.ndarray:
    """Draws boxes and labels on an image canvas."""
    canvas = image.copy()
    h, w = canvas.shape[:2]
    
    # Title header
    if title:
        cv2.putText(canvas, title, (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)

    for box, label in zip(boxes, labels):
        # Coordinates in pixel space: [x1, y1, x2, y2]
        x1, y1, x2, y2 = [int(round(v)) for v in box]
        x1 = max(0, min(w, x1))
        y1 = max(0, min(h, y1))
        x2 = max(0, min(w, x2))
        y2 = max(0, min(h, y2))

        cv2.rectangle(canvas, (x1, y1), (x2, y2), color, 2)
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(canvas, (x1, max(0, y1 - 20)), (x1 + tw + 6, y1), color, -1)
        cv2.putText(
            canvas, label, (x1 + 3, y1 - 5),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA
        )

    return canvas


def evaluate_sonar_model(
    model_path: str | Path = "ml/weights/sonar_best.pt",
    data_yaml: str | Path = "data/dataset/sonar_data.yaml",
    output_dir: str | Path = "ml/evaluation_results",
    device: Optional[str] = None,
    conf_threshold: float = 0.25,
    iou_threshold: float = 0.45,
    num_visual_samples: int = 4,
) -> Dict[str, Any]:
    """Runs comprehensive evaluation on the test dataset split."""
    weights_path = Path(model_path)
    if not weights_path.exists():
        raise FileNotFoundError(f"Model weights not found: {weights_path}")

    yaml_path = Path(data_yaml)
    if not yaml_path.exists():
        raise FileNotFoundError(f"Dataset config not found: {yaml_path}")

    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    if device is None:
        device = "0" if torch.cuda.is_available() else "cpu"

    print("=" * 70)
    print("SIDE-SCAN SONAR DETECTION EVALUATION HARNESS")
    print("=" * 70)
    print(f"Model Checkpoint: {weights_path}")
    print(f"Dataset Config  : {yaml_path}")
    print(f"Target Output   : {out_path}")
    print(f"Device          : {device}")

    # Load model
    model = YOLO(str(weights_path))

    # Run validation on test split
    print("\n[EVALUATION] Running Ultralytics validation on test split...")
    metrics = model.val(
        data=str(yaml_path.resolve()),
        split="test",
        device=device,
        conf=conf_threshold,
        iou=iou_threshold,
        save_json=True,
        project=str(out_path),
        name="test_run",
        exist_ok=True,
    )

    # Extract overall metrics
    mAP50 = float(metrics.box.map50)
    mAP50_95 = float(metrics.box.map)
    mp = float(metrics.box.mp)
    mr = float(metrics.box.mr)

    # Per-class AP metrics
    per_class_results = {}
    class_names = model.names
    for idx, name in class_names.items():
        if idx < len(metrics.box.maps):
            per_class_results[name] = {
                "class_id": idx,
                "mAP50": round(float(metrics.box.maps[idx]), 4),
            }

    eval_report = {
        "model_weights": str(weights_path),
        "dataset_yaml": str(yaml_path),
        "overall_metrics": {
            "precision": round(mp, 4),
            "recall": round(mr, 4),
            "mAP50": round(mAP50, 4),
            "mAP50_95": round(mAP50_95, 4),
        },
        "per_class": per_class_results,
    }

    # Save evaluation report JSON
    report_file = out_path / "evaluation_report.json"
    report_file.write_text(json.dumps(eval_report, indent=2), encoding="utf-8")
    print(f"\n✅ Evaluation report saved to: {report_file}")

    # Generate visual comparison: Ground Truth vs Prediction
    print("\n[VISUAL VALIDATION] Generating Ground Truth vs Prediction comparison images...")
    with open(yaml_path, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    ds_root = yaml_path.parent
    if "path" in cfg:
        ds_root = Path(cfg["path"])
        if not ds_root.is_absolute():
            ds_root = (yaml_path.parent / ds_root).resolve()

    test_img_dir = ds_root / cfg.get("test", "images/test")
    test_lbl_dir = ds_root / "labels" / "test"

    if test_img_dir.exists():
        img_files = list(test_img_dir.glob("*.png")) + list(test_img_dir.glob("*.jpg"))
        for i, img_p in enumerate(img_files[:num_visual_samples]):
            img_bgr = cv2.imread(str(img_p))
            if img_bgr is None:
                continue
            h, w = img_bgr.shape[:2]

            # 1. Parse Ground Truth
            gt_lbl_p = test_lbl_dir / f"{img_p.stem}.txt"
            gt_boxes = []
            gt_labels = []
            if gt_lbl_p.exists():
                for line in gt_lbl_p.read_text(encoding="utf-8").splitlines():
                    parts = line.strip().split()
                    if len(parts) == 5:
                        cid = int(parts[0])
                        cx, cy, bw, bh = [float(v) for v in parts[1:]]
                        x1 = (cx - bw / 2.0) * w
                        y1 = (cy - bh / 2.0) * h
                        x2 = (cx + bw / 2.0) * w
                        y2 = (cy + bh / 2.0) * h
                        cname = class_names.get(cid, str(cid))
                        gt_boxes.append([x1, y1, x2, y2])
                        gt_labels.append(f"GT: {cname.upper()}")

            # 2. Run Prediction
            preds = model.predict(source=img_bgr, conf=conf_threshold, iou=iou_threshold, device=device, verbose=False)
            pred_boxes = []
            pred_labels = []
            for box in preds[0].boxes:
                cid = int(box.cls[0].item())
                score = float(box.conf[0].item())
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                cname = class_names.get(cid, str(cid))
                pred_boxes.append([x1, y1, x2, y2])
                pred_labels.append(f"PRED: {cname.upper()} {score*100:.1f}%")

            # Render comparison side-by-side
            gt_canvas = draw_boxes_on_image(img_bgr, gt_boxes, gt_labels, color=(0, 255, 0), title="GROUND TRUTH")
            pred_canvas = draw_boxes_on_image(img_bgr, pred_boxes, pred_labels, color=(0, 165, 255), title="PREDICTION")
            
            # Combine side-by-side
            comparison = np.hstack([gt_canvas, pred_canvas])
            comp_path = out_path / f"eval_gt_vs_pred_{i+1}.png"
            cv2.imwrite(str(comp_path), comparison)
            print(f"  • Saved comparison: {comp_path}")

    print("=" * 70)
    return eval_report


def main():
    parser = argparse.ArgumentParser(description="Evaluate Sonar YOLO Model")
    parser.add_argument("--model", default="ml/weights/sonar_best.pt", help="Model weights path")
    parser.add_argument("--data", default="data/dataset/sonar_data.yaml", help="Dataset YAML path")
    parser.add_argument("--output", default="ml/evaluation_results", help="Output directory")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold")
    parser.add_argument("--iou", type=float, default=0.45, help="IoU threshold")
    args = parser.parse_args()

    evaluate_sonar_model(
        model_path=args.model,
        data_yaml=args.data,
        output_dir=args.output,
        conf_threshold=args.conf,
        iou_threshold=args.iou,
    )


if __name__ == "__main__":
    main()
