import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { animate as animeTween } from 'animejs';

/**
 * useRaycaster
 *
 * Wires up pointer-move and pointer-leave raycaster hover logic
 * for palette colours, canvas, and artist character.
 */
export function useRaycaster(containerRef, cameraRef, refs) {
  const paletteHoverState = useRef({
    elevation: 0, tiltX: 0, tiltY: 0, tiltZ: 0, scaleMult: 1.0, isHovered: false,
  });
  const activeHoverRef = useRef(null);

  const onPaletteEnter = useCallback(() => {
    const s = paletteHoverState.current;
    if (s.isHovered) return;
    s.isHovered = true;
    const ae = refs.animationEngine.current;
    if (ae) ae.hoverPalette();
    animeTween(s, { elevation: 0.05, tiltX: 0.22, tiltY: 0.15, tiltZ: 0.05, scaleMult: 1.12, duration: 350, ease: 'outBack' });
  }, [refs]);

  const onPaletteLeave = useCallback(() => {
    const s = paletteHoverState.current;
    if (!s.isHovered) return;
    s.isHovered = false;
    const ae = refs.animationEngine.current;
    if (ae) ae.clearPaletteHover();
    const pae = refs.paletteAnimationEngine.current;
    if (pae) pae.clearAllHighlights();
    animeTween(s, { elevation: 0, tiltX: 0, tiltY: 0, tiltZ: 0, scaleMult: 1.0, duration: 400, ease: 'outQuad' });
  }, [refs]);

  // Sync palette pivot transform each frame — called from the render loop
  const syncPalettePivot = useCallback(() => {
    const ae = refs.animationEngine.current;
    const pp = refs.palettePivot.current;
    const s = paletteHoverState.current;
    if (!ae || !pp || !ae.bones.leftHand) return;

    const lHand = ae.bones.leftHand;
    lHand.updateWorldMatrix(true, false);

    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    lHand.getWorldPosition(pos);
    lHand.getWorldQuaternion(quat);

    // In mixamorig:LeftHand bone local space:
    // +Y is along palm towards fingers, -X is thumb side, +Z is palm surface normal.
    // Offset centers the palette directly on the palm with thumb resting near thumbhole:
    const offset = new THREE.Vector3(-0.038, 0.085 + s.elevation, 0.035).applyQuaternion(quat);
    pp.position.copy(pos).add(offset);

    // Orient palette so colorful paint mounds face up with palm surface (+Z in hand space)
    // and thumbhole sits naturally around the thumb:
    const baseRot = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(Math.PI / 2 + s.tiltX, s.tiltY, Math.PI - 0.25 + s.tiltZ)
    );
    pp.quaternion.copy(quat).multiply(baseRot);
    pp.scale.setScalar(s.scaleMult);
  }, [refs]);

  const syncPaintbrush = useCallback(() => {
    const ae = refs.animationEngine.current;
    const pb = refs.paintbrush.current;
    if (!ae || !pb || !ae.bones.rightHand) return;
    const rHand = ae.bones.rightHand;
    rHand.updateWorldMatrix(true, false);

    const rPos = new THREE.Vector3();
    const rQuat = new THREE.Quaternion();
    rHand.getWorldPosition(rPos);
    rHand.getWorldQuaternion(rQuat);

    // In mixamorig:RightHand: brush handle sits in the palm across curled fingers
    const grip = new THREE.Vector3(0.015, 0.075, 0.025).applyQuaternion(rQuat);
    pb.position.copy(rPos).add(grip);

    // Bristle tip extends forward along finger direction towards the easel
    const brushLocalRot = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-Math.PI / 2 + 0.15, 0, 0.15)
    );
    pb.quaternion.copy(rQuat).multiply(brushLocalRot);
  }, [refs]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerMove = (event) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const camera = cameraRef.current;
      if (!camera) return;
      raycaster.setFromCamera(mouse, camera);

      const ae = refs.animationEngine.current;
      const pae = refs.paletteAnimationEngine.current;
      const pe = refs.paintingEngine.current;
      const pb = refs.paintbrush.current;
      if (ae) ae.setMousePointer(mouse.x, mouse.y);

      let isOnPalette = false;

      // ── Palette colours ───────────────────────────────────────────────────
      const colMeshes = refs.paletteColorMeshes.current;
      if (colMeshes.length > 0) {
        const hits = raycaster.intersectObjects(colMeshes, false);
        if (hits.length > 0) {
          isOnPalette = true;
          const uData = hits[0].object.userData;
          if (uData?.colorHex) {
            if (pb) pb.setTipColor(uData.colorHex);
            if (pe) { pe.setColor(uData.colorIndex); pe.setColorHex(uData.colorHex); }
            if (ae) ae.hoverPaletteColor(uData.colorHex, uData.colorIndex);
            if (pae) pae.highlightColor(uData.colorIndex);
          }
        }
      }
      const pp = refs.palettePivot.current;
      if (!isOnPalette && pp && raycaster.intersectObject(pp, true).length > 0) isOnPalette = true;

      if (isOnPalette) {
        container.style.cursor = 'pointer';
        if (activeHoverRef.current !== 'palette') {
          if (activeHoverRef.current === 'artist' && ae) ae.clearArtistHover();
          if (activeHoverRef.current === 'canvas' && ae) ae.clearHover();
          activeHoverRef.current = 'palette';
        }
        onPaletteEnter();
        return;
      }

      // ── Canvas ─────────────────────────────────────────────────────────────
      const cm = refs.canvasMesh.current;
      if (cm) {
        const hits = raycaster.intersectObject(cm, false);
        if (hits.length > 0 && hits[0].uv) {
          container.style.cursor = 'crosshair';
          if (activeHoverRef.current === 'palette') onPaletteLeave();
          if (activeHoverRef.current === 'artist' && ae) ae.clearArtistHover();
          activeHoverRef.current = 'canvas';
          if (ae) ae.hoverCanvas(hits[0].uv.x, hits[0].uv.y);
          return;
        }
      }

      // ── Artist ─────────────────────────────────────────────────────────────
      const ams = refs.artistMeshes.current;
      if (ams.length > 0 && raycaster.intersectObjects(ams, true).length > 0) {
        container.style.cursor = 'pointer';
        if (activeHoverRef.current === 'palette') onPaletteLeave();
        if (activeHoverRef.current === 'canvas' && ae) ae.clearHover();
        activeHoverRef.current = 'artist';
        if (ae) ae.hoverArtist();
        return;
      }

      // ── Default ─────────────────────────────────────────────────────────────
      container.style.cursor = 'default';
      if (activeHoverRef.current === 'palette') onPaletteLeave();
      if (activeHoverRef.current === 'artist' && ae) ae.clearArtistHover();
      if (activeHoverRef.current === 'canvas' && ae) ae.clearHover();
      activeHoverRef.current = null;
    };

    const onPointerLeave = () => {
      container.style.cursor = 'default';
      const ae = refs.animationEngine.current;
      if (activeHoverRef.current === 'palette') onPaletteLeave();
      if (activeHoverRef.current === 'artist' && ae) ae.clearArtistHover();
      if (activeHoverRef.current === 'canvas' && ae) ae.clearHover();
      activeHoverRef.current = null;
    };

    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerleave', onPointerLeave);
    return () => {
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [containerRef, cameraRef, refs, onPaletteEnter, onPaletteLeave]);

  return { syncPalettePivot, syncPaintbrush };
}
