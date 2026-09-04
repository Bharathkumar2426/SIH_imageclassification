import React from 'react';
import { Image as ImageIcon, Map, Download, BarChart2 } from 'lucide-react';

export function ActionCards({ onUploadClick, onExportClick }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Upload New Image */}
      <div
        onClick={onUploadClick}
        className="bg-ocean-900 border border-ocean-800 hover:border-cyan-500/50 hover:bg-ocean-850 p-4 rounded-xl cursor-pointer transition flex items-center space-x-3.5 shadow-sm group"
      >
        <div className="w-10 h-10 rounded-lg bg-cyan-950/60 border border-cyan-800/60 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition">
          <ImageIcon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs font-bold text-slate-200">Upload New Image</div>
          <div className="text-[11px] font-mono text-slate-400">JPG, PNG, TIFF (Max 20MB)</div>
        </div>
      </div>

      {/* 2. View on Map */}
      <div
        onClick={() => alert("Geospatial Map Visualization: Telemetry coordinates [9.3142°N, 79.1821°E] centered.")}
        className="bg-ocean-900 border border-ocean-800 hover:border-cyan-500/50 hover:bg-ocean-850 p-4 rounded-xl cursor-pointer transition flex items-center space-x-3.5 shadow-sm group"
      >
        <div className="w-10 h-10 rounded-lg bg-cyan-950/60 border border-cyan-800/60 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition">
          <Map className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs font-bold text-slate-200">View on Map</div>
          <div className="text-[11px] font-mono text-slate-400">Geospatial Visualization</div>
        </div>
      </div>

      {/* 3. Export Results */}
      <div
        onClick={onExportClick}
        className="bg-ocean-900 border border-ocean-800 hover:border-cyan-500/50 hover:bg-ocean-850 p-4 rounded-xl cursor-pointer transition flex items-center space-x-3.5 shadow-sm group"
      >
        <div className="w-10 h-10 rounded-lg bg-cyan-950/60 border border-cyan-800/60 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition">
          <Download className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs font-bold text-slate-200">Export Results</div>
          <div className="text-[11px] font-mono text-slate-400">JSON / GeoJSON / CSV</div>
        </div>
      </div>

      {/* 4. Detection Reports */}
      <div
        onClick={() => alert("Detection Analytics & Statistical Summary downloaded.")}
        className="bg-ocean-900 border border-ocean-800 hover:border-cyan-500/50 hover:bg-ocean-850 p-4 rounded-xl cursor-pointer transition flex items-center space-x-3.5 shadow-sm group"
      >
        <div className="w-10 h-10 rounded-lg bg-cyan-950/60 border border-cyan-800/60 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition">
          <BarChart2 className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs font-bold text-slate-200">Detection Reports</div>
          <div className="text-[11px] font-mono text-slate-400">Analytics & Statistics</div>
        </div>
      </div>
    </div>
  );
}
