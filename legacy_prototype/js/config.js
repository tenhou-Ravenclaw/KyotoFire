export const CONFIG = {
    GRID_SIZE: 16,
    CUBE_SIZE: 2,
    GAP: 0.5,
    SETUP_TIME: 15,
    BATTLE_TIME: 60,
    WIN_THRESHOLD: 50, // 50% damage
    P1_INITIAL_BUDGET: 2000,
    P1_INCOME_BASE: 50,
    P1_WALL_COST: 100,
    P1_EXTINGUISH_COST: 300,
    P2_COOLDOWN_BASE: 3.0,
    HEAT_THRESHOLD: 100,
    HEAT_TRANSFER_RATE: 20, // Heat added per second from neighbor
    HEAT_DECAY: 5,         // Natural cooling
    DIFFICULTY_RAMP: true,   // Enable difficulty curve
    
    // City Model Settings
    USE_CITY_MODEL: false,   // Set to true to load from file
    CITY_MODEL_PATH: './assets/city.glb', // Path to your GLB/GLTF file
    CITY_SCALE: 1.0,        // Adjust scale of imported model
    CITY_OFFSET_Y: 0        // Adjust height if floating/sinking
};

