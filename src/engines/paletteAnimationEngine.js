import * as THREE from 'three';
import { animate } from 'animejs';

/**
 * PaletteAnimationEngine — Animated palette.glb hover and interaction effects
 *
 * Based on real palette behavior research:
 * - Wet oil paint wells have glossy surfaces that catch and reflect light
 * - When artist picks a color, the paint well "dimples" briefly
 * - Palette is presented toward light when judging color temperature
 * - Paint mixing creates swirling color blends in the mixing area
 * - Colors glow subtly when hovered to indicate selection
 */
export class PaletteAnimationEngine {
  constructor(paletteModel, paletteColorMeshes, palettePivot) {
    this.paletteModel = paletteModel;
    this.paletteColorMeshes = paletteColorMeshes;
    this.palettePivot = palettePivot;

    // Track hover glow state per color well
    this.glowStates = new Map();
    this.activeColorIndex = -1;
    this.time = 0;

    // Ambient paint shimmer — wet oil paint effect
    this.shimmer = {
      intensity: 0.12,
      speed: 1.0
    };

    this.initPaintShimmer();
    this.initColorGlowStates();
  }

  /**
   * Initialize per-color-well glow tracking
   * Each paint well can independently glow when hovered
   */
  initColorGlowStates() {
    this.paletteColorMeshes.forEach((mesh, index) => {
      // Store original material properties for restoration
      const origColor = mesh.material.color.clone();
      const origEmissive = mesh.material.emissive ? mesh.material.emissive.clone() : new THREE.Color(0x000000);
      const origRoughness = mesh.material.roughness;

      this.glowStates.set(index, {
        glowIntensity: 0,
        originalColor: origColor,
        originalEmissive: origEmissive,
        originalRoughness: origRoughness,
        isHovered: false
      });

      // Ensure emissive is enabled on the material
      if (!mesh.material.emissive) {
        mesh.material.emissive = new THREE.Color(0x000000);
      }
      mesh.material.emissiveIntensity = 0;
    });
  }

  /**
   * Ambient wet paint shimmer — oil paint catches light differently
   * as the palette subtly rocks from breathing/arm movement
   */
  initPaintShimmer() {
    animate(this.shimmer, {
      intensity: [0.10, 0.18],
      speed: [0.8, 1.3],
      duration: 3200,
      ease: 'inOutSine',
      loop: true,
      alternate: true
    });
  }

  /**
   * Highlight a specific color well when hovered
   * Creates a warm glow effect like light catching wet oil paint
   */
  highlightColor(colorIndex) {
    if (this.activeColorIndex === colorIndex) return;

    // Unhighlight previous
    if (this.activeColorIndex >= 0) {
      this.unhighlightColor(this.activeColorIndex);
    }

    this.activeColorIndex = colorIndex;
    const state = this.glowStates.get(colorIndex);
    if (!state) return;

    state.isHovered = true;

    // Animate glow intensity up — warm emissive light
    animate(state, {
      glowIntensity: 0.6,
      duration: 250,
      ease: 'outQuad'
    });
  }

  /**
   * Remove highlight from a color well
   */
  unhighlightColor(colorIndex) {
    const state = this.glowStates.get(colorIndex);
    if (!state) return;

    state.isHovered = false;

    animate(state, {
      glowIntensity: 0,
      duration: 400,
      ease: 'outQuad'
    });
  }

  /**
   * Clear all highlights
   */
  clearAllHighlights() {
    this.glowStates.forEach((state, index) => {
      this.unhighlightColor(index);
    });
    this.activeColorIndex = -1;
  }

  /**
   * Paint dip visual feedback — the paint well briefly "dimples"
   * when the artist dips the brush into it
   */
  dipFeedback(colorIndex) {
    const mesh = this.paletteColorMeshes[colorIndex];
    if (!mesh) return;

    // Quick scale dip — like pressing into soft wet paint
    const origScale = mesh.userData.originalScale || mesh.scale.clone();
    if (!mesh.userData.originalScale) {
      mesh.userData.originalScale = mesh.scale.clone();
    }

    animate(mesh.scale, {
      y: [origScale.y, origScale.y * 0.85, origScale.y],
      duration: 400,
      ease: 'outBack'
    });
  }

  /**
   * Per-frame update — apply shimmer and glow effects to palette materials
   */
  update(delta) {
    this.time += delta;

    // Apply per-color-well glow and shimmer effects
    this.paletteColorMeshes.forEach((mesh, index) => {
      const state = this.glowStates.get(index);
      if (!state) return;

      // Ambient wet paint shimmer — metalness/roughness oscillation
      const shimmerWave = Math.sin(this.time * this.shimmer.speed * 2.5 + index * 1.1) * 0.5 + 0.5;
      const shimmerAmount = shimmerWave * this.shimmer.intensity;

      // Apply roughness variation (wet paint catches light)
      mesh.material.roughness = state.originalRoughness - shimmerAmount * 0.08;
      mesh.material.metalness = 0.12 + shimmerAmount * 0.06;

      // Apply emissive glow when hovered
      if (state.glowIntensity > 0.01) {
        mesh.material.emissive.copy(state.originalColor).multiplyScalar(0.3);
        mesh.material.emissiveIntensity = state.glowIntensity;
      } else {
        mesh.material.emissiveIntensity = 0;
      }
    });
  }

  dispose() {
    this.clearAllHighlights();
  }
}
