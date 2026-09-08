import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
export function environment(renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const env = pmrem.fromScene(room, .04); scene.environment = env.texture; scene.environmentIntensity = .8;
  room.dispose(); pmrem.dispose();
  const fill = new THREE.HemisphereLight(0xd4e9ef, 0x32383a, 2); scene.add(fill);
  const key = new THREE.DirectionalLight(0xfff0dc, 4); key.position.set(-4, 7, 5); scene.add(key);
  key.castShadow = true; key.shadow.mapSize.set(2048,2048); Object.assign(key.shadow.camera,{left:-7,right:7,top:9,bottom:-7,near:.5,far:30}); key.shadow.bias = -.0003; key.shadow.normalBias = .018;
  const rim = new THREE.DirectionalLight(0xb6dce7, 3); rim.position.set(5, 2, -3); scene.add(rim);
  return { scene, key, fill, rim, dispose: () => env.dispose() };
}
