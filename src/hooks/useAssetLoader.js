import { useState, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { animate as animeTween } from 'animejs';

import { PALETTE_COLORS } from '../config/constants.js';
import { scatterNatureObjects } from '../lib/three/scatterObjects.js';
import { AnimationEngine }        from '../engines/animationEngine.js';
import { PaintingEngine }         from '../engines/paintingEngine.js';
import { NatureAnimationEngine }  from '../engines/natureAnimationEngine.js';
import { PaletteAnimationEngine } from '../engines/paletteAnimationEngine.js';
import { createPaintbrush }       from '../lib/models/brushFactory.js';

const loader = new GLTFLoader();

// Approximate file sizes to provide accurate live byte-progress on slow connections
const ASSET_SIZES = {
  './nature-bg.glb':    224 * 1024,
  './artist.glb':       2250 * 1024,
  './palette.glb':      120 * 1024,
  './easel_canvas.glb': 1950 * 1024,
};
const TOTAL_ESTIMATED_BYTES = Object.values(ASSET_SIZES).reduce((a, b) => a + b, 0);

/**
 * Resilient GLB loader with per-asset timeout and automatic retry
 */
function loadGlbWithRetry(gltfLoader, url, onBytesProgress, maxRetries = 2, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    const doLoad = () => {
      let isSettled = false;
      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          console.warn(`[AssetLoader] Slow network timeout for ${url} (attempt ${attempt + 1}/${maxRetries + 1})`);
          if (attempt < maxRetries) {
            attempt++;
            setTimeout(doLoad, 800 * attempt);
          } else {
            reject(new Error(`Timeout downloading ${url}`));
          }
        }
      }, timeoutMs);

      gltfLoader.load(
        url,
        (gltf) => {
          if (isSettled) return;
          isSettled = true;
          clearTimeout(timer);
          if (onBytesProgress) onBytesProgress(url, ASSET_SIZES[url] || 1024 * 1024);
          resolve(gltf);
        },
        (xhr) => {
          if (isSettled) return;
          const loaded = xhr.loaded || 0;
          if (onBytesProgress) onBytesProgress(url, loaded);
        },
        (err) => {
          if (isSettled) return;
          isSettled = true;
          clearTimeout(timer);
          console.warn(`[AssetLoader] Load error for ${url} (attempt ${attempt + 1}/${maxRetries + 1}):`, err);
          if (attempt < maxRetries) {
            attempt++;
            setTimeout(doLoad, 800 * attempt);
          } else {
            reject(err);
          }
        }
      );
    };

    doLoad();
  });
}

/**
 * useAssetLoader
 *
 * All engine/object references are stable useRef objects so they survive
 * React re-renders without losing their values.
 */
