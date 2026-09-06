import React, { useState, useEffect } from 'react';
import { 
  Compass, MapPin, ShieldAlert, AlertTriangle, 
  ArrowLeft, Crosshair, Radio, RefreshCw, Layers, Info, CheckCircle2, Sparkles, Ship
} from 'lucide-react';
import { SonarMap } from '../components/SonarMap';
import { VesselAlertsBanner } from '../components/VesselAlertsBanner';
import { AisModeSelector } from '../components/AisModeSelector';
import { AisDemoControls } from '../components/AisDemoControls';
import { enrichGeospatial, getFleetGeospatial } from '../services/api';
import { triggerTestAlert, clearTestAlerts, getAisStatus } from '../services/aisApi';
import { 
  playDemo, pauseDemo, resetDemo, setDemoSpeed, getDemoStatus 
} from '../services/aisDemoApi';

const SEVERITY_BADGES = {
  EXTREME: {
    bg: 'bg-rose-500/15',
    border: 'border-rose-500/40',
    text: 'text-rose-400',
    dot: 'bg-rose-500',
  },
  MEDIUM: {
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/40',
    text: 'text-amber-400',
    dot: 'bg-amber-500',
  },
  LOW: {
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/40',
    text: 'text-emerald-400',
    dot: 'bg-emerald-500',
  },
};

