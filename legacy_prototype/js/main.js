import { CONFIG } from './config.js';
import { State } from './state.js';
import { initScene, initCity, render, getIntersectObject, getBuildings, emitFire } from './scene.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';
import * as THREE from 'three';

// --- GAME LOGIC ---

function startGame() {
    console.log("Game Start Requested");
    try {
        Audio.init(); 
    } catch (e) {
        console.warn("Audio init failed:", e);
    }
    
    try {
        initCity();
        State.reset();
        UI.hideOverlay();
        UI.update();
    } catch (e) {
        console.error("Game Start Error:", e);
        alert("Error starting game: " + e.message);
    }
}

function endGame(winner) {
    State.phase = 'FINISH';
    
    if (winner === 'P1') {
        UI.showOverlay("DEFENSE WINS", `City Saved. Damage: ${State.stats.damagePercent.toFixed(1)}%`, "#4488ff");
    } else {
        UI.showOverlay("OFFENSE WINS", "The City is Ashes.", "#ff4444");
    }
}

// Mouse Interaction
const mouse = new THREE.Vector2();
let isDragging = false;
let mouseDownTime = 0;
const CLICK_THRESHOLD_MS = 200;
const DRAG_THRESHOLD_PX = 10; // 5 -> 10 に緩和
let mouseDownPos = { x: 0, y: 0 };

function setupInput() {
    window.addEventListener('mousedown', (e) => {
        isDragging = false;
        mouseDownTime = Date.now();
        mouseDownPos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
        const dist = Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y);
        if (dist > DRAG_THRESHOLD_PX) {
            isDragging = true;
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (State.phase === 'FINISH' || State.phase === 'MENU') return;
        
        // If dragged or held too long, it's a camera move, not a game click
        const timeDiff = Date.now() - mouseDownTime;
        if (isDragging || timeDiff > CLICK_THRESHOLD_MS) {
            console.log("Ignored as drag/long press");
            return;
        }

        // Normalize mouse
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

        console.log("Click detected at", mouse.x, mouse.y); // Debug

        const target = getIntersectObject(mouse);

        if (target) {
            console.log("Hit object:", target.userData.id); // Debug
            // Shift + Left Click OR Right Click: P2 Action (Ignite)
            if (e.button === 2 || (e.button === 0 && e.shiftKey)) {
                handleP2Action(target);
            }
            // Left Click: P1 Action (Defend)
            else if (e.button === 0) {
                handleP1Action(target);
            }
        } else {
            console.log("No hit");
        }
    });

    // Prevent Context Menu
    window.addEventListener('contextmenu', e => e.preventDefault());
    
    // Start Button
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', startGame);
    }
}

function handleP1Action(target) {
    // Can act in SETUP and BATTLE
    const data = target.userData;
    if (data.isBurnt) return; // Cannot fix burnt buildings
    
    console.log("P1 Action on", data.id); // Debug

    // Extinguish Logic
    if (data.heat > 0) {
        if (State.p1.budget >= CONFIG.P1_EXTINGUISH_COST) {
            State.p1.budget -= CONFIG.P1_EXTINGUISH_COST;
            data.heat = 0;
            data.isWall = false; // Reset wall status if extinguished
            flashColor(target, 0x00ffff); // Flash Cyan
            target.material.color.setHex(data.baseColor);
            Audio.playExtinguish();
        }
    } 
    // Build Wall Logic
    else if (!data.isWall) {
        if (State.p1.budget >= CONFIG.P1_WALL_COST) {
            State.p1.budget -= CONFIG.P1_WALL_COST;
            data.isWall = true;
            target.material.color.setHex(0x3333ff); // Blue Wall
            // Wall looks solid
            target.scale.y = CONFIG.CUBE_SIZE * 0.5; // Make it shorter like a bunker
            target.position.y = target.scale.y / 2;
            Audio.playWall();
        }
    }
}

function handleP2Action(target) {
    console.log("P2 Attempt on", target.userData.id, "Phase:", State.phase); // Debug

    // Only active in BATTLE
    if (State.phase !== 'BATTLE') {
        // Feedback for trying too early
        UI.showOverlay("WAIT!", "Attack unlocks in Battle Phase", "#ffaa00");
        setTimeout(() => UI.hideOverlay(), 500);
        return;
    }
    
    if (State.p2.cooldown > 0) return;
    if (target.userData.isWall) return; 
    if (target.userData.isBurnt) return;

    // IGNITE
    target.userData.heat = CONFIG.HEAT_THRESHOLD + 10; // Instantly ignite
    State.p2.cooldown = State.p2.maxCooldown;
    flashColor(target, 0xffaa00);
    //Audio.playIgnite();
}

