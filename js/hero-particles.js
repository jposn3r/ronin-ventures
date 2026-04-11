/**
 * Ronin Ventures - Liquid Veil
 * Full-screen fluid shader with reactive mouse/touch distortion.
 * Inspired by flowing liquid marble with glowing edge highlights.
 */

import * as THREE from 'three';

class LiquidVeil {
    constructor() {
        this.canvas = document.getElementById('hero-canvas');
        this.hero = document.getElementById('hero');
        if (!this.canvas || !this.hero) return;

        this.mouse = new THREE.Vector2(0.5, 0.5);
        this.targetMouse = new THREE.Vector2(0.5, 0.5);
        this.prevMouse = new THREE.Vector2(0.5, 0.5);
        this.velocity = new THREE.Vector2(0, 0);
        this.isVisible = true;
        this.clock = new THREE.Clock();

        this.init();
        this.bindEvents();
        this.animate();
    }

    init() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: false,
            antialias: false,
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(this.hero.offsetWidth, this.hero.offsetHeight);

        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        // Full-screen quad
        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uMouse: { value: new THREE.Vector2(0.5, 0.5) },
                uVelocity: { value: new THREE.Vector2(0, 0) },
                uResolution: { value: new THREE.Vector2(this.hero.offsetWidth, this.hero.offsetHeight) },
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;

                uniform float uTime;
                uniform vec2 uMouse;
                uniform vec2 uVelocity;
                uniform vec2 uResolution;

                varying vec2 vUv;

                //
                // Simplex 3D noise (compact GLSL implementation)
                //
                vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
                vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

