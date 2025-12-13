import { State } from './state.js';

export const UI = {
    elements: {
        timer: document.getElementById('timer'),
        phaseLabel: document.getElementById('phase-label'),
        damageBar: document.getElementById('damage-bar'),
        damageText: document.getElementById('damage-text'),
        p1Budget: document.getElementById('p1-budget'),
        p2Cooldown: document.getElementById('p2-cooldown'),
        overlay: document.getElementById('overlay-msg'),
        overlayTitle: document.getElementById('overlay-title'),
        overlaySubtitle: document.getElementById('overlay-subtitle')
    },

    init() {
        // Cache elements if needed, or just use getElementById dynamically
    },

    update() {
        // Phase & Timer
        this.elements.phaseLabel.innerText = State.phase + " PHASE";
        this.elements.timer.innerText = Math.ceil(State.timer);
        if (State.timer < 10) this.elements.timer.style.color = "red";
        else this.elements.timer.style.color = "white";

        // Stats
        this.elements.p1Budget.innerText = "¥" + Math.floor(State.p1.budget).toLocaleString();
        
        const cd = Math.max(0, State.p2.cooldown).toFixed(1);
        const cdEl = this.elements.p2Cooldown;
        if (State.phase === 'SETUP') {
            cdEl.innerText = "LOCKED";
            cdEl.style.color = "#888";
        } else {
            if (State.p2.cooldown <= 0) {
                cdEl.innerText = "READY!";
                cdEl.style.color = "#ff4444";
                cdEl.classList.add('blink');
            } else {
                cdEl.innerText = cd + "s";
                cdEl.style.color = "#884444";
                cdEl.classList.remove('blink');
            }
        }

        // Damage Bar
        const dmg = State.stats.damagePercent;
        this.elements.damageBar.style.width = dmg + "%";
        this.elements.damageText.innerText = `Damage: ${dmg.toFixed(1)}% / 50%`;
        
        // Color bar based on danger
        if (dmg > 40) this.elements.damageBar.style.background = "#ff0000";
        else this.elements.damageBar.style.background = "#ff8800";
    },

    showOverlay(title, subtitle, color) {
        this.elements.overlay.style.display = 'flex';
        this.elements.overlayTitle.innerText = title;
        if (color) this.elements.overlayTitle.style.color = color;
        this.elements.overlaySubtitle.innerText = subtitle;
    },

    hideOverlay() {
        this.elements.overlay.style.display = 'none';
    }
};

