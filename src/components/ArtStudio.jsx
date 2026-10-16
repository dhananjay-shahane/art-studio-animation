import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { animate as animeTween } from 'animejs';

import { useThreeScene }    from '../hooks/useThreeScene.js';
import { useAssetLoader }   from '../hooks/useAssetLoader.js';
import { useModelMovement } from '../hooks/useModelMovement.js';
import { useRaycaster }     from '../hooks/useRaycaster.js';

import AuthPanel     from './AuthPanel.jsx';
import MoveControls  from './MoveControls.jsx';
import LoadingScreen from './LoadingScreen.jsx';

export default function ArtStudio() {
  const containerRef   = useRef(null);
  const loadStartedRef = useRef(false);
  const [screenVisible, setScreenVisible] = useState(true);
  const [authVisible, setAuthVisible]     = useState(false);

  /* ── Three.js core ─────────────────────────────────────────────────── */
  const { sceneRef, cameraRef, rendererRef, controlsRef } = useThreeScene(containerRef);

  /* ── Asset loading ─────────────────────────────────────────────────── */
  const { loadProgress, loadLabel, loadError, isLoaded, loadAssets, refs } = useAssetLoader();

  // Start loading once the Three.js scene is ready
  useEffect(() => {
    if (loadStartedRef.current) return;
    const id = setInterval(() => {
      if (sceneRef.current) {
        clearInterval(id);
        loadStartedRef.current = true;
        loadAssets(sceneRef.current);
      }
    }, 50);
    return () => clearInterval(id);
  }, []); // eslint-disable-line

  // Fade out loading overlay, then show 3D scene full screen for 2s before swiping in auth panel
  useEffect(() => {
    if (isLoaded) {
      const t1 = setTimeout(() => setScreenVisible(false), 400);
      const t2 = setTimeout(() => {
        setAuthVisible(true);
      }, 2400); // Full 2s of 3D scene preview before swipe-up
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [isLoaded]);

  // Smoothly pan camera target to frame character & easel nicely when panel slides in/out
  useEffect(() => {
    if (!controlsRef.current) return;
    const isMobile = window.innerWidth <= 900;
    let targetX, targetY;

    if (isMobile) {
      // On mobile / small screens, keep horizontally centered
      targetX = -0.05;
      // When bottom sheet is open, raise target Y to frame the artist & canvas nicely above the sheet
      targetY = authVisible ? 1.28 : 1.05;
    } else {
      // On desktop, auth panel is on the left, so pan target to the right (0.35)
      targetX = authVisible ? 0.35 : -0.15;
      targetY = 1.15;
    }

    animeTween(controlsRef.current.target, {
      x: targetX,
      y: targetY,
      duration: 850,
      ease: 'outCubic'
    });
  }, [authVisible, controlsRef]);

  /* ── Movement ──────────────────────────────────────────────────────── */
  const { applyMovement, pressKey, releaseKey, resetPosition } =
    useModelMovement(refs.modelRoot, refs.animationEngine);

  /* ── Raycaster / hover ─────────────────────────────────────────────── */
  const { syncPalettePivot, syncPaintbrush } = useRaycaster(containerRef, cameraRef, refs);

  /* ── Render loop ───────────────────────────────────────────────────── */
  useEffect(() => {
    let frameId;
    const timer = new THREE.Timer();

    const tick = () => {
      frameId = requestAnimationFrame(tick);
      timer.update();
      const delta = Math.min(timer.getDelta(), 0.05);

      const ae  = refs.animationEngine.current;
      const nae = refs.natureAnimationEngine.current;
      const pae = refs.paletteAnimationEngine.current;

      if (ae) {
        ae.update(delta);
        syncPalettePivot();
        syncPaintbrush();
      }
      if (nae) nae.update(delta);
      if (pae) pae.update(delta);

      if (cameraRef.current) applyMovement(cameraRef.current);
      if (controlsRef.current) controlsRef.current.update();

      const renderer = rendererRef.current;
      const scene    = sceneRef.current;
      const cam      = cameraRef.current;
      if (renderer && scene && cam) renderer.render(scene, cam);
    };

    tick();
    return () => cancelAnimationFrame(frameId);
  }, []); // eslint-disable-line

  return (
    <>
      {/* Loading overlay */}
      {screenVisible && (
        <LoadingScreen
          progress={loadProgress}
          label={loadLabel}
          error={loadError}
          onRetry={() => {
            if (sceneRef.current) loadAssets(sceneRef.current);
          }}
          visible={screenVisible}
        />
      )}

      {/*
        ── Main App Container ──
        The 3D scene fills 100% of the screen.
        The auth panel smoothly slides in as an overlay from the left (desktop)
        or bottom (mobile) without resizing the WebGL viewport or causing reload stutter!
      */}
      <div className="app-split-container w-full h-screen overflow-hidden relative">
        {/* ── 3D scene viewport (fills entire screen) ── */}
        <main
          ref={containerRef}
          className="scene-viewport absolute inset-0 w-full h-full overflow-hidden bg-[#d8edf9]"
          style={{ touchAction: 'none' }}
        />

        {/* ── Left auth panel (swipes in from left after 2s) ── */}
        <aside
          className={`auth-panel ${authVisible ? 'auth-panel-visible' : 'auth-panel-hidden'}`}
        >
          <AuthPanel onToggle={() => setAuthVisible((v) => !v)} />
        </aside>

        {/* Fullscreen 3D Scene View Toggle Button */}
        {isLoaded && (
          <button
            type="button"
            className={`btn-view-toggle ${authVisible ? 'toggle-panel-open' : 'toggle-panel-closed'}`}
            onClick={() => setAuthVisible((v) => !v)}
            title={authVisible ? 'Full Screen 3D Studio' : 'Show Sign In Form'}
            aria-label="Toggle view mode"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {authVisible ? (
                <>
                  <path d="M15 3h6v6" />
                  <path d="M9 21H3v-6" />
                  <path d="M21 3l-7 7" />
                  <path d="M3 21l7-7" />
                </>
              ) : (
                <>
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M9 3v18" />
                </>
              )}
            </svg>
            <span>{authVisible ? 'Full 3D Scene' : 'Show Sign In'}</span>
          </button>
        )}

        {/* Mobile bottom peek tab to easily pull / tap the sign-in sheet back up */}
        {!authVisible && isLoaded && (
          <button
            type="button"
            className="mobile-bottom-peek-tab"
            onClick={() => setAuthVisible(true)}
            aria-label="Slide up sign in panel"
          >
            <span className="peek-handle-dash" />
            <span className="peek-text">Sign In to Studio ⌃</span>
          </button>
        )}

        {/* Controls — bottom RIGHT corner of the screen */}
        {isLoaded && (
          <MoveControls
            pressKey={pressKey}
            releaseKey={releaseKey}
            resetPosition={resetPosition}
            authVisible={authVisible}
          />
        )}
      </div>
    </>
  );
}
