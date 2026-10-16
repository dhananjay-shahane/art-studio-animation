import { useEffect, useRef } from 'react';
import { createScene, createCamera, createRenderer, createOrbitControls, handleResize }
  from '../lib/three/sceneSetup.js';
import { addLighting } from '../lib/three/lighting.js';
import { addGround }   from '../lib/three/ground.js';

/**
 * useThreeScene
 *
 * Sets up scene / camera / renderer / orbit controls inside containerRef.
 * Uses a ResizeObserver so the canvas always matches the container size.
 */
export function useThreeScene(containerRef) {
  const sceneRef    = useRef(null);
  const cameraRef   = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Wait one frame so the container has been laid out and has a real size
    const init = () => {
      const scene    = createScene();
      const w = Math.max(container.offsetWidth, 280);
      const h = Math.max(container.offsetHeight, 240);
      const camera   = createCamera(w, h);
      const renderer = createRenderer(container);
      const controls = createOrbitControls(camera, renderer.domElement);

      addLighting(scene);
      addGround(scene);
      container.appendChild(renderer.domElement);

      sceneRef.current    = scene;
      cameraRef.current   = camera;
      rendererRef.current = renderer;
      controlsRef.current = controls;

      // ResizeObserver keeps renderer in sync with the container
      const ro = new ResizeObserver(() => {
        handleResize(container, renderer, camera, controls);
      });
      ro.observe(container);

      // Also handle orientation change
      const onOrient = () => setTimeout(() => handleResize(container, renderer, camera, controls), 150);
      window.addEventListener('orientationchange', onOrient);

      // Store cleanup
      container._threeCleanup = () => {
        ro.disconnect();
        window.removeEventListener('orientationchange', onOrient);
        controls.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
        sceneRef.current    = null;
        cameraRef.current   = null;
        rendererRef.current = null;
        controlsRef.current = null;
      };
    };

    // rAF so the DOM has finished its first layout pass
    const raf = requestAnimationFrame(init);

    return () => {
      cancelAnimationFrame(raf);
      if (container._threeCleanup) {
        container._threeCleanup();
        delete container._threeCleanup;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { sceneRef, cameraRef, rendererRef, controlsRef };
}
