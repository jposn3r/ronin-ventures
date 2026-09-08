import * as THREE from 'three';
import { collection, loadModel } from './collection.js';
import { environment } from './environment.js';
const hosts = [...document.querySelectorAll('.preview-host')], hero = hosts[0];
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-filter]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', b === button); });
  let count = 0; document.querySelectorAll('.object-card').forEach(card => { card.hidden = button.dataset.filter !== 'All' && card.dataset.category !== button.dataset.filter; if (!card.hidden) count++; });
  document.querySelector('#filter-status').textContent = `Showing ${count} ${count === 1 ? 'object' : 'objects'}`;
}));
try {
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, preserveDrawingBuffer:true });
  renderer.domElement.setAttribute('aria-hidden','true'); renderer.domElement.style.pointerEvents = 'none';
  const env = environment(renderer), camera = new THREE.PerspectiveCamera(34,1,.1,100), models = new Map();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  for (const item of collection) { const model = await loadModel(item.id); models.set(item.id,model); model.root.visible = false; env.scene.add(model.root); }
  let active, activeModel;
  function setup(host) {
    if(activeModel) { activeModel.root.visible = false; activeModel.root.rotation.set(0,0,0); }
    activeModel = models.get(host.dataset.model); activeModel.root.visible = true;
    const r = host.getBoundingClientRect(), w = r.width || 500, h = r.height || 350;
    renderer.setSize(w,h); camera.aspect = w/h; camera.updateProjectionMatrix();
    const f = activeModel.framing, target = new THREE.Vector3(...f.target); target.y -= host === hero ? .3 : 0;
    camera.position.fromArray(f.position).sub(new THREE.Vector3(...f.target)).multiplyScalar(Math.max(1,.95/camera.aspect) * (host === hero && innerWidth <= 700 ? 1.15 : 1.05)).add(target); camera.lookAt(target);
    activeModel.update(1,0,0,true); renderer.render(env.scene,camera);
  }
  function thumbnails() { for(const host of hosts) { setup(host); let img = host.querySelector('img'); if(!img) { img = document.createElement('img'); img.alt = ''; host.append(img); } img.src = renderer.domElement.toDataURL('image/png'); host.classList.add('loaded'); } }
  function activate(host) { active?.classList.remove('live-preview'); active = host; setup(host); host.classList.add('live-preview'); host.append(renderer.domElement); }
  thumbnails(); activate(hero);
  for(const host of hosts) { const link = host.closest('a'); link.addEventListener('pointerenter', e => { if(e.pointerType !== 'touch') activate(host); }); link.addEventListener('pointerleave', () => activate(hero)); link.addEventListener('focus', () => activate(host)); link.addEventListener('blur', () => activate(hero)); }
  let last = 0;
  renderer.setAnimationLoop(time => { const dt = Math.min((time-last)/1000,.05); last=time; if(document.hidden || reduced.matches || !active) return; const r=active.getBoundingClientRect(); if(r.bottom<0 || r.top>innerHeight) return; activeModel.root.rotation.y = Math.sin(time*.00035)*.2; activeModel.update(dt,time/1000,0,reduced.matches); renderer.render(env.scene,camera); });
  let timer; window.addEventListener('resize', () => { clearTimeout(timer); timer=setTimeout(() => { thumbnails(); activate(active || hero); },150); });
} catch(error) { console.error(error); hosts.forEach(host => { host.querySelector('.preview-fallback').textContent = '↗'; }); }
