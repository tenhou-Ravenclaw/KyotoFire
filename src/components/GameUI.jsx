'use client';

import { useEffect, useRef, useState } from 'react';
import { GameState } from '../lib/state';

export default function GameUI({ isPlaying, onStart, result, isLoaded, loadProgress, playerId = '1', roomId = null, opponentResults = {}, finalResult = null }) {
    const [_, setTick] = useState(0); 
    const [countdown, setCountdown] = useState(null);
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
            // Update player displays based on mode
            if (roomId) {
                // 対戦モード: 現在のプレイヤーの情報のみ更新
                // Use P1 slot for odd playerIds (1, 3), P2 slot for even playerIds (2, 4)
                const isOddPlayer = parseInt(playerId) % 2 === 1;
                const playerState = isOddPlayer ? GameState.p1 : GameState.p2;
                const playerRef = isOddPlayer ? p1BudgetRef : p2CooldownRef;
                
                // Calculate current player's score from all buildings
                const totalBuildings = GameState.stats.totalBuildings;
                let currentPlayerCount = 0;
                // This will be updated by ThreeCanvas, but we can also calculate here for display
                // For now, use the playerState's percentage which should be updated correctly
                const percentage = playerState.burntPercentage || 0;
                
                if (playerRef.current) {
                    const cd = playerState.cooldown;
                    if (GameState.phase === 'SETUP') {
                        playerRef.current.innerText = "LOCKED";
                    } else if (cd <= 0) {
                        playerRef.current.innerText = `READY! (${percentage.toFixed(1)}%)`;
                    } else {
                        playerRef.current.innerText = `${cd.toFixed(1)}s (${percentage.toFixed(1)}%)`;
                    }
                    if (!isOddPlayer) {
                        playerRef.current.style.color = cd <= 0 ? "#ff4444" : "#884444";
                    }
                }
            } else {
                // ローカルモード: P1とP2の両方を更新
                if (p1BudgetRef.current) {
                    const cd = GameState.p1.cooldown;
                    const percentage = GameState.p1.burntPercentage || 0;
                    if (GameState.phase === 'SETUP') {
                        p1BudgetRef.current.innerText = "LOCKED";
                    } else if (cd <= 0) {
                        p1BudgetRef.current.innerText = `READY! (${percentage.toFixed(1)}%)`;
                    } else {
                        p1BudgetRef.current.innerText = `${cd.toFixed(1)}s (${percentage.toFixed(1)}%)`;
                    }
                }
                if (p2CooldownRef.current) {
                    const cd = GameState.p2.cooldown;
                    const percentage = GameState.p2.burntPercentage || 0;
                    if (GameState.phase === 'SETUP') {
                        p2CooldownRef.current.innerText = "LOCKED";
                        p2CooldownRef.current.style.color = "#888";
                    } else if (cd <= 0) {
                        p2CooldownRef.current.innerText = `READY! (${percentage.toFixed(1)}%)`;
                        p2CooldownRef.current.style.color = "#ff4444";
                    } else {
                        p2CooldownRef.current.innerText = `${cd.toFixed(1)}s (${percentage.toFixed(1)}%)`;
                        p2CooldownRef.current.style.color = "#884444";
                    }
                }
            }
            if (damageTextRef.current) {
                if (roomId) {
                    // 対戦モード: 自分のスコアのみ表示
                    // Use P1 slot for odd playerIds (1, 3), P2 slot for even playerIds (2, 4)
                    const isOddPlayer = parseInt(playerId) % 2 === 1;
                    const currentPlayerPercentage = isOddPlayer ? (GameState.p1.burntPercentage || 0) : (GameState.p2.burntPercentage || 0);
                    damageTextRef.current.innerText = `${currentPlayerPercentage.toFixed(1)}%`;
                } else {
                    // ローカルモード: P1 vs P2のスコア表示
                    if (damageBarRef.current) {
                        const p1Percentage = GameState.p1.burntPercentage || 0;
                        const p2Percentage = GameState.p2.burntPercentage || 0;
                        const total = p1Percentage + p2Percentage;
                        const p1Percent = total > 0 ? (p1Percentage / total * 100) : 50;
                        damageBarRef.current.style.width = p1Percent + "%";
                        damageBarRef.current.style.background = "#3b82f6";
                    }
                    damageTextRef.current.innerText = `P1: ${GameState.p1.burntPercentage?.toFixed(1) || '0'}% | P2: ${GameState.p2.burntPercentage?.toFixed(1) || '0'}%`;
                }
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
                {roomId ? (
                    // 対戦モード: 自分の情報のみ表示
                    <div className={playerId === '1' ? 'text-left text-blue' : playerId === '2' ? 'text-right text-red' : playerId === '3' ? 'text-left text-green' : 'text-right text-yellow'}>
                        <div className="text-label">Player {playerId}</div>
                        <div className="text-value" ref={playerId === '1' ? p1BudgetRef : p2CooldownRef}>READY</div>
                        <div className="text-hint">Click: Ignite Building</div>
                    </div>
                ) : (
                    // ローカルモード: P1とP2の両方を表示
                    <>
                        <div className="text-left text-blue">
                            <div className="text-label">Player 1</div>
                            <div className="text-value" ref={p1BudgetRef}>READY</div>
                            <div className="text-hint">Left Click: Ignite Building</div>
                        </div>
                        
                        <div className="text-right text-red">
                            <div className="text-label">Player 2</div>
                            <div className="text-value" ref={p2CooldownRef}>READY</div>
                            <div className="text-hint">Right Click / Shift+Click: Ignite Building</div>
                        </div>
                    </>
                )}
            </div>

            {/* CENTER INFO */}
            <div className="center-info">
                <div className="phase-label" ref={phaseRef}>SETUP PHASE</div>
                <div className="timer-text" ref={timerRef}>15</div>
                {roomId ? (
                    // 対戦モード: 自分のスコアのみ表示
                    <div style={{fontSize: '1rem', fontWeight: 'bold', marginTop: '0.5rem', color: '#fff'}}>
                        Your Score: <span ref={damageTextRef}>0%</span>
                    </div>
                ) : (
                    // ローカルモード: P1 vs P2のスコア表示
                    <>
                        <div className="damage-bar-bg">
                            <div className="damage-bar-fill" ref={damageBarRef} style={{width: '0%'}}></div>
                        </div>
                        <div style={{fontSize: '0.875rem', fontWeight: 'bold', marginTop: '0.25rem'}} ref={damageTextRef}>Damage: 0%</div>
                    </>
                )}
            </div>

            {/* OVERLAY (Start / Result / Loading) */}
            {(!isPlaying || result) && (
                <div className="overlay pointer-auto">
                    <div className="title-lg">INFERNO CITY</div>
                    <div className="subtitle">炎上都市 | どちらが多く燃やせるか競争！</div>
                    
                    {result ? (
                        <div className="result-box">
                            {roomId && finalResult ? (
                                // 対戦モード: 全プレイヤーの結果を表示
                                <>
                                    <div style={{fontSize: '3rem', fontWeight: 'bold', color: finalResult.winners.includes(playerId) ? '#10b981' : '#888', marginBottom: '1rem'}}>
                                        {finalResult.winners.length === 1 
                                            ? `PLAYER ${finalResult.winners[0]} WINS!`
                                            : finalResult.winners.length > 1
                                            ? 'DRAW!'
                                            : 'GAME OVER'}
                                    </div>
                                    <div style={{fontSize: '1.25rem', marginTop: '0.5rem', lineHeight: '1.8'}}>
                                        {Object.entries(finalResult.allResults).map(([pId, res]) => (
                                            <div key={pId} style={{
                                                color: pId === playerId ? '#fff' : '#aaa',
                                                fontWeight: pId === playerId ? 'bold' : 'normal'
                                            }}>
                                                Player {pId}: {res.score ? `${res.score.toFixed(1)}%` : '0%'} ({res.count || 0} buildings)
                                                {finalResult.winners.includes(pId) && ' 🏆'}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                // ローカルモード: P1 vs P2
                                <>
                                    <div style={{fontSize: '3rem', fontWeight: 'bold', color: result === 'P1' ? '#3b82f6' : result === 'P2' ? '#ef4444' : '#888'}}>
                                        {result === 'P1' ? 'PLAYER 1 WINS!' : result === 'P2' ? 'PLAYER 2 WINS!' : 'DRAW!'}
                                    </div>
                                    <div style={{fontSize: '1.25rem', marginTop: '0.5rem'}}>
                                        P1: {GameState.p1.burntCount} buildings | P2: {GameState.p2.burntCount} buildings
                                    </div>
                                </>
                            )}
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
                        <>
                            {countdown !== null && countdown > 0 ? (
                                <div style={{
                                    fontSize: '3rem',
                                    fontWeight: 'bold',
                                    color: '#fff',
                                    marginBottom: '1rem',
                                    textShadow: '0 0 20px rgba(255, 0, 0, 0.5)'
                                }}>
                                    ゲーム開始まで: {countdown}秒
                                </div>
                    ) : (
                        <>
                            {countdown !== null && countdown > 0 ? (
                                <div style={{
                                    fontSize: '3rem',
                                    fontWeight: 'bold',
                                    color: '#fff',
                                    marginBottom: '1rem',
                                    textShadow: '0 0 20px rgba(255, 0, 0, 0.5)'
                                }}>
                                    ゲーム開始まで: {countdown}秒
                                </div>
                            ) : (
                                <button 
                                    onClick={onStart}
                                    className="btn-start"
                                >
                                    {result ? 'PLAY AGAIN' : 'START GAME'}
                                </button>
                            )}
                        </>
                    )}
                        </>
                    )}
                    
                    <div style={{marginTop: '2rem', color: '#6b7280', fontSize: '0.875rem'}}>
                        Controls: WASD + Space/Shift to Move Camera
                    </div>
                </div>
            )}
        </div>
    );
}

