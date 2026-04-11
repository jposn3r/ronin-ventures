# Ronin Ventures Dev

Software & experiments hub by Jake Posner. Apple-inspired dark portfolio built with vanilla HTML/CSS/JS.

## Quick Start

```bash
npx serve
# or
python -m http.server 8000
```

Open `http://localhost:3000` (or `:8000`).

## Project Structure

```
ronin-ventures/
├── index.html                # Main hub - hero, featured, all projects
├── css/main.css              # Design system (tokens, glass nav, cards, modal)
├── js/app.js                 # Hub controller (filtering, SVG inlining, scroll reveal)
├── data/projects.json        # Project metadata - edit this to manage projects
├── components/back-to-hub.js # Reusable nav button for project pages
├── assets/thumbnails/        # Animated SVG placeholders (800x450)
├── projects/                 # Individual project folders
│   ├── brickbreaker/
│   ├── investment-calculator/
│   ├── task-forge/
│   ├── therapy-crm/
│   ├── word-search/
│   └── hostr/
├── generate-placeholders.js  # Generates animated SVG thumbnails
├── update-dates.js           # Auto-updates lastUpdated from file timestamps
├── robots.txt                # SEO crawl rules
└── sitemap.xml               # SEO sitemap
```

## Design System

Built with Apple-inspired design principles on a dark theme:

- **Typography:** Inter (400-800) for display/body, JetBrains Mono for labels
- **Colors:** Pure black backgrounds, `#00e6b8` teal accent, `#f5f5f7` text
- **Glass nav:** Fixed translucent navigation with `backdrop-filter: blur(20px)`
- **Pill buttons:** `border-radius: 980px` CTAs
- **Cards:** 18px radius, soft shadows, subtle borders, `aspect-ratio: 16/9`
- **Scroll reveal:** Elements fade up on scroll via `IntersectionObserver`-style detection
- **Responsive:** Fluid `clamp()` typography, touch-specific CSS, mobile-first

### CSS Tokens

```css
:root {
    --bg-primary: #000000;
    --bg-elevated: #1a1a1c;
    --accent: #00e6b8;
    --font-display: 'Inter', system-ui, sans-serif;
    --radius-pill: 980px;
    --shadow-card: 0 3px 30px rgba(0,0,0,0.22);
}
```

## Managing Projects

### Adding a New Project

1. Create project folder in `projects/your-project/`
2. Generate or add a thumbnail in `assets/thumbnails/your-project.svg`
3. Add entry to `data/projects.json`:

```json
{
    "id": "your-project",
    "title": "Display Title",
    "shortDescription": "One-line for cards",
    "description": "Full description for modal",
    "category": "tool",
    "categoryLabel": "Tool",
    "thumbnail": "/assets/thumbnails/your-project.svg",
    "screenshots": [],
    "path": "/projects/your-project/",
    "externalUrl": "",
    "sourceUrl": "",
    "tech": ["JavaScript", "CSS"],
    "status": "active",
    "featured": false,
    "comingSoon": false,
    "preview": { "type": "svg", "src": "/assets/thumbnails/your-project.svg" },
    "lastUpdated": "Apr 11, 2026"
}
```

### Video Previews (Future)

When you have screen recordings, add them as video previews:

```json
"preview": {
    "type": "video",
    "src": "/assets/videos/your-project.mp4",
    "poster": "/assets/thumbnails/your-project.jpg"
}
```

Videos auto-play on hover (desktop) or on scroll-into-view (mobile).

### Categories

| Category | Filter | Use For |
|----------|--------|---------|
| `3d` | 3D | Three.js, WebGL experiences |
| `game` | Games | Playable games |
| `tool` | Tools | Apps, utilities, websites |

### Generating Animated SVG Placeholders

```bash
node generate-placeholders.js
```

Creates animated SVGs with 5 patterns: bars, circles, waves, grid-pulse, code-scroll.

## Back Navigation

Add to any project page for a floating back button:

```html
<script src="/components/back-to-hub.js"></script>
```

## Deployment

Static HTML/CSS/JS - no build step. Deploy to Vercel, Netlify, GitHub Pages, or any static host. All paths are absolute (`/`).

## SEO

Includes: meta description, Open Graph tags, Twitter Cards, canonical URL, JSON-LD structured data, `robots.txt`, and `sitemap.xml`.

---

© 2026 Jake Posner. All rights reserved.
