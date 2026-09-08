import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $ = selector => document.querySelector(selector);
const viewport = $('#viewport');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
viewport.append(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 150);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 7;
controls.maxDistance = 25;
controls.maxPolarAngle = Math.PI * .88;
controls.autoRotateSpeed = .65;
const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const environment = pmrem.fromScene(room, .04);
scene.environment = environment.texture;
scene.environmentIntensity = .65;
room.dispose();
pmrem.dispose();
const ambient = new THREE.HemisphereLight(0xd7e7e5, 0x292720, 2);
scene.add(ambient);
const keyLight = new THREE.DirectionalLight(0xffeed7, 4.2);
keyLight.position.set(-4, 9, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
Object.assign(keyLight.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: .5, far: 30 });
keyLight.shadow.bias = -.0005;
keyLight.shadow.normalBias = .035;
keyLight.shadow.radius = 4;
scene.add(keyLight);
const rim = new THREE.DirectionalLight(0xb8d0f5, 3);
rim.position.set(5, 3, -3);
scene.add(rim);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: .32 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -.47;
floor.receiveShadow = true;
scene.add(floor);

const deck = new THREE.Group();
scene.add(deck);
const moving = [], keys = [], hitTargets = [];
const metal = new THREE.MeshStandardMaterial({ color: 0x353b3b, metalness: .85, roughness: .35 });
const dark = new THREE.MeshStandardMaterial({ color: 0x151a1d, metalness: .25, roughness: .38 });
const edgeMetal = new THREE.MeshStandardMaterial({ color: 0x757c78, metalness: .95, roughness: .28 });
const rubber = new THREE.MeshStandardMaterial({ color: 0x0b0e0c, roughness: .9 });
const ivory = new THREE.MeshStandardMaterial({ color: 0xdcd4bc, metalness: .12, roughness: .4 });
// Full-opacity dielectric surfaces transmit the scene instead of fading the
// whole object out. Refraction, absorption and reflections give molded plastic weight.
const clearShell = new THREE.MeshPhysicalMaterial({ color: 0xd1d5df, metalness: 0, roughness: .16, opacity: 1, transmission: .92, thickness: .26, ior: 1.49, attenuationColor: 0x939cae, attenuationDistance: 1.6, clearcoat: 1, clearcoatRoughness: .09, depthWrite: true });
const clearCaps = clearShell.clone();
clearCaps.color.set(0xc4cbd8); clearCaps.transmission = .86; clearCaps.thickness = .18;
const finishParts = [];
function finishPart(mesh, transparentMaterial = clearShell) {
  finishParts.push({ mesh, original: mesh.material, transparentMaterial });
  return mesh;
}
function box(parent, w, h, d, material, x, y, z, radius = .1) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function cylinder(parent, radius, height, material, x, y, z, segments = 64) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function layer(level) {
  const group = new THREE.Group();
  group.userData.level = level;
  deck.add(group);
  moving.push(group);
  return group;
}
function textureCanvas(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  paint(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}
function decal(parent, texture, w, d, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// The product is modeled in layers, so the exploded view retains the assembly structure.
const base = layer(0), circuit = layer(.8), plate = layer(1.7), top = layer(3);
finishPart(box(base, 5.1, .47, 5.9, dark, 0, -.13, 0, .28));
finishPart(box(base, 5.02, .06, 5.8, edgeMetal, 0, .1, 0, .24));
box(circuit, 4.6, .09, 5.35, new THREE.MeshStandardMaterial({ color: 0x1d4b4b, metalness: .35, roughness: .5 }), 0, .14, 0, .1);
finishPart(box(plate, 5.03, .2, 5.83, metal, 0, .27, 0, .23));

// A visual keyboard-matrix PCB: routed copper, solder pads and silkscreen.
// This is illustrative electronics, not a fabrication-ready circuit design.
const pcbTexture = textureCanvas(1024, 1200, (c, w, h) => {
  c.fillStyle = '#263332'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#87928b'; c.lineWidth = 2;
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
    const x = 132 + col * 253, y = 448 + row * 253;
    c.beginPath(); c.moveTo(x - 54, y); c.lineTo(x - 80, y + 26); c.lineTo(65 + row * 12, y + 26); c.lineTo(65 + row * 12, 1110); c.lineTo(420 + row * 12, 1110); c.stroke();
    c.beginPath(); c.moveTo(x + 54, y); c.lineTo(x + 76, y - 22); c.lineTo(x + 76, 320 + col * 13); c.lineTo(930, 320 + col * 13); c.lineTo(930, 1090 - col * 10); c.lineTo(590, 1090 - col * 10); c.stroke();
    for (const dx of [-54, 54]) { c.fillStyle = '#ccb579'; c.beginPath(); c.arc(x + dx, y, 10, 0, Math.PI * 2); c.fill(); c.fillStyle = '#b9c6ba'; c.beginPath(); c.arc(x + dx, y, 4, 0, Math.PI * 2); c.fill(); }
    c.strokeStyle = '#a4c0a7'; c.strokeRect(x - 66, y - 64, 132, 128);
    c.fillStyle = '#bfd7bd'; c.font = '16px monospace'; c.fillText('SW' + (row * 4 + col + 1), x - 62, y + 88); c.strokeStyle = '#77a17e';
  }
  c.fillStyle = '#c8dcc8'; c.font = '19px monospace'; c.fillText('RONIN  /  MATRIX REV. 01', 245, 80);
  c.font = '15px monospace'; c.fillText('USB 5V   GND   D−   D+', 370, 117); c.fillText('U1  MCU', 440, 1180);
});
const pcbSurface = decal(circuit, pcbTexture, 4.55, 5.3, 0, .192, 0);
pcbSurface.material.transparent = false;
pcbSurface.material.depthWrite = true;
const solder = new THREE.MeshStandardMaterial({ color: 0xbfc7c4, metalness: .85, roughness: .32 });
const chipMaterial = new THREE.MeshStandardMaterial({ color: 0x101619, roughness: .65 });
const copper = new THREE.MeshStandardMaterial({ color: 0xb49c60, metalness: .8, roughness: .32 });
box(circuit, .61, .095, .4, chipMaterial, 0, .25, 2.32, .025);
for (let i = 0; i < 8; i++) for (const side of [-1, 1]) box(circuit, .033, .035, .13, solder, -.25 + i * .071, .217, 2.32 + side * .23, .008);
for (let i = 0; i < 6; i++) {
  box(circuit, .12, .055, .065, chipMaterial, -.95 + i * .18, .222, -1.23, .008);
  for (const dx of [-.065, .065]) box(circuit, .032, .058, .07, solder, -.95 + i * .18 + dx, .222, -1.23, .005);
}
for (const x of [-1.65, 1.65]) {
  cylinder(circuit, .095, .19, chipMaterial, x, .28, 2.35, 24);
  cylinder(circuit, .083, .015, solder, x, .38, 2.35, 24);
}
for (const x of [-2.08, 2.08]) for (const z of [-2.4, 2.4]) cylinder(circuit, .065, .17, copper, x, .245, z, 16);
function internalWire(points, color, radius = .018) {
  const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 24, radius, 8, false);
  const wire = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: .62 }));
  wire.castShadow = true; circuit.add(wire);
}
// Four-conductor USB harness, display ribbon and encoder leads terminate on headers.
box(circuit, .48, .12, .22, ivory, 0, .255, -2.47, .025);
['#bf585b', '#292c32', '#c9d8ce', '#689997'].forEach((color, i) => {
  const x = (i - 1.5) * .075;
  internalWire([[x, .28, -2.5], [x, .31, -2.16], [1.03 + x, .29, -1.55], [1.03 + x, .23, -.95]], color);
});
for (let i = 0; i < 7; i++) internalWire([[-.5 + i * .055, .4, -1.5], [-.5 + i * .055, .3, -1.15], [-.7 + i * .055, .22, -1]], '#c5ad85', .014);
for (let i = 0; i < 3; i++) internalWire([[1.5 + i * .065, .41, -1.95], [2.05 + i * .045, .3, -1.4], [2.05 + i * .045, .23, -.98]], ['#bc7272', '#d4c294', '#6d9ea6'][i]);
const screwMat = new THREE.MeshStandardMaterial({ color: 0x202424, metalness: .9, roughness: .25 });
for (const x of [-2.23, 2.23]) for (const z of [-2.58, 2.58]) {
  cylinder(plate, .11, .026, screwMat, x, .385, z, 24);
  box(plate, .1, .009, .021, edgeMetal, x, .404, z, .005);
}
// Rear USB-C port and a braided cable silhouette.
box(base, .55, .15, .07, rubber, 0, -.05, -2.96, .06);
box(base, .36, .055, .08, edgeMetal, 0, -.05, -3, .02);
const cableCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -.03, -3), new THREE.Vector3(0, -.05, -3.8), new THREE.Vector3(.25, -.3, -4.5), new THREE.Vector3(1.8, -.35, -5.2), new THREE.Vector3(3.6, -.35, -6.5)]);
const cable = new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 40, .052, 10, false), rubber);
cable.castShadow = true;
base.add(cable);

