import * as THREE from 'three';

export function createPaintbrush() {
  const group = new THREE.Group();
  group.name = 'Paintbrush';

  const handleGeo = new THREE.CylinderGeometry(0.007, 0.004, 0.35, 16);
  handleGeo.rotateX(Math.PI / 2);
  handleGeo.translate(0, 0, -0.15);
  group.add(new THREE.Mesh(handleGeo, new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.35, metalness: 0.1 })));

  const ferruleGeo = new THREE.CylinderGeometry(0.008, 0.007, 0.045, 16);
  ferruleGeo.rotateX(Math.PI / 2);
  ferruleGeo.translate(0, 0, 0.04);
  group.add(new THREE.Mesh(ferruleGeo, new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.2 })));

  const bristleGeo = new THREE.ConeGeometry(0.0075, 0.05, 16);
  bristleGeo.rotateX(-Math.PI / 2);
  bristleGeo.translate(0, 0, 0.08);
  group.add(new THREE.Mesh(bristleGeo, new THREE.MeshStandardMaterial({ color: 0x1f1914, roughness: 0.9 })));

  const tipGeo = new THREE.SphereGeometry(0.005, 12, 12);
  tipGeo.translate(0, 0, 0.105);
  const tipMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.1, metalness: 0.15 });
  group.add(new THREE.Mesh(tipGeo, tipMat));

  group.setTipColor = (hex) => tipMat.color.set(hex);
  return group;
}
