/**
 * Art Studio Configuration Constants
 * Centralized settings for palette colors, camera viewpoints, and scene parameters.
 */

export const PALETTE_COLORS = [
  { name: 'Color1', hex: '#ef4444', label: 'Crimson Red' },
  { name: 'Color2', hex: '#f97316', label: 'Sunset Orange' },
  { name: 'Color3', hex: '#facc15', label: 'Cadmium Yellow' },
  { name: 'Color4', hex: '#10b981', label: 'Emerald Green' },
  { name: 'Color5', hex: '#3b82f6', label: 'Cobalt Blue' },
  { name: 'Color6', hex: '#8b5cf6', label: 'Purple Violet' },
  { name: 'Color7', hex: '#f8fafc', label: 'Titanium White' }
];

export const CAMERA_CONFIG = {
  fov: 42,
  near: 0.1,
  far: 100,
  // Comfortably zoomed-out camera framing the artist, easel, palette and natural background
  defaultPosition: { x: 1.85, y: 1.48, z: 2.25 },
  defaultTarget: { x: -0.15, y: 1.15, z: 0.42 },
  minDistance: 0.8,
  maxDistance: 12
};

export const LIGHTING_CONFIG = {
  ambient: { color: 0xe0f2fe, intensity: 1.5 },
  sun: {
    color: 0xfffaed,
    intensity: 2.8,
    position: { x: 5, y: 8, z: 4 }
  },
  bounce: {
    color: 0xcde3ba,
    intensity: 0.9,
    position: { x: -4, y: 3, z: -3 }
  }
};
