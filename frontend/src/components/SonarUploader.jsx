import React, { useRef, useState } from 'react';
import { FileImage, Sparkles, UploadCloud, X } from 'lucide-react';
import { fetchSampleAsFile } from '../services/api';

export function SonarUploader({ onFileSelected, selectedFile, isDetecting }) {
  const [isDragging, setIsDragging] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleSampleClick = async (sampleName) => {
    try {
      setLoadingSample(true);
      const file = await fetchSampleAsFile(sampleName);
      onFileSelected(file);
    } catch (err) {
      console.error("Failed to load sample:", err);
      alert(`Could not load sample: ${err.message}`);
    } finally {
      setLoadingSample(false);
    }
  };

  return (
    <div className="bg-ocean-900 border border-ocean-800 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <UploadCloud className="w-4 h-4 text-cyan-400" />
          1. Upload Side-Scan Sonar Imagery
        </h3>
        {selectedFile && (
          <button
            onClick={() => onFileSelected(null)}
            className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-mono transition"
          >
            <X className="w-3.5 h-3.5" /> Clear File
          </button>
        )}
      </div>

      {/* Drag and drop box */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[160px] ${
          isDragging
            ? 'border-cyan-400 bg-cyan-500/10'
            : selectedFile
            ? 'border-emerald-500/50 bg-emerald-500/5'
            : 'border-ocean-750 bg-ocean-850/60 hover:border-ocean-600 hover:bg-ocean-850'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.tif,.tiff"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              onFileSelected(e.target.files[0]);
            }
          }}
        />

        {selectedFile ? (
          <div className="space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
              <FileImage className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold text-slate-200 text-sm">{selectedFile.name}</p>
              <p className="text-xs font-mono text-slate-400">
                {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || 'Sonar Image'}
              </p>
            </div>
            <p className="text-xs text-cyan-400 font-mono">Click or drag another file to replace</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="w-12 h-12 rounded-full bg-cyan-500/10 text-cyan-400 mx-auto flex items-center justify-center">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">
                Drag and drop your raw side-scan sonar image here
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Supports PNG, JPG, TIFF single-beam or dual-channel waterfall transects
              </p>
            </div>
            <span className="inline-block text-xs font-mono px-3 py-1 bg-ocean-800 text-cyan-300 rounded-md border border-ocean-700">
              Browse Local Files
            </span>
          </div>
        )}
      </div>

      {/* Preset Sonar Samples */}
      <div className="pt-2 border-t border-ocean-850">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Or test with verified sonar samples:
          </span>
          {loadingSample && <span className="text-cyan-400 animate-pulse">Loading sample...</span>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            disabled={isDetecting || loadingSample}
            onClick={() => handleSampleClick('sample_sonar_image6.jpg')}
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-700/60 text-left transition disabled:opacity-50"
          >
            <div>
              <div className="text-xs font-bold text-cyan-300">Target Benchmark (6 Debris)</div>
              <div className="text-[11px] font-mono text-slate-400">1024x2048 • Full Multi-Target Sonar</div>
            </div>
            <span className="text-xs font-mono text-cyan-300 font-bold px-2 py-0.5 rounded bg-cyan-900 border border-cyan-600">
              Load
            </span>
          </button>

          <button
            type="button"
            disabled={isDetecting || loadingSample}
            onClick={() => handleSampleClick('sample_sonar_image.jpg')}
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-ocean-850 hover:bg-ocean-800 border border-ocean-750 text-left transition disabled:opacity-50"
          >
            <div>
              <div className="text-xs font-semibold text-slate-200">Aircraft Wreckage Transect</div>
              <div className="text-[11px] font-mono text-slate-400">800x450 • Sunken aircraft acoustic shadow</div>
            </div>
            <span className="text-xs font-mono text-cyan-400 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800">
              Load
            </span>
          </button>

          <button
            type="button"
            disabled={isDetecting || loadingSample}
            onClick={() => handleSampleClick('sample_sonar.png')}
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-ocean-850 hover:bg-ocean-800 border border-ocean-750 text-left transition disabled:opacity-50"
          >
            <div>
              <div className="text-xs font-semibold text-slate-200">High-Res Seabed Swath</div>
              <div className="text-[11px] font-mono text-slate-400">1024x1024 • Debris field & ripples</div>
            </div>
            <span className="text-xs font-mono text-cyan-400 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800">
              Load
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
