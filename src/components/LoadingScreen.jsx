import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PALETTE_COLORS } from '../config/constants.js';

export default function LoadingScreen({ progress, label, visible, error = null, onRetry }) {
  const previewRef = useRef(null);
  const loaderRef  = useRef(null);
  const animIdRef  = useRef(null);

  useEffect(() => {
    const container = previewRef.current;
    if (!container) return;

    const w = 140, h = 140;
    const lScene  = new THREE.Scene();
    const lCamera = new THREE.PerspectiveCamera(38, w / h, 0.1, 10);
    lCamera.position.set(0, 0.30, 0.58);
    lCamera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    loaderRef.current = renderer;

    lScene.add(new THREE.HemisphereLight(0xffffff, 0xdbeafe, 2.4));
    const dir = new THREE.DirectionalLight(0xfff7ed, 2.2);
    dir.position.set(2, 4, 3);
    lScene.add(dir);

    const pivot = new THREE.Group();
    lScene.add(pivot);

    // Instant procedural 3D palette — zero network delay
    const paletteShape = new THREE.Shape();
    paletteShape.absarc(0, 0, 0.16, 0, Math.PI * 2, false);
    const thumbhole = new THREE.Path();
    thumbhole.absarc(0.09, 0, 0.035, 0, Math.PI * 2, true);
    paletteShape.holes.push(thumbhole);

    const extrudeSettings = { depth: 0.012, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.005, bevelThickness: 0.005 };
    const paletteGeom = new THREE.ExtrudeGeometry(paletteShape, extrudeSettings);
    paletteGeom.center();
    const paletteMat = new THREE.MeshStandardMaterial({ color: 0xc48c58, roughness: 0.45, metalness: 0.05 });
    const paletteMesh = new THREE.Mesh(paletteGeom, paletteMat);
    pivot.add(paletteMesh);

    // Glowing oil paint droplets
    PALETTE_COLORS.forEach((col, i) => {
      const angle = (i / PALETTE_COLORS.length) * Math.PI * 1.5 + 0.6;
      const r = 0.11;
      const blobGeom = new THREE.SphereGeometry(0.016, 16, 16);
      blobGeom.scale(1, 0.5, 1);
      const blobMat = new THREE.MeshStandardMaterial({
        color: col.hex,
        roughness: 0.15,
        metalness: 0.12,
        emissive: new THREE.Color(col.hex),
        emissiveIntensity: 0.15,
      });
      const blob = new THREE.Mesh(blobGeom, blobMat);
      blob.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0.010);
      pivot.add(blob);
    });

    const t0 = performance.now();
    const loop = () => {
      animIdRef.current = requestAnimationFrame(loop);
      const t = (performance.now() - t0) * 0.001;
      pivot.rotation.y = t * 1.8;
      pivot.rotation.x = 0.42 + Math.sin(t * 2.2) * 0.12;
      pivot.position.y = Math.sin(t * 3.2) * 0.018;
      renderer.render(lScene, lCamera);
    };
    loop();

    return () => {
      cancelAnimationFrame(animIdRef.current);
      renderer.dispose();
      renderer.domElement?.remove();
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[999] bg-slate-50 flex items-center justify-center transition-opacity duration-500">
      <div className="flex flex-col items-center text-center max-w-xs px-4">
        {/* 3D palette preview */}
        <div ref={previewRef} className="w-[140px] h-[140px] mb-3 flex items-center justify-center" />

        <h2 className="text-xl font-extrabold text-[#1a2e1a] mb-1.5" style={{ fontFamily: 'var(--font-sans)' }}>
          Art Studio Login
        </h2>
        <p className="text-sm text-[#5c7a5c] mb-4" style={{ fontFamily: 'var(--font-sans)' }}>
          {label}
        </p>

        {/* Progress bar or Retry section */}
        {error ? (
          <div className="w-full flex flex-col items-center">
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl mb-3">
              {error}
            </p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="px-5 py-2.5 rounded-full bg-[#4a7c59] hover:bg-[#3d6b4a] text-white text-xs font-bold shadow-md transition-all cursor-pointer select-none active:scale-95"
              >
                Retry Loading
              </button>
            )}
          </div>
        ) : (
          <div className="w-full h-2.5 rounded-full bg-slate-200/70 overflow-hidden">
            <div
              className="progress-bar-fill h-full rounded-full transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
