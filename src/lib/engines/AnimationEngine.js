import * as THREE from 'three';
import { animate, createTimeline } from 'animejs';

/**
 * AnimationEngine — Plein-air artist skeletal animation system.
 *
 * All bone pose values live in `this.pose` and are driven by
 * Anime.js tweens.  The `update(delta)` method applies them to
 * the actual Three.js skeleton every frame.
 */
export class AnimationEngine {
  constructor(model, gltfAnimations = []) {
    this.model = model;
    this.gltfAnimations = gltfAnimations;
    this.bones = {};
    this.restTransforms = new Map();

    this.isHoveringPalette = false;
    this.isHoveringCanvas = false;
    this.isHoveringArtist = false;
    this.hoverCanvasUV = null;
    this.isPaused = false;
    this.isWalking = false;

    this.time = 0;
    this._walkTime = 0;
    this.lastStrokeTime = 0;
    this.artistHoverTimeline = null;
    this.pickedColorIndex = 0;
    this.mousePointer = { x: 0, y: 0 };
    this.currentGaze = { x: 0, y: 0 };

    this.onBrushStroke = null;
    this.onColorPicked = null;

    this.pose = {
      // Left arm — holds palette comfortably at waist height, elbow bent inward
      leftArm:      { x: 0.72, y: 0.18, z: 0.80 },
      leftForeArm:  { x: 0.42, y: 0.10, z: 0.68 },
      leftHand:     { x: 0.08, y: 0.04, z: 0.08 },

      // Right arm — painting arm raised toward easel canvas
      rightArm:     { x: 0.55, y: -0.12, z: -0.88 },
      rightForeArm: { x: 0.30, y: -0.08, z: -0.60 },
      rightHand:    { x: 0.08, y: -0.04, z: -0.12 },

      head:  { x: -0.06, y: 0.04, z: -0.02 },

      hips:  { y: 0, rx: 0.04, ry: -0.06, rz: 0.02 },
      spine: { rx: 0.08, ry: 0.04, rz: 0 },

      weightShift:      { lean: 0, rock: 0 },
      examineIntensity: 0,
    };

    this.initBones();
    this.initBreathing();
    this.initWeightShifting();
    this.initPaintingTimeline();
    this.initExaminationCycle();
  }

  // ─── Bone mapping ──────────────────────────────────────────────────────────
  initBones() {
    let skinnedMesh = null;
    this.model.traverse((child) => {
      if (child.isSkinnedMesh) skinnedMesh = child;
      if (child.isBone) {
        this.bones[child.name] = child;
        this.restTransforms.set(child, {
          position: child.position.clone(),
          quaternion: child.quaternion.clone(),
          scale:    child.scale.clone(),
        });
      }
    });

    if (skinnedMesh && skinnedMesh.skeleton) {
      const sb = skinnedMesh.skeleton.bones;
      this.bones.hips          = sb[0];
      this.bones.spine         = sb[1];
      this.bones.spine1        = sb[2];
      this.bones.spine2        = sb[3];
      this.bones.neck          = sb[4];
      this.bones.head          = sb[5];

      this.bones.leftShoulder  = sb[7];
      this.bones.leftArm       = sb[8];
      this.bones.leftForeArm   = sb[9];
      this.bones.leftHand      = sb[10];
      this.bones.leftHandThumb1   = sb[11];
      this.bones.leftHandThumb2   = sb[12];
      this.bones.leftHandIndex1   = sb[15];
      this.bones.leftHandMiddle1  = sb[19];
      this.bones.leftHandRing1    = sb[23];
      this.bones.leftHandPinky1   = sb[27];

      this.bones.rightShoulder = sb[31];
      this.bones.rightArm      = sb[32];
      this.bones.rightForeArm  = sb[33];
      this.bones.rightHand     = sb[34];
      this.bones.rightHandThumb1  = sb[35];
      this.bones.rightHandThumb2  = sb[36];
      this.bones.rightHandIndex1  = sb[39];
      this.bones.rightHandIndex2  = sb[40];
      this.bones.rightHandMiddle1 = sb[43];
      this.bones.rightHandMiddle2 = sb[44];
      this.bones.rightHandRing1   = sb[47];
      this.bones.rightHandRing2   = sb[48];
      this.bones.rightHandPinky1  = sb[51];
      this.bones.rightHandPinky2  = sb[52];

      this.bones.leftUpLeg  = sb[55];
      this.bones.leftLeg    = sb[56];
      this.bones.leftFoot   = sb[57];
      this.bones.rightUpLeg = sb[60];
      this.bones.rightLeg   = sb[61];
      this.bones.rightFoot  = sb[62];
    } else {
      // Fallback — match by name
      for (const [name, bone] of Object.entries(this.bones)) {
        const c = name.replace(/[:_\s]/g, '').toLowerCase();
        if (c === 'mixamorigleftarm')       this.bones.leftArm      = bone;
        else if (c === 'mixamorigleftforearm') this.bones.leftForeArm = bone;
        else if (c === 'mixamoriglefthand')    this.bones.leftHand    = bone;
        else if (c.includes('lefthandthumb1')) this.bones.leftHandThumb1 = bone;
        else if (c.includes('lefthandindex1')) this.bones.leftHandIndex1 = bone;
        else if (c === 'mixamorigrightarm')    this.bones.rightArm    = bone;
        else if (c === 'mixamorigrightforearm')this.bones.rightForeArm= bone;
        else if (c === 'mixamorigrighthand')   this.bones.rightHand   = bone;
        else if (c.includes('righthandindex1'))this.bones.rightHandIndex1 = bone;
        else if (c === 'mixamorighead')        this.bones.head        = bone;
        else if (c === 'mixamorigspine')       this.bones.spine       = bone;
        else if (c === 'mixamorighips')        this.bones.hips        = bone;
        else if (c.includes('leftupleg'))      this.bones.leftUpLeg   = bone;
        else if (c.includes('leftleg'))        this.bones.leftLeg     = bone;
        else if (c.includes('leftfoot'))       this.bones.leftFoot    = bone;
        else if (c.includes('rightupleg'))     this.bones.rightUpLeg  = bone;
        else if (c.includes('rightleg'))       this.bones.rightLeg    = bone;
        else if (c.includes('rightfoot'))      this.bones.rightFoot   = bone;
      }
    }
  }

