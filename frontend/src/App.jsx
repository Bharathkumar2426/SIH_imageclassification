import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { SonarAnalysisPage } from './pages/SonarAnalysisPage';
import { SonarMapPage } from './pages/SonarMapPage';
import { MaritimeIncidentPage } from './pages/MaritimeIncidentPage';
import { getHealth } from './services/api';

export default function App() {
  const [healthData, setHealthData] = useState(null);
  const [activeTab, setActiveTab] = useState('analysis');
  const [detectionResult, setDetectionResult] = useState(null);
  const [selectedTargetId, setSelectedTargetId] = useState(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const data = await getHealth();
        setHealthData(data);
      } catch (err) {
        console.warn("Backend not yet connected:", err);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleViewOnMap = (targetId) => {
    setSelectedTargetId(targetId);
    setActiveTab('map');
  };

  const detectionCount = detectionResult?.detections?.length || 0;

  return (
    <div className="min-h-screen bg-ocean-950 text-slate-100 flex flex-col font-sans">
      <Navbar 
        healthData={healthData} 
        activeTab={activeTab}
        onTabChange={setActiveTab}
        detectionCount={detectionCount}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'analysis' ? (
          <SonarAnalysisPage 
            healthData={healthData}
            detectionResult={detectionResult}
            setDetectionResult={setDetectionResult}
            selectedDetectionId={selectedTargetId}
            setSelectedDetectionId={setSelectedTargetId}
            onViewOnMap={handleViewOnMap}
          />
        ) : activeTab === 'map' ? (
          <SonarMapPage
            detectionResult={detectionResult}
            selectedTargetId={selectedTargetId}
            onSelectTarget={setSelectedTargetId}
            onSwitchToAnalysis={() => setActiveTab('analysis')}
          />
        ) : (
          <MaritimeIncidentPage 
            onSwitchToSonar={() => setActiveTab('analysis')}
          />
        )}
      </main>

      <footer className="border-t border-ocean-850 bg-ocean-900 px-6 py-4 text-xs text-slate-500 font-mono text-center">
        SIH26057 Ministry of Earth Sciences (MoES) • Automated Underwater Marine Debris & Anomaly Detection • v1.0.0
      </footer>
    </div>
  );
}
