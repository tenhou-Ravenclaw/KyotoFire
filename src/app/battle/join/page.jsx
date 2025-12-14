'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function JoinRoomPage() {
    const router = useRouter();
    const [roomId, setRoomId] = useState('');
    const [error, setError] = useState('');

    const handleJoinRoom = () => {
        if (!roomId.trim()) {
            setError('ルームIDを入力してください');
            return;
        }

        // ルームIDを正規化（大文字に変換）
        const normalizedRoomId = roomId.trim().toUpperCase();

        // 利用可能なプレイヤーIDを取得
        const playerId = getAvailablePlayerId(normalizedRoomId);

        if (playerId === null) {
            setError('このルームは満員です（最大4人）');
            return;
        }

        // 対戦ページに遷移
        router.push(`/battle?room=${normalizedRoomId}&player=${playerId}`);
    };

    const getAvailablePlayerId = (roomId) => {
        // 既存のプレイヤーを確認（結果と開始フラグの両方をチェック）
        const existingPlayers = [];
        for (let i = 1; i <= 4; i++) {
            // 結果をチェック
            const result = localStorage.getItem(`battle_result_${roomId}_player_${i}`);
            if (result) {
                try {
                    const data = JSON.parse(result);
                    // 最近の結果（10分以内）があれば、そのプレイヤーは参加中とみなす
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

        // 空いているプレイヤーIDを返す
        for (let i = 1; i <= 4; i++) {
            if (!existingPlayers.includes(i)) {
                return i;
            }
        }
        return null; // 満員（最大4人）
    };

    return (
        <main style={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            background: '#000',
            color: '#fff'
        }}>
            <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '2rem' }}>
                ルームに参加
            </h1>

            <div style={{
                background: '#1a1a1a',
                padding: '2rem',
                borderRadius: '12px',
                minWidth: '400px',
                textAlign: 'center'
            }}>
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '1.1rem' }}>
                        ルームIDを入力
                    </label>
                    <input
                        type="text"
                        value={roomId}
                        onChange={(e) => {
                            setRoomId(e.target.value);
                            setError('');
                        }}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                handleJoinRoom();
                            }
                        }}
                        placeholder="例: ABC123"
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            fontSize: '1.5rem',
                            fontWeight: 'bold',
                            textAlign: 'center',
                            background: '#2a2a2a',
                            color: '#fff',
                            border: error ? '2px solid #ef4444' : '2px solid #444',
                            borderRadius: '6px',
                            letterSpacing: '0.2em',
                            textTransform: 'uppercase'
                        }}
                        maxLength={6}
                    />
                    {error && (
                        <div style={{ marginTop: '0.5rem', color: '#ef4444', fontSize: '0.9rem' }}>
                            {error}
                        </div>
                    )}
                </div>

                <button
                    onClick={handleJoinRoom}
                    disabled={!roomId.trim()}
                    style={{
                        width: '100%',
                        padding: '1rem',
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        background: !roomId.trim() ? '#666' : '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: !roomId.trim() ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    参加する
                </button>

                <button
                    onClick={() => router.push('/battle/create')}
                    style={{
                        width: '100%',
                        marginTop: '1rem',
                        padding: '0.75rem',
                        fontSize: '1rem',
                        background: 'transparent',
                        color: '#888',
                        border: '1px solid #444',
                        borderRadius: '8px',
                        cursor: 'pointer'
                    }}
                >
                    ルームを作成する
                </button>

                <button
                    onClick={() => router.push('/')}
                    style={{
                        width: '100%',
                        marginTop: '0.5rem',
                        padding: '0.5rem',
                        fontSize: '0.875rem',
                        background: 'transparent',
                        color: '#666',
                        border: 'none',
                        cursor: 'pointer'
                    }}
                >
                    ホームに戻る
                </button>
            </div>
        </main>
    );
}

