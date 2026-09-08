import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export { THREE };
export function metal(color = 0xa3aab0, roughness = .3, metalness = .9) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
export function mesh(parent, geometry, material, position = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position); object.castShadow = object.receiveShadow = true;
  parent.add(object); return object;
}
export function box(parent, size, material, position, radius = .05) {
  return mesh(parent, new RoundedBoxGeometry(...size, 3, radius), material, position);
}
export function cylinder(parent, radius, height, material, position = [0, 0, 0], radiusTop = radius, segments = 64) {
  return mesh(parent, new THREE.CylinderGeometry(radiusTop, radius, height, segments), material, position);
}
export function disc(parent, radius, depth, material, z = 0, x = 0, y = 0) {
  const object = cylinder(parent, radius, depth, material, [x, y, z]); object.rotation.x = Math.PI / 2; return object;
}
export function torus(parent, radius, tube, material, position = [0, 0, 0]) {
  return mesh(parent, new THREE.TorusGeometry(radius, tube, 10, 80), material, position);
}
export function ring(parent, outer, inner, depth, material, z = 0) {
  const shape = new THREE.Shape(); shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, inner, 0, Math.PI * 2, true); shape.holes.push(hole);
  return mesh(parent, new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 2, bevelSize: .018, bevelThickness: .018, curveSegments: 80, steps: 1 }), material, [0, 0, z - depth / 2]);
}
export function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
export function label(parent, texture, width, height, position = [0, 0, 0]) {
  return mesh(parent, new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), position);
}
export function screw(parent, x, y, z, material, size = .07) {
  const head = disc(parent, size, .025, material, z, x, y);
  const inset = metal(0x242d31, .6, .2);
  box(parent, [size * 1.1, .015, .008], inset, [x, y, z + .016], .003);
  box(parent, [.015, size * 1.1, .008], inset, [x, y, z + .017], .003);
  return head;
}
export function wire(parent, points, material, radius = .02) {
  return mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 32, radius, 8, false), material);
}
export function brushedMap() {
  return canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = '#999'; c.fillRect(0, 0, w, h);
    let seed = 514;
    for (let y = 0; y < h; y++) { seed = (seed * 16807) % 2147483647; const v = 115 + seed % 60; c.strokeStyle = `rgb(${v},${v},${v})`; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  });
}
export function dispose(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); });
  materials.forEach(m => { Object.values(m).forEach(v => { if (v?.isTexture) textures.add(v); }); m.dispose(); });
  geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose());
}