const screenCanvas = document.createElement('canvas');
screenCanvas.width = 768; screenCanvas.height = 256;
const screenContext = screenCanvas.getContext('2d');
const screenTexture = new THREE.CanvasTexture(screenCanvas);
screenTexture.colorSpace = THREE.SRGBColorSpace;
box(top, 2.9, .13, .99, rubber, -.7, .45, -1.9, .09);
decal(top, screenTexture, 2.72, .83, -.7, .522, -1.9);
let activeIndex = 0;
const actions = [
  { name: 'Focus', icon: '◎', color: '#8fc9c3', message: 'One thing. All your attention.', tone: 261.63 },
  { name: 'Create', icon: '△', color: '#a5baff', message: 'Make room for a new idea.', tone: 329.63 },
  { name: 'Explore', icon: '✳', color: '#efbd72', message: 'Follow your curiosity.', tone: 392 },
  { name: 'Connect', icon: '◇', color: '#c3a0ea', message: 'Better things, together.', tone: 523.25 },
  { name: 'Capture', icon: '○', color: '#adc4c1', message: 'A moment worth keeping.', tone: 293.66 },
  { name: 'Rewind', icon: '↶', color: '#adc4c1', message: 'A fresh perspective.', tone: 349.23 },
  { name: 'Confirm', icon: '✓', color: '#adc4c1', message: 'Consider it done.', tone: 440 },
  { name: 'Pause', icon: 'Ⅱ', color: '#adc4c1', message: 'Take a breath.', tone: 493.88 },
  { name: 'Voice', icon: '≋', color: '#adc4c1', message: 'Find your voice.', tone: 220 },
  { name: 'Launch', icon: '↗', color: '#294442', message: 'Your next chapter starts here.', tone: 587.33 },
  { name: 'New idea', icon: '+', color: '#adc4c1', message: 'A blank canvas. Just for you.', tone: 659.25 }
];
function drawScreen(index) {
  const action = actions[index], c = screenContext;
  c.fillStyle = '#091514'; c.fillRect(0, 0, 768, 256);
  c.fillStyle = '#8fc9c3'; c.beginPath(); c.arc(81, 94, 35, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#d5e5e2'; c.font = '26px monospace'; c.fillText('RONIN / ' + action.name.toUpperCase(), 147, 89);
  c.fillStyle = '#74938d'; c.font = '16px monospace'; c.fillText('YOUR SPACE. YOUR PACE.', 147, 125);
  c.fillStyle = '#456b61'; c.font = '13px monospace'; c.fillText('RV—001   •   CONNECTED', 42, 216);
  for (let i = 0; i < 48; i++) { const h = 8 + Math.sin(i * 1.7 + index) ** 2 * 29; c.fillStyle = i < 30 ? '#8fc9c3' : '#25413a'; c.fillRect(405 + i * 6, 215 - h, 3, h); }
  screenTexture.needsUpdate = true;
}
drawScreen(0);
// Knurled rotary encoder with a brass collar and engraved indicator.
cylinder(top, .59, .09, edgeMetal, 1.62, .46, -1.93);
const dial = new THREE.Group(); dial.position.set(1.62, .5, -1.93); top.add(dial);
cylinder(dial, .53, .36, dark, 0, .17, 0);
const brass = new THREE.MeshStandardMaterial({ color: 0x98886a, metalness: .9, roughness: .35 });
for (let i = 0; i < 64; i++) {
  const a = i / 64 * Math.PI * 2;
  const rib = box(dial, .027, .24, .027, brass, Math.sin(a) * .526, .12, Math.cos(a) * .526, .007);
  rib.rotation.y = a;
}
const dialTop = cylinder(dial, .515, .06, dark, 0, .36, 0);
box(dial, .025, .01, .14, ivory, 0, .396, -.33, .005);
dialTop.userData.dial = true; hitTargets.push(dialTop);

actions.forEach((action, index) => {
  const group = new THREE.Group();
  let x, z, width = 1;
  if (index < 8) { x = (index % 4 - 1.5) * 1.13; z = -.67 + Math.floor(index / 4) * 1.13; }
  else { x = index === 8 ? -1.695 : index === 9 ? 0 : 1.695; z = 1.59; if (index === 9) width = 2.13; }
  group.position.set(x, 0, z); top.add(group);
  const socketMat = new THREE.MeshStandardMaterial({ color: index < 4 ? action.color : '#65958f', emissive: index < 4 ? action.color : '#294e4b', emissiveIntensity: .35, metalness: .35, roughness: .4 });
  finishPart(box(plate, width + .055, .045, 1.055, socketMat, x, .401, z, .12));
  const key = finishPart(box(group, width, .45, 1, index === 9 ? ivory : dark, 0, .665, 0, .13), clearCaps);
  box(circuit, .49, .13, .49, chipMaterial, x, .28, z, .04);
  box(group, .19, .13, .19, index < 4 ? socketMat : ivory, 0, .68, 0, .025);
  const coil = [];
  for (let step = 0; step <= 80; step++) { const t = step / 80; coil.push(new THREE.Vector3(Math.cos(t * Math.PI * 10) * .105, .43 + t * .19, Math.sin(t * Math.PI * 10) * .105)); }
  const spring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 80, .012, 6, false), solder);
  group.add(spring);
  if (index === 9) {
    box(group, 1.5, .035, .035, solder, 0, .49, .23, .009);
    for (const offset of [-.75, .75]) box(group, .13, .18, .17, chipMaterial, offset, .5, .23, .025);
  }
  key.userData.keyIndex = index;
  hitTargets.push(key);
  const label = textureCanvas(index === 9 ? 512 : 256, 256, (c, w) => {
    c.textAlign = 'center'; c.fillStyle = action.color;
    c.font = '60px sans-serif'; c.fillText(action.icon, w / 2, 105);
    c.font = '18px monospace'; c.fillText(action.name, w / 2, 187);
  });
  const transparentLabel = textureCanvas(index === 9 ? 512 : 256, 256, (c, w) => {
    c.textAlign = 'center'; c.fillStyle = '#000000';
    c.font = '120px sans-serif'; c.fillText(action.icon, w / 2, 132);
    c.font = 'bold 36px monospace'; c.fillText(action.name, w / 2, 218 - 256 * .05);
  });
  const labelMesh = decal(group, label, width * .83, .83, 0, .894, 0);
  keys.push({ group, pressedAt: -10, labelMesh, label, transparentLabel });
  const button = document.createElement('button');
  button.textContent = action.name;
  button.addEventListener('click', () => pressKey(index));
  $('#key-buttons').append(button);
});
const branding = textureCanvas(1024, 128, c => { c.fillStyle = '#aabdbb'; c.font = '29px monospace'; c.textAlign = 'center'; c.fillText('R O N I N   /   D E C K — 0 1', 512, 77); });
decal(plate, branding, 3.4, .4, 0, .377, 2.47);
const led = new THREE.Mesh(new THREE.SphereGeometry(.023, 12, 8), new THREE.MeshBasicMaterial({ color: 0x8fc9c3 }));
led.position.set(1.97, .39, 2.45); plate.add(led);