export function useAssetLoader() {
  const [loadProgress, setLoadProgress] = useState(10);
  const [loadLabel,    setLoadLabel]    = useState('Initializing 3D Studio...');
  const [loadError,    setLoadError]    = useState(null);
  const [isLoaded,     setIsLoaded]     = useState(false);

  // ── Stable refs — never recreated across renders ──────────────────────────
  const modelRootRef              = useRef(null);
  const animationEngineRef        = useRef(null);
  const paintingEngineRef         = useRef(null);
  const natureAnimationEngineRef  = useRef(null);
  const paletteAnimationEngineRef = useRef(null);
  const paintbrushRef             = useRef(null);
  const paletteModelRef           = useRef(null);
  const palettePivotRef           = useRef(null);
  const canvasMeshRef             = useRef(null);
  const easelGroupRef             = useRef(null);
  const paletteColorMeshesRef     = useRef([]);
  const artistMeshesRef           = useRef([]);

  // Single stable object that downstream hooks can destructure once
  const refs = useRef({
    modelRoot:              modelRootRef,
    animationEngine:        animationEngineRef,
    paintingEngine:         paintingEngineRef,
    natureAnimationEngine:  natureAnimationEngineRef,
    paletteAnimationEngine: paletteAnimationEngineRef,
    paintbrush:             paintbrushRef,
    paletteModel:           paletteModelRef,
    palettePivot:           palettePivotRef,
    canvasMesh:             canvasMeshRef,
    easelGroup:             easelGroupRef,
    paletteColorMeshes:     paletteColorMeshesRef,
    artistMeshes:           artistMeshesRef,
  }).current; // .current so the object identity is stable

  const progress = useCallback((pct, label) => {
    setLoadProgress(pct);
    setLoadLabel(label);
  }, []);

  const loadAssets = useCallback(async (scene) => {
    try {
      setLoadError(null);
      progress(15, 'Downloading 3D Studio Assets...');

      const bytesMap = {
        './nature-bg.glb':    0,
        './artist.glb':       0,
        './palette.glb':      0,
        './easel_canvas.glb': 0,
      };

      const handleBytes = (url, loaded) => {
        bytesMap[url] = Math.min(loaded, ASSET_SIZES[url] || loaded);
        const sumLoaded = Object.values(bytesMap).reduce((a, b) => a + b, 0);
        const ratio = Math.min(1, sumLoaded / TOTAL_ESTIMATED_BYTES);
        const pct = Math.min(85, Math.round(15 + ratio * 70));
        const loadedMb = (sumLoaded / (1024 * 1024)).toFixed(1);
        const totalMb = (TOTAL_ESTIMATED_BYTES / (1024 * 1024)).toFixed(1);
        progress(pct, `Loading 3D Studio (${loadedMb} / ${totalMb} MB)...`);
      };

      // ── Parallel Asset Fetching with resilience for slow networks ───────
      const [natureGltf, charGltf, paletteGltf, easelGltf] = await Promise.all([
        loadGlbWithRetry(loader, './nature-bg.glb',    handleBytes),
        loadGlbWithRetry(loader, './artist.glb',       handleBytes),
        loadGlbWithRetry(loader, './palette.glb',      handleBytes),
        loadGlbWithRetry(loader, './easel_canvas.glb', handleBytes),
      ]);

      // ── 1. Nature background ───────────────────────────────────────────────
      progress(45, 'Configuring Nature Scenery...');
      const natureGroup = natureGltf.scene;

      natureGroup.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) child.material.roughness = 0.8;
        }
      });

      const bgBox = new THREE.Box3().setFromObject(natureGroup);
      natureGroup.position.set(0, -bgBox.min.y, -2.5);
      scene.add(natureGroup);

      natureGroup.traverse((node) => {
        const n = node.name.toLowerCase();
        if (n.includes('bridge') || n.includes('bridege')) node.visible = false;
      });

      scatterNatureObjects(scene, natureGltf);
      natureAnimationEngineRef.current = new NatureAnimationEngine(natureGroup, scene);

      // ── 2. Artist character ────────────────────────────────────────────────
      progress(65, 'Configuring Artist Model...');
      const modelRoot = charGltf.scene;
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
          artistMeshesRef.current.push(node);
        }
      });

      scene.add(modelRoot);
      modelRoot.updateMatrixWorld(true);
      modelRootRef.current = modelRoot;

      // Invisible hit-proxy cylinder for raycasting
      const charBounds = new THREE.Box3().setFromObject(modelRoot);
      const charCenter = new THREE.Vector3();
      charBounds.getCenter(charCenter);
      const charDims = new THREE.Vector3();
      charBounds.getSize(charDims);
      const hitR  = Math.max(charDims.x, charDims.z) * 0.75 + 0.22;
      const proxy = new THREE.Mesh(
        new THREE.CylinderGeometry(hitR, hitR * 1.08, Math.max(charDims.y, 2.1), 16),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      proxy.position.copy(charCenter);
      proxy.name = 'ArtistHitProxy';
      scene.add(proxy);
      artistMeshesRef.current.push(proxy);

      animationEngineRef.current = new AnimationEngine(modelRoot, charGltf.animations);

      // ── 3. Palette ─────────────────────────────────────────────────────────
      progress(80, 'Equipping Color Palette...');
      const paletteModel = paletteGltf.scene;
      const PALETTE_SCALE = 0.022;
      paletteModel.scale.setScalar(PALETTE_SCALE);
      paletteModel.position.set(
        -5.42 * PALETTE_SCALE,
        -0.14 * PALETTE_SCALE,
         0.54 * PALETTE_SCALE
      );

      const palettePivot = new THREE.Group();
      palettePivot.name = 'PalettePivot';
      palettePivot.add(paletteModel);

      const pHitProxy = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 0.14, 16),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      pHitProxy.position.set(0.08, 0, 0.02);
      pHitProxy.name = 'PaletteHitProxy';
      palettePivot.add(pHitProxy);
      scene.add(palettePivot);

      paletteModel.traverse((node) => {
        if (!node.isMesh) return;
        node.castShadow = true;
        node.receiveShadow = true;
        const n = node.name.toLowerCase();
        if (n.includes('base') || n.includes('circle')) {
          node.material = new THREE.MeshStandardMaterial({
            color: 0xc48c58, roughness: 0.45, metalness: 0.05,
          });
        }
        PALETTE_COLORS.forEach((col, idx) => {
          if (n.includes(col.name.toLowerCase())) {
            node.material = new THREE.MeshStandardMaterial({
              color: col.hex, roughness: 0.18, metalness: 0.12,
              emissive: new THREE.Color(0x000000), emissiveIntensity: 0,
            });
            node.userData = { colorHex: col.hex, colorIndex: idx, label: col.label };
            paletteColorMeshesRef.current.push(node);
          }
        });
      });

      paletteModelRef.current  = paletteModel;
      palettePivotRef.current  = palettePivot;
      paletteAnimationEngineRef.current = new PaletteAnimationEngine(
        paletteModel, paletteColorMeshesRef.current, palettePivot
      );

      // ── 4. Paintbrush ──────────────────────────────────────────────────────
      progress(90, 'Equipping Paintbrush...');
      const paintbrush = createPaintbrush();
      paintbrush.scale.setScalar(1.2);
      scene.add(paintbrush);
      paintbrushRef.current = paintbrush;

      // ── 5. Easel & Canvas ──────────────────────────────────────────────────
      progress(95, 'Placing Easel & Canvas...');
      const easelGroup = easelGltf.scene;
      easelGroup.position.set(-0.10, 0, 0.68);
      easelGroup.rotation.y = -Math.PI / 2;

      let canvasMesh = null;
      easelGroup.traverse((node) => {
        if (!node.isMesh) return;
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.name.toLowerCase().includes('canvas')) canvasMesh = node;
      });
      scene.add(easelGroup);
      easelGroupRef.current  = easelGroup;
      canvasMeshRef.current  = canvasMesh;

      if (canvasMesh) {
        const pe = new PaintingEngine(canvasMesh);
        paintingEngineRef.current = pe;
        animationEngineRef.current.onBrushStroke = (nx, ny) => pe.paintAt(nx, ny);
      }

      // Wire colour-pick callback
      animationEngineRef.current.onColorPicked = (hex, idx) => {
        if (paintbrushRef.current)             paintbrushRef.current.setTipColor(hex);
        if (paintingEngineRef.current) {
          paintingEngineRef.current.setColor(idx);
          paintingEngineRef.current.setColorHex(hex);
        }
        if (paletteAnimationEngineRef.current) {
          paletteAnimationEngineRef.current.dipFeedback(idx);
          paletteAnimationEngineRef.current.highlightColor(idx);
        }
      };

      progress(100, 'Nature Studio Ready!');

      // Smooth entrance
      animeTween(modelRoot.position, {
        y: [modelRoot.position.y - 0.4, modelRoot.position.y],
        ease: 'outElastic(1, .6)',
        duration: 900,
      });

      setIsLoaded(true);
    } catch (err) {
      console.error('Asset load error:', err);
      setLoadError('Slow network connection detected: ' + (err.message || 'Asset download timed out'));
      setLoadLabel('Network connection timed out');
    }
  }, []); // no deps — refs are stable, no need to re-create

  return { loadProgress, loadLabel, loadError, isLoaded, loadAssets, refs };
}
