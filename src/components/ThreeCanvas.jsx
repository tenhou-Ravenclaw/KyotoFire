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

export default function ThreeCanvas({ isPlaying, onUpdate, onGameEnd, onLoadProgress }) {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const isInitialized = useRef(false);
    const buildingsRef = useRef([]);
    const fireParticlesRef = useRef(null);
    
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
                        
                        console.log(`Field boundaries: X(${bbox.min.x.toFixed(1)} to ${bbox.max.x.toFixed(1)}), Z(${bbox.min.z.toFixed(1)} to ${bbox.max.z.toFixed(1)})`);
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
            mesh.userData = {
                heat: 0,
                isBurnt: false,
                isWall: false,
                baseColor: mesh.material.color.getHex(),
                id: id,
                originalHeight: mesh.scale.y,
                originalY: mesh.position.y
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
                    AudioController.playAlarm();
                } else if (GameState.phase === 'BATTLE') {
                    AudioController.playAlarm();
                    if (GameState.stats.damagePercent < CONFIG.WIN_THRESHOLD) {
                        onGameEnd('P1');
                    } else {
                        onGameEnd('P2');
                    }
                    return;
                }
            }

            if (GameState.phase === 'BATTLE') {
                const progress = 1 - (GameState.timer / CONFIG.BATTLE_TIME);
                if (CONFIG.DIFFICULTY_RAMP) {
                    GameState.p1.incomeRate = CONFIG.P1_INCOME_BASE + (progress * 100); 
                    GameState.p2.maxCooldown = Math.max(0.5, CONFIG.P2_COOLDOWN_BASE - (progress * 2.0));
                }

                GameState.p1.budget += GameState.p1.incomeRate * delta;
                if (GameState.p2.cooldown > 0) GameState.p2.cooldown -= delta;

                let currentBurnt = 0;
                const range = CONFIG.USE_CITY_MODEL ? (CONFIG.FIRE_SPREAD_RANGE * CONFIG.CITY_SCALE) : (CONFIG.CUBE_SIZE * 1.5);
                const burningBuildings = [];
                
                // Pass 1: Count burnt, collect burning buildings, update heat decay
                for (let i = 0; i < buildings.length; i++) {
                    const b = buildings[i];
                    const data = b.userData;
                    
                    if (data.isBurnt) {
                        currentBurnt++;
                        burningBuildings.push(b);
                        
                        // Emit particles (reduced frequency)
                        if (Math.random() < 0.15) {
                            const firePos = b.position.clone();
                            firePos.y += b.scale.y * 0.5;
                            fireParticles.emit(firePos, 2);
                        }
                    } else if (data.heat >= CONFIG.HEAT_THRESHOLD) {
                        data.isBurnt = true;
                        data.heat = CONFIG.HEAT_THRESHOLD;
                        b.material.color.setHex(0x220000);
                        b.scale.y *= 0.8;
                        currentBurnt++;
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
                
                // Pass 2: Only spread heat from burning buildings
                for (let i = 0; i < burningBuildings.length; i++) {
                    const b = burningBuildings[i];
                    const bPos = b.position;
                    
                    for (let j = 0; j < buildings.length; j++) {
                        const target = buildings[j];
                        if (target.userData.isBurnt || target.userData.isWall) continue;
                        
                        const dist = bPos.distanceTo(target.position);
                        if (dist < range) {
                            target.userData.heat += CONFIG.HEAT_TRANSFER_RATE * delta;
                        }
                    }
                }

                GameState.stats.burntBuildings = currentBurnt;
                GameState.stats.damagePercent = (currentBurnt / GameState.stats.totalBuildings) * 100;

                if (GameState.stats.damagePercent >= CONFIG.WIN_THRESHOLD) {
                    onGameEnd('P2');
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
                if (e.button === 2 || (e.button === 0 && e.shiftKey)) {
                    // P2
                    if (GameState.phase === 'BATTLE') {
                        if (GameState.p2.cooldown <= 0 && !target.userData.isWall && !target.userData.isBurnt) {
                            target.userData.heat = CONFIG.HEAT_THRESHOLD + 10;
                            GameState.p2.cooldown = GameState.p2.maxCooldown;
                            flashColor(target, 0xffaa00);
                            AudioController.playIgnite();
                        }
                    }
                } else if (e.button === 0) {
                    // P1
                    const data = target.userData;
                    if (!data.isBurnt) {
                        if (data.heat > 0 && GameState.p1.budget >= CONFIG.P1_EXTINGUISH_COST) {
                            GameState.p1.budget -= CONFIG.P1_EXTINGUISH_COST;
                            data.heat = 0;
                            data.isWall = false;
                            flashColor(target, 0x00ffff);
                            target.material.color.setHex(data.baseColor);
                            AudioController.playExtinguish();
                        } else if (!data.isWall && data.heat === 0 && GameState.p1.budget >= CONFIG.P1_WALL_COST) {
                            GameState.p1.budget -= CONFIG.P1_WALL_COST;
                            data.isWall = true;
                            target.material.color.setHex(0x3333ff);
                            target.scale.y = CONFIG.CUBE_SIZE * 0.5;
                            target.position.y = target.scale.y / 2;
                            AudioController.playWall();
                        }
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
        if (isPlaying && buildingsRef.current.length > 0) {
            // Reset all buildings
            buildingsRef.current.forEach(building => {
                const data = building.userData;
                data.heat = 0;
                data.isBurnt = false;
                data.isWall = false;
                
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

    return <div ref={mountRef} style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }} />;
}