// A 20-degree control surface seated on two minimal wedge rails.
const deckAngle = THREE.MathUtils.degToRad(20);
deck.rotation.x = deckAngle;
const undersideY = -.365;
deck.position.y = floor.position.y + .11 - undersideY * Math.cos(deckAngle) + 2.8 * Math.sin(deckAngle);
deck.updateMatrixWorld(true);

// Build the stand in table coordinates, then attach it to the deck with an
// inverse transform. Its soles stay horizontal and it follows demo visibility.
const stand = new THREE.Group();
stand.quaternion.copy(deck.quaternion).invert();
stand.position.copy(deck.position).negate().applyQuaternion(stand.quaternion);
deck.add(stand);
const standMaterial = new THREE.MeshStandardMaterial({ color: 0x293638, metalness: .8, roughness: .42 });
const frontZ = 2.25, rearZ = -2.1, soleHeight = .08;
const railBottom = floor.position.y + soleHeight;
const undersideAt = z => deck.position.y + undersideY / Math.cos(deckAngle) - z * Math.tan(deckAngle);
const railShape = new THREE.Shape();
railShape.moveTo(-frontZ, railBottom);
railShape.lineTo(-rearZ, railBottom);
railShape.lineTo(-rearZ, undersideAt(rearZ));
railShape.lineTo(-frontZ, undersideAt(frontZ));
railShape.closePath();
const railGeometry = new THREE.ExtrudeGeometry(railShape, { depth: .22, bevelEnabled: true, bevelThickness: .025, bevelSize: .025, bevelSegments: 3, steps: 1 });
for (const x of [-1.92, 1.92]) {
  const rail = new THREE.Mesh(railGeometry, standMaterial);
  rail.rotation.y = Math.PI / 2;
  rail.position.x = x - .11;
  rail.castShadow = rail.receiveShadow = true;
  stand.add(rail);
  box(stand, .37, soleHeight, frontZ - rearZ + .12, rubber, x, floor.position.y + soleHeight / 2, (frontZ + rearZ) / 2, .035);
}
// Recessed rear brace gives the pair of rails a rigid connection.
box(stand, 3.84, .16, .22, standMaterial, 0, railBottom + .13, rearZ + .22, .045);

