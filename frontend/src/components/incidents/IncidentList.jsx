import React from 'react';
import { 
  ShieldAlert, AlertTriangle, MapPin, Compass, CheckCircle2, 
  Clock, Sparkles, Layers, Eye, Radio, ExternalLink 
} from 'lucide-react';

const SEVERITY_CARD_STYLES = {
  CRITICAL: {
    border: 'border-rose-600/60 hover:border-rose-500',
    bg: 'bg-rose-950/20 hover:bg-rose-950/30',
    badge: 'bg-rose-950 text-rose-300 border-rose-600/50',
    dot: 'bg-rose-500 animate-ping',
  },
  HIGH: {
    border: 'border-amber-600/60 hover:border-amber-500',
    bg: 'bg-amber-950/20 hover:bg-amber-950/30',
    badge: 'bg-amber-950 text-amber-300 border-amber-600/50',
    dot: 'bg-amber-500',
  },
  MEDIUM: {
    border: 'border-yellow-600/60 hover:border-yellow-500',
    bg: 'bg-yellow-950/20 hover:bg-yellow-950/30',
    badge: 'bg-yellow-950 text-yellow-300 border-yellow-600/50',
    dot: 'bg-yellow-500',
  },
  LOW: {
    border: 'border-emerald-600/60 hover:border-emerald-500',
    bg: 'bg-emerald-950/20 hover:bg-emerald-950/30',
    badge: 'bg-emerald-950 text-emerald-300 border-emerald-600/50',
    dot: 'bg-emerald-500',
  },
};

export function IncidentList({
  incidents = [],
  selectedIncidentId = null,
  onSelectIncident,
  onOpenConfirmation,
}) {
  if (incidents.length === 0) {
    return (
      <div className="bg-ocean-900 border border-ocean-800 rounded-xl p-8 text-center text-slate-500 font-mono text-xs space-y-2">
        <Radio className="w-8 h-8 text-slate-600 mx-auto" />
        <p className="font-bold text-slate-400">No Incidents Found</p>
        <p className="text-[11px]">Adjust your filter criteria or click "Refresh Ingestion" to fetch latest maritime reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
      {incidents.map((inc) => {
        const isSelected = selectedIncidentId === inc.incident_id;
        const style = SEVERITY_CARD_STYLES[inc.severity] || SEVERITY_CARD_STYLES.MEDIUM;
        const hasCoords = inc.latitude !== null && inc.longitude !== null;
        const sourceCount = inc.sources?.length || 1;

        return (
          <div
            key={inc.incident_id}
            onClick={() => onSelectIncident(inc)}
            className={`p-4 rounded-xl border transition-all cursor-pointer font-mono text-xs space-y-2.5 ${
              isSelected
                ? 'bg-ocean-850 border-cyan-500 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/50'
                : `${style.bg} ${style.border} hover:bg-ocean-850/70`
            }`}
          >
            {/* Header: ID, Severity, Mapped status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                <strong className="text-cyan-400 font-bold tracking-wide">#{inc.incident_id}</strong>
                <span className="text-[10px] text-slate-400">({inc.incident_type})</span>
              </div>

              <div className="flex items-center space-x-1.5">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${style.badge}`}>
                  {inc.severity}
                </span>

                {inc.is_mapped && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center space-x-1">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    <span>MAPPED</span>
                  </span>
                )}
              </div>
            </div>

            {/* Title */}
            <h3 className="font-bold text-slate-100 text-sm leading-snug line-clamp-2">
              {inc.title}
            </h3>

            {/* Location & Time info */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
              <div className="flex items-center space-x-1 truncate">
                <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">{inc.location_text}</span>
              </div>
              <div className="flex items-center space-x-1 justify-end">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{inc.published_at ? new Date(inc.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}</span>
              </div>
            </div>

            {/* Bottom Bar: Multi-source badge, Confidence, Action */}
            <div className="pt-2 border-t border-ocean-800/80 flex items-center justify-between text-[11px]">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded bg-ocean-950 text-slate-300 border border-ocean-800 text-[10px] font-semibold flex items-center space-x-1">
                  <Layers className="w-3 h-3 text-cyan-400" />
                  <span>{sourceCount} {sourceCount > 1 ? 'Sources' : 'Source'}</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold">
                  {(inc.confidence * 100).toFixed(0)}% Conf
                </span>
              </div>

              {!inc.is_mapped && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenConfirmation(inc);
                  }}
                  disabled={!hasCoords}
                  title={hasCoords ? "Mark incident and danger zone on map" : "Cannot mark unverified coordinates"}
                  className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-extrabold flex items-center space-x-1 text-[10px] transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <MapPin className="w-3 h-3" />
                  <span>Mark on Map</span>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
