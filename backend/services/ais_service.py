"""Live AISStream Vessel Tracking Service (SIH 26057).

Connects to AISStream WebSocket, normalizes live maritime vessel feeds,
maintains in-memory vessel states and bounded trajectory tracks, evaluates
geofence proximity against active sonar debris hazards, and broadcasts
events to connected client interfaces.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import time
from collections import deque
from datetime import datetime, timezone
from typing import Any, Deque, Dict, List, Optional, Set, Tuple

import websockets
from fastapi import WebSocket

from backend.config import settings
from backend.models.ais_schemas import (
    AisBoundingBox,
    AisConnectionStatus,
    AisStatusResponse,
    VesselAlertStatus,
    VesselPositionPoint,
    VesselProximityAlert,
    VesselState,
    VesselTrack,
)

logger = logging.getLogger("AisService")

# Standard AIS Navigational Status Mapping (ITU-R M.1371)
NAV_STATUS_MAP = {
    0: "Under way using engine",
    1: "At anchor",
    2: "Not under command",
    3: "Restricted manoeuverability",
    4: "Constrained by her draught",
    5: "Moored",
    6: "Aground",
    7: "Engaged in fishing",
    8: "Under way sailing",
    9: "Reserved for future amendment",
    10: "Reserved for future amendment",
    11: "Power-driven vessel towing astern",
    12: "Power-driven vessel pushing ahead or towing alongside",
    13: "Reserved for future use",
    14: "AIS-SART / MOB / EPIRB active",
    15: "Undefined / Not reported",
}

# Standard AIS Ship Types mapping
SHIP_TYPE_MAP = {
    30: "Fishing Vessel",
    31: "Towing",
    32: "Towing (Large)",
    33: "Dredger / Underwater Ops",
    34: "Dive Vessel",
    35: "Military Ops",
    36: "Sailing Vessel",
    37: "Pleasure Craft",
    40: "High Speed Craft",
    50: "Pilot Vessel",
    51: "Search and Rescue",
    52: "Tug",
    53: "Port Tender",
    54: "Anti-pollution Equipment",
    55: "Law Enforcement",
    58: "Medical Transport",
    60: "Passenger Ship",
    70: "Cargo Ship",
    80: "Tanker",
    90: "Other Type",
}


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two WGS84 points in meters."""
    r = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


