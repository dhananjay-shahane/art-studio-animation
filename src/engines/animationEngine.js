import * as THREE from 'three';
import { animate, createTimeline } from 'animejs';

/**
 * AnimationEngine — Research-based plein-air artist animation system
 *
 * Based on real artist behavior research:
 * - Plein air painters constantly shift weight, step back to examine their work
 * - They use full-arm strokes from the shoulder for expressive marks
 * - Head alternates between canvas, palette, and the subject (nature)
 * - Breathing is visible through spine and chest undulation
 * - Brush dipping is a deliberate ritual: load, twist, lift
 * - There's a rhythmic "dance" between palette, canvas, and observation
 *
 * Nature behaviors:
 * - Trees sway gently with varying frequencies (canopy > trunk)
 * - Wind gusts create momentary acceleration then slow decay
 * - Leaves rustle independently of trunk movement
 *
 * Palette behaviors:
 * - Paint wells have wet, glossy surfaces that catch light
 * - Artist tilts palette toward light to judge color
 * - Brush loading involves a circular mixing motion
 */
export class AnimationEngine {
  constructor(model, gltfAnimations = []) {
    this.model = model;
    this.gltfAnimations = gltfAnimations;
    this.bones = {};
    this.restTransforms = new Map();

    // Interactive state
    this.isHoveringPalette = false;
    this.isHoveringCanvas = false;
    this.isHoveringArtist = false;
    this.hoverCanvasUV = null;
    this.isPaused = false;
    this.time = 0;
    this.lastStrokeTime = 0;
    this.artistHoverTimeline = null;
    this.pickedColorIndex = 0;
    this.mousePointer = { x: 0, y: 0 };
    this.currentGaze = { x: 0, y: 0 };

    // Movement and canvas engagement state
    this.isWalking = false;
    this.isNearCanvas = true;
    this.armPoseWeight = 1.0; // 1.0 = holding palette & brush near easel; 0.0 = hands down while walking

    // Callbacks
    this.onBrushStroke = null;
    this.onColorPicked = null;

    // Anime.js Managed Pose State (Euler angles in radians, and offsets)
    // Based on real plein-air artist stance: slightly turned toward canvas,
    // weight on back foot, relaxed shoulders
    this.pose = {
      // Left Arm: Holds palette naturally in front between waist and easel
      leftArm: { x: 0.52, y: 0.18, z: 0.58 },
      leftForeArm: { x: 0.44, y: 0.10, z: 0.46 },
      leftHand: { x: 0.08, y: 0.04, z: 0.06 },

      // Right Arm: Active painting arm positioned forward towards canvas
      rightArm: { x: 0.72, y: -0.12, z: -0.78 },
      rightForeArm: { x: 0.48, y: -0.08, z: -0.52 },
      rightHand: { x: 0.14, y: -0.04, z: -0.10 },

      // Head: Tracks between canvas, palette, and distant nature scene
      head: { x: -0.06, y: 0.04, z: -0.02 },

      // Body & Stance: Natural weight shift and breathing
      hips: { y: 0, rx: 0.04, ry: -0.06, rz: 0.02 },
      spine: { rx: 0.08, ry: 0.04, rz: 0 },

      // Weight shift: Artist naturally rocks between feet while painting
      weightShift: { lean: 0, rock: 0 },

      // Observation pause: Artist periodically steps back mentally to examine work
      examineIntensity: 0
    };

    // Active interactive tweens
    this.activeTweens = [];

    // Painting rhythm state — real artists have natural tempo
    this.paintingPhase = 'painting'; // 'painting' | 'examining' | 'mixing' | 'observing'
    this.phaseTimer = 0;
    this.strokeCount = 0;

    this.initBones();
    this.initAnimeBreathing();
    this.initWeightShifting();
    this.initAnimePaintingTimeline();
    this.initExaminationCycle();
  }

