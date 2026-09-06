import React from 'react';
import { Radio, Database, AlertCircle, Sparkles, Film } from 'lucide-react';

export function AisModeSelector({
  mode = 'LIVE',
  liveStatus = 'OFFLINE',
  onModeChange,
}) {
  const isLive = mode === 'LIVE';
  const isLiveConnected = liveStatus === 'LIVE';

  return (
    <div className="flex flex-wrap items-center gap-2 bg-ocean-950/90 p-1.5 rounded-xl border border-ocean-800 shadow-md font-mono text-xs">
      {/* Mode Switcher Buttons */}
      <div className="flex items-center space-x-1 bg-ocean-900/90 p-0.5 rounded-lg border border-ocean-750">
        <button
          onClick={() => onModeChange('LIVE')}
          className={`px-3 py-1 rounded-md font-bold transition flex items-center space-x-1.5 ${
            isLive
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-ocean-800'
          }`}
        >
          <Radio className={`w-3.5 h-3.5 ${isLive && isLiveConnected ? 'animate-pulse text-white' : ''}`} />
          <span>LIVE</span>
        </button>

        <button
          onClick={() => onModeChange('DEMO')}
          className={`px-3 py-1 rounded-md font-bold transition flex items-center space-x-1.5 ${
            !isLive
              ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-black shadow-sm shadow-amber-500/30 font-extrabold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-ocean-800'
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          <span>DEMO</span>
        </button>
      </div>

      {/* Mode Transparency Badge */}
      <div className="flex items-center space-x-2 pl-1">
        {isLive ? (
          isLiveConnected ? (
            <div className="flex items-center space-x-1.5 text-emerald-400 text-[11px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>REAL-TIME AISSTREAM</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 text-rose-400 text-[11px]">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>LIVE AIS DISCONNECTED</span>
              <button
                onClick={() => onModeChange('DEMO')}
                className="underline text-amber-400 hover:text-amber-300 font-bold ml-1 text-[10px]"
              >
                (Use Demo Mode)
              </button>
            </div>
          )
        ) : (
          <div className="flex items-center space-x-1.5 text-amber-300 text-[11px] font-bold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-600/50">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>DEMO MODE — RECORDED DATA</span>
            <span className="text-[9px] text-amber-400/80 font-normal hidden sm:inline">
              (Offline Capable)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