// Let the cable fall from the elevated rear port onto the tabletop.
const jack = deck.localToWorld(new THREE.Vector3(0, -.03, -3));
const cablePoints = [jack, jack.clone().add(new THREE.Vector3(0, -.05, -.5)),
  new THREE.Vector3(.3, floor.position.y + .2, jack.z - 1.2),
  new THREE.Vector3(1.5, floor.position.y + .055, jack.z - 1.7),
  new THREE.Vector3(3.6, floor.position.y + .055, jack.z - 3.2)];
cable.geometry.dispose();
cable.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePoints.map(point => deck.worldToLocal(point))), 48, .052, 10, false);

let imported = null, importVersion = 0, audioContext, toastTimer, waveTimer;
function toast(message) {
  $('#toast').textContent = message; $('#toast').classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4200);
}
function pressKey(index) {
  if (imported) return;
  activeIndex = index;
  keys[index].pressedAt = performance.now() / 1000;
  drawScreen(index);
  $('#activity').textContent = actions[index].message;
  $('#wave').classList.add('playing');
  clearTimeout(waveTimer); waveTimer = setTimeout(() => $('#wave').classList.remove('playing'), 1100);
  if ($('#sound').checked) {
    try {
      audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
      audioContext.resume().catch(() => {});
      const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = actions[index].tone;
      gain.gain.setValueAtTime(.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(.12, audioContext.currentTime + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + .2);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(); oscillator.stop(audioContext.currentTime + .22);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    } catch { $('#sound').checked = false; toast('Audio is unavailable in this browser.'); }
  }
}
for (let i = 0; i < 55; i++) { const bar = document.createElement('i'); bar.style.height = `${4 + Math.sin(i * 2.31) ** 2 * 19}px`; bar.style.setProperty('--delay', `${-i * .043}s`); $('#wave').append(bar); }

const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
let pointerStart, activePointers = new Set(), multiTouch = false;
function hit(event) {
  const bounds = renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(hitTargets, false)[0]?.object;
}
renderer.domElement.addEventListener('pointerdown', event => {
  activePointers.add(event.pointerId);
  if (activePointers.size > 1) multiTouch = true;
  else { multiTouch = false; pointerStart = { x: event.clientX, y: event.clientY, time: performance.now() }; }
});
renderer.domElement.addEventListener('pointerup', event => {
  activePointers.delete(event.pointerId);
  if (!imported && !multiTouch && pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) < 7 && performance.now() - pointerStart.time < 700) {
    const object = hit(event);
    if (object?.userData.keyIndex !== undefined) pressKey(object.userData.keyIndex);
    else if (object?.userData.dial) { dial.rotation.y += Math.PI / 6; pressKey((activeIndex + 1) % 4); }
  }
  pointerStart = null;
});
renderer.domElement.addEventListener('pointercancel', event => { activePointers.delete(event.pointerId); pointerStart = null; });

