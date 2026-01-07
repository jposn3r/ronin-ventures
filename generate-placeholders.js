/**
 * Placeholder Thumbnail Generator
 * Generates consistent placeholder images for projects during development.
 * Run: node generate-placeholders.js
 */

const fs = require('fs');
const path = require('path');

const thumbnailsDir = path.join(__dirname, 'assets', 'thumbnails');
const screenshotsDir = path.join(__dirname, 'assets', 'screenshots');

// Create directories if they don't exist
[thumbnailsDir, screenshotsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Project configurations
const projects = [
    { name: 'wordsearch', label: 'WORD SEARCH', color: '#f472b6' },
    { name: 'brickbreaker', label: 'BRICKBREAKER', color: '#f0a030' },
    { name: 'jakeposner', label: 'JAKE POSNER', color: '#00d4aa' },
    { name: 'jacobposner', label: 'JACOB POSNER', color: '#0099cc' },
    { name: 'metakaizen', label: 'METAKAIZEN', color: '#6366f1' },
    { name: 'cursordev', label: 'CURSOR DEV', color: '#22c55e' }
];

function generateSVG(label, color, width = 800, height = 450) {
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0d0f14"/>
      <stop offset="100%" style="stop-color:#07080c"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color}"/>
      <stop offset="100%" style="stop-color:${color}88"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="${color}15" stroke-width="1"/>
    </pattern>
  </defs>
  
  <!-- Background -->
  <rect width="100%" height="100%" fill="url(#bg)"/>
  
  <!-- Grid overlay -->
  <rect width="100%" height="100%" fill="url(#grid)"/>
  
  <!-- Decorative elements -->
  <circle cx="${width * 0.8}" cy="${height * 0.3}" r="120" fill="${color}08"/>
  <circle cx="${width * 0.2}" cy="${height * 0.7}" r="80" fill="${color}05"/>
  
  <!-- Center accent -->
  <rect x="${width/2 - 60}" y="${height/2 - 40}" width="120" height="80" rx="4" fill="none" stroke="${color}40" stroke-width="1"/>
  
  <!-- Label -->
  <text x="${width/2}" y="${height/2 + 8}" 
        font-family="monospace" 
        font-size="18" 
        font-weight="500"
        fill="${color}" 
        text-anchor="middle"
        filter="url(#glow)"
        letter-spacing="4">${label}</text>
  
  <!-- Corner accents -->
  <path d="M 20 20 L 60 20 M 20 20 L 20 60" stroke="${color}60" stroke-width="2" fill="none"/>
  <path d="M ${width-20} ${height-20} L ${width-60} ${height-20} M ${width-20} ${height-20} L ${width-20} ${height-60}" stroke="${color}60" stroke-width="2" fill="none"/>
</svg>`;
}

// Generate thumbnails
projects.forEach(project => {
    const svg = generateSVG(project.label, project.color);
    const filepath = path.join(thumbnailsDir, `${project.name}.svg`);
    fs.writeFileSync(filepath, svg);
    console.log(`Created: ${filepath}`);
});

// No screenshots needed for current projects
console.log('\n✓ Placeholder generation complete!');
console.log('Replace these with actual screenshots when ready.');
