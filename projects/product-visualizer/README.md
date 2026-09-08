# roninstudio

A static 3D product visualizer within Ronin Ventures. Serve the repository root and open `/projects/product-visualizer/`. There is no build step or backend.

The original Ronin Deck model is built procedurally: a metal enclosure, PCB, mounting plate, 11 mechanical keys, an OLED-style display, knurled encoder, screws, rubber feet, and USB cable. The reference screenshot inspired the control-pad form and studio presentation; this is an original implementation, not an image-to-3D service.

## Controls

- Drag to orbit; scroll or pinch to zoom. Focus the canvas and use arrow keys to rotate, +/- to zoom, R to reset.
- Click the keys or encoder to update the display and activity. “Try the keys” offers equivalent keyboard-accessible buttons. Sounds are opt-in and synthesized locally.
- Choose Graphite, Silver, Sand, Teal, or 90s Transparent; adjust surface roughness. The retro finish reveals a visual keyboard-matrix PCB, controller, switch springs, stabilizer, and USB/display/encoder harnesses through smoky cool-gray molded plastic with refractive keycaps. Electronics are illustrative, not a fabrication-ready circuit.
- Choose Studio, Daylight, or Noir lighting; adjust exposure.
- Toggle the turntable or exploded assembly. Automatic motion starts off; reduced-motion preferences disable explosion interpolation.
- Save a PNG of the current 3D viewport (with a solid studio background, without the interface).
- Import or drop a self-contained `.glb` under 25 MB. Embedded geometry/textures are supported. Draco, Meshopt, KTX2 and external resources are not supported. Model animations are not played. The original materials are preserved, so finish controls and demo-only interactions are disabled during custom-model viewing. Use “Return to Ronin Deck” to restore the demo.

GLB processing stays in the browser. External model resource URLs are rejected. Replaced model geometry, materials, and textures are disposed. WebGL 2 is required; startup and context failures display a recovery message.

## Dependencies

Three.js **0.180.0**, including the required addons, is vendored in `vendor/package/` from the official npm tarball. Its MIT license is included. Only Google Fonts require a network request; system font fallbacks are supplied. The 3D renderer does not use a CDN.

The hub entry lives in `data/projects.json`, the thumbnail in `assets/thumbnails/product-visualizer.svg`, and the route is included in `sitemap.xml`.
