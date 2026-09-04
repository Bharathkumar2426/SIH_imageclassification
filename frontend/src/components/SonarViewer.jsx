import React, { useRef, useState, useEffect } from 'react';
import { 
  Eye, Maximize2, Minimize2, Move, RotateCcw, 
  ZoomIn, ZoomOut, Layers, Target, Info 
} from 'lucide-react';

export function SonarViewer({
  detectionResult,
  activeView,
  setActiveView,
  selectedDetectionId,
  hoveredDetectionId,
  onSelectDetection,
  onHoverDetection,
}) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgNaturalSize, setImgNaturalSize] = useState({ width: 800, height: 600 });

  // Reset zoom when new image is loaded
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [detectionResult?.image_id]);

  if (!detectionResult) {
    return (
      <div className="bg-ocean-900 border border-ocean-800 rounded-xl p-8 flex flex-col items-center justify-center min-h-[480px] text-center">
        <div className="w-16 h-16 rounded-2xl bg-ocean-850 border border-ocean-750 flex items-center justify-center text-slate-500 mb-4">
          <Eye className="w-8 h-8 text-cyan-500/40" />
        </div>
        <h3 className="text-base font-semibold text-slate-200">No Sonar Image Loaded</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          Upload a side-scan sonar image or select a sample above, then click Analyze to run the detection pipeline.
        </p>
      </div>
    );
  }

  // Determine current image source based on active stage tab
  const stageImages = detectionResult.stage_images || {};
  let currentImgSrc = stageImages.enhanced || stageImages.original || stageImages.annotated || detectionResult.annotated_image_url;

  if (activeView === 'original' && stageImages.original) {
    currentImgSrc = stageImages.original;
  } else if (activeView === 'enhanced' && stageImages.enhanced) {
    currentImgSrc = stageImages.enhanced;
  } else if (activeView === 'denoised' && stageImages.denoised) {
    currentImgSrc = stageImages.denoised;
  } else if (activeView === 'annotated') {
    // Show clean contrast-enhanced sonar with vector SVG overlay for pixel-perfect Image 1 aesthetic
    currentImgSrc = stageImages.enhanced || stageImages.original || stageImages.annotated;
  }

  // Pan handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Wheel zoom handler
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = 1.15;
    if (e.deltaY < 0) {
      setScale((s) => Math.min(6.0, s * zoomFactor));
    } else {
      setScale((s) => Math.max(0.5, s / zoomFactor));
    }
  };

  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const detections = detectionResult.detections || [];

  return (
    <div className="bg-ocean-900 border border-ocean-800 rounded-xl overflow-hidden shadow-lg flex flex-col">
      {/* Viewer Toolbar & View Switcher */}
      <div className="border-b border-ocean-800 bg-ocean-850 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        {/* Stage Comparison Tabs */}
        <div className="flex items-center space-x-1 bg-ocean-900 p-1 rounded-lg border border-ocean-750">
          <button
            onClick={() => setActiveView('original')}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              activeView === 'original'
                ? 'bg-cyan-500 text-black font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            1. Original Sonar
          </button>
          <button
            onClick={() => setActiveView('enhanced')}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              activeView === 'enhanced'
                ? 'bg-cyan-500 text-black font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            2. Enhanced (CLAHE)
          </button>
          <button
            onClick={() => setActiveView('denoised')}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              activeView === 'denoised'
                ? 'bg-cyan-500 text-black font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            3. Denoised (Bilateral)
          </button>
          <button
            onClick={() => setActiveView('annotated')}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              activeView === 'annotated'
                ? 'bg-cyan-500 text-black font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            4. Detection Result
          </button>
        </div>

        {/* Zoom & Pan Controls */}
        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="text-slate-400 px-2 py-0.5 rounded bg-ocean-900 border border-ocean-800">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(6.0, s * 1.2))}
            title="Zoom In"
            className="p-1.5 rounded bg-ocean-800 hover:bg-ocean-750 text-slate-200 border border-ocean-700"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setScale((s) => Math.max(0.5, s / 1.2))}
            title="Zoom Out"
            className="p-1.5 rounded bg-ocean-800 hover:bg-ocean-750 text-slate-200 border border-ocean-700"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetZoom}
            title="Reset Pan & Zoom"
            className="p-1.5 rounded bg-ocean-800 hover:bg-ocean-750 text-slate-200 border border-ocean-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="relative flex-1 min-h-[460px] max-h-[580px] bg-[#02050b] overflow-hidden cursor-grab active:cursor-grabbing flex items-center justify-center select-none"
      >
        {/* Subtle Scanlines effect overlay */}
        <div className="absolute inset-0 sonar-scanlines z-10 pointer-events-none" />

        {/* Viewport content */}
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
          className="relative inline-block"
        >
          {/* Sonar Image */}
          <img
            src={currentImgSrc}
            alt="Side-Scan Sonar Analysis"
            onLoad={(e) => {
              setImgNaturalSize({
                width: e.target.naturalWidth || 800,
                height: e.target.naturalHeight || 600,
              });
            }}
            className="max-h-[540px] max-w-full block object-contain pointer-events-none"
          />

          {/* SVG Overlay for Interactive Clickable Bounding Boxes (Only when in detection view) */}
          {activeView === 'annotated' && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-auto"
              viewBox={`0 0 ${imgNaturalSize.width} ${imgNaturalSize.height}`}
            >
              {detections.map((det) => {
                const { x, y, width, height } = det.bbox;
                const isSelected = selectedDetectionId === det.id;
                const isHovered = hoveredDetectionId === det.id;
                const isActive = isSelected || isHovered;

                return (
                  <g
                    key={det.id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDetection(det.id);
                    }}
                    onMouseEnter={() => onHoverDetection(det.id)}
                    onMouseLeave={() => onHoverDetection(null)}
                  >
                    {/* Rounded Bounding Box Border matching Image 1 */}
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      rx={8}
                      ry={8}
                      fill={isActive ? 'rgba(52, 211, 153, 0.12)' : 'transparent'}
                      stroke={isActive ? '#34d399' : '#10b981'}
                      strokeWidth={isActive ? 3 : 2}
                      className="transition-all duration-150"
                    />

                    {/* Acoustic Target Yellow Reticle matching Image 1 */}
                    <circle
                      cx={det.center.x}
                      cy={det.center.y}
                      r={14}
                      stroke="#facc15"
                      strokeWidth={1.5}
                      fill="none"
                      opacity={0.8}
                    />
                    <circle
                      cx={det.center.x}
                      cy={det.center.y}
                      r={4}
                      fill="#facc15"
                    />

                    {/* Floating Pill Badge matching Image 1: <Type> — <Confidence>% */}
                    {(() => {
                      const label = `${det.display_name || det.class_name} — ${Math.round(det.confidence * 100)}%`;
                      const pillWidth = Math.max(105, label.length * 8.5 + 20);
                      const pillHeight = 26;
                      const pillY = Math.max(4, y - pillHeight - 6);

                      return (
                        <g>
                          <rect
                            x={x}
                            y={pillY}
                            width={pillWidth}
                            height={pillHeight}
                            rx={6}
                            ry={6}
                            fill={isActive ? 'rgba(6, 95, 70, 0.95)' : 'rgba(6, 78, 59, 0.90)'}
                            stroke={isActive ? '#6ee7b7' : '#34d399'}
                            strokeWidth={1.5}
                            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
                          />
                          <text
                            x={x + 10}
                            y={pillY + 17}
                            fill="#ffffff"
                            fontSize={12}
                            fontWeight="bold"
                            fontFamily="Plus Jakarta Sans, sans-serif"
                            letterSpacing="0.3px"
                          >
                            {label}
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Telemetry HUD Pill at bottom-left matching Image 1 */}
        <div className="absolute bottom-3 left-3 z-20 px-3.5 py-1.5 rounded-full bg-black/85 border border-slate-700/60 text-xs font-mono text-slate-200 backdrop-blur-md flex items-center space-x-2 shadow-lg">
          <span>Alt: 28m AGL</span>
          <span className="text-slate-500">•</span>
          <span>Lat: 9.3142°N</span>
          <span className="text-slate-500">•</span>
          <span>Lng: 79.1821°E</span>
          <span className="text-slate-500">•</span>
          <span className="text-cyan-400 font-bold uppercase">{activeView}</span>
        </div>
      </div>
    </div>
  );
}
