import React from 'react';
import { AlertTriangle, CheckCircle2, Crosshair, HelpCircle, Table } from 'lucide-react';

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
      <div className="bg-ocean-900 border border-ocean-800 rounded-xl p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-ocean-850 border border-ocean-750 text-amber-400 mx-auto flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-base font-semibold text-slate-200">No Confident Targets Detected</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            No acoustic anomaly exceeded the current confidence threshold of{' '}
            <span className="font-mono text-cyan-400 font-bold">{(confidenceThreshold * 100).toFixed(0)}%</span>.
            Try lowering the confidence slider (e.g. to 15% or 20%) to inspect subtle seabed anomalies.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-ocean-900 border border-ocean-800 rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-ocean-800 flex items-center justify-between bg-ocean-850">
        <div className="flex items-center space-x-2">
          <Table className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
            Detection Table ({detections.length} Targets)
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Click any row to focus target in viewer
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-ocean-800 bg-ocean-950/60 text-slate-400 font-mono text-[11px]">
              <th className="py-2.5 px-3 font-semibold">#</th>
              <th className="py-2.5 px-3 font-semibold">OBJECT TYPE</th>
              <th className="py-2.5 px-3 font-semibold">CONFIDENCE</th>
              <th className="py-2.5 px-3 font-semibold">X</th>
              <th className="py-2.5 px-3 font-semibold">Y</th>
              <th className="py-2.5 px-3 font-semibold">W</th>
              <th className="py-2.5 px-3 font-semibold">H</th>
              <th className="py-2.5 px-3 font-semibold">AREA (PX²)</th>
              <th className="py-2.5 px-3 font-semibold">CLASSIFICATION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ocean-800/60 font-mono">
            {detections.map((det) => {
              const isSelected = selectedDetectionId === det.id;
              const isHovered = hoveredDetectionId === det.id;
              const isActive = isSelected || isHovered;
              const { x, y, width, height } = det.bbox;
              const isKnown = det.anomaly_type === 'KNOWN_OBJECT';

              return (
                <tr
                  key={det.id}
                  onClick={() => onSelectDetection(det.id)}
                  onMouseEnter={() => onHoverDetection(det.id)}
                  onMouseLeave={() => onHoverDetection(null)}
                  className={`cursor-pointer transition ${
                    isActive
                      ? 'bg-cyan-950/40 text-cyan-200 border-l-4 border-l-cyan-400'
                      : 'hover:bg-ocean-850/60 text-slate-300'
                  }`}
                >
                  <td className="py-2.5 px-3 font-bold text-slate-200">
                    #{det.id}
                  </td>
                  <td className="py-2.5 px-3 font-sans font-semibold text-white">
                    {det.display_name || det.class_name.replace('_', ' ').toUpperCase()}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center space-x-2">
                      <span className={`font-bold ${
                        det.confidence >= 0.7 
                          ? 'text-emerald-400' 
                          : det.confidence >= 0.4 
                          ? 'text-amber-400' 
                          : 'text-slate-400'
                      }`}>
                        {(det.confidence * 100).toFixed(1)}%
                      </span>
                      <div className="w-12 h-1.5 rounded-full bg-ocean-800 overflow-hidden hidden sm:block">
                        <div
                          className={`h-full ${
                            det.confidence >= 0.7 
                              ? 'bg-emerald-400' 
                              : det.confidence >= 0.4 
                              ? 'bg-amber-400' 
                              : 'bg-slate-400'
                          }`}
                          style={{ width: `${Math.round(det.confidence * 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">{x}</td>
                  <td className="py-2.5 px-3 text-slate-300">{y}</td>
                  <td className="py-2.5 px-3 text-slate-300">{width}</td>
                  <td className="py-2.5 px-3 text-slate-300">{height}</td>
                  <td className="py-2.5 px-3 text-slate-400">{det.area.toLocaleString()}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      isKnown
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}>
                      {isKnown ? 'KNOWN OBJECT' : 'ACOUSTIC ANOMALY'}
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
