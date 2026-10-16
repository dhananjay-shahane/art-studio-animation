import * as THREE from 'three';
import { animate } from 'animejs';

export class NatureAnimationEngine {
  constructor(natureGroup, scene) {
    this.natureGroup = natureGroup;
    this.scene = scene;
    this.time = 0;

    this.wind = {
      strength: 0.012,
      gustStrength: 0,
      directionX: 1.0,
      directionZ: 0.3,
      turbulence: 0,
    };

    this.leafMeshes = [];
    this._categorize();
    this._initWindCycle();
    this._initGustPattern();
    this._initParticles();
  }

  _categorize() {
    if (!this.natureGroup) return;
    this.natureGroup.traverse((child) => {
      if (!child.isMesh) return;
      const name = (child.name || '').toLowerCase();
      const isLeaf = name.includes('leaf') || name.includes('leaves') || name.includes('foliage') ||
        name.includes('canopy') || name.includes('crown') || name.includes('bush') ||
        name.includes('shrub') || name.includes('grass') || name.includes('flower') ||
        name.includes('fern') || name.includes('vine');
      const isTrunk = name.includes('trunk') || name.includes('bark') || name.includes('branch') ||
        name.includes('stem') || name.includes('root') || name.includes('log') ||
        name.includes('wood') || name.includes('rock') || name.includes('stone') || name.includes('ground');
      if (isTrunk) return;
      if (!isLeaf) {
        const bbox = new THREE.Box3().setFromObject(child);
        if ((bbox.max.y + bbox.min.y) / 2 < 0.5) return;
      }
      child.userData.originalPosition = child.position.clone();
      child.userData.originalRotation = child.rotation.clone();
      child.userData.originalScale    = child.scale.clone();
      child.userData.windResponse = {
        phaseOffset:    Math.random() * Math.PI * 2,
        secondaryFreq:  0.7 + Math.random() * 0.6,
        gustSensitivity:0.4 + Math.random() * 0.6,
        speedVariation: 0.8 + Math.random() * 0.4,
        swayAmount:     0.6 + Math.random() * 0.4,
      };
      this.leafMeshes.push(child);
    });
  }

  _initWindCycle() {
    animate(this.wind, { strength: [0.008, 0.016], duration: 6000, ease: 'inOutSine', loop: true, alternate: true });
    animate(this.wind, { directionX: [0.8, 1.2], directionZ: [0.1, 0.5], duration: 12000, ease: 'inOutSine', loop: true, alternate: true });
    animate(this.wind, { turbulence: [0, 0.006, 0.001, 0.010, 0], duration: 8000, ease: 'inOutSine', loop: true });
  }

  _initGustPattern() {
    const gust = () => {
      animate(this.wind, {
        gustStrength: [0, 0.020 + Math.random() * 0.012, 0],
        duration: 1200 + Math.random() * 1800, ease: 'outExpo',
      });
      setTimeout(gust, 4000 + Math.random() * 6000);
    };
    setTimeout(gust, 2000 + Math.random() * 3000);
  }

  _initParticles() {
    const count = 35;
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 8;
      positions[i * 3 + 1] = 0.5 + Math.random() * 3.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
      velocities.push({
        x: (Math.random() - 0.5) * 0.003, y: (Math.random() - 0.5) * 0.001,
        z: (Math.random() - 0.5) * 0.003, drift: Math.random() * Math.PI * 2,
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xfff8e7, size: 0.022, transparent: true, opacity: 0.40, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.particles = new THREE.Points(geo, mat);
    this.particleVelocities = velocities;
    this.scene.add(this.particles);
  }

  update(delta) {
    this.time += delta;
    const w = this.wind;
    const totalWind = w.strength + w.gustStrength;

    for (const mesh of this.leafMeshes) {
      const wr = mesh.userData.windResponse;
      const orig = mesh.userData.originalPosition;
      const origRot = mesh.userData.originalRotation;
      const origScale = mesh.userData.originalScale;
      if (!wr || !orig) continue;
      const t = this.time * wr.speedVariation;
      const phase = wr.phaseOffset;
      const primarySway   = Math.sin(t * 1.6 + phase) * totalWind * wr.swayAmount;
      const secondarySway = Math.sin(t * wr.secondaryFreq * 2.3 + phase * 0.7) * totalWind * wr.swayAmount * 0.3;
      const turbX = Math.sin(t * 4.5 + phase * 1.3) * w.turbulence * wr.gustSensitivity;
      const turbZ = Math.cos(t * 4.0 + phase * 0.9) * w.turbulence * wr.gustSensitivity;
      mesh.position.x = orig.x + (primarySway + turbX) * w.directionX * 0.4;
      mesh.position.z = orig.z + (secondarySway + turbZ) * w.directionZ * 0.4;
      mesh.rotation.x = origRot.x + primarySway * 0.3;
      mesh.rotation.z = origRot.z + secondarySway * 0.2 + turbZ * 1.5;
      const sp = 1.0 + Math.sin(t * 2.8 + phase) * 0.006 * totalWind * 25;
      mesh.scale.set(origScale.x * sp, origScale.y, origScale.z * sp);
    }

    if (this.particles) {
      const pos = this.particles.geometry.attributes.position.array;
      for (let i = 0; i < this.particleVelocities.length; i++) {
        const v = this.particleVelocities[i]; const idx = i * 3;
        pos[idx]     += (v.x + totalWind * w.directionX * 0.018) * 60 * delta;
        pos[idx + 1] += (v.y + Math.sin(this.time * 1.5 + v.drift) * 0.0006) * 60 * delta;
        pos[idx + 2] += (v.z + totalWind * w.directionZ * 0.012) * 60 * delta;
        if (pos[idx] > 5)     pos[idx] = -5;
        if (pos[idx] < -5)    pos[idx] = 5;
        if (pos[idx+1] > 4.5) pos[idx+1] = 0.3;
        if (pos[idx+1] < 0.2) pos[idx+1] = 4;
        if (pos[idx+2] > 4)   pos[idx+2] = -4;
        if (pos[idx+2] < -4)  pos[idx+2] = 4;
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
