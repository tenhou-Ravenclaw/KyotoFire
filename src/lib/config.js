export const CONFIG = {
    GRID_SIZE: 16,
    CUBE_SIZE: 2,
    GAP: 0.5,
    SETUP_TIME: 15,
    BATTLE_TIME: 60,
    IGNITE_COOLDOWN: 2.0, // Cooldown for igniting buildings (seconds)
    HEAT_THRESHOLD: 100,
    HEAT_TRANSFER_RATE: 35, // Heat added per second from neighbor (increased for faster spread)
    HEAT_DECAY: 3,         // Natural cooling
    FIRE_SPREAD_RANGE: 40.0,   // Distance for fire to spread (meters, before scaling) → 20.0 units after scale (avg spacing: 7.81 units)
    DIFFICULTY_RAMP: false,   // Disabled for competitive mode

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

