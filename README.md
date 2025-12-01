# Vibe_Coding_v001

Parametric tower generator (metre units) for the browser, built with Three.js and lil-gui. It stacks procedural floor slabs you can twist, scale, recolor with gradients, and preview instantly via a Vite dev server.

## Features
- Interactive sliders for floor count, floor height, twist min/max, scale min/max, and curve intensity.
- Separate floor spacing vs. slab thickness for realistic stack proportions.
- Independent plan size ranges (bottom-to-top) and selectable slab shape (cylinder, square/rectangle, triangle, hexagon) with non-tapered slabs per AEC conventions.
- Structural grid and vertical columns generated on a plan-based grid; adjustable spacing and column radius to align with basic AEC spacing rules.
- Gradient coloring from base to top with live color pickers.
- Orbit controls, grid/axes toggles, and stats overlay for quick inspection.
- Fast rebuild of the tower mesh for rapid iteration on form studies.

## Getting Started
1. Install Node.js 18+.
2. Install dependencies: `npm install`.
3. Start the dev server: `npm run dev` and open the shown localhost URL.
4. Build for production: `npm run build` (optional), preview with `npm run preview`.

## Controls
- Camera: left-drag orbit, right-drag pan, scroll to zoom.
- Geometry: tweak floors, floor height, slab thickness, base/top plan size ranges, slab shape/rect aspect, twist min/max, and curve modes in the GUI.
- Style: adjust bottom/top colors, wireframe toggle.
- Helpers: toggle grid/axes, view FPS via stats overlay.
- Structure: set column spacing and radius (metres) for the generated grid and columns.