  // ─── Idle animations ───────────────────────────────────────────────────────
  initBreathing() {
    animate(this.pose.hips,  { y: [-0.014, 0.014], duration: 2800, ease: 'inOutSine', loop: true, alternate: true });
    animate(this.pose.spine, { rx: [0.06, 0.11], ry: [0.03, 0.05], duration: 2800, ease: 'inOutSine', loop: true, alternate: true });
    // Left arm gentle sway from breathing
    animate(this.pose.leftArm,     { x: [0.70, 0.75], z: [0.78, 0.83], duration: 3000, ease: 'inOutSine', loop: true, alternate: true });
    animate(this.pose.leftForeArm, { x: [0.40, 0.45], z: [0.66, 0.71], duration: 3000, ease: 'inOutSine', loop: true, alternate: true });
    animate(this.pose.head, { z: [-0.03, 0.01], duration: 2800, ease: 'inOutSine', loop: true, alternate: true });
  }

  initWeightShifting() {
    animate(this.pose.weightShift, { lean: [-0.035, 0.035], duration: 4200, ease: 'inOutSine', loop: true, alternate: true });
    animate(this.pose.weightShift, { rock: [-0.02, 0.03],   duration: 5800, ease: 'inOutSine', loop: true, alternate: true });
  }

  initExaminationCycle() {
    animate(this.pose, { examineIntensity: [0, 0.4, 0], duration: 8000, ease: 'inOutSine', loop: true });
  }

