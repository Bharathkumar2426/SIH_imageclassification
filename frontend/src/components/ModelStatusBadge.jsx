import React from 'react';
import { AlertTriangle, CheckCircle2, Cpu, Info, Layers, ShieldCheck } from 'lucide-react';

export function ModelStatusBadge({ healthData, modelMetadata }) {
  const isSonarTrained = modelMetadata?.is_sonar_trained ?? healthData?.is_sonar_trained ?? false;
  const modelName = modelMetadata?.weights_path ? modelMetadata.weights_path.split(/[\\/]/).pop() : healthData?.model_version || 'Loading...';
  const device = modelMetadata?.device || (healthData?.cuda_available ? healthData?.device_name : 'CPU');

  return (
    <div className="bg-ocean-900 border border-ocean-800 rounded-xl p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Model Identification */}
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${isSonarTrained ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
            {isSonarTrained ? <ShieldCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-semibold text-slate-100">
                Model: <span className="font-mono text-cyan-400">{modelName}</span>
              </h4>
              <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
                isSonarTrained 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>
                {isSonarTrained ? 'A. Sonar-Trained Weights' : 'B. Base Architecture (Prototype)'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isSonarTrained 
                ? 'Fine-tuned on side-scan sonar imagery with acoustic shadow preservation.' 
                : 'Using base detector weights. Real confidence scores from active weights.'}
            </p>
          </div>
        </div>

        {/* Runtime Tags */}
        <div className="flex items-center space-x-3 text-xs font-mono">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-ocean-850 border border-ocean-750 text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>{device}</span>
          </div>
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-ocean-850 border border-ocean-750 text-slate-300">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Ultralytics YOLO</span>
          </div>
        </div>
      </div>
    </div>
  );
}
