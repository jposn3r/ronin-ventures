# Ronin Ventures Dev

Software & experiments hub for Ronin Ventures, built by Jake Posner.

## Quick Start

```bash
# Using any local server (e.g., VS Code Live Server, Python, etc.)
python -m http.server 8000
# or
npx serve
```

Then open `http://localhost:8000` in your browser.

---

## Project Structure

```
ronin-ventures/
├── index.html              # Main hub page
├── css/
│   └── main.css            # All styles (single file, no build step)
├── js/
│   └── app.js              # Hub functionality
├── data/
│   └── projects.json       # ⭐ ADMIN: Edit this to manage projects
├── components/
│   └── back-to-hub.js      # Reusable navigation component
├── assets/
│   ├── thumbnails/         # Project thumbnail images (800x450 recommended)
│   └── screenshots/        # Detail view screenshots (1200x675 recommended)
├── projects/               # Each project in its own folder
│   ├── brickbreaker/
│   │   └── index.html
│   ├── aoe-ai-agents/
│   │   └── index.html
│   └── ...
└── generate-placeholders.js # Dev tool for placeholder images
```

---

## Managing Projects (Admin)

### Adding a New Project

1. **Create the project folder:**
   ```
   projects/your-project-name/
   └── index.html (plus any other files)
   ```

2. **Add a thumbnail image:**
   ```
   assets/thumbnails/your-project-name.jpg (or .png, .webp, .svg)
   ```

3. **Edit `data/projects.json`:**
   ```json
   {
       "id": "your-project-name",
       "title": "Display Title",
       "shortDescription": "One-line description for cards",
       "description": "Full description for the detail modal",
       "category": "game",           // Options: "3d", "game", "tool"
       "categoryLabel": "Game",      // Display label
       "thumbnail": "/assets/thumbnails/your-project-name.jpg",
       "screenshots": [],            // Optional array of screenshot paths
       "path": "/projects/your-project-name/index.html",
       "sourceUrl": "",              // Optional GitHub link
       "tech": ["JavaScript", "Canvas"],
       "status": "active",           // Options: "active", "beta", "archived"
       "featured": false,            // Set true to show in Featured section
       "lastUpdated": "2024-01-15"
   }
   ```

### Featuring Projects

Set `"featured": true` for up to 5 projects. They'll appear in the larger Featured section at the top.

### Project Categories

| Category | Filter Button | Use For |
|----------|--------------|---------|
| `3d` | 3D | Three.js, WebGL, 3D experiences |
| `game` | Games | Playable games |
| `tool` | Tools | Utilities, apps, productivity tools |

---

## Adding Back Navigation to Projects

Include this single line in any project's HTML to add consistent navigation back to the hub:

```html
<script src="/components/back-to-hub.js"></script>
```

That's it. The button appears automatically in the top-left corner.

---

## Image Guidelines

### Thumbnails
- **Size:** 800×450px (16:9 ratio)
- **Format:** JPG, PNG, WebP, or SVG
- **Location:** `/assets/thumbnails/`
- **Naming:** Match the project `id` (e.g., `brickbreaker.jpg`)

### Screenshots
- **Size:** 1200×675px (16:9 ratio)
- **Format:** JPG, PNG, or WebP
- **Location:** `/assets/screenshots/`
- **Naming:** `{project-id}-{number}.jpg` (e.g., `journal-1.jpg`)

### Generating Placeholders (Development)

```bash
node generate-placeholders.js
```

Creates stylized SVG placeholders matching the hub's aesthetic.

---

## Customization

### Colors

Edit CSS variables in `css/main.css`:

```css
:root {
    --accent-primary: #00d4aa;    /* Main accent (teal) */
    --accent-secondary: #0099cc;  /* Secondary accent (blue) */
    --bg-primary: #07080c;        /* Darkest background */
    --bg-card: #0a0c10;           /* Card backgrounds */
}
```

### Branding

Update in `index.html`:
- Logo symbol (currently 浪 - "wave" kanji)
- Title text
- Tagline
- Footer content

### Typography

The hub uses:
- **JetBrains Mono** - Monospace for labels, code, UI elements
- **Space Grotesk** - Sans-serif for headings, body text

Loaded via Google Fonts. Change in `index.html` `<head>`.

---

## Deployment

The hub is static HTML/CSS/JS - deploy anywhere:

### Vercel / Netlify
```bash
# Just push to Git, or drag the folder
```

### Traditional Hosting
Upload the entire folder. No build step required.

### Important Notes
- All paths are absolute (starting with `/`)
- Ensure your hosting serves `index.html` for the root path
- The hub works entirely client-side (no backend needed)

---

## Example: Adding Your AOE Agents Project

1. Create the folder:
   ```
   projects/aoe-ai-agents/
   ├── index.html
   ├── game.js
   └── styles.css
   ```

2. Include the back button in your `index.html`:
   ```html
   <script src="/components/back-to-hub.js"></script>
   ```

3. Take a screenshot and save as:
   ```
   assets/thumbnails/aoe-agents.jpg
   ```

4. It's already in `projects.json` and marked as featured ✓

---

## Troubleshooting

**Projects not showing?**
- Check browser console for JSON parse errors
- Verify `data/projects.json` is valid JSON
- Ensure thumbnail paths match exactly

**Styles look broken?**
- Make sure you're using a local server, not `file://`
- Check that `css/main.css` path is correct

**Back button not appearing?**
- Verify the script path is correct: `/components/back-to-hub.js`
- Check browser console for 404 errors

---

## License

© 2025 Ronin Ventures. All rights reserved.
