import * as THREE from 'three';
import { LIGHTING_CONFIG } from '../../config/constants.js';

/**
 * Add all scene lights: hemisphere, directional sun, and bounce fill.
 */
export function addLighting(scene) {
  const hemiLight = new THREE.HemisphereLight(
    LIGHTING_CONFIG.ambient.color,
    0x6e8e50,
    LIGHTING_CONFIG.ambient.intensity
  );
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(
    LIGHTING_CONFIG.sun.color,
    LIGHTING_CONFIG.sun.intensity
  );
  sunLight.position.set(
    LIGHTING_CONFIG.sun.position.x,
    LIGHTING_CONFIG.sun.position.y,
    LIGHTING_CONFIG.sun.position.z
  );
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 30;
  sunLight.shadow.camera.left = -6;
  sunLight.shadow.camera.right = 6;
  sunLight.shadow.camera.top = 6;
  sunLight.shadow.camera.bottom = -2;
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight);

  const bounceLight = new THREE.DirectionalLight(
    LIGHTING_CONFIG.bounce.color,
    LIGHTING_CONFIG.bounce.intensity
  );
  bounceLight.position.set(
    LIGHTING_CONFIG.bounce.position.x,
    LIGHTING_CONFIG.bounce.position.y,
    LIGHTING_CONFIG.bounce.position.z
  );
  scene.add(bounceLight);
}
