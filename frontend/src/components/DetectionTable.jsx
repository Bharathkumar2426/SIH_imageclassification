import React from 'react';
import { Crosshair, AlertTriangle } from 'lucide-react';

const CLASS_COLORS = {
  metal_drum: '#10b981',      // Emerald Green
  tire_wheel: '#3b82f6',      // Dodger Blue
  ghost_net: '#f59e0b',       // Amber Orange
  plastic_debris: '#ef4444',  // Rose Red
  sunken_wreckage: '#a855f7', // Royal Purple
  pipe_pipeline: '#eab308',   // Yellow Gold
  container_crate: '#14b8a6', // Teal
  anchor_chain: '#f97316',    // Deep Orange
  wood_debris: '#b45309',     // Warm Bronze
  rock_boulder: '#84cc16',    // Lime Green
  unknown_debris: '#06b6d4',  // Cyan
  unknown_anomaly: '#06b6d4', // Cyan
};


export function DetectionTable({
  detections = [],
  selectedDetectionId,
  hoveredDetectionId,
  onSelectDetection,
  onHoverDetection,
  confidenceThreshold,
}) {
  if (detections.length === 0) {
    return (
      <div className="bg-ocean-900 border border-ocean-800 rounded-xl p-6 text-center space-y-2">
        <div className="w-10 h-10 rounded-full bg-ocean-850 border border-ocean-750 text-amber-400 mx-auto flex items-center justify-center">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-200">No Targets Detected</h4>
          <p className="text-xs text-slate-400 mt-1">
            No object met the cutoff of {(confidenceThreshold * 100).toFixed(0)}%.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-ocean-900 border border-ocean-800 rounded-xl overflow-hidden shadow-lg">
      <div className="px-4 py-3 border-b border-ocean-800 flex items-center justify-between bg-ocean-850">
        <div className="flex items-center space-x-2">
          <Crosshair className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
            Detected Targets ({detections.length})
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400">
          Click row to highlight
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="border-b border-ocean-800 bg-ocean-950/60 text-slate-400 text-[11px]">
              <th className="py-2.5 px-3 font-semibold w-8">#</th>
              <th className="py-2.5 px-3 font-semibold">Object Name</th>
              <th className="py-2.5 px-3 font-semibold text-right">Confidence</th>
              <th className="py-2.5 px-3 font-semibold text-right">Anomaly Score</th>
              <th className="py-2.5 px-3 font-semibold text-right">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ocean-800/40">
            {detections.map((det, idx) => {
              const isSelected = selectedDetectionId === det.id;
              const isHovered = hoveredDetectionId === det.id;
              const isActive = isSelected || isHovered;

              const cName = det.class_name || det.class || 'unknown_debris';
              const dotColor = CLASS_COLORS[cName] || '#06b6d4';
              const confPercent = ((det.confidence || 0) * 100).toFixed(1);
              const anomScore = ((det.anomaly_score !== undefined ? det.anomaly_score : 0.0)).toFixed(2);
              
              // Standardize source name matching screenshot: 'Classifier' or 'OOD'
              let sourceDisplay = 'Classifier';
              if (det.classification_source === 'unknown' || det.classification_source === 'OOD' || cName.includes('unknown')) {
                sourceDisplay = 'OOD';
              }

              return (
                <tr
                  key={det.id || idx}
                  onClick={() => onSelectDetection(det.id)}
                  onMouseEnter={() => onHoverDetection(det.id)}
                  onMouseLeave={() => onHoverDetection(null)}
                  className={`cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-cyan-950/50 text-white'
                      : 'hover:bg-ocean-850/70 text-slate-300'
                  }`}
                >
                  <td className="py-2.5 px-3 text-slate-400 font-bold">
                    {det.id || idx + 1}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-200">
                    <div className="flex items-center space-x-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block shadow-sm"
                        style={{ backgroundColor: dotColor }}
                      />
                      <span>{cName}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-200">
                    {confPercent}%
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-300">
                    {anomScore}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span className={`text-[11px] font-semibold ${
                      sourceDisplay === 'OOD' ? 'text-cyan-400' : 'text-slate-300'
                    }`}>
                      {sourceDisplay}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
