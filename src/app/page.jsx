'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ThreeCanvas from '../components/ThreeCanvas';
import GameUI from '../components/GameUI';

export default function Home() {
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(false);
  const [result, setResult] = useState(null); // 'P1' or 'P2' or null
  const [loadProgress, setLoadProgress] = useState(0); // 0 to 100
  const [isLoaded, setIsLoaded] = useState(false);
  const [showMenu, setShowMenu] = useState(true);

  const handleStart = () => {
    if (!isLoaded) return;
    setIsPlaying(true);
    setResult(null);
    setShowMenu(false);
  };

  const handleBattle = () => {
    // ルーム作成ページに遷移
    router.push('/battle/create');
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
      {showMenu ? (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 100,
          background: 'rgba(0, 0, 0, 0.95)'
        }}>
          <h1 style={{ fontSize: '4rem', fontWeight: 'bold', marginBottom: '1rem', color: '#fff', textShadow: '0 0 20px rgba(255, 0, 0, 0.5)' }}>
            🔥 INFERNO CITY
          </h1>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '3rem', color: '#888' }}>
            炎上都市 - 延焼対戦シミュレーター
          </h2>
          <button
            onClick={handleBattle}
            style={{
              padding: '1rem 3rem',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              marginBottom: '1rem',
              transition: 'all 0.2s',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
            }}
            onMouseOver={(e) => e.target.style.background = '#dc2626'}
            onMouseOut={(e) => e.target.style.background = '#ef4444'}
          >
            対戦モード
          </button>
          <button
            onClick={handleStart}
            disabled={!isLoaded}
            style={{
              padding: '1rem 3rem',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              background: isLoaded ? '#3b82f6' : '#666',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: isLoaded ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
            }}
            onMouseOver={(e) => {
              if (isLoaded) e.target.style.background = '#2563eb';
            }}
            onMouseOut={(e) => {
              if (isLoaded) e.target.style.background = '#3b82f6';
            }}
          >
            ローカル対戦
          </button>
          {!isLoaded && (
            <div style={{ marginTop: '2rem', color: '#888', fontSize: '0.875rem' }}>
              読み込み中... {Math.round(loadProgress)}%
            </div>
          )}
        </div>
      ) : null}

      {/* 3D Layer - Always render to allow loading in background */}
      <ThreeCanvas 
        isPlaying={isPlaying}
        onUpdate={() => {}} 
        onGameEnd={handleGameEnd}
        onLoadProgress={handleLoadProgress}
      />
      
      {/* UI Layer */}
      {!showMenu && (
        <GameUI 
          isPlaying={isPlaying} 
          onStart={handleStart} 
          result={result}
          isLoaded={isLoaded}
          loadProgress={loadProgress}
        />
      )}
    </main>
  );
}