function resetCamera() {
  controls.autoRotate = false; $('#rotate').checked = false;
  controls.target.set(0, .9, 0);
  camera.position.set(7, 10.3, 12.4);
  if (viewport.clientWidth < 550) camera.position.multiplyScalar(Math.max(1.17, .83 / (viewport.clientWidth / viewport.clientHeight)));
  camera.lookAt(controls.target); controls.update();
}
$('#reset').addEventListener('click', resetCamera);
viewport.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'r', 'R'].includes(event.key)) return;
  event.preventDefault();
  if (event.key.toLowerCase() === 'r') { resetCamera(); return; }
  const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  if (event.key === 'ArrowLeft') spherical.theta -= .12;
  if (event.key === 'ArrowRight') spherical.theta += .12;
  if (event.key === 'ArrowUp') spherical.phi -= .12;
  if (event.key === 'ArrowDown') spherical.phi += .12;
  if (event.key === '+' || event.key === '=') spherical.radius *= .92;
  if (event.key === '-') spherical.radius *= 1.08;
  spherical.phi = THREE.MathUtils.clamp(spherical.phi, .05, controls.maxPolarAngle);
  spherical.radius = THREE.MathUtils.clamp(spherical.radius, controls.minDistance, controls.maxDistance);
  camera.position.setFromSpherical(spherical).add(controls.target); controls.update();
});
const finishes = { graphite: '#353b3b', silver: '#b6bfbd', sand: '#bba582', teal: '#386663' };
document.querySelectorAll('[data-finish]').forEach(button => button.addEventListener('click', () => {
  const transparent = button.dataset.finish === 'transparent';
  if (!transparent) metal.color.set(finishes[button.dataset.finish]);
  const roughnessPercent = Math.round((transparent ? clearShell : metal).roughness * 100);
  $('#roughness').value = roughnessPercent;
  $('#roughness-value').textContent = `${roughnessPercent}%`;
  finishParts.forEach(({ mesh, original, transparentMaterial }) => {
    mesh.material = transparent ? transparentMaterial : original;
    mesh.castShadow = !transparent;
  });
  keys.forEach(key => { key.labelMesh.material.map = transparent ? key.transparentLabel : key.label; });
  $('#finish-name').textContent = transparent ? '90s Transparent' : button.dataset.finish[0].toUpperCase() + button.dataset.finish.slice(1);
  document.querySelectorAll('[data-finish]').forEach(item => { const selected = item === button; item.classList.toggle('active', selected); item.setAttribute('aria-pressed', String(selected)); });
}));
$('#roughness').addEventListener('input', event => { metal.roughness = clearShell.roughness = clearCaps.roughness = Number(event.target.value) / 100; $('#roughness-value').textContent = `${event.target.value}%`; });
const lightPresets = {
  studio: { key: '#ffeed7', rim: '#b8d0f5', ambient: 2, strength: 4.2, env: .65, background: 'radial-gradient(ellipse at 50% 62%,#253638 0%,#182325 38%,#101415 75%)' },
  daylight: { key: '#ffffff', rim: '#e0edff', ambient: 3, strength: 5, env: 1, background: 'radial-gradient(ellipse at 50% 62%,#5c7172 0%,#304748 40%,#172526 85%)' },
  noir: { key: '#c5d5ff', rim: '#be7a4a', ambient: .35, strength: 2.8, env: .18, background: 'radial-gradient(ellipse at 50% 62%,#202b3c 0%,#111721 38%,#090d13 75%)' }
};
document.querySelectorAll('[data-light]').forEach(button => button.addEventListener('click', () => {
  const preset = lightPresets[button.dataset.light];
  keyLight.color.set(preset.key); keyLight.intensity = preset.strength; rim.color.set(preset.rim);
  ambient.intensity = preset.ambient; scene.environmentIntensity = preset.env;
  $('.stage').style.background = preset.background;
  document.querySelectorAll('[data-light]').forEach(item => { const selected = item === button; item.classList.toggle('active', selected); item.setAttribute('aria-pressed', String(selected)); });
}));
$('#exposure').addEventListener('input', event => { renderer.toneMappingExposure = Number(event.target.value) / 100; $('#exposure-value').textContent = `${event.target.value}%`; });
$('#rotate').addEventListener('change', event => { controls.autoRotate = event.target.checked; });

