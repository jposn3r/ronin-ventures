/**
 * Generate animated SVG placeholders for project thumbnails
 * Run: node generate-placeholders.js
 */

const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, 'assets', 'thumbnails');

const projects = [
    { name: 'jakeposner', label: 'JAKE POSNER', color: '#00e6b8', pattern: 'circles' },
    { name: 'investment-calculator', label: 'WEALTH ARCHITECT', color: '#00e6b8', pattern: 'bars' },
    { name: 'hostr', label: 'HOSTR', color: '#f97316', pattern: 'bars' },
    { name: 'therapy-crm', label: 'THERAPY CRM', color: '#a78bfa', pattern: 'grid-pulse' },
    { name: 'task-forge', label: 'TASK FORGE', color: '#38bdf8', pattern: 'grid-pulse' },
    { name: 'wordsearch', label: 'WORD SEARCH', color: '#34d399', pattern: 'grid-pulse' },
    { name: 'brickbreaker', label: 'BRICKBREAKER', color: '#f0a030', pattern: 'circles' },
    { name: 'metakaizen', label: 'METAKAIZEN', color: '#818cf8', pattern: 'waves' },
    { name: 'cursordev', label: 'CURSOR DEV', color: '#22c55e', pattern: 'code-scroll' },
];

function generateBars(color, count = 12) {
    let bars = '';
    for (let i = 0; i < count; i++) {
        const x = 160 + i * 40;
        const baseH = 30 + Math.random() * 80;
        const maxH = baseH + 40 + Math.random() * 60;
        const baseY = 320 - baseH;
        const minY = 320 - maxH;
        const delay = (i * 0.15).toFixed(2);
        const dur = (1.2 + Math.random() * 0.8).toFixed(2);
        bars += `
    <rect x="${x}" y="${baseY.toFixed(0)}" width="24" rx="4" height="${baseH.toFixed(0)}" fill="${color}" opacity="0.6">
      <animate attributeName="height" values="${baseH.toFixed(0)};${maxH.toFixed(0)};${baseH.toFixed(0)}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1"/>
      <animate attributeName="y" values="${baseY.toFixed(0)};${minY.toFixed(0)};${baseY.toFixed(0)}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1"/>
    </rect>`;
    }
    return bars;
}

function generateCircles(color, count = 6) {
    let circles = '';
    for (let i = 0; i < count; i++) {
        const cx = 200 + Math.random() * 400;
        const cy = 100 + Math.random() * 250;
        const r = 15 + Math.random() * 40;
        const dx = (Math.random() - 0.5) * 60;
        const dy = (Math.random() - 0.5) * 40;
        const dur = (2.5 + Math.random() * 2).toFixed(2);
        const delay = (i * 0.3).toFixed(2);
        circles += `
    <circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="${color}" opacity="${(0.15 + Math.random() * 0.25).toFixed(2)}">
      <animate attributeName="cx" values="${cx.toFixed(0)};${(cx + dx).toFixed(0)};${cx.toFixed(0)}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
      <animate attributeName="cy" values="${cy.toFixed(0)};${(cy + dy).toFixed(0)};${cy.toFixed(0)}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
      <animate attributeName="r" values="${r.toFixed(0)};${(r * 1.3).toFixed(0)};${r.toFixed(0)}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
    </circle>`;
    }
    return circles;
}

function generateWaves(color) {
    const lines = [];
    for (let row = 0; row < 5; row++) {
        const y = 100 + row * 60;
        let points1 = '', points2 = '';
        for (let x = 100; x <= 700; x += 30) {
            const y1 = y + Math.sin((x / 60) + row) * 20;
            const y2 = y + Math.sin((x / 60) + row + 1.5) * 25;
            points1 += `${x},${y1.toFixed(1)} `;
            points2 += `${x},${y2.toFixed(1)} `;
        }
        const dur = (3 + row * 0.4).toFixed(1);
        lines.push(`
    <polyline points="${points1.trim()}" fill="none" stroke="${color}" stroke-width="2" opacity="${(0.2 + row * 0.08).toFixed(2)}">
      <animate attributeName="points" values="${points1.trim()};${points2.trim()};${points1.trim()}" dur="${dur}s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
    </polyline>`);
    }
    return lines.join('');
}

function generateGridPulse(color, cols = 8, rows = 4) {
    let rects = '';
    const size = 32;
    const gap = 8;
    const startX = (800 - (cols * (size + gap) - gap)) / 2;
    const startY = (350 - (rows * (size + gap) - gap)) / 2;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = startX + c * (size + gap);
            const y = startY + r * (size + gap);
            const delay = ((r * cols + c) * 0.08).toFixed(2);
            const dur = (1.5 + Math.random() * 0.5).toFixed(2);
            rects += `
    <rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${size}" height="${size}" rx="4" fill="${color}" opacity="0.1">
      <animate attributeName="opacity" values="0.1;0.5;0.1" dur="${dur}s" begin="${delay}s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1"/>
    </rect>`;
        }
    }
    return rects;
}

function generateCodeScroll(color, lineCount = 14) {
    let lines = '';
    for (let i = 0; i < lineCount; i++) {
        const y = 60 + i * 24;
        const indent = [0, 20, 40, 20, 0, 40, 20, 0][i % 8];
        const width = 100 + Math.random() * 300;
        const opacity = (0.15 + Math.random() * 0.2).toFixed(2);
        const dur = (0.8 + Math.random() * 0.4).toFixed(2);
        const delay = (i * 0.12).toFixed(2);
        lines += `
    <rect x="${180 + indent}" y="${y}" width="${width.toFixed(0)}" height="8" rx="4" fill="${color}" opacity="${opacity}">
      <animate attributeName="opacity" values="${opacity};${(parseFloat(opacity) + 0.3).toFixed(2)};${opacity}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/>
      <animate attributeName="width" values="${width.toFixed(0)};${(width * 0.7).toFixed(0)};${width.toFixed(0)}" dur="${(parseFloat(dur) * 2).toFixed(2)}s" begin="${delay}s" repeatCount="indefinite"/>
    </rect>`;
    }
    return lines;
}

function generateSVG(project) {
    const { color, label, pattern } = project;

    let patternContent = '';
    switch (pattern) {
        case 'bars': patternContent = generateBars(color); break;
        case 'circles': patternContent = generateCircles(color); break;
        case 'waves': patternContent = generateWaves(color); break;
        case 'grid-pulse': patternContent = generateGridPulse(color); break;
        case 'code-scroll': patternContent = generateCodeScroll(color); break;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="800" height="450">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1a1a"/>
      <stop offset="100%" stop-color="#111111"/>
    </linearGradient>
  </defs>
  <rect width="800" height="450" fill="url(#bg)"/>
  <g>
    ${patternContent}
  </g>
  <text x="400" y="420" fill="${color}" font-family="monospace" font-size="11" font-weight="500" text-anchor="middle" letter-spacing="3" opacity="0.4">${label}</text>
</svg>`;
}

// Generate all
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

projects.forEach(project => {
    const svg = generateSVG(project);
    const filePath = path.join(outputDir, `${project.name}.svg`);
    fs.writeFileSync(filePath, svg);
    console.log(`  Generated: ${project.name}.svg (${project.pattern})`);
});

console.log(`\n  Done! ${projects.length} animated SVGs generated.`);
