import * as THREE from 'three';

/**
 * Poisson-disc scatter — random positions with guaranteed minimum spacing.
 */
export function poissonScatter({ minFromOrigin, minBetween, maxRadius, count, maxTries = 900 }) {
  const out = [];
  for (let t = 0; t < maxTries && out.length < count; t++) {
    const angle = Math.random() * Math.PI * 2;
    const r = minFromOrigin + Math.random() * (maxRadius - minFromOrigin);
    const x = Math.cos(angle) * r + (Math.random() - 0.5) * 3.5;
    const z = Math.sin(angle) * r + (Math.random() - 0.5) * 3.5;
    if (Math.hypot(x, z) < minFromOrigin) continue;
    if (out.some((p) => Math.hypot(p.x - x, p.z - z) < minBetween)) continue;
    out.push({ x, z, rotY: Math.random() * Math.PI * 2 });
  }
  return out;
}

/**
 * Clone a GLTF scene, hiding any nodes that don't match filterFn.
 */
export function makeClone(gltfScene, filterFn) {
  const clone = gltfScene.clone(true);
  clone.traverse((node) => {
    const n = node.name.toLowerCase();
    if (!filterFn(n, node.isMesh)) {
      node.visible = false;
      return;
    }
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      if (node.material) node.material = node.material.clone();
    }
  });
  return clone;
}

/**
 * Scatter trees, rocks, and flowers from a nature GLTF into the scene.
 */
export function scatterNatureObjects(scene, gltf) {
  const isTreeNode = (n, isMesh) =>
    !isMesh ||
    (!n.includes('rock') &&
      !n.includes('bridge') &&
      !n.includes('bridege') &&
      !n.includes('sign') &&
      !n.includes('cactus') &&
      !n.includes('flower') &&
      !n.includes('plant') &&
      !n.includes('bush') &&
      !n.includes('fern') &&
      !n.includes('grass') &&
      !n.includes('shrub'));

  const isRockNode = (n, isMesh) => !isMesh || n.includes('rock');

  const isFlowerNode = (n, isMesh) =>
    !isMesh ||
    n.includes('flower') ||
    n.includes('plant') ||
    n.includes('bush') ||
    n.includes('fern') ||
    n.includes('grass') ||
    n.includes('shrub') ||
    n.includes('weed') ||
    n.includes('herb');

  // Trees
  const treeSpots = poissonScatter({ minFromOrigin: 12, minBetween: 9, maxRadius: 26, count: 20 });
  for (const s of treeSpots) {
    const scale = 0.58 + Math.random() * 0.44;
    const clone = makeClone(gltf.scene, isTreeNode);
    const box = new THREE.Box3().setFromObject(clone);
    clone.position.set(s.x, -box.min.y * scale, s.z);
    clone.rotation.y = s.rotY;
    clone.scale.setScalar(scale);
    scene.add(clone);
  }

  // Rocks — well away from person origin
  const rockScales = [
    ...Array.from({ length: 5 }, () => 0.22 + Math.random() * 0.20),
    ...Array.from({ length: 5 }, () => 0.52 + Math.random() * 0.28),
    ...Array.from({ length: 4 }, () => 0.95 + Math.random() * 0.65),
  ];
  const rockSpots = poissonScatter({
    minFromOrigin: 8,
    minBetween: 4.5,
    maxRadius: 22,
    count: rockScales.length,
  });
  rockSpots.forEach((s, i) => {
    const scale = rockScales[i];
    const clone = makeClone(gltf.scene, isRockNode);
    const box = new THREE.Box3().setFromObject(clone);
    clone.position.set(s.x, -box.min.y * scale, s.z);
    clone.rotation.y = s.rotY;
    clone.scale.setScalar(scale);
    scene.add(clone);
  });

  // Flowers & Plants
  const flowerSpots = poissonScatter({ minFromOrigin: 2.5, minBetween: 1.8, maxRadius: 18, count: 32 });
  for (const s of flowerSpots) {
    const scale = 0.30 + Math.random() * 0.60;
    const clone = makeClone(gltf.scene, isFlowerNode);
    const box = new THREE.Box3().setFromObject(clone);
    clone.position.set(s.x, -box.min.y * scale, s.z);
    clone.rotation.y = s.rotY;
    clone.scale.setScalar(scale);
    scene.add(clone);
  }
}
