"""Side-Scan Sonar YOLO Model Training Pipeline (SIH 26057).

Per Section 6 of requirements:
- Validates dataset integrity prior to training
- Applies physics-preserving acoustic sonar augmentations:
  * Horizontal flip: 0.5 (Towfish symmetry preserves acoustic geometry)
  * Vertical flip: 0.0 (STRICTLY PROHIBITED: Inverts shadow direction relative to grazing angle)
  * HSV Hue: 0.0 (Monochromatic acoustic sonar has no color hue)
  * HSV Saturation: 0.0 (No color saturation)
  * HSV Value: 0.15 (Acoustic gain / attenuation fluctuation)
- Tracks precision, recall, mAP50, mAP50-95, loss
- Exports best checkpoint to ml/weights/sonar_best.pt
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
import shutil
from typing import Any, Dict, Optional

import torch
import yaml
from ultralytics import YOLO

from ml.training.dataset_builder import SonarDatasetAuditor

logger = logging.getLogger("SonarTrain")


def train_sonar_detector(
    data_yaml: str | Path = "data/dataset/sonar_data.yaml",
    base_model: str = "yolov8n.pt",
    epochs: int = 30,
    batch_size: int = 8,
    imgsz: int = 640,
    output_weights: str | Path = "ml/weights/sonar_best.pt",
    device: Optional[str] = None,
) -> Dict[str, Any]:
    """Trains or fine-tunes YOLO on side-scan sonar dataset."""
    yaml_path = Path(data_yaml)
    if not yaml_path.exists():
        raise FileNotFoundError(f"Sonar dataset configuration not found: {yaml_path}")

    # Auto-detect device if not specified
    if device is None:
        device = "0" if torch.cuda.is_available() else "cpu"

    print("=" * 70)
    print("AI-POWERED SIDE-SCAN SONAR DEBRIS DETECTOR — TRAINING PIPELINE")
    print("=" * 70)
    print(f"Device: {device} (CUDA Available: {torch.cuda.is_available()})")
    print(f"Base Architecture: {base_model}")
    print(f"Dataset Config: {yaml_path}")

    # Step 1: Dataset Quality Audit
    print("\n[STEP 1/4] Auditing Dataset Integrity...")
    auditor = SonarDatasetAuditor(yaml_path)
    audit_report = auditor.audit()

    train_imgs = audit_report["splits"].get("train", {}).get("images", 0)
    val_imgs = audit_report["splits"].get("val", {}).get("images", 0)

    print(f"  • Total Images: {audit_report['total_images']}")
    print(f"  • Training Images: {train_imgs}")
    print(f"  • Validation Images: {val_imgs}")
    print(f"  • Defined Classes: {audit_report['classes_defined']}")
    print(f"  • Corrupt Images: {audit_report['corrupt_images']}")
    print(f"  • Missing Labels: {audit_report['missing_labels']}")
    print(f"  • Invalid Boxes: {audit_report['invalid_annotations']}")

    if train_imgs == 0:
        raise ValueError(
            f"Cannot train: No images found in training split of {yaml_path}. "
            "Please populate dataset before training."
        )

    # Step 2: Initialize YOLO Architecture
    print(f"\n[STEP 2/4] Initializing model architecture: {base_model}...")
    model = YOLO(base_model)

    dest_weights = Path(output_weights)
    dest_weights.parent.mkdir(parents=True, exist_ok=True)

    # Step 3: Run Training with Physics-Constrained Hyperparameters
    print(f"\n[STEP 3/4] Starting training for {epochs} epochs on {device}...")
    results = model.train(
        data=str(yaml_path.resolve()),
        epochs=epochs,
        batch=batch_size,
        imgsz=imgsz,
        device=device,
        # Physics-Preserving Augmentations (Section 6)
        fliplr=0.5,      # Symmetric towfish perspective
        flipud=0.0,      # Prohibited: Inverts acoustic grazing angle
        hsv_h=0.0,       # Zero: Monochromatic acoustic data
        hsv_s=0.0,       # Zero: No color saturation
        hsv_v=0.15,      # Acoustic gain fluctuation
        save=True,
        project="ml/runs",
        name="sonar_train",
        exist_ok=True,
        plots=True,
    )

    # Step 4: Export Best Checkpoint
    print("\n[STEP 4/4] Exporting Checkpoint & Evaluating Results...")
    run_dir = Path("ml/runs/sonar_train")
    best_pt = run_dir / "weights" / "best.pt"

    if best_pt.exists():
        shutil.copy2(best_pt, dest_weights)
        print(f"✅ Success! Best sonar-trained model saved to: {dest_weights}")
    else:
        # Fallback to last
        last_pt = run_dir / "weights" / "last.pt"
        if last_pt.exists():
            shutil.copy2(last_pt, dest_weights)
            print(f"Saved latest checkpoint to: {dest_weights}")

    # Extract metrics summary
    metrics_summary = {
        "status": "completed",
        "epochs_trained": epochs,
        "device": device,
        "weights_saved_to": str(dest_weights),
        "metrics": {
            "mAP50": getattr(results.box, "map50", 0.0) if hasattr(results, "box") else None,
            "mAP50-95": getattr(results.box, "map", 0.0) if hasattr(results, "box") else None,
            "precision": getattr(results.box, "mp", 0.0) if hasattr(results, "box") else None,
            "recall": getattr(results.box, "mr", 0.0) if hasattr(results, "box") else None,
        },
    }

    # Save training metrics JSON
    metrics_file = dest_weights.parent / "training_metrics.json"
    metrics_file.write_text(json.dumps(metrics_summary, indent=2), encoding="utf-8")
    print(f"Metrics written to: {metrics_file}")
    print("=" * 70)

    return metrics_summary


def main():
    parser = argparse.ArgumentParser(description="Train YOLO on Side-Scan Sonar Imagery")
    parser.add_argument("--data", default="data/dataset/sonar_data.yaml", help="Path to sonar_data.yaml")
    parser.add_argument("--base", default="yolov8n.pt", help="Base model weights")
    parser.add_argument("--epochs", type=int, default=30, help="Number of training epochs")
    parser.add_argument("--batch", type=int, default=8, help="Batch size")
    parser.add_argument("--imgsz", type=int, default=640, help="Image resolution")
    parser.add_argument("--output", default="ml/weights/sonar_best.pt", help="Path to save best checkpoint")
    parser.add_argument("--device", default=None, help="Device (cpu, 0, cuda:0)")
    args = parser.parse_args()

    train_sonar_detector(
        data_yaml=args.data,
        base_model=args.base,
        epochs=args.epochs,
        batch_size=args.batch,
        imgsz=args.imgsz,
        output_weights=args.output,
        device=args.device,
    )


if __name__ == "__main__":
    main()
