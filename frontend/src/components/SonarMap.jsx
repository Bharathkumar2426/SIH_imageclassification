import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  Layers, ShieldAlert, AlertTriangle, CheckCircle2, 
  Compass, Eye, Maximize2, Minimize2, MapPin, ZoomIn, ZoomOut, RotateCcw, Globe, Anchor, Tag,
  Ship, Navigation, Radio, TrendingUp
} from 'lucide-react';
import { AisStatusBadge } from './AisStatusBadge';
import { 
  getAisStatus, getAisVessels, getAisTracks, getAisAlerts, 
  syncDebrisGeofences, connectAisWebSocket 
} from '../services/aisApi';
import {
  getDemoStatus, getDemoVessels, getDemoTracks, getDemoAlerts,
  syncDemoGeofences, connectAisDemoWebSocket
} from '../services/aisDemoApi';

const SEVERITY_CONFIG = {
  EXTREME: {
    color: '#ef4444',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/40',
    text: 'text-rose-400',
    label: 'EXTREME',
    pulseClass: 'marker-pulse-extreme',
    icon: '🔴',
  },
  MEDIUM: {
    color: '#f59e0b',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/40',
    text: 'text-amber-400',
    label: 'MEDIUM',
    pulseClass: 'marker-pulse-medium',
    icon: '🟠',
  },
  LOW: {
    color: '#10b981',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/40',
    text: 'text-emerald-400',
    label: 'LOW',
    pulseClass: 'marker-pulse-low',
    icon: '🟢',
  },
};

const CARTO_KEY = 'cb1_2yon_1_9ffb76d43983d1d23dee75e8';

