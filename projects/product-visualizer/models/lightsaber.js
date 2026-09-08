import { THREE, metal, box, cylinder, torus, mesh, wire, brushedMap } from './shared.js';

export function createLightsaber() {
  const root = new THREE.Group(), grip = new THREE.Group(), emitter = new THREE.Group(), core = new THREE.Group();
  root.add(grip, emitter, core);
  const chrome = metal(0xaebbc4, .23), dark = metal(0x111820, .53, .15), steel = metal(0x64737c, .32), brass = metal(0xaf9358, .26);
  chrome.roughnessMap = brushedMap();
  const shaft = cylinder(grip, .38, 3.5, chrome, [0, -.45, 0]);
  for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 7;
    const rail = box(grip, [.17, 1.8, .13], dark, [Math.sin(a) * .39, -1.1, Math.cos(a) * .39], .045); rail.rotation.y = a;
    const end = cylinder(grip, .047, .025, steel, [Math.sin(a) * .467, -.38, Math.cos(a) * .467], .047, 16); end.rotation.x = Math.PI / 2; end.rotation.z = a;
  }
  cylinder(grip, .44, .15, steel, [0, -2.24, 0]);
  for (let i = 0; i < 4; i++) cylinder(grip, .432, .035, chrome, [0, -2.18 + i * .055, 0]);
  const loop = torus(grip, .16, .028, steel, [0, -2.46, 0]);
  cylinder(grip, .43, .38, steel, [0, .1, 0]);
  box(grip, [.55, .32, .24], chrome, [0, .1, .45], .03);
  box(grip, [.43, .22, .035], dark, [0, .1, .59], .008);
  for (let i = 0; i < 6; i++) box(grip, [.045, .19, .025], brass, [-.16 + i * .063, .1, .618], .004);
  cylinder(emitter, .385, 1.04, chrome, [0, .84, 0]);
  for (const y of [.49, .53, 1.18, 1.22]) cylinder(emitter, .405, .025, steel, [0, y, 0]);
  const red = new THREE.MeshStandardMaterial({ color: 0x8a151d, roughness: .24, metalness: .3 });
  const button = cylinder(emitter, .125, .11, red, [0, .84, .42]); button.rotation.x = Math.PI / 2;
  const bezel = torus(emitter, .125, .026, chrome, [0, .84, .435]);
  const aux = cylinder(emitter, .075, .1, brass, [.42, 1.03, 0]); aux.rotation.z = Math.PI / 2;
  // The slanted shroud is a hollow ring with a diagonal top lip.
  const geometry = new THREE.CylinderGeometry(.49, .49, .54, 80, 1, true);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) if (positions.getY(i) > 0) positions.setY(i, positions.getY(i) + positions.getX(i) * .47);
  geometry.computeVertexNormals();
  const shroudMaterial = chrome.clone(); shroudMaterial.side = THREE.DoubleSide;
  mesh(emitter, geometry, shroudMaterial, [0, 1.47, 0]);
  cylinder(emitter, .48, .065, chrome, [0, 1.21, 0]);
  cylinder(emitter, .25, .22, dark, [0, 1.44, 0]);
  cylinder(emitter, .2, .05, brass, [0, 1.57, 0]);
  for (const x of [-.26, .26]) box(emitter, [.1, .24, .1], chrome, [x, 1.71, -.31], .024);
  // Crystal chamber becomes visible when the outer grip separates.
  cylinder(core, .23, 2.6, dark, [0, -.54, 0]);
  for (let i = 0; i < 12; i++) cylinder(core, .255, .035, brass, [0, -1.65 + i * .15, 0]);
  const crystalMaterial = new THREE.MeshStandardMaterial({ color: 0x8adfff, emissive: 0x229dff, emissiveIntensity: 1.2, metalness: .2, roughness: .1 });
  const crystal = mesh(core, new THREE.OctahedronGeometry(.24, 0), crystalMaterial, [0, .18, 0]); crystal.scale.y = 2.1;
  wire(core, [[.21, -.7, 0], [.31, -.25, .05], [.2, .5, 0]], brass, .024);
  const blade = new THREE.Group(); blade.position.y = 1.6; root.add(blade);
  const bladeMaterial = new THREE.MeshBasicMaterial({ color: 0xe5faff, toneMapped: false });
  cylinder(blade, .085, 5.8, bladeMaterial, [0, 2.9, 0]);
  mesh(blade, new THREE.SphereGeometry(.085, 24, 16), bladeMaterial, [0, 5.8, 0]);
  // A camera-facing capsule field gives the plasma a continuous, soft falloff
  // from every orbit angle, rather than a stack of visible cylindrical shells.
  const plasma = new THREE.ShaderMaterial({
    uniforms: { energyColor: { value: new THREE.Color(0x46baff) }, time: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: `
      varying vec2 field;
      void main() {
        field = position.xy;
        vec3 center = (modelMatrix * vec4(0.0, position.y, 0.0, 1.0)).xyz;
        vec3 axis = normalize(modelMatrix[1].xyz);
        vec3 view = normalize(cameraPosition - center);
        vec3 right = cross(axis, view);
        if (length(right) < 0.001) right = modelMatrix[0].xyz;
        right = normalize(right);
        vec3 world = center + right * position.x * length(modelMatrix[0].xyz);
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 energyColor;
      uniform float time;
      varying vec2 field;
      void main() {
        float y = field.y;
        float flow = sin(y * 11.0 - time * 5.5) * sin(y * 4.7 + time * 2.1);
        float bend = 0.009 * sin(y * 8.0 - time * 3.0) + 0.004 * sin(y * 21.0 + time * 4.0);
        float endDistance = max(max(-y, y - 5.8), 0.0);
        float distanceToCore = length(vec2(field.x - bend, endDistance));
        float radius = 0.12 + flow * 0.012;
        float hot = exp(-pow(distanceToCore / radius, 3.0));
        float corona = exp(-pow(distanceToCore / 0.23, 2.0));
        float haze = exp(-pow(distanceToCore / 0.42, 2.0));
        float filament = exp(-pow((abs(field.x - bend) - 0.13 - flow * 0.012) / 0.021, 2.0));
        filament *= smoothstep(-0.02, 0.12, y) * (1.0 - smoothstep(5.65, 5.9, y));
        float breath = 0.94 + 0.04 * sin(time * 2.6) + flow * 0.04;
        float opacity = (hot * 0.68 + corona * 0.36 + haze * 0.09 + filament * 0.15) * breath;
        opacity *= 1.0 - smoothstep(0.5, 0.65, distanceToCore);
        vec3 color = mix(energyColor, vec3(0.92, 0.98, 1.0), hot * 0.7);
        gl_FragColor = vec4(color, opacity);
        #include <colorspace_fragment>
      }`
  });
  const auraGeometry = new THREE.PlaneGeometry(1.3, 7.1);
  auraGeometry.translate(0, 2.9, 0);
  mesh(blade, auraGeometry, plasma);
  blade.traverse(o => { o.castShadow = false; o.receiveShadow = false; });
  const spill = new THREE.PointLight(0x46baff, 0, 5); spill.position.y = 1.9; root.add(spill);
  let ignited = false, color = 'blue', extension = 0, exploded = 0;
  const colors = { blue: 0x46baff, green: 0x63ffb0, violet: 0xb283ff };
  blade.scale.set(1.25, .001, 1.25); blade.visible = false;
  return {
    root, materials: [chrome, steel, shroudMaterial],
    get framing() { return ignited ? { target: [0, 2.8, 0], position: [6.7, 4.3, 19] } : { target: [0, -.3, 0], position: [4, 2, 8.8] }; },
    actions: [{ id: 'ignite', label: 'Ignite blade', type: 'toggle', value: false, reframe: true }, { id: 'color', label: 'Blade color', type: 'select', value: 'blue', options: [{ value: 'blue', label: 'Sky blue' }, { value: 'green', label: 'Jade green' }, { value: 'violet', label: 'Violet' }] }],
    hitTargets: [{ object: button, action: 'ignite' }, { object: bezel, action: 'ignite' }],
    act(id, value) {
      if (id === 'ignite') ignited = value ?? !ignited;
      if (id === 'color') { color = value; plasma.uniforms.energyColor.value.set(colors[color]); bladeMaterial.color.set(colors[color]).lerp(new THREE.Color(0xffffff),.8); spill.color.set(colors[color]); crystalMaterial.emissive.set(colors[color]); }
      return ignited ? `${color[0].toUpperCase() + color.slice(1)} blade ignited` : 'Blade retracted · tap the red switch';
    },
    getState() { return { ignite: ignited, color }; },
    update(dt, time, explode, reduced) {
      extension = reduced ? Number(ignited) : THREE.MathUtils.clamp(extension + (ignited ? 1 : -1) * dt / .85, 0, 1);
      const easedExtension = THREE.MathUtils.smootherstep(extension, 0, 1);
      blade.visible = easedExtension > .001; blade.scale.y = Math.max(.001, easedExtension * 1.2); spill.intensity = easedExtension * (reduced ? 2.5 : 2.5 + Math.sin(time * 2.6) * .1);
      plasma.uniforms.time.value = reduced ? 0 : time;
      exploded = reduced ? explode : THREE.MathUtils.damp(exploded, explode, 6, dt);
      grip.position.x = -exploded * .9; emitter.position.y = exploded * .6;
    },
    status: 'Blade retracted · tap the red switch'
  };
}
