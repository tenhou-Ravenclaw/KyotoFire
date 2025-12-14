// MP3ファイルを使用したSE再生

let audioCtx = null;
const audioBuffers = {}; // キャッシュ用
const fireSoundPool = []; // 燃えているSEのプール（複数同時再生用）
const MAX_FIRE_SOUNDS = 5; // 同時に再生できる燃えているSEの最大数

export const AudioController = {
    init() {
        if (typeof window !== 'undefined' && !audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
        }
    },

    // MP3ファイルを読み込む
    async loadSound(name, path) {
        this.init();
        if (!audioCtx) return null;
        if (audioBuffers[name]) return audioBuffers[name];
        
        try {
            const response = await fetch(path);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            audioBuffers[name] = audioBuffer;
            return audioBuffer;
        } catch (error) {
            console.error(`Failed to load sound: ${name}`, error);
            return null;
        }
    },

    // 音声を再生
    playSound(name, volume = 0.5, loop = false) {
        this.init();
        if (!audioCtx || !audioBuffers[name]) {
            console.warn(`Sound not loaded: ${name}`);
            return null;
        }
        
        const source = audioCtx.createBufferSource();
        const gainNode = audioCtx.createGain();
        
        source.buffer = audioBuffers[name];
        source.loop = loop;
        gainNode.gain.value = volume;
        
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        source.start(0);
        
        return source;
    },

    // 燃えているSEを再生（複数同時再生可能）
    playFireSound() {
        this.init();
        if (!audioCtx || !audioBuffers['fire']) return null;
        
        // プールをクリーンアップ（再生終了したソースを削除）
        for (let i = fireSoundPool.length - 1; i >= 0; i--) {
            try {
                if (fireSoundPool[i].playbackState === 2) { // finished
                    fireSoundPool.splice(i, 1);
                }
            } catch (e) {
                fireSoundPool.splice(i, 1);
            }
        }
        
        // 最大数に達している場合は再生しない
        if (fireSoundPool.length >= MAX_FIRE_SOUNDS) {
            return null;
        }
        
        // 新しいソースを作成して再生
        const source = this.playSound('fire', 0.3, true); // ループ再生
        if (source) {
            fireSoundPool.push(source);
        }
        
        return source;
    },

    // ファンファーレ（勝利）
    playFanfare() {
        this.playSound('fanfare', 0.7, false);
    },

    // 失敗SE（敗北）
    playFailure() {
        this.playSound('failure', 0.7, false);
    },

    // 初期化時に全てのSEを読み込む
    async preloadSounds() {
        await Promise.all([
            this.loadSound('fire', '/assets/sounds/fire.mp3'),
            this.loadSound('fanfare', '/assets/sounds/fanfare.mp3'),
            this.loadSound('failure', '/assets/sounds/failure.mp3')
        ]);
    },

    playIgnite() {
        this.init();
        if (!audioCtx) return;
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.1);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.5);

        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.5);
    },

    playExtinguish() {
        this.init();
        if (!audioCtx) return;
        const bufferSize = audioCtx.sampleRate * 0.5;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const gain = audioCtx.createGain();
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;

        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        noise.start();
    },

    playWall() {
        this.init();
        if (!audioCtx) return;
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.1);
    },
    
    playAlarm() {
        this.init();
        if (!audioCtx) return;
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.setValueAtTime(880, t + 0.2);
        osc.frequency.setValueAtTime(0, t + 0.21);
        
        gain.gain.value = 0.1;
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
    }
};

