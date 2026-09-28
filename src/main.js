import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { animate as animeTween } from 'animejs';
import confetti from 'canvas-confetti';

import { PALETTE_COLORS, CAMERA_CONFIG, LIGHTING_CONFIG } from './config/constants.js';
import { AnimationEngine } from './engines/animationEngine.js';
import { PaintingEngine } from './engines/paintingEngine.js';
import { NatureAnimationEngine } from './engines/natureAnimationEngine.js';
import { PaletteAnimationEngine } from './engines/paletteAnimationEngine.js';
import { createPaintbrush } from './models/brushFactory.js';

// 1. Scene & Environment Setup
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd8eaf9);
scene.fog = new THREE.Fog(0xd8eaf9, 12, 36);

const getContainerSize = () => {
  const rect = container.getBoundingClientRect();
  const width = Math.max(container.clientWidth || rect.width || window.innerWidth, 280);
  const height = Math.max(container.clientHeight || rect.height || 300, 240);
  return { width, height };
};

const initSize = getContainerSize();

// 2. Camera Setup (Generous Zoomed-out Framing)
const camera = new THREE.PerspectiveCamera(
  CAMERA_CONFIG.fov,
  initSize.width / initSize.height,
  CAMERA_CONFIG.near,
  CAMERA_CONFIG.far
);
camera.position.set(
  CAMERA_CONFIG.defaultPosition.x,
  CAMERA_CONFIG.defaultPosition.y,
  CAMERA_CONFIG.defaultPosition.z
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true
});
renderer.setSize(initSize.width, initSize.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2 + 0.01;
controls.minDistance = CAMERA_CONFIG.minDistance;
controls.maxDistance = CAMERA_CONFIG.maxDistance;
controls.target.set(
  CAMERA_CONFIG.defaultTarget.x,
  CAMERA_CONFIG.defaultTarget.y,
  CAMERA_CONFIG.defaultTarget.z
);
controls.update();

// Lighting
const hemiLight = new THREE.HemisphereLight(
  LIGHTING_CONFIG.ambient.color,
  0x6e8e50,
  LIGHTING_CONFIG.ambient.intensity
);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(
  LIGHTING_CONFIG.sun.color,
  LIGHTING_CONFIG.sun.intensity
);
sunLight.position.set(
  LIGHTING_CONFIG.sun.position.x,
  LIGHTING_CONFIG.sun.position.y,
  LIGHTING_CONFIG.sun.position.z
);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 30;
sunLight.shadow.camera.left = -6;
sunLight.shadow.camera.right = 6;
sunLight.shadow.camera.top = 6;
sunLight.shadow.camera.bottom = -2;
sunLight.shadow.bias = -0.0004;
scene.add(sunLight);

const bounceLight = new THREE.DirectionalLight(
  LIGHTING_CONFIG.bounce.color,
  LIGHTING_CONFIG.bounce.intensity
);
bounceLight.position.set(
  LIGHTING_CONFIG.bounce.position.x,
  LIGHTING_CONFIG.bounce.position.y,
  LIGHTING_CONFIG.bounce.position.z
);
scene.add(bounceLight);

// Ground plane
const groundGeo = new THREE.PlaneGeometry(80, 80);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x769b56,
  roughness: 0.9,
  metalness: 0.05
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const shadowMat = new THREE.ShadowMaterial({ opacity: 0.22 });
const shadowPlane = new THREE.Mesh(groundGeo, shadowMat);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.position.y = 0.001;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);

// Global Model & Engine References
let modelRoot = null;
let animationEngine = null;
let paintingEngine = null;
let natureAnimationEngine = null;
let paletteAnimationEngine = null;
let paintbrush = null;
let paletteModel = null;
let palettePivot = null;
let canvasMesh = null;
let easelGroup = null;
let natureGroup = null;
const paletteColorMeshes = [];
const artistMeshes = [];
const timer = new THREE.Timer();

const paletteHoverState = {
  elevation: 0,
  tiltX: 0,
  tiltY: 0,
  tiltZ: 0,
  scaleMult: 1.0,
  isHovered: false
};

