import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';
import { State } from './state.js';
import { ParticleSystem } from './particles.js';

let scene, camera, renderer, raycaster;
let buildings = [];
let fireParticles;
const geometry = new THREE.BoxGeometry(1, 1, 1);

// Camera Control State
const keys = {
    w: false, a: false, s: false, d: false,
    space: false, shift: false
};
const CAMERA_SPEED = 20.0;
const ZOOM_SPEED = 20.0;

export function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101015);
    scene.fog = new THREE.Fog(0x101015, 30, 120);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 40, 40);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    
    // Fix renderer to background
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.zIndex = '-1';
    
    document.body.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffaa00, 0.8);
    dirLight.position.set(20, 50, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Particles
    fireParticles = new ParticleSystem(scene);

    // Raycaster
    raycaster = new THREE.Raycaster();

    // Keyboard Events for Camera
    window.addEventListener('keydown', (e) => {
        switch(e.code) {
            case 'KeyW': keys.w = true; break;
            case 'KeyS': keys.s = true; break;
            case 'KeyA': keys.a = true; break;
            case 'KeyD': keys.d = true; break;
            case 'Space': keys.space = true; break;
            case 'ShiftLeft': case 'ShiftRight': keys.shift = true; break;
        }
    });

    window.addEventListener('keyup', (e) => {
        switch(e.code) {
            case 'KeyW': keys.w = false; break;
            case 'KeyS': keys.s = false; break;
            case 'KeyA': keys.a = false; break;
            case 'KeyD': keys.d = false; break;
            case 'Space': keys.space = false; break;
            case 'ShiftLeft': case 'ShiftRight': keys.shift = false; break;
        }
    });

    // Resize Handler
    window.addEventListener('resize', onWindowResize, false);
}

export function initCity() {
    // Clear existing
    buildings.forEach(b => scene.remove(b));
    buildings.length = 0;
    if (fireParticles) fireParticles.reset();

    if (CONFIG.USE_CITY_MODEL) {
        loadCityModel();
    } else {
        createRandomCity();
    }
}

function createRandomCity() {
    const offset = (CONFIG.GRID_SIZE * (CONFIG.CUBE_SIZE + CONFIG.GAP)) / 2;

    for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
        for (let z = 0; z < CONFIG.GRID_SIZE; z++) {
            // Random height for city skyline look
            const height = CONFIG.CUBE_SIZE * (1 + Math.random() * 2); 
            const material = new THREE.MeshPhongMaterial({ color: 0x888888 });
            const mesh = new THREE.Mesh(geometry, material);

            mesh.scale.set(CONFIG.CUBE_SIZE, height, CONFIG.CUBE_SIZE);
            mesh.position.set(
                x * (CONFIG.CUBE_SIZE + CONFIG.GAP) - offset,
                height / 2,
                z * (CONFIG.CUBE_SIZE + CONFIG.GAP) - offset
            );
            
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            setupBuildingData(mesh, `${x}-${z}`);
            
            scene.add(mesh);
            buildings.push(mesh);
        }
    }
    State.stats.totalBuildings = buildings.length;
}

function loadCityModel() {
    const loader = new GLTFLoader();
    console.log("Loading city model from:", CONFIG.CITY_MODEL_PATH);
    
    loader.load(CONFIG.CITY_MODEL_PATH, (gltf) => {
        const model = gltf.scene;
        model.scale.set(CONFIG.CITY_SCALE, CONFIG.CITY_SCALE, CONFIG.CITY_SCALE);
        model.position.y = CONFIG.CITY_OFFSET_Y;
        
        scene.add(model);

        // Process all meshes in the model
        let idCounter = 0;
        model.traverse((child) => {
            if (child.isMesh) {
                // Determine if this is a building or ground
                // Simple heuristic: if it's flat (low height) it might be ground
                // Ideally, check name or material. For now, assume all meshes are buildings.
                
                // Clone material so we can change color individually
                const oldMat = Array.isArray(child.material) ? child.material[0] : child.material;
                const newMat = new THREE.MeshPhongMaterial({
                    color: oldMat.color,
                    map: oldMat.map
                });
                child.material = newMat;
                
                child.castShadow = true;
                child.receiveShadow = true;

                setupBuildingData(child, `blg-${idCounter++}`);
                buildings.push(child);
            }
        });

        console.log(`Loaded ${buildings.length} buildings.`);
        State.stats.totalBuildings = buildings.length;
        
        // Adjust Camera to fit model?
        // simple auto-centering logic could go here
        
    }, undefined, (error) => {
        console.error('An error happened loading the city model:', error);
        // Fallback
        console.log("Falling back to random city.");
        createRandomCity();
    });
}

function setupBuildingData(mesh, id) {
    mesh.userData = {
        heat: 0,
        isBurnt: false,
        isWall: false,
        baseColor: mesh.material.color.getHex(),
        id: id
    };
}

export function render(delta) {
    updateCamera(delta);
    if (fireParticles) fireParticles.update(delta);
    renderer.render(scene, camera);
}

function updateCamera(delta) {
    const moveSpeed = CAMERA_SPEED * delta;
    const zoomSpeed = ZOOM_SPEED * delta;

    if (keys.w) camera.position.z -= moveSpeed;
    if (keys.s) camera.position.z += moveSpeed;
    if (keys.a) camera.position.x -= moveSpeed;
    if (keys.d) camera.position.x += moveSpeed;
    
    // Zoom / Altitude
    // Space = Zoom In (Lower altitude)
    if (keys.space) {
        if (camera.position.y > 5) camera.position.y -= zoomSpeed;
    }
    // Shift = Zoom Out (Higher altitude)
    if (keys.shift) {
        if (camera.position.y < 100) camera.position.y += zoomSpeed;
    }
}

export function getIntersectObject(normalizedMouse) {
    if (!raycaster || !camera) return null;
    raycaster.setFromCamera(normalizedMouse, camera);
    const intersects = raycaster.intersectObjects(buildings, true); // true for recursive (just in case)
    return intersects.length > 0 ? intersects[0].object : null;
}

export function emitFire(position) {
    if (fireParticles) fireParticles.emit(position, 2);
}

export function getBuildings() {
    return buildings;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

