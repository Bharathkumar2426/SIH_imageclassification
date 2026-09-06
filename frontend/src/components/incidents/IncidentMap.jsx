import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  Layers, ShieldAlert, AlertTriangle, Compass, MapPin, 
  ZoomIn, ZoomOut, RotateCcw, Globe, Ship, Eye, Radio, ExternalLink 
} from 'lucide-react';

const CARTO_KEY = 'cb1_2yon_1_9ffb76d43983d1d23dee75e8';

const BASEMAPS = {
  cartoDark: {
    name: '🌑 CARTO Dark Matter',
    url: `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${CARTO_KEY}`,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 19,
  },
  esriOcean: {
    name: '🌊 World Ocean Bathymetry',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; GEBCO, NOAA',
    maxZoom: 13,
  },
  osm: {
    name: '🗺️ Nautical Chart (OSM)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
};

const SEVERITY_COLORS = {
  CRITICAL: '#ef4444',
  HIGH: '#f59e0b',
  MEDIUM: '#eab308',
  LOW: '#10b981',
};

export function IncidentMap({
  incidents = [],
  selectedIncident = null,
  onSelectIncident,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);

  // Layer Groups
  const incidentsLayerRef = useRef(null);
  const dangerZonesLayerRef = useRef(null);
  const nearbyVesselsLayerRef = useRef(null);

  const [activeBasemap, setActiveBasemap] = useState('cartoDark');
  const [showDangerZones, setShowDangerZones] = useState(true);
  const [showVessels, setShowVessels] = useState(true);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [12.0, 78.0],
      zoom: 5,
      minZoom: 2,
      maxZoom: 19,
      zoomControl: false,
    });

    const bm = BASEMAPS[activeBasemap] || BASEMAPS.cartoDark;
    const tileLayer = L.tileLayer(bm.url, {
      attribution: bm.attribution,
      maxZoom: bm.maxZoom,
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Create Layer Groups
    dangerZonesLayerRef.current = L.layerGroup().addTo(map);
    incidentsLayerRef.current = L.layerGroup().addTo(map);
    nearbyVesselsLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Basemap
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const map = mapInstanceRef.current;
    const bm = BASEMAPS[activeBasemap] || BASEMAPS.cartoDark;
    map.removeLayer(tileLayerRef.current);
    tileLayerRef.current = L.tileLayer(bm.url, {
      attribution: bm.attribution,
      maxZoom: bm.maxZoom,
    }).addTo(map);
  }, [activeBasemap]);

  // Render Mapped Incidents & Danger Zones
  useEffect(() => {
    if (!mapInstanceRef.current || !incidentsLayerRef.current || !dangerZonesLayerRef.current) return;

    incidentsLayerRef.current.clearLayers();
    dangerZonesLayerRef.current.clearLayers();

    const mappedIncidents = incidents.filter(
      (inc) => inc.is_mapped && inc.latitude !== null && inc.longitude !== null
    );

    mappedIncidents.forEach((inc) => {
      const color = SEVERITY_COLORS[inc.severity] || '#f59e0b';
      const isSelected = selectedIncident?.incident_id === inc.incident_id;

      // 1. Plot Danger Zone Radius Circle
      if (showDangerZones && inc.affected_area_radius_km) {
        const radiusMeters = inc.affected_area_radius_km * 1000.0;
        const circle = L.circle([inc.latitude, inc.longitude], {
          radius: radiusMeters,
          color: color,
          weight: isSelected ? 2.5 : 1.5,
          dashArray: '6, 6',
          fillColor: color,
          fillOpacity: isSelected ? 0.20 : 0.12,
        });

        circle.bindTooltip(
          `<strong>Danger Zone:</strong> ${inc.affected_area_radius_km} km radius (${inc.title})`,
          { sticky: true, className: 'leaflet-tooltip-dark' }
        );

        dangerZonesLayerRef.current.addLayer(circle);
      }

      // 2. Plot Incident Marker Icon
      const markerHtml = `
        <div style="
          width: ${isSelected ? '36px' : '28px'};
          height: ${isSelected ? '36px' : '28px'};
          border-radius: 50%;
          background: ${color};
          border: 2.5px solid #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 ${isSelected ? '15px' : '8px'} ${color};
          cursor: pointer;
          transition: all 0.2s;
        ">
          <span style="font-size: ${isSelected ? '16px' : '13px'}; color: #000; font-weight: bold;">⚠️</span>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-incident-marker',
        iconSize: [isSelected ? 36 : 28, isSelected ? 36 : 28],
        iconAnchor: [isSelected ? 18 : 14, isSelected ? 18 : 14],
      });

      const marker = L.marker([inc.latitude, inc.longitude], { icon: customIcon });

      const popupContent = `
        <div style="font-family: monospace; font-size: 11px; color: #f1f5f9; min-width: 240px; line-height: 1.4;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <strong style="color: #38bdf8;">#${inc.incident_id}</strong>
            <span style="background: ${color}33; color: ${color}; border: 1px solid ${color}88; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px;">
              ${inc.severity}
            </span>
          </div>
          <strong style="font-size: 12px; color: #fff; display: block; margin-bottom: 6px;">${inc.title}</strong>
          <div style="color: #94a3b8; margin-bottom: 4px;"><strong>Type:</strong> ${inc.incident_type}</div>
          <div style="color: #94a3b8; margin-bottom: 4px;"><strong>Location:</strong> ${inc.location_text} (${inc.latitude.toFixed(4)}°N, ${inc.longitude.toFixed(4)}°E)</div>
          <div style="color: #94a3b8; margin-bottom: 4px;"><strong>Danger Radius:</strong> ${inc.affected_area_radius_km || 5} km</div>
          <div style="color: #34d399; margin-bottom: 6px;"><strong>Sources:</strong> ${inc.sources?.length || 1} verified citations</div>
          <div style="font-size: 9px; color: #64748b; border-top: 1px solid #334155; padding-top: 4px;">
            Multi-Source Maritime Intelligence • Operator Confirmed
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, { className: 'leaflet-popup-dark' });
      marker.on('click', () => {
        if (onSelectIncident) onSelectIncident(inc);
      });

      incidentsLayerRef.current.addLayer(marker);
    });
  }, [incidents, selectedIncident, showDangerZones]);

  // Render Nearby Live AIS Vessels
  useEffect(() => {
    if (!mapInstanceRef.current || !nearbyVesselsLayerRef.current) return;
    nearbyVesselsLayerRef.current.clearLayers();

    if (!showVessels || !selectedIncident || !selectedIncident.nearby_vessels) return;

    selectedIncident.nearby_vessels.forEach((v) => {
      const vIconHtml = `
        <div style="
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #0284c7;
          border: 1.5px solid #38bdf8;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 6px #38bdf8;
        ">
          <span style="font-size: 11px;">🚢</span>
        </div>
      `;

      const vIcon = L.divIcon({
        html: vIconHtml,
        className: 'custom-vessel-marker',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const vMarker = L.marker([v.latitude, v.longitude], { icon: vIcon });
      vMarker.bindTooltip(
        `<strong>${v.ship_name}</strong> (${v.speed_knots} kn) • Dist: ${v.distance_km} km to hazard`,
        { sticky: true }
      );

      nearbyVesselsLayerRef.current.addLayer(vMarker);
    });
  }, [selectedIncident, showVessels]);

  // Center on Selected Incident
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedIncident) return;
    if (selectedIncident.latitude !== null && selectedIncident.longitude !== null) {
      mapInstanceRef.current.flyTo([selectedIncident.latitude, selectedIncident.longitude], 8, {
        duration: 1.2,
      });
    }
  }, [selectedIncident?.incident_id]);

  return (
    <div className="relative w-full h-[620px] rounded-2xl overflow-hidden border border-ocean-800 shadow-2xl bg-ocean-950 font-mono">
      {/* Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Top Map HUD Bar */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-2 bg-ocean-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-ocean-750 shadow-lg text-xs">
        <div className="flex items-center space-x-2 pr-2 border-r border-ocean-750">
          <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
          <strong className="text-white">INCIDENT INTELLIGENCE MAP</strong>
        </div>

        {/* Layer Visibility Toggles */}
        <div className="flex items-center space-x-2 text-[11px]">
          <label className="flex items-center space-x-1 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={showDangerZones}
              onChange={(e) => setShowDangerZones(e.target.checked)}
              className="accent-amber-500 rounded"
            />
            <span>Danger Zones</span>
          </label>

          <label className="flex items-center space-x-1 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={showVessels}
              onChange={(e) => setShowVessels(e.target.checked)}
              className="accent-cyan-500 rounded"
            />
            <span>Live AIS Correlation</span>
          </label>
        </div>
      </div>

      {/* Basemap Switcher */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-ocean-900/90 backdrop-blur-md p-1 rounded-xl border border-ocean-750 shadow-lg flex items-center space-x-1 text-xs">
        {Object.entries(BASEMAPS).map(([key, bm]) => (
          <button
            key={key}
            onClick={() => setActiveBasemap(key)}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
              activeBasemap === key
                ? 'bg-cyan-500 text-black shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-ocean-800'
            }`}
          >
            {bm.name.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Map Zoom Controls */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col space-y-1.5 bg-ocean-900/90 backdrop-blur-md p-1.5 rounded-xl border border-ocean-750 shadow-lg">
        <button
          onClick={() => mapInstanceRef.current?.zoomIn()}
          className="p-1.5 rounded-lg bg-ocean-800 hover:bg-ocean-750 text-slate-200 hover:text-white transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => mapInstanceRef.current?.zoomOut()}
          className="p-1.5 rounded-lg bg-ocean-800 hover:bg-ocean-750 text-slate-200 hover:text-white transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => mapInstanceRef.current?.flyTo([12.0, 78.0], 5)}
          className="p-1.5 rounded-lg bg-ocean-800 hover:bg-ocean-750 text-cyan-400 hover:text-cyan-300 transition"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
