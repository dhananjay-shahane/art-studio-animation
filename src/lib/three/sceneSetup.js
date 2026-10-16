import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CAMERA_CONFIG } from '../../config/constants.js';

/**
 * Create and configure the Three.js renderer.
 * The canvas is absolutely positioned to fill its parent container.
 */
export function createRenderer(container) {
  const width  = Math.max(container.offsetWidth  || window.innerWidth,  280);
  const height = Math.max(container.offsetHeight || 300, 240);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  // Fill the viewport container absolutely
  const el = renderer.domElement;
  el.id = 'scene-canvas';
  el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
  return renderer;
}

/**
 * Create perspective camera with default art-studio framing.
 * Responsive framing ensures character and easel are perfectly centered on all screen sizes.
 */
export function createCamera(width, height) {
  const aspect = width / height;
  const isMobile = aspect < 0.85 || width <= 900;
  const fov = isMobile ? 48 : CAMERA_CONFIG.fov;

  const camera = new THREE.PerspectiveCamera(
    fov,
    aspect,
    CAMERA_CONFIG.near,
    CAMERA_CONFIG.far
  );

  if (isMobile) {
    camera.position.set(2.05, 1.60, 2.85);
  } else {
    camera.position.set(
      CAMERA_CONFIG.defaultPosition.x,
      CAMERA_CONFIG.defaultPosition.y,
      CAMERA_CONFIG.defaultPosition.z
    );
  }
  return camera;
}

/**
 * Create OrbitControls bound to camera + canvas element.
 */
export function createOrbitControls(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 + 0.01;
  controls.minDistance = CAMERA_CONFIG.minDistance;
  controls.maxDistance = CAMERA_CONFIG.maxDistance;

  const isMobile = window.innerWidth <= 900;
  controls.target.set(
    isMobile ? -0.05 : CAMERA_CONFIG.defaultTarget.x,
    CAMERA_CONFIG.defaultTarget.y,
    CAMERA_CONFIG.defaultTarget.z
  );
  controls.update();
  return controls;
}

/**
 * Build the root Three.js scene with sky color + fog.
 */
export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd8eaf9);
  scene.fog = new THREE.Fog(0xd8eaf9, 12, 36);
  return scene;
}

/**
 * Handle container resize — update renderer + camera projection with centered composition.
 */
export function handleResize(container, renderer, camera, controls) {
  const width  = Math.max(container.offsetWidth  || window.innerWidth,  280);
  const height = Math.max(container.offsetHeight || window.innerHeight, 240);
  const aspect = width / height;

  camera.aspect = aspect;
  if (aspect < 0.85) {
    // Mobile portrait: comfortable FOV to frame whole artist + easel + palette centered
    camera.fov = 48;
    controls.target.set(-0.05, 1.10, 0.40);
  } else if (aspect < 1.15) {
    // Tablets / square viewports
    camera.fov = 44;
    controls.target.set(-0.05, 1.12, 0.40);
  } else if (aspect > 2.2) {
    // Ultra-wide
    camera.fov = 38;
    controls.target.set(-0.15, 1.15, 0.42);
  } else {
    // Standard desktop
    camera.fov = 42;
    controls.target.set(-0.15, 1.15, 0.42);
  }
  camera.updateProjectionMatrix();
  controls.update();
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}