  // ─── Painting timeline ─────────────────────────────────────────────────────
  initPaintingTimeline() {
    this.paintingTimeline = createTimeline({ loop: true, autoplay: true });

    // Stroke 1 — upward sweep
    this.paintingTimeline.add(this.pose.rightArm,
      { x: 0.55, y: -0.10, z: -0.96, duration: 900, ease: 'inOutQuad',
        onUpdate: () => this._emitStroke(0.30, 0.35, 0.50, 0.28) }, 0);
    this.paintingTimeline.add(this.pose.rightForeArm,
      { x: 0.28, y: -0.12, z: -0.74, duration: 900, ease: 'inOutQuad' }, 0);
    this.paintingTimeline.add(this.pose.head,
      { x: -0.04, y: 0.06, duration: 900, ease: 'inOutSine' }, 0);

    // Stroke 2 — downward sweep
    this.paintingTimeline.add(this.pose.rightArm,
      { x: 0.70, y: -0.24, z: -0.86, duration: 850, ease: 'inOutSine',
        onUpdate: () => this._emitStroke(0.38, 0.32, 0.32, 0.35) }, '+=120');
    this.paintingTimeline.add(this.pose.rightForeArm,
      { x: 0.42, y: -0.08, z: -0.58, duration: 850, ease: 'inOutSine' }, '-=850');
    this.paintingTimeline.add(this.pose.head,
      { x: -0.08, y: 0.10, duration: 850, ease: 'inOutSine' }, '-=850');

    // Examination pause
    this.paintingTimeline.add(this.pose.rightArm,
      { x: 0.60, y: -0.15, z: -0.82, duration: 600, ease: 'outQuad' }, '+=180');
    this.paintingTimeline.add(this.pose.head,
      { x: -0.10, y: 0.02, z: -0.04, duration: 600, ease: 'outQuad' }, '-=600');
    this.paintingTimeline.add(this.pose.spine,
      { rx: 0.04, ry: 0.02, duration: 600, ease: 'outQuad' }, '-=600');

    // Look at nature
    this.paintingTimeline.add(this.pose.head,
      { x: -0.02, y: -0.18, z: 0.04, duration: 700, ease: 'inOutQuad' }, '+=300');
    this.paintingTimeline.add(this.pose.spine,
      { rx: 0.06, ry: -0.08, duration: 700, ease: 'inOutQuad' }, '-=700');

    // Dip brush
    this.paintingTimeline.add(this.pose.rightArm,
      { x: 0.86, y: -0.34, z: -0.66, duration: 1000, ease: 'inOutQuad' }, '+=200');
    this.paintingTimeline.add(this.pose.rightForeArm,
      { x: 0.52, y: -0.26, z: -0.44, duration: 1000, ease: 'inOutQuad' }, '-=1000');
    this.paintingTimeline.add(this.pose.head,
      { x: 0.34, y: -0.24, z: -0.04, duration: 1000, ease: 'inOutQuad' }, '-=1000');
    this.paintingTimeline.add(this.pose.spine,
      { rx: 0.10, ry: 0.06, duration: 1000, ease: 'inOutQuad' }, '-=1000');

    // Mixing motion
    this.paintingTimeline.add(this.pose.rightHand,
      { x: [0.10, 0.24, 0.16, 0.10], y: [-0.05, -0.12, -0.08, -0.05], duration: 500, ease: 'inOutSine' }, '+=60');

    // Lift brush — return to canvas
    this.paintingTimeline.add(this.pose.rightArm,
      { x: 0.65, y: -0.15, z: -0.90, duration: 880, ease: 'outCubic' }, '+=100');
    this.paintingTimeline.add(this.pose.rightForeArm,
      { x: 0.35, y: -0.10, z: -0.65, duration: 880, ease: 'outCubic' }, '-=880');
    this.paintingTimeline.add(this.pose.rightHand,
      { x: 0.10, y: -0.05, z: -0.15, duration: 880, ease: 'outCubic' }, '-=880');
    this.paintingTimeline.add(this.pose.head,
      { x: -0.06, y: 0.04, z: -0.02, duration: 880, ease: 'outCubic' }, '-=880');
    this.paintingTimeline.add(this.pose.spine,
      { rx: 0.08, ry: 0.04, rz: 0, duration: 880, ease: 'outCubic' }, '-=880');
  }

  _emitStroke(bx, bw, by, bh) {
    if (!this.onBrushStroke) return;
    if (this.isHoveringPalette || this.isHoveringCanvas || this.isHoveringArtist) return;
    const now = performance.now();
    if (now - this.lastStrokeTime > 120) {
      this.lastStrokeTime = now;
      this.onBrushStroke(bx + Math.random() * bw, by + Math.random() * bh);
    }
  }