// Dispose only replaced imports. Shared demo materials remain alive for the return action.
function disposeModel(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material)); });
  materials.forEach(material => { Object.values(material).forEach(value => { if (value?.isTexture) textures.add(value); }); material.dispose(); });
  textures.forEach(texture => { texture.source?.data?.close?.(); texture.dispose(); });
  geometries.forEach(geometry => geometry.dispose());
}
function demoControls(enabled) {
  $('#finish-controls').disabled = !enabled;
  $('#explode').disabled = !enabled; $('#sound').disabled = !enabled;
  $('#key-access').hidden = !enabled; $('#wave').hidden = !enabled;
  $('#demo').hidden = enabled;
}
async function importModel(file) {
  if (!file) return;
  if (!/\.glb$/i.test(file.name)) { toast('Choose a self-contained .glb model.'); return; }
  if (file.size > 25 * 1024 * 1024) { toast('This model is too large. Please choose a GLB under 25 MB.'); return; }
  const version = ++importVersion;
  $('#loading').hidden = false; $('#loading').textContent = 'Opening your object…';
  let candidate;
  try {
    const buffer = await file.arrayBuffer();
    if (buffer.byteLength < 20 || new DataView(buffer).getUint32(0, true) !== 0x46546c67) throw new Error('Not a valid GLB file.');
    // Permit embedded data only; a local model must never request remote resources.
    const manager = new THREE.LoadingManager();
    manager.setURLModifier(url => { if (/^(blob:|data:)/i.test(url)) return url; throw new Error('Use a self-contained GLB with embedded textures and buffers.'); });
    const gltf = await new GLTFLoader(manager).parseAsync(buffer, '');
    candidate = gltf.scene;
    if (version !== importVersion) { disposeModel(candidate); return; }
    const bounds = new THREE.Box3().setFromObject(candidate);
    const size = bounds.getSize(new THREE.Vector3());
    const max = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(max) || max <= 0) throw new Error('This model has no visible geometry.');
    const wrapper = new THREE.Group(); wrapper.add(candidate);
    const center = bounds.getCenter(new THREE.Vector3());
    candidate.position.sub(center);
    wrapper.scale.setScalar(5.2 / max);
    wrapper.position.y = size.y / max * 2.6 - .4;
    wrapper.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
    if (imported) { scene.remove(imported); disposeModel(imported); }
    imported = wrapper; scene.add(wrapper); deck.visible = false;
    $('#explode').checked = false;
    demoControls(false); resetCamera();
    $('#product-title').textContent = file.name.replace(/\.glb$/i, '');
    $('#product-description').textContent = 'Your object, in a new light. Orbit, set the mood, and capture the perfect angle.';
    $('#model-tag').textContent = 'YOUR GLB MODEL';
    $('#object-code').textContent = 'CUSTOM / ' + file.name;
    $('#model-caption').textContent = 'Your own object. A whole new perspective.';
    $('#activity').textContent = 'Model ready. Make it your own.';
    $('.gesture').textContent = '↔ Drag to orbit · Scroll or pinch to zoom';
    toast('Your object is ready. Everything stays on your device.');
  } catch (error) {
    if (candidate) disposeModel(candidate);
    if (version === importVersion) toast('Could not open this model. Use an uncompressed, self-contained GLB with embedded textures.');
    console.warn('Model import failed:', error.message);
  } finally { if (version === importVersion) $('#loading').hidden = true; }
}
$('#import').addEventListener('click', () => $('#model-file').click());
$('#model-file').addEventListener('change', event => { importModel(event.target.files[0]); event.target.value = ''; });
$('#demo').addEventListener('click', () => {
  ++importVersion;
  if (imported) { scene.remove(imported); disposeModel(imported); imported = null; }
  deck.visible = true; demoControls(true); resetCamera(); $('#loading').hidden = true;
  $('#product-title').innerHTML = 'Ronin Deck<span>™</span>';
  $('#product-description').innerHTML = 'A tactile little home for your big ideas.<br>Machined metal. Mechanical soul.';
  $('#model-tag').textContent = 'INTERACTIVE CONCEPT'; $('#object-code').textContent = 'RV—001 / CONTROL DECK';
  $('#model-caption').textContent = 'An everyday object. An extraordinary amount of detail.';
  $('#activity').textContent = 'Ready when you are.';
  $('.gesture').textContent = '↔ Drag to orbit · Scroll to get closer · Tap a key';
});
let dragDepth = 0;
$('.stage').addEventListener('dragenter', event => { event.preventDefault(); dragDepth++; $('.stage').classList.add('drag-over'); });
$('.stage').addEventListener('dragover', event => event.preventDefault());
$('.stage').addEventListener('dragleave', () => { if (--dragDepth <= 0) $('.stage').classList.remove('drag-over'); });
$('.stage').addEventListener('drop', event => { event.preventDefault(); dragDepth = 0; $('.stage').classList.remove('drag-over'); importModel(event.dataTransfer.files[0]); });
// Prevent a file dropped outside the stage from navigating away from the project.
window.addEventListener('dragover', event => event.preventDefault());
window.addEventListener('drop', event => event.preventDefault());
$('#capture').addEventListener('click', () => {
  const previous = scene.background;
  scene.background = new THREE.Color(0x172526);
  renderer.render(scene, camera);
  renderer.domElement.toBlob(blob => {
    if (!blob) { toast('Could not save the image. Please try again.'); return; }
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'roninstudio-' + Date.now() + '.png';
    link.hidden = true; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast('Your PNG download is ready.');
  }, 'image/png');
  scene.background = previous;
});
const resize = new ResizeObserver(() => {
  const width = viewport.clientWidth, height = viewport.clientHeight;
  renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
});
resize.observe(viewport);
resetCamera();
let lastTime = 0, explosion = 0;
function render(time) {
  const seconds = time / 1000, delta = Math.min(seconds - lastTime, .05); lastTime = seconds;
  if (document.hidden) return;
  const target = $('#explode').checked && !imported ? 1 : 0;
  explosion = reducedMotion ? target : THREE.MathUtils.damp(explosion, target, 6, delta);
  moving.forEach(group => { group.position.y = group.userData.level * explosion; });
  keys.forEach(key => { const age = seconds - key.pressedAt; key.group.position.y = age >= 0 && age < .24 ? -Math.sin(age / .24 * Math.PI) * .12 : 0; });
  controls.update(delta);
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(render);
renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); renderer.setAnimationLoop(null); $('#loading').hidden = false; $('#loading').textContent = 'The graphics context was interrupted. Reload to reopen the studio.'; $('#capture').disabled = true; $('#import').disabled = true; });
$('#loading').hidden = true; $('#capture').disabled = false; $('#import').disabled = false;
