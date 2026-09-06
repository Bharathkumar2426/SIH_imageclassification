import React from 'react';
import { ShieldAlert, AlertTriangle, Ship, Compass, ArrowRight, X, Radio, BellRing, Navigation } from 'lucide-react';

export function IncidentAlarmBanner({
  alarms = [],
  onDismissAlarm,
  onClearAll,
  onLocateIncident,
}) {
  if (!alarms || alarms.length === 0) return null;

  // Filter for high/critical breach alarms first
  const criticalAlarms = alarms.filter(
    (a) => a.alarm_level === 'LEVEL_3_ENTERED_DANGER_ZONE' || a.alarm_level === 'LEVEL_4_CRITICAL_HAZARD_BREACH'
  );
  const displayAlarms = criticalAlarms.length > 0 ? criticalAlarms : alarms;
  const topAlarm = displayAlarms[0];

  const isCritical = topAlarm.alarm_level.includes('LEVEL_3') || topAlarm.alarm_level.includes('LEVEL_4');
  const isDemo = topAlarm.data_feed_type === 'DEMO';

  return (
    <div className={`rounded-2xl p-4 border shadow-2xl font-mono text-xs transition-all animate-in fade-in duration-200 ${
      isCritical
        ? 'bg-rose-950/90 border-rose-500/80 shadow-rose-950/60 ring-2 ring-rose-500/50'
        : 'bg-amber-950/90 border-amber-500/80 shadow-amber-950/60 ring-2 ring-amber-500/50'
    }`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Alarm Status & Icon */}
        <div className="flex items-center space-x-3.5">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg ${
            isCritical
              ? 'bg-rose-600 shadow-rose-600/40 animate-bounce'
              : 'bg-amber-600 shadow-amber-600/40'
          }`}>
            <BellRing className="w-6 h-6 animate-pulse" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                isDemo
                  ? 'bg-amber-900 text-amber-300 border border-amber-500'
                  : 'bg-rose-900 text-rose-200 border border-rose-400'
              }`}>
                {isDemo ? '⚠️ DEMO AIS ALERT' : '🚨 LIVE AIS MARITIME PROXIMITY ALERT'}
              </span>

              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-black/40 text-white border border-white/20">
                {topAlarm.alarm_level.replace(/_/g, ' ')}
              </span>

              {alarms.length > 1 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-black">
                  +{alarms.length - 1} more active
                </span>
              )}
            </div>

            <h3 className="text-sm sm:text-base font-extrabold text-white tracking-wide">
              Vessel <span className="text-cyan-300 underline font-black">{topAlarm.vessel_name}</span> (MMSI: {topAlarm.vessel_mmsi}) {
                isCritical ? 'ENTERED ACTIVE DANGER ZONE' : 'IS APPROACHING ACTIVE DANGER ZONE'
              }
            </h3>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2">
          {topAlarm.incident_id && onLocateIncident && (
            <button
              onClick={() => onLocateIncident(topAlarm.incident_id)}
              className="px-3.5 py-1.5 rounded-xl bg-white text-black font-extrabold flex items-center space-x-1.5 text-xs hover:bg-slate-200 transition shadow-md"
            >
              <Navigation className="w-3.5 h-3.5 text-rose-600" />
              <span>Locate on Map</span>
            </button>
          )}

          {onDismissAlarm && (
            <button
              onClick={() => onDismissAlarm(topAlarm.alarm_id)}
              className="px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 text-slate-300 hover:text-white border border-white/20 text-xs font-bold transition"
            >
              Acknowledge
            </button>
          )}

          {alarms.length > 1 && onClearAll && (
            <button
              onClick={onClearAll}
              className="px-2.5 py-1.5 rounded-xl bg-black/30 hover:bg-black/50 text-slate-400 hover:text-white text-[11px] transition"
              title="Clear all active alarms"
            >
              Clear All ({alarms.length})
            </button>
          )}
        </div>
      </div>

      {/* Alarm Details Telemetry Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3 pt-2.5 border-t border-white/15 text-[11px] text-slate-200">
        <div>
          <span className="text-slate-400 text-[10px] block uppercase">Hazard Event</span>
          <span className="font-bold text-white truncate block">{topAlarm.incident_title}</span>
        </div>
        <div>
          <span className="text-slate-400 text-[10px] block uppercase">Distance to Boundary</span>
          <span className="font-extrabold text-amber-300">{topAlarm.distance_km} km</span>
        </div>
        <div>
          <span className="text-slate-400 text-[10px] block uppercase">Vessel Telemetry</span>
          <span>{topAlarm.speed_knots} kn @ {topAlarm.course_deg}°</span>
        </div>
        <div>
          <span className="text-slate-400 text-[10px] block uppercase">Zone Exclusion</span>
          <span className="text-rose-300 font-bold">{topAlarm.danger_radius_km} km radius</span>
        </div>
        <div>
          <span className="text-slate-400 text-[10px] block uppercase">Triggered At</span>
          <span className="text-slate-300 font-mono">
            {topAlarm.triggered_at ? new Date(topAlarm.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now'} UTC
          </span>
        </div>
      </div>
    </div>
  );
}
