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
    const playerId = playerIdParam || '1';

    const [isPlaying, setIsPlaying] = useState(false);
    const [result, setResult] = useState(null);
    const [loadProgress, setLoadProgress] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);
    const [opponentResults, setOpponentResults] = useState({});
    const [allPlayersReady, setAllPlayersReady] = useState(false);

    // ルームIDとプレイヤーIDの検証
    useEffect(() => {
        if (!roomId) {
            router.push('/battle/create');
            return;
        }

        // playerIdが5以上の場合、または満員の場合に弾く
        const playerIdNum = parseInt(playerId);
        if (playerIdNum > 4) {
            alert('このルームは満員です（最大4人）');
            router.push('/battle/join');
            return;
        }

        // 既存のプレイヤー数を確認
        const existingPlayers = [];
        for (let i = 1; i <= 4; i++) {
            // 結果をチェック
            const result = localStorage.getItem(`battle_result_${roomId}_player_${i}`);
            if (result) {
                try {
                    const data = JSON.parse(result);
                    if (Date.now() - data.timestamp < 10 * 60 * 1000) {
                        existingPlayers.push(i);
                        continue;
                    }
                } catch (e) {
                    console.error('Failed to parse result:', e);
                }
            }

            // 開始フラグをチェック
            const startFlag = localStorage.getItem(`battle_start_${roomId}_player_${i}`);
            if (startFlag === 'true') {
                existingPlayers.push(i);
            }
        }

        // 現在のプレイヤーが既存のプレイヤーリストに含まれていない場合
        // かつ、既に4人参加している場合は弾く
        if (!existingPlayers.includes(playerIdNum) && existingPlayers.length >= 4) {
            alert('このルームは満員です（最大4人）');
            router.push('/battle/join');
            return;
        }
    }, [roomId, playerId, router]);

    // 他のプレイヤーの結果を監視
    useEffect(() => {
        if (!roomId) return;

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
        if (!roomId || !isLoaded) return;

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
        if (!isLoaded || !roomId) return;

        // 開始フラグを設定（実際の開始は全員が準備完了になるまで待つ）
        localStorage.setItem(`battle_start_${roomId}_player_${playerId}`, 'true');

        // SE再生フラグをクリア（新しいゲーム開始時）
        localStorage.removeItem(`battle_sound_played_${roomId}_player_${playerId}`);

        // 既存の開始時刻をクリアしない（既に設定されている場合はそのまま使用）
    };

    const handleGameEnd = (winner) => {
        // 既に結果が設定されている場合は処理をスキップ（重複実行を防ぐ）
        if (result !== null) return;

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
        if (!roomId) return null;

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

