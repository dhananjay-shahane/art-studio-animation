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
    this.referenceImg.onload = () => {
      this.referenceImgLoaded = true;
      this.initCanvas();
    };

    this.paintedStrokesCount = 0;
    this.isRevealing = true;
    this.strokeAngle = 0;
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

    // Faint artistic pencil sketch layout
    this.ctx.strokeStyle = 'rgba(120, 110, 100, 0.25)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    // Horizon and mountain lines
    this.ctx.moveTo(0, this.height * 0.6);
    this.ctx.bezierCurveTo(this.width * 0.3, this.height * 0.45, this.width * 0.7, this.height * 0.65, this.width, this.height * 0.55);
    this.ctx.stroke();

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
    // Keep revealing artistic texture or paint vivid strokes
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

      // Add a slight impasto acrylic edge highlight
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
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
