import { CONFIG } from './config';

export const GameState = {
    phase: 'MENU', // MENU, SETUP, BATTLE, FINISH
    timer: 0,
    p1: {
        cooldown: 0,
        burntCount: 0, // Number of buildings burnt by P1 (including spread fires)
        burntPercentage: 0 // Percentage of total buildings burnt by P1
    },
    p2: {
        cooldown: 0,
        burntCount: 0, // Number of buildings burnt by P2 (including spread fires)
        burntPercentage: 0 // Percentage of total buildings burnt by P2
    },
    stats: {
        totalBuildings: 0,
        totalBurntBuildings: 0
    },

    reset() {
        this.phase = 'SETUP';
        this.timer = CONFIG.SETUP_TIME;
        this.p1.cooldown = 0;
        this.p1.burntCount = 0;
        this.p1.burntPercentage = 0;
        this.p2.cooldown = 0;
        this.p2.burntCount = 0;
        this.p2.burntPercentage = 0;
        this.stats.totalBurntBuildings = 0;
    }
};



