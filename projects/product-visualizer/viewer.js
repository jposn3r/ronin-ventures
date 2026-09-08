import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { collection, loadModel } from './collection.js';
import { environment } from './environment.js';
const $ = s => document.querySelector(s);
const item = collection.find(o => o.id === new URLSearchParams(location.search).get('object') && o.id !== 'ronin-deck');
if (!item) throw new Error('Object not found. Return to the collection.');
document.title = `${item.name} | roninstudio`;
$('#object-tagline').textContent = item.tagline; $('#object-edition').textContent = item.edition;
$('#object-code').textContent = `OBJECT / ${item.number}`; $('#material-caption').textContent = item.material;
$('#model-caption').textContent = item.hint; $('#edition-label').textContent = `${item.number} / ${item.category.toUpperCase()}`;
$('#product-title').textContent = item.name; $('#product-description').textContent = item.description;
for (const [key, value] of item.facts) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = key; dd.textContent = value; $('#object-facts').append(dt, dd); }
const host = $('#viewport'), renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
host.append(renderer.domElement);
const env = environment(renderer), scene = env.scene, camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.minDistance = 3; controls.maxDistance = 35;
const model = await loadModel(item.id); scene.add(model.root);
$('#roughness').value = Math.round(model.materials[0].roughness*100); $('#roughness-value').textContent = $('#roughness').value+'%';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let cameraTransition;
controls.addEventListener('start', () => { cameraTransition = null; });
function frame(animate = false) {
  const f = model.framing, target = new THREE.Vector3(...f.target);
  target.y += innerWidth <= 700 ? .65 : .3;
  const spacing = innerWidth > 700 && innerWidth < 1000 ? 1.4 : 1.15;
  const position = new THREE.Vector3(...f.position).sub(new THREE.Vector3(...f.target)).multiplyScalar(Math.max(1, .78 / camera.aspect)*spacing).add(target);
  if (animate && !reduced.matches) cameraTransition = { from: camera.position.clone(), fromTarget: controls.target.clone(), position, target, elapsed: 0 };
  else { cameraTransition = null; camera.position.copy(position); controls.target.copy(target); controls.update(); }
}
function animateCamera(dt) {
  if (!cameraTransition) return;
  const t = cameraTransition; t.elapsed += dt;
  const progress = reduced.matches ? 1 : Math.min(t.elapsed / .95, 1);
  const eased = THREE.MathUtils.smootherstep(progress, 0, 1);
  camera.position.lerpVectors(t.from, t.position, eased); controls.target.lerpVectors(t.fromTarget, t.target, eased);
  if (progress === 1) cameraTransition = null;
}
function resize() { const { width, height } = host.getBoundingClientRect(); renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); frame(); }
new ResizeObserver(resize).observe(host); resize();
let audio, nextNote = 0, beat = 0;
function tone(frequency, duration = .09, volume = .025) { if (!audio || audio.state !== 'running' || !$('#sound').checked) return; const oscillator = audio.createOscillator(), gain = audio.createGain(); oscillator.type = 'sine'; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(volume, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration); oscillator.connect(gain).connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + duration); }
function sync() { const state = model.getState(); for (const action of model.actions) { const input = $('#action-' + action.id); if (action.type === 'toggle') input.checked = state[action.id]; else if (action.type === 'select') input.value = state[action.id]; } }
function act(id, value) { $('#activity').textContent = model.act(id, value); sync(); tone(id === 'ignite' ? 165 : 660); if (model.actions.find(a => a.id === id)?.reframe) frame(true); }
for (const action of model.actions) {
  const row = document.createElement('div'); row.className = action.type === 'toggle' ? 'toggle-row' : 'object-action';
  const input = document.createElement(action.type === 'button' ? 'button' : action.type === 'select' ? 'select' : 'input'); input.id = 'action-' + action.id;
  if (action.type === 'button') { input.className = 'action-button'; input.textContent = action.label; input.addEventListener('click', () => act(action.id)); }
  else { const label = document.createElement('label'); label.htmlFor = input.id; label.textContent = action.label; row.append(label);
    if (action.type === 'toggle') { input.type = 'checkbox'; input.setAttribute('role', 'switch'); input.checked = action.value; }
    if (action.type === 'select') { input.className = 'action-select'; for (const option of action.options) input.add(new Option(option.label, option.value)); }
    if (action.type === 'range') { input.type = 'range'; input.min = action.min; input.max = action.max; input.value = action.value; const output = document.createElement('output'); output.textContent = action.value + action.suffix; label.append(' ', output); input.addEventListener('input', () => output.textContent = input.value + action.suffix); }
    input.addEventListener(action.type === 'range' ? 'input' : 'change', () => act(action.id, action.type === 'toggle' ? input.checked : action.type === 'range' ? Number(input.value) : input.value));
  } row.append(input); $('#action-controls').append(row);
}
const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(); let down, wheelDrag;
function pointRay(e) { const r = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX-r.left)/r.width*2-1, -(e.clientY-r.top)/r.height*2+1); ray.setFromCamera(pointer,camera); }
function firstSolidHit() { return ray.intersectObject(model.root,true).find(hit => !(hit.object.geometry?.type === 'PlaneGeometry' && hit.object.material.transparent)); }
if (model.wheelTarget) {
  renderer.domElement.addEventListener('pointerdown', e => { pointRay(e); const hit = firstSolidHit(); if(hit?.object !== model.wheelTarget) return; const center = model.wheelTarget.getWorldPosition(new THREE.Vector3()), normal = new THREE.Vector3(0,0,1).applyQuaternion(model.wheelTarget.parent.getWorldQuaternion(new THREE.Quaternion())); const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal,center), local = model.wheelTarget.parent.worldToLocal(hit.point.clone()); wheelDrag = { plane, angle:Math.atan2(local.y-model.wheelTarget.position.y,local.x-model.wheelTarget.position.x), moved:false }; controls.enabled=false; renderer.domElement.setPointerCapture(e.pointerId); },true);
  renderer.domElement.addEventListener('pointermove', e => { if(!wheelDrag) return; pointRay(e); const p = ray.ray.intersectPlane(wheelDrag.plane,new THREE.Vector3()); if(!p) return; const local = model.wheelTarget.parent.worldToLocal(p); const angle = Math.atan2(local.y-model.wheelTarget.position.y,local.x-model.wheelTarget.position.x); const delta = Math.atan2(Math.sin(angle-wheelDrag.angle),Math.cos(angle-wheelDrag.angle)); if(Math.abs(delta)>.3) { act(delta<0?'next':'previous'); wheelDrag.angle=angle; wheelDrag.moved=true; } },true);
  renderer.domElement.addEventListener('pointercancel', () => { wheelDrag=null; controls.enabled=true; });
}
renderer.domElement.addEventListener('pointerdown', e => down = [e.clientX, e.clientY]);
renderer.domElement.addEventListener('pointerup', e => { const wheelMoved=wheelDrag?.moved; wheelDrag=null; controls.enabled=true; if (wheelMoved || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 7) return; pointRay(e); const hit = firstSolidHit(); if (!hit) return; for (const target of model.hitTargets) { let object = hit.object; while(object) { if(object === target.object) { act(target.action); return; } object = object.parent; } } });
$('#roughness').addEventListener('input', e => { $('#roughness-value').textContent = e.target.value + '%'; model.materials.forEach(m => m.roughness = Number(e.target.value)/100); });
$('#exposure').addEventListener('input', e => { renderer.toneMappingExposure = Number(e.target.value)/100; $('#exposure-value').textContent = e.target.value+'%'; });
document.querySelectorAll('[data-light]').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('[data-light]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', b === button); }); const mode = button.dataset.light; env.fill.intensity = mode === 'noir' ? .25 : mode === 'daylight' ? 3 : 2; env.key.color.set(mode === 'daylight' ? 0xffffff : 0xfff0dc); env.rim.intensity = mode === 'noir' ? 5 : 3; scene.environmentIntensity = mode === 'noir' ? .3 : .8; }));
$('#sound').addEventListener('change', async () => { if ($('#sound').checked) { audio ||= new AudioContext(); await audio.resume(); tone(440,.2); } else if (audio) await audio.suspend(); });
$('#reset').addEventListener('click', () => { model.root.rotation.set(0,0,0); $('#rotate').checked = false; frame(); });
host.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'r') frame(); else if (e.key === '+' || e.key === '=') camera.position.lerp(controls.target,.1); else if(e.key === '-') camera.position.sub(controls.target).multiplyScalar(1.1).add(controls.target); else if(e.key.startsWith('Arrow')) { e.preventDefault(); model.root.rotation[e.key === 'ArrowUp' || e.key === 'ArrowDown' ? 'x' : 'y'] += ['ArrowLeft','ArrowUp'].includes(e.key) ? -.12 : .12; } });
$('#capture').addEventListener('click', () => { renderer.render(scene,camera); const a = document.createElement('a'); a.download = `roninstudio-${item.id}.png`; a.href = renderer.domElement.toDataURL('image/png'); a.click(); });
renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); $('#loading').hidden = false; $('#loading').textContent = 'Graphics paused. Reload to restore the viewer.'; });
document.querySelectorAll('fieldset').forEach(f => f.disabled = false); $('#capture').disabled = false; $('#loading').hidden = true; $('#activity').textContent = model.status;
let last = performance.now();
renderer.setAnimationLoop(time => { const dt = Math.min((time-last)/1000,.05); last=time; if(document.hidden) return; animateCamera(dt); model.update(dt,time/1000,Number($('#explode').checked),reduced.matches); if($('#rotate').checked && !reduced.matches) model.root.rotation.y += dt*.25; controls.update(); const state = model.getState(); if(item.id === 'ipod' && state.playing && audio && audio.currentTime > nextNote) { tone([261.63,329.63,392,523.25,440,392,329.63,293.66][(beat++ + state.track*2)%8],.3,.035); nextNote=audio.currentTime+.3; } renderer.render(scene,camera); });
document.addEventListener('visibilitychange', () => { if(document.hidden) audio?.suspend(); else if($('#sound').checked) audio?.resume(); });
