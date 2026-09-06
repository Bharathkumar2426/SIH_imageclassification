import React from 'react';
import { Filter, Search, RotateCcw, ShieldAlert, AlertTriangle, Layers, Globe, Clock, Radio, CheckCircle2 } from 'lucide-react';

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
  'Ship Grounding',
  'Vessel Fire / Explosion',
  'Oil Spill / Marine Pollution',
  'Distress / Search & Rescue',
  'Missing Vessel',
  'Navigation Hazard',
  'Floating Debris / Dangerous Object',
  'Tsunami / Swell Surge',
  'High Waves / Storm Surge',
  'Severe Marine Weather / Cyclone',
  'Space Debris / Satellite Impact',
  'Other',
];

const SOURCES = [
  { id: '', label: 'All Ingestion Sources' },
  { id: 'OFFICIAL', label: 'Official Sources Only' },
  { id: 'NOAA', label: 'NOAA Ocean Service' },
  { id: 'USCG', label: 'US Coast Guard NAVCEN' },
  { id: 'NGA', label: 'NGA Maritime Safety (MSI)' },
  { id: 'INCOIS', label: 'INCOIS Ocean Alerts' },
  { id: 'ICG', label: 'Indian Coast Guard' },
  { id: 'NewsAPI', label: 'NewsAPI Global Marine Wire' },
  { id: 'Mediastack', label: 'Mediastack Maritime Stream' },
  { id: 'GDELT', label: 'GDELT Global Crisis Index' },
  { id: 'GFW', label: 'Global Fishing Watch' },
];

const TIME_RANGES = [
  { id: '', label: 'All Recorded Time' },
  { id: '1h', label: 'Last 1 Hour' },
  { id: '6h', label: 'Last 6 Hours' },
  { id: '24h', label: 'Last 24 Hours' },
  { id: '7d', label: 'Last 7 Days' },
];

export function IncidentFilters({
  filters,
  onFilterChange,
  onReset,
}) {
  return (
    <div className="bg-ocean-900 border border-ocean-800 rounded-2xl p-4 shadow-xl space-y-4 font-mono text-xs text-slate-300">
      {/* Filter Header */}
      <div className="flex items-center justify-between border-b border-ocean-800 pb-2.5">
        <div className="flex items-center space-x-2 text-cyan-400 font-bold tracking-wider">
          <Filter className="w-4 h-4" />
          <span>INCIDENT FILTERS</span>
        </div>
        <button
          onClick={onReset}
          className="text-[10px] text-slate-400 hover:text-white flex items-center space-x-1 transition"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset All</span>
        </button>
      </div>

      {/* Multi-field Search Input */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
          Keyword / Vessel / MMSI / Location
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="Search vessel name, MMSI, Arabian Sea, fire..."
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="w-full bg-ocean-950 border border-ocean-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono transition"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Review & Map Status Toggle */}
      <div className="space-y-1.5">
        <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
          Operational Status
        </label>
        <div className="grid grid-cols-3 gap-1 bg-ocean-950 p-1 rounded-xl border border-ocean-800 text-[11px] text-center">
          <button
            onClick={() => onFilterChange({ ...filters, is_mapped: false, pending_review: false, active_danger_only: false })}
            className={`py-1.5 rounded-lg font-bold transition ${
              !filters.is_mapped && !filters.pending_review && !filters.active_danger_only
                ? 'bg-cyan-500 text-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Reports
          </button>
          <button
            onClick={() => onFilterChange({ ...filters, pending_review: true, is_mapped: false, active_danger_only: false })}
            className={`py-1.5 rounded-lg font-bold transition ${
              filters.pending_review
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => onFilterChange({ ...filters, is_mapped: true, pending_review: false, active_danger_only: false })}
            className={`py-1.5 rounded-lg font-bold transition ${
              filters.is_mapped
                ? 'bg-emerald-500 text-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Mapped
          </button>
        </div>
      </div>

      {/* Severity Filter Buttons */}
      <div className="space-y-1.5">
        <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
          Severity Level
        </label>
        <div className="flex flex-wrap gap-1.5">
          {SEVERITIES.map((s) => {
            const isSelected = (filters.severity || '') === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onFilterChange({ ...filters, severity: s.id })}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold border transition ${
                  isSelected
                    ? `${s.color || 'bg-cyan-500 text-black border-cyan-400'} shadow-sm`
                    : 'bg-ocean-950/80 border-ocean-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Incident Taxonomy Category Dropdown */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
          Incident Category
        </label>
        <select
          value={filters.incident_type || ''}
          onChange={(e) => onFilterChange({ ...filters, incident_type: e.target.value === 'All Types' ? '' : e.target.value })}
          className="w-full bg-ocean-950 border border-ocean-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
        >
          {INCIDENT_TYPES.map((t) => (
            <option key={t} value={t === 'All Types' ? '' : t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Ingestion Source Dropdown */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
          Source Authority
        </label>
        <select
          value={filters.source_filter || ''}
          onChange={(e) => onFilterChange({ ...filters, source_filter: e.target.value })}
          className="w-full bg-ocean-950 border border-ocean-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
        >
          {SOURCES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Time Horizon Filter */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
          Time Horizon
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {TIME_RANGES.slice(1).map((t) => {
            const isSelected = filters.time_range === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onFilterChange({ ...filters, time_range: isSelected ? '' : t.id })}
                className={`py-1 rounded-lg text-[10px] font-bold border transition ${
                  isSelected
                    ? 'bg-cyan-500 text-black border-cyan-400 shadow-sm'
                    : 'bg-ocean-950/80 border-ocean-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
