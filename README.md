# The Writing Room

A local foundation for the Wildfell Hall personal website: an ivory painted wooden writing desk built with Three.js and Vite. The desktop remains empty for future interactive papers, books, and other objects.

## Run

```sh
npm install
npm run dev
```

Open the URL printed by Vite.

```sh
npm run build
npm run preview
```

`dist/` is a static build, suitable for GitHub Pages. Paths are relative, so it can also be served from a project subdirectory. No hosting service, server API, external image request, or external font request is required. Nothing has been deployed to the existing site.

## The desk

- Five subtly joined boards with deterministic wood grain, brush marks, small scratches, rubbed paint, separate height and roughness maps.
- Layered rounded mouldings, elaborate acanthus scrolls with veined leaves, rosettes, a bead-and-reel rim, drawer garlands, a scallop-shell pendant, reeded stiles, and turned legs. Relief geometry is merged into three meshes by finish.
- “Wildfell Hall” in actual bevelled gold cursive lettering on the desktop. No headings, captions, monograms, or visible button labels overlay the scene.
- An ornate light pink carpet with ivory floral motifs, a medallion, patterned borders, woven pile texture, a bound edge, and cream fringe.
- Modelled brass escutcheons, bail handles, screws, and keyholes.
- Soft lighting, environment reflections, contact shadows, and a procedural window/garden shadow attached to the writing surface.
- Afternoon/evening lighting and a closer view, with accessible icon buttons for keyboard and touch.
- Small pointer parallax; disabled for touch and reduced-motion preferences.
- Rendering stops when the view settles or the tab is hidden. A CSS/textured fallback remains available if WebGL or a material fails.

This is a period-inspired design, not a reconstruction of a particular historical desk.

## Files

- `src/desk.js`: furniture geometry and materials; `DESK.surfaceY` is the writing plane. Add later objects to the returned `writingSurface` group, where local y = 0 touches the desktop.
- `src/ornaments.js`: merged relief carvings, extruded gold script, and the woven carpet.
- `src/main.js`: scene, lighting, camera, responsive framing, and interaction.
- `src/style.css`: typography, controls, responsive layout, and fallback.
- `scripts/make-materials.py`: reproducible texture authoring, using NumPy and Pillow. Run `npm run textures` to regenerate the checked-in WebP maps. Python is unnecessary to run or build the website.
- `scripts/make-ornaments.mjs`: deterministic vector lettering and floral carpet design, rasterized with Sharp. `npm run ornaments` regenerates these assets. Great Vibes is used under the bundled SIL Open Font License; the lettering is converted to vector outlines, so no font is downloaded at runtime.
- `public/materials/`: local procedural texture assets. No AI-generated or photographic assets.

## Verification

`npm test` starts a temporary Vite server and runs browser checks for rendering, keyboard/touch controls, portrait overflow, and asset-failure fallback. It saves screenshots in `test-results/`.

By default tests use Google Chrome at its standard macOS path. Set `CHROME_PATH` for another Chromium executable. To reuse a running server, set `TEST_URL`, for example:

```sh
TEST_URL=http://127.0.0.1:4174/ npm test
```

The production build and all three browser tests pass. The tests cover desktop rendering and keyboard controls, portrait layout and touch controls, and the fallback when a texture fails to load. Local asset references and finite carving geometry have also been verified; lettering and carpet assets have been visually inspected.

## Project constraint

Do not use Sites or image generation skills/services for this project. See `AGENTS.md`.
