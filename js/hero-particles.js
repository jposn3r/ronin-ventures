/**
 * Ronin Ventures - Ethereal Veil
 * A thin membrane of particles that parts like a curtain on interaction,
 * revealing a dark void beneath.
 */

import * as THREE from 'three';

class HeroVeil {
    constructor() {
        this.canvas = document.getElementById('hero-canvas');
        this.hero = document.getElementById('hero');
        if (!this.canvas || !this.hero) return;

        this.mouse = new THREE.Vector2(9999, 9999);
        this.targetMouse = new THREE.Vector2(9999, 9999);
        this.isVisible = true;
        this.isMobile = window.innerWidth < 768;
        this.clock = new THREE.Clock();

        // Grid density - more particles = denser veil
        this.cols = this.isMobile ? 90 : 160;
        this.rows = this.isMobile ? 50 : 90;
        this.particleCount = this.cols * this.rows;

        this.init();
        this.bindEvents();
        this.animate();
    }

    init() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: false,
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(this.hero.offsetWidth, this.hero.offsetHeight);

        this.scene = new THREE.Scene();

        // Orthographic camera so the veil maps flat to the screen
        const aspect = this.hero.offsetWidth / this.hero.offsetHeight;
        this.frustumSize = 10;
        this.camera = new THREE.OrthographicCamera(
            -this.frustumSize * aspect / 2,
            this.frustumSize * aspect / 2,
            this.frustumSize / 2,
            -this.frustumSize / 2,
            0.1, 100
        );
        this.camera.position.z = 10;

        this.createVeil();

