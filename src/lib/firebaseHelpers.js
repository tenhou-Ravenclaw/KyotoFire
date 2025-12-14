import { ref, set, get, onValue, remove, update } from 'firebase/database';
import { database } from './firebase';

/**
 * ルームを作成
 */
export const createRoom = async (roomId, sessionId) => {
    const roomRef = ref(database, `rooms/${roomId}`);
    await set(roomRef, {
        host: sessionId,
        players: {
            [sessionId]: {
                isHost: true,
                timestamp: Date.now()
            }
        },
        createdAt: Date.now(),
        gameState: {
            isStarted: false,
            startTime: null
        }
    });
};

/**
 * ルームに参加
 */
export const joinRoom = async (roomId, sessionId) => {
    const playerRef = ref(database, `rooms/${roomId}/players/${sessionId}`);
    await set(playerRef, {
        isHost: false,
        timestamp: Date.now()
    });
};

/**
 * ルームの参加者を取得
 */
export const getRoomPlayers = async (roomId) => {
    const playersRef = ref(database, `rooms/${roomId}/players`);
    const snapshot = await get(playersRef);
    if (!snapshot.exists()) {
        return [];
    }
    
    const playersData = snapshot.val();
    const now = Date.now();
    
    // 古い参加者（5分以上経過）を除外
    const activePlayers = Object.entries(playersData)
        .filter(([_, data]) => now - data.timestamp < 5 * 60 * 1000)
        .map(([sessionId, data]) => ({
            sessionId,
            ...data
        }));
    
    return activePlayers;
};

/**
 * ルームのホストを取得
 */
export const getRoomHost = async (roomId) => {
    const hostRef = ref(database, `rooms/${roomId}/host`);
    const snapshot = await get(hostRef);
    return snapshot.exists() ? snapshot.val() : null;
};

/**
 * プレイヤーIDを割り当て
 */
export const assignPlayerIds = async (roomId, players) => {
    const assignments = {};
    const maxPlayers = Math.min(players.length, 4);
    
    for (let i = 0; i < maxPlayers; i++) {
        const playerId = (i + 1).toString();
        assignments[`player${playerId}`] = players[i].sessionId;
    }
    
    const assignmentsRef = ref(database, `rooms/${roomId}/assignments`);
    await set(assignmentsRef, assignments);
    
    return assignments;
};

/**
 * 自分のプレイヤーIDを取得
 */
export const getMyPlayerId = async (roomId, mySessionId) => {
    const assignmentsRef = ref(database, `rooms/${roomId}/assignments`);
    const snapshot = await get(assignmentsRef);
    
    if (!snapshot.exists()) {
        return null;
    }
    
    const assignments = snapshot.val();
    for (const [playerKey, sessionId] of Object.entries(assignments)) {
        if (sessionId === mySessionId) {
            return playerKey.replace('player', '');
        }
    }
    
    return null;
};

/**
 * プレイヤーIDの割り当てを監視
 */
export const watchAssignments = (roomId, callback) => {
    const assignmentsRef = ref(database, `rooms/${roomId}/assignments`);
    return onValue(assignmentsRef, (snapshot) => {
        callback(snapshot.val() || {});
    });
};

/**
 * 参加者リストを監視
 */
export const watchPlayers = (roomId, callback) => {
    const playersRef = ref(database, `rooms/${roomId}/players`);
    return onValue(playersRef, (snapshot) => {
        const playersData = snapshot.val() || {};
        const now = Date.now();
        
        // 古い参加者を除外
        const activePlayers = Object.entries(playersData)
            .filter(([_, data]) => now - data.timestamp < 5 * 60 * 1000)
            .map(([sessionId, data]) => ({
                sessionId,
                ...data
            }));
        
        callback(activePlayers);
    });
};

/**
 * プレイヤーの準備完了を設定
 */
export const setPlayerReady = async (roomId, playerId) => {
    const readyRef = ref(database, `rooms/${roomId}/ready/player${playerId}`);
    await set(readyRef, true);
};

/**
 * 準備完了状態を監視
 */
export const watchReadyStates = (roomId, callback) => {
    const readyRef = ref(database, `rooms/${roomId}/ready`);
    return onValue(readyRef, (snapshot) => {
        callback(snapshot.val() || {});
    });
};

/**
 * ゲーム開始時刻を設定
 */
export const setGameStartTime = async (roomId, startTime) => {
    const gameStateRef = ref(database, `rooms/${roomId}/gameState`);
    await update(gameStateRef, {
        isStarted: true,
        startTime: startTime
    });
};

/**
 * ゲーム状態を監視
 */
export const watchGameState = (roomId, callback) => {
    const gameStateRef = ref(database, `rooms/${roomId}/gameState`);
    return onValue(gameStateRef, (snapshot) => {
        callback(snapshot.val() || { isStarted: false, startTime: null });
    });
};

/**
 * ゲーム結果を保存
 */
export const saveGameResult = async (roomId, playerId, result) => {
    const resultRef = ref(database, `rooms/${roomId}/results/player${playerId}`);
    await set(resultRef, {
        ...result,
        timestamp: Date.now()
    });
};

/**
 * 全プレイヤーの結果を監視
 */
export const watchResults = (roomId, callback) => {
    const resultsRef = ref(database, `rooms/${roomId}/results`);
    return onValue(resultsRef, (snapshot) => {
        const results = snapshot.val() || {};
        const now = Date.now();
        
        // 古い結果（10分以上経過）を除外
        const validResults = {};
        Object.entries(results).forEach(([key, data]) => {
            if (now - data.timestamp < 10 * 60 * 1000) {
                validResults[key] = data;
            }
        });
        
        callback(validResults);
    });
};

/**
 * ゲームをリセット
 */
export const resetGame = async (roomId) => {
    const updates = {};
    updates[`rooms/${roomId}/gameState`] = {
        isStarted: false,
        startTime: null
    };
    updates[`rooms/${roomId}/ready`] = null;
    updates[`rooms/${roomId}/results`] = null;
    
    await update(ref(database), updates);
};

/**
 * ルームから退出
 */
export const leaveRoom = async (roomId, sessionId) => {
    const playerRef = ref(database, `rooms/${roomId}/players/${sessionId}`);
    await remove(playerRef);
};
