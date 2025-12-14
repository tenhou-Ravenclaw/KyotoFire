'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateRoomPage() {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    // ルームIDを自動生成
    const generateRoomId = () => {
      return Math.random().toString(36).substring(2, 8).toUpperCase();
    };
    setRoomId(generateRoomId());
  }, []);

  const handleCreateRoom = () => {
    if (!roomId) return;
    setIsCreating(true);
    
    // ホストとして参加者情報を追加
    const pendingKey = `battle_pending_${roomId}`;
    const sessionId = `host_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const hostPlayer = {
      sessionId: sessionId,
      timestamp: Date.now(),
      isHost: true
    };
    
    localStorage.setItem(pendingKey, JSON.stringify([hostPlayer]));
    localStorage.setItem(`battle_session_${roomId}`, sessionId);
    localStorage.setItem(`battle_host_${roomId}`, sessionId); // ホストのセッションIDを保存
    
    // 対戦ページに遷移（playerIdなし、待合画面に遷移）
    router.push(`/battle?room=${roomId}`);
  };

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    alert('ルームIDをコピーしました！');
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
        ルームを作成
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
            ルームID
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              value={roomId}
              readOnly
              style={{
                flex: 1,
                padding: '0.75rem',
                fontSize: '1.5rem',
                fontWeight: 'bold',
                textAlign: 'center',
                background: '#2a2a2a',
                color: '#fff',
                border: '2px solid #444',
                borderRadius: '6px',
                letterSpacing: '0.2em'
              }}
            />
            <button
              onClick={handleCopyRoomId}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              コピー
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem', color: '#888', fontSize: '0.9rem' }}>
          このルームIDを他のプレイヤーに共有してください
        </div>

        <button
          onClick={handleCreateRoom}
          disabled={isCreating || !roomId}
          style={{
            width: '100%',
            padding: '1rem',
            fontSize: '1.25rem',
            fontWeight: 'bold',
            background: isCreating || !roomId ? '#666' : '#ef4444',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: isCreating || !roomId ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s'
          }}
        >
          {isCreating ? '作成中...' : 'ルームを作成して開始'}
        </button>

        <button
          onClick={() => router.push('/battle/join')}
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
          ルームに参加する
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