        this.observer = new IntersectionObserver(
            (entries) => { this.isVisible = entries[0].isIntersecting; },
            { threshold: 0.1 }
        );
        this.observer.observe(this.hero);
    }

    createVeil() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleCount * 3);
        const randoms = new Float32Array(this.particleCount);
        const uvs = new Float32Array(this.particleCount * 2);

        const aspect = this.hero.offsetWidth / this.hero.offsetHeight;
        const spanX = this.frustumSize * aspect;
        const spanY = this.frustumSize;

        // Lay particles in a grid with slight organic jitter
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const i = row * this.cols + col;
                const i3 = i * 3;
                const i2 = i * 2;

                // Normalized UV
                const u = col / (this.cols - 1);
                const v = row / (this.rows - 1);

                // Position mapped to camera frustum, with jitter
                const jitter = 0.03;
                positions[i3]     = (u - 0.5) * spanX + (Math.random() - 0.5) * jitter * spanX;
                positions[i3 + 1] = (v - 0.5) * spanY + (Math.random() - 0.5) * jitter * spanY;
                positions[i3 + 2] = 0;

                uvs[i2] = u;
                uvs[i2 + 1] = v;

                randoms[i] = Math.random();
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
        geometry.setAttribute('aUv', new THREE.BufferAttribute(uvs, 2));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uMouse: { value: new THREE.Vector2(9999, 9999) },
                uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
            },
            vertexShader: `
                uniform float uTime;
                uniform vec2 uMouse;
                uniform float uPixelRatio;

                attribute float aRandom;
                attribute vec2 aUv;

                varying float vAlpha;
                varying float vDisplacement;
                varying vec2 vUv;

                void main() {
                    vec3 pos = position;
                    vUv = aUv;

                    // Slow organic ripple - the veil breathes
                    float wave1 = sin(pos.x * 1.8 + uTime * 0.3 + aRandom * 3.0) * 0.04;
                    float wave2 = cos(pos.y * 2.2 + uTime * 0.25 + aRandom * 2.0) * 0.03;
                    float wave3 = sin((pos.x + pos.y) * 0.8 + uTime * 0.15) * 0.02;
                    pos.z += wave1 + wave2 + wave3;

                    // Mouse interaction - push the veil away like parting a curtain
                    vec2 toMouse = pos.xy - uMouse;
                    float dist = length(toMouse);

                    // Two-layer displacement: inner circle pushes hard, outer ring ripples
                    float innerPush = smoothstep(2.5, 0.0, dist);
                    float outerRipple = smoothstep(4.5, 2.0, dist) * (1.0 - innerPush);

                    // Push particles outward from cursor (curtain parting)
                    vec2 dir = normalize(toMouse + 0.0001);
                    pos.xy += dir * innerPush * 1.2;
                    pos.xy += dir * outerRipple * 0.3;

                    // Push deeper into Z (receding into the void)
                    pos.z -= innerPush * 3.0;
                    pos.z -= outerRipple * 0.8;

                    // Slight upward drift near mouse (ethereal lift)
                    pos.y += innerPush * 0.15;

                    vDisplacement = innerPush + outerRipple * 0.4;

                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;

                    // Size: small enough to form a mesh, not individual dots
                    float baseSize = ${this.isMobile ? '2.2' : '2.0'};
                    gl_PointSize = baseSize * uPixelRatio;

                    // Alpha: base veil opacity with edge fade
                    float edgeFadeX = smoothstep(0.0, 0.08, aUv.x) * smoothstep(1.0, 0.92, aUv.x);
                    float edgeFadeY = smoothstep(0.0, 0.08, aUv.y) * smoothstep(1.0, 0.92, aUv.y);
                    float edgeFade = edgeFadeX * edgeFadeY;

                    // Veil base opacity - thin, translucent
                    vAlpha = (0.12 + aRandom * 0.08) * edgeFade;

                    // Particles near cursor become more transparent (parting reveals void)
                    vAlpha *= (1.0 - innerPush * 0.9);

                    // Particles at the ripple edge glow slightly brighter
                    vAlpha += outerRipple * 0.06;
                }
            `,
            fragmentShader: `
                varying float vAlpha;
                varying float vDisplacement;
                varying vec2 vUv;

                void main() {
                    // Soft circular point
                    float d = length(gl_PointCoord - 0.5);
                    if (d > 0.5) discard;
                    float softness = smoothstep(0.5, 0.2, d);

                    // Color: muted, ghostly palette
                    // Base is a cold dark gray-blue, shifts slightly warmer at displacement edges
                    vec3 veilColor = vec3(0.45, 0.50, 0.55);
                    vec3 edgeGlow = vec3(0.3, 0.6, 0.55);
                    vec3 color = mix(veilColor, edgeGlow, vDisplacement * 0.6);

                    float alpha = softness * vAlpha;

                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.NormalBlending,
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    bindEvents() {
        window.addEventListener('resize', () => this.onResize(), { passive: true });

        // Convert screen coords to world coords for orthographic camera
        const screenToWorld = (clientX, clientY) => {
            const rect = this.hero.getBoundingClientRect();
            const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
            const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
            const aspect = rect.width / rect.height;
            return new THREE.Vector2(
                ndcX * this.frustumSize * aspect / 2,
                ndcY * this.frustumSize / 2
            );
        };

        this.hero.addEventListener('mousemove', (e) => {
            this.targetMouse = screenToWorld(e.clientX, e.clientY);
        }, { passive: true });

        this.hero.addEventListener('mouseleave', () => {
            this.targetMouse = new THREE.Vector2(9999, 9999);
        }, { passive: true });

        this.hero.addEventListener('touchmove', (e) => {
            const t = e.touches[0];
            this.targetMouse = screenToWorld(t.clientX, t.clientY);
        }, { passive: true });

        this.hero.addEventListener('touchend', () => {
            this.targetMouse = new THREE.Vector2(9999, 9999);
        }, { passive: true });

        window.addEventListener('beforeunload', () => this.dispose());
    }

    onResize() {
        const w = this.hero.offsetWidth;
        const h = this.hero.offsetHeight;
        const aspect = w / h;

        this.camera.left = -this.frustumSize * aspect / 2;
        this.camera.right = this.frustumSize * aspect / 2;
        this.camera.top = this.frustumSize / 2;
        this.camera.bottom = -this.frustumSize / 2;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(w, h);
        this.particles.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        if (!this.isVisible) return;

        const elapsed = this.clock.getElapsedTime();

        // Slow, deliberate mouse follow
        this.mouse.lerp(this.targetMouse, 0.035);

        this.particles.material.uniforms.uTime.value = elapsed;
        this.particles.material.uniforms.uMouse.value.copy(this.mouse);

        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        this.observer?.disconnect();
        this.particles?.geometry.dispose();
        this.particles?.material.dispose();
        this.renderer?.dispose();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new HeroVeil();
});
