# 🎨 Art Studio - 3D Plein-Air Interactive Workspace

A modern, high-performance 3D interactive plein-air painting workspace and authentication portal built with **Three.js**, **Anime.js**, and **Vite**.

---

## 🛠️ Technologies Used

1. **[Three.js (v0.186+)](https://threejs.org/)**
   - **WebGL 3D Engine**: Renders high-fidelity 3D assets, soft directional sunlight with PCF soft shadows, and outdoor hemisphere bounce lighting.
   - **Raycasting**: Real-time pointer interaction with the 3D canvas, color palette, and artist character.
   - **Skeletal Transforms**: Anatomical joint tracking, finger curling kinematics, and hand attachment synchronization.

2. **[Anime.js (v4+)](https://animejs.com/)**
   - **Procedural Skeletal Animation**: Smooth natural breathing cycle (hips and spine), expressive painting timelines with alternating brush strokes, and fluid transitions when dipping for paint or looking at the viewer.
   - **Interactive Tweens**: Smooth camera transitions, entrance animations, and micro-interactions.

3. **[HTML5 Canvas 2D API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)**
   - **Dynamic Texture Synthesis**: Generates primed artist linen texture with fine weave and sketch marks, and applies wet oil brush strokes in real time onto the 3D easel canvas texture map.

4. **[Vite (v8+)](https://vitejs.dev/)**
   - **Development & Build Tooling**: Lightning-fast native ES modules development server with Hot Module Replacement (HMR) and optimized Rollup production bundling.

5. **[Canvas Confetti](https://www.npmjs.com/package/canvas-confetti)**
   - **Particle Physics**: Celebratory studio confetti blast on form submission.

6. **Modern Vanilla CSS & Glassmorphism**
   - Responsive split-screen layout (Left: auth panel, Right: live 3D viewport).
   - Glassmorphic panels, custom checkboxes, smooth focus rings, and Google Fonts (*Plus Jakarta Sans*).

---

## 📁 Clean Codebase & Folder Structure

```
animation/
├── index.html                  # Main application HTML & Art Studio login form
├── style.css                   # Responsive layout, glassmorphic UI, loader styling
├── vite.config.js              # Vite server & build configuration
├── package.json                # Project dependencies & build scripts
├── README.md                   # Project documentation & tech stack guide
│
├── public/                     # Served 3D glTF/GLB models & textures
│   ├── artist.glb              # Male artist character model with armature
│   ├── easel_canvas.glb        # Studio easel and 3D canvas
│   ├── palette.glb             # Painter's color palette with oil paint mounds
│   ├── nature-bg.glb           # Outdoor landscape & trees
│   └── original_painting.png   # Masterpiece reference texture
│
├── assets_raw/                 # Source assets & Blender workspace files
│   ├── artist.glb              # Master artist character 3D model
│   ├── palette.blend           # Blender source model
│   └── palette.glb             # Master palette 3D model
│
└── src/                        # Modular application source code
    ├── main.js                 # Application entry point, 3D scene, loader & render loop
    ├── config/
    │   └── constants.js        # Color swatches, camera presets, and lighting values
    ├── engines/
    │   ├── animationEngine.js  # Anime.js skeletal animation, breathing & painting timeline
    │   └── paintingEngine.js   # Dynamic 2D canvas texture generation & paint strokes
    └── models/
        └── brushFactory.js     # Procedural 3D paintbrush geometry & materials
```

---

## ✨ Key Features & Fixes

- **Hand-Held Palette & Paintbrush**:
  - Left hand holds [`palette.glb`](./public/palette.glb) naturally through the thumb hole with fingers supporting the wooden base.
  - Right hand holds the procedural [`Paintbrush`](./src/models/brushFactory.js) in an authentic artist precision grip, pointing directly at the easel canvas with fingers curled around the handle.
- **3D Animated Palette Loader**:
  - The loading screen features a rotating, floating 3D [`palette.glb`](./public/palette.glb) with glossy paint mounds while assets load in the background.
- **Normal Zoomed-Out Camera & Multi-Device Responsiveness**:
  - Camera positioned comfortably to frame the entire artist, easel, palette, and woodland backdrop without cropping across mobile, tablet, laptop, and desktop.
- **Nature Trees on Front & Horizon**:
  - Trees from [`nature-bg.glb`](./public/nature-bg.glb) frame the front sides and vista for a rich plein-air outdoor studio environment.
- **Interactive Hover Animations with Anime.js**:
  - **Artist Character ([`artist.glb`](./public/artist.glb))**: On hover, dips paintbrush into [`palette.glb`](./public/palette.glb), dynamically selects a rich oil paint color, turns to the canvas, and paints fluid expressive strokes in real time!
  - **Color Palette ([`palette.glb`](./public/palette.glb))**: Tilts and elevates towards the viewer to present oil paint mounds, with head tracking and dipping stance.
  - **Canvas**: Painting acrylic brush strokes wherever the user points.
- **Clean Art Studio Login Form**:
  - Updated badge to **ART STUDIO**, removed color picker clutter, and polished authentication flow.

---

## 🚀 Running Locally

```bash
# Install dependencies
npm install

# Start local development server (port 3000)
npm run dev

# Build for production
npm run build
```
