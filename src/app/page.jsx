'use client';

import { useState } from 'react';
import ThreeCanvas from '../components/ThreeCanvas';
import GameUI from '../components/GameUI';

export default function Home() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [result, setResult] = useState(null); // 'P1' or 'P2' or null
  const [loadProgress, setLoadProgress] = useState(0); // 0 to 100
  const [isLoaded, setIsLoaded] = useState(false);

  const handleStart = () => {
    if (!isLoaded) return;
    setIsPlaying(true);
    setResult(null);
  };

  const handleGameEnd = (winner) => {
    setIsPlaying(false);
    setResult(winner);
  };

  const handleLoadProgress = (percent) => {
    setLoadProgress(percent);
    if (percent >= 100) {
      setTimeout(() => setIsLoaded(true), 500); // Small delay for smooth transition
    }
  };

  return (
    <main style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', backgroundColor: '#000' }}>
      {/* 3D Layer - Always render to allow loading in background */}
      <ThreeCanvas 
        onUpdate={() => {}} 
        onGameEnd={handleGameEnd}
        onLoadProgress={handleLoadProgress}
      />
      
      {/* UI Layer */}
      <GameUI 
        isPlaying={isPlaying} 
        onStart={handleStart} 
        result={result}
        isLoaded={isLoaded}
        loadProgress={loadProgress}
      />
    </main>
  );
}