  // ─── Hover interactions ────────────────────────────────────────────────────
  hoverPaletteColor(colorHex, colorIndex) {
    this.isHoveringPalette = true;
    this.isHoveringCanvas = false;
    if (this.paintingTimeline) this.paintingTimeline.pause();
    animate(this.pose.rightArm,     { x: 0.88, y: -0.34, z: -0.66, duration: 350, ease: 'outQuad' });
    animate(this.pose.rightForeArm, { x: 0.52, y: -0.26, z: -0.44, duration: 350, ease: 'outQuad' });
    animate(this.pose.head,         { x: 0.34, y: -0.24, duration: 300, ease: 'outQuad' });
    animate(this.pose.rightHand,    { x: [0.08, 0.24, 0.10], duration: 350, ease: 'outBack' });
    if (this.onColorPicked) this.onColorPicked(colorHex, colorIndex);
  }

  hoverPalette() {
    if (this.isHoveringPalette) return;
    this.isHoveringPalette = true;
    this.isHoveringArtist = false;
    this.isHoveringCanvas = false;
    if (this.paintingTimeline) this.paintingTimeline.pause();
    animate(this.pose.leftArm,      { x: 0.90, y: 0.28, z: 0.70, duration: 400, ease: 'outBack' });
    animate(this.pose.leftForeArm,  { x: 0.58, y: 0.24, z: 0.56, duration: 400, ease: 'outBack' });
    animate(this.pose.rightArm,     { x: 0.86, y: -0.34, z: -0.64, duration: 380, ease: 'outQuad' });
    animate(this.pose.rightForeArm, { x: 0.56, y: -0.26, z: -0.44, duration: 380, ease: 'outQuad' });
    animate(this.pose.rightHand,    { x: 0.22, y: -0.10, z: -0.10, duration: 380, ease: 'outQuad' });
    animate(this.pose.head,         { x: 0.34, y: -0.24, z: -0.05, duration: 340, ease: 'outQuad' });
    animate(this.pose.spine,        { rx: 0.12, ry: 0.06, duration: 380, ease: 'outQuad' });
  }

  clearPaletteHover() {
    if (!this.isHoveringPalette) return;
    this.isHoveringPalette = false;
    animate(this.pose.leftArm,      { x: 0.70, y: 0.15, z: 0.85, duration: 450, ease: 'outQuad' });
    animate(this.pose.leftForeArm,  { x: 0.40, y: 0.15, z: 0.70, duration: 450, ease: 'outQuad' });
    animate(this.pose.rightArm,     { x: 0.65, y: -0.15, z: -0.90, duration: 450, ease: 'outQuad' });
    animate(this.pose.rightForeArm, { x: 0.35, y: -0.10, z: -0.65, duration: 450, ease: 'outQuad' });
    animate(this.pose.rightHand,    { x: 0.10, y: -0.05, z: -0.15, duration: 450, ease: 'outQuad' });
    animate(this.pose.head,         { x: -0.06, y: 0.04, z: -0.02, duration: 450, ease: 'outQuad' });
    animate(this.pose.spine, {
      rx: 0.08, ry: 0.04, duration: 450, ease: 'outQuad',
      onComplete: () => {
        if (!this.isHoveringPalette && !this.isHoveringArtist && !this.isHoveringCanvas && this.paintingTimeline)
          this.paintingTimeline.play();
      },
    });
  }

  hoverCanvas(u, v) {
    this.isHoveringCanvas = true;
    this.isHoveringPalette = false;
    this.hoverCanvasUV = { u, v };
    if (this.paintingTimeline) this.paintingTimeline.pause();
    const armPitch = 0.50 + (1.0 - v) * 0.32;
    const armYaw   = -0.24 + (u - 0.5) * 0.24;
    const armRoll  = -0.84 - (1.0 - u) * 0.22;
    animate(this.pose.rightArm,     { x: armPitch, y: armYaw, z: armRoll, duration: 100, ease: 'outQuad' });
    animate(this.pose.rightForeArm, { x: 0.24 + (1.0 - v) * 0.20, z: -0.58 - v * 0.26, duration: 100, ease: 'outQuad' });
    animate(this.pose.head,         { x: -0.05 + (v - 0.5) * 0.22, y: 0.06 + (u - 0.5) * 0.24, duration: 140, ease: 'outQuad' });
    const now = performance.now();
    if (now - this.lastStrokeTime > 45) {
      this.lastStrokeTime = now;
      if (this.onBrushStroke) this.onBrushStroke(u, v);
    }
  }

