// Return of Jewel Their - ROJT
// 3D Circle Packing with Parametric Diamonds

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class CirclePacker {
    constructor(bounds, minRadius, maxRadius) {
        this.bounds = bounds;
        this.minRadius = minRadius;
        this.maxRadius = maxRadius;
        this.circles = [];
        this.attempts = 5000;
    }

    // Check if a circle overlaps with existing circles
    isOverlapping(x, y, radius) {
        for (let circle of this.circles) {
            const dx = x - circle.x;
            const dy = y - circle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < radius + circle.radius) {
                return true;
            }
        }
        return false;
    }

    // Check if circle is within bounds
    isWithinBounds(x, y, radius) {
        return x - radius > -this.bounds.width / 2 &&
               x + radius < this.bounds.width / 2 &&
               y - radius > -this.bounds.height / 2 &&
               y + radius < this.bounds.height / 2;
    }

    // Pack circles using random placement
    pack(count) {
        this.circles = [];
        let placed = 0;

        // Try to place circles, starting with larger ones
        for (let i = 0; i < this.attempts && placed < count; i++) {
            // Bias towards larger circles early on
            const radiusBias = 1 - (placed / count);
            const radius = this.minRadius + 
                          (this.maxRadius - this.minRadius) * 
                          Math.pow(Math.random(), 1 / (1 + radiusBias * 2));
            
            const x = (Math.random() - 0.5) * this.bounds.width;
            const y = (Math.random() - 0.5) * this.bounds.height;

            if (this.isWithinBounds(x, y, radius) && 
                !this.isOverlapping(x, y, radius)) {
                this.circles.push({ x, y, radius });
                placed++;
            }
        }

        return this.circles;
    }

    // Get packed circles
    getCircles() {
        return this.circles;
    }
}

class ParametricDiamond {
    constructor(radius, height, layers = 3) {
        this.radius = radius;
        this.height = height;
        this.layers = layers;
        this.cubeSize = Math.min(radius, height) / (layers * 2);
    }

    // Helper to add cube geometry
    addCube(positions, indices, x, y, z, size) {
        const startIdx = positions.length / 3;
        const s = size / 2;
        
        // 8 vertices of cube
        const vertices = [
            [x - s, y - s, z - s], [x + s, y - s, z - s],
            [x + s, y + s, z - s], [x - s, y + s, z - s],
            [x - s, y - s, z + s], [x + s, y - s, z + s],
            [x + s, y + s, z + s], [x - s, y + s, z + s]
        ];
        
        vertices.forEach(v => positions.push(...v));
        
        // 12 triangles (6 faces)
        const faces = [
            [0, 1, 2], [0, 2, 3], [5, 4, 7], [5, 7, 6],
            [4, 0, 3], [4, 3, 7], [1, 5, 6], [1, 6, 2],
            [3, 2, 6], [3, 6, 7], [4, 5, 1], [4, 1, 0]
        ];
        
        faces.forEach(face => {
            indices.push(startIdx + face[0], startIdx + face[1], startIdx + face[2]);
        });
    }

    // Create diamond from cube building blocks
    createGeometry() {
        const positions = [];
        const indices = [];
        
        const cubeSize = this.cubeSize;
        const topHeight = this.height * 0.4;
        const bottomHeight = -this.height;
        
        // Build diamond layer by layer - simplified for performance
        for (let y = bottomHeight; y <= topHeight; y += cubeSize) {
            let maxRadius;
            if (y > 0) {
                maxRadius = this.radius * (1 - y / topHeight);
            } else {
                maxRadius = this.radius * (1 + y / (-bottomHeight));
            }
            
            const numRings = Math.ceil(maxRadius / cubeSize);
            
            for (let ring = 0; ring < numRings; ring++) {
                const ringRadius = ring * cubeSize;
                const circumference = 2 * Math.PI * ringRadius;
                const numCubes = Math.max(1, Math.floor(circumference / cubeSize));
                
                for (let i = 0; i < numCubes; i++) {
                    const angle = (i / numCubes) * Math.PI * 2;
                    const x = Math.cos(angle) * ringRadius;
                    const z = Math.sin(angle) * ringRadius;
                    
                    const dist = Math.sqrt(x * x + z * z);
                    if (dist <= maxRadius) {
                        this.addCube(positions, indices, x, y, z, cubeSize * 0.95);
                    }
                }
            }
        }
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        
        return geometry;
    }
}

class JewelScene {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.diamonds = [];
        this.wireframeMode = false;
        this.rotationSpeed = 1;
        
        this.settings = {
            count: 20,
            minRadius: 0.5,
            maxRadius: 3,
            height: 2,
            rotation: 1
        };