function onPaletteHoverEnter() {
  if (paletteHoverState.isHovered) return;
  paletteHoverState.isHovered = true;
  if (animationEngine) animationEngine.hoverPalette();
  animeTween(paletteHoverState, {
    elevation: 0.05,
    tiltX: 0.22,
    tiltY: 0.15,
    tiltZ: 0.05,
    scaleMult: 1.12,
    duration: 350,
    ease: 'outBack'
  });
}

function onPaletteHoverLeave() {
  if (!paletteHoverState.isHovered) return;
  paletteHoverState.isHovered = false;
  if (animationEngine) animationEngine.clearPaletteHover();
  if (paletteAnimationEngine) paletteAnimationEngine.clearAllHighlights();
  animeTween(paletteHoverState, {
    elevation: 0,
    tiltX: 0,
    tiltY: 0,
    tiltZ: 0,
    scaleMult: 1.0,
    duration: 400,
    ease: 'outQuad'
  });
}

const loader = new GLTFLoader();
const loadingProgress = document.getElementById('loading-progress');
const loadingScreen = document.getElementById('loading-screen');
const loadingSubtitle = document.querySelector('.loader-subtitle');

function updateProgress(percent, label) {
  if (loadingProgress) loadingProgress.style.width = percent + '%';
  if (loadingSubtitle && label) loadingSubtitle.textContent = label;
}

// Dedicated 3D Floating Palette Animation during Loading Screen
let loaderRenderer = null;
let loaderAnimationId = null;

function initLoaderPaletteAnimation() {
  const loaderContainer = document.getElementById('loader-palette-container');
  if (!loaderContainer) return;

  const w = 140;
  const h = 140;
  const loaderScene = new THREE.Scene();
  const loaderCamera = new THREE.PerspectiveCamera(38, w / h, 0.1, 10);
  loaderCamera.position.set(0, 0.30, 0.58);
  loaderCamera.lookAt(0, 0, 0);

  loaderRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  loaderRenderer.setSize(w, h);
  loaderRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  loaderContainer.appendChild(loaderRenderer.domElement);

  // Soft warm studio lighting for loader preview
  const lHemi = new THREE.HemisphereLight(0xffffff, 0xdbeafe, 2.4);
  loaderScene.add(lHemi);

  const lDir = new THREE.DirectionalLight(0xfff7ed, 2.2);
  lDir.position.set(2, 4, 3);
  loaderScene.add(lDir);

  const miniPivot = new THREE.Group();
  loaderScene.add(miniPivot);

  // Load palette.glb for the loading screen animation
  loader.load('./palette.glb', (gltf) => {
    const pModel = gltf.scene;
    const pScale = 0.024;
    pModel.scale.setScalar(pScale);

    // Center geometry at pivot
    const box = new THREE.Box3().setFromObject(pModel);
    const center = new THREE.Vector3();
    box.getCenter(center);
    pModel.position.sub(center);

    pModel.traverse((node) => {
      if (node.isMesh) {
        if (node.name.toLowerCase().includes('base') || node.name.toLowerCase().includes('circle')) {
          node.material = new THREE.MeshStandardMaterial({
            color: 0xc48c58, // Warm wood
            roughness: 0.4,
            metalness: 0.05
          });
        }
        PALETTE_COLORS.forEach((col) => {
          if (node.name.toLowerCase().includes(col.name.toLowerCase())) {
            node.material = new THREE.MeshStandardMaterial({
              color: col.hex,
              roughness: 0.15,
              metalness: 0.12
            });
          }
        });
      }
    });

    miniPivot.add(pModel);
  });

  const startTime = performance.now();
  function animateLoader() {
    loaderAnimationId = requestAnimationFrame(animateLoader);
    const t = (performance.now() - startTime) * 0.001;
    miniPivot.rotation.y = t * 1.8;
    miniPivot.rotation.x = 0.42 + Math.sin(t * 2.2) * 0.12;
    miniPivot.position.y = Math.sin(t * 3.2) * 0.018;
    loaderRenderer.render(loaderScene, loaderCamera);
  }
  animateLoader();
}

