import { THREE, metal, box, disc, torus, label, canvasTexture, screw, brushedMap, mesh } from './shared.js';

export function createIPod() {
  const root = new THREE.Group(), back = new THREE.Group(), board = new THREE.Group(), front = new THREE.Group(); root.add(back, board, front);
  const chrome = metal(0xbfc5cc, .18), plastic = new THREE.MeshPhysicalMaterial({ color: 0xf0f0e9, roughness: .22, clearcoat: .85, metalness: 0 });
  chrome.roughnessMap = brushedMap();
  const dark = metal(0x323a3d, .45, .3), white = metal(0xe9e9e1, .3, .02);
  // Rounded silhouette independent of depth: a thin box otherwise clamps corner
  // radius to half its thickness and leaves a square ledge behind the face.
  function shellPanel(parent, width, height, depth, radius, z, material, bevel = .025) {
    const shape = new THREE.Shape(), x = -width / 2 + bevel, y = -height / 2 + bevel;
    const w = width - bevel * 2, h = height - bevel * 2, r = radius - bevel;
    shape.moveTo(x + r, y); shape.lineTo(x + w - r, y);
    shape.quadraticCurveTo(x + w, y, x + w, y + r); shape.lineTo(x + w, y + h - r);
    shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h); shape.lineTo(x + r, y + h);
    shape.quadraticCurveTo(x, y + h, x, y + h - r); shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);
    return mesh(parent, new THREE.ExtrudeGeometry(shape, {depth: depth - 2 * bevel, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 4, curveSegments: 16, steps: 1}), material, [0, 0, z - depth / 2 + bevel]);
  }
  shellPanel(back, 2.5, 4.12, .5, .22, -.13, chrome, .055);
  shellPanel(front, 2.47, 4.08, .27, .21, .2, plastic, .035);
  box(board, [2.12, 3.7, .055], metal(0x255e48, .7, .2), [0, 0, .015], .09);
  box(board, [1.78, 1.7, .12], chrome, [0, -.65, .08], .1);
  disc(board, .58, .025, dark, .155, 0, -.68);
  disc(board, .16, .03, chrome, .177, 0, -.68);
  box(board, [1.7, .75, .15], metal(0x393e46, .7, .05), [0, 1.15, .09], .05);
  const batteryLabel = canvasTexture(512, 160, c => { c.fillStyle = '#b6c2bb'; c.textAlign = 'center'; c.font = '22px monospace'; c.fillText('Li-ion / 3.7 V', 256, 69); c.font = '15px monospace'; c.fillText('RECHARGEABLE BATTERY', 256, 106); });
  label(board, batteryLabel, 1.4, .4, [0, 1.15, .17]);
  for (const x of [-.92, .92]) for (const y of [-1.75, 1.75]) screw(board, x, y, .08, chrome, .045);
  box(board, [.5, .35, .08], dark, [.55, .34, .08]);
  for (let i = 0; i < 9; i++) box(board, [.018, .13, .015], chrome, [.35 + i * .047, .59, .09], .003);
  // Original model's top FireWire port, headphone jack, and hold switch.
  const jack = disc(front, .105, .026, dark, 0, .83, 0); jack.rotation.x = 0; jack.position.set(.84, 2.06, 0);
  box(front, [.4, .04, .2], dark, [-.12, 2.06, 0], .025);
  box(front, [.31, .045, .13], chrome, [-.12, 2.066, 0], .02);
  box(front, [.4, .035, .12], dark, [-.82, 2.065, .06], .02);
  const holdSwitch = box(front, [.17, .06, .12], white, [-.92, 2.085, .06], .025);
  box(front, [1.91, 1.5, .022], metal(0xabb6a7, .4, .1), [0, 1.04, .34], .065);
  const screenCanvas = document.createElement('canvas'); screenCanvas.width = 480; screenCanvas.height = 360;
  const context = screenCanvas.getContext('2d'), screenTexture = new THREE.CanvasTexture(screenCanvas); screenTexture.colorSpace = THREE.SRGBColorSpace;
  const screen = label(front, screenTexture, 1.77, 1.33, [0, 1.04, .353]); screen.material.transparent = false; screen.material.depthWrite = true;
  const wheelY = -.76;
  const wheel = disc(front, .805, .026, white, .35, 0, wheelY);
  const seam = metal(0x929b9b, .37, .2);
  torus(front, .82, .008, seam, [0, wheelY, .359]);
  torus(front, 1.018, .009, seam, [0, wheelY, .35]);
  const center = disc(front, .29, .033, plastic, .363, 0, wheelY);
  torus(front, .296, .006, seam, [0, wheelY, .371]);
  const menu = ['Playlists', 'Artists', 'Songs', 'Settings', 'About'];
  const tracks = ['First Light', 'Late Departure', 'Soft Circuit'];
  let selected = 0, page = 'menu', playing = false, held = false, backlight = true, track = 0, elapsed = 0, exploded = 0, wheelAngle = 0;
  const controls = [];
  // Four flush annular buttons, with diagonal seams, surround the scroll wheel.
  const icons = [['menu', 'MENU', Math.PI / 2], ['previous', '◀◀', Math.PI], ['next', '▶▶', 0], ['play', '▶Ⅱ', -Math.PI / 2]];
  icons.forEach(([id, text, angle]) => {
    const shape = new THREE.Shape(), a = angle - Math.PI / 4 + .012, b = angle + Math.PI / 4 - .012;
    shape.absarc(0, 0, 1.005, a, b, false); shape.absarc(0, 0, .835, b, a, true); shape.closePath();
    const button = mesh(front, new THREE.ExtrudeGeometry(shape, {depth: .013, bevelEnabled:true, bevelSize:.007, bevelThickness:.007, bevelSegments:3, curveSegments:24, steps:1}), plastic, [0, wheelY, .338]);
    const texture = canvasTexture(192, 96, c => { c.fillStyle = '#727a78'; c.font = id === 'menu' ? 'bold 28px Arial' : '27px Arial'; c.textAlign = 'center'; c.fillText(text, 96, 60); });
    label(front, texture, .3, .15, [Math.cos(angle) * .922, wheelY + Math.sin(angle) * .922, .36]); controls.push({ object: button, action: id });
  });
  const wheelMarks = canvasTexture(512, 512, (c, w) => { c.strokeStyle = '#e2e4df'; c.lineWidth = 1; for (let i = 0; i < 100; i++) { const a = i * Math.PI * 2 / 100; c.beginPath(); c.moveTo(256 + Math.cos(a) * 210, 256 + Math.sin(a) * 210); c.lineTo(256 + Math.cos(a) * 220, 256 + Math.sin(a) * 220); c.stroke(); } });
  const wheelMarkMesh = label(front, wheelMarks, 1.32, 1.32, [0, wheelY, .365]);
  const rearText = canvasTexture(512, 512, c => { c.fillStyle = '#6f767c'; c.textAlign = 'center'; c.font = '62px Arial'; c.fillText('iPod', 256, 150); c.font = '18px Arial'; c.fillText('5 GB', 256, 210); c.font = '13px Arial'; c.fillText('Designed by Apple in California', 256, 380); c.fillText('2001 • Scroll Wheel', 256, 408); });
  const rearLabel = label(back, rearText, 1.9, 2.5, [0, 0, -.389]); rearLabel.rotation.y = Math.PI;
  function draw() {
    const c = context; c.fillStyle = backlight ? '#b6c5b1' : '#87967f'; c.fillRect(0, 0, 480, 360);
    c.fillStyle = '#293329'; c.font = 'bold 29px monospace'; c.fillText(page === 'playing' ? 'Now Playing' : page === 'menu' ? 'iPod' : page === 'about' ? 'About' : page === 'settings' ? 'Settings' : 'Music', 18, 38);
    c.strokeStyle = '#293329'; c.lineWidth = 3; c.strokeRect(412, 15, 45, 22); c.fillRect(417, 20, 31, 12); c.fillRect(458, 21, 5, 10); c.fillRect(0, 53, 480, 3);
    if (held) { c.font = '20px monospace'; c.fillText('HOLD', 317, 35); }
    if (page === 'menu' || page === 'songs') {
      const list = page === 'menu' ? menu : tracks;
      list.forEach((text, i) => { const y = 67 + i * 55; c.fillStyle = selected === i ? '#293329' : (backlight ? '#b6c5b1' : '#87967f'); c.fillRect(7, y, 466, 49); c.fillStyle = selected === i ? '#c9d6c1' : '#293329'; c.font = 'bold 29px monospace'; c.fillText(text, 20, y + 34); c.fillText('›', 440, y + 34); });
    } else if (page === 'playing') {
      c.font = 'bold 32px monospace'; c.fillText(tracks[track], 20, 118); c.font = '25px monospace'; c.fillText('Ronin Studio', 20, 163); c.fillText('Original demo sounds', 20, 201);
      c.strokeRect(20, 251, 440, 15); c.fillRect(23, 254, (elapsed % 60) / 60 * 434, 9); c.font = '23px monospace'; c.fillText(`${playing ? '▶' : 'Ⅱ'} 0:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`, 20, 313); c.fillText('1:00', 392, 313);
    } else { c.font = '25px monospace'; (page === 'about' ? ['iPod · Scroll Wheel', 'Capacity: 5 GB', 'Introduced: 2001', 'Studio reconstruction'] : ['Backlight: ' + (backlight ? 'On' : 'Off'), 'Select to toggle', 'Menu to go back']).forEach((line, i) => c.fillText(line, 18, 106 + i * 57)); }
    screenTexture.needsUpdate = true;
  }
  draw(); let lastSecond = -1;
  return {
    root, wheelTarget: wheel, materials: [chrome], framing: { target: [0, 0, 0], position: [3.4, 1.9, 8.6] },
    actions: [{ id: 'previous', label: 'Previous / scroll up', type: 'button' }, { id: 'next', label: 'Next / scroll down', type: 'button' }, { id: 'select', label: 'Select', type: 'button' }, { id: 'menu', label: 'Menu / back', type: 'button' }, { id: 'play', label: 'Play / pause', type: 'button' }, { id: 'hold', label: 'Hold switch', type: 'toggle', value: false }, { id: 'backlight', label: 'Screen backlight', type: 'toggle', value: true }],
    hitTargets: [...controls, { object: center, action: 'select' }, { object: wheel, action: 'next' }, { object: holdSwitch, action: 'hold' }],
    act(id, value) {
      if (id === 'hold') { held = value ?? !held; holdSwitch.position.x = held ? -.72 : -.92; draw(); return held ? 'Hold enabled · controls locked' : 'Hold released'; }
      if (held) return 'Release Hold to use the controls';
      if (id === 'backlight') backlight = value ?? !backlight;
      if (id === 'menu') { page = 'menu'; selected = 0; }
      if (id === 'next' || id === 'previous') {
        const step = id === 'next' ? 1 : -1; wheelAngle -= step * .25;
        if (page === 'playing') { track = (track + step + tracks.length) % tracks.length; elapsed = 0; }
        else selected = (selected + step + (page === 'menu' ? menu.length : tracks.length)) % (page === 'menu' ? menu.length : tracks.length);
      }
      if (id === 'select') {
        if (page === 'menu') { page = selected === 4 ? 'about' : selected === 3 ? 'settings' : 'songs'; selected = 0; }
        else if (page === 'songs') { track = selected; page = 'playing'; playing = true; elapsed = 0; }
        else if (page === 'settings') backlight = !backlight;
        else if (page === 'playing') playing = !playing;
      }
      if (id === 'play') { playing = !playing; page = 'playing'; }
      draw();
      return page === 'playing' ? `${playing ? 'Playing' : 'Paused'} · ${tracks[track]}` : page === 'menu' ? `iPod menu · ${menu[selected]}` : page === 'songs' ? `Music · ${tracks[selected]}` : page === 'about' ? 'Original iPod · 2001 · 5 GB' : 'Backlight ' + (backlight ? 'on' : 'off');
    },
    getState() { return { hold: held, backlight, playing, track }; },
    update(dt, time, explode, reduced) {
      exploded = reduced ? explode : THREE.MathUtils.damp(exploded, explode, 6, dt);
      front.position.z = exploded * 1.15; back.position.z = -exploded * .55;
      wheelMarkMesh.rotation.z = reduced ? wheelAngle : THREE.MathUtils.damp(wheelMarkMesh.rotation.z, wheelAngle, 10, dt);
      if (playing) elapsed += dt;
      if (Math.floor(elapsed) !== lastSecond && page === 'playing') { draw(); lastSecond = Math.floor(elapsed); }
    }, status: 'Scroll the wheel · select to explore'
  };
}