        this.init();
        this.setupControls();
        this.generateDiamonds();
        this.animate();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x808080);
        this.scene.fog = new THREE.Fog(0x808080, 30, 100);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(25, 25, 25);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);

        // Orbit Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 100;

        // Lighting - subtle colors
        const ambientLight = new THREE.AmbientLight(0xf5f5f5, 0.6);
        this.scene.add(ambientLight);

        const pointLight1 = new THREE.PointLight(0xffeedd, 0.4, 100);
        pointLight1.position.set(20, 20, 20);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0xeeddff, 0.3, 100);
        pointLight2.position.set(-20, 20, -20);
        this.scene.add(pointLight2);

        const pointLight3 = new THREE.PointLight(0xffffdd, 0.3, 100);
        pointLight3.position.set(0, -20, 0);
        this.scene.add(pointLight3);

        // Add directional light for soft definition
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = false;
        this.scene.add(dirLight);

        // Add grid helper
        const gridHelper = new THREE.GridHelper(60, 30, 0x999999, 0x666666);
        gridHelper.position.y = -10;
        this.scene.add(gridHelper);

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    setupControls() {
        // Count slider
        const countSlider = document.getElementById('count');
        const countValue = document.getElementById('count-value');
        countSlider.addEventListener('input', (e) => {
            this.settings.count = parseInt(e.target.value);
            countValue.textContent = e.target.value;
        });

        // Min radius slider
        const minRadiusSlider = document.getElementById('minRadius');
        const minRadiusValue = document.getElementById('minRadius-value');
        minRadiusSlider.addEventListener('input', (e) => {
            this.settings.minRadius = parseFloat(e.target.value);
            minRadiusValue.textContent = e.target.value;
        });

        // Max radius slider
        const maxRadiusSlider = document.getElementById('maxRadius');
        const maxRadiusValue = document.getElementById('maxRadius-value');
        maxRadiusSlider.addEventListener('input', (e) => {
            this.settings.maxRadius = parseFloat(e.target.value);
            maxRadiusValue.textContent = e.target.value;
        });

        // Height slider
        const heightSlider = document.getElementById('height');
        const heightValue = document.getElementById('height-value');
        heightSlider.addEventListener('input', (e) => {
            this.settings.height = parseFloat(e.target.value);
            heightValue.textContent = e.target.value;
        });

        // Rotation slider
        const rotationSlider = document.getElementById('rotation');
        const rotationValue = document.getElementById('rotation-value');
        rotationSlider.addEventListener('input', (e) => {
            this.settings.rotation = parseFloat(e.target.value);
            rotationValue.textContent = e.target.value;
            this.rotationSpeed = parseFloat(e.target.value);
        });

        // Regenerate button
        document.getElementById('regenerate').addEventListener('click', () => {
            this.generateDiamonds();
        });

        // Toggle wireframe button
        document.getElementById('toggleWireframe').addEventListener('click', () => {
            this.wireframeMode = !this.wireframeMode;
            this.diamonds.forEach(diamond => {
                diamond.material.wireframe = this.wireframeMode;
            });
        });
    }

    generateDiamonds() {
        // Clear existing diamonds
        this.diamonds.forEach(diamond => {
            this.scene.remove(diamond);
            if (diamond.geometry) diamond.geometry.dispose();
            if (diamond.material) diamond.material.dispose();
        });
        this.diamonds = [];

        // Define 10 discrete height levels
        const HEIGHT_LEVELS = 10;
        const heightLevels = [];
        for (let i = 0; i < HEIGHT_LEVELS; i++) {
            // Create levels from 0.8 to 1.4 times the base height, rounded
            const levelMultiplier = 0.8 + (i / (HEIGHT_LEVELS - 1)) * 0.6;
            const heightValue = Math.round(this.settings.height * levelMultiplier * 10) / 10;
            heightLevels.push(heightValue);
        }

        // Circle packing
        const packer = new CirclePacker(
            { width: 50, height: 50 },
            this.settings.minRadius,
            this.settings.maxRadius
        );
        const circles = packer.pack(this.settings.count);

        // Create diamonds from packed circles
        circles.forEach((circle, index) => {
            // Assign a discrete height level
            const levelIndex = Math.floor(Math.random() * HEIGHT_LEVELS);
            const discreteHeight = heightLevels[levelIndex];
            
            const diamond = new ParametricDiamond(
                circle.radius,
                discreteHeight,
                3 + Math.floor(Math.random() * 2) // layers: 3-4 layers of cubes (reduced for performance)
            );
            
            const geometry = diamond.createGeometry();
            
            // Vary probabilities of light and dark pieces for variety
            // 65% light pieces, 35% dark pieces
            const randomValue = Math.random();
            let color, opacity, metalness, roughness;
            
            if (randomValue < 0.65) {
                // Light pieces - brighter colors with variation
                const lightness = 0.7 + Math.random() * 0.3; // 0.7 to 1.0
                color = new THREE.Color(lightness, lightness, lightness);
                opacity = 0.7 + Math.random() * 0.2; // 0.7 to 0.9
                metalness = 0.05 + Math.random() * 0.1; // 0.05 to 0.15
                roughness = 0.1 + Math.random() * 0.2; // 0.1 to 0.3
            } else {
                // Dark pieces - darker colors with variation
                const darkness = Math.random() * 0.3; // 0.0 to 0.3
                color = new THREE.Color(darkness, darkness, darkness);
                opacity = 0.8 + Math.random() * 0.15; // 0.8 to 0.95
                metalness = 0.1 + Math.random() * 0.15; // 0.1 to 0.25
                roughness = 0.15 + Math.random() * 0.25; // 0.15 to 0.4
            }
            
            const material = new THREE.MeshStandardMaterial({
                color: color,
                metalness: metalness,
                roughness: roughness,
                transparent: true,
                opacity: opacity,
                flatShading: false,
                wireframe: this.wireframeMode,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(circle.x, 0, circle.y);
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            
            // Store rotation speed for each diamond
            mesh.userData.rotationSpeed = {
                x: (Math.random() - 0.5) * 0.02,
                y: (Math.random() - 0.5) * 0.02 + 0.01,
                z: (Math.random() - 0.5) * 0.02
            };

            this.scene.add(mesh);
            this.diamonds.push(mesh);
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Rotate diamonds
        this.diamonds.forEach(diamond => {
            diamond.rotation.x += diamond.userData.rotationSpeed.x * this.rotationSpeed;
            diamond.rotation.y += diamond.userData.rotationSpeed.y * this.rotationSpeed;
            diamond.rotation.z += diamond.userData.rotationSpeed.z * this.rotationSpeed;
        });

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const jewelScene = new JewelScene();
});

