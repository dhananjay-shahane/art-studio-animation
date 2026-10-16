import * as THREE from 'three';

export class PaintingEngine {
  constructor(canvasMesh) {
    this.canvasMesh = canvasMesh;
    this.width = 1024;
    this.height = 614;

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.flipY = false;

    if (this.canvasMesh && this.canvasMesh.material) {
      this.canvasMesh.material.map = this.texture;
      this.canvasMesh.material.needsUpdate = true;
    }

    this.colors = [
      '#ef4444', '#f97316', '#facc15', '#10b981', '#3b82f6', '#8b5cf6', '#f8fafc',
    ];
    this.currentColorIndex = 4;
    this.brushSize = 22;
    this.isRevealing = true; // show the nature reference painting on the canvas board

    this.referenceImg = new Image();
    this.referenceImg.src = './original_painting.png';
    this.referenceImgLoaded = false;
    this.referenceImg.onload = () => {
      this.referenceImgLoaded = true;
      this._initCanvas();
    };

    this.strokeAngle = 0;
  }

  _initCanvas() {
    this.ctx.fillStyle = '#f4ede2';
    this.ctx.fillRect(0, 0, this.width, this.height);
    // Canvas weave texture
    this.ctx.fillStyle = 'rgba(0,0,0,0.02)';
    for (let x = 0; x < this.width; x += 4) this.ctx.fillRect(x, 0, 1.5, this.height);
    for (let y = 0; y < this.height; y += 4) this.ctx.fillRect(0, y, this.width, 1.5);
    // Faint pencil sketch
    this.ctx.strokeStyle = 'rgba(120,110,100,0.25)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
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
  }

  paintAt(normX, normY, size = this.brushSize, color = this.getCurrentColor()) {
    const x = Math.max(0, Math.min(this.width, normX * this.width));
    const y = Math.max(0, Math.min(this.height, normY * this.height));

    this.ctx.save();
    this.strokeAngle += (Math.random() - 0.5) * 0.6;

    if (this.referenceImgLoaded && this.isRevealing) {
      this.ctx.save();
      this.ctx.beginPath();
      const r = size * (0.8 + Math.random() * 0.5);
      this.ctx.ellipse(x, y, r, r * 0.45, this.strokeAngle, 0, Math.PI * 2);
      this.ctx.clip();
      this.ctx.drawImage(this.referenceImg, 0, 0, this.width, this.height);
      this.ctx.restore();
      this.ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(x, y - 2, size * 0.3, 0, Math.PI);
      this.ctx.stroke();
    } else {
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.ellipse(x, y, size, size * 0.5, this.strokeAngle, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.moveTo(x - size * 0.6, y);
      this.ctx.lineTo(x + size * 0.6, y + (Math.random() - 0.5) * 6);
      this.ctx.stroke();
    }

    this.ctx.restore();
    this.texture.needsUpdate = true;
  }

  clearCanvas() {
    this._initCanvas();
  }

  revealFull() {
    if (this.referenceImgLoaded) {
      this.ctx.drawImage(this.referenceImg, 0, 0, this.width, this.height);
      this.texture.needsUpdate = true;
    }
  }
}