  clearHover() {
    if (!this.isHoveringPalette && !this.isHoveringCanvas) return;
    this.isHoveringPalette = false;
    this.isHoveringCanvas  = false;
    animate(this.pose.rightArm,     { x: 0.65, y: -0.15, z: -0.90, duration: 500, ease: 'outQuad' });
    animate(this.pose.rightForeArm, { x: 0.35, y: -0.10, z: -0.65, duration: 500, ease: 'outQuad' });
    animate(this.pose.head, {
      x: -0.06, y: 0.04, duration: 500, ease: 'outQuad',
      onComplete: () => {
        if (!this.isHoveringPalette && !this.isHoveringCanvas && !this.isHoveringArtist && this.paintingTimeline)
          this.paintingTimeline.play();
      },
    });
  }

  hoverArtist() {
    if (this.isHoveringArtist) return;
    this.isHoveringArtist = true;
    this.isHoveringPalette = false;
    this.isHoveringCanvas  = false;
    if (this.paintingTimeline) this.paintingTimeline.pause();
    if (this.artistHoverTimeline) this.artistHoverTimeline.pause();
    this._playDipAndPaint();
  }

  clearArtistHover() {
    if (!this.isHoveringArtist) return;
    this.isHoveringArtist = false;
    if (this.artistHoverTimeline) { this.artistHoverTimeline.pause(); this.artistHoverTimeline = null; }
    animate(this.pose.rightArm,     { x: 0.65, y: -0.15, z: -0.90, duration: 500, ease: 'outQuad' });
    animate(this.pose.rightForeArm, { x: 0.35, y: -0.10, z: -0.65, duration: 500, ease: 'outQuad' });
    animate(this.pose.rightHand,    { x: 0.10, y: -0.05, z: -0.15, duration: 500, ease: 'outQuad' });
    animate(this.pose.head,         { x: -0.06, y: 0.04, z: -0.02, duration: 500, ease: 'outQuad' });
    animate(this.pose.leftArm,      { x: 0.70, y: 0.15, z: 0.85, duration: 500, ease: 'outQuad' });
    animate(this.pose.leftForeArm,  { x: 0.40, y: 0.15, z: 0.70, duration: 500, ease: 'outQuad' });
    animate(this.pose.spine, {
      rx: 0.08, ry: 0.04, rz: 0, duration: 500, ease: 'outQuad',
      onComplete: () => {
        if (!this.isHoveringArtist && !this.isHoveringPalette && !this.isHoveringCanvas && this.paintingTimeline)
          this.paintingTimeline.play();
      },
    });
  }

  _playDipAndPaint() {
    if (!this.isHoveringArtist) return;
    const colors = [
      { hex: '#ef4444' }, { hex: '#f97316' }, { hex: '#facc15' },
      { hex: '#10b981' }, { hex: '#3b82f6' }, { hex: '#8b5cf6' },
    ];
    this.pickedColorIndex = (this.pickedColorIndex + 1) % colors.length;
    const picked = colors[this.pickedColorIndex];

    this.artistHoverTimeline = createTimeline({
      loop: false,
      onComplete: () => { if (this.isHoveringArtist) this._playDipAndPaint(); },
    });

    this.artistHoverTimeline
      .add(this.pose.head,  { x: 0.34, y: -0.26, z: -0.05, duration: 420, ease: 'inOutQuad' }, 0)
      .add(this.pose.spine, { rx: 0.12, ry: 0.06, duration: 420, ease: 'outQuad' }, 0)
      .add(this.pose.leftArm,      { x: 0.84, y: 0.24, z: 0.72, duration: 420, ease: 'outQuad' }, 0)
      .add(this.pose.leftForeArm,  { x: 0.50, y: 0.20, z: 0.60, duration: 420, ease: 'outQuad' }, 0)
      .add(this.pose.rightArm,     { x: 0.88, y: -0.34, z: -0.64, duration: 420, ease: 'inOutQuad' }, 0)
      .add(this.pose.rightForeArm, { x: 0.54, y: -0.26, z: -0.44, duration: 420, ease: 'inOutQuad' }, 0)
      .add(this.pose.rightHand,    {
        x: [0.10, 0.26, 0.18, 0.26, 0.10], y: [-0.05, -0.14, -0.08, -0.12, -0.05],
        duration: 600, ease: 'inOutSine',
        onComplete: () => { if (this.onColorPicked) this.onColorPicked(picked.hex, this.pickedColorIndex); },
      }, '+=50')
      .add(this.pose.head,         { x: -0.05, y: 0.08, z: 0.0, duration: 480, ease: 'inOutQuad' }, '+=80')
      .add(this.pose.leftArm,      { x: 0.70, y: 0.15, z: 0.85, duration: 480, ease: 'outQuad' }, '-=480')
      .add(this.pose.leftForeArm,  { x: 0.40, y: 0.15, z: 0.70, duration: 480, ease: 'outQuad' }, '-=480')
      .add(this.pose.rightArm,     { x: 0.60, y: -0.14, z: -0.95, duration: 480, ease: 'inOutQuad' }, '-=480')
      .add(this.pose.rightForeArm, { x: 0.30, y: -0.12, z: -0.72, duration: 480, ease: 'inOutQuad' }, '-=480')
      .add(this.pose.spine,        { rx: 0.08, ry: 0.04, duration: 480, ease: 'outQuad' }, '-=480');
  }