function cleanupLoaderPaletteAnimation() {
  if (loaderAnimationId) {
    cancelAnimationFrame(loaderAnimationId);
    loaderAnimationId = null;
  }
  if (loaderRenderer) {
    loaderRenderer.dispose();
    loaderRenderer.domElement?.remove();
    loaderRenderer = null;
  }
}

// 3. Load All 3D Assets
async function loadAllAssets() {
  try {

    // 1. Load Nature Background (nature-bg.glb)
    updateProgress(20, 'Loading Nature Scenery...');
    const natureGltf = await loader.loadAsync('./nature-bg.glb');
    natureGroup = natureGltf.scene;

    natureGroup.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) child.material.roughness = 0.8;
      }
    });

    const bgBox = new THREE.Box3().setFromObject(natureGroup);
    natureGroup.position.set(0, -bgBox.min.y, -2.5);
    natureGroup.scale.setScalar(1.0);
    scene.add(natureGroup);

    // Initialize Nature Animation Engine — wind, tree sway, particles
    natureAnimationEngine = new NatureAnimationEngine(natureGroup, scene);

    // 2. Load Artist Character (artist.glb)
    updateProgress(45, 'Loading Artist Model...');
    const charGltf = await loader.loadAsync('./artist.glb');
    modelRoot = charGltf.scene;
    modelRoot.name = 'ArtistModel';

    const bbox = new THREE.Box3().setFromObject(modelRoot);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const scaleFactor = 2.0 / (size.y || 1);
    modelRoot.scale.setScalar(scaleFactor);

    const scaledBox = new THREE.Box3().setFromObject(modelRoot);
    modelRoot.position.x = -((scaledBox.max.x + scaledBox.min.x) / 2);
    modelRoot.position.z = -((scaledBox.max.z + scaledBox.min.z) / 2);
    modelRoot.position.y = -scaledBox.min.y;

    modelRoot.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material) {
          node.material.roughness = 0.45;
          node.material.metalness = 0.05;
        }
        artistMeshes.push(node);
      }
    });

    scene.add(modelRoot);
    modelRoot.updateMatrixWorld(true);

    // Responsive collision proxy for instant artist hover detection across entire figure
    const charBounds = new THREE.Box3().setFromObject(modelRoot);
    const charCenter = new THREE.Vector3();
    charBounds.getCenter(charCenter);
    const charDims = new THREE.Vector3();
    charBounds.getSize(charDims);

    const hitRadius = Math.max(charDims.x, charDims.z) * 0.75 + 0.22;
    const hitHeight = Math.max(charDims.y, 2.1);
    const artistHitProxy = new THREE.Mesh(
      new THREE.CylinderGeometry(hitRadius, hitRadius * 1.08, hitHeight, 16),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false
      })
    );
    artistHitProxy.position.set(charCenter.x, charCenter.y, charCenter.z);
    artistHitProxy.name = 'ArtistHitProxy';
    scene.add(artistHitProxy);
    artistMeshes.push(artistHitProxy);

    // Initialize Anime.js Animation Engine for artist (artist.glb)
    animationEngine = new AnimationEngine(modelRoot, charGltf.animations);

    // 3. Load Painter's Palette (palette.glb)
    updateProgress(65, 'Equipping Color Palette in Left Hand...');
    const paletteGltf = await loader.loadAsync('./palette.glb');
    paletteModel = paletteGltf.scene;
    paletteModel.name = 'PaletteModel';

    // Realistic handheld artist palette size (~33cm x 26cm)
    const PALETTE_SCALE = 0.022;
    paletteModel.scale.setScalar(PALETTE_SCALE);
    // Center thumbhole (local center at x: 5.42, y: 0.14, z: -0.54) directly at pivot origin (0, 0, 0)
    paletteModel.position.set(-5.42 * PALETTE_SCALE, -0.14 * PALETTE_SCALE, 0.54 * PALETTE_SCALE);

    palettePivot = new THREE.Group();
    palettePivot.name = 'PalettePivot';
    palettePivot.add(paletteModel);

    // Responsive collision proxy for instant palette hover detection
    const paletteHitProxy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.14, 16),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false
      })
    );
    paletteHitProxy.position.set(0.08, 0, 0.02);
    paletteHitProxy.name = 'PaletteHitProxy';
    palettePivot.add(paletteHitProxy);

    scene.add(palettePivot);

    // Colorize each paint mound with glossy wet oil paint
    paletteModel.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;

        if (node.name.toLowerCase().includes('base') || node.name.toLowerCase().includes('circle')) {
          node.material = new THREE.MeshStandardMaterial({
            color: 0xc48c58, // Polished fine wood
            roughness: 0.45,
            metalness: 0.05
          });
        }

        PALETTE_COLORS.forEach((col, idx) => {
          if (node.name.toLowerCase().includes(col.name.toLowerCase())) {
            node.material = new THREE.MeshStandardMaterial({
              color: col.hex,
              roughness: 0.18, // Glossy wet oil paint
              metalness: 0.12,
              emissive: new THREE.Color(0x000000),
              emissiveIntensity: 0
            });
            node.userData = { colorHex: col.hex, colorIndex: idx, label: col.label };
            paletteColorMeshes.push(node);
          }
        });
      }
    });

    // Initialize Palette Animation Engine — shimmer, glow, dip feedback
    paletteAnimationEngine = new PaletteAnimationEngine(paletteModel, paletteColorMeshes, palettePivot);

    console.log('Palette (palette.glb) successfully configured with animation engine!');

    // 4. Create Paintbrush
    updateProgress(75, 'Equipping Paintbrush in Right Hand...');
    paintbrush = createPaintbrush();
    paintbrush.scale.setScalar(1.2);
    scene.add(paintbrush);
    console.log('Paintbrush added to scene (synced to Right Hand)!');

    // 5. Load Easel & Canvas
    updateProgress(90, 'Placing Studio Easel & Canvas...');
    const easelGltf = await loader.loadAsync('./easel_canvas.glb');
    easelGroup = easelGltf.scene;
    easelGroup.position.set(-0.10, 0, 0.68);
    easelGroup.rotation.y = -Math.PI / 2;

    easelGroup.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.name.toLowerCase().includes('canvas')) {
          canvasMesh = node;
        }
      }
    });
    scene.add(easelGroup);

    // Initialize Dynamic Painting Engine on canvas
    if (canvasMesh) {
      paintingEngine = new PaintingEngine(canvasMesh);
      animationEngine.onBrushStroke = (normX, normY) => {
        if (paintingEngine) {
          paintingEngine.paintAt(normX, normY);
        }
      };
    }

    // Connect color pick callback — updates artist.glb brush and palette.glb visual feedback
    animationEngine.onColorPicked = (colorHex, colorIndex) => {
      if (paintbrush) paintbrush.setTipColor(colorHex);
      if (paintingEngine) {
        paintingEngine.setColor(colorIndex);
        paintingEngine.setColorHex(colorHex);
      }
      // Trigger palette dip visual feedback
      if (paletteAnimationEngine) {
        paletteAnimationEngine.dipFeedback(colorIndex);
        paletteAnimationEngine.highlightColor(colorIndex);
      }
    };

    updateProgress(100, 'Nature Studio Ready!');

    // Smooth character entrance with Anime.js
    animeTween(modelRoot.position, {
      y: [modelRoot.position.y - 0.4, modelRoot.position.y],
      ease: 'outElastic(1, .6)',
      duration: 900
    });

    setTimeout(() => {
      loadingScreen.classList.add('fade-out');
      cleanupLoaderPaletteAnimation();
      setTimeout(() => loadingScreen.remove(), 600);
    }, 400);

    setupUI();
    setupRaycasterHover();
  } catch (error) {
    console.error('Asset load error:', error);
    if (loadingScreen) {
      loadingScreen.innerHTML = `<div style="color:#ef4444;padding:20px;">Failed to load assets: ${error.message}</div>`;
    }
  }
}

