import * as THREE from 'three';

export function createPaintbrush() {
  const brushGroup = new THREE.Group();
  brushGroup.name = 'Paintbrush';

  // 1. Long Wooden Artist Handle (pointing along -Z)
  const handleGeo = new THREE.CylinderGeometry(0.007, 0.004, 0.35, 16);
  handleGeo.rotateX(Math.PI / 2); // Align with Z-axis
  handleGeo.translate(0, 0, -0.15); // Grip center
  const handleMat = new THREE.MeshStandardMaterial({
    color: 0x8b4513, // Mahogany wood
    roughness: 0.35,
    metalness: 0.1
  });
  const handle = new THREE.Mesh(handleGeo, handleMat);
  brushGroup.add(handle);

  // 2. Polished Brass Ferrule
  const ferruleGeo = new THREE.CylinderGeometry(0.008, 0.007, 0.045, 16);
  ferruleGeo.rotateX(Math.PI / 2);
  ferruleGeo.translate(0, 0, 0.04);
  const ferruleMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37, // Polished brass gold
    metalness: 0.85,
    roughness: 0.2
  });
  const ferrule = new THREE.Mesh(ferruleGeo, ferruleMat);
  brushGroup.add(ferrule);

  // 3. Natural Bristles
  const bristleGeo = new THREE.ConeGeometry(0.0075, 0.05, 16);
  bristleGeo.rotateX(-Math.PI / 2); // Point forward along +Z
  bristleGeo.translate(0, 0, 0.08);
  const bristleMat = new THREE.MeshStandardMaterial({
    color: 0x1f1914,
    roughness: 0.9
  });
  const bristles = new THREE.Mesh(bristleGeo, bristleMat);
  brushGroup.add(bristles);

  // 4. Wet Paint Tip
  const tipGeo = new THREE.SphereGeometry(0.005, 12, 12);
  tipGeo.translate(0, 0, 0.105);
  const tipMat = new THREE.MeshStandardMaterial({
    color: 0x2563eb, // Wet cobalt blue
    roughness: 0.1,
    metalness: 0.15
  });
  const tip = new THREE.Mesh(tipGeo, tipMat);
  brushGroup.add(tip);

  brushGroup.setTipColor = (hexStr) => {
    tipMat.color.set(hexStr);
  };

  return brushGroup;
}