                float snoise(vec3 v) {
                    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
                    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

                    vec3 i = floor(v + dot(v, C.yyy));
                    vec3 x0 = v - i + dot(i, C.xxx);

                    vec3 g = step(x0.yzx, x0.xyz);
                    vec3 l = 1.0 - g;
                    vec3 i1 = min(g.xyz, l.zxy);
                    vec3 i2 = max(g.xyz, l.zxy);

                    vec3 x1 = x0 - i1 + C.xxx;
                    vec3 x2 = x0 - i2 + C.yyy;
                    vec3 x3 = x0 - D.yyy;

                    i = mod(i, 289.0);
                    vec4 p = permute(permute(permute(
                        i.z + vec4(0.0, i1.z, i2.z, 1.0))
                      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                      + i.x + vec4(0.0, i1.x, i2.x, 1.0));

                    float n_ = 1.0 / 7.0;
                    vec3 ns = n_ * D.wyz - D.xzx;

                    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

                    vec4 x_ = floor(j * ns.z);
                    vec4 y_ = floor(j - 7.0 * x_);

                    vec4 x = x_ * ns.x + ns.yyyy;
                    vec4 y = y_ * ns.x + ns.yyyy;
                    vec4 h = 1.0 - abs(x) - abs(y);

                    vec4 b0 = vec4(x.xy, y.xy);
                    vec4 b1 = vec4(x.zw, y.zw);

                    vec4 s0 = floor(b0) * 2.0 + 1.0;
                    vec4 s1 = floor(b1) * 2.0 + 1.0;
                    vec4 sh = -step(h, vec4(0.0));

                    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
                    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

                    vec3 p0 = vec3(a0.xy, h.x);
                    vec3 p1 = vec3(a0.zw, h.y);
                    vec3 p2 = vec3(a1.xy, h.z);
                    vec3 p3 = vec3(a1.zw, h.w);

                    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
                    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

                    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                    m = m * m;
                    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
                }

                // Fractal brownian motion for rich detail
                float fbm(vec3 p) {
                    float value = 0.0;
                    float amplitude = 0.5;
                    float frequency = 1.0;
                    for (int i = 0; i < 5; i++) {
                        value += amplitude * snoise(p * frequency);
                        frequency *= 2.0;
                        amplitude *= 0.5;
                    }
                    return value;
                }

                void main() {
                    vec2 uv = vUv;
                    float aspect = uResolution.x / uResolution.y;
                    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

                    float t = uTime * 0.12;

                    // Mouse influence - warp the UV space near cursor
                    vec2 mousePos = (uMouse - 0.5) * vec2(aspect, 1.0);
                    vec2 toMouse = p - mousePos;
                    float mouseDist = length(toMouse);
                    float mouseInfluence = smoothstep(0.6, 0.0, mouseDist);

                    // Velocity-based swirl (faster mouse = more distortion)
                    float speed = length(uVelocity) * 8.0;
                    float swirl = mouseInfluence * speed;

                    // Warp coordinates based on mouse position and velocity
                    vec2 warpedP = p;
                    warpedP += normalize(toMouse + 0.001) * mouseInfluence * 0.15;
                    float angle = swirl * 2.0;
                    float ca = cos(angle), sa = sin(angle);
                    vec2 rotated = toMouse * mat2(ca, -sa, sa, ca);
                    warpedP = mix(warpedP, mousePos + rotated, mouseInfluence * 0.3);

                    // Layer 1: Large flowing structures
                    float n1 = fbm(vec3(warpedP * 1.8 + t * 0.3, t * 0.5));

                    // Layer 2: Medium detail, different direction
                    float n2 = fbm(vec3(
                        warpedP.x * 2.5 - t * 0.2 + n1 * 0.5,
                        warpedP.y * 2.5 + t * 0.15,
                        t * 0.3 + n1 * 0.3
                    ));

                    // Layer 3: Fine tendrils using domain warping
                    vec3 q = vec3(
                        fbm(vec3(warpedP * 3.0 + t * 0.1, 0.0)),
                        fbm(vec3(warpedP * 3.0 + t * 0.15, 1.0)),
                        0.0
                    );
                    float n3 = fbm(vec3(warpedP * 2.0 + q.xy * 1.5, t * 0.2));

                    // Combine layers
                    float combined = n1 * 0.4 + n2 * 0.35 + n3 * 0.25;

                    // Create sharp flowing edges (the glowing ridges)
                    float ridges = abs(combined);
                    ridges = pow(ridges, 0.6);
                    float edges = 1.0 - smoothstep(0.0, 0.08, abs(combined - 0.1));
                    edges += 1.0 - smoothstep(0.0, 0.12, abs(combined + 0.15));
                    edges = clamp(edges, 0.0, 1.0);

                    // Color palette - black base with thin glowing accent edges
                    vec3 darkBase = vec3(0.0, 0.0, 0.0);          // pure black
                    vec3 deepColor = vec3(0.01, 0.005, 0.03);     // barely-there indigo
                    vec3 midColor = vec3(0.005, 0.015, 0.035);    // hint of teal
                    vec3 glowColor = vec3(0.0, 0.90, 0.72);       // bright teal (#00e6b8)
                    vec3 accentGlow = vec3(0.0, 0.45, 0.75);      // blue accent

                    // Base fluid color - very dark
                    float colorMix = combined * 0.5 + 0.5;
                    vec3 fluidColor = mix(darkBase, deepColor, smoothstep(0.3, 0.6, colorMix));
                    fluidColor = mix(fluidColor, midColor, smoothstep(0.55, 0.85, colorMix));

                    // Add ridges as barely visible structure
                    fluidColor += ridges * vec3(0.005, 0.004, 0.012);

                    // Glowing edges - thin accent lines on black
                    float edgeGlow = edges * 0.3;
                    vec3 edgeMix = mix(glowColor, accentGlow, sin(combined * 4.0 + t) * 0.5 + 0.5);
                    fluidColor += edgeMix * edgeGlow;

                    // Secondary glow on steep gradients - hair-thin lines
                    float dx = fbm(vec3((warpedP + vec2(0.01, 0.0)) * 2.0, t * 0.2)) - n3;
                    float dy = fbm(vec3((warpedP + vec2(0.0, 0.01)) * 2.0, t * 0.2)) - n3;
                    float gradient = length(vec2(dx, dy)) * 40.0;
                    fluidColor += edgeMix * gradient * 0.025;

                    // Mouse proximity glow - faint bloom near cursor
                    float mouseGlow = smoothstep(0.45, 0.0, mouseDist) * 0.04;
                    fluidColor += glowColor * mouseGlow;

                    // Vignette - heavy fade to pure black at edges
                    float vignette = 1.0 - smoothstep(0.25, 0.9, length(p * 0.9));
                    fluidColor *= vignette;

                    // Overall brightness - dark, the black should dominate
                    fluidColor *= 0.4;

                    gl_FragColor = vec4(fluidColor, 1.0);
                }
            `,
        });

        this.quad = new THREE.Mesh(geometry, material);
        this.scene.add(this.quad);

        this.observer = new IntersectionObserver(
            (entries) => { this.isVisible = entries[0].isIntersecting; },
            { threshold: 0.1 }
        );
        this.observer.observe(this.hero);
    }

    bindEvents() {
        window.addEventListener('resize', () => this.onResize(), { passive: true });

        const normalizeCoords = (clientX, clientY) => {
            const rect = this.hero.getBoundingClientRect();
            return new THREE.Vector2(
                (clientX - rect.left) / rect.width,
                1.0 - (clientY - rect.top) / rect.height
            );
        };

        this.hero.addEventListener('mousemove', (e) => {
            this.targetMouse = normalizeCoords(e.clientX, e.clientY);
        }, { passive: true });

        this.hero.addEventListener('mouseleave', () => {
            this.targetMouse.set(0.5, 0.5);
        }, { passive: true });

        this.hero.addEventListener('touchmove', (e) => {
            const t = e.touches[0];
            this.targetMouse = normalizeCoords(t.clientX, t.clientY);
        }, { passive: true });

        this.hero.addEventListener('touchend', () => {
            this.targetMouse.set(0.5, 0.5);
        }, { passive: true });

        window.addEventListener('beforeunload', () => this.dispose());
    }

    onResize() {
        const w = this.hero.offsetWidth;
        const h = this.hero.offsetHeight;
        this.renderer.setSize(w, h);
        this.quad.material.uniforms.uResolution.value.set(w, h);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        if (!this.isVisible) return;

        const elapsed = this.clock.getElapsedTime();

        // Track velocity from mouse delta
        this.prevMouse.copy(this.mouse);
        this.mouse.lerp(this.targetMouse, 0.04);
        this.velocity.set(
            this.mouse.x - this.prevMouse.x,
            this.mouse.y - this.prevMouse.y
        );

        this.quad.material.uniforms.uTime.value = elapsed;
        this.quad.material.uniforms.uMouse.value.copy(this.mouse);
        this.quad.material.uniforms.uVelocity.value.copy(this.velocity);

        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        this.observer?.disconnect();
        this.quad?.geometry.dispose();
        this.quad?.material.dispose();
        this.renderer?.dispose();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new LiquidVeil();
});
