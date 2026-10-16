import * as THREE from 'three';

/**
 * Add ground plane and shadow catcher to scene.
 */
export function addGround(scene) {
  const geo = new THREE.PlaneGeometry(80, 80);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x769b56,
    roughness: 0.9,
    metalness: 0.05,
  });
  const ground = new THREE.Mesh(geo, mat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.22 });
  const shadowPlane = new THREE.Mesh(geo, shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.001;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);
}
