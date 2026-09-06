import React, { useState, useEffect } from 'react';
import { 
  Radio, ShieldAlert, AlertTriangle, RefreshCw, Layers, Globe, 
  MapPin, CheckCircle2, Sparkles, Filter, Database, ArrowLeft 
} from 'lucide-react';
import { IncidentFilters } from '../components/incidents/IncidentFilters';
import { IncidentList } from '../components/incidents/IncidentList';
import { IncidentDetailPanel } from '../components/incidents/IncidentDetailPanel';
import { IncidentMap } from '../components/incidents/IncidentMap';
import { IncidentConfirmationModal } from '../components/incidents/IncidentConfirmationModal';
import { 
  getIncidents, getIncidentMetrics, getSourcesStatus, 
  confirmMapIncident, dismissIncident, triggerManualRefresh, getIncidentById 
} from '../services/incidentApi';

export function MaritimeIncidentPage({ onSwitchToSonar }) {
  const [incidents, setIncidents] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [sourcesStatus, setSourcesStatus] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmingIncident, setConfirmingIncident] = useState(null);
  const [isProcessingConfirmation, setIsProcessingConfirmation] = useState(false);

  const [filters, setFilters] = useState({
    severity: '',
    incident_type: '',
    is_mapped: false,
    pending_review: false,
    search: '',
  });

  // Load Incidents and Metrics
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [incList, met, src] = await Promise.all([
        getIncidents(filters),
        getIncidentMetrics(),
        getSourcesStatus(),
      ]);
      setIncidents(incList);
      setMetrics(met);
      setSourcesStatus(src);

      // Select first critical or first incident if none selected
      if (!selectedIncident && incList.length > 0) {
        setSelectedIncident(incList[0]);
      }
    } catch (err) {
      console.error('Failed to load incident intelligence data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  // Select Incident and fetch full dossier with AIS correlation
  const handleSelectIncident = async (inc) => {
    try {
      const fullDossier = await getIncidentById(inc.incident_id);
      setSelectedIncident(fullDossier);
    } catch {
      setSelectedIncident(inc);
    }
  };

  // Manual Ingestion Sync Trigger
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await triggerManualRefresh();
      await loadData();
    } catch (err) {
      console.error('Failed to trigger refresh:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Human Operator Confirmation Handler
  const handleConfirmMapping = async (incidentId, customRadiusKm, notes) => {
    try {
      setIsProcessingConfirmation(true);
      const updated = await confirmMapIncident(incidentId, customRadiusKm, notes);
      setConfirmingIncident(null);
      // Reload incidents and update selected incident
      await loadData();
      if (updated) setSelectedIncident(updated);
    } catch (err) {
      console.error('Failed to confirm incident mapping:', err);
    } finally {
      setIsProcessingConfirmation(false);
    }
  };

  // Dismiss Incident Handler
  const handleDismiss = async (incidentId) => {
    try {
      await dismissIncident(incidentId);
      await loadData();
    } catch (err) {
      console.error('Failed to dismiss incident:', err);
    }
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Top Header & Executive Telemetry HUD */}
      <div className="bg-ocean-900 border border-ocean-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-amber-600 flex items-center justify-center shadow-lg shadow-rose-500/20 text-white">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  AI MARITIME INCIDENT INTELLIGENCE & DANGER-ZONE RISK MAPPING
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-700/60 flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Continuous Multi-Source Ingestion</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                NOAA • USCG • NGA MSI • INCOIS • Indian Coast Guard • NewsAPI • Mediastack • GDELT • Global Fishing Watch
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-3.5 py-2 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-600/60 text-xs font-bold flex items-center space-x-2 transition shadow-md"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing Sources...' : 'Sync Sources'}</span>
            </button>

            {onSwitchToSonar && (
              <button
                onClick={onSwitchToSonar}
                className="px-3.5 py-2 rounded-xl bg-ocean-850 hover:bg-ocean-800 text-slate-200 border border-ocean-700 text-xs font-bold flex items-center space-x-2 transition"
              >
                <ArrowLeft className="w-4 h-4 text-cyan-400" />
                <span>Sonar View</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick KPI Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-ocean-800">
          <div className="bg-ocean-950/80 border border-ocean-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase">Total Reports</span>
              <p className="text-xl font-bold text-white">{metrics?.total_incidents || incidents.length}</p>
            </div>
            <Globe className="w-5 h-5 text-cyan-400 opacity-60" />
          </div>

          <div className="bg-ocean-950/80 border border-ocean-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase">Critical Hazards</span>
              <p className="text-xl font-bold text-rose-400">{metrics?.critical_count || 0}</p>
            </div>
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
          </div>

          <div className="bg-ocean-950/80 border border-ocean-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase">High-Risk</span>
              <p className="text-xl font-bold text-amber-400">{metrics?.high_count || 0}</p>
            </div>
            <span className="w-3 h-3 rounded-full bg-amber-500" />
          </div>

          <div className="bg-ocean-950/80 border border-ocean-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase">Pending Review</span>
              <p className="text-xl font-bold text-yellow-400">{metrics?.pending_confirmation_count || 0}</p>
            </div>
            <AlertTriangle className="w-5 h-5 text-yellow-400 opacity-60" />
          </div>

          <div className="bg-ocean-950/80 border border-ocean-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase">Active on Map</span>
              <p className="text-xl font-bold text-emerald-400">{metrics?.mapped_count || 0}</p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-400 opacity-60" />
          </div>
        </div>
      </div>

      {/* Main 3-Column Command Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Intelligence Filters (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <IncidentFilters
            filters={filters}
            onFilterChange={setFilters}
            onReset={() => setFilters({ severity: '', incident_type: '', is_mapped: false, pending_review: false, search: '' })}
          />

          {/* Source Connectivity Monitor */}
          <div className="bg-ocean-900 border border-ocean-800 rounded-xl p-4 space-y-2.5 shadow-lg text-xs">
            <div className="flex items-center justify-between border-b border-ocean-800 pb-2">
              <strong className="text-cyan-400 text-[11px] uppercase tracking-wider">Source Status ({sourcesStatus.length})</strong>
              <span className="text-[10px] text-emerald-400 font-bold">● Active</span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {sourcesStatus.map((s) => (
                <div key={s.source_id} className="flex items-center justify-between text-[10px] text-slate-300">
                  <span className="truncate pr-2">{s.source_name.split('(')[0]}</span>
                  <span className={`font-bold shrink-0 ${s.status === 'ONLINE' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center Column: Incident Feed Cards (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-bold text-slate-300 uppercase">Incident Feed ({incidents.length})</span>
            <span className="text-[10px] text-slate-500">Sorted by Priority</span>
          </div>

          <IncidentList
            incidents={incidents}
            selectedIncidentId={selectedIncident?.incident_id}
            onSelectIncident={handleSelectIncident}
            onOpenConfirmation={setConfirmingIncident}
          />
        </div>

        {/* Right Column: Incident Map & Selected Dossier (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Incident Intelligence Map */}
          <IncidentMap
            incidents={incidents}
            selectedIncident={selectedIncident}
            onSelectIncident={handleSelectIncident}
          />

          {/* Selected Incident Detail Dossier */}
          <IncidentDetailPanel
            incident={selectedIncident}
            onOpenConfirmation={setConfirmingIncident}
            onDismiss={handleDismiss}
          />
        </div>
      </div>

      {/* Human Operator Confirmation Modal */}
      {confirmingIncident && (
        <IncidentConfirmationModal
          incident={confirmingIncident}
          isProcessing={isProcessingConfirmation}
          onConfirm={handleConfirmMapping}
          onClose={() => setConfirmingIncident(null)}
        />
      )}
    </div>
  );
}