class AisService:
    """Isolated, additive live AISStream ingestion and vessel tracking engine."""

    def __init__(self):
        self._status: AisConnectionStatus = AisConnectionStatus.NOT_CONFIGURED
        self._start_time: float = time.time()
        self._last_update_iso: Optional[str] = None
        self._last_message_time: Optional[float] = None
        
        # Bounding Box Configuration
        self._bbox = AisBoundingBox(
            min_latitude=settings.AIS_BBOX_MIN_LAT,
            min_longitude=settings.AIS_BBOX_MIN_LON,
            max_latitude=settings.AIS_BBOX_MAX_LAT,
            max_longitude=settings.AIS_BBOX_MAX_LON,
        )

        # In-memory Vessel Store
        self._vessels: Dict[str, VesselState] = {}
        self._vessel_last_received: Dict[str, float] = {}
        self._tracks: Dict[str, Deque[VesselPositionPoint]] = {}

        # Debris Geofences for Proximity Monitoring: list of dicts { id, class_name, lat, lng, radius, severity }
        self._active_geofences: List[Dict[str, Any]] = []
        
        # State transitions for alerts: (mmsi, geofence_id) -> VesselAlertStatus
        self._alert_states: Dict[Tuple[str, int], VesselAlertStatus] = {}
        self._active_alerts: Dict[str, VesselProximityAlert] = {}

        # Active frontend WebSocket clients
        self._connected_clients: Set[WebSocket] = set()

        # Background runner controls
        self._running: bool = False
        self._task: Optional[asyncio.Task] = None
        self._upstream_ws: Optional[Any] = None
        self._lock = asyncio.Lock()

    @property
    def status(self) -> AisConnectionStatus:
        return self._status

    @property
    def bbox(self) -> AisBoundingBox:
        return self._bbox

    def set_bounding_box(self, min_lat: float, min_lon: float, max_lat: float, max_lon: float):
        """Updates the survey bounding box for live AIS filtering and resends subscription if connected."""
        self._bbox = AisBoundingBox(
            min_latitude=min_lat,
            min_longitude=min_lon,
            max_latitude=max_lat,
            max_longitude=max_lon,
        )
        logger.info(
            f"AIS Bounding Box updated: Lat [{min_lat}, {max_lat}], Lon [{min_lon}, {max_lon}]"
        )
        if self._upstream_ws and self._status == AisConnectionStatus.LIVE:
            api_key = (settings.AISSTREAM_API_KEY or "").strip()
            if api_key:
                sub_payload = {
                    "APIKey": api_key,
                    "BoundingBoxes": [
                        [
                            [self._bbox.min_latitude, self._bbox.min_longitude],
                            [self._bbox.max_latitude, self._bbox.max_longitude],
                        ]
                    ],
                    "FilterMessageTypes": [
                        "PositionReport",
                        "StandardClassBPositionReport",
                        "ExtendedClassBPositionReport",
                        "ShipStaticData",
                    ],
                }
                asyncio.create_task(self._upstream_ws.send(json.dumps(sub_payload)))

    def set_active_geofences(self, geofences: List[Dict[str, Any]]):
        """Updates active debris geofences used for vessel proximity safety checks."""
        self._active_geofences = geofences or []
        # Re-evaluate proximity with updated geofences
        self._evaluate_all_vessel_proximities()

    async def register_client(self, websocket: WebSocket):
        """Registers a frontend client WebSocket connection for real-time AIS events."""
        async with self._lock:
            self._connected_clients.add(websocket)
        logger.info(f"Frontend AIS client connected. Total clients: {len(self._connected_clients)}")
        
        # Send initial snapshot to newly connected client
        initial_payload = {
            "type": "initial_state",
            "status": self._status.value,
            "vessels": [v.model_dump() for v in self.get_active_vessels()],
            "alerts": [a.model_dump() for a in self.get_active_alerts()],
            "bounding_box": self._bbox.model_dump(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        try:
            await websocket.send_text(json.dumps(initial_payload))
        except Exception:
            pass

    async def unregister_client(self, websocket: WebSocket):
        """Unregisters a frontend client WebSocket."""
        async with self._lock:
            self._connected_clients.discard(websocket)
        logger.info(f"Frontend AIS client disconnected. Remaining clients: {len(self._connected_clients)}")

    async def broadcast_event(self, event_type: str, data: Dict[str, Any]):
        """Broadcasts a real-time event to all connected frontend clients."""
        if not self._connected_clients:
            return

        message = json.dumps({
            "type": event_type,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        stale_clients = []
        for ws in list(self._connected_clients):
            try:
                await ws.send_text(message)
            except Exception:
                stale_clients.append(ws)

        if stale_clients:
            async with self._lock:
                for ws in stale_clients:
                    self._connected_clients.discard(ws)

    def get_status(self) -> AisStatusResponse:
        """Returns structured status response for health and diagnostics."""
        vessels = self.get_active_vessels()
        stale_count = sum(1 for v in vessels if v.is_stale)
        
        has_key = bool(settings.AISSTREAM_API_KEY and len(settings.AISSTREAM_API_KEY.strip()) > 0)
        current_status = self._status
        if not has_key:
            current_status = AisConnectionStatus.NOT_CONFIGURED

        return AisStatusResponse(
            status=current_status,
            is_configured=has_key,
            vessel_count=len(vessels),
            stale_vessel_count=stale_count,
            last_update=self._last_update_iso,
            bounding_box=self._bbox,
            active_alerts_count=len(self._active_alerts),
            connected_clients=len(self._connected_clients),
            uptime_seconds=round(time.time() - self._start_time, 1),
        )

    def get_active_vessels(self) -> List[VesselState]:
        """Returns list of normalized vessel states with live staleness calculations."""
        now = time.time()
        results: List[VesselState] = []
        
        for mmsi, vessel in self._vessels.items():
            last_rec = self._vessel_last_received.get(mmsi, now)
            elapsed = now - last_rec
            is_stale = elapsed > settings.AIS_STALE_TIMEOUT_SECONDS
            
            # Create copy with updated staleness
            v_dict = vessel.model_dump()
            v_dict["is_stale"] = is_stale
            v_dict["last_seen_seconds_ago"] = round(elapsed, 1)
            results.append(VesselState(**v_dict))
            
        return results

    def get_vessel_tracks(self) -> Dict[str, List[Dict[str, Any]]]:
        """Returns recent trajectory points for each tracked vessel."""
        result: Dict[str, List[Dict[str, Any]]] = {}
        for mmsi, track in self._tracks.items():
            result[mmsi] = [p.model_dump() for p in track]
        return result

    def get_active_alerts(self) -> List[VesselProximityAlert]:
        """Returns list of active geofence proximity alerts."""
        return list(self._active_alerts.values())

    async def start(self):
        """Starts the background AISStream ingestion loop."""
        if self._running:
            return

        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info("AIS Background Ingestion Service initialized.")

    async def stop(self):
        """Gracefully shuts down the AISStream connection."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        self._status = AisConnectionStatus.OFFLINE
        logger.info("AIS Background Ingestion Service stopped.")

    async def _run_loop(self):
        """Main lifecycle loop handling connections, backoff, and message streams."""
        retry_delay = 1
        max_retry_delay = 60

        api_key = (settings.AISSTREAM_API_KEY or "").strip()
        if not api_key:
            self._status = AisConnectionStatus.NOT_CONFIGURED
            logger.warning("AISSTREAM_API_KEY is not configured. AIS live service will remain idle.")
            return

        while self._running:
            try:
                self._status = AisConnectionStatus.CONNECTING
                await self.broadcast_event("status_change", {"status": self._status.value})
                logger.info(f"Connecting to AISStream at {settings.AISSTREAM_WS_URL}...")

                async with websockets.connect(
                    settings.AISSTREAM_WS_URL,
                    ping_interval=20,
                    ping_timeout=20,
                    close_timeout=10,
                ) as ws:
                    self._upstream_ws = ws
                    # Connection established - authenticate and subscribe to bounding box
                    subscription_payload = {
                        "APIKey": api_key,
                        "BoundingBoxes": [
                            [
                                [self._bbox.min_latitude, self._bbox.min_longitude],
                                [self._bbox.max_latitude, self._bbox.max_longitude],
                            ]
                        ],
                        "FilterMessageTypes": [
                            "PositionReport",
                            "StandardClassBPositionReport",
                            "ExtendedClassBPositionReport",
                            "ShipStaticData",
                        ],
                    }

                    await ws.send(json.dumps(subscription_payload))
                    self._status = AisConnectionStatus.LIVE
                    retry_delay = 1  # Reset backoff on successful connection
                    logger.info("AISStream connection established. Subscription active.")
                    await self.broadcast_event("status_change", {"status": self._status.value})

                    async for raw_message in ws:
                        if not self._running:
                            break
                        try:
                            msg_dict = json.loads(raw_message)
                            await self._handle_ais_message(msg_dict)
                        except Exception as parse_err:
                            logger.debug(f"Non-critical error parsing AIS payload: {parse_err}")

            except asyncio.CancelledError:
                break
            except Exception as conn_err:
                self._upstream_ws = None
                self._status = AisConnectionStatus.OFFLINE
                logger.warning(
                    f"AISStream connection closed or unavailable: {conn_err}. Reconnecting in {retry_delay}s..."
                )
                await self.broadcast_event("status_change", {"status": self._status.value})
                await asyncio.sleep(retry_delay)
                retry_delay = min(retry_delay * 2, max_retry_delay)
            finally:
                self._upstream_ws = None

    async def _handle_ais_message(self, data: Dict[str, Any]):
        """Processes raw AISStream message, updates MMSI state, tracks, and evaluates geofence proximity."""
        msg_type = data.get("MessageType")
        if msg_type == "SubscriptionConfirmation":
            logger.info("AISStream subscription confirmed by remote cluster.")
            return

        metadata = data.get("MetaData", {})
        message_body = data.get("Message", {})

        mmsi_raw = metadata.get("MMSI")
        if not mmsi_raw:
            return

        mmsi = str(mmsi_raw)
        now_ts = time.time()
        now_iso = datetime.now(timezone.utc).isoformat()
        self._last_update_iso = now_iso
        self._last_message_time = now_ts

        ship_name = metadata.get("ShipName")
        if ship_name:
            ship_name = ship_name.strip()

        # Extract coordinates and kinematics from position reports
        lat: Optional[float] = None
        lng: Optional[float] = None
        sog: Optional[float] = None
        cog: Optional[float] = None
        heading: Optional[float] = None
        nav_status_desc: Optional[str] = None
        ship_type_desc: Optional[str] = None
        imo: Optional[str] = None
        destination: Optional[str] = None
        eta: Optional[str] = None

        if msg_type == "PositionReport" and "PositionReport" in message_body:
            pr = message_body["PositionReport"]
            lat = pr.get("Latitude")
            lng = pr.get("Longitude")
            sog = pr.get("Sog")
            cog = pr.get("Cog")
            th = pr.get("TrueHeading")
            if th is not None and th != 511:
                heading = float(th)
            ns = pr.get("NavigationalStatus")
            if ns is not None and ns in NAV_STATUS_MAP:
                nav_status_desc = NAV_STATUS_MAP[ns]

        elif msg_type == "StandardClassBPositionReport" and "StandardClassBPositionReport" in message_body:
            pr = message_body["StandardClassBPositionReport"]
            lat = pr.get("Latitude")
            lng = pr.get("Longitude")
            sog = pr.get("Sog")
            cog = pr.get("Cog")
            th = pr.get("TrueHeading")
            if th is not None and th != 511:
                heading = float(th)

        elif msg_type == "ExtendedClassBPositionReport" and "ExtendedClassBPositionReport" in message_body:
            pr = message_body["ExtendedClassBPositionReport"]
            lat = pr.get("Latitude")
            lng = pr.get("Longitude")
            sog = pr.get("Sog")
            cog = pr.get("Cog")
            th = pr.get("TrueHeading")
            if th is not None and th != 511:
                heading = float(th)
            st = pr.get("Type")
            if st is not None and st in SHIP_TYPE_MAP:
                ship_type_desc = SHIP_TYPE_MAP[st]

        elif msg_type == "ShipStaticData" and "ShipStaticData" in message_body:
            ssd = message_body["ShipStaticData"]
            if not ship_name and ssd.get("Name"):
                ship_name = ssd.get("Name", "").strip()
            imo_val = ssd.get("ImoNumber")
            if imo_val:
                imo = str(imo_val)
            dest = ssd.get("Destination")
            if dest:
                destination = dest.strip()
            st = ssd.get("Type")
            if st is not None and st in SHIP_TYPE_MAP:
                ship_type_desc = SHIP_TYPE_MAP[st]
            eta_dict = ssd.get("Eta")
            if eta_dict and isinstance(eta_dict, dict):
                eta = f"{eta_dict.get('Month', 0):02d}-{eta_dict.get('Day', 0):02d} {eta_dict.get('Hour', 0):02d}:{eta_dict.get('Minute', 0):02d}"

        # If position is not provided in report, check metadata fallback
        if lat is None or lng is None:
            lat = metadata.get("latitude")
            lng = metadata.get("longitude")

        # Skip invalid coordinates
        if lat is None or lng is None or abs(lat) > 90.0 or abs(lng) > 180.0:
            return

        # Retrieve or create existing state
        existing = self._vessels.get(mmsi)
        updated_state = VesselState(
            mmsi=mmsi,
            ship_name=ship_name or (existing.ship_name if existing else None),
            latitude=float(lat),
            longitude=float(lng),
            speed_knots=float(sog) if sog is not None else (existing.speed_knots if existing else None),
            course_deg=float(cog) if cog is not None else (existing.course_deg if existing else None),
            heading_deg=heading if heading is not None else (existing.heading_deg if existing else None),
            nav_status=nav_status_desc or (existing.nav_status if existing else None),
            ship_type=ship_type_desc or (existing.ship_type if existing else None),
            imo=imo or (existing.imo if existing else None),
            destination=destination or (existing.destination if existing else None),
            eta=eta or (existing.eta if existing else None),
            timestamp=now_iso,
            is_stale=False,
            last_seen_seconds_ago=0.0,
        )

        self._vessels[mmsi] = updated_state
        self._vessel_last_received[mmsi] = now_ts

        # Update bounded track history
        if mmsi not in self._tracks:
            self._tracks[mmsi] = deque(maxlen=settings.AIS_MAX_TRACK_POINTS)
        
        self._tracks[mmsi].append(
            VesselPositionPoint(
                latitude=float(lat),
                longitude=float(lng),
                timestamp=now_iso,
                speed_knots=updated_state.speed_knots,
                course_deg=updated_state.course_deg,
            )
        )

        # Broadcast vessel update to clients
        await self.broadcast_event("vessel_update", updated_state.model_dump())

        # Evaluate proximity against active debris geofences
        await self._evaluate_vessel_proximity(updated_state)

    async def _evaluate_vessel_proximity(self, vessel: VesselState):
        """Evaluates geodesic proximity between a live vessel and active debris geofences."""
        if not self._active_geofences:
            return

        warning_dist_m = settings.VESSEL_WARNING_DISTANCE_METERS

        for gf in self._active_geofences:
            gf_id = gf.get("id") or gf.get("detection_id", 0)
            gf_lat = gf.get("latitude") or gf.get("lat", 0.0)
            gf_lng = gf.get("longitude") or gf.get("lng", 0.0)
            gf_radius = gf.get("radius_meters") or gf.get("radius", 25.0)
            debris_class = gf.get("class_name") or gf.get("class", "Underwater Debris")
            severity = gf.get("severity", "MEDIUM")

            dist_meters = haversine_distance_meters(
                vessel.latitude, vessel.longitude, gf_lat, gf_lng
            )

            current_status: VesselAlertStatus
            if dist_meters <= gf_radius:
                current_status = VesselAlertStatus.INSIDE
            elif dist_meters <= (gf_radius + warning_dist_m):
                current_status = VesselAlertStatus.APPROACHING
            else:
                current_status = VesselAlertStatus.OUTSIDE

            state_key = (vessel.mmsi, gf_id)
            prev_status = self._alert_states.get(state_key, VesselAlertStatus.OUTSIDE)
            alert_id = f"{vessel.mmsi}_{gf_id}"

            # Only trigger / update alerts upon state change
            if current_status != prev_status:
                self._alert_states[state_key] = current_status

                if current_status in (VesselAlertStatus.INSIDE, VesselAlertStatus.APPROACHING):
                    v_name = vessel.ship_name or f"Vessel MMSI {vessel.mmsi}"
                    msg = (
                        f"⚠️ CRITICAL: {v_name} has ENTERED Debris Safety Zone #{gf_id} ({debris_class}, {severity})! Distance: {dist_meters:.0f}m"
                        if current_status == VesselAlertStatus.INSIDE
                        else f"⚠️ WARNING: {v_name} is APPROACHING Debris Hazard #{gf_id} ({debris_class}, {severity}). Distance: {dist_meters:.0f}m"
                    )

                    alert = VesselProximityAlert(
                        vessel_mmsi=vessel.mmsi,
                        ship_name=v_name,
                        detection_id=gf_id,
                        debris_class=debris_class,
                        severity=severity,
                        distance_meters=round(dist_meters, 1),
                        geofence_radius_meters=round(gf_radius, 1),
                        status=current_status,
                        alert_message=msg,
                        timestamp=datetime.now(timezone.utc).isoformat(),
                    )
                    self._active_alerts[alert_id] = alert
                    logger.warning(f"AIS Proximity Alert: {msg}")
                    await self.broadcast_event("proximity_alert", alert.model_dump())

                elif current_status == VesselAlertStatus.OUTSIDE:
                    # Vessel cleared the exclusion zone
                    if alert_id in self._active_alerts:
                        del self._active_alerts[alert_id]
                        await self.broadcast_event("proximity_clear", {"alert_id": alert_id, "mmsi": vessel.mmsi, "detection_id": gf_id})

    async def trigger_test_alert(self) -> Dict[str, Any]:
        """Triggers a realistic test geofence breach / SOS safety alert for verification."""
        now_iso = datetime.now(timezone.utc).isoformat()
        now_ts = time.time()

        # Determine target hazard reference (default to target #1 in Palk Strait if none synced)
        gf_id = 1
        gf_lat = 9.3142
        gf_lng = 79.1821
        gf_radius = 233.9
        debris_class = "sunken_wreckage"
        severity = "EXTREME"

        if self._active_geofences:
            first_gf = self._active_geofences[0]
            gf_id = first_gf.get("id") or first_gf.get("detection_id", 1)
            gf_lat = first_gf.get("latitude") or first_gf.get("lat", 9.3142)
            gf_lng = first_gf.get("longitude") or first_gf.get("lng", 79.1821)
            gf_radius = first_gf.get("radius_meters") or first_gf.get("radius", 233.9)
            debris_class = first_gf.get("class_name") or first_gf.get("class", "sunken_wreckage")
            severity = first_gf.get("severity", "EXTREME")

        # Position test vessel inside the geofence perimeter (~45 meters away)
        vessel_lat = gf_lat + 0.0003
        vessel_lng = gf_lng + 0.0003
        test_mmsi = "419000999"
        ship_name = "SAGAR KANYA (RESEARCH VESSEL)"

        dist_meters = haversine_distance_meters(vessel_lat, vessel_lng, gf_lat, gf_lng)

        test_vessel = VesselState(
            mmsi=test_mmsi,
            ship_name=ship_name,
            latitude=vessel_lat,
            longitude=vessel_lng,
            speed_knots=8.4,
            course_deg=135.0,
            heading_deg=135.0,
            nav_status="Under way using engine",
            ship_type="Research / Survey Vessel",
            imo="9123456",
            destination="PALK BAY SURVEY",
            eta="09-06 19:30",
            timestamp=now_iso,
            is_stale=False,
            last_seen_seconds_ago=0.0,
        )

        self._vessels[test_mmsi] = test_vessel
        self._vessel_last_received[test_mmsi] = now_ts

        # Trajectory track approaching the hazard
        if test_mmsi not in self._tracks:
            self._tracks[test_mmsi] = deque(maxlen=settings.AIS_MAX_TRACK_POINTS)
        
        self._tracks[test_mmsi].clear()
        for step in range(5, 0, -1):
            self._tracks[test_mmsi].append(
                VesselPositionPoint(
                    latitude=vessel_lat - (step * 0.0008),
                    longitude=vessel_lng - (step * 0.0008),
                    timestamp=now_iso,
                    speed_knots=9.2,
                    course_deg=135.0,
                )
            )
        self._tracks[test_mmsi].append(
            VesselPositionPoint(
                latitude=vessel_lat,
                longitude=vessel_lng,
                timestamp=now_iso,
                speed_knots=8.4,
                course_deg=135.0,
            )
        )

        # Build Critical SOS Proximity Alert
        alert_id = f"{test_mmsi}_{gf_id}"
        alert_msg = f"🚨 SOS CRITICAL: {ship_name} (MMSI: {test_mmsi}) has ENTERED Debris Safety Zone #{gf_id} ({debris_class}, {severity})! Imminent collision risk! Distance: {dist_meters:.0f}m"

        alert = VesselProximityAlert(
            vessel_mmsi=test_mmsi,
            ship_name=ship_name,
            detection_id=gf_id,
            debris_class=debris_class,
            severity=severity,
            distance_meters=round(dist_meters, 1),
            geofence_radius_meters=round(gf_radius, 1),
            status=VesselAlertStatus.INSIDE,
            alert_message=alert_msg,
            timestamp=now_iso,
        )

        self._alert_states[(test_mmsi, gf_id)] = VesselAlertStatus.INSIDE
        self._active_alerts[alert_id] = alert

        # Broadcast vessel update and SOS alert to connected frontend clients
        await self.broadcast_event("vessel_update", test_vessel.model_dump())
        await self.broadcast_event("proximity_alert", alert.model_dump())

        logger.warning(f"Test SOS alert triggered: {alert_msg}")
        return {
            "status": "triggered",
            "alert": alert.model_dump(),
            "vessel": test_vessel.model_dump(),
        }

    async def clear_test_alerts(self) -> Dict[str, Any]:
        """Clears all active proximity alerts."""
        self._active_alerts.clear()
        self._alert_states.clear()
        await self.broadcast_event("initial_state", {
            "status": self._status.value,
            "vessels": [v.model_dump() for v in self.get_active_vessels()],
            "alerts": [],
            "bounding_box": self._bbox.model_dump(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return {"status": "cleared", "active_alerts_count": 0}


# Singleton AIS service instance
ais_service = AisService()


def get_ais_service() -> AisService:
    """Dependency provider for AisService."""
    return ais_service
