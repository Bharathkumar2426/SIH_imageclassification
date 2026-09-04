# SIH26057: AI-Powered Side-Scan Sonar Debris and Anomaly Detection System

**Ministry of Earth Sciences (MoES) — Autonomous Oceanography & Computer Vision**

An intelligent deep-learning system for automated detection, classification, and precise bounding-box localization of underwater marine debris, lost industrial gear, shipwrecks, and natural seabed anomalies from side-scan sonar (SSS) imagery.

---

## 🌊 Pipeline Architecture

$$\text{UPLOAD} \rightarrow \text{SONAR PREPROCESSING} \rightarrow \text{YOLO INFERENCE} \rightarrow \text{TIGHT BOUNDING BOXES} \rightarrow \text{CONFIDENCE SCORE} \rightarrow \text{SQLITE METADATA} \rightarrow \text{INTERACTIVE VIEWER}$$

```
d:/classification/
├── ml/
│   ├── configs/
│   │   ├── sonar_classes.yaml       # Configurable class list & detection parameters
│   │   └── training_config.yaml     # Physics-informed training hyperparameters
│   ├── preprocessing/
│   │   └── sonar_preprocessor.py    # Grayscale -> Normalization -> CLAHE -> Bilateral edge-preserving filter
│   ├── inference/
│   │   └── detector.py              # Real Ultralytics YOLO inference, coordinate rescaling, tight annotations
│   ├── training/
│   │   ├── dataset_builder.py       # YOLO dataset builder with audit & physics augmentations
│   │   └── train.py                 # Real YOLO training pipeline (mAP50, mAP50-95, precision, recall)
│   └── evaluation/
│       └── evaluate.py              # Test evaluation: Precision, Recall, mAP, confusion matrix, GT vs Pred
├── backend/
│   ├── api/
│   │   └── routes.py                # REST API: /api/detect, /api/detections/{id}, /api/images/{id}, /api/health
│   ├── models/
│   │   ├── schemas.py               # Pydantic request/response schemas
│   │   └── db_models.py             # SQLAlchemy models (images and detections tables)
│   ├── services/
│   │   ├── storage_service.py       # SQLite persistence operations
│   │   └── detection_service.py     # End-to-end 12-stage detection orchestration
│   ├── database.py                  # Async SQLAlchemy / aiosqlite engine
│   └── main.py                      # FastAPI ASGI application with CORS
├── frontend/                        # React 18 + Vite + Tailwind CSS dashboard
├── data/
│   ├── samples/                     # Real side-scan sonar sample images
│   ├── uploads/                     # Stored originals, enhanced, and annotated images
│   └── dataset/                     # YOLO dataset splits (train/val/test)
├── run_app.py                       # One-command full-stack launcher
└── requirements.txt                 # Backend dependencies
```

---

## 🚀 Quickstart

### 1. Launch Full-Stack Application
```bash
python run_app.py
```
- **Frontend Dashboard**: `http://localhost:5173`
- **Backend API Health**: `http://127.0.0.1:8000/api/health`
- **Swagger Documentation**: `http://127.0.0.1:8000/docs`

---

## 🛠️ Machine Learning Workflow

### 1. Acoustic Preprocessing
Tailored for acoustic backscatter physics:
- **Normalization**: Percentile clipping (1% - 99%) prevents dynamic range collapse from specular transducer peaks.
- **CLAHE**: Contrast-limited adaptive histogram equalization enhances subtle trailing acoustic shadows.
- **Bilateral Filter**: Suppresses high-frequency speckle noise without destroying sharp highlight edges.
- **Letterboxing**: Resizes with constant aspect ratio and accurate pad tracking for precise coordinate restitution.

### 2. Model Training
```bash
.venv\Scripts\python ml/training/train.py --data data/dataset/sonar_data.yaml --epochs 30 --imgsz 640
```
- **Horizontal Flip (0.5)**: Symmetric towfish perspectives.
- **Vertical Flip (0.0)**: Strictly disabled to prevent physically impossible acoustic grazing geometry inversion.
- **HSV Hue & Saturation (0.0)**: Strictly disabled for monochromatic acoustic backscatter.
- **Saves best checkpoint**: `ml/weights/sonar_best.pt`.

### 3. Model Evaluation
```bash
.venv\Scripts\python ml/evaluation/evaluate.py --model ml/weights/sonar_best.pt --data data/dataset/sonar_data.yaml
```
Outputs:
- Precision, Recall, mAP@0.5, mAP@0.5:0.95
- Per-class AP breakdown
- Visual comparison plots: Ground Truth vs Prediction