// 4. Interactive Raycaster (Hover artist.glb character, palette.glb, canvas)
function setupRaycasterHover() {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  let activeHover = null; // 'palette' | 'canvas' | 'artist' | null
  const hudElement = document.getElementById('artist-interactive-hud');
  const hudText = document.getElementById('hud-status-text');

  const updateHud = (text, active = false) => {
    if (hudText) hudText.textContent = text;
    if (hudElement) {
      if (active) hudElement.classList.add('active');
      else hudElement.classList.remove('active');
    }
  };

  container.addEventListener('pointermove', (event) => {
    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Send normalized coordinates to animation engine for subtle responsive gaze tracking
    if (animationEngine) {
      animationEngine.setMousePointer(mouse.x, mouse.y);
    }

    raycaster.setFromCamera(mouse, camera);

    // 1. Check Palette Colors (palette.glb)
    let isPaletteHit = false;
    if (paletteColorMeshes.length > 0) {
      const paletteHits = raycaster.intersectObjects(paletteColorMeshes, false);
      if (paletteHits.length > 0) {
        isPaletteHit = true;
        const uData = paletteHits[0].object.userData;
        if (uData && uData.colorHex) {
          if (paintbrush) paintbrush.setTipColor(uData.colorHex);
          if (paintingEngine) {
            paintingEngine.setColor(uData.colorIndex);
            paintingEngine.setColorHex(uData.colorHex);
          }
          if (animationEngine) animationEngine.hoverPaletteColor(uData.colorHex, uData.colorIndex);
          // Highlight this color on palette.glb
          if (paletteAnimationEngine) paletteAnimationEngine.highlightColor(uData.colorIndex);

          updateHud(`🎨 Palette: Dipping ${uData.label || 'Color'}`, true);
        }
      }
    }

    // 2. Check Palette Body / Pivot
    if (!isPaletteHit && palettePivot) {
      const paletteBodyHits = raycaster.intersectObject(palettePivot, true);
      if (paletteBodyHits.length > 0) {
        isPaletteHit = true;
        updateHud('🎨 Color Palette: Click or hover a paint well', true);
      }
    }

    if (isPaletteHit) {
      container.style.cursor = 'pointer';
      if (activeHover !== 'palette') {
        if (activeHover === 'artist' && animationEngine) animationEngine.clearArtistHover();
        if (activeHover === 'canvas' && animationEngine) animationEngine.clearHover();
        activeHover = 'palette';
      }
      onPaletteHoverEnter();
      return;
    }

    // 3. Check Canvas Painting
    if (canvasMesh) {
      const canvasHits = raycaster.intersectObject(canvasMesh, false);
      if (canvasHits.length > 0) {
        const hit = canvasHits[0];
        if (hit.uv) {
          container.style.cursor = 'crosshair';
          if (activeHover === 'palette') onPaletteHoverLeave();
          if (activeHover === 'artist' && animationEngine) animationEngine.clearArtistHover();
          activeHover = 'canvas';
          if (animationEngine) animationEngine.hoverCanvas(hit.uv.x, hit.uv.y);
          updateHud('🖌️ Studio Canvas: Live interactive brushwork', true);
          return;
        }
      }
    }

    // 4. Check Artist Character (artist.glb)
    if (artistMeshes.length > 0) {
      const artistHits = raycaster.intersectObjects(artistMeshes, true);
      if (artistHits.length > 0) {
        container.style.cursor = 'pointer';
        if (activeHover === 'palette') onPaletteHoverLeave();
        if (activeHover === 'canvas' && animationEngine) animationEngine.clearHover();
        activeHover = 'artist';
        if (animationEngine) animationEngine.hoverArtist();
        updateHud('✨ Artist in Action: Dipping paint & creating brushwork...', true);
        return;
      }
    }

    // 5. Default / Unhovered
    container.style.cursor = 'default';
    if (activeHover === 'palette') onPaletteHoverLeave();
    if (activeHover === 'artist' && animationEngine) animationEngine.clearArtistHover();
    if (activeHover === 'canvas' && animationEngine) animationEngine.clearHover();
    activeHover = null;
    updateHud('Hover over Artist or Palette to interact', false);
  });

  container.addEventListener('pointerleave', () => {
    container.style.cursor = 'default';
    if (activeHover === 'palette') onPaletteHoverLeave();
    if (activeHover === 'artist' && animationEngine) animationEngine.clearArtistHover();
    if (activeHover === 'canvas' && animationEngine) animationEngine.clearHover();
    activeHover = null;
    updateHud('Hover over Artist or Palette to interact', false);
  });
}

