import React from 'react';
import { 
  ShieldAlert, AlertTriangle, MapPin, Compass, CheckCircle2, 
  Clock, Sparkles, Layers, Eye, Radio, ExternalLink, Flame, Droplets, HelpCircle
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

function formatUtcDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return d.toUTCString().replace('GMT', 'UTC').slice(5, 22);
  } catch {
    return dateStr;
  }
}

export function IncidentList({
  incidents = [],
  selectedIncidentId = null,
  onSelectIncident,
  onOpenConfirmation,
}) {
  if (incidents.length === 0) {
    return (
      <div className="bg-ocean-900 border border-ocean-800 rounded-2xl p-8 text-center text-slate-500 font-mono text-xs space-y-2">
        <Radio className="w-8 h-8 text-slate-600 mx-auto animate-pulse" />
        <p className="font-bold text-slate-400">No Incidents Matching Filters</p>
        <p className="text-[11px]">Adjust your filter parameters or click "Sync Sources" to refresh multi-source feeds.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[760px] overflow-y-auto pr-1">
      {incidents.map((inc) => {
        const isSelected = selectedIncidentId === inc.incident_id;
        const style = SEVERITY_CARD_STYLES[inc.severity] || SEVERITY_CARD_STYLES.MEDIUM;
        const hasCoords = inc.latitude !== null && inc.longitude !== null;
        const sourceCount = inc.sources?.length || 1;
        const isOfficial = inc.sources?.some((s) => s.source_trust_level === 'LEVEL_1_AUTHORITATIVE' || s.source_trust_level === 'LEVEL_2_GOVERNMENT');
        const eventTimeFormatted = formatUtcDate(inc.event_time);
        const reportedTimeFormatted = formatUtcDate(inc.published_at);

        return (
          <div
            key={inc.incident_id}
            onClick={() => onSelectIncident(inc)}
            className={`p-4 rounded-2xl border transition-all cursor-pointer font-mono text-xs space-y-3 ${
              isSelected
                ? 'bg-ocean-850 border-cyan-400 shadow-xl shadow-cyan-500/10 ring-2 ring-cyan-500/50'
                : `${style.bg} ${style.border} hover:bg-ocean-850/80`
            }`}
          >
            {/* Top Badges: Severity + Verification Status + Precision */}
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center space-x-1.5">
                <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${style.badge}`}>
                  {inc.severity}
                </span>

                <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                  isOfficial
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-700/60'
                    : 'bg-slate-900 text-slate-300 border-slate-700'
                }`}>
                  {isOfficial ? 'CONFIRMED OFFICIAL' : 'NEWS WIRE'}
                </span>
              </div>

              <div className="flex items-center space-x-1.5">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  inc.location_precision === 'EXACT' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                  inc.location_precision === 'APPROXIMATE' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                  'bg-slate-900 text-slate-400 border border-slate-800'
                }`}>
                  {inc.location_precision || 'UNKNOWN'}
                </span>

                {inc.is_mapped && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center space-x-1">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    <span>MAPPED</span>
                  </span>
                )}
              </div>
            </div>

            {/* Incident Title */}
            <h3 className="font-bold text-white text-sm leading-snug">
              {inc.title}
            </h3>

            {/* Location & Times (Event vs Reported) */}
            <div className="space-y-1 bg-ocean-950/70 p-2.5 rounded-xl border border-ocean-850 text-[11px]">
              <div className="flex items-center space-x-1.5 text-slate-300 truncate">
                <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="truncate font-semibold">{inc.location_text}</span>
              </div>

              <div className="grid grid-cols-1 gap-1 text-[10px] text-slate-400 pt-1 border-t border-ocean-900">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">🕒 Event:</span>
                  <span className={eventTimeFormatted ? "text-cyan-300 font-semibold" : "text-slate-500 italic"}>
                    {eventTimeFormatted ? `${eventTimeFormatted} UTC` : 'NOT PROVIDED BY SOURCE'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">📰 Reported:</span>
                  <span className="text-slate-300">
                    {reportedTimeFormatted ? `${reportedTimeFormatted} UTC` : 'Recent'}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Card Footer: Sources, Confidence, Actions */}
            <div className="pt-2 border-t border-ocean-800 flex items-center justify-between text-[11px]">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded bg-ocean-950 text-slate-300 border border-ocean-800 text-[10px] font-semibold flex items-center space-x-1">
                  <Layers className="w-3 h-3 text-cyan-400" />
                  <span>{sourceCount} {sourceCount > 1 ? 'Sources' : 'Source'}</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-bold">
                  {(inc.confidence * 100).toFixed(0)}% Conf
                </span>
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectIncident(inc);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-ocean-800 hover:bg-ocean-750 text-cyan-300 text-[10px] font-bold transition flex items-center space-x-1"
                >
                  <Eye className="w-3 h-3" />
                  <span>Details</span>
                </button>

                {!inc.is_mapped && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenConfirmation(inc);
                    }}
                    disabled={!hasCoords}
                    title={hasCoords ? "Mark incident and danger zone on map" : "Cannot mark unverified coordinates"}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold flex items-center space-x-1 text-[10px] transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  >
                    <MapPin className="w-3 h-3" />
                    <span>Mark</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
