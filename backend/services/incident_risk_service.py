"""Safe AIS Risk Correlation Service (SIH 26057).

Performs read-only geospatial proximity and ETA calculations against live AIS vessels
without modifying or duplicating the underlying AISStream connection.
"""

from __future__ import annotations

import logging
import math
from typing import List, Optional

from backend.models.incident_schemas import Incident, NearbyVesselRisk
from backend.services.ais_service import get_ais_service
from backend.services.ais_demo_service import get_ais_demo_service

logger = logging.getLogger("IncidentRiskService")


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


class IncidentRiskService:
    """Evaluates real-time navigational hazard exposure of live vessels to confirmed maritime incidents."""

    def correlate_nearby_vessels(self, incident: Incident) -> List[NearbyVesselRisk]:
        """Calculates proximity of tracked vessels to an incident's reported coordinates and danger zone."""
        if incident.latitude is None or incident.longitude is None:
            return []

        # Read active vessels from live AIS service (or fallback demo service if live is idle)
        live_svc = get_ais_service()
        active_vessels = live_svc.get_active_vessels()
        if not active_vessels:
            demo_svc = get_ais_demo_service()
            active_vessels = demo_svc.get_active_vessels()

        if not active_vessels:
            return []

        danger_radius_km = incident.affected_area_radius_km or 3.0
        monitor_envelope_km = danger_radius_km + 15.0

        risks: List[NearbyVesselRisk] = []

        for v in active_vessels:
            if v.latitude is None or v.longitude is None:
                continue

            dist_km = haversine_km(v.latitude, v.longitude, incident.latitude, incident.longitude)
            if dist_km > monitor_envelope_km:
                continue

            # Assess risk level
            if dist_km <= danger_radius_km:
                risk_level = "DANGER"
            elif dist_km <= (danger_radius_km + 5.0):
                risk_level = "WARNING"
            else:
                risk_level = "MONITORED"

            # Compute ETA if speed is positive
            speed = v.speed_knots or 0.0
            eta_min: Optional[float] = None
            if speed > 0.5:
                speed_kmh = speed * 1.852
                dist_to_perimeter = max(0.0, dist_km - danger_radius_km)
                eta_min = round((dist_to_perimeter / speed_kmh) * 60.0, 1)

            risks.append(
                NearbyVesselRisk(
                    vessel_mmsi=v.mmsi,
                    ship_name=v.ship_name or f"MMSI {v.mmsi}",
                    latitude=v.latitude,
                    longitude=v.longitude,
                    distance_km=round(dist_km, 2),
                    speed_knots=speed,
                    course_deg=v.course_deg,
                    eta_minutes=eta_min,
                    risk_level=risk_level,
                )
            )

        # Sort by closest distance
        risks.sort(key=lambda r: r.distance_km)
        return risks


_risk_service: Optional[IncidentRiskService] = None


def get_incident_risk_service() -> IncidentRiskService:
    global _risk_service
    if _risk_service is None:
        _risk_service = IncidentRiskService()
    return _risk_service