// 5. Clean Login Form Setup
function setupUI() {
  // Password Visibility Toggle
  const togglePwBtn = document.getElementById('toggle-password');
  const passwordInput = document.getElementById('password');
  if (togglePwBtn && passwordInput) {
    togglePwBtn.addEventListener('click', () => {
      const isPw = passwordInput.type === 'password';
      passwordInput.type = isPw ? 'text' : 'password';
      togglePwBtn.style.color = isPw ? '#4a7c59' : '#8aa38a';
    });
  }

  // Form Submission Animation
  const form = document.getElementById('login-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      confetti({
        particleCount: 70,
        spread: 80,
        origin: { x: 0.25, y: 0.6 }
      });
    });
  }

  // Responsive Multi-Device Resize & Orientation Handler
  const updateCameraForViewport = () => {
    const size = getContainerSize();
    const aspect = size.width / size.height;
    camera.aspect = aspect;

    // Dynamic FOV & target adaptation across device form factors
    if (aspect < 0.8) {
      // Mobile portrait / tall screens
      camera.fov = 52;
      controls.target.set(-0.15, 1.05, 0.42);
    } else if (aspect < 1.15) {
      // Tablet portrait / square viewports
      camera.fov = 46;
      controls.target.set(-0.15, 1.10, 0.42);
    } else if (aspect > 2.2) {
      // Ultrawide monitors
      camera.fov = 38;
      controls.target.set(-0.15, 1.15, 0.42);
    } else {
      // Standard laptop & desktop
      camera.fov = 42;
      controls.target.set(-0.15, 1.15, 0.42);
    }

    camera.updateProjectionMatrix();
    controls.update();
    renderer.setSize(size.width, size.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  };

  window.addEventListener('resize', updateCameraForViewport);
  window.addEventListener('orientationchange', () => {
    setTimeout(updateCameraForViewport, 150);
  });
}

