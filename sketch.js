import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { Brush, Evaluator, SUBTRACTION, INTERSECTION, ADDITION } from 'three-bvh-csg';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2a2a);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(250, 250, 250);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 50;
controls.maxDistance = 400;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
mainLight.position.set(100, 150, 100);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 2048;
mainLight.shadow.mapSize.height = 2048;
mainLight.shadow.camera.left = -200;
mainLight.shadow.camera.right = 200;
mainLight.shadow.camera.top = 200;
mainLight.shadow.camera.bottom = -200;
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0x8899ff, 0.4);
fillLight.position.set(-80, 80, -80);
scene.add(fillLight);

// CSG Evaluator
const csgEvaluator = new Evaluator();
csgEvaluator.useGroups = false;

// Simple noise function (Perlin-like)
function noise(x, y, z = 0) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  z -= Math.floor(z);
  const u = fade(x);
  const v = fade(y);
  const w = fade(z);
  const A = (p[X] + Y) & 255;
  const B = (p[X + 1] + Y) & 255;
  const AA = (p[A] + Z) & 255;
  const BA = (p[B] + Z) & 255;
  const AB = (p[A + 1] + Z) & 255;
  const BB = (p[B + 1] + Z) & 255;
  return lerp(w, 
    lerp(v, lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)),
            lerp(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z))),
    lerp(v, lerp(u, grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1)),
            lerp(u, grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1))));
}

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t, a, b) { return a + t * (b - a); }
function grad(hash, x, y, z) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

const p = new Array(512);
const permutation = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
for (let i = 0; i < 256; i++) p[i] = p[i + 256] = permutation[i];

// Generative sculpture parameters
let iSet = Math.floor(Math.random() * 5 + 5);
let iPlus = Math.floor(Math.random() * 5 + 5);
let sculptureGroup = new THREE.Group();
let wireframeMode = false;
let regenerateFlag = false;
let lightDarkThreshold = 0; // -1 = more dark, 0 = balanced, 1 = more light

// Store merged geometries for export
let lightMergedBrush = null;
let darkMergedBrush = null;

// Materials
const lightMaterial = new THREE.MeshStandardMaterial({
  color: 0xf5f5f5,
  metalness: 0.1,
  roughness: 0.6,
  flatShading: false
});

const darkMaterial = new THREE.MeshStandardMaterial({
  color: 0x141414,
  metalness: 0.2,
  roughness: 0.4,
  flatShading: false
});

// Create a single cube at position with height variation
function createCube(x, y, z, size, height, isDark = false) {
  // Ensure minimum valid dimensions to avoid degenerate geometry
  const safeSize = Math.max(size, 0.01);
  const safeHeight = Math.max(height, 0.01);
  
  const boxGeo = new THREE.BoxGeometry(safeSize, safeSize, safeHeight);
  boxGeo.computeVertexNormals();
  
  const material = isDark ? darkMaterial : lightMaterial;
  const brush = new Brush(boxGeo, material);
  brush.position.set(x, y, z);
  brush.castShadow = true;
  brush.receiveShadow = true;
  brush.updateMatrixWorld(true);
  return brush;
}

// Draw concentric square frame of cubes (inspired by p5.js sketch)
function drawCubeFrame(side, size) {
  const lightCubes = [];
  const darkCubes = [];
  
  for (let x = -side / 2; x <= side / 2; x += size) {
    for (let y = -side / 2; y <= side / 2; y += size) {
      // Only draw on the edges of the square
      if (x === -side / 2 || x === side / 2 || y === -side / 2 || y === side / 2) {
        // Use absolute values for kaleidoscopic 4-way symmetry
        const absX = Math.abs(x);
        const absY = Math.abs(y);
        
        const nF = (noise(absX / 10, absY / 10, size) + 1) / 2; // Normalize to 0-1
        const noiseVal = noise(absX * 0.05, absY * 0.05);
        
        let zPos, height, isDark;
        
        // Use lightDarkThreshold to control balance of light vs dark pieces
        if (noiseVal > lightDarkThreshold) {
          // Light colored, taller extrusions
          zPos = size / 30 * 15 * nF;
          height = size / 30 * 30 * nF;
          isDark = false;
        } else {
          // Dark colored, shorter extrusions
          zPos = size / 30 * 5 * nF;
          height = size / 30 * 10 * nF;
          isDark = true;
        }
        
        const cube = createCube(x, y, zPos, size, height, isDark);
        
        if (isDark) {
          darkCubes.push(cube);
        } else {
          lightCubes.push(cube);
        }
      }
    }
  }
  
  return { lightCubes, darkCubes };
}