export function SonarMapPage({
  detectionResult,
  selectedTargetId,
  onSelectTarget,
  onSwitchToAnalysis,
}) {
  const [geospatialData, setGeospatialData] = useState(null);
  const [viewMode, setViewMode] = useState(detectionResult?.detections?.length > 0 ? 'live' : 'fleet');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDetectionId, setSelectedDetectionId] = useState(selectedTargetId || null);
  const [selectedVesselMmsi, setSelectedVesselMmsi] = useState(null);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [aisMode, setAisMode] = useState('LIVE');
  const [liveAisStatus, setLiveAisStatus] = useState('OFFLINE');
  const [demoState, setDemoState] = useState({
    running: true,
    playback_speed: 1.0,
    current_frame: 0,
    total_frames: 30,
    current_timestamp: null,
  });

  // Track live AISStream health status for transparency badge
  useEffect(() => {
    let isMounted = true;
    const checkLiveAis = async () => {
      try {
        const s = await getAisStatus();
        if (isMounted && s) {
          setLiveAisStatus(s.status === 'RUNNING' || s.status === 'CONNECTED' ? 'LIVE' : 'OFFLINE');
        }
      } catch (err) {
        if (isMounted) setLiveAisStatus('OFFLINE');
      }
    };
    checkLiveAis();
    const interval = setInterval(checkLiveAis, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Sync demo replay status when in DEMO mode
  useEffect(() => {
    if (aisMode !== 'DEMO') return;
    let isMounted = true;
    const fetchDemoStatus = async () => {
      try {
        const s = await getDemoStatus();
        if (isMounted && s) {
          setDemoState({
            running: s.running ?? true,
            playback_speed: s.playback_speed ?? 1.0,
            current_frame: s.current_frame ?? 0,
            total_frames: s.total_frames ?? 30,
            current_timestamp: s.current_timestamp ?? null,
          });
        }
      } catch (err) {
        console.error('Failed to get demo status:', err);
      }
    };
    fetchDemoStatus();
    const interval = setInterval(fetchDemoStatus, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [aisMode]);

  // Demo playback control handlers
  const handlePlayDemo = async () => {
    try {
      await playDemo();
      setDemoState((prev) => ({ ...prev, running: true }));
    } catch (err) {
      console.error('Failed to play demo:', err);
    }
  };

  const handlePauseDemo = async () => {
    try {
      await pauseDemo();
      setDemoState((prev) => ({ ...prev, running: false }));
    } catch (err) {
      console.error('Failed to pause demo:', err);
    }
  };

  const handleResetDemo = async () => {
    try {
      const res = await resetDemo();
      if (res?.status) {
        setDemoState((prev) => ({
          ...prev,
          current_frame: res.status.current_frame,
          current_timestamp: res.status.current_timestamp,
        }));
      }
    } catch (err) {
      console.error('Failed to reset demo:', err);
    }
  };

  const handleSpeedChange = async (speed) => {
    try {
      await setDemoSpeed(speed);
      setDemoState((prev) => ({ ...prev, playback_speed: speed }));
    } catch (err) {
      console.error('Failed to change demo speed:', err);
    }
  };

  // Sync selected detection
  useEffect(() => {
    if (selectedTargetId) {
      setSelectedDetectionId(selectedTargetId);
    }
  }, [selectedTargetId]);

  // When new detection result is passed in, switch to live view mode
  useEffect(() => {
    if (detectionResult?.detections?.length > 0) {
      setViewMode('live');
    }
  }, [detectionResult?.image_id]);

  // Load or compute geospatial data based on view mode
  useEffect(() => {
    const loadGeospatial = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (viewMode === 'live' && detectionResult && detectionResult.detections && detectionResult.detections.length > 0) {
          // Enrich current live detection result
          const data = await enrichGeospatial(detectionResult, {
            latitude: 9.3142,
            longitude: 79.1821,
            depth: 28.0,
          });
          setGeospatialData(data);
        } else {
          // Load mission fleet data or default sample
          const fleetData = await getFleetGeospatial();
          if (fleetData && fleetData.features && fleetData.features.length > 0) {
            setGeospatialData({
              image_id: 'FLEET_MISSION_AGGREGATE',
              total_targets: fleetData.total_targets,
              survey_location: fleetData.survey_zone,
              towfish_telemetry: {
                towfish_latitude: 9.3142,
                towfish_longitude: 79.1821,
                altitude_depth_m: 28.0,
                survey_zone: 'Palk Strait MoES Acoustic Survey',
              },
              detections: fleetData.features,
              severity_breakdown: {
                LOW: fleetData.features.filter((f) => f.severity === 'LOW').length,
                MEDIUM: fleetData.features.filter((f) => f.severity === 'MEDIUM').length,
                EXTREME: fleetData.features.filter((f) => f.severity === 'EXTREME').length,
              },
              timestamp: new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.error('Error loading geospatial map data:', err);
        setError('Failed to compute geospatial coordinates. Using offline acoustic projection.');
      } finally {
        setIsLoading(false);
      }
    };

    loadGeospatial();
  }, [detectionResult, viewMode]);

  const detections = geospatialData?.detections || [];
  const severityCounts = geospatialData?.severity_breakdown || {
    LOW: detections.filter((d) => d.severity === 'LOW').length,
    MEDIUM: detections.filter((d) => d.severity === 'MEDIUM').length,
    EXTREME: detections.filter((d) => d.severity === 'EXTREME').length,
  };

  const hasLiveResults = !!(detectionResult && detectionResult.detections && detectionResult.detections.length > 0);

  const handleTargetClick = (targetId) => {
    setSelectedDetectionId(targetId);
    setSelectedVesselMmsi(null);
    if (onSelectTarget) {
      onSelectTarget(targetId);
    }
  };

  const handleLocateVessel = (mmsi) => {
    setSelectedVesselMmsi(mmsi);
    setSelectedDetectionId(null);
  };

  const [isTriggeringTest, setIsTriggeringTest] = useState(false);

  const handleTriggerTestSOS = async () => {
    try {
      setIsTriggeringTest(true);
      const res = await triggerTestAlert();
      if (res && res.vessel) {
        setSelectedVesselMmsi(res.vessel.mmsi);
        setSelectedDetectionId(null);
      }
    } catch (err) {
      console.error('Failed to trigger test SOS alert:', err);
    } finally {
      setIsTriggeringTest(false);
    }
  };

  const handleClearAlerts = async () => {
    try {
      await clearTestAlerts();
      setActiveAlerts([]);
    } catch (err) {
      console.error('Failed to clear alerts:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Mission Telemetry */}
      <div className="bg-ocean-900 border border-ocean-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/20">
            <Compass className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                GEOSPATIAL SITUATIONAL MAP & DYNAMIC GEOFENCING
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60 flex items-center space-x-1">
                <Sparkles className="w-3 h-3" />
                <span>Sonar & Dynamic Geofencing</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Survey Area: Palk Strait (9.3142°N, 79.1821°E) • Altitude: 28m AGL • Zoom: Whole World to Subsea Detail
            </p>
          </div>
        </div>

        {/* View Mode Switcher, AIS Mode Selector, SOS Simulator, and Return button */}
        <div className="flex flex-wrap items-center gap-3">
          {/* AIS LIVE / DEMO Mode Selector */}
          <AisModeSelector
            mode={aisMode}
            liveStatus={liveAisStatus}
            onModeChange={(newMode) => setAisMode(newMode)}
          />

          {/* Test SOS Alert Trigger Button (for Live mode demo) */}
          {aisMode === 'LIVE' && (
            <button
              onClick={handleTriggerTestSOS}
              disabled={isTriggeringTest}
              title="Simulate a live vessel breaching a debris safety geofence to verify real-time SOS collision alerts"
              className="px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-600/70 text-xs font-mono font-bold flex items-center space-x-1.5 transition shadow-md shadow-rose-950/50 active:scale-95"
            >
              <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
              <span>{isTriggeringTest ? 'Triggering...' : '🚨 Test SOS Breach'}</span>
            </button>
          )}

          {/* Mode Switcher */}
          <div className="flex items-center space-x-1 bg-ocean-950/80 p-1 rounded-lg border border-ocean-800 text-xs font-mono">
            {hasLiveResults && (
              <button
                onClick={() => setViewMode('live')}
                className={`px-3 py-1.5 rounded font-bold transition ${
                  viewMode === 'live'
                    ? 'bg-cyan-500 text-black shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-ocean-850'
                }`}
              >
                📍 Current ({detectionResult.detections.length})
              </button>
            )}
            <button
              onClick={() => setViewMode('fleet')}
              className={`px-3 py-1.5 rounded font-bold transition ${
                viewMode === 'fleet' || !hasLiveResults
                  ? 'bg-emerald-500 text-black shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-ocean-850'
              }`}
            >
              🌐 All Runs
            </button>
          </div>

          <button
            onClick={onSwitchToAnalysis}
            className="px-3.5 py-1.5 rounded-lg bg-ocean-850 hover:bg-ocean-800 text-slate-200 hover:text-white border border-ocean-700 text-xs font-mono font-bold flex items-center space-x-2 transition shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            <span>Return to Sonar Analysis</span>
          </button>
        </div>
      </div>

      {/* AIS Demo Replay Controls Bar (visible when DEMO mode is selected) */}
      {aisMode === 'DEMO' && (
        <AisDemoControls
          isRunning={demoState.running}
          playbackSpeed={demoState.playback_speed}
          currentFrame={demoState.current_frame}
          totalFrames={demoState.total_frames}
          frameTimestamp={demoState.current_timestamp}
          onPlay={handlePlayDemo}
          onPause={handlePauseDemo}
          onReset={handleResetDemo}
          onSpeedChange={handleSpeedChange}
        />
      )}

      {/* Dynamic Proximity Alerts Banner */}
      {activeAlerts.length > 0 && (
        <VesselAlertsBanner
          alerts={activeAlerts}
          onDismiss={handleClearAlerts}
          onLocateVessel={handleLocateVessel}
        />
      )}

      {/* Error Notice */}
      {error && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-amber-400 text-xs font-mono flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="font-bold hover:text-white">Dismiss</button>
        </div>
      )}

      {/* Main Grid: Wider Map (9 cols) + Targets & Geofence Telemetry Sidebar (3 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Expanded Map View */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          <SonarMap
            geospatialData={geospatialData}
            selectedTargetId={selectedDetectionId}
            selectedVesselMmsi={selectedVesselMmsi}
            aisMode={aisMode}
            onSelectTarget={handleTargetClick}
            onSelectVessel={setSelectedVesselMmsi}
            onSwitchToAnalysis={onSwitchToAnalysis}
            onAlertsChange={setActiveAlerts}
          />

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-ocean-900 border border-ocean-800 rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase">Extreme Hazards</span>
                <p className="text-xl font-bold font-mono text-rose-400">{severityCounts.EXTREME || 0}</p>
              </div>
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
            </div>

            <div className="bg-ocean-900 border border-ocean-800 rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase">Medium Hazards</span>
                <p className="text-xl font-bold font-mono text-amber-400">{severityCounts.MEDIUM || 0}</p>
              </div>
              <span className="w-3 h-3 rounded-full bg-amber-500" />
            </div>

            <div className="bg-ocean-900 border border-ocean-800 rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase">Low Debris</span>
                <p className="text-xl font-bold font-mono text-emerald-400">{severityCounts.LOW || 0}</p>
              </div>
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
            </div>
          </div>
        </div>

        {/* Right: Targets & Dynamic Geofence Sidebar */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4">
          <div className="bg-ocean-900 border border-ocean-800 rounded-xl overflow-hidden shadow-lg">
            <div className="px-4 py-3 border-b border-ocean-800 bg-ocean-850 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                  Targets ({detections.length})
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Click to locate</span>
            </div>

            <div className="p-3 space-y-2.5 max-h-[690px] overflow-y-auto">
              {detections.length === 0 ? (
                <div className="p-6 text-center text-xs font-mono text-slate-400">
                  No targets currently georeferenced. Upload & analyze a sonar image on the Sonar Analysis tab.
                </div>
              ) : (
                detections.map((det) => {
                  const isSelected = selectedDetectionId === det.detection_id;
                  const sev = det.severity || 'LOW';
                  const sevBadge = SEVERITY_BADGES[sev] || SEVERITY_BADGES.LOW;

                  return (
                    <div
                      key={det.detection_id}
                      onClick={() => handleTargetClick(det.detection_id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer font-mono text-xs ${
                        isSelected
                          ? 'bg-cyan-950/60 border-cyan-500 shadow-md shadow-cyan-500/10'
                          : 'bg-ocean-950/60 border-ocean-800 hover:border-ocean-700 hover:bg-ocean-850/60 text-slate-300'
                      }`}
                    >
                      {/* Top row: Name & Severity */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center space-x-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${sevBadge.dot}`} />
                          <strong className="text-sm font-bold text-slate-100">
                            #{det.detection_id} {det.class_name}
                          </strong>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sevBadge.bg} ${sevBadge.text} border ${sevBadge.border}`}>
                          {sev}
                        </span>
                      </div>

                      {/* Coordinates & Geofence Details */}
                      <div className="space-y-1 text-[11px] text-slate-400">
                        <div className="flex justify-between">
                          <span>GPS Coordinates:</span>
                          <span className="text-slate-200 font-semibold">
                            {det.geolocation.latitude.toFixed(4)}°N, {det.geolocation.longitude.toFixed(4)}°E
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Confidence / Anomaly:</span>
                          <span className="text-slate-200">
                            {(det.confidence * 100).toFixed(1)}% | {det.anomaly_score.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Dynamic Geofence:</span>
                          <span className="text-emerald-400 font-bold">
                            ⭕ {det.geofence.radius_meters}m radius
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="mt-2 pt-2 border-t border-ocean-800/60 flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">
                          {det.geolocation.across_track_offset_m >= 0 ? 'Starboard' : 'Port'} {Math.abs(det.geolocation.across_track_offset_m)}m
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectTarget) onSelectTarget(det.detection_id);
                            if (onSwitchToAnalysis) onSwitchToAnalysis();
                          }}
                          className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center space-x-1"
                        >
                          <Crosshair className="w-3 h-3" />
                          <span>View on Sonar</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
