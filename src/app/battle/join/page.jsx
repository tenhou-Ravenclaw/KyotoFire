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

        // 参加者数を確認（最大4人）
        const pendingKey = `battle_pending_${normalizedRoomId}`;
        const pendingData = localStorage.getItem(pendingKey);
        let pendingPlayers = [];

        if (pendingData) {
            try {
                pendingPlayers = JSON.parse(pendingData);
                // 古い参加者（5分以上経過）を削除
                const now = Date.now();
                pendingPlayers = pendingPlayers.filter(p => now - p.timestamp < 5 * 60 * 1000);
            } catch (e) {
                console.error('Failed to parse pending data:', e);
                pendingPlayers = [];
            }
        }

        // 既に割り当てられたプレイヤー数を確認
        let assignedCount = 0;
        for (let i = 1; i <= 4; i++) {
            const assigned = localStorage.getItem(`battle_assigned_${normalizedRoomId}_player_${i}`);
            if (assigned) {
                try {
                    const data = JSON.parse(assigned);
                    // 最近の割り当て（10分以内）があればカウント
                    if (Date.now() - data.timestamp < 10 * 60 * 1000) {
                        assignedCount++;
                    }
                } catch (e) {
                    console.error('Failed to parse assigned data:', e);
                }
            }
        }

        // 満員チェック（割り当て済み + 待機中 = 最大4人）
        if (assignedCount + pendingPlayers.length >= 4) {
            setError('このルームは満員です（最大4人）');
            return;
        }

        // 一意のセッションIDを生成
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // 参加者情報を追加
        const newPlayer = {
            sessionId: sessionId,
            timestamp: Date.now()
        };
        pendingPlayers.push(newPlayer);

        // localStorageに保存
        localStorage.setItem(pendingKey, JSON.stringify(pendingPlayers));

        // 自分のセッションIDをsessionStorageに保存（タブごとに独立）
        sessionStorage.setItem(`battle_session_${normalizedRoomId}`, sessionId);

        // 対戦ページに遷移（playerIdなし）
        router.push(`/battle?room=${normalizedRoomId}`);
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

