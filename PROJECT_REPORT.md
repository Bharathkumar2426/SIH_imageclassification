# 🌊 SIH 26057: AI-Powered Automated Underwater Marine Debris & Anomaly Detection System with Live AIS Maritime Tracking

> **Ministry of Earth Sciences (MoES) — Smart India Hackathon**  
> **Comprehensive System Architecture, Technical Specifications, and Implementation Report**

---

## 1. Executive Summary & Problem Statement

Underwater marine debris (such as sunken shipwrecks, discarded fishing nets/gear, lost cargo containers, pipelines, and unexploded naval ordnance) poses severe environmental, navigational, and subsea infrastructural hazards. Side-scan sonar (SSS) is the industry standard acoustic sensor for ocean floor exploration; however, traditional manual acoustic interpretation is slow, labor-intensive, and prone to operator fatigue.

**SonarVision (SIH 26057)** is an end-to-end AI and maritime surveillance platform that:
1. **Automates Debris Detection**: Detects, localizes, and classifies underwater anomalies and debris from raw side-scan sonar imagery in real time using deep learning.
2. **Dynamic Geofencing & Georeferencing**: Converts 2D acoustic pixel coordinates into real-world WGS84 GPS coordinates and computes dynamic safety exclusion zones around submerged hazards.
3. **Live AIS Maritime Vessel Tracking**: Streams live global maritime vessels via AIS (Automatic Identification System) to provide comprehensive above-surface and subsea situational awareness.
4. **Collision Proximity & SOS Safety Alerting**: Continuously computes geodesic proximity between surface vessels and seabed hazards, automatically triggering real-time hazard warnings and SOS alerts to prevent marine accidents.

