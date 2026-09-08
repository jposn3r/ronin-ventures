// Lightweight gallery representation. The complete interactive deck remains in studio.js.
import { THREE, metal, box, disc, label, canvasTexture } from './shared.js';
export function createDeckPreview() {
  const root = new THREE.Group(), dark = metal(0x202a30, .35, .4), shell = metal(0x536b6b, .3), edge = metal(0x91a7aa, .25);
  box(root, [3.4, 3.9, .3], dark, [0, 0, 0], .18);
  box(root, [3.36, 3.85, .08], shell, [0, 0, .18], .17);
  const actions = ['◎', '△', '✳', '◇', '○', '↶', '✓', 'Ⅱ', '≋', '↗', '+'];
  for (let i = 0; i < 11; i++) {
    const x = i < 8 ? (i % 4 - 1.5) * .74 : i === 8 ? -1.11 : i === 9 ? 0 : 1.11;
    const y = i < 8 ? .49 - Math.floor(i / 4) * .75 : -1.01;
    const w = i === 9 ? 1.39 : .65;
    box(root, [w + .04, .7, .03], edge, [x, y, .25], .08);
    box(root, [w, .65, .3], i === 9 ? metal(0xe1d7c0, .4, .05) : dark, [x, y, .41], .09);
    const t = canvasTexture(128, 128, c => { c.fillStyle = i === 9 ? '#27312e' : ['#8fc9c3', '#8eb4ea', '#e4ba72', '#c1a3eb'][i % 4]; c.font = '40px Arial'; c.textAlign = 'center'; c.fillText(actions[i], 64, 67); c.font = '10px monospace'; c.fillText('RONIN', 64, 99); });
    label(root, t, .5, .5, [x, y, .566]);
  }
  box(root, [1.9, .63, .1], dark, [-.46, 1.35, .29], .05);
  const display = canvasTexture(384, 128, c => { c.fillStyle = '#091a1a'; c.fillRect(0, 0, 384, 128); c.fillStyle = '#8fc9c3'; c.font = '22px monospace'; c.fillText('RONIN / FOCUS', 25, 53); for (let i = 0; i < 42; i++) c.fillRect(25 + i * 8, 85, 3, 7 + (i % 4) * 3); });
  label(root, display, 1.73, .49, [-.46, 1.35, .346]);
  disc(root, .36, .24, dark, .37, 1.09, 1.35);
  for (const x of [-1.5, 1.5]) for (const y of [-1.7, 1.7]) disc(root, .06, .03, dark, .24, x, y);
  return { root, framing: { target: [0, 0, 0], position: [3.3, 3.5, 8.2] }, update() {} };
}
