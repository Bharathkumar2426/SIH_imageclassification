import React from 'react';
import { Filter, Search, RotateCcw, ShieldAlert, AlertTriangle, Layers, Globe } from 'lucide-react';

const SEVERITIES = [
  { id: '', label: 'All Severities' },
  { id: 'CRITICAL', label: 'Critical', color: 'text-rose-400 bg-rose-950/40 border-rose-600/60' },
  { id: 'HIGH', label: 'High', color: 'text-amber-400 bg-amber-950/40 border-amber-600/60' },
  { id: 'MEDIUM', label: 'Medium', color: 'text-yellow-400 bg-yellow-950/40 border-yellow-600/60' },
  { id: 'LOW', label: 'Low', color: 'text-emerald-400 bg-emerald-950/40 border-emerald-600/60' },
];

const INCIDENT_TYPES = [
  'All Types',
  'Collision',
  'Vessel Sinking',
  'Vessel Fire / Explosion',
  'Oil Spill / Marine Pollution',
  'Ship Grounding',
  'Distress / Search & Rescue',
  'Navigation Hazard',
  'Severe Marine Weather / Cyclone',
  'Tsunami / Swell Surge',
  'Floating Debris / Dangerous Object',
];

export function IncidentFilters({
  filters,
  onFilterChange,
  onReset,
}) {
  return (
    <div className="bg-ocean-900 border border-ocean-800 rounded-xl p-4 shadow-lg space-y-4 font-mono text-xs text-slate-300">
      <div className="flex items-center justify-between border-b border-ocean-800 pb-2.5">
        <div className="flex items-center space-x-2 text-cyan-400 font-bold tracking-wider">
          <Filter className="w-4 h-4" />
          <span>INTELLIGENCE FILTERS</span>
        </div>
        <button
          onClick={onReset}
          className="text-[10px] text-slate-400 hover:text-white flex items-center space-x-1"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* Keyword Search */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase text-slate-400 font-semibold">Search Reports</label>
        <div className="relative">
          <input
            type="text"
            placeholder="Search keywords, vessel, sea..."
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="w-full bg-ocean-950 border border-ocean-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Mapping & Operator Status Toggle */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase text-slate-400 font-semibold">Review Status</label>
        <div className="grid grid-cols-3 gap-1 bg-ocean-950 p-1 rounded-lg border border-ocean-800 text-[11px] text-center">
          <button
            onClick={() => onFilterChange({ ...filters, is_mapped: false, pending_review: false })}
            className={`py-1 rounded font-bold transition ${
              !filters.is_mapped && !filters.pending_review
                ? 'bg-cyan-500 text-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => onFilterChange({ ...filters, pending_review: true, is_mapped: false })}
            className={`py-1 rounded font-bold transition ${
              filters.pending_review
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => onFilterChange({ ...filters, is_mapped: true, pending_review: false })}
            className={`py-1 rounded font-bold transition ${
              filters.is_mapped
                ? 'bg-emerald-500 text-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Mapped
          </button>
        </div>
      </div>

      {/* Severity Filter */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase text-slate-400 font-semibold">Severity Priority</label>
        <div className="flex flex-wrap gap-1.5">
          {SEVERITIES.map((s) => {
            const isSelected = (filters.severity || '') === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onFilterChange({ ...filters, severity: s.id })}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition ${
                  isSelected
                    ? `${s.color || 'bg-cyan-500 text-black border-cyan-400'} shadow-sm`
                    : 'bg-ocean-950/70 border-ocean-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Incident Taxonomy Dropdown */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase text-slate-400 font-semibold">Incident Taxonomy</label>
        <select
          value={filters.incident_type || ''}
          onChange={(e) => onFilterChange({ ...filters, incident_type: e.target.value === 'All Types' ? '' : e.target.value })}
          className="w-full bg-ocean-950 border border-ocean-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
        >
          {INCIDENT_TYPES.map((t) => (
            <option key={t} value={t === 'All Types' ? '' : t}>
              {t}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