  setMousePointer(x, y) {
    this.mousePointer.x = x;
    this.mousePointer.y = y;
  }

  // ─── Reset rest pose ───────────────────────────────────────────────────────
  resetAllBones() {
    for (const [bone, rest] of this.restTransforms.entries()) {
      bone.position.copy(rest.position);
      bone.quaternion.copy(rest.quaternion);
      bone.scale.copy(rest.scale);
    }
  }

  // ─── Per-frame update ──────────────────────────────────────────────────────
  update(delta) {
    if (this.isPaused) return;

    this._walkTime += delta;
    const b = this.bones;
    const p = this.pose;

    this.resetAllBones();

    // Smooth gaze
    if (this.isHoveringArtist) {
      this.currentGaze.x += (-this.mousePointer.y * 0.08 - this.currentGaze.x) * 0.12;
      this.currentGaze.y += ( this.mousePointer.x * 0.10 - this.currentGaze.y) * 0.12;
    } else {
      this.currentGaze.x += (0 - this.currentGaze.x) * 0.06;
      this.currentGaze.y += (0 - this.currentGaze.y) * 0.06;
    }

    // Hips
    if (b.hips) {
      const rest = this.restTransforms.get(b.hips);
      b.hips.position.y = rest.position.y + p.hips.y;
      b.hips.quaternion.multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(
          p.hips.rx + p.weightShift.rock, p.hips.ry, p.hips.rz + p.weightShift.lean))
      );
    }

    // Spine
    if (b.spine) {
      b.spine.quaternion.multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(
          p.spine.rx - p.examineIntensity * 0.06, p.spine.ry, p.spine.rz))
      );
    }

    // Left arm
    this._applyBoneEuler(b.leftArm,     p.leftArm.x,     p.leftArm.y,     p.leftArm.z);
    this._applyBoneEuler(b.leftForeArm, p.leftForeArm.x, p.leftForeArm.y, p.leftForeArm.z);
    this._applyBoneEuler(b.leftHand,    p.leftHand.x,    p.leftHand.y,    p.leftHand.z);
    this._applyBoneEuler(b.leftHandThumb1,  0.22, 0.14, 0.28);
    this._applyBoneEuler(b.leftHandThumb2,  0.18, 0,    0.15);
    this._applyBoneEuler(b.leftHandIndex1,  0.52, 0,    0.30);
    this._applyBoneEuler(b.leftHandMiddle1, 0.58, 0,    0.30);
    this._applyBoneEuler(b.leftHandRing1,   0.58, 0,    0.30);
    this._applyBoneEuler(b.leftHandPinky1,  0.58, 0,    0.30);

    // Right arm
    this._applyBoneEuler(b.rightArm,     p.rightArm.x,     p.rightArm.y,     p.rightArm.z);
    this._applyBoneEuler(b.rightForeArm, p.rightForeArm.x, p.rightForeArm.y, p.rightForeArm.z);
    this._applyBoneEuler(b.rightHand,    p.rightHand.x,    p.rightHand.y,    p.rightHand.z);
    this._applyBoneEuler(b.rightHandThumb1,  -0.25,  0.15, -0.22);
    this._applyBoneEuler(b.rightHandThumb2,  -0.20,  0,    -0.15);
    this._applyBoneEuler(b.rightHandIndex1,   0.52,  0.05, -0.10);
    this._applyBoneEuler(b.rightHandIndex2,   0.48,  0,     0);
    this._applyBoneEuler(b.rightHandMiddle1,  0.68,  0,    -0.05);
    this._applyBoneEuler(b.rightHandMiddle2,  0.55,  0,     0);
    this._applyBoneEuler(b.rightHandRing1,    0.78,  0,     0);
    this._applyBoneEuler(b.rightHandRing2,    0.60,  0,     0);
    this._applyBoneEuler(b.rightHandPinky1,   0.82,  0,     0);
    this._applyBoneEuler(b.rightHandPinky2,   0.60,  0,     0);

    // Head
    if (b.head) {
      b.head.quaternion.multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(
          p.head.x - p.examineIntensity * 0.08 + this.currentGaze.x,
          p.head.y + this.currentGaze.y,
          p.head.z))
      );
    }

    // ── Legs — smooth walking cycle ──────────────────────────────────────────
    this._updateLegs(delta);
  }

  /**
   * Smooth, natural walking cycle with IK-style knee bend.
   *
   * Uses two overlapping sine waves:
   *   • Primary hip swing (thigh forward/back)
   *   • Lagged knee flexion (knee bends as foot lifts, extends at strike)
   *   • Subtle hip rotation for weight transfer
   *   • Ankle dorsiflexion to keep foot level during swing phase
   *
   * Arms swing in opposition to legs (natural counter-rotation).
   */
  _updateLegs(delta) {
    const b  = this.bones;
    const p  = this.pose;
    const wt = this._walkTime;
    const freq  = 3.8;                  // steps per second
    const phase = wt * freq;

    // Ease amplitude in/out smoothly when walk state changes
    if (this.isWalking) {
      this._walkAmp = Math.min(1, (this._walkAmp || 0) + delta * 6);
    } else {
      this._walkAmp = Math.max(0, (this._walkAmp || 0) - delta * 5);
    }
    const amp = this._walkAmp;
    if (amp < 0.001) return;

    // Left leg — leads opposite phase to right
    const lThigh = Math.sin(phase)             * 0.48 * amp;   // thigh swing
    const lKnee  = Math.max(0, -Math.sin(phase - 0.45)) * 0.55 * amp; // knee flex
    const lAnkle = Math.sin(phase + 0.3)       * 0.18 * amp;   // ankle

    // Right leg — opposite phase
    const rThigh = Math.sin(phase + Math.PI)             * 0.48 * amp;
    const rKnee  = Math.max(0, -Math.sin(phase + Math.PI - 0.45)) * 0.55 * amp;
    const rAnkle = Math.sin(phase + Math.PI + 0.3)       * 0.18 * amp;

    // Hip rotation for natural weight transfer
    const hipRoll = Math.sin(phase) * 0.04 * amp;

    if (b.hips) {
      b.hips.quaternion.multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, hipRoll))
      );
    }

    this._applyBoneEuler(b.leftUpLeg,  lThigh + p.weightShift.lean * 0.3, 0.05,  0.08 + p.weightShift.lean * 0.15);
    this._applyBoneEuler(b.leftLeg,   -lKnee,  0, 0);
    this._applyBoneEuler(b.leftFoot,   lAnkle, 0, 0);

    this._applyBoneEuler(b.rightUpLeg, rThigh - p.weightShift.lean * 0.3, -0.05, -0.08 - p.weightShift.lean * 0.15);
    this._applyBoneEuler(b.rightLeg,  -rKnee,  0, 0);
    this._applyBoneEuler(b.rightFoot,  rAnkle, 0, 0);

    // Counter-swing arms with legs when walking (natural gait)
    const armSwing = Math.sin(phase) * 0.14 * amp;
    if (!this.isHoveringPalette && !this.isHoveringCanvas && !this.isHoveringArtist) {
      if (b.leftArm) {
        b.leftArm.quaternion.multiply(
          new THREE.Quaternion().setFromEuler(new THREE.Euler(-armSwing * 0.6, 0, 0))
        );
      }
      if (b.rightArm) {
        b.rightArm.quaternion.multiply(
          new THREE.Quaternion().setFromEuler(new THREE.Euler(armSwing * 0.6, 0, 0))
        );
      }
    }
  }

  _applyBoneEuler(bone, x, y, z) {
    if (!bone) return;
    bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)));
  }
}