```
+-----------------------------------------------------------------------------------------+
|                                    SONARVISION (SIH 26057)                              |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|   [ Side-Scan Sonar Imagery ]                       [ AISStream Satellite/Terrestrial ] |
|                │                                                    │                   |
|                ▼                                                    ▼                   |
|   ┌──────────────────────────┐                         ┌────────────────────────────┐   |
|   │ Preprocessing & CLAHE    │                         │ Live AIS Ingestion Engine  │   |
|   │ Denoising & Shadows      │                         │ WSS Stream / Parsing       │   |
|   └────────────┬─────────────┘                         └────────────┬───────────────┘   |
|                ▼                                                    ▼                   |
|   ┌──────────────────────────┐                         ┌────────────────────────────┐   |
|   │ YOLOv8 Sonar Detector    │                         │ In-Memory Vessel Store     │   |
|   │ + Anomaly Scoring Engine │                         │ Trajectory Tracks (Layer 4)│   |
|   └────────────┬─────────────┘                         └────────────┬───────────────┘   |
|                ▼                                                    ▼                   |
|   ┌──────────────────────────┐                         ┌────────────────────────────┐   |
|   │ WGS84 Georeferencing     │                         │ Haversine Geodesic Engine  │   |
|   │ Dynamic Geofences (L2)   │ ◄───────────────────────┤ Real-time Proximity Checks │   |
|   └────────────┬─────────────┘                         └────────────┬───────────────┘   |
|                │                                                    │                   |
|                ▼                                                    ▼                   |
|   ┌─────────────────────────────────────────────────────────────────────────────────┐   |
|   │                      FastAPI Async Server & WebSockets                          │   |
|   └────────────────────────────────────────┬────────────────────────────────────────┘   |
|                                            ▼                                            |
|   ┌─────────────────────────────────────────────────────────────────────────────────┐   |
|   │                    React 18 + Leaflet Unified Situational UI                    │   |
|   │   - 2D Sonar Analysis & Cropper         - Layer 1: Sonar Debris Markers         │   |
|   │   - Confidence & Anomaly Cards          - Layer 2: Dynamic Geofences            │   |
|   │   - Pulsing Red SOS Alert Banner        - Layer 3: Live AIS Vessels (Rotated)   │   |
|   │   - One-Click Vessel "Locate"           - Layer 4: Vessel Trajectory Polylines  │   |
|   └─────────────────────────────────────────────────────────────────────────────────┘   |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Core Functional Modules & How It Works

### Module A: Acoustic Image Preprocessing & ML Detection Pipeline
1. **Adaptive Sonar Enhancement**:
   - Side-scan sonar data often suffers from acoustic backscatter, water-column blind zones, and non-uniform gain.
   - The preprocessing pipeline applies **CLAHE (Contrast Limited Adaptive Histogram Equalization)** and bilateral Gaussian spatial filtering to enhance acoustic shadows and specular highlights.
2. **Object Detection & Classification (YOLOv8)**:
   - Utilizes custom fine-tuned YOLOv8 weights (`sonar_v2.pt`) trained on side-scan sonar datasets.
   - Detects debris categories including:
     - `sunken_wreckage` (Extreme Risk)
     - `naval_mine` / `unexploded_ordnance` (Extreme Risk)
     - `lost_cargo_container` (High Risk)
     - `ghost_fishing_net` (Medium Risk)
     - `seabed_pipe_debris` / `generic_anomaly` (Low/Medium Risk)
3. **Crop Classifier & Anomaly Scoring**:
   - Secondary acoustic feature extractor assesses localized pixel texture gradients, contrast ratios, and structural symmetry.
   - Computes a normalized **Anomaly Score ($0.0 \to 1.0$)** to flag novel or unexpected seabed anomalies.

---

### Module B: Geospatial Projection & Dynamic Geofencing
1. **Acoustic-to-Geographic Transform**:
   - Towfish sensor parameters (Towfish Latitude, Longitude, Heading, Altitude AGL, Depth) are combined with slant-range planar geometry.
   - Converts image bounding-box pixel centroids $(u, v)$ into metric across-track and along-track offsets:
     $$\Delta x = \text{Across-Track Offset (meters)}, \quad \Delta y = \text{Along-Track Offset (meters)}$$
   - Projects metric offsets onto WGS84 ellipsoidal coordinates $(\text{Lat}, \text{Lon})$.
2. **Dynamic Hazard Geofencing**:
   - Calculates a risk-adjusted exclusion buffer around each hazard:
     $$R = R_{\text{base}} + k_{\text{altitude}} \cdot \text{Altitude} + k_{\text{severity}} \cdot \text{SeverityWeight}$$
   - Creates a circular geofence with radii typically ranging from **$25\text{m}$ to $350\text{m}$** based on hazard type and acoustic uncertainty.

---

### Module C: Live AIS Maritime Tracking & Collision Safety
1. **Real-Time AISStream Ingestion**:
   - Connects to the global AISStream WebSocket cluster (`wss://stream.aisstream.io/v0/stream`) via an asynchronous background engine.
   - Ingests standard ITU-R M.1371 AIS message types:
     - `PositionReport` (Class A & B)
     - `ShipStaticData` (Vessel name, IMO, callsign, dimensions, destination, ETA)
2. **Kinematic Tracking & Trajectory Trails**:
   - Tracks Speed Over Ground (SOG in knots), Course Over Ground (COG), and True Heading.
   - Maintains a bounded FIFO trajectory ring-buffer (up to 100 historical points per vessel) to render navigation paths.
3. **Real-Time Collision / SOS Alert Engine**:
   - On every coordinate update, computes great-circle distance using the **Haversine Formula**:
     $$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
   - **State Machine**:
     - $\text{Distance} > \text{Radius} + 500\text{m}$: 🟢 **`OUTSIDE`** (Safe)
     - $\text{Radius} < \text{Distance} \le \text{Radius} + 500\text{m}$: 🟡 **`APPROACHING`** (Proximity Caution)
     - $\text{Distance} \le \text{Radius}$: 🔴 **`INSIDE`** (Critical Geofence Breach / SOS Collision Risk)
   - Dispatches instant WebSocket events (`proximity_alert`) to trigger the pulsing red **Maritime Navigation Safety Alert Banner** on operator dashboards with one-click **"Locate"** camera lock.

