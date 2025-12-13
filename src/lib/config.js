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
    HEAT_TRANSFER_RATE: 5, // Heat added per second from neighbor
    HEAT_DECAY: 3,         // Natural cooling
    FIRE_SPREAD_RANGE: 8.0,   // Distance for fire to spread (meters, before scaling) → 4.0 units after scale
    DIFFICULTY_RAMP: true,   // Enable difficulty curve
    
    // City Model Settings (GLB)
    USE_CITY_MODEL: true,   // Set to true to load from file
    CITY_MODEL_PATHS: [
        '/assets/glb/52353690_bldg_6697_op/52353690_bldg_6697_op.glb',
        '/assets/glb/52353691_bldg_6697_op/52353691_bldg_6697_op.glb',
        '/assets/glb/52354600_bldg_6697_op/52354600_bldg_6697_op.glb',
        '/assets/glb/52354601_bldg_6697_op/52354601_bldg_6697_op.glb'
    ], // Paths relative to public folder
    CITY_SCALE: 0.5,        // PLATEAU data is in meters, scale down
    CITY_OFFSET_Y: 0        
};