const BASEMAPS = {
  cartoDark: {
    name: '🌑 CARTO Dark Matter (Keyed)',
    url: `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${CARTO_KEY}`,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
    maxNativeZoom: 19,
    hasBuiltinLabels: true,
  },
  cartoVoyager: {
    name: '🧭 CARTO Voyager (Keyed)',
    url: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_KEY}`,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
    maxNativeZoom: 19,
    hasBuiltinLabels: true,
  },
  esriOcean: {
    name: '🌊 World Ocean Bathymetry',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
    labelUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; GEBCO, NOAA, National Geographic',
    maxZoom: 20,
    maxNativeZoom: 13,
    hasBuiltinLabels: false,
  },
  esriDark: {
    name: '🌌 Dark Ocean Canvas',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    labelUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, USGS, FAO',
    maxZoom: 20,
    maxNativeZoom: 16,
    hasBuiltinLabels: false,
  },
  satellite: {
    name: '🛰️ Satellite Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    labelUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS',
    maxZoom: 20,
    maxNativeZoom: 17,
    hasBuiltinLabels: false,
  },
  osm: {
    name: '🗺️ Nautical Chart (OSM)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: 'abc',
    maxZoom: 20,
    maxNativeZoom: 19,
    hasBuiltinLabels: true,
  },
};

const SEAMARKS_URL = 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png';

export function SonarMap({
  geospatialData,
  selectedTargetId,
  selectedVesselMmsi,
  aisMode = 'LIVE',
  onSelectTarget,
  onSelectVessel,
  onSwitchToAnalysis,
  onAlertsChange,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const labelLayerRef = useRef(null);
  const seamarksLayerRef = useRef(null);
  const markersGroupRef = useRef(null);
  const geofencesGroupRef = useRef(null);
  const vesselsGroupRef = useRef(null);
  const tracksGroupRef = useRef(null);

  const [activeBasemap, setActiveBasemap] = useState('cartoDark');
  const [showOceanLabels, setShowOceanLabels] = useState(true);
  const [showSeamarks, setShowSeamarks] = useState(false);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [showGeofences, setShowGeofences] = useState(true);
  const [enablePulsing, setEnablePulsing] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Live AIS Layer States
  const [showLiveVessels, setShowLiveVessels] = useState(true);
  const [showVesselTracks, setShowVesselTracks] = useState(true);
  const [vesselsMap, setVesselsMap] = useState({});
  const [tracksMap, setTracksMap] = useState({});
  const [aisStatus, setAisStatus] = useState('OFFLINE');
  const [aisLastUpdate, setAisLastUpdate] = useState(null);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [mapMoveTick, setMapMoveTick] = useState(0);

  const hasAutoFittedRef = useRef(false);
  const prevTargetIdRef = useRef(null);
  const prevVesselMmsiRef = useRef(null);

  const detections = geospatialData?.detections || [];
  const telemetry = geospatialData?.towfish_telemetry || {
    towfish_latitude: 9.3142,
    towfish_longitude: 79.1821,
    altitude_depth_m: 28.0,
    survey_zone: 'Palk Strait MoES Acoustic Survey',
  };

  // Helper to mount correctly aligned reference labels
  const updateLabelLayer = (map, basemapKey, isLabelsEnabled) => {
    if (labelLayerRef.current) {
      if (map.hasLayer(labelLayerRef.current)) {
        map.removeLayer(labelLayerRef.current);
      }
      labelLayerRef.current = null;
    }

    if (!isLabelsEnabled) return;

    const cfg = BASEMAPS[basemapKey] || BASEMAPS.cartoDark;
    if (cfg.labelUrl) {
      const newLabelLayer = L.tileLayer(cfg.labelUrl, {
        attribution: 'Labels &copy; Esri / GEBCO / NOAA',
        maxZoom: 20,
        maxNativeZoom: cfg.maxNativeZoom || 16,
        opacity: 0.95,
        zIndex: 400,
      });
      newLabelLayer.addTo(map);
      labelLayerRef.current = newLabelLayer;
    }
  };

  // 1. Initialize Map with Global World Capabilities (minZoom 2)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialLat = telemetry.towfish_latitude || 9.3142;
    const initialLng = telemetry.towfish_longitude || 79.1821;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 16,
      minZoom: 2,
      maxZoom: 20,
      worldCopyJump: true,
      zoomControl: false,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Base tile layer
    const cfg = BASEMAPS[activeBasemap] || BASEMAPS.cartoDark;
    const tileLayer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      subdomains: cfg.subdomains || 'abc',
      maxZoom: 20,
      maxNativeZoom: cfg.maxNativeZoom || 18,
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    // Reference label layer
    updateLabelLayer(map, activeBasemap, showOceanLabels);

    // OpenSeaMap Nautical Marks Overlay
    const seamarksLayer = L.tileLayer(SEAMARKS_URL, {
      attribution: '&copy; <a href="http://www.openseamap.org">OpenSeaMap</a> contributors',
      maxZoom: 20,
      maxNativeZoom: 18,
      opacity: 0.9,
      zIndex: 450,
    });
    if (showSeamarks) {
      seamarksLayer.addTo(map);
    }
    seamarksLayerRef.current = seamarksLayer;

    // Layer Groups: 1. Debris markers, 2. Debris Geofences, 3. Live AIS Vessels, 4. AIS Trajectory Tracks
    markersGroupRef.current = L.featureGroup().addTo(map);
    geofencesGroupRef.current = L.featureGroup().addTo(map);
    tracksGroupRef.current = L.featureGroup().addTo(map);
    vesselsGroupRef.current = L.featureGroup().addTo(map);

    map.on('moveend', () => setMapMoveTick((t) => t + 1));
    map.on('zoomend', () => setMapMoveTick((t) => t + 1));

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Switch Base Tile Layer & its matching label layer
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const cfg = BASEMAPS[activeBasemap] || BASEMAPS.cartoDark;
    mapInstanceRef.current.removeLayer(tileLayerRef.current);
    const newLayer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      subdomains: cfg.subdomains || 'abc',
      maxZoom: 20,
      maxNativeZoom: cfg.maxNativeZoom || 18,
    }).addTo(mapInstanceRef.current);
    tileLayerRef.current = newLayer;
    newLayer.bringToBack();

    updateLabelLayer(mapInstanceRef.current, activeBasemap, showOceanLabels);
  }, [activeBasemap, showOceanLabels]);

  // 3. Toggle Nautical Seamarks Overlay
  useEffect(() => {
    if (!mapInstanceRef.current || !seamarksLayerRef.current) return;
    if (showSeamarks) {
      if (!mapInstanceRef.current.hasLayer(seamarksLayerRef.current)) {
        seamarksLayerRef.current.addTo(mapInstanceRef.current);
      }
    } else {
      if (mapInstanceRef.current.hasLayer(seamarksLayerRef.current)) {
        mapInstanceRef.current.removeLayer(seamarksLayerRef.current);
      }
    }
  }, [showSeamarks]);

  // 4. Handle Container Resizing
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current.invalidateSize();
      }, 200);
    }
  }, [isFullscreen]);

  // 5. Synchronize active debris geofences with the AIS backend for collision evaluation
  useEffect(() => {
    if (detections && detections.length > 0) {
      const gfs = detections.map((d) => ({
        id: d.detection_id,
        class_name: d.class_name,
        latitude: d.geolocation.latitude,
        longitude: d.geolocation.longitude,
        radius_meters: d.geofence ? d.geofence.radius_meters : 25.0,
        severity: d.severity || 'LOW',
      }));
      if (aisMode === 'DEMO') {
        syncDemoGeofences(gfs);
      } else {
        syncDebrisGeofences(gfs);
      }
    }
  }, [detections, aisMode]);

  // 6. Connect to Live AIS or Demo WebSocket Stream & Setup Initial Fetching
  useEffect(() => {
    let isMounted = true;
    const isDemo = aisMode === 'DEMO';

    // Clear previous vessels & tracks when switching modes
    setVesselsMap({});
    setTracksMap({});
    setActiveAlerts([]);
    if (onAlertsChange) onAlertsChange([]);

    const fetchInitialData = async () => {
      try {
        if (isDemo) {
          const [statusData, vesselsData, tracksData, alertsData] = await Promise.all([
            getDemoStatus().catch(() => null),
            getDemoVessels().catch(() => []),
            getDemoTracks().catch(() => ({})),
            getDemoAlerts().catch(() => []),
          ]);

          if (!isMounted) return;

          if (statusData) {
            setAisStatus('DEMO_ACTIVE');
            setAisLastUpdate(new Date().toISOString());
          }

          if (Array.isArray(vesselsData)) {
            const mapObj = {};
            vesselsData.forEach((v) => {
              if (v && v.mmsi) mapObj[v.mmsi] = v;
            });
            setVesselsMap(mapObj);
          }

          if (tracksData) {
            setTracksMap(tracksData);
          }

          if (Array.isArray(alertsData)) {
            setActiveAlerts(alertsData);
            if (onAlertsChange) onAlertsChange(alertsData);
          }
        } else {
          const [statusData, vesselsData, tracksData, alertsData] = await Promise.all([
            getAisStatus().catch(() => null),
            getAisVessels().catch(() => []),
            getAisTracks().catch(() => ({})),
            getAisAlerts().catch(() => []),
          ]);

          if (!isMounted) return;

          if (statusData) {
            setAisStatus(statusData.status || 'OFFLINE');
            setAisLastUpdate(statusData.last_update);
          }

          if (Array.isArray(vesselsData)) {
            const mapObj = {};
            vesselsData.forEach((v) => {
              if (v && v.mmsi) mapObj[v.mmsi] = v;
            });
            setVesselsMap(mapObj);
          }

          if (tracksData) {
            setTracksMap(tracksData);
          }

          if (Array.isArray(alertsData)) {
            setActiveAlerts(alertsData);
            if (onAlertsChange) onAlertsChange(alertsData);
          }
        }
      } catch (err) {
        console.debug('AIS initial fetch notice:', err);
      }
    };

    fetchInitialData();

    // WebSocket real-time subscription
    let wsClient = null;

    if (isDemo) {
      wsClient = connectAisDemoWebSocket({
        onSnapshot: (data) => {
          if (!isMounted) return;
          if (data.is_running !== undefined) {
            setAisStatus(data.is_running ? 'DEMO_ACTIVE' : 'DEMO_PAUSED');
          }
          if (data.timestamp) setAisLastUpdate(data.timestamp);

          if (Array.isArray(data.vessels)) {
            const mapObj = {};
            data.vessels.forEach((v) => {
              if (v && v.mmsi) mapObj[v.mmsi] = v;
            });
            setVesselsMap(mapObj);
          }

          if (data.tracks) {
            setTracksMap(data.tracks);
          }

          if (Array.isArray(data.alerts)) {
            setActiveAlerts(data.alerts);
            if (onAlertsChange) onAlertsChange(data.alerts);
          }
        },
        onDisconnected: () => {
          if (!isMounted) return;
          setAisStatus('DEMO_OFFLINE');
        },
      });
    } else {
      wsClient = connectAisWebSocket({
        onInitialState: (data) => {
          if (!isMounted) return;
          if (data.status) setAisStatus(data.status);
          if (data.timestamp) setAisLastUpdate(data.timestamp);

          if (Array.isArray(data.vessels)) {
            const mapObj = {};
            data.vessels.forEach((v) => {
              if (v && v.mmsi) mapObj[v.mmsi] = v;
            });
            setVesselsMap(mapObj);
          }

          if (Array.isArray(data.alerts)) {
            setActiveAlerts(data.alerts);
            if (onAlertsChange) onAlertsChange(data.alerts);
          }
        },
        onStatusChange: (newStatus) => {
          if (!isMounted) return;
          setAisStatus(newStatus);
        },
        onVesselUpdate: (vessel) => {
          if (!isMounted || !vessel || !vessel.mmsi) return;
          setVesselsMap((prev) => ({
            ...prev,
            [vessel.mmsi]: vessel,
          }));
          setAisLastUpdate(vessel.timestamp || new Date().toISOString());

          // Append to tracks locally
          setTracksMap((prev) => {
            const existing = prev[vessel.mmsi] || [];
            const newPoint = {
              latitude: vessel.latitude,
              longitude: vessel.longitude,
              timestamp: vessel.timestamp,
              speed_knots: vessel.speed_knots,
              course_deg: vessel.course_deg,
            };
            const updated = [...existing.slice(-99), newPoint];
            return {
              ...prev,
              [vessel.mmsi]: updated,
            };
          });
        },
        onProximityAlert: (alert) => {
          if (!isMounted || !alert) return;
          setActiveAlerts((prev) => {
            const filtered = prev.filter(
              (a) => !(a.vessel_mmsi === alert.vessel_mmsi && a.detection_id === alert.detection_id)
            );
            const updated = [...filtered, alert];
            if (onAlertsChange) onAlertsChange(updated);
            return updated;
          });
        },
        onProximityClear: (alertId) => {
          if (!isMounted || !alertId) return;
          setActiveAlerts((prev) => {
            const updated = prev.filter(
              (a) => `${a.vessel_mmsi}_${a.detection_id}` !== alertId
            );
            if (onAlertsChange) onAlertsChange(updated);
            return updated;
          });
        },
        onDisconnected: () => {
          if (!isMounted) return;
          setAisStatus('CONNECTING');
        },
      });
    }

    // Background interval to refresh status
    const interval = setInterval(fetchInitialData, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (wsClient) wsClient.disconnect();
    };
  }, [aisMode]);

  // 7. Render Existing Debris Markers (Layer 1) and Dynamic Geofences (Layer 2) - STRICTLY PRESERVED
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current || !geofencesGroupRef.current) return;

    markersGroupRef.current.clearLayers();
    geofencesGroupRef.current.clearLayers();

    const filteredDetections = detections.filter((d) => {
      if (severityFilter === 'ALL') return true;
      return d.severity === severityFilter;
    });

    filteredDetections.forEach((d) => {
      const lat = d.geolocation.latitude;
      const lng = d.geolocation.longitude;
      const sev = d.severity;
      const sevCfg = SEVERITY_CONFIG[sev] || SEVERITY_CONFIG.LOW;
      const isSelected = selectedTargetId === d.detection_id;

      // 1. Dynamic Geofence Polygon / Circle (Layer 2)
      if (showGeofences && d.geofence) {
        const radiusMeters = d.geofence.radius_meters;
        const circle = L.circle([lat, lng], {
          radius: radiusMeters,
          color: sevCfg.color,
          weight: isSelected ? 3 : 1.5,
          opacity: isSelected ? 0.95 : 0.65,
          fillColor: sevCfg.color,
          fillOpacity: isSelected ? 0.28 : 0.14,
          dashArray: isSelected ? undefined : '5, 5',
        });

        circle.bindTooltip(
          `<strong>Geofence #${d.detection_id} (${sev})</strong><br/>Radius: ${radiusMeters}m exclusion buffer`,
          { className: 'font-mono text-xs' }
        );

        circle.addTo(geofencesGroupRef.current);
      }

      // 2. Custom Sonar Debris Marker Icon (Layer 1)
      const pulseClass = enablePulsing ? sevCfg.pulseClass : '';
      const markerHtml = `
        <div class="relative flex items-center justify-center cursor-pointer">
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold text-white shadow-xl ${pulseClass}" 
               style="background-color: ${sevCfg.color}; border: 2px solid ${isSelected ? '#ffffff' : '#030a16'}; transform: ${isSelected ? 'scale(1.25)' : 'scale(1.0)'}; transition: transform 0.2s;">
            ${d.detection_id}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-sonar-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      // Build popup content
      const confPercent = (d.confidence * 100).toFixed(1);
      const anomScore = (d.anomaly_score || 0.0).toFixed(2);
      const radiusM = d.geofence?.radius_meters || 25;

      const popupContent = document.createElement('div');
      popupContent.className = 'p-3 font-mono text-xs text-slate-200 min-w-[240px] space-y-2';
      popupContent.innerHTML = `
        <div class="flex items-center justify-between border-b border-ocean-800 pb-1.5">
          <div class="flex items-center space-x-1.5">
            <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${sevCfg.color}"></span>
            <strong class="text-sm font-bold text-white uppercase">${d.class_name}</strong>
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${sevCfg.bg} ${sevCfg.text} border ${sevCfg.border}">
            ${sev}
          </span>
        </div>
        
        <div class="space-y-1 text-[11px] text-slate-300">
          <div class="flex justify-between">
            <span class="text-slate-400">Target ID:</span>
            <span class="font-bold text-cyan-400">#${d.detection_id}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Confidence:</span>
            <span class="font-bold text-white">${confPercent}%</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Anomaly Score:</span>
            <span class="text-amber-400 font-bold">${anomScore}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Coordinates:</span>
            <span class="text-slate-200">${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Sensor Altitude:</span>
            <span class="text-slate-200">${d.geolocation.depth_meters}m AGL</span>
          </div>
          <div class="flex justify-between border-t border-ocean-800/60 pt-1">
            <span class="text-slate-400">Dynamic Geofence:</span>
            <span class="font-bold text-emerald-400">${radiusM}m buffer</span>
          </div>
        </div>

        <div class="p-1.5 rounded bg-ocean-950/80 border border-ocean-800 text-[10px] text-slate-400">
          ⚠️ ${d.geofence?.risk_summary || sevCfg.label}
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on('click', () => {
        if (onSelectTarget) {
          onSelectTarget(d.detection_id);
        }
      });

      marker.addTo(markersGroupRef.current);
    });

    // Auto fit bounds on initial mount only once
    if (!hasAutoFittedRef.current && filteredDetections.length > 0 && mapInstanceRef.current) {
      const bounds = markersGroupRef.current.getBounds();
      if (bounds.isValid()) {
        mapInstanceRef.current.fitBounds(bounds.pad(0.25), { maxZoom: 18 });
        hasAutoFittedRef.current = true;
      }
    }
  }, [detections, severityFilter, showGeofences, enablePulsing]);

  // 8. Render AIS Vessels (Layer 3) & Vessel Tracks (Layer 4) with LIVE vs DEMO transparency
  useEffect(() => {
    if (!mapInstanceRef.current || !vesselsGroupRef.current || !tracksGroupRef.current) return;

    vesselsGroupRef.current.clearLayers();
    tracksGroupRef.current.clearLayers();

    if (!showLiveVessels) return;

    const isDemo = aisMode === 'DEMO';
    const vesselList = Object.values(vesselsMap);
    const bounds = mapInstanceRef.current.getBounds();
    const visibleVessels = bounds && bounds.isValid()
      ? vesselList.filter((v) => bounds.pad(0.25).contains([v.latitude, v.longitude])).slice(0, 350)
      : vesselList.slice(0, 350);

    visibleVessels.forEach((v) => {
      const isSelected = selectedVesselMmsi === v.mmsi;
      const isStale = v.is_stale;
      const shipName = v.ship_name || `MMSI: ${v.mmsi}`;
      const speed = v.speed_knots !== null && v.speed_knots !== undefined ? `${v.speed_knots.toFixed(1)} kn` : 'N/A';
      const course = v.course_deg !== null && v.course_deg !== undefined ? `${v.course_deg.toFixed(0)}°` : null;
      const heading = v.heading_deg !== null && v.heading_deg !== undefined ? v.heading_deg : (v.course_deg || 0);

      // 8a. Draw Vessel Trajectory Track (Layer 4)
      if (showVesselTracks && tracksMap[v.mmsi] && tracksMap[v.mmsi].length > 1) {
        const latlngs = tracksMap[v.mmsi].map((pt) => [pt.latitude, pt.longitude]);
        const polyline = L.polyline(latlngs, {
          color: isDemo ? (isSelected ? '#fbbf24' : '#f59e0b') : (isSelected ? '#38bdf8' : '#0284c7'),
          weight: isSelected ? 3 : 2,
          opacity: isStale ? 0.4 : 0.75,
          dashArray: '4, 4',
        });
        polyline.addTo(tracksGroupRef.current);
      }

      // 8b. Distinct Vessel Marker Icon (Layer 3)
      const rotationDeg = heading || 0;
      const markerHtml = `
        <div class="relative flex flex-col items-center justify-center cursor-pointer group" style="opacity: ${isStale ? 0.6 : 1.0}">
          <!-- Vessel Name Tooltip on Hover -->
          <div class="absolute -top-6 whitespace-nowrap bg-ocean-950/90 border ${isDemo ? 'border-amber-500/70 text-amber-300' : 'border-cyan-500/50 text-cyan-300'} px-1.5 py-0.2 rounded text-[9px] font-mono font-bold shadow-lg pointer-events-none">
            ${isDemo ? '<span class="text-amber-400 font-extrabold mr-1">[DEMO]</span>' : ''}${shipName} ${speed !== 'N/A' ? `(${speed})` : ''}
          </div>

          <!-- Vessel Icon with Heading Rotation -->
          <div class="w-8 h-8 rounded-lg ${
            isDemo 
              ? 'bg-gradient-to-br from-amber-600 to-yellow-700 border-2 ' + (isSelected ? 'border-white scale-125' : 'border-amber-300') + ' shadow-amber-500/40 text-black font-extrabold'
              : 'bg-gradient-to-br from-cyan-600 to-blue-700 border-2 ' + (isSelected ? 'border-white scale-125' : 'border-cyan-300') + ' shadow-cyan-500/30 text-white'
          } flex items-center justify-center shadow-xl transition-transform duration-300">
            <span style="display: inline-block; transform: rotate(${rotationDeg}deg); font-size: 14px;">🚢</span>
          </div>

          ${isStale ? '<span class="absolute -bottom-2 px-1 rounded bg-amber-950 text-amber-400 text-[8px] border border-amber-700/60">STALE</span>' : ''}
        </div>
      `;

      const vesselIcon = L.divIcon({
        html: markerHtml,
        className: isDemo ? 'custom-demo-vessel-marker' : 'custom-vessel-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      });

      const marker = L.marker([v.latitude, v.longitude], { icon: vesselIcon });

      // Format Last Update
      let updateTimeStr = 'Recorded Telemetry';
      if (!isDemo && v.last_seen_seconds_ago > 0) {
        if (v.last_seen_seconds_ago < 60) {
          updateTimeStr = `${Math.round(v.last_seen_seconds_ago)}s ago`;
        } else {
          updateTimeStr = `${Math.round(v.last_seen_seconds_ago / 60)}m ago`;
        }
      } else if (v.timestamp) {
        updateTimeStr = v.timestamp;
      }

      // Popup Content with Real Transparency
      const popupDiv = document.createElement('div');
      popupDiv.className = 'p-3 font-mono text-xs text-slate-200 min-w-[270px] space-y-2';
      popupDiv.innerHTML = `
        <div class="flex items-center justify-between border-b border-ocean-800 pb-1.5">
          <div class="flex items-center space-x-1.5">
            <span class="text-base">🚢</span>
            <strong class="text-sm font-bold ${isDemo ? 'text-amber-300' : 'text-cyan-300'} uppercase">
              ${v.ship_name || 'UNNAMED VESSEL'}
            </strong>
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
            isDemo
              ? 'bg-amber-950 text-amber-400 border border-amber-600/70'
              : (isStale ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800')
          }">
            ${isDemo ? 'DEMO MODE — RECORDED' : (isStale ? 'STALE DATA' : 'LIVE AIS')}
          </span>
        </div>

        <div class="space-y-1 text-[11px] text-slate-300">
          <div class="flex justify-between">
            <span class="text-slate-400">MMSI:</span>
            <span class="font-bold text-white">${v.mmsi}</span>
          </div>
          ${v.imo ? `<div class="flex justify-between"><span class="text-slate-400">IMO:</span><span class="text-slate-200">${v.imo}</span></div>` : ''}
          ${v.ship_type ? `<div class="flex justify-between"><span class="text-slate-400">Type:</span><span class="text-slate-200">${v.ship_type}</span></div>` : ''}
          <div class="flex justify-between">
            <span class="text-slate-400">Position:</span>
            <span class="${isDemo ? 'text-amber-400' : 'text-cyan-400'} font-semibold">${v.latitude.toFixed(4)}°N, ${v.longitude.toFixed(4)}°E</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Speed (SOG):</span>
            <span class="font-bold text-emerald-400">${speed}</span>
          </div>
          ${course ? `<div class="flex justify-between"><span class="text-slate-400">Course (COG):</span><span class="text-slate-200">${course}</span></div>` : ''}
          ${v.heading_deg !== null && v.heading_deg !== undefined ? `<div class="flex justify-between"><span class="text-slate-400">Heading:</span><span class="text-slate-200">${v.heading_deg}°</span></div>` : ''}
          ${v.nav_status ? `<div class="flex justify-between"><span class="text-slate-400">Nav Status:</span><span class="text-slate-200">${v.nav_status}</span></div>` : ''}
          ${v.destination ? `<div class="flex justify-between"><span class="text-slate-400">Destination:</span><span class="text-slate-200">${v.destination}</span></div>` : ''}
          ${v.eta ? `<div class="flex justify-between"><span class="text-slate-400">ETA:</span><span class="text-slate-200">${v.eta}</span></div>` : ''}
          
          <div class="border-t border-ocean-800/60 pt-1 text-[10px] space-y-0.5">
            <div class="flex justify-between text-slate-400">
              <span>Data Source:</span>
              <span class="font-semibold text-slate-200">${isDemo ? 'AISStream recorded data' : 'Real-time AISStream'}</span>
            </div>
            <div class="flex justify-between text-slate-400">
              <span>Operational Mode:</span>
              <span class="font-bold ${isDemo ? 'text-amber-400' : 'text-emerald-400'}">${isDemo ? 'DEMO (Offline Replay)' : 'LIVE STREAM'}</span>
            </div>
            <div class="flex justify-between text-slate-400">
              <span>Timestamp:</span>
              <span class="text-slate-300">${updateTimeStr}</span>
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupDiv);

      marker.on('click', () => {
        if (onSelectVessel) onSelectVessel(v.mmsi);
      });

      marker.addTo(vesselsGroupRef.current);
    });
  }, [vesselsMap, tracksMap, showLiveVessels, showVesselTracks, selectedVesselMmsi, aisMode, mapMoveTick]);

  // Center on selected target only on explicit selection change
  useEffect(() => {
    if (!selectedTargetId || !mapInstanceRef.current) return;
    if (prevTargetIdRef.current === selectedTargetId) return;
    prevTargetIdRef.current = selectedTargetId;

    const target = detections.find((d) => d.detection_id === selectedTargetId);
    if (target) {
      mapInstanceRef.current.setView(
        [target.geolocation.latitude, target.geolocation.longitude],
        18,
        { animate: true }
      );
    }
  }, [selectedTargetId, detections]);

  // Center on selected vessel only on explicit selection change
  useEffect(() => {
    if (!selectedVesselMmsi || !mapInstanceRef.current) return;
    if (prevVesselMmsiRef.current === selectedVesselMmsi) return;
    prevVesselMmsiRef.current = selectedVesselMmsi;

    const v = vesselsMap[selectedVesselMmsi];
    if (v) {
      mapInstanceRef.current.setView([v.latitude, v.longitude], 16, { animate: true });
    }
  }, [selectedVesselMmsi, vesselsMap]);

  const handleFitAll = () => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;
    const bounds = markersGroupRef.current.getBounds();
    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds.pad(0.3));
    }
  };

  const handleZoomWorld = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([20.0, 78.0], 3, { animate: true });
  };

  return (
    <div className={`relative w-full rounded-xl overflow-hidden border border-ocean-800 shadow-2xl bg-ocean-950 flex flex-col transition-all duration-300 ${
      isFullscreen ? 'fixed inset-4 z-[9999] h-[calc(100vh-2rem)]' : 'h-[750px]'
    }`}>
      {/* Top Map Control Bar - Single-Row Layout with AIS Status HUD */}
      <div className="z-[1000] bg-ocean-900/95 backdrop-blur-md border-b border-ocean-800 px-3 py-2 flex items-center justify-between gap-2 text-xs font-mono overflow-x-auto select-none">
        {/* Severity Filter Controls */}
        <div className="flex items-center space-x-1 bg-ocean-950/90 p-1 rounded-lg border border-ocean-800 flex-shrink-0">
          <span className="text-[11px] text-slate-400 font-semibold px-1.5 whitespace-nowrap">Filter:</span>
          {['ALL', 'EXTREME', 'MEDIUM', 'LOW'].map((lvl) => {
            const isActive = severityFilter === lvl;
            const cfg = SEVERITY_CONFIG[lvl];
            return (
              <button
                key={lvl}
                onClick={() => setSeverityFilter(lvl)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition flex items-center space-x-1 whitespace-nowrap ${
                  isActive
                    ? 'bg-cyan-500 text-black shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-ocean-850'
                }`}
              >
                {cfg && <span>{cfg.icon}</span>}
                <span>{lvl}</span>
              </button>
            );
          })}
        </div>

        {/* Live AIS or Demo Status Badge in Toolbar */}
        <div className="flex-shrink-0">
          {aisMode === 'DEMO' ? (
            <div className="flex items-center space-x-2 bg-amber-950/80 border border-amber-500/60 text-amber-300 px-2.5 py-1 rounded-lg text-xs font-mono font-bold shadow-sm">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>AIS DEMO ({Object.keys(vesselsMap).length} Vessels)</span>
            </div>
          ) : (
            <AisStatusBadge
              status={aisStatus}
              vesselCount={Object.keys(vesselsMap).length}
              lastUpdate={aisLastUpdate}
            />
          )}
        </div>

        {/* Feature Toggles & Basemap Switcher */}
        <div className="flex items-center space-x-1.5 flex-shrink-0">
          {/* Live AIS Vessels Toggle */}
          <button
            onClick={() => setShowLiveVessels((prev) => !prev)}
            title="Toggle Live AIS Maritime Vessels Layer"
            className={`px-2 py-1 rounded-lg border transition text-[11px] font-semibold flex items-center space-x-1 whitespace-nowrap ${
              showLiveVessels
                ? 'bg-blue-950/90 border-cyan-500 text-cyan-300 shadow-sm shadow-cyan-500/20'
                : 'bg-ocean-900 border-ocean-800 text-slate-400 hover:text-white'
            }`}
          >
            <Ship className="w-3.5 h-3.5 text-cyan-400" />
            <span>Vessels: {showLiveVessels ? 'ON' : 'OFF'}</span>
          </button>

          {/* Vessel Navigation Tracks Toggle */}
          {showLiveVessels && (
            <button
              onClick={() => setShowVesselTracks((prev) => !prev)}
              title="Toggle Vessel Trajectory History Tracks"
              className={`px-2 py-1 rounded-lg border transition text-[11px] font-semibold flex items-center space-x-1 whitespace-nowrap ${
                showVesselTracks
                  ? 'bg-sky-950/80 border-sky-600/70 text-sky-300 shadow-sm'
                  : 'bg-ocean-900 border-ocean-800 text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3 h-3 text-sky-400" />
              <span>Tracks: {showVesselTracks ? 'ON' : 'OFF'}</span>
            </button>
          )}

          {/* Geofences Toggle */}
          <button
            onClick={() => setShowGeofences((prev) => !prev)}
            className={`px-2 py-1 rounded-lg border transition text-[11px] font-semibold flex items-center space-x-1 whitespace-nowrap ${
              showGeofences
                ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-400'
                : 'bg-ocean-900 border-ocean-800 text-slate-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3 h-3" />
            <span>Geofence: {showGeofences ? 'ON' : 'OFF'}</span>
          </button>

          {/* Ocean Labels Toggle */}
          <button
            onClick={() => setShowOceanLabels((prev) => !prev)}
            title="Toggle Ocean and Regional Geographic Labels"
            className={`px-2 py-1 rounded-lg border transition text-[11px] font-semibold flex items-center space-x-1 whitespace-nowrap ${
              showOceanLabels
                ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 shadow-sm shadow-cyan-500/20'
                : 'bg-ocean-900 border-ocean-800 text-slate-400 hover:text-white'
            }`}
          >
            <Tag className="w-3 h-3 text-cyan-400" />
            <span>Labels</span>
          </button>

          {/* Nautical Seamarks Overlay Toggle */}
          <button
            onClick={() => setShowSeamarks((prev) => !prev)}
            title="Toggle Marine Navigation Seamarks and Buoys (OpenSeaMap)"
            className={`px-2 py-1 rounded-lg border transition text-[11px] font-semibold flex items-center space-x-1 whitespace-nowrap ${
              showSeamarks
                ? 'bg-blue-950/80 border-blue-500 text-blue-300 shadow-sm'
                : 'bg-ocean-900 border-ocean-800 text-slate-400 hover:text-white'
            }`}
          >
            <Anchor className="w-3 h-3 text-blue-400" />
            <span>Seamarks</span>
          </button>

          {/* World View Zoom Out Shortcut */}
          <button
            onClick={handleZoomWorld}
            title="Zoom Out to Whole World View"
            className="px-2 py-1 rounded-lg border border-ocean-700 bg-ocean-850 hover:bg-ocean-750 text-slate-200 hover:text-white transition text-[11px] font-semibold flex items-center space-x-1 whitespace-nowrap"
          >
            <Globe className="w-3 h-3 text-cyan-400" />
            <span>World</span>
          </button>

          {/* Basemap Switcher */}
          <div className="flex items-center space-x-1 bg-ocean-950/90 px-2 py-1 rounded-lg border border-ocean-800">
            <Layers className="w-3 h-3 text-cyan-400" />
            <select
              value={activeBasemap}
              onChange={(e) => setActiveBasemap(e.target.value)}
              className="bg-transparent text-slate-200 text-[11px] font-mono focus:outline-none cursor-pointer"
            >
              <option value="cartoDark" className="bg-ocean-900 text-slate-200">🌑 CARTO Dark Matter (Keyed)</option>
              <option value="cartoVoyager" className="bg-ocean-900 text-slate-200">🧭 CARTO Voyager (Keyed)</option>
              <option value="esriOcean" className="bg-ocean-900 text-slate-200">🌊 World Ocean Bathymetry</option>
              <option value="esriDark" className="bg-ocean-900 text-slate-200">🌌 Dark Ocean Canvas</option>
              <option value="satellite" className="bg-ocean-900 text-slate-200">🛰️ Satellite Imagery</option>
              <option value="osm" className="bg-ocean-900 text-slate-200">🗺️ Nautical Chart (OSM)</option>
            </select>
          </div>

          {/* Fit Targets Button */}
          <button
            onClick={handleFitAll}
            title="Recenter and Fit All Targets"
            className="p-1 bg-ocean-850 hover:bg-ocean-750 text-slate-200 hover:text-white rounded-lg border border-ocean-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Expand / Maximize Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen((prev) => !prev)}
            title={isFullscreen ? "Restore Size" : "Maximize Map View"}
            className="p-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-400 hover:text-white rounded-lg border border-cyan-700/60 transition"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Leaflet Map Div */}
      <div ref={mapContainerRef} className="w-full flex-1 z-0" />

      {/* Bottom Telemetry HUD */}
      <div className="absolute bottom-4 left-4 z-[1000] px-3.5 py-1.5 rounded-xl bg-ocean-950/90 border border-ocean-800/80 text-xs font-mono text-slate-300 backdrop-blur-md shadow-2xl flex items-center space-x-2.5">
        <div className="flex items-center space-x-1.5 text-cyan-400">
          <Compass className="w-3.5 h-3.5 animate-spin-slow" />
          <span className="font-bold">{telemetry.survey_zone || 'Palk Strait MoES'}</span>
        </div>
        <span className="text-slate-600">|</span>
        <span>{telemetry.towfish_latitude}°N, {telemetry.towfish_longitude}°E</span>
        <span className="text-slate-600">|</span>
        <span>Alt: {telemetry.altitude_depth_m}m</span>
        <span className="text-slate-600">|</span>
        <span className="text-emerald-400 font-semibold">{detections.length} Targets</span>
        {Object.keys(vesselsMap).length > 0 && (
          <>
            <span className="text-slate-600">|</span>
            <span className="text-cyan-400 font-semibold flex items-center space-x-1">
              <Ship className="w-3 h-3" />
              <span>{Object.keys(vesselsMap).length} AIS Vessels</span>
            </span>
          </>
        )}
      </div>

      {/* Bottom Right Severity Legend */}
      <div className="absolute bottom-4 right-4 z-[1000] px-3 py-1.5 rounded-xl bg-ocean-950/90 border border-ocean-800/80 text-[11px] font-mono backdrop-blur-md shadow-2xl space-y-0.5">
        <div className="font-bold text-slate-400 text-[10px] uppercase tracking-wider mb-0.5">
          Map Legend
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50"></span>
          <span className="text-rose-400 font-bold">EXTREME (≥100m)</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50"></span>
          <span className="text-amber-400 font-bold">MEDIUM (≥45m)</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
          <span className="text-emerald-400 font-bold">LOW (≥20m)</span>
        </div>
        <div className="flex items-center space-x-1.5 border-t border-ocean-800/60 pt-0.5 mt-0.5">
          <span className="text-xs">🚢</span>
          <span className="text-cyan-300 font-semibold">Live AIS Vessel</span>
        </div>
      </div>
    </div>
  );
}
