import React, { useState, useEffect } from 'react';
import { ModelStatusBadge } from '../components/ModelStatusBadge';
import { SonarUploader } from '../components/SonarUploader';
import { ControlsPanel } from '../components/ControlsPanel';
import { SonarViewer } from '../components/SonarViewer';
import { DetectionSummary } from '../components/DetectionSummary';
import { DetectionTable } from '../components/DetectionTable';
import { ImageInfoCard } from '../components/ImageInfoCard';
import { ActionCards } from '../components/ActionCards';
import { detectSonarImage } from '../services/api';

export function SonarAnalysisPage({ healthData }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState(null);
  const [activeView, setActiveView] = useState('annotated');
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.20);
  const [iouThreshold, setIouThreshold] = useState(0.45);
  const [enablePreprocessing, setEnablePreprocessing] = useState(true);
  const [selectedDetectionId, setSelectedDetectionId] = useState(null);
  const [hoveredDetectionId, setHoveredDetectionId] = useState(null);
  const [error, setError] = useState(null);

  // Clear selections on new file
  const handleFileSelected = (file) => {
    setSelectedFile(file);
    setDetectionResult(null);
    setSelectedDetectionId(null);
    setHoveredDetectionId(null);
    setError(null);
  };

  // Run Real ML Inference
  const handleRunDetection = async () => {
    if (!selectedFile) return;

    try {
      setIsDetecting(true);
      setError(null);

      const result = await detectSonarImage(selectedFile, {
        confidenceThreshold,
        iouThreshold,
        enablePreprocessing,
      });

      setDetectionResult(result);
      setActiveView('annotated');
      setSelectedDetectionId(null);
    } catch (err) {
      console.error("Detection error:", err);
      setError(err.message || 'Detection failed.');
    } finally {
      setIsDetecting(false);
    }
  };

  // Export JSON
  const handleExportJson = () => {
    if (!detectionResult) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(detectionResult, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `${detectionResult.image_id}_detections.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Download Annotated Image
  const handleDownloadAnnotated = () => {
    if (!detectionResult) return;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', `/api/images/${detectionResult.image_id}/annotated`);
    downloadAnchor.setAttribute('download', `${detectionResult.image_id}_annotated.png`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Model Diagnostic Badge (Sections 4 & 15) */}
      <ModelStatusBadge
        healthData={healthData}
        modelMetadata={detectionResult?.model_metadata}
      />

      {/* Error Alert */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-400 text-sm font-mono flex items-center justify-between">
          <span>Error: {error}</span>
          <button onClick={() => setError(null)} className="text-xs hover:text-white font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Upload & Calibration Section (collapsible when results are active) */}
      {(!detectionResult || selectedFile === null) ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7">
            <SonarUploader
              selectedFile={selectedFile}
              onFileSelected={handleFileSelected}
              isDetecting={isDetecting}
            />
          </div>

          <div className="lg:col-span-5">
            <ControlsPanel
              confidenceThreshold={confidenceThreshold}
              setConfidenceThreshold={setConfidenceThreshold}
              iouThreshold={iouThreshold}
              setIouThreshold={setIouThreshold}
              enablePreprocessing={enablePreprocessing}
              setEnablePreprocessing={setEnablePreprocessing}
              onRunDetection={handleRunDetection}
              isDetecting={isDetecting}
              hasImage={!!selectedFile}
              hasResults={!!detectionResult}
              onResetUpload={() => handleFileSelected(null)}
              onDownloadAnnotated={handleDownloadAnnotated}
              onExportJson={handleExportJson}
              activeView={activeView}
              setActiveView={setActiveView}
            />
          </div>
        </div>
      ) : (
        <details className="bg-ocean-900 border border-ocean-800 rounded-xl p-3 text-xs font-mono text-slate-400">
          <summary className="cursor-pointer font-bold text-cyan-400 hover:text-cyan-300">
            ⚙️ Calibration Controls & Uploader (Click to adjust confidence / change image)
          </summary>
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7">
              <SonarUploader
                selectedFile={selectedFile}
                onFileSelected={handleFileSelected}
                isDetecting={isDetecting}
              />
            </div>
            <div className="lg:col-span-5">
              <ControlsPanel
                confidenceThreshold={confidenceThreshold}
                setConfidenceThreshold={setConfidenceThreshold}
                iouThreshold={iouThreshold}
                setIouThreshold={setIouThreshold}
                enablePreprocessing={enablePreprocessing}
                setEnablePreprocessing={setEnablePreprocessing}
                onRunDetection={handleRunDetection}
                isDetecting={isDetecting}
                hasImage={!!selectedFile}
                hasResults={!!detectionResult}
                onResetUpload={() => handleFileSelected(null)}
                onDownloadAnnotated={handleDownloadAnnotated}
                onExportJson={handleExportJson}
                activeView={activeView}
                setActiveView={setActiveView}
              />
            </div>
          </div>
        </details>
      )}

      {/* Main Analysis Section matching Reference Screenshot */}
      {detectionResult && (
        <div className="space-y-6 animate-fadeIn">
          {/* Main 2-Column Grid: Viewer on left, Table + Info Card on right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Interactive Deep-Zoom Sonar Viewer */}
            <div className="lg:col-span-7 xl:col-span-8">
              <SonarViewer
                detectionResult={detectionResult}
                activeView={activeView}
                setActiveView={setActiveView}
                selectedDetectionId={selectedDetectionId}
                hoveredDetectionId={hoveredDetectionId}
                onSelectDetection={setSelectedDetectionId}
                onHoverDetection={setHoveredDetectionId}
              />
            </div>

            {/* Right: Detected Targets Table & Image Information Card */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-6">
              <DetectionTable
                detections={detectionResult.detections}
                selectedDetectionId={selectedDetectionId}
                hoveredDetectionId={hoveredDetectionId}
                onSelectDetection={setSelectedDetectionId}
                onHoverDetection={setHoveredDetectionId}
                confidenceThreshold={confidenceThreshold}
              />

              <ImageInfoCard
                filename={selectedFile?.name || detectionResult.image_id || 'sample_sonar_image6.jpg'}
                dimensions={{
                  width: detectionResult.image_width || (detectionResult.stage_images?.original ? 800 : 1024),
                  height: detectionResult.image_height || (detectionResult.stage_images?.original ? 600 : 2048),
                }}
                location="9.3142°N, 79.1821°E"
                altitude="28m AGL"
                detectionCount={detectionResult.detections?.length || 0}
                model="sonar_v2.pt + EfficientNet-B0"
                processingTimeMs={Math.round(detectionResult.processing_time_ms || 84)}
              />

            </div>
          </div>

          {/* Bottom Action Cards */}
          <ActionCards
            onUploadClick={() => handleFileSelected(null)}
            onExportClick={handleExportJson}
          />
        </div>
      )}
    </div>
  );
}
