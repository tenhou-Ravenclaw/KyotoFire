'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ThreeCanvas from '../../components/ThreeCanvas';
import GameUI from '../../components/GameUI';
import { GameState } from '../../lib/state';
import { AudioController } from '../../lib/audio';

export default function BattlePage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const roomId = searchParams.get('room');
    const playerIdParam = searchParams.get('player');
    const playerId = playerIdParam || null; // playerIdが未指定の場合はnull

    const [isPlaying, setIsPlaying] = useState(false);
    const [result, setResult] = useState(null);
    const [loadProgress, setLoadProgress] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);
    const [opponentResults, setOpponentResults] = useState({});
    const [allPlayersReady, setAllPlayersReady] = useState(false);
    const [pendingPlayers, setPendingPlayers] = useState([]);
    const [isHost, setIsHost] = useState(false);
    const [assignedPlayerId, setAssignedPlayerId] = useState(null);

    // ルームIDの検証と待合画面の処理
    useEffect(() => {
        if (!roomId) {
            router.push('/battle/create');
            return;
        }

        // playerIdが未指定の場合、待合画面モード
        if (!playerId) {
            // 自分のセッションIDを取得
            const mySessionId = localStorage.getItem(`battle_session_${roomId}`);
            const hostSessionId = localStorage.getItem(`battle_host_${roomId}`);

            // ホストかどうかを判定
            setIsHost(mySessionId === hostSessionId);

            // 参加者リストを更新
            const updatePendingPlayers = () => {
                const pendingKey = `battle_pending_${roomId}`;
                const pendingData = localStorage.getItem(pendingKey);
                let players = [];

                if (pendingData) {
                    try {
                        players = JSON.parse(pendingData);
                        // 古い参加者（5分以上経過）を削除
                        const now = Date.now();
                        players = players.filter(p => now - p.timestamp < 5 * 60 * 1000);
                        // 更新されたリストを保存
                        if (players.length !== JSON.parse(pendingData).length) {
                            localStorage.setItem(pendingKey, JSON.stringify(players));
                        }
                    } catch (e) {
                        console.error('Failed to parse pending data:', e);
                        players = [];
                    }
                }
                setPendingPlayers(players);
            };

            updatePendingPlayers();
            const interval = setInterval(updatePendingPlayers, 1000);

            return () => clearInterval(interval);
        }

        // playerIdが指定されている場合、通常のゲームモード
        const playerIdNum = parseInt(playerId);
        if (playerIdNum > 4) {
            alert('このルームは満員です（最大4人）');
            router.push('/battle/join');
            return;
        }
    }, [roomId, playerId, router]);

    // 割り当てられたIDを確認（待合画面モード）
    useEffect(() => {
        if (!roomId || playerId) return; // playerIdが既にある場合はスキップ

        const checkAssignedId = () => {
            const mySessionId = localStorage.getItem(`battle_session_${roomId}`);
            if (!mySessionId) return;

            // 割り当てられたIDを確認
            for (let i = 1; i <= 4; i++) {
                const assigned = localStorage.getItem(`battle_assigned_${roomId}_player_${i}`);
                if (assigned) {
                    try {
                        const data = JSON.parse(assigned);
                        if (data.sessionId === mySessionId) {
                            // 自分のIDが割り当てられた
                            setAssignedPlayerId(i.toString());
                            // URLを更新してゲーム画面に遷移
                            router.replace(`/battle?room=${roomId}&player=${i}`);
                            return;
                        }
                    } catch (e) {
                        console.error('Failed to parse assigned data:', e);
                    }
                }
            }
        };

        checkAssignedId();
        const interval = setInterval(checkAssignedId, 500);

        return () => clearInterval(interval);
    }, [roomId, playerId, router]);

    // 他のプレイヤーの結果を監視
    useEffect(() => {
        if (!roomId || !playerId) return;

        const checkOpponentResults = () => {
            const results = {};
            for (let i = 1; i <= 4; i++) {
                if (i.toString() !== playerId) {
                    const stored = localStorage.getItem(`battle_result_${roomId}_player_${i}`);
                    if (stored) {
                        try {
                            const data = JSON.parse(stored);
                            // 最近の結果（10分以内）のみ有効
                            if (Date.now() - data.timestamp < 10 * 60 * 1000) {
                                results[i] = data;
                            }
                        } catch (e) {
                            console.error('Failed to parse result:', e);
                        }
                    }
                }
            }
            setOpponentResults(results);
        };

        const interval = setInterval(checkOpponentResults, 1000);
        checkOpponentResults(); // 初回実行

        return () => clearInterval(interval);
    }, [roomId, playerId]);

    // 全プレイヤーの準備状況を確認し、全員が準備完了になったら開始時刻を設定
    useEffect(() => {
        if (!roomId || !isLoaded || !playerId) return;

        const checkAllReady = () => {
            const startFlags = {};
            for (let i = 1; i <= 4; i++) {
                const stored = localStorage.getItem(`battle_start_${roomId}_player_${i}`);
                if (stored === 'true') {
                    startFlags[i] = true;
                }
            }
            const readyCount = Object.keys(startFlags).length;
            setAllPlayersReady(readyCount >= 2);

            // 全員が準備完了（少なくとも2人以上）の場合
            if (readyCount >= 2) {
                // 開始時刻が設定されていない場合、設定する
                const startTimeKey = `battle_start_time_${roomId}`;
                let startTime = localStorage.getItem(startTimeKey);

                if (!startTime) {
                    // 開始時刻を設定（現在時刻から3秒後）
                    const startTimeValue = Date.now() + 3000; // 3秒のカウントダウン
                    localStorage.setItem(startTimeKey, startTimeValue.toString());
                    startTime = startTimeValue.toString();
                }

                // 開始時刻をチェック
                const startTimeValue = parseInt(startTime);
                const now = Date.now();

                if (now >= startTimeValue && !isPlaying) {
                    // 開始時刻になったらゲームを開始
                    setIsPlaying(true);
                    setResult(null);
                    setOpponentResults({});
                }
            }
        };

        const interval = setInterval(checkAllReady, 100); // 100msごとにチェック
        checkAllReady();

        return () => clearInterval(interval);
    }, [roomId, isLoaded, isPlaying]);

    const handleStart = () => {
        if (!roomId) return;

        // 待合画面モードの場合、IDを割り当てる（isLoadedのチェックは不要）
        if (!playerId && isHost) {
            // 参加者リストを取得
            const pendingKey = `battle_pending_${roomId}`;
            const pendingData = localStorage.getItem(pendingKey);
            if (!pendingData) return;

            let players = [];
            try {
                players = JSON.parse(pendingData);
                // 古い参加者を削除
                const now = Date.now();
                players = players.filter(p => now - p.timestamp < 5 * 60 * 1000);
            } catch (e) {
                console.error('Failed to parse pending data:', e);
                return;
            }

            // 参加者にID（1-4）を割り当て
            const maxPlayers = Math.min(players.length, 4);
            for (let i = 0; i < maxPlayers; i++) {
                const player = players[i];
                const assignedId = (i + 1).toString();

                const assignedData = {
                    sessionId: player.sessionId,
                    playerId: assignedId,
                    timestamp: Date.now()
                };

                localStorage.setItem(`battle_assigned_${roomId}_player_${assignedId}`, JSON.stringify(assignedData));

                // 各プレイヤーに開始フラグを設定（全員が準備完了として扱う）
                localStorage.setItem(`battle_start_${roomId}_player_${assignedId}`, 'true');
            }

            // 開始時刻を設定（現在時刻から3秒後）
            const startTimeValue = Date.now() + 3000; // 3秒のカウントダウン
            localStorage.setItem(`battle_start_time_${roomId}`, startTimeValue.toString());

            // 自分のIDを確認してゲーム画面に遷移
            const mySessionId = localStorage.getItem(`battle_session_${roomId}`);
            if (mySessionId) {
                for (let i = 1; i <= maxPlayers; i++) {
                    const assigned = localStorage.getItem(`battle_assigned_${roomId}_player_${i}`);
                    if (assigned) {
                        try {
                            const data = JSON.parse(assigned);
                            if (data.sessionId === mySessionId) {
                                router.replace(`/battle?room=${roomId}&player=${i}`);
                                return;
                            }
                        } catch (e) {
                            console.error('Failed to parse assigned data:', e);
                        }
                    }
                }
            }

            return;
        }

        // 通常モードの場合、開始フラグを設定（isLoadedをチェック）
        if (playerId) {
            if (!isLoaded) return;
            localStorage.setItem(`battle_start_${roomId}_player_${playerId}`, 'true');
            localStorage.removeItem(`battle_sound_played_${roomId}_player_${playerId}`);
        }
    };

    const handleGameEnd = (winner) => {
        // 既に結果が設定されている場合は処理をスキップ（重複実行を防ぐ）
        if (result !== null) return;

        // playerIdが未指定の場合はスキップ（待合画面モード）
        if (!playerId) return;

        setIsPlaying(false);
        setResult(winner);

        if (!roomId) {
            // ローカルモードの場合
            const currentPlayerKey = `P${playerId}`;
            const isWinner = currentPlayerKey === winner;
            if (isWinner && winner !== 'DRAW') {
                AudioController.playFanfare();
            } else if (winner !== 'DRAW') {
                AudioController.playFailure();
            }
            return;
        }

        // 開始時刻と開始フラグをクリア
        localStorage.removeItem(`battle_start_time_${roomId}`);
        localStorage.removeItem(`battle_start_${roomId}_player_${playerId}`);

        // 結果をローカルストレージに保存（延焼を含めた率）
        // Use P1 slot for odd playerIds (1, 3), P2 slot for even playerIds (2, 4)
        const isOddPlayer = parseInt(playerId) % 2 === 1;
        const currentPlayerPercentage = isOddPlayer ? GameState.p1.burntPercentage : GameState.p2.burntPercentage;
        const currentPlayerCount = isOddPlayer ? GameState.p1.burntCount : GameState.p2.burntCount;

        const gameResult = {
            player: playerId,
            winner: winner,
            score: currentPlayerPercentage, // 延焼を含めた燃やした建物の率
            count: currentPlayerCount, // 参考用（建物数）
            totalBuildings: GameState.stats.totalBuildings,
            timestamp: Date.now()
        };
        localStorage.setItem(`battle_result_${roomId}_player_${playerId}`, JSON.stringify(gameResult));

        // 勝敗に応じてSEを再生（opponentResultsの更新を待つ）
        // 一度だけ実行されるように、フラグをlocalStorageに保存
        const soundPlayedKey = `battle_sound_played_${roomId}_player_${playerId}`;
        if (localStorage.getItem(soundPlayedKey)) {
            return; // 既にSEが再生されている場合はスキップ
        }
        localStorage.setItem(soundPlayedKey, 'true');

        setTimeout(() => {
            const finalResult = calculateFinalResult();
            if (finalResult && finalResult.winners.length > 0) {
                const isWinner = finalResult.winners.includes(playerId);
                if (isWinner) {
                    AudioController.playFanfare();
                } else {
                    AudioController.playFailure();
                }
            } else {
                // finalResultが取得できない場合のフォールバック
                // ローカルモードの判定を使用
                const currentPlayerKey = `P${playerId}`;
                const isWinner = currentPlayerKey === winner;
                if (isWinner && winner !== 'DRAW') {
                    AudioController.playFanfare();
                } else if (winner !== 'DRAW') {
                    AudioController.playFailure();
                }
            }
        }, 500); // 500ms待ってから判定（opponentResultsの更新を待つ）
    };

    const handleLoadProgress = (percent) => {
        setLoadProgress(percent);
        if (percent >= 100) {
            setTimeout(() => setIsLoaded(true), 500);
        }
    };

    // 最終結果の計算
    const calculateFinalResult = () => {
        if (!roomId || !playerId) return null;

        // 現在のプレイヤーのスコア（延焼を含めた率）
        // Use P1 slot for odd playerIds (1, 3), P2 slot for even playerIds (2, 4)
        const isOddPlayer = parseInt(playerId) % 2 === 1;
        const currentPlayerPercentage = isOddPlayer ? GameState.p1.burntPercentage : GameState.p2.burntPercentage;
        const currentPlayerCount = isOddPlayer ? GameState.p1.burntCount : GameState.p2.burntCount;

        const allResults = {
            [playerId]: {
                player: playerId,
                score: currentPlayerPercentage, // 率（%）
                count: currentPlayerCount
            }
        };

        // 他のプレイヤーの結果を追加
        Object.values(opponentResults).forEach(result => {
            allResults[result.player] = {
                player: result.player,
                score: result.score || 0, // 率（%）
                count: result.count || 0 // 建物数
            };
        });

        // 全プレイヤーのスコアを集計（率で比較）
        let maxScore = 0;
        let winners = [];
        Object.values(allResults).forEach(result => {
            const score = result.score || 0;
            if (score > maxScore) {
                maxScore = score;
                winners = [result.player];
            } else if (score === maxScore && score > 0) {
                winners.push(result.player);
            }
        });

        return {
            winners,
            allResults,
            maxScore
        };
    };

    const finalResult = calculateFinalResult();

    // 待合画面モード
    if (!playerId) {
        return (
            <main style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', backgroundColor: '#000', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#fff' }}>
                <div style={{
                    background: '#1a1a1a',
                    padding: '2rem',
                    borderRadius: '12px',
                    minWidth: '500px',
                    textAlign: 'center'
                }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                        待合室
                    </h1>
                    <div style={{ marginBottom: '1.5rem', color: '#888' }}>
                        ルームID: <span style={{ color: '#fff', fontWeight: 'bold', letterSpacing: '0.1em' }}>{roomId}</span>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: '#aaa' }}>
                            参加者 ({pendingPlayers.length}/4)
                        </div>
                        <div style={{ background: '#2a2a2a', padding: '1rem', borderRadius: '8px', minHeight: '100px' }}>
                            {pendingPlayers.length === 0 ? (
                                <div style={{ color: '#666' }}>参加者を待っています...</div>
                            ) : (
                                pendingPlayers.map((player, index) => (
                                    <div key={player.sessionId} style={{
                                        padding: '0.5rem',
                                        marginBottom: '0.5rem',
                                        background: player.isHost ? '#3b82f6' : '#333',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <span>
                                            {player.isHost ? '👑 ' : ''}プレイヤー {index + 1}
                                        </span>
                                        {assignedPlayerId && assignedPlayerId === (index + 1).toString() && (
                                            <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓ 割り当て済み</span>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {isHost ? (
                        <div>
                            <button
                                onClick={handleStart}
                                disabled={pendingPlayers.length < 2}
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    fontSize: '1.25rem',
                                    fontWeight: 'bold',
                                    background: pendingPlayers.length < 2 ? '#666' : '#ef4444',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: pendingPlayers.length < 2 ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {pendingPlayers.length < 2 ? '参加者を待っています...' : 'GAME START'}
                            </button>
                            {pendingPlayers.length < 2 && (
                                <div style={{ marginTop: '0.5rem', color: '#888', fontSize: '0.9rem' }}>
                                    少なくとも2人必要です
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ color: '#888', fontSize: '1rem' }}>
                            ホストがゲームを開始するのを待っています...
                        </div>
                    )}
                </div>
            </main>
        );
    }

    // 通常のゲーム画面
    return (
        <main style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', backgroundColor: '#000' }}>
            {/* プレイヤーID表示 */}
            <div style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                zIndex: 100,
                color: '#fff',
                fontSize: '1.2rem',
                fontWeight: 'bold',
                background: playerId === '1' ? '#3b82f6' : playerId === '2' ? '#ef4444' : playerId === '3' ? '#10b981' : '#f59e0b',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
            }}>
                Player {playerId} | Room: {roomId}
            </div>


            <ThreeCanvas
                isPlaying={isPlaying}
                onUpdate={() => { }}
                onGameEnd={handleGameEnd}
                onLoadProgress={handleLoadProgress}
                playerId={playerId}
                roomId={roomId}
            />

            <GameUI
                isPlaying={isPlaying}
                onStart={handleStart}
                result={result}
                isLoaded={isLoaded}
                loadProgress={loadProgress}
                playerId={playerId}
                roomId={roomId}
                opponentResults={opponentResults}
                finalResult={finalResult}
            />
        </main>
    );
}

