import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, MapPin, CheckCircle2, X, Compass, Radio } from 'lucide-react';

export function IncidentConfirmationModal({
  incident,
  onConfirm,
  onClose,
  isProcessing = false,
}) {
  if (!incident) return null;

  const [dangerRadius, setDangerRadius] = useState(incident.affected_area_radius_km || 5.0);
  const [operatorNotes, setOperatorNotes] = useState('');

  const hasCoords = incident.latitude !== null && incident.longitude !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono">
      <div className="bg-ocean-900 border border-amber-500/60 rounded-2xl max-w-xl w-full p-6 shadow-2xl shadow-amber-950/40 space-y-5 text-xs text-slate-300 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-ocean-800 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                Human-in-the-Loop Confirmation
              </span>
              <h3 className="text-base font-bold text-white leading-tight">
                Confirm Maritime Incident Mapping
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-ocean-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Notice */}
        <div className="bg-amber-950/50 border border-amber-500/40 rounded-xl p-3 text-amber-200 text-[11px] space-y-1">
          <p className="font-bold flex items-center space-x-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Operational Safety Protocol</span>
          </p>
          <p className="text-slate-400">
            Plotting this incident will generate an active navigation hazard marker and dynamic danger-zone perimeter on the Incident Intelligence Map for all operators.
          </p>
        </div>

        {/* Incident Summary Card */}
        <div className="bg-ocean-950/80 border border-ocean-800 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-amber-400 font-bold">#{incident.incident_id}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-600/50">
              {incident.severity}
            </span>
          </div>
          <p className="font-bold text-slate-100 text-sm">{incident.title}</p>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1 border-t border-ocean-850">
            <div>
              <span className="block text-[10px] text-slate-500">TYPE</span>
              <span className="text-slate-200 font-semibold">{incident.incident_type}</span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500">LOCATION</span>
              <span className="text-cyan-400 font-semibold">{incident.location_text}</span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500">COORDINATES</span>
              <span className={hasCoords ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                {hasCoords ? `${incident.latitude}°N, ${incident.longitude}°E` : "UNVERIFIED (Cannot Map)"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500">CONFIDENCE</span>
              <span className="text-slate-200 font-semibold">{(incident.confidence * 100).toFixed(0)}% (Multi-source)</span>
            </div>
          </div>
        </div>

        {/* Danger Zone Radius Customizer */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-200 uppercase">
              Danger Exclusion Radius: <span className="text-amber-400">{dangerRadius} km</span>
            </label>
            <span className="text-[10px] text-slate-400">Recommended: {incident.affected_area_radius_km || 5} km</span>
          </div>
          <input
            type="range"
            min="1"
            max="30"
            step="0.5"
            value={dangerRadius}
            onChange={(e) => setDangerRadius(parseFloat(e.target.value))}
            className="w-full accent-amber-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-2 border-t border-ocean-800">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl bg-ocean-800 hover:bg-ocean-750 text-slate-300 font-bold transition"
          >
            Cancel
          </button>

          <button
            onClick={() => onConfirm(incident.incident_id, dangerRadius, operatorNotes)}
            disabled={isProcessing || !hasCoords}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-extrabold flex items-center space-x-2 shadow-lg shadow-amber-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MapPin className="w-4 h-4" />
            <span>{isProcessing ? 'Marking Map...' : 'Confirm & Mark on Map'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
