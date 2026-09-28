import * as THREE from 'three';
import { animate } from 'animejs';

/**
 * NatureAnimationEngine — Wind-driven outdoor environment animation
 *
 * IMPORTANT: Only LEAVES and FOLIAGE sway in the wind.
 * Tree trunks and main branches stay firmly rooted — they do NOT move.
 * This creates realistic natural motion where canopy rustles while
 * the structure remains solid.
 *
 * Based on real outdoor nature behavior research:
 * - Leaves flutter and rustle independently
 * - Wind comes in gusts — momentary acceleration then slow decay
 * - Each leaf group has slightly different phase/frequency
 * - Trunks and main branches are rigid (they only flex in storms)
 * - Ambient pollen/dust motes drift with the breeze
 */
export class NatureAnimationEngine {
  constructor(natureGroup, scene) {
    this.natureGroup = natureGroup;
    this.scene = scene;
    this.time = 0;

    // Wind state — drives all nature movement
    this.wind = {
      strength: 0.012,     // Base wind intensity
      gustStrength: 0,      // Current gust overlay
      directionX: 1.0,      // Wind direction vector X
      directionZ: 0.3,      // Wind direction vector Z
      turbulence: 0         // Adds randomness to sway
    };

    // ONLY leaf/foliage meshes go here — trunks are excluded
    this.leafMeshes = [];

    this.categorizeNatureMeshes();
    this.initWindCycle();
    this.initGustPattern();
    this.initAmbientParticles();
  }

  /**
   * Categorize nature-bg.glb meshes into leaves vs trunks.
   * ONLY leaf/foliage meshes get animated.
   * Tree trunks, roots, and structural elements stay perfectly still.
   */
  categorizeNatureMeshes() {
    if (!this.natureGroup) return;

    this.natureGroup.traverse((child) => {
      if (!child.isMesh) return;

      const name = (child.name || '').toLowerCase();

      // Determine if this mesh is a leaf/foliage or a trunk/structure
      const isLeaf = (
        name.includes('leaf') ||
        name.includes('leaves') ||
        name.includes('foliage') ||
        name.includes('canopy') ||
        name.includes('crown') ||
        name.includes('bush') ||
        name.includes('shrub') ||
        name.includes('grass') ||
        name.includes('flower') ||
        name.includes('fern') ||
        name.includes('vine')
      );

      const isTrunk = (
        name.includes('trunk') ||
        name.includes('bark') ||
        name.includes('branch') ||
        name.includes('stem') ||
        name.includes('root') ||
        name.includes('log') ||
        name.includes('wood') ||
        name.includes('rock') ||
        name.includes('stone') ||
        name.includes('ground')
      );

      // If it's explicitly a trunk/structure, skip it entirely
      if (isTrunk) return;

      // If the name doesn't clearly indicate what it is, use vertical position
      // as a heuristic: higher meshes (above y=0.5) are likely canopy/leaves
      if (!isLeaf && !isTrunk) {
        const bbox = new THREE.Box3().setFromObject(child);
        const centerY = (bbox.max.y + bbox.min.y) / 2;
        // Only animate meshes whose center is above a certain height
        // This ensures ground-level and trunk-level meshes stay still
        if (centerY < 0.5) return;
      }

      // This mesh is a leaf/foliage — store its original transform and animate it
      child.userData.originalPosition = child.position.clone();
      child.userData.originalRotation = child.rotation.clone();
      child.userData.originalScale = child.scale.clone();

      child.userData.windResponse = {
        // Each leaf group gets unique phase for natural variety
        phaseOffset: Math.random() * Math.PI * 2,
        // Secondary frequency for complex, non-repetitive motion
        secondaryFreq: 0.7 + Math.random() * 0.6,
        // How much this mesh responds to gusts
        gustSensitivity: 0.4 + Math.random() * 0.6,
        // Individual sway speed variation
        speedVariation: 0.8 + Math.random() * 0.4,
        // Sway amplitude — leaves sway gently, not wildly
        swayAmount: 0.6 + Math.random() * 0.4
      };

      this.leafMeshes.push(child);
    });

    console.log(`NatureEngine: ${this.leafMeshes.length} leaf/foliage meshes will sway (trunks stay still)`);
  }

  /**
   * Continuous base wind cycle — smooth sinusoidal breeze
   */
  initWindCycle() {
    // Primary wind strength oscillation
    animate(this.wind, {
      strength: [0.008, 0.016],
      duration: 6000,
      ease: 'inOutSine',
      loop: true,
      alternate: true
    });

    // Wind direction slowly rotates — breeze shifts naturally
    animate(this.wind, {
      directionX: [0.8, 1.2],
      directionZ: [0.1, 0.5],
      duration: 12000,
      ease: 'inOutSine',
      loop: true,
      alternate: true
    });

    // Turbulence varies — calm moments and rustling moments
    animate(this.wind, {
      turbulence: [0, 0.006, 0.001, 0.010, 0],
      duration: 8000,
      ease: 'inOutSine',
      loop: true
    });
  }

