import { THREE, metal, box, disc, torus, ring, screw, canvasTexture, label, wire, brushedMap, mesh } from './shared.js';

export function createArcReactor() {
  const root = new THREE.Group(), shell = new THREE.Group(), coils = new THREE.Group(), face = new THREE.Group();
  root.add(shell, coils, face);
  const steel = metal(0x8e9ca6, .28), dark = metal(0x202b32, .35), copper = metal(0xb96c3d, .27), brass = metal(0xad935e, .35);
  steel.roughnessMap = brushedMap();
  const light = new THREE.MeshStandardMaterial({ color: 0xb1efff, emissive: 0x4bc9ff, emissiveIntensity: 2.6, roughness: .18 });
  const glass = new THREE.MeshPhysicalMaterial({color:0x75bce8, metalness:0, roughness:.14, transmission:.65, thickness:.2, ior:1.47, clearcoat:1});
  const blueLight = new THREE.MeshStandardMaterial({color:0x125cdd, emissive:0x065aff, emissiveIntensity:1, roughness:.2});
  const coreLight = new THREE.MeshStandardMaterial({color:0xd9f3ff, emissive:0xa4eaff, emissiveIntensity:1.8, roughness:.2});
  ring(shell, 1.98, 1.57, .16, dark, -.19);
  disc(shell, 1.37, .13, dark, -.24);
  // Exposed clear annular chassis, with blue light guides running through it.
  ring(coils, 2.03, 1.55, .23, glass, .02);
  for (const r of [1.61, 1.79, 1.99]) torus(coils, r, .025, blueLight, [0,0,.09]);
  for (const z of [-.11,.16]) { torus(coils, 2.01, .019, steel, [0,0,z]); torus(coils, 1.57, .018, steel, [0,0,z]); }
  // Deep machined vent plate: the light is recessed behind real capsule holes.
  const ventShape = new THREE.Shape(); ventShape.absarc(0,0,1.41,0,Math.PI*2,false);
  const innerCutout = new THREE.Path(); innerCutout.absarc(0,0,.99,0,Math.PI*2,true); ventShape.holes.push(innerCutout);
  for(let i=0;i<30;i++) {
    const a=i*Math.PI*2/30, capsule=new THREE.Path();
    capsule.absarc(0,.065,.0525,0,Math.PI,false); capsule.lineTo(-.0525,-.065);
    capsule.absarc(0,-.065,.0525,Math.PI,Math.PI*2,false); capsule.closePath();
    const hole=new THREE.Path();
    capsule.getPoints(10).reverse().forEach((p,j)=>{ const x=p.x*Math.cos(a)+p.y*Math.sin(a)+Math.sin(a)*1.2, y=-p.x*Math.sin(a)+p.y*Math.cos(a)+Math.cos(a)*1.2; if(j===0)hole.moveTo(x,y);else hole.lineTo(x,y); });
    hole.closePath(); ventShape.holes.push(hole);
  }
  mesh(face,new THREE.ExtrudeGeometry(ventShape,{depth:.15,bevelEnabled:true,bevelSize:.009,bevelThickness:.009,bevelSegments:2,curveSegments:80,steps:1}),dark,[0,0,.19]);
  ring(face,1.39,1.01,.035,blueLight,.15);
  // A stepped central lens barrel projects above the recessed vent plate.
  ring(face,.99,.54,.21,steel,.345);
  ring(face,.87,.54,.16,dark,.49);
  ring(face,.75,.54,.14,steel,.59);
  for(const [r,z] of [[.96,.457],[.84,.578],[.72,.668]]) {
    torus(face,r,.027,coreLight,[0,0,z]); torus(face,r-.043,.014,dark,[0,0,z+.004]);
  }
  torus(face,.605,.036,brass,[0,0,.672]);
  disc(face,.558,.045,coreLight,.662);
  // Energy stays attached to its assembly layer and is occluded by the copper
  // windings and steel braces, including when the reactor is pulled apart.
  const energyTime = { value: 0 }, energyStrength = { value: .7 };
  function energyField(parent, z, surface) {
    const material = new THREE.ShaderMaterial({
      uniforms: { time: energyTime, strength: energyStrength, surface: { value: surface } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      vertexShader: `varying vec2 field;
        void main() { field = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float time;
        uniform float strength;
        uniform float surface;
        varying vec2 field;
        void main() {
          float radius = length(field);
          float angle = atan(field.y, field.x);
          float circulation = 0.5 + 0.5 * sin(angle * 3.0 - time * 1.7 + sin(angle * 7.0 + time) * 0.3);
          float ripple = 0.5 + 0.5 * sin(radius * 24.0 - time * 3.4);
          float breath = 0.88 + 0.12 * sin(time * 2.0);
          float ring = exp(-pow((radius - 1.8) / 0.24, 4.0));
          float core = exp(-pow(radius / 0.82, 6.0));
          float innerHalo = exp(-pow((radius - 0.56) / 0.09, 2.0));
          float fieldGlow = surface < 0.5
            ? (ring * (0.38 + circulation * 0.32 + ripple * 0.1) + core * (0.4 + ripple * 0.2))
            : (innerHalo * (0.42 + circulation * 0.15) + core * 0.12);
          float alpha = fieldGlow * strength * breath;
          vec3 color = mix(vec3(0.025, 0.28, 1.0), vec3(0.3, 0.7, 1.0), ripple * 0.28);
          gl_FragColor = vec4(color, alpha);
          #include <colorspace_fragment>
        }`
    });
    const glow = mesh(parent, new THREE.PlaneGeometry(4.7, 4.7), material, [0, 0, z]);
    glow.castShadow = false; glow.receiveShadow = false;
  }
  energyField(coils, .17, 0);
  energyField(face, .704, 1);
  const spill = new THREE.PointLight(0x287aff, 1.8, 4, 2);
  spill.position.set(0, 0, .85); face.add(spill);
  // Rectangular copper windings sit on top of the exposed annular chassis.
  const loopPoints = [[-.22,-.12],[-.18,-.16],[.18,-.16],[.22,-.12],[.22,.12],[.18,.16],[-.18,.16],[-.22,.12]];
  const windingPath = new THREE.CatmullRomCurve3(loopPoints.map(([x,z])=>new THREE.Vector3(x,0,z)),true,'centripetal');
  const windingGeometry = new THREE.TubeGeometry(windingPath,40,.011,6,true);
  for (let i=0;i<10;i++) {
    const a=i*Math.PI*2/10+.12, bobbin=new THREE.Group(); bobbin.position.set(Math.sin(a)*1.86,Math.cos(a)*1.86,.23); bobbin.rotation.z=-a; coils.add(bobbin);
    box(bobbin,[.47,.62,.3],dark,[0,0,0],.025);
    for(let j=0;j<22;j++) mesh(bobbin,windingGeometry,copper,[0,-.275+j*.026,.02]);
    for(const y of [-.325,.325]) { box(bobbin,[.57,.058,.36],dark,[0,y,0],.018); for(const x of [-.26,.26]) screw(bobbin,x,y,.195,brass,.044); }
    box(bobbin,[.42,.13,.06],steel,[0,-.43,-.015],.015);
    wire(coils,[[Math.sin(a)*1.62,Math.cos(a)*1.62,.15],[Math.sin(a)*1.51,Math.cos(a)*1.51,.26],[Math.sin(a)*1.39,Math.cos(a)*1.39,.24]],copper,.016);
  }
  // Three black mounting tabs and fine radial bridges leave the core unobstructed.
  for(let i=0;i<3;i++) {
    const a=i*Math.PI*2/3, support=new THREE.Group(); support.rotation.z=-a; face.add(support);
    box(support,[.31,.35,.09],dark,[0,1.25,.37],.025);
    for(const x of [-.08,0,.08]) wire(support,[[x,1.13,.38],[x,.99,.48],[x,.83,.59],[x,.63,.70]],dark,.013);
    for(const x of [-.08,.08]) screw(support,x,1.28,.427,steel,.026);
  }
  wire(shell,[[.1,-1.35,-.22],[.12,-1.94,-.22],[.06,-2.32,-.2],[-.02,-2.56,-.18]],dark,.037);
  wire(shell,[[.18,-1.35,-.23],[.2,-1.94,-.23],[.14,-2.32,-.21],[.07,-2.56,-.19]],dark,.029);
  // Rear electronics, terminals and etched markings reward a full orbit.
  box(shell, [.85, .48, .1], metal(0x1d4740, .65, .2), [0, 0, -.36]);
  box(shell, [.32, .26, .06], dark, [0, 0, -.44]);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) box(shell, [.06, .018, .03], steel, [side * .2, -.1 + i * .04, -.43], .003);
    disc(shell, .09, .12, brass, -.38, side * .95, -.5);
    wire(shell, [[side * .95, -.5, -.44], [side * .8, -.95, -.50], [side * .2, -.3, -.45]], side === 1 ? copper : dark, .032);
  }
  const etch = canvasTexture(512, 128, c => { c.fillStyle = '#bccbd0'; c.textAlign = 'center'; c.font = '18px monospace'; c.fillText('PALLADIUM CORE / REACTOR 01', 256, 47); c.font = '13px monospace'; c.fillText('STARK-INSPIRED   •   STUDIO EDITION', 256, 82); });
  const rearLabel = label(shell, etch, 2.2, .55, [0, .93, -.312]); rearLabel.rotation.y = Math.PI;
  // Move the rear assembly back and connect it to the front with an open cage.
  // These are assembled offsets; explosion adds separation on top of them.
  shell.children.forEach(part => part.position.z -= .8);
  ring(shell,2.04,1.84,.10,steel,-.95);
  ring(shell,2.04,1.87,.075,dark,-.17);
  ring(shell,1.91,1.75,.07,blueLight,-.83);
  ring(shell,1.42,1.26,.74,dark,-.60);
  for(const z of [-.85,-.65,-.45,-.25]) torus(shell,1.44,.023,steel,[0,0,z]);
  for(let i=0;i<15;i++) {
    const a=i*Math.PI*2/15, rib=box(shell,[.13,.10,.87],steel,[Math.sin(a)*1.98,Math.cos(a)*1.98,-.56],.018);
    rib.rotation.z=-a;
    const socket=box(shell,[.21,.13,.14],dark,[Math.sin(a)*1.98,Math.cos(a)*1.98,-.17],.022); socket.rotation.z=-a;
  }
  let powered = true, output = 70, exploded = 0, energy = .7;
  return {
    root, materials: [steel], framing: { target: [0, 0, 0], position: [4.2, 2.4, 8.5] },
    actions: [{ id: 'power', label: 'Reactor power', type: 'toggle', value: true }, { id: 'output', label: 'Core output', type: 'range', value: 70, min: 10, max: 100, suffix: '%' }],
    hitTargets: [{ object: root, action: 'power' }],
    act(id, value) { if (id === 'power') powered = value ?? !powered; if (id === 'output') output = Number(value); return powered ? `Core online · ${output}% output` : 'Core offline'; },
    getState() { return { power: powered, output }; },
    update(dt, time, explode, reduced) {
      exploded = reduced ? explode : THREE.MathUtils.damp(exploded, explode, 6, dt);
      face.position.z = exploded * 1.25; coils.position.z = exploded * .5; shell.position.z = -exploded * .25;
      energy = reduced ? (powered ? output / 100 : 0) : THREE.MathUtils.damp(energy, powered ? output / 100 : 0, 4.5, dt);
      energyTime.value = reduced ? 0 : time;
      energyStrength.value = energy;
      const pulse = reduced ? 1 : 1 + Math.sin(time * 2) * .12 + Math.sin(time * 3.7) * .035;
      light.emissiveIntensity = energy * 1.25 * pulse;
      light.color.set(0x44595e).lerp(new THREE.Color(0x70c3db), energy);
      blueLight.emissiveIntensity = energy * 1.8 * pulse;
      coreLight.emissiveIntensity = energy * 2.3 * pulse;
      coreLight.color.set(0x354653).lerp(new THREE.Color(0xd9f3ff),energy);
      spill.intensity = energy * 3.2 * pulse;
    },
    status: 'Core online · 70% output'
  };
}
