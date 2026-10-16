import * as THREE from 'three';
import { animate } from 'animejs';

export class PaletteAnimationEngine {
  constructor(paletteModel, paletteColorMeshes, palettePivot) {
    this.paletteModel = paletteModel;
    this.paletteColorMeshes = paletteColorMeshes;
    this.palettePivot = palettePivot;
    this.glowStates = new Map();
    this.activeColorIndex = -1;
    this.time = 0;
    this.shimmer = { intensity: 0.12, speed: 1.0 };
    this._initGlowStates();
    this._initShimmer();
  }

  _initGlowStates() {
    this.paletteColorMeshes.forEach((mesh, index) => {
      const origColor    = mesh.material.color.clone();
      const origEmissive = mesh.material.emissive ? mesh.material.emissive.clone() : new THREE.Color(0x000000);
      this.glowStates.set(index, {
        glowIntensity: 0,
        originalColor: origColor,
        originalEmissive: origEmissive,
        originalRoughness: mesh.material.roughness,
        isHovered: false,
      });
      if (!mesh.material.emissive) mesh.material.emissive = new THREE.Color(0x000000);
      mesh.material.emissiveIntensity = 0;
    });
  }

  _initShimmer() {
    animate(this.shimmer, { intensity: [0.10, 0.18], speed: [0.8, 1.3], duration: 3200, ease: 'inOutSine', loop: true, alternate: true });
  }

  highlightColor(colorIndex) {
    if (this.activeColorIndex === colorIndex) return;
    if (this.activeColorIndex >= 0) this.unhighlightColor(this.activeColorIndex);
    this.activeColorIndex = colorIndex;
    const state = this.glowStates.get(colorIndex);
    if (!state) return;
    state.isHovered = true;
    animate(state, { glowIntensity: 0.6, duration: 250, ease: 'outQuad' });
  }

  unhighlightColor(colorIndex) {
    const state = this.glowStates.get(colorIndex);
    if (!state) return;
    state.isHovered = false;
    animate(state, { glowIntensity: 0, duration: 400, ease: 'outQuad' });
  }

  clearAllHighlights() {
    this.glowStates.forEach((_, index) => this.unhighlightColor(index));
    this.activeColorIndex = -1;
  }

  dipFeedback(colorIndex) {
    const mesh = this.paletteColorMeshes[colorIndex];
    if (!mesh) return;
    if (!mesh.userData.originalScale) mesh.userData.originalScale = mesh.scale.clone();
    const origScale = mesh.userData.originalScale;
    animate(mesh.scale, { y: [origScale.y, origScale.y * 0.85, origScale.y], duration: 400, ease: 'outBack' });
  }

  update(delta) {
    this.time += delta;
    this.paletteColorMeshes.forEach((mesh, index) => {
      const state = this.glowStates.get(index);
      if (!state) return;
      const wave = Math.sin(this.time * this.shimmer.speed * 2.5 + index * 1.1) * 0.5 + 0.5;
      mesh.material.roughness  = state.originalRoughness - wave * this.shimmer.intensity * 0.08;
      mesh.material.metalness  = 0.12 + wave * this.shimmer.intensity * 0.06;
      if (state.glowIntensity > 0.01) {
        mesh.material.emissive.copy(state.originalColor).multiplyScalar(0.3);
        mesh.material.emissiveIntensity = state.glowIntensity;
      } else {
        mesh.material.emissiveIntensity = 0;
      }
    });
  }

  dispose() { this.clearAllHighlights(); }
}
