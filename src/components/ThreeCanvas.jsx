'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import Stats from 'stats.js';
import { CONFIG } from '../lib/config';
import { GameState } from '../lib/state';
import { AudioController } from '../lib/audio';
import { ParticleSystem } from '../lib/particles';

export default function ThreeCanvas({ isPlaying, onUpdate, onGameEnd, onLoadProgress, playerId = '1', roomId = null }) {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const isInitialized = useRef(false);
    const buildingsRef = useRef([]);
    const fireParticlesRef = useRef(null);
    const isPlayingRef = useRef(isPlaying);
    
    useEffect(() => {
        if (!mountRef.current || isInitialized.current) return;
        isInitialized.current = true;

        // --- INIT THREE.JS ---
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb); // Sky blue
        scene.fog = new THREE.Fog(0x87ceeb, 100, 500);
        sceneRef.current = scene;

        // Stats
        const stats = new Stats();
        stats.showPanel(0);
        stats.dom.style.position = 'absolute';
        stats.dom.style.top = '0px';
        stats.dom.style.right = '0px';
        mountRef.current.appendChild(stats.dom);

        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(0, 100, 100);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: "high-performance"
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;  // Changed from PCFSoftShadowMap for performance
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));  // Limit pixel ratio
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        renderer.domElement.style.zIndex = '1';
        
        mountRef.current.appendChild(renderer.domElement);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffee, 1.5);
        dirLight.position.set(100, 200, 100);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;  // Reduced from 4096
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.left = -200;
        dirLight.shadow.camera.right = 200;
        dirLight.shadow.camera.top = 200;
        dirLight.shadow.camera.bottom = -200;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 500;
        dirLight.shadow.bias = -0.0001;
        scene.add(dirLight);

        // Ground Plane 
        const groundGeo = new THREE.PlaneGeometry(5000, 5000);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x8fbc8f, roughness: 0.8 }); // Dark sea green (grass-like)
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.1;
        ground.receiveShadow = true;
        scene.add(ground);

        // Grid Helper
        const gridHelper = new THREE.GridHelper(500, 100, 0xaaaaaa, 0x666666);
        scene.add(gridHelper);

        // Game Objects
        let buildings = [];
        let fireParticles = new ParticleSystem(scene);
        buildingsRef.current = buildings;
        fireParticlesRef.current = fireParticles;
        const raycaster = new THREE.Raycaster();
        const clock = new THREE.Clock();
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        
        // Reusable vectors for performance
        const tempVec1 = new THREE.Vector3();
        const tempVec2 = new THREE.Vector3();
        
        // Spatial partitioning for fire spread optimization
        let spatialGrid = new Map();
        const GRID_CELL_SIZE = 50; // Size of each grid cell
        let fireSpreadAccumulator = 0; // Accumulator for fire spread update frequency
        const FIRE_SPREAD_UPDATE_INTERVAL = 0.1; // Update fire spread every 0.1 seconds instead of every frame
        
        // Build spatial grid: partition buildings into grid cells
        const buildSpatialGrid = () => {
            spatialGrid.clear();
            for (let i = 0; i < buildings.length; i++) {
                const b = buildings[i];
                const pos = b.userData.worldPosition;
                const cellKey = `${Math.floor(pos.x / GRID_CELL_SIZE)},${Math.floor(pos.z / GRID_CELL_SIZE)}`;
                
                if (!spatialGrid.has(cellKey)) {
                    spatialGrid.set(cellKey, []);
                }
                spatialGrid.get(cellKey).push(b);
            }
        };
        
        // Get nearby buildings from spatial grid
        const getNearbyBuildings = (centerPos, range) => {
            const nearby = [];
            const cellRange = Math.ceil(range / GRID_CELL_SIZE) + 1;
            const centerCellX = Math.floor(centerPos.x / GRID_CELL_SIZE);
            const centerCellZ = Math.floor(centerPos.z / GRID_CELL_SIZE);
            
            for (let dx = -cellRange; dx <= cellRange; dx++) {
                for (let dz = -cellRange; dz <= cellRange; dz++) {
                    const cellKey = `${centerCellX + dx},${centerCellZ + dz}`;
                    const cellBuildings = spatialGrid.get(cellKey);
                    if (cellBuildings) {
                        nearby.push(...cellBuildings);
                    }
                }
            }
            return nearby;
        };

        // Inputs
        const keys = { w: false, a: false, s: false, d: false, space: false, shift: false };
        
        // --- LOAD CITY ---
        const initCity = () => {
            buildings.forEach(b => scene.remove(b));
            buildings = [];
            fireParticles.reset();

            if (CONFIG.USE_CITY_MODEL) {
                const loader = new GLTFLoader();
                const dracoLoader = new DRACOLoader();
                dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
                loader.setDRACOLoader(dracoLoader);

                const modelPaths = CONFIG.CITY_MODEL_PATHS || [CONFIG.CITY_MODEL_PATH];
                let loadedCount = 0;
                let totalFiles = modelPaths.length;
                
                const loadPromises = modelPaths.map((path) => {
                    return new Promise((resolve, reject) => {
                        loader.load(
                            path,
                            (gltf) => {
                                const model = gltf.scene;
                                model.scale.set(CONFIG.CITY_SCALE, CONFIG.CITY_SCALE, CONFIG.CITY_SCALE);
                                model.position.y = CONFIG.CITY_OFFSET_Y;
                                scene.add(model);
                                
                                model.traverse((child) => {
                                    if (child.isMesh) {
                                        if (!child.material.isMeshPhongMaterial) {
                                            child.material = new THREE.MeshPhongMaterial({
                                                color: child.material.color || 0xdddddd,
                                                map: child.material.map || null,
                                                shininess: 5
                                            });
                                        } else {
                                            child.material = child.material.clone();
                                        }
                                        child.castShadow = true;
                                        child.receiveShadow = true;
                                        
                                        // Add wireframe edges for better visibility
                                        const edges = new THREE.EdgesGeometry(child.geometry);
                                        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
                                        const wireframe = new THREE.LineSegments(edges, lineMaterial);
                                        child.add(wireframe);
                                        
                                        setupBuildingData(child, `blg-${buildings.length}`);
                                        buildings.push(child);
                                    }
                                });
                                
                                loadedCount++;
                                if (onLoadProgress) {
                                    onLoadProgress((loadedCount / totalFiles) * 100);
                                }
                                resolve();
                            },
                            undefined,
                            (err) => {
                                console.error(`Failed to load ${path}`, err);
                                loadedCount++;
                                if (onLoadProgress) {
                                    onLoadProgress((loadedCount / totalFiles) * 100);
                                }
                                reject(err);
                            }
                        );
                    });
                });

                Promise.allSettled(loadPromises).then(() => {
                    GameState.stats.totalBuildings = buildings.length;
                    buildingsRef.current = buildings;
                    
                    // Force update world matrices for all buildings
                    scene.updateMatrixWorld(true);
                    
                    // Cache world positions for performance
                    // Use bounding box center instead of getWorldPosition() for more reliable results
                    buildings.forEach(b => {
                        const box = new THREE.Box3().setFromObject(b);
                        const center = box.getCenter(new THREE.Vector3());
                        b.userData.worldPosition = center.clone();
                    });
                    
                    // Build spatial grid for fire spread optimization
                    buildSpatialGrid();
                    
                    // Debug: Check building positions and distances
                    if (buildings.length > 1) {
                        // Calculate distances with building sizes (bounding boxes)
                        const distances = [];
                        const centerDistances = [];
                        let minDist = Infinity;
                        let maxDist = 0;
                        let minCenterDist = Infinity;
                        let maxCenterDist = 0;
                        
                        // Calculate bounding boxes for all buildings
                        const buildingBoxes = buildings.map(b => {
                            const box = new THREE.Box3().setFromObject(b);
                            return box;
                        });
                        
                        // Check all building pairs (or sample if too many)
                        const checkCount = Math.min(buildings.length, 200); // Check up to 200 buildings
                        const pairsToCheck = Math.min(checkCount * 10, buildings.length); // Check 10 neighbors per building
                        
                        console.log(`\n=== Building Distance Analysis ===`);
                        console.log(`Checking ${checkCount} buildings (up to ${pairsToCheck} pairs)...`);
                        
                        for (let i = 0; i < checkCount; i++) {
                            const b1 = buildings[i];
                            const pos1 = b1.userData.worldPosition;
                            const box1 = buildingBoxes[i];
                            const size1 = box1.getSize(new THREE.Vector3());
                            
                            const maxJ = Math.min(i + pairsToCheck / checkCount, buildings.length);
                            for (let j = i + 1; j < maxJ; j++) {
                                const b2 = buildings[j];
                                const pos2 = b2.userData.worldPosition;
                                const box2 = buildingBoxes[j];
                                const size2 = box2.getSize(new THREE.Vector3());
                                
                                // Center-to-center distance
                                const centerDist = pos1.distanceTo(pos2);
                                centerDistances.push(centerDist);
                                if (centerDist > 0.01 && centerDist < minCenterDist) minCenterDist = centerDist;
                                if (centerDist > maxCenterDist) maxCenterDist = centerDist;
                                
                                // Edge-to-edge distance (actual gap between buildings)
                                const box1Center = box1.getCenter(new THREE.Vector3());
                                const box2Center = box2.getCenter(new THREE.Vector3());
                                const centerToCenter = box2Center.clone().sub(box1Center);
                                
                                // Calculate minimum distance between boxes
                                const halfSize1 = size1.clone().multiplyScalar(0.5);
                                const halfSize2 = size2.clone().multiplyScalar(0.5);
                                
                                // Distance along each axis
                                const dx = Math.abs(centerToCenter.x) - (halfSize1.x + halfSize2.x);
                                const dy = Math.abs(centerToCenter.y) - (halfSize1.y + halfSize2.y);
                                const dz = Math.abs(centerToCenter.z) - (halfSize1.z + halfSize2.z);
                                
                                // Edge-to-edge distance (0 if overlapping)
                                const edgeDist = Math.max(0, Math.sqrt(
                                    Math.max(0, dx) ** 2 + 
                                    Math.max(0, dy) ** 2 + 
                                    Math.max(0, dz) ** 2
                                ));
                                
                                distances.push(edgeDist);
                                if (edgeDist > 0.01 && edgeDist < minDist) minDist = edgeDist;
                                if (edgeDist > maxDist) maxDist = edgeDist;
                            }
                        }
                        
                        // Calculate statistics
                        distances.sort((a, b) => a - b);
                        centerDistances.sort((a, b) => a - b);
                        
                        const medianDist = distances.length > 0 ? distances[Math.floor(distances.length / 2)] : 0;
                        const medianCenterDist = centerDistances.length > 0 ? centerDistances[Math.floor(centerDistances.length / 2)] : 0;
                        const p25Dist = distances.length > 0 ? distances[Math.floor(distances.length * 0.25)] : 0;
                        const p75Dist = distances.length > 0 ? distances[Math.floor(distances.length * 0.75)] : 0;
                        
                        const fireRange = CONFIG.FIRE_SPREAD_RANGE * CONFIG.CITY_SCALE;
                        
                        // Count how many buildings would be affected by current fire range
                        let affectedCount = 0;
                        let totalInRange = 0;
                        const sampleSize = Math.min(100, buildings.length);
                        for (let i = 0; i < sampleSize; i++) {
                            const b1 = buildings[i];
                            const pos1 = b1.userData.worldPosition;
                            let hasNeighborInRange = false;
                            for (let j = 0; j < buildings.length; j++) {
                                if (i === j) continue;
                                const b2 = buildings[j];
                                const pos2 = b2.userData.worldPosition;
                                const dist = pos1.distanceTo(pos2);
                                if (dist < fireRange) {
                                    totalInRange++;
                                    if (!hasNeighborInRange) {
                                        affectedCount++;
                                        hasNeighborInRange = true;
                                    }
                                }
                            }
                        }
                        
                        // Debug: Show sample of actual distances
                        console.log(`\n--- Sample Actual Distances (first 5 buildings) ---`);
                        for (let i = 0; i < Math.min(5, buildings.length); i++) {
                            const b1 = buildings[i];
                            const pos1 = b1.userData.worldPosition;
                            const nearby = [];
                            for (let j = 0; j < Math.min(10, buildings.length); j++) {
                                if (i === j) continue;
                                const b2 = buildings[j];
                                const pos2 = b2.userData.worldPosition;
                                const dist = pos1.distanceTo(pos2);
                                if (dist < fireRange * 2) { // Show within 2x fire range
                                    nearby.push({ index: j, dist: dist.toFixed(3) });
                                }
                            }
                            nearby.sort((a, b) => parseFloat(a.dist) - parseFloat(b.dist));
                            console.log(`Building ${i} at (${pos1.x.toFixed(2)}, ${pos1.y.toFixed(2)}, ${pos1.z.toFixed(2)})`);
                            console.log(`  Nearby (within ${(fireRange * 2).toFixed(2)} units): ${nearby.slice(0, 5).map(n => `#${n.index}:${n.dist}`).join(', ')}`);
                        }
                        
                        console.log(`\n--- Distance Statistics (Edge-to-Edge) ---`);
                        console.log(`Min distance: ${minDist === Infinity ? 'N/A' : minDist.toFixed(3)} units`);
                        console.log(`25th percentile: ${p25Dist.toFixed(3)} units`);
                        console.log(`Median distance: ${medianDist.toFixed(3)} units`);
                        console.log(`75th percentile: ${p75Dist.toFixed(3)} units`);
                        console.log(`Max distance: ${maxDist.toFixed(3)} units`);
                        console.log(`Total pairs checked: ${distances.length}`);
                        
                        console.log(`\n--- Distance Statistics (Center-to-Center) ---`);
                        if (centerDistances.length > 0) {
                            const validCenterDists = centerDistances.filter(d => d > 0.01);
                            if (validCenterDists.length > 0) {
                                validCenterDists.sort((a, b) => a - b);
                                const minValid = validCenterDists[0];
                                const maxValid = validCenterDists[validCenterDists.length - 1];
                                const medianValid = validCenterDists[Math.floor(validCenterDists.length / 2)];
                                console.log(`Min center distance: ${minValid.toFixed(3)} units`);
                                console.log(`Median center distance: ${medianValid.toFixed(3)} units`);
                                console.log(`Max center distance: ${maxValid.toFixed(3)} units`);
                                console.log(`Valid distances: ${validCenterDists.length} / ${centerDistances.length}`);
                            } else {
                                console.log(`⚠️ All center distances are 0 or very small!`);
                                console.log(`   This suggests buildings may be at the same position.`);
                            }
                        } else {
                            console.log(`⚠️ No center distances calculated!`);
                        }
                        
                        console.log(`\n--- Fire Spread Analysis ---`);
                        console.log(`Current FIRE_SPREAD_RANGE: ${CONFIG.FIRE_SPREAD_RANGE} (scaled: ${fireRange.toFixed(3)} units)`);
                        console.log(`Buildings with at least 1 neighbor in range (sample of ${sampleSize}): ${affectedCount} / ${sampleSize}`);
                        console.log(`Total neighbor pairs within range (sample): ${totalInRange}`);
                        console.log(`Average neighbors per building in range: ${(totalInRange / sampleSize).toFixed(2)}`);
                        
                        if (minDist < fireRange) {
                            console.warn(`\n⚠️ WARNING: Fire range (${fireRange.toFixed(3)}) is LARGER than min edge distance (${minDist.toFixed(3)})!`);
                            console.warn(`   Many buildings will spread fire immediately!`);
                            console.warn(`   Recommended FIRE_SPREAD_RANGE: ${(minDist / CONFIG.CITY_SCALE * 0.8).toFixed(2)} or less`);
                        } else if (medianDist < fireRange) {
                            console.warn(`\n⚠️ WARNING: Fire range (${fireRange.toFixed(3)}) is LARGER than median edge distance (${medianDist.toFixed(3)})!`);
                            console.warn(`   More than 50% of buildings are within fire range!`);
                            console.warn(`   Recommended FIRE_SPREAD_RANGE: ${(medianDist / CONFIG.CITY_SCALE * 0.6).toFixed(2)} or less`);
                        } else {
                            console.log(`\n✓ Fire range is smaller than median building distance`);
                        }
                        
                        // Distance distribution
                        const bins = 10;
                        const binSize = (maxDist - minDist) / bins;
                        const histogram = new Array(bins).fill(0);
                        distances.forEach(d => {
                            if (d > 0.01) {
                                const bin = Math.min(Math.floor((d - minDist) / binSize), bins - 1);
                                histogram[bin]++;
                            }
                        });
                        
                        console.log(`\n--- Distance Distribution (Edge-to-Edge) ---`);
                        for (let i = 0; i < bins; i++) {
                            const rangeStart = minDist + i * binSize;
                            const rangeEnd = minDist + (i + 1) * binSize;
                            const count = histogram[i];
                            const bar = '█'.repeat(Math.floor(count / distances.length * 50));
                            console.log(`${rangeStart.toFixed(2)}-${rangeEnd.toFixed(2)}: ${bar} ${count}`);
                        }
                    }
                    
                    // Calculate and display field boundaries
                    if (buildings.length > 0) {
                        const bbox = new THREE.Box3();
                        buildings.forEach(b => bbox.expandByObject(b));
                        
                        // Add boundary box
                        const size = bbox.getSize(new THREE.Vector3());
                        const center = bbox.getCenter(new THREE.Vector3());
                        
                        const boundaryGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
                        const boundaryMaterial = new THREE.MeshBasicMaterial({
                            color: 0xff0000,
                            wireframe: true,
                            transparent: true,
                            opacity: 0.3
                        });
                        const boundaryBox = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
                        boundaryBox.position.copy(center);
                        scene.add(boundaryBox);
                        
                        // Add ground-level boundary lines
                        const points = [
                            new THREE.Vector3(bbox.min.x, 0, bbox.min.z),
                            new THREE.Vector3(bbox.max.x, 0, bbox.min.z),
                            new THREE.Vector3(bbox.max.x, 0, bbox.max.z),
                            new THREE.Vector3(bbox.min.x, 0, bbox.max.z),
                            new THREE.Vector3(bbox.min.x, 0, bbox.min.z)
                        ];
                        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
                        const lineMaterial = new THREE.LineBasicMaterial({ 
                            color: 0xff0000, 
                            linewidth: 3 
                        });
                        const boundaryLine = new THREE.Line(lineGeometry, lineMaterial);
                        scene.add(boundaryLine);
                        
                        // Calculate area and building density
                        const fieldWidth = bbox.max.x - bbox.min.x;
                        const fieldDepth = bbox.max.z - bbox.min.z;
                        const fieldArea = fieldWidth * fieldDepth;
                        const buildingDensity = buildings.length / fieldArea;
                        const avgSpacing = Math.sqrt(1 / buildingDensity);
                        
                        console.log(`Field boundaries: X(${bbox.min.x.toFixed(1)} to ${bbox.max.x.toFixed(1)}), Z(${bbox.min.z.toFixed(1)} to ${bbox.max.z.toFixed(1)})`);
                        console.log(`Field size: ${fieldWidth.toFixed(1)} × ${fieldDepth.toFixed(1)} = ${fieldArea.toFixed(0)} units²`);
                        console.log(`Buildings: ${buildings.length}, Density: ${buildingDensity.toFixed(4)} buildings/unit², Avg spacing: ${avgSpacing.toFixed(2)} units`);
                        console.log(`Current fire range: ${(CONFIG.FIRE_SPREAD_RANGE * CONFIG.CITY_SCALE).toFixed(2)} units`);
                        console.log(`Recommended fire range: ${(avgSpacing * 0.3).toFixed(2)} to ${(avgSpacing * 0.8).toFixed(2)} units (30%-80% of avg spacing)`);
                    }
                    
                    if (onLoadProgress) onLoadProgress(100);
                    console.log(`Loaded ${buildings.length} buildings from ${totalFiles} GLB files`);
                });
            } else {
                createRandomCity();
                buildingsRef.current = buildings;
                if (onLoadProgress) onLoadProgress(100);
            }
        };

        const createRandomCity = () => {
            const offset = (CONFIG.GRID_SIZE * (CONFIG.CUBE_SIZE + CONFIG.GAP)) / 2;
            for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
                for (let z = 0; z < CONFIG.GRID_SIZE; z++) {
                    const height = CONFIG.CUBE_SIZE * (1 + Math.random() * 2); 
                    const material = new THREE.MeshStandardMaterial({ 
                        color: 0xdddddd,
                        roughness: 0.6,
                        metalness: 0.2
                    });
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.scale.set(CONFIG.CUBE_SIZE, height, CONFIG.CUBE_SIZE);
                    mesh.position.set(
                        x * (CONFIG.CUBE_SIZE + CONFIG.GAP) - offset,
                        height / 2,
                        z * (CONFIG.CUBE_SIZE + CONFIG.GAP) - offset
                    );
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    
                    // Add wireframe edges for better visibility
                    const edges = new THREE.EdgesGeometry(geometry);
                    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
                    const wireframe = new THREE.LineSegments(edges, lineMaterial);
                    wireframe.scale.set(CONFIG.CUBE_SIZE, height, CONFIG.CUBE_SIZE);
                    wireframe.position.copy(mesh.position);
                    scene.add(wireframe);
                    
                    setupBuildingData(mesh, `${x}-${z}`);
                    scene.add(mesh);
                    buildings.push(mesh);
                }
            }
            GameState.stats.totalBuildings = buildings.length;
            buildingsRef.current = buildings;
            
            // Force update world matrices for random city
            scene.updateMatrixWorld(true);
            
            // Cache world positions using bounding box centers
            buildings.forEach(b => {
                const box = new THREE.Box3().setFromObject(b);
                const center = box.getCenter(new THREE.Vector3());
                b.userData.worldPosition = center.clone();
            });
            
            // Build spatial grid for random city
            buildSpatialGrid();
            
            // Add boundary for random city
            const fieldSize = CONFIG.GRID_SIZE * (CONFIG.CUBE_SIZE + CONFIG.GAP);
            const points = [
                new THREE.Vector3(-fieldSize/2, 0, -fieldSize/2),
                new THREE.Vector3(fieldSize/2, 0, -fieldSize/2),
                new THREE.Vector3(fieldSize/2, 0, fieldSize/2),
                new THREE.Vector3(-fieldSize/2, 0, fieldSize/2),
                new THREE.Vector3(-fieldSize/2, 0, -fieldSize/2)
            ];
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
            const lineMaterial = new THREE.LineBasicMaterial({ 
                color: 0xff0000, 
                linewidth: 3 
            });
            const boundaryLine = new THREE.Line(lineGeometry, lineMaterial);
            scene.add(boundaryLine);
        };

        const setupBuildingData = (mesh, id) => {
            // Use position as initial value, will be updated with bounding box center after scene is ready
            mesh.userData = {
                heat: 0,
                isBurnt: false,
                isWall: false,
                ignitedBy: null, // Track which player ignited this building ('P1' or 'P2')
                baseColor: mesh.material.color.getHex(),
                id: id,
                originalHeight: mesh.scale.y,
                originalY: mesh.position.y,
                worldPosition: mesh.position.clone() // Temporary, will be updated with bounding box center
            };
        };

        // --- GAME LOOP ---
        let reqId;
        const animate = () => {
            stats.begin();
            reqId = requestAnimationFrame(animate);
            const delta = clock.getDelta();

            // Camera
            const moveSpeed = 100.0 * delta;
            if (keys.w) camera.position.z -= moveSpeed;
            if (keys.s) camera.position.z += moveSpeed;
            if (keys.a) camera.position.x -= moveSpeed;
            if (keys.d) camera.position.x += moveSpeed;
            if (keys.space && camera.position.y > 10) camera.position.y -= moveSpeed;
            if (keys.shift && camera.position.y < 300) camera.position.y += moveSpeed;

            if (GameState.phase === 'SETUP' || GameState.phase === 'BATTLE') {
                updateGame(delta);
            }
            
            if (fireParticles) fireParticles.update(delta);
            renderer.render(scene, camera);
            stats.end();
        };

        const updateGame = (delta) => {
            GameState.timer -= delta;

            if (GameState.timer <= 0) {
                if (GameState.phase === 'SETUP') {
                    GameState.phase = 'BATTLE';
                    GameState.timer = CONFIG.BATTLE_TIME;
                    // SETUP→BATTLE移行時のSEは削除（必要に応じて追加可能）
                } else if (GameState.phase === 'BATTLE') {
                    // ゲーム終了フラグを設定して重複実行を防ぐ
                    GameState.phase = 'FINISH';
                    // ゲーム終了時のSEはhandleGameEndで再生されるため、ここでは削除
                    // Determine winner based on who burnt more buildings
                    const winner = GameState.p1.burntCount > GameState.p2.burntCount ? 'P1' : 
                                  GameState.p2.burntCount > GameState.p1.burntCount ? 'P2' : 'DRAW';
                    onGameEnd(winner);
                    return;
                }
            }
            
            // ゲームが終了している場合は処理をスキップ
            if (GameState.phase === 'FINISH') return;

            if (GameState.phase === 'BATTLE') {
                // Update cooldowns for both players
                if (GameState.p1.cooldown > 0) GameState.p1.cooldown -= delta;
                if (GameState.p2.cooldown > 0) GameState.p2.cooldown -= delta;
                
                // In battle mode, update cooldown for current player
                // Use P1 slot for odd playerIds (1, 3), P2 slot for even playerIds (2, 4)
                if (roomId) {
                    const isOddPlayer = parseInt(playerId) % 2 === 1;
                    const playerState = isOddPlayer ? GameState.p1 : GameState.p2;
                    if (playerState.cooldown > 0) playerState.cooldown -= delta;
                }

                let currentBurnt = 0;
                const range = CONFIG.USE_CITY_MODEL ? (CONFIG.FIRE_SPREAD_RANGE * CONFIG.CITY_SCALE) : (CONFIG.CUBE_SIZE * 1.5);
                const burningBuildings = [];
                
                // Debug: Log fire spread range once
                if (!window._fireRangeLogged) {
                    console.log(`Fire spread range: ${range.toFixed(2)} units (FIRE_SPREAD_RANGE: ${CONFIG.FIRE_SPREAD_RANGE} × CITY_SCALE: ${CONFIG.CITY_SCALE})`);
                    window._fireRangeLogged = true;
                }
                
                // Pass 1: Count burnt, collect burning buildings, update heat decay
                for (let i = 0; i < buildings.length; i++) {
                    const b = buildings[i];
                    const data = b.userData;
                    
                    if (data.isBurnt) {
                        currentBurnt++;
                        burningBuildings.push(b);
                        
                        // Emit particles (higher position, optimized frequency based on building count)
                        // Reduce frequency when many buildings are burning to maintain performance
                        const particleChance = burningBuildings.length > 50 ? 0.1 : (burningBuildings.length > 20 ? 0.2 : 0.25);
                        if (Math.random() < particleChance) {
                            const firePos = data.worldPosition.clone();
                            firePos.y += b.scale.y * 0.9; // Higher position (90% of building height)
                            const particleCount = burningBuildings.length > 50 ? 2 : (burningBuildings.length > 20 ? 3 : 4);
                            fireParticles.emit(firePos, particleCount);
                        }
                    } else if (data.heat >= CONFIG.HEAT_THRESHOLD) {
                        data.isBurnt = true;
                        data.heat = CONFIG.HEAT_THRESHOLD;
                        b.material.color.setHex(0x220000);
                        b.scale.y *= 0.8;
                        currentBurnt++;
                        
                        // 延焼時のSEを再生
                        AudioController.playFireSound();
                    } else if (data.heat > 0) {
                        data.heat -= CONFIG.HEAT_DECAY * delta;
                        if (data.heat < 0) data.heat = 0;
                        
                        // Update color only if heat changed significantly
                        if (!data.isWall && !data.lastColorUpdate || Math.abs(data.heat - data.lastColorUpdate) > 5) {
                            const t = data.heat / CONFIG.HEAT_THRESHOLD;
                            b.material.color.setRGB(0.5 + t*0.5, 0.5 * (1-t), 0.5 * (1-t));
                            data.lastColorUpdate = data.heat;
                        }
                    }
                }
                
                // Pass 2: Only spread heat from burning buildings (spatial partitioning optimized)
                // Update fire spread at reduced frequency for better performance
                fireSpreadAccumulator += delta;
                if (fireSpreadAccumulator >= FIRE_SPREAD_UPDATE_INTERVAL) {
                    const rangeSquared = range * range;
                    const heatTransfer = CONFIG.HEAT_TRANSFER_RATE * fireSpreadAccumulator; // Use accumulated time
                    
                    for (let i = 0; i < burningBuildings.length; i++) {
                        const b = burningBuildings[i];
                        const bPos = b.userData.worldPosition;
                        const bx = bPos.x;
                        const by = bPos.y;
                        const bz = bPos.z;
                        
                        // Get nearby buildings using spatial grid (only check buildings in nearby cells)
                        const nearbyBuildings = getNearbyBuildings(bPos, range);
                        
                        for (let j = 0; j < nearbyBuildings.length; j++) {
                            const target = nearbyBuildings[j];
                            const data = target.userData;
                            
                            // Skip if already burnt
                            if (data.isBurnt) continue;
                            
                            const targetPos = data.worldPosition;
                            
                            // Quick bounding box check before distance calculation
                            const dx = Math.abs(bx - targetPos.x);
                            const dy = Math.abs(by - targetPos.y);
                            const dz = Math.abs(bz - targetPos.z);
                            
                            // If any axis is beyond range, skip distance calculation
                            if (dx > range || dy > range || dz > range) continue;
                            
                            // Use squared distance to avoid sqrt
                            const distSquared = dx * dx + dy * dy + dz * dz;
                            
                            if (distSquared < rangeSquared) {
                                data.heat += heatTransfer;
                                
                                // 熱を伝播した建物のignitedByを継承（まだ燃えていない場合）
                                // これにより延焼で燃えた建物も最初に点火したプレイヤーのスコアにカウントされる
                                if (!data.ignitedBy && b.userData.ignitedBy) {
                                    data.ignitedBy = b.userData.ignitedBy;
                                }
                            }
                        }
                    }
                    
                    fireSpreadAccumulator = 0; // Reset accumulator
                }

                GameState.stats.totalBurntBuildings = currentBurnt;
                
                // Count buildings burnt by each player (including spread fires)
                // Calculate as percentage of total buildings
                const totalBuildings = GameState.stats.totalBuildings;
                
                // Count all players (P1, P2, P3, P4)
                const playerCounts = { P1: 0, P2: 0, P3: 0, P4: 0 };
                for (let i = 0; i < buildings.length; i++) {
                    const data = buildings[i].userData;
                    if (data.isBurnt && data.ignitedBy) {
                        if (playerCounts.hasOwnProperty(data.ignitedBy)) {
                            playerCounts[data.ignitedBy]++;
                        }
                    }
                }
                
                // Calculate percentages for all players
                const playerPercentages = {};
                for (const [playerKey, count] of Object.entries(playerCounts)) {
                    playerPercentages[playerKey] = totalBuildings > 0 ? (count / totalBuildings * 100) : 0;
                }
                
                // Update GameState (for local mode compatibility and battle mode)
                if (roomId) {
                    // 対戦モード: 現在のプレイヤーのスコアをGameStateに保存
                    // Use P1 slot for odd playerIds (1, 3), P2 slot for even playerIds (2, 4)
                    const currentPlayerKey = `P${playerId}`;
                    const isOddPlayer = parseInt(playerId) % 2 === 1;
                    const currentPlayerPercentage = playerPercentages[currentPlayerKey] || 0;
                    const currentPlayerCount = playerCounts[currentPlayerKey] || 0;
                    
                    // Update GameState with current player's score
                    if (isOddPlayer) {
                        GameState.p1.burntCount = currentPlayerCount;
                        GameState.p1.burntPercentage = currentPlayerPercentage;
                    } else {
                        GameState.p2.burntCount = currentPlayerCount;
                        GameState.p2.burntPercentage = currentPlayerPercentage;
                    }
                    
                    // Store score for this player in this room
                    localStorage.setItem(`battle_score_${roomId}_player_${playerId}`, JSON.stringify({
                        player: playerId,
                        score: currentPlayerPercentage, // Percentage instead of count
                        count: currentPlayerCount, // Keep count for reference
                        timestamp: Date.now()
                    }));
                } else {
                    // ローカルモード: P1とP2のスコアを更新
                    GameState.p1.burntCount = playerCounts.P1;
                    GameState.p2.burntCount = playerCounts.P2;
                    GameState.p1.burntPercentage = playerPercentages.P1;
                    GameState.p2.burntPercentage = playerPercentages.P2;
                }
            }

            if (onUpdate) onUpdate();
        };

        // --- INPUT HANDLING ---
        const handleKeyDown = (e) => {
            switch(e.code) {
                case 'KeyW': keys.w = true; break;
                case 'KeyS': keys.s = true; break;
                case 'KeyA': keys.a = true; break;
                case 'KeyD': keys.d = true; break;
                case 'Space': keys.space = true; break;
                case 'ShiftLeft': case 'ShiftRight': keys.shift = true; break;
            }
        };
        const handleKeyUp = (e) => {
            switch(e.code) {
                case 'KeyW': keys.w = false; break;
                case 'KeyS': keys.s = false; break;
                case 'KeyA': keys.a = false; break;
                case 'KeyD': keys.d = false; break;
                case 'Space': keys.space = false; break;
                case 'ShiftLeft': case 'ShiftRight': keys.shift = false; break;
            }
        };
        
        let mouseDownTime = 0;
        let mouseDownPos = { x: 0, y: 0 };
        const handleMouseDown = (e) => {
            mouseDownTime = Date.now();
            mouseDownPos = { x: e.clientX, y: e.clientY };
        };
        const handleMouseUp = (e) => {
            if (Date.now() - mouseDownTime > 200) return;
            const dist = Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y);
            if (dist > 10) return;

            const mouse = new THREE.Vector2();
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(buildings);
            
            if (intersects.length > 0) {
                const target = intersects[0].object;
                const data = target.userData;
                
                if (isPlayingRef.current && GameState.phase === 'BATTLE' && !data.isBurnt) {
                    // Use playerId from props (for battle mode) or determine from click (for local mode)
                    const currentPlayer = roomId ? `P${playerId}` : ((e.button === 0 && !e.shiftKey) ? 'P1' : 'P2');
                    
                    // Get player state: use P1 slot for odd playerIds (1, 3), P2 slot for even playerIds (2, 4)
                    let playerState;
                    if (roomId) {
                        const isOddPlayer = parseInt(playerId) % 2 === 1;
                        playerState = isOddPlayer ? GameState.p1 : GameState.p2;
                    } else {
                        playerState = currentPlayer === 'P1' ? GameState.p1 : GameState.p2;
                    }
                    
                    // Check cooldown
                    if (playerState.cooldown <= 0) {
                        // Ignite building and track which player ignited it
                        data.isBurnt = true;
                        data.heat = CONFIG.HEAT_THRESHOLD;
                        data.ignitedBy = currentPlayer; // Track which player ignited this building (P1, P2, P3, or P4)
                        data.isWall = false; // Remove wall status if any
                        target.material.color.setHex(0x220000);
                        target.scale.y *= 0.8;
                        playerState.cooldown = CONFIG.IGNITE_COOLDOWN;
                        flashColor(target, 0xffaa00);
                        //AudioController.playIgnite(); // 既存の着火SE
                        AudioController.playFireSound(); // 燃えているSEも再生
                    }
                }
            }
        };

        const flashColor = (mesh, hex) => {
            mesh.material.color.setHex(hex);
            setTimeout(() => {
                if (mesh.userData.isBurnt) mesh.material.color.setHex(0x220000);
                else if (mesh.userData.isWall) mesh.material.color.setHex(0x3333ff);
                else if (mesh.userData.heat > 0) {}
                else mesh.material.color.setHex(mesh.userData.baseColor);
            }, 100);
        };
        
        const onResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };

        // Attach Events
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('resize', onResize);
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('contextmenu', e => e.preventDefault());

        // Start
        initCity();
        GameState.reset();
        // Force resize once to ensure correct size
        onResize();
        animate();

        // Cleanup
        return () => {
            cancelAnimationFrame(reqId);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
            if (mountRef.current) mountRef.current.removeChild(renderer.domElement);
            fireParticles.dispose();
            renderer.dispose();
        };
    }, []); 

    // Watch isPlaying and reset game when it changes to true
    useEffect(() => {
        isPlayingRef.current = isPlaying;
        if (isPlaying && buildingsRef.current.length > 0) {
            // Reset all buildings
            buildingsRef.current.forEach(building => {
                const data = building.userData;
                data.heat = 0;
                data.isBurnt = false;
                data.isWall = false;
                data.ignitedBy = null; // Reset ignition tracking
                
                // Reset visual state
                building.material.color.setHex(data.baseColor);
                
                // Reset scale/position to original
                building.scale.y = data.originalHeight;
                building.position.y = data.originalY;
            });
            
            // Reset particles
            if (fireParticlesRef.current) {
                fireParticlesRef.current.reset();
            }
            
            // Reset game state
            GameState.reset();
        }
    }, [isPlaying]);

    // SEをプリロード
    useEffect(() => {
        AudioController.preloadSounds().catch(err => {
            console.error('Failed to preload sounds:', err);
        });
    }, []);

    return <div ref={mountRef} style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }} />;
}



