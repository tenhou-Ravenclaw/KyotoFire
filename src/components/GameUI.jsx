'use client';

import { useEffect, useRef, useState } from 'react';
import { GameState } from '../lib/state';

export default function GameUI({ isPlaying, onStart, result, isLoaded, loadProgress }) {
    const [_, setTick] = useState(0); 
    const timerRef = useRef(null);
    const p1BudgetRef = useRef(null);
    const p2CooldownRef = useRef(null);
    const damageBarRef = useRef(null);
    const damageTextRef = useRef(null);
    const phaseRef = useRef(null);

    // Fast update loop for UI (decoupled from React render cycle)
    useEffect(() => {
        if (!isPlaying) return;

        let reqId;
        const updateLoop = () => {
            if (timerRef.current) {
                const t = Math.ceil(GameState.timer);
                timerRef.current.innerText = t;
                timerRef.current.style.color = t < 10 ? 'red' : 'white';
            }
            if (phaseRef.current) {
                phaseRef.current.innerText = GameState.phase + " PHASE";
            }
            if (p1BudgetRef.current) {
                p1BudgetRef.current.innerText = "¥" + Math.floor(GameState.p1.budget).toLocaleString();
            }
            if (p2CooldownRef.current) {
                const cd = GameState.p2.cooldown;
                if (GameState.phase === 'SETUP') {
                    p2CooldownRef.current.innerText = "LOCKED";
                    p2CooldownRef.current.style.color = "#888";
                } else if (cd <= 0) {
                    p2CooldownRef.current.innerText = "READY!";
                    p2CooldownRef.current.style.color = "#ff4444";
                } else {
                    p2CooldownRef.current.innerText = cd.toFixed(1) + "s";
                    p2CooldownRef.current.style.color = "#884444";
                }
            }
            if (damageBarRef.current && damageTextRef.current) {
                const dmg = GameState.stats.damagePercent;
                damageBarRef.current.style.width = dmg + "%";
                damageTextRef.current.innerText = `Damage: ${dmg.toFixed(1)}% / 50%`;
                damageBarRef.current.style.background = dmg > 40 ? "#ff0000" : "#ff8800";
            }
            
            reqId = requestAnimationFrame(updateLoop);
        };
        updateLoop();

        return () => cancelAnimationFrame(reqId);
    }, [isPlaying]);

    return (
        <div className="absolute-fill pointer-none flex-col justify-between p-5" style={{ zIndex: 10 }}>
            {/* HUD TOP */}
            <div className="hud-container">
                <div className="text-left text-blue">
                    <div className="text-label">Player 1 (Defense)</div>
                    <div className="text-value" ref={p1BudgetRef}>¥2,000</div>
                    <div className="text-hint">Left Click: Wall (¥100) / Extinguish (¥300)</div>
                </div>
                
                <div className="text-right text-red">
                    <div className="text-label">Player 2 (Offense)</div>
                    <div className="text-value" ref={p2CooldownRef}>READY</div>
                    <div className="text-hint">Right Click / Shift+Click: Ignite</div>
                </div>
            </div>

            {/* CENTER INFO */}
            <div className="center-info">
                <div className="phase-label" ref={phaseRef}>SETUP PHASE</div>
                <div className="timer-text" ref={timerRef}>15</div>
                <div className="damage-bar-bg">
                    <div className="damage-bar-fill" ref={damageBarRef} style={{width: '0%'}}></div>
                </div>
                <div style={{fontSize: '0.875rem', fontWeight: 'bold', marginTop: '0.25rem'}} ref={damageTextRef}>Damage: 0%</div>
            </div>

            {/* OVERLAY (Start / Result / Loading) */}
            {(!isPlaying || result) && (
                <div className="overlay pointer-auto">
                    <div className="title-lg">INFERNO CITY</div>
                    <div className="subtitle">炎上都市 | P1: Build Walls | P2: Burn Everything</div>
                    
                    {result ? (
                        <div className="result-box">
                            <div style={{fontSize: '3rem', fontWeight: 'bold', color: result === 'P1' ? '#3b82f6' : '#ef4444'}}>
                                {result === 'P1' ? 'DEFENSE WINS' : 'OFFENSE WINS'}
                            </div>
                            <div style={{fontSize: '1.25rem', marginTop: '0.5rem'}}>
                                {result === 'P1' ? 'City Saved.' : 'The City is Ashes.'}
                            </div>
                        </div>
                    ) : null}

                    {!isLoaded ? (
                        <div className="flex-col items-center">
                            <div style={{fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem'}}>
                                LOADING CITY... {Math.round(loadProgress)}%
                            </div>
                            <div style={{width: '20rem', height: '0.5rem', background: '#333', borderRadius: '4px'}}>
                                <div style={{width: `${loadProgress}%`, height: '100%', background: 'white', transition: 'width 0.2s'}}></div>
                            </div>
                        </div>
                    ) : (
                        <button 
                            onClick={onStart}
                            className="btn-start"
                        >
                            {result ? 'PLAY AGAIN' : 'START GAME'}
                        </button>
                    )}
                    
                    <div style={{marginTop: '2rem', color: '#6b7280', fontSize: '0.875rem'}}>
                        Controls: WASD + Space/Shift to Move Camera
                    </div>
                </div>
            )}
        </div>
    );
}