// Build the entire sculpture
function buildSculpture() {
  console.log('Building sculpture...');
  
  // Clear existing sculpture
  while (sculptureGroup.children.length > 0) {
    const child = sculptureGroup.children[0];
    if (child.geometry) child.geometry.dispose();
    sculptureGroup.remove(child);
  }
  
  // Dispose old merged brushes
  if (lightMergedBrush && lightMergedBrush.geometry) {
    lightMergedBrush.geometry.dispose();
  }
  if (darkMergedBrush && darkMergedBrush.geometry) {
    darkMergedBrush.geometry.dispose();
  }
  
  // Collect all cubes
  let allLightCubes = [];
  let allDarkCubes = [];
  
  // Create concentric frames
  for (let i = iSet; i <= 65; i += iPlus) {
    const { lightCubes, darkCubes } = drawCubeFrame(i * 4, i);
    allLightCubes = allLightCubes.concat(lightCubes);
    allDarkCubes = allDarkCubes.concat(darkCubes);
  }
  
  console.log(`Merging ${allLightCubes.length} light cubes and ${allDarkCubes.length} dark cubes...`);
  
  // Merge all light cubes using CSG ADDITION with error handling
  if (allLightCubes.length > 0) {
    lightMergedBrush = allLightCubes[0];
    for (let i = 1; i < allLightCubes.length; i++) {
      try {
        const result = csgEvaluator.evaluate(lightMergedBrush, allLightCubes[i], ADDITION);
        if (result && result.geometry && result.geometry.attributes.position) {
          result.updateMatrixWorld(true);
          lightMergedBrush = result;
        }
        allLightCubes[i].geometry.dispose(); // Clean up
      } catch (error) {
        console.warn(`Skipping light cube ${i} due to CSG error:`, error.message);
        allLightCubes[i].geometry.dispose();
      }
    }
  }
  
  // Merge all dark cubes using CSG ADDITION with error handling
  if (allDarkCubes.length > 0) {
    darkMergedBrush = allDarkCubes[0];
    for (let i = 1; i < allDarkCubes.length; i++) {
      try {
        const result = csgEvaluator.evaluate(darkMergedBrush, allDarkCubes[i], ADDITION);
        if (result && result.geometry && result.geometry.attributes.position) {
          result.updateMatrixWorld(true);
          darkMergedBrush = result;
        }
        allDarkCubes[i].geometry.dispose(); // Clean up
      } catch (error) {
        console.warn(`Skipping dark cube ${i} due to CSG error:`, error.message);
        allDarkCubes[i].geometry.dispose();
      }
    }
  }
  
  // Create base plate
  const baseGeo = new THREE.BoxGeometry(300, 300, 1);
  baseGeo.computeVertexNormals();
  const baseBrush = new Brush(baseGeo, new THREE.MeshStandardMaterial({
    color: 0x000000,
    metalness: 0.3,
    roughness: 0.7
  }));
  baseBrush.updateMatrixWorld(true);
  
  // Add base plate to dark pieces using CSG ADDITION with error handling
  if (darkMergedBrush) {
    console.log('Adding base plate to dark pieces...');
    try {
      const result = csgEvaluator.evaluate(darkMergedBrush, baseBrush, ADDITION);
      if (result && result.geometry && result.geometry.attributes.position) {
        result.updateMatrixWorld(true);
        darkMergedBrush = result;
      }
    } catch (error) {
      console.warn('Error adding base plate, using base only:', error.message);
      darkMergedBrush = baseBrush;
    }
  } else {
    // If no dark pieces, just use the base
    darkMergedBrush = baseBrush;
  }
  
  // SUBTRACT dark (including base) from light to create interlocking geometry with error handling
  if (lightMergedBrush && darkMergedBrush) {
    console.log('Creating interlocking geometry - subtracting dark from light...');
    try {
      const result = csgEvaluator.evaluate(lightMergedBrush, darkMergedBrush, SUBTRACTION);
      if (result && result.geometry && result.geometry.attributes.position) {
        result.updateMatrixWorld(true);
        lightMergedBrush = result;
      } else {
        console.warn('Subtraction resulted in invalid geometry, keeping original light pieces');
      }
    } catch (error) {
      console.warn('Error during subtraction, keeping original light pieces:', error.message);
    }
  }
  
  // Add to scene
  if (lightMergedBrush) {
    lightMergedBrush.material = lightMaterial;
    lightMergedBrush.castShadow = true;
    lightMergedBrush.receiveShadow = true;
    sculptureGroup.add(lightMergedBrush);
  }
  
  if (darkMergedBrush) {
    darkMergedBrush.material = darkMaterial;
    darkMergedBrush.castShadow = true;
    darkMergedBrush.receiveShadow = true;
    sculptureGroup.add(darkMergedBrush);
  }
  
  scene.add(sculptureGroup);
  
  // Enable download buttons
  document.getElementById('downloadLight').disabled = false;
  document.getElementById('downloadDark').disabled = false;
  
  console.log('Sculpture complete!');
}

