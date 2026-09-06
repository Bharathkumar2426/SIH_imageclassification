"""AI Incident Information Extraction & Taxonomy Classifier (SIH 26057).

Performs heuristic NLP, maritime entity extraction, coordinate parsing with
strict no-hallucination guarantees, severity scoring, and danger radius assessment.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

from backend.models.incident_schemas import (
    IncidentSeverity,
    IncidentType,
    LocationPrecision,
    SourceTrustLevel,
)
from backend.services.incident_sources.base_source import RawIncidentItem

# Curated lookup table for well-known maritime coordinates (approximate centroid)
KNOWN_MARITIME_LOCATIONS: Dict[str, Tuple[float, float]] = {
    "palk strait": (9.3142, 79.1821),
    "palk bay": (9.3240, 79.1720),
    "gulf of mannar": (8.8500, 79.1200),
    "rameswaram": (9.2876, 79.3129),
    "dhanushkodi": (9.1770, 79.4160),
    "chennai": (13.0827, 80.2707),
    "bay of bengal": (14.0000, 85.0000),
    "arabian sea": (15.0000, 70.0000),
    "mumbai high": (19.4120, 71.3210),
    "strait of malacca": (4.2105, 99.8210),
    "malacca strait": (4.2105, 99.8210),
    "kochi": (9.9312, 76.2673),
    "goa": (15.2993, 73.9800),
    "fujairah": (25.1840, 56.3650),
    "gulf of oman": (24.5000, 58.5000),
    "florida straits": (24.5210, -80.8410),
    "gulf of mexico": (26.0000, -90.0000),
    "charleston harbor": (32.7420, -79.8210),
}


class IncidentAIService:
    """Extracts structured entities, verifies coordinates, and computes severity for maritime reports."""

    def extract_incident_features(self, item: RawIncidentItem) -> Dict[str, Any]:
        """Full AI extraction pipeline on raw incident text."""
        combined_text = f"{item.raw_title} {item.raw_text}"
        text_lower = combined_text.lower()

        # 1. Classify Incident Type
        inc_type = self._classify_type(text_lower)

        # 2. Extract and Validate Coordinates (Strict No-Hallucination)
        lat, lon, loc_text, precision = self._extract_location(item, text_lower, combined_text)

        # 3. Assess Severity
        severity = self._assess_severity(inc_type, text_lower)

        # 4. Calculate Confidence Score
        confidence = self._calculate_confidence(item, precision, severity)

        # 5. Calculate Recommended Potential Danger Radius (km)
        danger_radius, has_danger_zone = self._calculate_danger_radius(inc_type, severity, text_lower)

        # 6. Extract Related MMSIs & Keywords
        mmsi_list = self._extract_mmsi(combined_text, item.raw_metadata)
        keywords = self._extract_keywords(text_lower)

        # 7. Generate AI Extraction Reasoning Summary
        ai_reasoning = self._generate_reasoning(
            inc_type=inc_type,
            severity=severity,
            precision=precision,
            danger_radius=danger_radius,
            source_trust=item.source_trust_level,
            has_coords=(lat is not None and lon is not None),
        )

        return {
            "incident_type": inc_type,
            "latitude": lat,
            "longitude": lon,
            "location_text": loc_text,
            "location_precision": precision,
            "severity": severity,
            "confidence": confidence,
            "affected_area_radius_km": danger_radius,
            "potential_danger_zone": has_danger_zone,
            "related_mmsi": mmsi_list,
            "related_vessel_count": len(mmsi_list) if mmsi_list else (1 if "vessel" in text_lower or "ship" in text_lower else 0),
            "keywords": keywords,
            "ai_reasoning_summary": ai_reasoning,
        }

    def _classify_type(self, text: str) -> IncidentType:
        if any(k in text for k in ["collision", "collided", "glancing blow"]):
            return IncidentType.COLLISION
        if any(k in text for k in ["sinking", "sank", "capsized", "submerged vessel", "sunken"]):
            return IncidentType.SINKING
        if any(k in text for k in ["explosion", "fire", "burning", "blaze in engine"]):
            return IncidentType.FIRE_EXPLOSION
        if any(k in text for k in ["oil spill", "fuel release", "pollution", "crude sheen", "sheen", "chemical spill"]):
            return IncidentType.OIL_SPILL_POLLUTION
        if any(k in text for k in ["grounding", "aground", "grounded", "stranded on reef", "sandbar"]):
            return IncidentType.GROUNDING
        if any(k in text for k in ["search and rescue", "sar", "distress", "rescued", "taking on water", "adrift without power"]):
            return IncidentType.DISTRESS_SAR
        if any(k in text for k in ["container adrift", "floating debris", "derelict", "unmanned barge", "floating hazard"]):
            return IncidentType.FLOATING_DEBRIS
        if any(k in text for k in ["tsunami", "swell surge", "high wave"]):
            return IncidentType.TSUNAMI_SWELL
        if any(k in text for k in ["cyclone", "depression", "squall", "heavy gale", "severe marine weather"]):
            return IncidentType.SEVERE_WEATHER_CYCLONE
        if any(k in text for k in ["navigation hazard", "uncharted obstruction", "navarea", "broadcast notice"]):
            return IncidentType.NAVIGATION_HAZARD
        return IncidentType.OTHER

    def _extract_location(
        self, item: RawIncidentItem, text_lower: str, raw_text: str
    ) -> Tuple[Optional[float], Optional[float], str, LocationPrecision]:
        """Extracts verified coordinates or approximate named locations without hallucination."""
        # A. Pre-extracted by collector
        if item.extracted_latitude is not None and item.extracted_longitude is not None:
            lat = item.extracted_latitude
            lon = item.extracted_longitude
            loc_name = item.extracted_location_name or f"{abs(lat):.4f}°{'N' if lat>=0 else 'S'}, {abs(lon):.4f}°{'E' if lon>=0 else 'W'}"
            return round(lat, 4), round(lon, 4), loc_name, LocationPrecision.EXACT

        # B. Regex for maritime coordinates like "14-48.0N 071-32.0E" or "28.14N 90.42W"
        coord_match = re.search(
            r"(\d{1,2})[-°\s](\d{1,2}(?:\.\d+)?)\s*([NS])\s*(\d{1,3})[-°\s](\d{1,2}(?:\.\d+)?)\s*([EW])",
            raw_text,
            re.IGNORECASE,
        )
        if coord_match:
            try:
                lat_d, lat_m, lat_hemi, lon_d, lon_m, lon_hemi = coord_match.groups()
                lat_val = float(lat_d) + float(lat_m) / 60.0
                if lat_hemi.upper() == "S":
                    lat_val = -lat_val
                lon_val = float(lon_d) + float(lon_m) / 60.0
                if lon_hemi.upper() == "W":
                    lon_val = -lon_val

                if -90.0 <= lat_val <= 90.0 and -180.0 <= lon_val <= 180.0:
                    loc_name = f"{abs(lat_val):.4f}°{lat_hemi.upper()}, {abs(lon_val):.4f}°{lon_hemi.upper()}"
                    return round(lat_val, 4), round(lon_val, 4), loc_name, LocationPrecision.EXACT
            except Exception:
                pass

        # C. Match known named marine bodies / ports (APPROXIMATE)
        for loc_key, coords in KNOWN_MARITIME_LOCATIONS.items():
            if loc_key in text_lower:
                return coords[0], coords[1], loc_key.title(), LocationPrecision.APPROXIMATE

        # D. UNKNOWN: Never invent coordinates
        return None, None, "Undetermined Marine Zone", LocationPrecision.UNKNOWN

    def _assess_severity(self, inc_type: IncidentType, text: str) -> IncidentSeverity:
        if inc_type in (IncidentType.COLLISION, IncidentType.SINKING, IncidentType.FIRE_EXPLOSION, IncidentType.TSUNAMI_SWELL):
            return IncidentSeverity.CRITICAL
        if inc_type in (IncidentType.OIL_SPILL_POLLUTION, IncidentType.GROUNDING, IncidentType.DISTRESS_SAR, IncidentType.SEVERE_WEATHER_CYCLONE):
            if any(k in text for k in ["severe", "major", "urgency", "red alert", "crew rescued", "gallons"]):
                return IncidentSeverity.CRITICAL
            return IncidentSeverity.HIGH
        if inc_type in (IncidentType.FLOATING_DEBRIS, IncidentType.NAVIGATION_HAZARD):
            return IncidentSeverity.MEDIUM
        return IncidentSeverity.LOW

    def _calculate_confidence(
        self, item: RawIncidentItem, precision: LocationPrecision, severity: IncidentSeverity
    ) -> float:
        base = 0.70
        if item.source_trust_level == SourceTrustLevel.LEVEL_1_AUTHORITATIVE:
            base += 0.20
        elif item.source_trust_level == SourceTrustLevel.LEVEL_2_SPECIALIZED:
            base += 0.15
        elif item.source_trust_level == SourceTrustLevel.LEVEL_3_NEWS:
            base += 0.05

        if precision == LocationPrecision.EXACT:
            base += 0.05
        elif precision == LocationPrecision.UNKNOWN:
            base -= 0.10

        return min(round(base, 2), 0.98)

    def _calculate_danger_radius(
        self, inc_type: IncidentType, severity: IncidentSeverity, text: str
    ) -> Tuple[Optional[float], bool]:
        """Recommends potential danger exclusion radius based on physical incident hazard."""
        if inc_type == IncidentType.OIL_SPILL_POLLUTION:
            return 8.0, True
        if inc_type in (IncidentType.COLLISION, IncidentType.SINKING, IncidentType.FIRE_EXPLOSION):
            return 5.0, True
        if inc_type == IncidentType.GROUNDING:
            return 3.0, True
        if inc_type == IncidentType.FLOATING_DEBRIS:
            return 2.5, True
        if inc_type == IncidentType.NAVIGATION_HAZARD:
            return 2.0, True
        if inc_type == IncidentType.TSUNAMI_SWELL:
            return 15.0, True
        if inc_type == IncidentType.SEVERE_WEATHER_CYCLONE:
            return 25.0, True
        return None, False

    def _extract_mmsi(self, text: str, meta: Dict[str, Any]) -> List[str]:
        mmsi_list = []
        if meta.get("mmsi"):
            mmsi_list.append(str(meta["mmsi"]))
        matches = re.findall(r"\b(2\d{8}|3\d{8}|4\d{8}|5\d{8}|6\d{8}|7\d{8})\b", text)
        for m in matches:
            if m not in mmsi_list:
                mmsi_list.append(m)
        return mmsi_list

    def _extract_keywords(self, text: str) -> List[str]:
        target_words = [
            "collision", "grounding", "sinking", "oil spill", "fire", "sar",
            "rescue", "cyclone", "high waves", "palk strait", "arabian sea",
            "bay of bengal", "coast guard", "noaa", "incois", "hazard", "debris"
        ]
        return [w for w in target_words if w in text]

    def _generate_reasoning(
        self,
        inc_type: IncidentType,
        severity: IncidentSeverity,
        precision: LocationPrecision,
        danger_radius: Optional[float],
        source_trust: SourceTrustLevel,
        has_coords: bool,
    ) -> str:
        trust_str = "Authoritative government broadcast" if source_trust == SourceTrustLevel.LEVEL_1_AUTHORITATIVE else "Multi-wire press bulletin"
        coord_str = "Exact geodetic coordinates parsed" if precision == LocationPrecision.EXACT else ("Approximate coastal sector resolved" if precision == LocationPrecision.APPROXIMATE else "Location unverified (no map plotting permitted)")
        danger_str = f"Recommended danger radius: {danger_radius} km" if danger_radius else "No discrete exclusion zone required"

        return (
            f"Classified as [{inc_type.value}] with [{severity.value}] priority based on {trust_str}. "
            f"Spatial validation: {coord_str}. {danger_str}."
        )


_ai_service: Optional[IncidentAIService] = None


def get_incident_ai_service() -> IncidentAIService:
    global _ai_service
    if _ai_service is None:
        _ai_service = IncidentAIService()
    return _ai_service
