import React from 'react';
import { Play, Pause, RotateCcw, FastForward, Clock, Film } from 'lucide-react';

export function AisDemoControls({
  isRunning = true,
  playbackSpeed = 1.0,
  currentFrame = 0,
  totalFrames = 30,
  frameTimestamp = null,
  onPlay,
  onPause,
  onReset,
  onSpeedChange,
}) {
  const speeds = [0.5, 1.0, 2.0, 5.0];

  const formatTimestamp = (iso) => {
    if (!iso) return 'Recorded UTC Frame';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="bg-amber-950/80 border border-amber-500/50 rounded-xl p-2.5 shadow-lg backdrop-blur-md font-mono text-xs text-amber-200 flex flex-wrap items-center justify-between gap-3">
      {/* Left: Playback Controls */}
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-1.5">
          {isRunning ? (
            <button
              onClick={onPause}
              title="Pause Demo Replay"
              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold flex items-center space-x-1 shadow-sm transition"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pause</span>
            </button>
          ) : (
            <button
              onClick={onPlay}
              title="Resume Demo Replay"
              className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold flex items-center space-x-1 shadow-sm transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Play</span>
            </button>
          )}

          <button
            onClick={onReset}
            title="Reset Replay to Start"
            className="px-2.5 py-1 rounded-lg bg-ocean-900 hover:bg-ocean-800 text-amber-300 border border-amber-700/60 font-semibold flex items-center space-x-1 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>

        {/* Speed Selector */}
        <div className="flex items-center space-x-1 bg-ocean-950/90 px-1.5 py-0.5 rounded-lg border border-ocean-800">
          <FastForward className="w-3.5 h-3.5 text-amber-400 mr-0.5" />
          {speeds.map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition ${
                playbackSpeed === s
                  ? 'bg-amber-400 text-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Right: Progress & Timeline Indicator */}
      <div className="flex items-center space-x-3 text-[11px]">
        <div className="flex items-center space-x-1.5 bg-ocean-950/80 px-2.5 py-1 rounded-lg border border-ocean-800">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">Timeline:</span>
          <span className="font-bold text-white">{formatTimestamp(frameTimestamp)}</span>
        </div>

        <div className="flex items-center space-x-1 text-slate-300 bg-ocean-950/80 px-2 py-1 rounded-lg border border-ocean-800">
          <Film className="w-3 h-3 text-amber-400" />
          <span>Frame</span>
          <span className="font-bold text-amber-400">{currentFrame + 1}</span>
          <span className="text-slate-500">/</span>
          <span>{totalFrames}</span>
        </div>
      </div>
    </div>
  );
}
