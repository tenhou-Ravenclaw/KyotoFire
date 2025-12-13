import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene, maxParticles = 2000) {
        this.scene = scene;
        this.maxParticles = maxParticles;
        this.particles = [];
        
        // Geometry for all particles
        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(maxParticles * 3);
        this.colors = new Float32Array(maxParticles * 3);
        this.sizes = new Float32Array(maxParticles);
        
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

        // Shader Material for nice fire look
        // Using a simple circular sprite drawn in shader
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                pointTexture: { value: new THREE.TextureLoader().load('https://threejs.org/examples/textures/sprites/spark1.png') }
            },
            vertexShader: `
                attribute float size;
                varying vec3 vColor;
                void main() {
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D pointTexture;
                varying vec3 vColor;
                void main() {
                    gl_FragColor = vec4(vColor, 1.0);
                    gl_FragColor = gl_FragColor * texture2D(pointTexture, gl_PointCoord);
                    if (gl_FragColor.a < 0.1) discard;
                }
            `,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            vertexColors: true
        });

        this.points = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.points);
        
        // Initialize pool
        for (let i = 0; i < maxParticles; i++) {
            this.particles.push({
                active: false,
                index: i,
                life: 0,
                velocity: new THREE.Vector3()
            });
            // Hide initially
            this.sizes[i] = 0;
        }
    }

    emit(position, count = 5) {
        for (let k = 0; k < count; k++) {
            // Find inactive particle
            const p = this.particles.find(p => !p.active);
            if (!p) return; // Pool empty

            p.active = true;
            p.life = 1.0;
            
            // Random spread
            const spread = 0.5;
            this.positions[p.index * 3] = position.x + (Math.random() - 0.5) * spread;
            this.positions[p.index * 3 + 1] = position.y + (Math.random() * 0.5);
            this.positions[p.index * 3 + 2] = position.z + (Math.random() - 0.5) * spread;

            // Upward velocity with some drift
            p.velocity.set(
                (Math.random() - 0.5) * 0.05,
                0.1 + Math.random() * 0.1,
                (Math.random() - 0.5) * 0.05
            );

            // Color: Orange/Red/Yellow
            this.colors[p.index * 3] = 1.0; // R
            this.colors[p.index * 3 + 1] = 0.5 + Math.random() * 0.5; // G (Yellowish)
            this.colors[p.index * 3 + 2] = 0.0; // B
            
            this.sizes[p.index] = 1.0 + Math.random() * 2.0;
        }
    }

    update(delta) {
        let activeCount = 0;
        for (let i = 0; i < this.maxParticles; i++) {
            const p = this.particles[i];
            if (!p.active) continue;
            
            activeCount++;
            p.life -= delta * 1.5; // Fade speed

            if (p.life <= 0) {
                p.active = false;
                this.sizes[i] = 0;
                continue;
            }

            // Move
            this.positions[i * 3] += p.velocity.x;
            this.positions[i * 3 + 1] += p.velocity.y;
            this.positions[i * 3 + 2] += p.velocity.z;

            // Color shift over life (Yellow -> Red -> Dark)
            this.colors[i * 3 + 1] = p.life * 0.8; 
            
            this.sizes[i] = p.life * 4.0;
        }
        
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        this.geometry.attributes.size.needsUpdate = true;
    }
    
    reset() {
         for (let i = 0; i < this.maxParticles; i++) {
             this.particles[i].active = false;
             this.sizes[i] = 0;
         }
         this.geometry.attributes.size.needsUpdate = true;
    }
}

