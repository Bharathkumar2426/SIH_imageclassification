import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { SonarAnalysisPage } from './pages/SonarAnalysisPage';
import { getHealth } from './services/api';

export default function App() {
  const [healthData, setHealthData] = useState(null);

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

  return (
    <div className="min-h-screen bg-ocean-950 text-slate-100 flex flex-col font-sans">
      <Navbar healthData={healthData} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <SonarAnalysisPage healthData={healthData} />
      </main>

      <footer className="border-t border-ocean-850 bg-ocean-900 px-6 py-4 text-xs text-slate-500 font-mono text-center">
        SIH26057 Ministry of Earth Sciences (MoES) • Automated Underwater Marine Debris & Anomaly Detection • v1.0.0
      </footer>
    </div>
  );
}
