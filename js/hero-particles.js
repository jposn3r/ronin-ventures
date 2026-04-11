/**
 * Ronin Ventures - Interactive Particle Hero
 * Three.js particle system with mouse/touch interaction
 */

import * as THREE from 'three';

class HeroParticles {
    constructor() {
        this.canvas = document.getElementById('hero-canvas');
        this.hero = document.getElementById('hero');
        if (!this.canvas || !this.hero) return;

        this.mouse = new THREE.Vector2(0, 0);
        this.targetMouse = new THREE.Vector2(0, 0);
        this.isVisible = true;
        this.isMobile = window.innerWidth < 768;
        this.particleCount = this.isMobile ? 800 : 1500;
        this.clock = new THREE.Clock();

        this.init();
        this.bindEvents();
        this.animate();
    }

    init() {
        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: true,
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(this.hero.offsetWidth, this.hero.offsetHeight);

        // Scene
        this.scene = new THREE.Scene();

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            this.hero.offsetWidth / this.hero.offsetHeight,
            0.1,
            100
        );
        this.camera.position.z = 30;

        // Particles
        this.createParticles();

        // Visibility observer - pause when not visible
        this.observer = new IntersectionObserver(
            (entries) => {
                this.isVisible = entries[0].isIntersecting;
            },
            { threshold: 0.1 }
        );
        this.observer.observe(this.hero);
    }

    createParticles() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleCount * 3);
        const randoms = new Float32Array(this.particleCount);
        const sizes = new Float32Array(this.particleCount);

        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;

            // Distribute in a flattened sphere (disc-like)
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 18 + Math.random() * 8;

            positions[i3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = (r * Math.sin(phi) * Math.sin(theta)) * 0.5; // flatten Y
            positions[i3 + 2] = (r * Math.cos(phi)) * 0.6;

            randoms[i] = Math.random();
            sizes[i] = 0.5 + Math.random() * 1.5;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
        geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

        // Shader material
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uMouse: { value: new THREE.Vector2(0, 0) },
                uResolution: { value: new THREE.Vector2(this.hero.offsetWidth, this.hero.offsetHeight) },
                uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
                uColorA: { value: new THREE.Color('#00e6b8') },
                uColorB: { value: new THREE.Color('#0099cc') },
            },
            vertexShader: `
                uniform float uTime;
                uniform vec2 uMouse;
                uniform float uPixelRatio;

                attribute float aRandom;
                attribute float aSize;

                varying float vAlpha;
                varying float vRandom;

                void main() {
                    vec3 pos = position;

                    // Ambient drift
                    float drift = uTime * 0.15;
                    pos.x += sin(drift + aRandom * 6.28) * 0.4;
                    pos.y += cos(drift * 0.7 + aRandom * 4.0) * 0.3;
                    pos.z += sin(drift * 0.5 + aRandom * 5.0) * 0.2;

                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

                    // Mouse displacement in view space
                    vec2 mouseView = uMouse * 12.0;
                    vec2 particleScreen = mvPosition.xy;
                    float dist = distance(particleScreen, mouseView);
                    float displacement = smoothstep(8.0, 0.0, dist) * 3.5;

                    vec2 dir = normalize(particleScreen - mouseView + 0.001);
                    mvPosition.xy += dir * displacement;

                    gl_Position = projectionMatrix * mvPosition;

                    // Size attenuation
                    float size = aSize * 28.0 * uPixelRatio;
                    gl_PointSize = size * (1.0 / -mvPosition.z);

                    // Alpha based on depth and randomness
                    vAlpha = 0.15 + aRandom * 0.5;
                    vAlpha *= smoothstep(50.0, 10.0, -mvPosition.z);

                    // Brighten near mouse
                    vAlpha += displacement * 0.15;

                    vRandom = aRandom;
                }
            `,
            fragmentShader: `
                uniform vec3 uColorA;
                uniform vec3 uColorB;

                varying float vAlpha;
                varying float vRandom;

                void main() {
                    // Soft circular point
                    float d = length(gl_PointCoord - 0.5);
                    if (d > 0.5) discard;

                    float alpha = smoothstep(0.5, 0.15, d) * vAlpha;

                    // Blend between two colors based on random
                    vec3 color = mix(uColorA, uColorB, vRandom);

                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    bindEvents() {
        // Resize
        window.addEventListener('resize', () => this.onResize(), { passive: true });

        // Mouse (desktop)
        this.hero.addEventListener('mousemove', (e) => {
            const rect = this.hero.getBoundingClientRect();
            this.targetMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.targetMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        }, { passive: true });

        this.hero.addEventListener('mouseleave', () => {
            this.targetMouse.set(0, 0);
        }, { passive: true });

        // Touch (mobile)
        this.hero.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            const rect = this.hero.getBoundingClientRect();
            this.targetMouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
            this.targetMouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
        }, { passive: true });

        this.hero.addEventListener('touchend', () => {
            this.targetMouse.set(0, 0);
        }, { passive: true });

        // Cleanup
        window.addEventListener('beforeunload', () => this.dispose());
    }

    onResize() {
        const w = this.hero.offsetWidth;
        const h = this.hero.offsetHeight;

        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);

        this.particles.material.uniforms.uResolution.value.set(w, h);
        this.particles.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (!this.isVisible) return;

        const elapsed = this.clock.getElapsedTime();

        // Smooth lerp mouse
        this.mouse.lerp(this.targetMouse, 0.06);

        // Update uniforms
        this.particles.material.uniforms.uTime.value = elapsed;
        this.particles.material.uniforms.uMouse.value.copy(this.mouse);

        // Gentle rotation
        this.particles.rotation.y = elapsed * 0.03;
        this.particles.rotation.x = Math.sin(elapsed * 0.02) * 0.05;

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
    new HeroParticles();
});