// UI Controls
document.getElementById('addBlock').textContent = 'Regenerate';
document.getElementById('addBlock').addEventListener('click', () => {
  iSet = Math.floor(Math.random() * 5 + 5);
  iPlus = Math.floor(Math.random() * 5 + 5);
  buildSculpture();
});

document.getElementById('reset').textContent = 'New Seed';
document.getElementById('reset').addEventListener('click', () => {
  // Regenerate with different random seed
  for (let i = 0; i < 256; i++) {
    const j = Math.floor(Math.random() * 256);
    [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
  }
  for (let i = 0; i < 256; i++) p[i] = p[i + 256] = permutation[i];
  buildSculpture();
});

document.getElementById('toggleWireframe').addEventListener('click', () => {
  wireframeMode = !wireframeMode;
  lightMaterial.wireframe = wireframeMode;
  darkMaterial.wireframe = wireframeMode;
});

let isRotating = true;
document.getElementById('rotatePuzzle').textContent = 'Pause Rotation';
document.getElementById('rotatePuzzle').addEventListener('click', () => {
  isRotating = !isRotating;
  controls.autoRotate = isRotating;
  document.getElementById('rotatePuzzle').textContent = isRotating ? 'Pause Rotation' : 'Resume Rotation';
});

// Light/Dark balance slider
const balanceSlider = document.getElementById('balanceSlider');
const balanceValue = document.getElementById('balanceValue');
balanceSlider.addEventListener('input', (e) => {
  lightDarkThreshold = parseFloat(e.target.value);
  // Update display text
  if (lightDarkThreshold < -0.3) {
    balanceValue.textContent = 'More Dark';
  } else if (lightDarkThreshold > 0.3) {
    balanceValue.textContent = 'More Light';
  } else {
    balanceValue.textContent = 'Balanced';
  }
});

document.getElementById('applyBalance').addEventListener('click', () => {
  buildSculpture();
});

// Download buttons
document.getElementById('downloadLight').addEventListener('click', () => {
  if (!lightMergedBrush) return;
  
  const exporter = new STLExporter();
  const stl = exporter.parse(lightMergedBrush, { binary: true });
  const blob = new Blob([stl], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sculpture_light.stl';
  link.click();
  URL.revokeObjectURL(url);
});

document.getElementById('downloadDark').addEventListener('click', () => {
  if (!darkMergedBrush) return;
  
  const exporter = new STLExporter();
  const stl = exporter.parse(darkMergedBrush, { binary: true });
  const blob = new Blob([stl], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sculpture_dark.stl';
  link.click();
  URL.revokeObjectURL(url);
});

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// Build initial sculpture
buildSculpture();

// Start animation
animate();