// 6. Main Render Loop — All engines update here
function renderLoop() {
  requestAnimationFrame(renderLoop);

  timer.update();
  const delta = timer.getDelta();

  // Update Artist Animation Engine (artist.glb skeletal animation)
  if (animationEngine) {
    animationEngine.update(delta);

    // Synchronize Palette (palette.glb) directly in Left Hand
    if (palettePivot && animationEngine.bones.leftHand) {
      const lHand = animationEngine.bones.leftHand;
      lHand.updateWorldMatrix(true, false);
      const lHandPos = new THREE.Vector3();
      lHand.getWorldPosition(lHandPos);

      palettePivot.position.set(
        lHandPos.x + 0.02,
        lHandPos.y - 0.015 + paletteHoverState.elevation,
        lHandPos.z + 0.02
      );
      palettePivot.rotation.set(
        0.12 + paletteHoverState.tiltX,
        0.42 + paletteHoverState.tiltY,
        -0.06 + paletteHoverState.tiltZ
      );
      palettePivot.scale.setScalar(paletteHoverState.scaleMult);
    }

    // Synchronize Paintbrush firmly in Right Hand
    if (paintbrush && animationEngine.bones.rightHand) {
      const rHand = animationEngine.bones.rightHand;
      rHand.updateWorldMatrix(true, false);
      const rHandPos = new THREE.Vector3();
      const rHandQuat = new THREE.Quaternion();
      rHand.getWorldPosition(rHandPos);
      rHand.getWorldQuaternion(rHandQuat);

      const localGrip = new THREE.Vector3(0.022, 0.038, 0.008);
      paintbrush.position.copy(rHandPos).add(localGrip.applyQuaternion(rHandQuat));

      const brushLocalRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + 0.15, 0, 0.20));
      paintbrush.quaternion.copy(rHandQuat).multiply(brushLocalRot);
    }
  }

  // Update Nature Animation Engine (nature-bg.glb wind/sway/particles)
  if (natureAnimationEngine) {
    natureAnimationEngine.update(delta);
  }

  // Update Palette Animation Engine (palette.glb shimmer/glow)
  if (paletteAnimationEngine) {
    paletteAnimationEngine.update(delta);
  }

  controls.update();
  renderer.render(scene, camera);
}

// Start Application
initLoaderPaletteAnimation();
loadAllAssets();
renderLoop();
