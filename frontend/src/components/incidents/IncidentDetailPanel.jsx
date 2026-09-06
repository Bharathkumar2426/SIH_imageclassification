import React from 'react';
import { 
  ShieldAlert, AlertTriangle, ExternalLink, MapPin, Compass, 
  CheckCircle2, Clock, Ship, Eye, Radio, Sparkles, Navigation 
} from 'lucide-react';

const SEVERITY_COLORS = {
  CRITICAL: 'bg-rose-500/20 text-rose-400 border-rose-600/50',
  HIGH: 'bg-amber-500/20 text-amber-400 border-amber-600/50',
  MEDIUM: 'bg-yellow-500/20 text-yellow-400 border-yellow-600/50',
  LOW: 'bg-emerald-500/20 text-emerald-400 border-emerald-600/50',
};

export function IncidentDetailPanel({
  incident,
  onOpenConfirmation,
  onDismiss,
  onLocateOnMap,
}) {
  if (!incident) {
    return (
      <div className="bg-ocean-900 border border-ocean-800 rounded-xl p-8 text-center text-slate-500 font-mono text-xs space-y-2">
        <Radio className="w-8 h-8 text-slate-600 mx-auto animate-pulse" />
        <p className="font-bold text-slate-400">No Incident Selected</p>
        <p className="text-[11px]">Click an incident from the feed to view full intelligence breakdown and live vessel correlation.</p>
      </div>
    );
  }

  const hasCoords = incident.latitude !== null && incident.longitude !== null;
  const sevBadge = SEVERITY_COLORS[incident.severity] || SEVERITY_COLORS.MEDIUM;

  return (
    <div className="bg-ocean-900 border border-ocean-800 rounded-xl p-5 shadow-xl font-mono text-xs text-slate-300 space-y-5">
      {/* Top Header */}
      <div className="space-y-2 border-b border-ocean-800 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="text-cyan-400 font-bold text-sm">#{incident.incident_id}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${sevBadge}`}>
              {incident.severity}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-ocean-950 text-slate-300 border border-ocean-800">
              {incident.verification_status}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {incident.is_mapped ? (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 text-emerald-400 border border-emerald-600/50 text-[10px] font-bold flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>ACTIVE ON MAP</span>
              </span>
            ) : (
              <button
                onClick={() => onOpenConfirmation(incident)}
                disabled={!hasCoords}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-extrabold flex items-center space-x-1.5 shadow-md shadow-amber-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed text-[11px]"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Mark on Map</span>
              </button>
            )}
          </div>
        </div>

        <h2 className="text-base font-bold text-white leading-snug">{incident.title}</h2>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
          <div className="flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Reported: {incident.published_at ? new Date(incident.published_at).toLocaleString() : 'Recent'}</span>
          </div>
          <div className="flex items-center space-x-1 text-emerald-400 font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Confidence: {(incident.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Spatial Intelligence & Location */}
      <div className="bg-ocean-950/90 border border-ocean-800 rounded-xl p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase text-slate-400 font-bold flex items-center space-x-1">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Geospatial Position</span>
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
            incident.location_precision === 'EXACT' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
            incident.location_precision === 'APPROXIMATE' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
            'bg-rose-950 text-rose-400 border border-rose-800'
          }`}>
            {incident.location_precision} LOCATION
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-slate-500 block text-[10px]">ZONE / SECTOR</span>
            <span className="text-white font-semibold">{incident.location_text}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">GPS COORDINATES</span>
            <span className={hasCoords ? "text-cyan-300 font-bold" : "text-rose-400 italic"}>
              {hasCoords ? `${incident.latitude}°N, ${incident.longitude}°E` : "Unverified Coordinates"}
            </span>
          </div>
          {incident.affected_area_radius_km && (
            <div className="col-span-2 pt-1 border-t border-ocean-850 flex items-center justify-between">
              <span className="text-slate-400">Danger Zone Radius:</span>
              <span className="text-amber-400 font-bold">⭕ {incident.affected_area_radius_km} km Exclusion Zone</span>
            </div>
          )}
        </div>
      </div>

      {/* Description & AI Extraction Summary */}
      <div className="space-y-3">
        <div className="space-y-1">
          <h4 className="text-[10px] uppercase text-slate-400 font-bold">Official Incident Brief</h4>
          <p className="text-slate-200 leading-relaxed bg-ocean-950/60 p-3 rounded-xl border border-ocean-850">
            {incident.description}
          </p>
        </div>

        {incident.ai_reasoning_summary && (
          <div className="space-y-1">
            <h4 className="text-[10px] uppercase text-cyan-400 font-bold flex items-center space-x-1">
              <Sparkles className="w-3 h-3" />
              <span>AI Feature Extraction Rationale</span>
            </h4>
            <div className="text-[11px] text-slate-300 bg-cyan-950/30 border border-cyan-800/40 p-2.5 rounded-xl">
              {incident.ai_reasoning_summary}
            </div>
          </div>
        )}
      </div>

      {/* Multi-Source Citations & Original Links */}
      <div className="space-y-2">
        <h4 className="text-[10px] uppercase text-slate-400 font-bold">
          Source Citations ({incident.sources?.length || 1})
        </h4>
        <div className="space-y-1.5">
          {incident.sources && incident.sources.length > 0 ? (
            incident.sources.map((src, idx) => (
              <div
                key={idx}
                className="bg-ocean-950 border border-ocean-800 rounded-lg p-2.5 flex items-center justify-between text-[11px]"
              >
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <strong className="text-slate-200">{src.source_name}</strong>
                    <span className="text-[9px] text-slate-500">({src.source_trust_level.replace('LEVEL_', 'L')})</span>
                  </div>
                  {src.raw_title && <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{src.raw_title}</p>}
                </div>

                <a
                  href={src.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 rounded bg-ocean-850 hover:bg-ocean-800 text-cyan-400 hover:text-cyan-300 font-bold flex items-center space-x-1 text-[10px] shrink-0 ml-2"
                >
                  <span>View Source</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))
          ) : (
            <a
              href={incident.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:underline flex items-center space-x-1"
            >
              <span>{incident.source_name}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Safe AIS Correlation: Nearby Vessels */}
      {incident.nearby_vessels && incident.nearby_vessels.length > 0 && (
        <div className="space-y-2 border-t border-ocean-800 pt-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] uppercase text-rose-400 font-bold flex items-center space-x-1">
              <Ship className="w-3.5 h-3.5" />
              <span>Nearby Live Vessels Risk Correlation ({incident.nearby_vessels.length})</span>
            </h4>
            <span className="text-[9px] text-slate-400">Live AISStream Feed</span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {incident.nearby_vessels.map((v) => (
              <div
                key={v.vessel_mmsi}
                className="bg-ocean-950 border border-ocean-800/80 rounded-lg p-2 flex items-center justify-between text-[11px]"
              >
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className={`w-2 h-2 rounded-full ${
                      v.risk_level === 'DANGER' ? 'bg-rose-500 animate-ping' :
                      v.risk_level === 'WARNING' ? 'bg-amber-400' : 'bg-cyan-400'
                    }`} />
                    <strong className="text-white">{v.ship_name}</strong>
                    <span className="text-[9px] text-slate-400">MMSI: {v.vessel_mmsi}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center space-x-2 mt-0.5">
                    <span>Dist: <strong className="text-slate-200">{v.distance_km} km</strong></span>
                    <span>Speed: {v.speed_knots} kn</span>
                    {v.eta_minutes !== null && (
                      <span className="text-amber-400">ETA: {v.eta_minutes} min</span>
                    )}
                  </div>
                </div>

                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  v.risk_level === 'DANGER' ? 'bg-rose-950 text-rose-300 border border-rose-600' :
                  v.risk_level === 'WARNING' ? 'bg-amber-950 text-amber-300 border border-amber-600' :
                  'bg-cyan-950 text-cyan-300 border border-cyan-800'
                }`}>
                  {v.risk_level}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