  /**
   * Periodic wind gusts — sudden acceleration then slow decay
   */
  initGustPattern() {
    const triggerGust = () => {
      const gustDuration = 1200 + Math.random() * 1800;
      animate(this.wind, {
        gustStrength: [0, 0.020 + Math.random() * 0.012, 0],
        duration: gustDuration,
        ease: 'outExpo'
      });

      // Schedule next gust with natural irregularity
      setTimeout(triggerGust, 4000 + Math.random() * 6000);
    };

    setTimeout(triggerGust, 2000 + Math.random() * 3000);
  }

  /**
   * Ambient floating particles — pollen, dust motes drifting in the breeze
   */
  initAmbientParticles() {
    const particleCount = 35;
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 1] = 0.5 + Math.random() * 3.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;

      velocities.push({
        x: (Math.random() - 0.5) * 0.003,
        y: (Math.random() - 0.5) * 0.001,
        z: (Math.random() - 0.5) * 0.003,
        drift: Math.random() * Math.PI * 2
      });
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xfff8e7,
      size: 0.022,
      transparent: true,
      opacity: 0.40,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particles = new THREE.Points(geometry, material);
    this.particles.name = 'AmbientParticles';
    this.particleVelocities = velocities;
    this.scene.add(this.particles);
  }

  /**
   * Per-frame update — ONLY animate leaf meshes, NOT trunks
   */
  update(delta) {
    this.time += delta;

    const w = this.wind;
    const totalWind = w.strength + w.gustStrength;

    // ── Animate ONLY leaf/foliage meshes — trunks stay perfectly still ──
    for (const mesh of this.leafMeshes) {
      const wr = mesh.userData.windResponse;
      const orig = mesh.userData.originalPosition;
      const origRot = mesh.userData.originalRotation;
      const origScale = mesh.userData.originalScale;

      if (!wr || !orig) continue;

      const t = this.time * wr.speedVariation;
      const phase = wr.phaseOffset;

      // Primary leaf sway — gentle sine wave flutter
      const primarySway = Math.sin(t * 1.6 + phase) * totalWind * wr.swayAmount;

      // Secondary sway — adds organic complexity
      const secondarySway = Math.sin(t * wr.secondaryFreq * 2.3 + phase * 0.7) * totalWind * wr.swayAmount * 0.3;

      // Turbulent micro-flutter — leaves quiver in gusts
      const turbX = Math.sin(t * 4.5 + phase * 1.3) * w.turbulence * wr.gustSensitivity;
      const turbZ = Math.cos(t * 4.0 + phase * 0.9) * w.turbulence * wr.gustSensitivity;

      // Apply gentle position offset (subtle swaying)
      mesh.position.x = orig.x + (primarySway + turbX) * w.directionX * 0.4;
      mesh.position.z = orig.z + (secondarySway + turbZ) * w.directionZ * 0.4;

      // Apply gentle rotation (leaves tilting in the breeze)
      mesh.rotation.x = origRot.x + primarySway * 0.3;
      mesh.rotation.z = origRot.z + secondarySway * 0.2 + turbZ * 1.5;

      // Scale pulsation for rustling feel — leaves briefly expand/contract
      const scalePulse = 1.0 + Math.sin(t * 2.8 + phase) * 0.006 * totalWind * 25;
      mesh.scale.set(
        origScale.x * scalePulse,
        origScale.y,
        origScale.z * scalePulse
      );
    }

    // ── Animate ambient particles ──
    if (this.particles && this.particleVelocities) {
      const positions = this.particles.geometry.attributes.position.array;
      const vels = this.particleVelocities;

      for (let i = 0; i < vels.length; i++) {
        const v = vels[i];
        const idx = i * 3;

        positions[idx] += (v.x + totalWind * w.directionX * 0.018) * 60 * delta;
        positions[idx + 1] += (v.y + Math.sin(this.time * 1.5 + v.drift) * 0.0006) * 60 * delta;
        positions[idx + 2] += (v.z + totalWind * w.directionZ * 0.012) * 60 * delta;

        // Wrap particles that drift too far
        if (positions[idx] > 5) positions[idx] = -5;
        if (positions[idx] < -5) positions[idx] = 5;
        if (positions[idx + 1] > 4.5) positions[idx + 1] = 0.3;
        if (positions[idx + 1] < 0.2) positions[idx + 1] = 4;
        if (positions[idx + 2] > 4) positions[idx + 2] = -4;
        if (positions[idx + 2] < -4) positions[idx + 2] = 4;
      }

      this.particles.geometry.attributes.position.needsUpdate = true;
    }
  }

  dispose() {
    if (this.particles) {
      this.particles.geometry.dispose();
      this.particles.material.dispose();
      this.scene.remove(this.particles);
    }
  }
}
