import { CONFIG } from './config';

export const GameState = {
    phase: 'MENU', // MENU, SETUP, BATTLE, FINISH
    timer: 0,
    p1: {
        budget: CONFIG.P1_INITIAL_BUDGET,
        incomeRate: CONFIG.P1_INCOME_BASE
    },
    p2: {
        cooldown: 0,
        maxCooldown: CONFIG.P2_COOLDOWN_BASE
    },
    stats: {
        totalBuildings: 0,
        burntBuildings: 0,
        damagePercent: 0
    },

    reset() {
        this.phase = 'SETUP';
        this.timer = CONFIG.SETUP_TIME;
        this.p1.budget = CONFIG.P1_INITIAL_BUDGET;
        this.p1.incomeRate = CONFIG.P1_INCOME_BASE;
        this.p2.cooldown = 0;
        this.p2.maxCooldown = CONFIG.P2_COOLDOWN_BASE;
        this.stats.burntBuildings = 0;
        this.stats.damagePercent = 0;
    }
};

