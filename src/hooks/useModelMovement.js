import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { MOVE_SPEED } from '../config/constants.js';

/**
 * useModelMovement
 *
 * Handles keyboard (WASD / arrow keys) and on-screen button movement
 * for the artist model.  Returns `applyMovement(camera)` to call each frame
 * and button event handlers for the D-pad.
 */
export function useModelMovement(modelRootRef, animationEngineRef) {
  const keysRef = useRef({});

  // Keyboard listeners
  useEffect(() => {
    const onDown = (e) => { keysRef.current[e.code] = true; };
    const onUp   = (e) => { keysRef.current[e.code] = false; };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup',   onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup',   onUp);
    };
  }, []);

  // Called every render frame — applies movement to the model
  const applyMovement = useCallback((camera) => {
    const modelRoot = modelRootRef.current;
    if (!modelRoot) return;

    const k   = keysRef.current;
    const spd = MOVE_SPEED;

    const moving = k['KeyW'] || k['KeyS'] || k['KeyA'] || k['KeyD'] ||
                   k['ArrowUp'] || k['ArrowDown'] || k['ArrowLeft'] || k['ArrowRight'];

    if (animationEngineRef?.current) animationEngineRef.current.isWalking = moving;
    if (!moving) return;

    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    camDir.y = 0; camDir.normalize();
    const camRight = new THREE.Vector3().crossVectors(camDir, THREE.Object3D.DEFAULT_UP).normalize();

    const move = new THREE.Vector3();
    if (k['KeyW'] || k['ArrowUp'])    move.addScaledVector(camDir,    spd);
    if (k['KeyS'] || k['ArrowDown'])  move.addScaledVector(camDir,   -spd);
    if (k['KeyA'] || k['ArrowLeft'])  move.addScaledVector(camRight, -spd);
    if (k['KeyD'] || k['ArrowRight']) move.addScaledVector(camRight,  spd);

    const nextPos = modelRoot.position.clone().add(move);

    // Collision boundary with easel & canvas board (easel at x: -0.10, z: 0.68)
    const EASEL_X = -0.10;
    const EASEL_Z = 0.68;
    const MIN_EASEL_DIST = 0.72; // Prevents person and hands from overlapping/clipping the easel

    const dx = nextPos.x - EASEL_X;
    const dz = nextPos.z - EASEL_Z;
    const distToEasel = Math.hypot(dx, dz);

    if (distToEasel < MIN_EASEL_DIST) {
      // Push back to perimeter of easel bounding cylinder so person cannot walk through it
      const angle = Math.atan2(dz, dx);
      nextPos.x = EASEL_X + Math.cos(angle) * MIN_EASEL_DIST;
      nextPos.z = EASEL_Z + Math.sin(angle) * MIN_EASEL_DIST;
    }

    // Outer perimeter constraint to keep character on studio ground
    const maxTerrainRadius = 8.0;
    const distFromOrigin = Math.hypot(nextPos.x, nextPos.z);
    if (distFromOrigin > maxTerrainRadius) {
      nextPos.x = (nextPos.x / distFromOrigin) * maxTerrainRadius;
      nextPos.z = (nextPos.z / distFromOrigin) * maxTerrainRadius;
    }

    modelRoot.position.copy(nextPos);
    modelRoot.position.y = Math.max(modelRoot.position.y, 0);
    if (move.lengthSq() > 0) modelRoot.rotation.y = Math.atan2(move.x, move.z);

    // Update proximity to canvas for animationEngine
    if (animationEngineRef?.current) {
      const curDist = Math.hypot(modelRoot.position.x - EASEL_X, modelRoot.position.z - EASEL_Z);
      animationEngineRef.current.isNearCanvas = (curDist <= 1.25);
    }
  }, [modelRootRef, animationEngineRef]);

  // D-pad button handlers
  const KEY_MAP = { ArrowUp: 'KeyW', ArrowDown: 'KeyS', ArrowLeft: 'KeyA', ArrowRight: 'KeyD' };

  const pressKey = useCallback((code) => {
    keysRef.current[code] = true;
    if (KEY_MAP[code]) keysRef.current[KEY_MAP[code]] = true;
  }, []);

  const releaseKey = useCallback((code) => {
    keysRef.current[code] = false;
    if (KEY_MAP[code]) keysRef.current[KEY_MAP[code]] = false;
  }, []);

  const resetPosition = useCallback(() => {
    const modelRoot = modelRootRef.current;
    if (!modelRoot) return;
    modelRoot.position.set(0, 0, 0);
    modelRoot.rotation.set(0, 0, 0);
    const bbox = new THREE.Box3().setFromObject(modelRoot);
    modelRoot.position.y = -bbox.min.y;
  }, [modelRootRef]);

  return { applyMovement, pressKey, releaseKey, resetPosition };
}
