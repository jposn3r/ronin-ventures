# roninstudio

A static 3D product visualizer within Ronin Ventures. Serve the repository root and open `/projects/product-visualizer/`. There is no build step or backend.

## Collection and object studios

The entry route is now a discovery gallery with category filters, rendered 3D previews, and hover/focus motion. One shared WebGL renderer serves all gallery previews; reduced-motion preferences stop preview motion. The Deck gallery model is a lightweight representation; its original detailed studio remains at `deck.html`.

Three new procedural studies share `object.html?object=ID` and `viewer.js`:

- `arc-reactor`: circular copper-coil reactor inspired by Iron Man. Power, core output, and three-layer exploded assembly; tap the object to toggle power.
- `lightsaber`: Skywalker-inspired hilt with machined rings, grip rails, slanted emitter, and crystal chamber. Tap the red switch or use Ignite; blue/green/violet blades extend with camera reframing. Exploded view reveals the chamber.
- `ipod`: original 2001 mechanical-scroll-wheel form, monochrome canvas screen, separate navigation buttons, Hold and backlight. Drag or tap the wheel, or use accessible sidebar controls, to browse a small demo library. Enable Sound and play to hear original synthesized demo patterns. Exploded view reveals illustrative electronics.

All three support orbit, keyboard controls, zoom, metal roughness, lighting presets, exposure, turntable, exploded view, opt-in sound, and transparent PNG export. Mobile Customize / Back to object navigation is retained. These are independent visual reconstructions, not licensed production meshes, exact replicas, or engineering schematics. No Blender connection is needed for this set; later models can replace the factories in `models/` while retaining the collection and studio controls.

`collection.js` holds object metadata and lazy model imports. `environment.js` shares reflection and shadow lighting. All geometry, materials, and screen art are generated locally. The iPod demo audio uses Web Audio oscillators, not commercial recordings.

The original Ronin Deck model is built procedurally: a metal enclosure, PCB, mounting plate, 11 mechanical keys, an OLED-style display, knurled encoder, screws, rubber feet, and USB cable. The reference screenshot inspired the control-pad form and studio presentation; this is an original implementation, not an image-to-3D service.

## Controls

The following controls apply to the original Ronin Deck at `deck.html`.

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
