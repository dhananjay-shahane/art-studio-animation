import * as THREE from 'three';

export class PaintingEngine {
  constructor(canvasMesh) {
    this.canvasMesh = canvasMesh;
    this.width = 1024;
    this.height = 614;

    // Create offscreen 2D canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d');

    // Create Three.js dynamic texture
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.flipY = false;

    // Apply to 3D canvas material
    if (this.canvasMesh && this.canvasMesh.material) {
      this.canvasMesh.material.map = this.texture;
      this.canvasMesh.material.needsUpdate = true;
    }

    // Palette colors (matching palette.glb)
    this.colors = [
      '#ef4444', // Crimson Red
      '#f97316', // Sunset Orange
      '#facc15', // Cadmium Yellow
      '#10b981', // Emerald Green
      '#3b82f6', // Cobalt Blue
      '#8b5cf6', // Purple Violet
      '#f8fafc'  // Titanium White
    ];
    this.currentColorIndex = 4; // Start with Cobalt Blue
    this.brushSize = 22;

    // Load reference painting for progressive painting reveal
    this.referenceImg = new Image();
    this.referenceImg.src = './original_painting.png';
    this.referenceImgLoaded = false;

    const onImgLoaded = () => {
      this.referenceImgLoaded = true;
      this.initCanvas();
    };

    if (this.referenceImg.complete && this.referenceImg.naturalWidth > 0) {
      this.referenceImgLoaded = true;
    } else {
      this.referenceImg.onload = onImgLoaded;
    }

    this.paintedStrokesCount = 0;
    // isRevealing = true → brush strokes progressively reveal the nature reference painting
    this.isRevealing = true;
    this.strokeAngle = 0;

    // Initialise canvas immediately
    this.initCanvas();
  }

  initCanvas() {
    // Fill canvas with primed artist linen texture
    this.ctx.fillStyle = '#f4ede2';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Subtle canvas weave texture
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
    for (let x = 0; x < this.width; x += 4) {
      this.ctx.fillRect(x, 0, 1.5, this.height);
    }
    for (let y = 0; y < this.height; y += 4) {
      this.ctx.fillRect(0, y, this.width, 1.5);
    }

    // Faint artistic pencil sketch layout for the remaining unpainted half
    this.ctx.strokeStyle = 'rgba(120, 110, 100, 0.28)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    // Horizon and mountain lines
    this.ctx.moveTo(0, this.height * 0.6);
    this.ctx.bezierCurveTo(this.width * 0.3, this.height * 0.45, this.width * 0.7, this.height * 0.65, this.width, this.height * 0.55);
    this.ctx.stroke();

    // Immediate painterly landscape baseline (sky & mountains) so canvas is never blank
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, this.height * 0.52);
    skyGrad.addColorStop(0, '#5b9bd5');
    skyGrad.addColorStop(0.6, '#a8d5e5');
    skyGrad.addColorStop(1, '#fde2b8');
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, this.width, this.height * 0.52);

    // Distant mountain silhouette baseline
    this.ctx.fillStyle = '#6a8276';
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.height * 0.42);
    this.ctx.lineTo(this.width * 0.25, this.height * 0.28);
    this.ctx.lineTo(this.width * 0.52, this.height * 0.38);
    this.ctx.lineTo(this.width * 0.78, this.height * 0.24);
    this.ctx.lineTo(this.width, this.height * 0.36);
    this.ctx.lineTo(this.width, this.height * 0.52);
    this.ctx.lineTo(0, this.height * 0.52);
    this.ctx.closePath();
    this.ctx.fill();

    // 50% of the painting already drawn with authentic painterly brushwork
    if (this.referenceImgLoaded) {
      this.ctx.save();
      this.ctx.beginPath();
      // Artistic organic boundary across upper ~50% of canvas
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(this.width, 0);
      this.ctx.lineTo(this.width, this.height * 0.54);

      const steps = 36;
      for (let i = steps; i >= 0; i--) {
        const px = (i / steps) * this.width;
        const wave = Math.sin(i * 0.75) * 26 + Math.cos(i * 1.4) * 18;
        const py = this.height * 0.50 + wave;
        this.ctx.lineTo(px, py);
      }
      this.ctx.closePath();
      this.ctx.clip();
      this.ctx.drawImage(this.referenceImg, 0, 0, this.width, this.height);
      this.ctx.restore();

      // Expressive impasto brush marks along the working edge showing active progress
      for (let x = 12; x < this.width - 12; x += 22) {
        const wave = Math.sin((x / this.width) * 16) * 24 + Math.cos((x / this.width) * 34) * 16;
        const y = this.height * 0.50 + wave;
        this.paintAt(x / this.width, y / this.height, 24 + Math.random() * 14);
      }
    }

    this.texture.needsUpdate = true;
  }

  getCurrentColor() {
    return this.customColor || this.colors[this.currentColorIndex];
  }

  setColor(index) {
    if (index >= 0 && index < this.colors.length) {
      this.currentColorIndex = index;
      this.customColor = this.colors[index];
    }
  }

  setColorHex(hex) {
    this.customColor = hex;
  }

  // Draw an authentic artistic paint stroke
  paintAt(normX, normY, size = this.brushSize, color = this.getCurrentColor()) {
    const x = Math.max(0, Math.min(this.width, normX * this.width));
    const y = Math.max(0, Math.min(this.height, normY * this.height));

    this.ctx.save();
    this.strokeAngle += (Math.random() - 0.5) * 0.6;

    if (this.referenceImgLoaded && this.isRevealing) {
      // Reveal authentic colored section from the high-res painting with expressive brush bristles
      this.ctx.save();
      this.ctx.beginPath();
      const r = size * (0.8 + Math.random() * 0.5);
      this.ctx.ellipse(x, y, r, r * 0.45, this.strokeAngle, 0, Math.PI * 2);
      this.ctx.clip();
      this.ctx.drawImage(this.referenceImg, 0, 0, this.width, this.height);
      this.ctx.restore();

      // Pigment glaze tint from the picked color
      this.ctx.fillStyle = color;
      this.ctx.globalAlpha = 0.28;
      this.ctx.beginPath();
      this.ctx.ellipse(x, y, r, r * 0.45, this.strokeAngle, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1.0;

      // Add a slight impasto acrylic edge highlight
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(x, y - 2, size * 0.3, 0, Math.PI);
      this.ctx.stroke();
    } else {
      // Dynamic paint stroke with bristles
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.ellipse(x, y, size, size * 0.5, this.strokeAngle, 0, Math.PI * 2);
      this.ctx.fill();

      // Bristle lines
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.moveTo(x - size * 0.6, y);
      this.ctx.lineTo(x + size * 0.6, y + (Math.random() - 0.5) * 6);
      this.ctx.stroke();
    }

    this.ctx.restore();
    this.paintedStrokesCount++;
    this.texture.needsUpdate = true;
  }

  // Clear / Reset canvas
  clear() {
    this.initCanvas();
  }

  // Reveal full artwork instantly
  revealFull() {
    if (this.referenceImgLoaded) {
      this.ctx.drawImage(this.referenceImg, 0, 0, this.width, this.height);
      this.texture.needsUpdate = true;
    }
  }
}