  initBones() {
    let skinnedMesh = null;
    this.model.traverse((child) => {
      if (child.isSkinnedMesh) skinnedMesh = child;
      if (child.isBone) {
        this.bones[child.name] = child;
        this.restTransforms.set(child, {
          position: child.position.clone(),
          quaternion: child.quaternion.clone(),
          scale: child.scale.clone()
        });
      }
    });

    if (skinnedMesh && skinnedMesh.skeleton) {
      const sb = skinnedMesh.skeleton.bones;
      this.bones.hips = sb[0];
      this.bones.spine = sb[1];
      this.bones.spine1 = sb[2];
      this.bones.spine2 = sb[3];
      this.bones.neck = sb[4];
      this.bones.head = sb[5];

      this.bones.leftShoulder = sb[7];
      this.bones.leftArm = sb[8];
      this.bones.leftForeArm = sb[9];
      this.bones.leftHand = sb[10];
      this.bones.leftHandThumb1 = sb[11];
      this.bones.leftHandThumb2 = sb[12];
      this.bones.leftHandIndex1 = sb[15];
      this.bones.leftHandMiddle1 = sb[19];
      this.bones.leftHandRing1 = sb[23];
      this.bones.leftHandPinky1 = sb[27];

      this.bones.rightShoulder = sb[31];
      this.bones.rightArm = sb[32];
      this.bones.rightForeArm = sb[33];
      this.bones.rightHand = sb[34];
      this.bones.rightHandThumb1 = sb[35];
      this.bones.rightHandThumb2 = sb[36];
      this.bones.rightHandIndex1 = sb[39];
      this.bones.rightHandIndex2 = sb[40];
      this.bones.rightHandMiddle1 = sb[43];
      this.bones.rightHandMiddle2 = sb[44];
      this.bones.rightHandRing1 = sb[47];
      this.bones.rightHandRing2 = sb[48];
      this.bones.rightHandPinky1 = sb[51];
      this.bones.rightHandPinky2 = sb[52];

      this.bones.leftUpLeg = sb[55];
      this.bones.leftLeg = sb[56];
      this.bones.leftFoot = sb[57];

      this.bones.rightUpLeg = sb[60];
      this.bones.rightLeg = sb[61];
      this.bones.rightFoot = sb[62];
    } else {
      for (const [name, bone] of Object.entries(this.bones)) {
        const clean = name.replace(/[:_\s]/g, '').toLowerCase();
        if (clean === 'mixamorigleftarm') this.bones.leftArm = bone;
        else if (clean === 'mixamorigleftforearm') this.bones.leftForeArm = bone;
        else if (clean === 'mixamoriglefthand') this.bones.leftHand = bone;
        else if (clean.includes('lefthandthumb1')) this.bones.leftHandThumb1 = bone;
        else if (clean.includes('lefthandthumb2')) this.bones.leftHandThumb2 = bone;
        else if (clean.includes('lefthandindex1')) this.bones.leftHandIndex1 = bone;
        else if (clean === 'mixamorigrightarm') this.bones.rightArm = bone;
        else if (clean === 'mixamorigrightforearm') this.bones.rightForeArm = bone;
        else if (clean === 'mixamorigrighthand') this.bones.rightHand = bone;
        else if (clean.includes('righthandthumb1')) this.bones.rightHandThumb1 = bone;
        else if (clean.includes('righthandthumb2')) this.bones.rightHandThumb2 = bone;
        else if (clean.includes('righthandindex1')) this.bones.rightHandIndex1 = bone;
        else if (clean.includes('righthandindex2')) this.bones.rightHandIndex2 = bone;
        else if (clean.includes('righthandmiddle1')) this.bones.rightHandMiddle1 = bone;
        else if (clean.includes('righthandmiddle2')) this.bones.rightHandMiddle2 = bone;
        else if (clean.includes('righthandring1')) this.bones.rightHandRing1 = bone;
        else if (clean.includes('righthandpinky1')) this.bones.rightHandPinky1 = bone;
        else if (clean === 'mixamorighead') this.bones.head = bone;
        else if (clean === 'mixamorigspine') this.bones.spine = bone;
        else if (clean === 'mixamorighips') this.bones.hips = bone;
      }
    }

    console.log('AnimationEngine bones initialized:', {
      leftArm: this.bones.leftArm?.name,
      leftHand: this.bones.leftHand?.name,
      rightArm: this.bones.rightArm?.name,
      rightHand: this.bones.rightHand?.name
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. ORGANIC BREATHING — Real artists have visible chest/spine movement
  //    Breathing is slightly irregular (not perfectly periodic) for realism
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  initAnimeBreathing() {
    // Primary breath cycle — chest rises and hips settle
    animate(this.pose.hips, {
      y: [-0.014, 0.014],
      duration: 2800,
      ease: 'inOutSine',
      loop: true,
      alternate: true
    });

    // Spine follows breath — slight forward lean on exhale
    animate(this.pose.spine, {
      rx: [0.06, 0.11],
      ry: [0.03, 0.05],
      duration: 2800,
      ease: 'inOutSine',
      loop: true,
      alternate: true
    });

    // Left arm micro-sway from breathing — palette rocks subtly
    animate(this.pose.leftArm, {
      x: [0.68, 0.73],
      z: [0.83, 0.88],
      duration: 3000,
      ease: 'inOutSine',
      loop: true,
      alternate: true
    });

    animate(this.pose.leftForeArm, {
      x: [0.38, 0.43],
      z: [0.68, 0.73],
      duration: 3000,
      ease: 'inOutSine',
      loop: true,
      alternate: true
    });

    // Secondary breath detail — slight head bob (real people do this)
    animate(this.pose.head, {
      z: [-0.03, 0.01],
      duration: 2800,
      ease: 'inOutSine',
      loop: true,
      alternate: true
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. WEIGHT SHIFTING — Artists naturally rock between feet
  //    This prevents fatigue and gives a sense of life
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  initWeightShifting() {
    // Slow weight transfer between left and right foot
    animate(this.pose.weightShift, {
      lean: [-0.035, 0.035],
      duration: 4200,
      ease: 'inOutSine',
      loop: true,
      alternate: true
    });

    // Gentle forward-back rocking (artist leans in for detail, back for perspective)
    animate(this.pose.weightShift, {
      rock: [-0.02, 0.03],
      duration: 5800,
      ease: 'inOutSine',
      loop: true,
      alternate: true
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. PAINTING TIMELINE — The rhythmic "dance" of plein air painting
  //    Real artists follow a cycle:
  //    Apply strokes → Examine → Dip brush → Look at nature → Apply again
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  initAnimePaintingTimeline() {
    this.paintingTimeline = createTimeline({
      loop: true,
      autoplay: true
    });

    // Phase 1: UPWARD EXPRESSIVE STROKE — Full arm from shoulder
    // Research: "Use the whole arm for expressive large-scale work"
    this.paintingTimeline.add(this.pose.rightArm, {
      x: 0.55,
      y: -0.10,
      z: -0.96,
      duration: 900,
      ease: 'inOutQuad',
      onUpdate: () => {
        if (!this.isHoveringPalette && !this.isHoveringCanvas && !this.isHoveringArtist && this.armPoseWeight > 0.7 && this.onBrushStroke) {
          const now = performance.now();
          if (now - this.lastStrokeTime > 120) {
            this.lastStrokeTime = now;
            this.strokeCount++;
            this.onBrushStroke(0.30 + Math.random() * 0.35, 0.50 + Math.random() * 0.28);
          }
        }
      }
    }, 0);

    this.paintingTimeline.add(this.pose.rightForeArm, {
      x: 0.28,
      y: -0.12,
      z: -0.74,
      duration: 900,
      ease: 'inOutQuad'
    }, 0);

    // Head tracks the brush tip — eyes follow the mark being made
    this.paintingTimeline.add(this.pose.head, {
      x: -0.04,
      y: 0.06,
      duration: 900,
      ease: 'inOutSine'
    }, 0);

    // Phase 2: DOWNWARD SWEEPING STROKE — adding texture and depth
    // Research: "Controlled vs Expressive — thick impasto applications"
    this.paintingTimeline.add(this.pose.rightArm, {
      x: 0.70,
      y: -0.24,
      z: -0.86,
      duration: 850,
      ease: 'inOutSine',
      onUpdate: () => {
        if (!this.isHoveringPalette && !this.isHoveringCanvas && !this.isHoveringArtist && this.armPoseWeight > 0.7 && this.onBrushStroke) {
          const now = performance.now();
          if (now - this.lastStrokeTime > 120) {
            this.lastStrokeTime = now;
            this.strokeCount++;
            this.onBrushStroke(0.38 + Math.random() * 0.32, 0.32 + Math.random() * 0.35);
          }
        }
      }
    }, '+=120');

    this.paintingTimeline.add(this.pose.rightForeArm, {
      x: 0.42,
      y: -0.08,
      z: -0.58,
      duration: 850,
      ease: 'inOutSine'
    }, '-=850');

    this.paintingTimeline.add(this.pose.head, {
      x: -0.08,
      y: 0.10,
      duration: 850,
      ease: 'inOutSine'
    }, '-=850');

    // Phase 3: HORIZONTAL BLENDING STROKE — layering texture
    // Research: "dry-brush technique to smudge creating subtle gradients"
    this.paintingTimeline.add(this.pose.rightArm, {
      x: 0.62,
      y: -0.18,
      z: -0.92,
      duration: 780,
      ease: 'inOutSine',
      onUpdate: () => {
        if (!this.isHoveringPalette && !this.isHoveringCanvas && !this.isHoveringArtist && this.armPoseWeight > 0.7 && this.onBrushStroke) {
          const now = performance.now();
          if (now - this.lastStrokeTime > 140) {
            this.lastStrokeTime = now;
            this.strokeCount++;
            this.onBrushStroke(0.22 + Math.random() * 0.45, 0.42 + Math.random() * 0.30);
          }
        }
      }
    }, '+=100');

    this.paintingTimeline.add(this.pose.rightForeArm, {
      x: 0.35,
      y: -0.10,
      z: -0.66,
      duration: 780,
      ease: 'inOutSine'
    }, '-=780');

    // Phase 4: BRIEF EXAMINATION PAUSE — artist leans back to judge the work
    // Research: "stepping back frequently to view canvas from a distance"
    this.paintingTimeline.add(this.pose.rightArm, {
      x: 0.60,
      y: -0.15,
      z: -0.82,
      duration: 600,
      ease: 'outQuad'
    }, '+=180');

    this.paintingTimeline.add(this.pose.head, {
      x: -0.10,
      y: 0.02,
      z: -0.04,
      duration: 600,
      ease: 'outQuad'
    }, '-=600');

    // Spine leans back slightly — examining posture
    this.paintingTimeline.add(this.pose.spine, {
      rx: 0.04,
      ry: 0.02,
      duration: 600,
      ease: 'outQuad'
    }, '-=600');

    // Phase 5: LOOK AT NATURE — glance toward the outdoor subject
    // Research: "body orientation entirely dictated by the subject"
    this.paintingTimeline.add(this.pose.head, {
      x: -0.02,
      y: -0.18,
      z: 0.04,
      duration: 700,
      ease: 'inOutQuad'
    }, '+=300');

    this.paintingTimeline.add(this.pose.spine, {
      rx: 0.06,
      ry: -0.08,
      duration: 700,
      ease: 'inOutQuad'
    }, '-=700');

    // Return focus smoothly back to canvas for the next brush stroke cycle
    this.paintingTimeline.add(this.pose.head, {
      x: -0.06,
      y: 0.04,
      z: -0.02,
      duration: 650,
      ease: 'inOutQuad'
    }, '+=200');

    this.paintingTimeline.add(this.pose.spine, {
      rx: 0.08,
      ry: 0.04,
      rz: 0,
      duration: 650,
      ease: 'inOutQuad'
    }, '-=650');
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. PERIODIC EXAMINATION — Artist occasionally pauses to think
  //    Research: "Flow state concentration" with micro-breaks
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  initExaminationCycle() {
    // Every ~8 seconds, a brief "thinking" moment
    animate(this.pose, {
      examineIntensity: [0, 0.4, 0],
      duration: 8000,
      ease: 'inOutSine',
      loop: true
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. HOVER & PICK COLOR FROM PALETTE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  hoverPaletteColor(colorHex, colorIndex) {
    if (this.isPickingColor) return;
    if (this._activeHoverColorIdx === colorIndex) return;
    this._activeHoverColorIdx = colorIndex;

    this.isHoveringPalette = true;
    this.isHoveringCanvas = false;

    if (this.paintingTimeline) this.paintingTimeline.pause();

    // Right arm brings brush poised right above the specific paint well
    animate(this.pose.rightArm, {
      x: 0.80,
      y: -0.24,
      z: -0.62,
      duration: 260,
      ease: 'outQuad'
    });

    animate(this.pose.rightForeArm, {
      x: 0.52,
      y: -0.18,
      z: -0.42,
      duration: 260,
      ease: 'outQuad'
    });

    animate(this.pose.rightHand, {
      x: 0.22,
      y: -0.06,
      z: -0.04,
      duration: 260,
      ease: 'outQuad'
    });

    // Head attentively watches the color well
    animate(this.pose.head, {
      x: 0.28,
      y: -0.20,
      z: -0.02,
      duration: 250,
      ease: 'outQuad'
    });
  }

  // Multi-phase deliberate dipping and loading animation when a color is picked/clicked
  pickColorFromPalette(colorHex, colorIndex) {
    if (this.isPickingColor) return;
    this.isPickingColor = true;
    this.isHoveringPalette = true;
    this.isHoveringCanvas = false;

    if (this.paintingTimeline) this.paintingTimeline.pause();

    // Phase 1: Brush tip dips down into the chosen oil paint mound
    animate(this.pose.rightArm, {
      x: 0.90,
      y: -0.30,
      z: -0.58,
      duration: 240,
      ease: 'outQuad'
    });

    animate(this.pose.rightForeArm, {
      x: 0.56,
      y: -0.22,
      z: -0.38,
      duration: 240,
      ease: 'outQuad'
    });

    animate(this.pose.rightHand, {
      x: 0.38,
      y: -0.08,
      z: 0.08,
      duration: 240,
      ease: 'outQuad'
    });

    animate(this.pose.head, {
      x: 0.32,
      y: -0.22,
      z: -0.02,
      duration: 240,
      ease: 'outQuad'
    });

    // Phase 2: Loading twist/swirl motion in the paint mound
    setTimeout(() => {
      if (this.onColorPicked) {
        this.onColorPicked(colorHex, colorIndex);
      }

      animate(this.pose.rightHand, {
        x: [0.38, 0.44, 0.34, 0.38],
        z: [0.08, 0.02, 0.06, 0.08],
        duration: 280,
        ease: 'inOutSine'
      });

      // Phase 3: Lift loaded brush up triumphantly toward canvas
      setTimeout(() => {
        animate(this.pose.rightArm, {
          x: 0.68,
          y: -0.14,
          z: -0.84,
          duration: 380,
          ease: 'outBack'
        });

        animate(this.pose.rightForeArm, {
          x: 0.44,
          y: -0.08,
          z: -0.54,
          duration: 380,
          ease: 'outBack'
        });

        animate(this.pose.rightHand, {
          x: 0.14,
          y: -0.04,
          z: -0.10,
          duration: 380,
          ease: 'outQuad'
        });

        animate(this.pose.head, {
          x: -0.06,
          y: 0.04,
          z: -0.02,
          duration: 380,
          ease: 'outQuad'
        });

        // Phase 4: Resume painting with newly loaded color
        setTimeout(() => {
          this.isPickingColor = false;
          this.isHoveringPalette = false;
          this._activeHoverColorIdx = -1;

          // Make immediate fresh paint stroke on the working area of the canvas
          if (this.onBrushStroke && this.armPoseWeight > 0.6) {
            this.onBrushStroke(0.32 + Math.random() * 0.36, 0.52 + Math.random() * 0.28);
          }

          if (this.paintingTimeline) {
            this.paintingTimeline.play();
          }
        }, 380);
      }, 280);
    }, 240);
  }

  hoverPalette() {
    if (this.isPickingColor) return;
    if (this.isHoveringPalette) return;
    this.isHoveringPalette = true;
    this.isHoveringArtist = false;
    this.isHoveringCanvas = false;
    if (this.paintingTimeline) this.paintingTimeline.pause();

    // Left arm smoothly presents palette forward towards viewer/easel
    animate(this.pose.leftArm, {
      x: 0.58,
      y: 0.22,
      z: 0.50,
      duration: 350,
      ease: 'outQuad'
    });
    animate(this.pose.leftForeArm, {
      x: 0.48,
      y: 0.14,
      z: 0.40,
      duration: 350,
      ease: 'outQuad'
    });

    // Right arm hovers brush poised above paint wells
    animate(this.pose.rightArm, {
      x: 0.78,
      y: -0.22,
      z: -0.60,
      duration: 340,
      ease: 'outQuad'
    });
    animate(this.pose.rightForeArm, {
      x: 0.50,
      y: -0.16,
      z: -0.42,
      duration: 340,
      ease: 'outQuad'
    });
    animate(this.pose.rightHand, {
      x: 0.20,
      y: -0.06,
      z: -0.08,
      duration: 340,
      ease: 'outQuad'
    });

    // Head glances down — concentrating on color selection
    animate(this.pose.head, {
      x: 0.26,
      y: -0.18,
      z: -0.03,
      duration: 320,
      ease: 'outQuad'
    });

    // Body leans slightly forward
    animate(this.pose.spine, {
      rx: 0.10,
      ry: 0.04,
      duration: 350,
      ease: 'outQuad'
    });
  }

  clearPaletteHover() {
    if (this.isPickingColor) return;
    if (!this.isHoveringPalette) return;
    this.isHoveringPalette = false;
    this._activeHoverColorIdx = -1;

    // Smoothly restore left arm to natural forward holding position
    animate(this.pose.leftArm, {
      x: 0.52,
      y: 0.18,
      z: 0.58,
      duration: 400,
      ease: 'outQuad'
    });
    animate(this.pose.leftForeArm, {
      x: 0.44,
      y: 0.10,
      z: 0.46,
      duration: 400,
      ease: 'outQuad'
    });

    // Right arm returns to active painting stance
    animate(this.pose.rightArm, {
      x: 0.72,
      y: -0.12,
      z: -0.78,
      duration: 400,
      ease: 'outQuad'
    });
    animate(this.pose.rightForeArm, {
      x: 0.48,
      y: -0.08,
      z: -0.52,
      duration: 400,
      ease: 'outQuad'
    });
    animate(this.pose.rightHand, {
      x: 0.14,
      y: -0.04,
      z: -0.10,
      duration: 400,
      ease: 'outQuad'
    });

    // Head and spine return to canvas focus
    animate(this.pose.head, {
      x: -0.06,
      y: 0.04,
      z: -0.02,
      duration: 400,
      ease: 'outQuad'
    });
    animate(this.pose.spine, {
      rx: 0.08,
      ry: 0.04,
      duration: 400,
      ease: 'outQuad'
    });

    if (this.paintingTimeline) {
      this.paintingTimeline.play();
    }
  }

  setMousePointer(normX, normY) {
    this.mousePointer.x = normX;
    this.mousePointer.y = normY;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 6. HOVER ARTIST — Full "dip and paint" interactive sequence
  //    The artist picks color from palette.glb and paints on canvas
  //    Research: "rhythmic dance between palette, canvas, observation"
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  hoverArtist() {
    if (this.isHoveringArtist) return;
    this.isHoveringArtist = true;
    this.isHoveringPalette = false;
    this.isHoveringCanvas = false;

    if (this.paintingTimeline) this.paintingTimeline.pause();
    if (this.artistHoverTimeline) this.artistHoverTimeline.pause();

    this.playArtistDipAndPaintSequence();
  }

  /**
   * The complete "dip & paint" ritual:
   * 1. Look down at palette (palette.glb) — selecting color
   * 2. Lift palette with left hand toward light
   * 3. Dip brush into paint well — circular loading motion
   * 4. Color pick callback fires — updates brush tip & painting engine
   * 5. Look up at canvas — planning the stroke
   * 6. Three expressive painting strokes with full arm from shoulder
   * 7. Brief examination pause — lean back to judge the work
   * 8. Loop back to step 1 with next color
   */
  playArtistDipAndPaintSequence() {
    if (!this.isHoveringArtist) return;

    // Cycle through the oil palette colors from palette.glb
    const colors = [
      { hex: '#ef4444', label: 'Crimson Red' },
      { hex: '#f97316', label: 'Sunset Orange' },
      { hex: '#facc15', label: 'Cadmium Yellow' },
      { hex: '#10b981', label: 'Emerald Green' },
      { hex: '#3b82f6', label: 'Cobalt Blue' },
      { hex: '#8b5cf6', label: 'Purple Violet' }
    ];
    this.pickedColorIndex = (this.pickedColorIndex + 1) % colors.length;
    const picked = colors[this.pickedColorIndex];

    this.artistHoverTimeline = createTimeline({
      loop: false,
      onComplete: () => {
        // Continue the creative loop seamlessly while hovered
        if (this.isHoveringArtist) {
          this.playArtistDipAndPaintSequence();
        }
      }
    });

    // ── Step 1: INTENTION — Turn gaze toward palette, planning color choice ──
    this.artistHoverTimeline.add(this.pose.head, {
      x: 0.34,
      y: -0.26,
      z: -0.05,
      duration: 420,
      ease: 'inOutQuad'
    }, 0);

    // Spine leans forward — reaching toward palette
    this.artistHoverTimeline.add(this.pose.spine, {
      rx: 0.12,
      ry: 0.06,
      duration: 420,
      ease: 'outQuad'
    }, 0);

    // Left arm lifts palette slightly — presenting colors
    this.artistHoverTimeline.add(this.pose.leftArm, {
      x: 0.84,
      y: 0.24,
      z: 0.72,
      duration: 420,
      ease: 'outQuad'
    }, 0);

    this.artistHoverTimeline.add(this.pose.leftForeArm, {
      x: 0.50,
      y: 0.20,
      z: 0.60,
      duration: 420,
      ease: 'outQuad'
    }, 0);

    // Right arm reaches toward palette
    this.artistHoverTimeline.add(this.pose.rightArm, {
      x: 0.88,
      y: -0.34,
      z: -0.64,
      duration: 420,
      ease: 'inOutQuad'
    }, 0);

    this.artistHoverTimeline.add(this.pose.rightForeArm, {
      x: 0.54,
      y: -0.26,
      z: -0.44,
      duration: 420,
      ease: 'inOutQuad'
    }, 0);

    // ── Step 2: DIP — Circular brush loading motion into paint well ──
    // Research: "gently load by pulling through pigment" with circular motion
    this.artistHoverTimeline.add(this.pose.rightHand, {
      x: [0.10, 0.26, 0.18, 0.26, 0.10],
      y: [-0.05, -0.14, -0.08, -0.12, -0.05],
      duration: 600,
      ease: 'inOutSine',
      onComplete: () => {
        // Fire color pick — updates brush tip color and painting engine
        if (this.onColorPicked) {
          this.onColorPicked(picked.hex, this.pickedColorIndex);
        }
      }
    }, '+=50');

    // ── Step 3: LIFT — Raise loaded brush, turn gaze to canvas ──
    // Research: "decisive, purposeful gestures"
    this.artistHoverTimeline.add(this.pose.head, {
      x: -0.05,
      y: 0.08,
      z: 0.0,
      duration: 480,
      ease: 'inOutQuad'
    }, '+=80');

    // Return left arm to normal holding position
    this.artistHoverTimeline.add(this.pose.leftArm, {
      x: 0.70,
      y: 0.15,
      z: 0.85,
      duration: 480,
      ease: 'outQuad'
    }, '-=480');

    this.artistHoverTimeline.add(this.pose.leftForeArm, {
      x: 0.40,
      y: 0.15,
      z: 0.70,
      duration: 480,
      ease: 'outQuad'
    }, '-=480');

    // Right arm lifts to canvas height — ready to paint
    this.artistHoverTimeline.add(this.pose.rightArm, {
      x: 0.60,
      y: -0.14,
      z: -0.95,
      duration: 480,
      ease: 'inOutQuad'
    }, '-=480');

    this.artistHoverTimeline.add(this.pose.rightForeArm, {
      x: 0.30,
      y: -0.12,
      z: -0.72,
      duration: 480,
      ease: 'inOutQuad'
    }, '-=480');

    // Spine straightens — upright painting posture
    this.artistHoverTimeline.add(this.pose.spine, {
      rx: 0.08,
      ry: 0.04,
      duration: 480,
      ease: 'outQuad'
    }, '-=480');

    // ── Step 4: PAINT STROKE 1 — Bold sweeping diagonal stroke across canvas ──
    const s1_startX = 0.22 + Math.random() * 0.24;
    const s1_startY = 0.55 + Math.random() * 0.20;
    const s1_endX = s1_startX + 0.16 + Math.random() * 0.16;
    const s1_endY = s1_startY - 0.20 - Math.random() * 0.15;
    let lastT1 = 0;
    let s1_startTime = 0;

    this.artistHoverTimeline.add(this.pose.rightArm, {
      x: 0.52,
      y: -0.08,
      z: -0.98,
      duration: 440,
      ease: 'inOutSine',
      onBegin: () => { s1_startTime = performance.now(); },
      onUpdate: () => {
        const now = performance.now();
        if (this.onBrushStroke && now - lastT1 > 40) {
          lastT1 = now;
          const p = Math.min(1, (now - s1_startTime) / 440);
          this.onBrushStroke(
            s1_startX + (s1_endX - s1_startX) * p,
            s1_startY + (s1_endY - s1_startY) * p
          );
        }
      }
    }, '+=50');

    this.artistHoverTimeline.add(this.pose.rightForeArm, {
      x: 0.26,
      y: -0.14,
      z: -0.76,
      duration: 440,
      ease: 'inOutSine'
    }, '-=440');

    // ── Step 5: PAINT STROKE 2 — Expressive cross-contour stroke ──
    const s2_startX = s1_endX + (Math.random() - 0.5) * 0.08;
    const s2_startY = s1_endY + (Math.random() - 0.5) * 0.08;
    const s2_endX = Math.max(0.18, Math.min(0.82, s2_startX - 0.22 - Math.random() * 0.14));
    const s2_endY = Math.max(0.18, Math.min(0.82, s2_startY + 0.16 + Math.random() * 0.12));
    let lastT2 = 0;
    let s2_startTime = 0;

    this.artistHoverTimeline.add(this.pose.rightArm, {
      x: 0.68,
      y: -0.24,
      z: -0.86,
      duration: 440,
      ease: 'inOutSine',
      onBegin: () => { s2_startTime = performance.now(); },
      onUpdate: () => {
        const now = performance.now();
        if (this.onBrushStroke && now - lastT2 > 40) {
          lastT2 = now;
          const p = Math.min(1, (now - s2_startTime) / 440);
          this.onBrushStroke(
            s2_startX + (s2_endX - s2_startX) * p,
            s2_startY + (s2_endY - s2_startY) * p
          );
        }
      }
    }, '+=50');

    this.artistHoverTimeline.add(this.pose.rightForeArm, {
      x: 0.44,
      y: -0.06,
      z: -0.56,
      duration: 440,
      ease: 'inOutSine'
    }, '-=440');

    // Head tracks the stroke movement
    this.artistHoverTimeline.add(this.pose.head, {
      x: -0.08,
      y: 0.12,
      duration: 440,
      ease: 'inOutSine'
    }, '-=440');

    // ── Step 6: PAINT STROKE 3 — Delicate textural flick & flourish ──
    const s3_startX = 0.32 + Math.random() * 0.32;
    const s3_startY = 0.38 + Math.random() * 0.28;
    const s3_endX = s3_startX + (Math.random() - 0.5) * 0.18;
    const s3_endY = s3_startY + 0.08 + Math.random() * 0.10;
    let lastT3 = 0;
    let s3_startTime = 0;

    this.artistHoverTimeline.add(this.pose.rightArm, {
      x: 0.58,
      y: -0.16,
      z: -0.92,
      duration: 380,
      ease: 'inOutSine',
      onBegin: () => { s3_startTime = performance.now(); },
      onUpdate: () => {
        const now = performance.now();
        if (this.onBrushStroke && now - lastT3 > 40) {
          lastT3 = now;
          const p = Math.min(1, (now - s3_startTime) / 380);
          this.onBrushStroke(
            s3_startX + (s3_endX - s3_startX) * p,
            s3_startY + (s3_endY - s3_startY) * p
          );
        }
      }
    }, '+=50');

    this.artistHoverTimeline.add(this.pose.rightForeArm, {
      x: 0.34,
      y: -0.10,
      z: -0.66,
      duration: 380,
      ease: 'inOutSine'
    }, '-=380');

    // Wrist flick detail
    this.artistHoverTimeline.add(this.pose.rightHand, {
      x: [0.10, 0.18, 0.10],
      z: [-0.15, -0.25, -0.15],
      duration: 380,
      ease: 'inOutSine'
    }, '-=380');

    // ── Step 7: EXAMINATION PAUSE — Step back mentally to judge ──
    // Research: "stepping back to view canvas from distance, then rushing forward"
    this.artistHoverTimeline.add(this.pose.rightArm, {
      x: 0.62,
      y: -0.15,
      z: -0.84,
      duration: 500,
      ease: 'outQuad'
    }, '+=80');

    this.artistHoverTimeline.add(this.pose.head, {
      x: -0.12,
      y: 0.02,
      z: -0.04,
      duration: 500,
      ease: 'outQuad'
    }, '-=500');

    // Lean back to examine
    this.artistHoverTimeline.add(this.pose.spine, {
      rx: 0.04,
      ry: 0.02,
      duration: 500,
      ease: 'outQuad'
    }, '-=500');

    // ── Step 8: GLANCE AT NATURE — Compare subject to painting ──
    // Research: "constant environmental engagement, eyes scanning the scene"
    this.artistHoverTimeline.add(this.pose.head, {
      x: -0.02,
      y: -0.16,
      z: 0.06,
      duration: 550,
      ease: 'inOutQuad'
    }, '+=250');

    this.artistHoverTimeline.add(this.pose.spine, {
      rx: 0.07,
      ry: -0.06,
      duration: 550,
      ease: 'inOutQuad'
    }, '-=550');

    // ── Step 9: RETURN TO READY — prepare for next color dip ──
    this.artistHoverTimeline.add(this.pose.head, {
      x: -0.06,
      y: 0.04,
      z: -0.02,
      duration: 400,
      ease: 'outQuad'
    }, '+=200');

    this.artistHoverTimeline.add(this.pose.spine, {
      rx: 0.08,
      ry: 0.04,
      rz: 0,
      duration: 400,
      ease: 'outQuad'
    }, '-=400');

    this.artistHoverTimeline.add(this.pose.rightArm, {
      x: 0.65,
      y: -0.15,
      z: -0.90,
      duration: 400,
      ease: 'outQuad'
    }, '-=400');

    this.artistHoverTimeline.add(this.pose.rightForeArm, {
      x: 0.35,
      y: -0.10,
      z: -0.65,
      duration: 400,
      ease: 'outQuad'
    }, '-=400');
  }

  clearArtistHover() {
    if (!this.isHoveringArtist) return;
    this.isHoveringArtist = false;
    if (this.artistHoverTimeline) {
      this.artistHoverTimeline.pause();
      this.artistHoverTimeline = null;
    }

    // Smoothly return all body parts to natural painting stance
    animate(this.pose.rightArm, {
      x: 0.65,
      y: -0.15,
      z: -0.90,
      duration: 500,
      ease: 'outQuad'
    });

    animate(this.pose.rightForeArm, {
      x: 0.35,
      y: -0.10,
      z: -0.65,
      duration: 500,
      ease: 'outQuad'
    });

    animate(this.pose.rightHand, {
      x: 0.10,
      y: -0.05,
      z: -0.15,
      duration: 500,
      ease: 'outQuad'
    });

    animate(this.pose.head, {
      x: -0.06,
      y: 0.04,
      z: -0.02,
      duration: 500,
      ease: 'outQuad'
    });

    animate(this.pose.leftArm, {
      x: 0.70,
      y: 0.15,
      z: 0.85,
      duration: 500,
      ease: 'outQuad'
    });

    animate(this.pose.leftForeArm, {
      x: 0.40,
      y: 0.15,
      z: 0.70,
      duration: 500,
      ease: 'outQuad'
    });

    animate(this.pose.spine, {
      rx: 0.08,
      ry: 0.04,
      rz: 0,
      duration: 500,
      ease: 'outQuad',
      onComplete: () => {
        if (!this.isHoveringArtist && !this.isHoveringPalette && !this.isHoveringCanvas && this.paintingTimeline) {
          this.paintingTimeline.play();
        }
      }
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 7. HOVER CANVAS — Direct interactive painting following cursor
  //    Research: "engaged entire arm from the shoulder"
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  hoverCanvas(u, v) {
    this.isHoveringCanvas = true;
    this.isHoveringPalette = false;
    this.hoverCanvasUV = { u, v };

    if (this.paintingTimeline) this.paintingTimeline.pause();

    // Dynamic arm reaching based on cursor UV position on canvas
    const armPitch = 0.50 + (1.0 - v) * 0.32;
    const armYaw = -0.24 + (u - 0.5) * 0.24;
    const armRoll = -0.84 - (1.0 - u) * 0.22;

    animate(this.pose.rightArm, {
      x: armPitch,
      y: armYaw,
      z: armRoll,
      duration: 100,
      ease: 'outQuad'
    });

    animate(this.pose.rightForeArm, {
      x: 0.24 + (1.0 - v) * 0.20,
      z: -0.58 - v * 0.26,
      duration: 100,
      ease: 'outQuad'
    });

    // Head precisely tracks the brush tip
    animate(this.pose.head, {
      x: -0.05 + (v - 0.5) * 0.22,
      y: 0.06 + (u - 0.5) * 0.24,
      duration: 140,
      ease: 'outQuad'
    });

    // Real-time painting on canvas
    const now = performance.now();
    if (now - this.lastStrokeTime > 45) {
      this.lastStrokeTime = now;
      if (this.onBrushStroke) {
        this.onBrushStroke(u, v);
      }
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 8. CLEAR HOVER — Return to natural painting flow
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  clearHover() {
    if (!this.isHoveringPalette && !this.isHoveringCanvas) return;
    this.isHoveringPalette = false;
    this.isHoveringCanvas = false;

    animate(this.pose.rightArm, {
      x: 0.65,
      y: -0.15,
      z: -0.90,
      duration: 500,
      ease: 'outQuad'
    });

    animate(this.pose.rightForeArm, {
      x: 0.35,
      y: -0.10,
      z: -0.65,
      duration: 500,
      ease: 'outQuad'
    });

    animate(this.pose.head, {
      x: -0.06,
      y: 0.04,
      duration: 500,
      ease: 'outQuad',
      onComplete: () => {
        if (!this.isHoveringPalette && !this.isHoveringCanvas && !this.isHoveringArtist && this.paintingTimeline) {
          this.paintingTimeline.play();
        }
      }
    });
  }

  resetAllBones() {
    for (const [bone, rest] of this.restTransforms.entries()) {
      bone.position.copy(rest.position);
      bone.quaternion.copy(rest.quaternion);
      bone.scale.copy(rest.scale);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 9. FRAME UPDATE — Apply all pose states to skeleton
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  update(delta) {
    if (this.isPaused) return;

    const b = this.bones;
    const p = this.pose;

    // Accumulate walk time
    this._walkTime = (this._walkTime || 0) + delta;
    // Track whether model is moving (set externally by main.js)
    const isWalking = this.isWalking || false;

    this.resetAllBones();

    // Smooth interactive gaze tracking towards cursor
    if (this.isHoveringArtist) {
      const targetGazeX = -this.mousePointer.y * 0.08;
      const targetGazeY = this.mousePointer.x * 0.10;
      this.currentGaze.x += (targetGazeX - this.currentGaze.x) * 0.12;
      this.currentGaze.y += (targetGazeY - this.currentGaze.y) * 0.12;
    } else {
      this.currentGaze.x += (0 - this.currentGaze.x) * 0.06;
      this.currentGaze.y += (0 - this.currentGaze.y) * 0.06;
    }

    // 1. Hips: Breathing + Weight Shifting between feet
    if (b.hips) {
      const rest = this.restTransforms.get(b.hips);
      b.hips.position.y = rest.position.y + p.hips.y;
      b.hips.quaternion.multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(
          p.hips.rx + p.weightShift.rock,
          p.hips.ry,
          p.hips.rz + p.weightShift.lean
        ))
      );
    }

    // 2. Spine: Breathing + examination lean-back
    if (b.spine) {
      b.spine.quaternion.multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(
          p.spine.rx - p.examineIntensity * 0.06,
          p.spine.ry,
          p.spine.rz
        ))
      );
    }

    // Smooth arm pose weighting: when walking or away from canvas, hands down; near canvas, hands up holding tools
    const targetArmWeight = (isWalking || !this.isNearCanvas) ? 0.0 : 1.0;
    this.armPoseWeight = THREE.MathUtils.damp(this.armPoseWeight, targetArmWeight, 4.5, delta);
    const w = this.armPoseWeight;

    // Walking arm swing frequency & amplitude
    const walkCycle = Math.sin(this._walkTime * 6.0);
    const walkAmp = isWalking ? 0.45 : 0;

    // 3. Left Arm: Holds palette securely at waist when near canvas; hands down naturally by hip when moving
    const lArmDownX = 0.05 - walkAmp * walkCycle * 0.35;
    const lArmDownY = 0.05;
    const lArmDownZ = 1.32;
    const lForeDownX = 0.22;
    const lForeDownY = 0.08;
    const lForeDownZ = 0.10;
    const lHandDownX = 0.05;

    const curLArmX = THREE.MathUtils.lerp(lArmDownX, p.leftArm.x, w);
    const curLArmY = THREE.MathUtils.lerp(lArmDownY, p.leftArm.y, w);
    const curLArmZ = THREE.MathUtils.lerp(lArmDownZ, p.leftArm.z, w);

    const curLForeX = THREE.MathUtils.lerp(lForeDownX, p.leftForeArm.x, w);
    const curLForeY = THREE.MathUtils.lerp(lForeDownY, p.leftForeArm.y, w);
    const curLForeZ = THREE.MathUtils.lerp(lForeDownZ, p.leftForeArm.z, w);

    const curLHandX = THREE.MathUtils.lerp(lHandDownX, p.leftHand.x, w);

    if (b.leftArm) {
      b.leftArm.quaternion.multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(curLArmX, curLArmY, curLArmZ))
      );
    }
    if (b.leftForeArm) {
      b.leftForeArm.quaternion.multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(curLForeX, curLForeY, curLForeZ))
      );
    }
    if (b.leftHand) {
      b.leftHand.quaternion.multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(curLHandX, p.leftHand.y * w, p.leftHand.z * w))
      );
    }
    // Curled fingers — thumb through thumbhole, fingers gripping palette rim
    if (b.leftHandThumb1) {
      b.leftHandThumb1.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.22, 0.14, 0.28)));
    }
    if (b.leftHandThumb2) {
      b.leftHandThumb2.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18, 0, 0.15)));
    }
    if (b.leftHandIndex1) {
      b.leftHandIndex1.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.52, 0, 0.30)));
    }
    if (b.leftHandMiddle1) {
      b.leftHandMiddle1.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.58, 0, 0.30)));
    }
    if (b.leftHandRing1) {
      b.leftHandRing1.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.58, 0, 0.30)));
    }
    if (b.leftHandPinky1) {
      b.leftHandPinky1.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.58, 0, 0.30)));
    }

    // 4. Right Arm: Holds brush downwards at side when moving, actively paints from shoulder when near canvas
    const rArmDownX = -0.05 + walkAmp * walkCycle * 0.35;
    const rArmDownY = -0.05;
    const rArmDownZ = -1.32;
    const rForeDownX = 0.22;
    const rForeDownY = -0.08;
    const rForeDownZ = -0.10;
    const rHandDownX = 0.05;

    const curRArmX = THREE.MathUtils.lerp(rArmDownX, p.rightArm.x, w);
    const curRArmY = THREE.MathUtils.lerp(rArmDownY, p.rightArm.y, w);
    const curRArmZ = THREE.MathUtils.lerp(rArmDownZ, p.rightArm.z, w);

    const curRForeX = THREE.MathUtils.lerp(rForeDownX, p.rightForeArm.x, w);
    const curRForeY = THREE.MathUtils.lerp(rForeDownY, p.rightForeArm.y, w);
    const curRForeZ = THREE.MathUtils.lerp(rForeDownZ, p.rightForeArm.z, w);

    const curRHandX = THREE.MathUtils.lerp(rHandDownX, p.rightHand.x, w);

    if (b.rightArm) {
      b.rightArm.quaternion.multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(curRArmX, curRArmY, curRArmZ))
      );
    }
    if (b.rightForeArm) {
      b.rightForeArm.quaternion.multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(curRForeX, curRForeY, curRForeZ))
      );
    }
    if (b.rightHand) {
      b.rightHand.quaternion.multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(curRHandX, p.rightHand.y * w, p.rightHand.z * w))
      );
    }

    // Natural precision grip on paintbrush handle
    if (b.rightHandThumb1) {
      b.rightHandThumb1.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.25, 0.15, -0.22)));
    }
    if (b.rightHandThumb2) {
      b.rightHandThumb2.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.20, 0, -0.15)));
    }
    if (b.rightHandIndex1) {
      b.rightHandIndex1.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.52, 0.05, -0.10)));
    }
    if (b.rightHandIndex2) {
      b.rightHandIndex2.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.48, 0, 0)));
    }
    if (b.rightHandMiddle1) {
      b.rightHandMiddle1.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.68, 0, -0.05)));
    }
    if (b.rightHandMiddle2) {
      b.rightHandMiddle2.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.55, 0, 0)));
    }
    if (b.rightHandRing1) {
      b.rightHandRing1.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.78, 0, 0)));
    }
    if (b.rightHandRing2) {
      b.rightHandRing2.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.60, 0, 0)));
    }
    if (b.rightHandPinky1) {
      b.rightHandPinky1.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.82, 0, 0)));
    }
    if (b.rightHandPinky2) {
      b.rightHandPinky2.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.60, 0, 0)));
    }

    // 5. Head: Tracks canvas/palette/nature with examination lean + interactive gaze
    if (b.head) {
      b.head.quaternion.multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(
          p.head.x - p.examineIntensity * 0.08 + this.currentGaze.x,
          p.head.y + this.currentGaze.y,
          p.head.z
        ))
      );
    }

    // 6. Legs: Walking animation when moving, natural stance when idle
    const kneeBend  = isWalking ? 0.30 : 0;

    if (b.leftUpLeg) {
      b.leftUpLeg.quaternion.multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(
          (-0.06 + walkAmp * walkCycle)  + p.weightShift.lean * 0.3,
          0.05,
          0.08 + p.weightShift.lean * 0.15
        ))
      );
    }
    if (b.leftLeg) {
      // Knee bends on the recovery phase (when thigh swings forward)
      const leftKnee = kneeBend * Math.max(0, -walkCycle);
      b.leftLeg.quaternion.multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(leftKnee, 0, 0))
      );
    }
    if (b.leftFoot) {
      const leftAnkle = isWalking ? walkAmp * 0.20 * -walkCycle : 0;
      b.leftFoot.quaternion.multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(leftAnkle, 0, 0))
      );
    }
    if (b.rightUpLeg) {
      b.rightUpLeg.quaternion.multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(
          (0.08 - walkAmp * walkCycle) - p.weightShift.lean * 0.3,
          -0.05,
          -0.08 - p.weightShift.lean * 0.15
        ))
      );
    }
    if (b.rightLeg) {
      const rightKnee = kneeBend * Math.max(0, walkCycle);
      b.rightLeg.quaternion.multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rightKnee, 0, 0))
      );
    }
    if (b.rightFoot) {
      const rightAnkle = isWalking ? walkAmp * 0.20 * walkCycle : 0;
      b.rightFoot.quaternion.multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rightAnkle, 0, 0))
      );
    }
  }
}