function flashColor(mesh, hex) {
    const old = mesh.material.color.getHex();
    mesh.material.color.setHex(hex);
    setTimeout(() => {
        // If status changed in between, don't revert blindly
        if (mesh.userData.isBurnt) mesh.material.color.setHex(0x220000);
        else if (mesh.userData.isWall) mesh.material.color.setHex(0x3333ff);
        else if (mesh.userData.heat > 0) {/* stay red-ish handled in update */}
        else mesh.material.color.setHex(mesh.userData.baseColor);
    }, 100);
}

// --- MAIN LOOP ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (State.phase === 'SETUP' || State.phase === 'BATTLE') {
        updateGame(delta);
    }

    render(delta);
}

function updateGame(delta) {
    // Timer Logic
    State.timer -= delta;
    
    // Phase Transition
    if (State.timer <= 0) {
        if (State.phase === 'SETUP') {
            State.phase = 'BATTLE';
            State.timer = CONFIG.BATTLE_TIME;
            Audio.playAlarm(); // Alarm on battle start
            // Flash screen or visual cue here
        } else if (State.phase === 'BATTLE') {
            // TIME UP -> Check Win Condition
            Audio.playAlarm(); // Alarm on finish
            if (State.stats.damagePercent < CONFIG.WIN_THRESHOLD) {
                endGame('P1');
            } else {
                endGame('P2');
            }
            return;
        }
    }

    // --- BATTLE LOGIC ---
    if (State.phase === 'BATTLE') {
        // 1. Difficulty Curve
        const progress = 1 - (State.timer / CONFIG.BATTLE_TIME); // 0.0 to 1.0
        
        if (CONFIG.DIFFICULTY_RAMP) {
            // P1: More money as panic rises
            State.p1.incomeRate = CONFIG.P1_INCOME_BASE + (progress * 100); 
            // P2: Faster cooldowns as fire rages
            State.p2.maxCooldown = Math.max(0.5, CONFIG.P2_COOLDOWN_BASE - (progress * 2.0));
        }

        // 2. Resources
        State.p1.budget += State.p1.incomeRate * delta;
        if (State.p2.cooldown > 0) State.p2.cooldown -= delta;

        // 3. Heat Simulation
        let currentBurnt = 0;
        const buildings = getBuildings();
        
        buildings.forEach(b => {
            const data = b.userData;
            
            if (data.isBurnt) {
                currentBurnt++;
                // Spread heat to neighbors
                spreadHeat(b, delta, buildings);
                
                // Visual: Emit Fire Particles
                // Only emit occasionally to save perf, or just emit small amount
                if (Math.random() < 0.3) {
                    // Random spot on top of building
                    const firePos = b.position.clone();
                    firePos.y += b.scale.y * 0.5; // Top
                    emitFire(firePos);
                }
            } else if (data.heat >= CONFIG.HEAT_THRESHOLD) {
                // Ignite
                data.isBurnt = true;
                data.heat = CONFIG.HEAT_THRESHOLD; // Cap it
                b.material.color.setHex(0x220000); // Black/Charred
                b.scale.y *= 0.8; // Crumble slightly
            } else if (data.heat > 0) {
                // Cooling
                data.heat -= CONFIG.HEAT_DECAY * delta;
                if (data.heat < 0) data.heat = 0;
                
                // Visualizing Heat (Grey to Red)
                if (!data.isWall) {
                    const t = data.heat / CONFIG.HEAT_THRESHOLD;
                    b.material.color.setRGB(0.5 + t*0.5, 0.5 * (1-t), 0.5 * (1-t));
                }
            }
        });

        // Update Stats
        State.stats.burntBuildings = currentBurnt;
        State.stats.damagePercent = (currentBurnt / State.stats.totalBuildings) * 100;

        // Instant Loss Condition
        if (State.stats.damagePercent >= CONFIG.WIN_THRESHOLD) {
            endGame('P2');
        }
    }

    UI.update();
}

function spreadHeat(source, delta, buildings) {
    const range = CONFIG.CUBE_SIZE * 1.5;
    
    buildings.forEach(target => {
        if (source === target) return;
        if (target.userData.isBurnt) return;
        if (target.userData.isWall) return; 
        
        const dist = source.position.distanceTo(target.position);
        if (dist < range) {
            target.userData.heat += CONFIG.HEAT_TRANSFER_RATE * delta;
        }
    });
}

// Init
initScene();
setupInput();
animate();