---

## 3. Complete Technology Stack

| Layer / Domain | Technology / Library | Purpose & Implementation Details |
| :--- | :--- | :--- |
| **Backend Framework** | **Python 3.11 / FastAPI** | Asynchronous, high-throughput REST API and WebSocket hub. |
| **ASGI Server** | **Uvicorn** | High-performance ASGI web server with async event-loop. |
| **Data Validation** | **Pydantic v2** | Strict schema validation, request/response models, and type safety. |
| **Computer Vision** | **OpenCV (`cv2`)** | CLAHE equalization, Gaussian denoising, shadow enhancement, and image slicing. |
| **Deep Learning** | **Ultralytics YOLOv8 & PyTorch** | Real-time object detection, bounding box regression, and inference engine. |
| **Numerical Processing** | **NumPy / SciPy** | Matrix operations, slant-range calculations, and statistical anomaly modeling. |
| **Database** | **SQLite / SQLAlchemy** | Persistent mission logging, historical detection runs, and telemetry storage. |
| **Maritime Telemetry** | **WebSockets (`websockets`)** | Full-duplex streaming with AISStream.io and real-time browser push. |
| **Frontend Framework** | **React 18** | Modular component-driven single-page application (SPA). |
| **Build Tool & Bundler** | **Vite 5** | High-speed ESM development server and optimized rollup production bundler. |
| **Styling & Design System** | **Tailwind CSS** | Custom cyber-oceanic glassmorphic dark theme, glowing HUD badges, responsive grids. |
| **Geospatial Mapping** | **Leaflet (`leaflet`)** | High-performance 4-layer interactive ocean chart with custom divIcons and popups. |
| **Icons & Visuals** | **Lucide-React** | Comprehensive maritime, navigation, radar, and telemetry iconography. |
| **Basemap Providers** | **CARTO & Esri Ocean** | Dark Matter, Bathymetric Depth, Satellite Imagery, and OpenSeaMap nautical overlays. |

---

## 4. REST & WebSocket API Architecture

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/detect` | Uploads side-scan sonar image; runs preprocessing, YOLOv8 inference, and anomaly scoring. |
| `POST` | `/api/geospatial/enrich` | Projects 2D pixel detections to WGS84 GPS coordinates and computes dynamic geofences. |
| `GET` | `/api/geospatial/all/fleet` | Retrieves all historical mission targets and fleet geofence data. |
| `GET` | `/api/ais/status` | Returns AISStream connection status, active vessel count, and bounding box. |
| `GET` | `/api/ais/vessels` | Returns normalized list of live tracked vessels (MMSI, position, speed, heading). |
| `GET` | `/api/ais/tracks` | Returns historical trajectory coordinate points for all active vessels. |
| `GET` | `/api/ais/alerts` | Returns active geofence proximity/collision alerts. |
| `POST` | `/api/ais/bbox` | Dynamically updates the geographic AIS subscription bounding box. |
| `POST` | `/api/ais/sync-geofences` | Synchronizes active debris geofences for continuous collision proximity checks. |
| `POST` | `/api/ais/test-breach` | Simulates an immediate vessel geofence collision to verify the live SOS alert pipeline. |
| `POST` | `/api/ais/clear-alerts` | Clears active hazard alerts from memory and connected clients. |
| `WS` | `/api/ais/ws` | Persistent bidirectional WebSocket stream for real-time vessel and SOS alert events. |

---

## 5. Security & System Integrity Principles

1. **Zero Secret Exposure**: `AISSTREAM_API_KEY` is loaded strictly on the backend via environment variables. It is never embedded in frontend JavaScript, HTML, network responses, logs, or git repositories.
2. **Locked Baseline Non-Regression**: 100% exact numerical match across all regression benchmark images (`sample_sonar.png`, etc.) for YOLO weights, crop classification, anomaly scores, and bounding boxes.
3. **Viewport Render Capping**: High-framerate rendering via bounds filtering to display hundreds of active vessels smoothly without browser DOM throttling.
