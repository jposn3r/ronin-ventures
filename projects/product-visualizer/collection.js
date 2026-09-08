export const collection = [
  { id: 'ronin-deck', number: '01', name: 'Ronin Deck', category: 'Originals', edition: 'Studio original', year: '2026', tagline: 'A mechanical soul.', description: 'A tactile home for your big ideas. Machined metal, mechanical keys, and a little room to play.', material: 'Aluminum / polymer', interactions: 'Keys · finishes · teardown', href: './deck.html', accent: '#8fc9c3' },
  { id: 'arc-reactor', number: '02', name: 'Arc Reactor', category: 'Cinema', edition: 'Iron Man inspired', year: '2008', tagline: 'Small object. Infinite energy.', description: 'Copper windings, concentric steel, and a luminous palladium core. A study in the beauty of fictional engineering.', material: 'Steel / copper / light', interactions: 'Power · output · teardown', href: './object.html?object=arc-reactor', accent: '#8bccf0', facts: [['DESIGN', 'Circular core'], ['DETAIL', '10 wound bobbins'], ['ASSEMBLY', '3 main layers']], hint: 'Tap the reactor to toggle power' },
  { id: 'lightsaber', number: '03', name: 'Lightsaber', category: 'Cinema', edition: 'Skywalker inspired', year: '1977', tagline: 'An elegant object.', description: 'Polished metal, dark grip rails, and a blade made of light. Explore the hilt, then bring it to life.', material: 'Chrome / rubber / light', interactions: 'Ignite · blade colors · chamber', href: './object.html?object=lightsaber', accent: '#93b8f4', facts: [['DESIGN', 'Skywalker inspired'], ['BLADE', '3 color studies'], ['DETAIL', 'Crystal chamber']], hint: 'Tap the red switch to ignite' },
  { id: 'ipod', number: '04', name: 'iPod', category: 'Technology', edition: 'Original scroll wheel', year: '2001', tagline: 'A thousand songs. One wheel.', description: 'White acrylic, polished steel, and a monochrome screen. Rediscover the original iPod, one satisfying turn at a time.', material: 'Acrylic / stainless steel', interactions: 'Browse · play · hold · teardown', href: './object.html?object=ipod', accent: '#d7dec3', facts: [['GENERATION', 'Original · 2001'], ['CAPACITY', '5 GB'], ['CONTROL', 'Mechanical wheel']], hint: 'Tap the wheel, buttons, or center select' }
];
export async function loadModel(id) {
  if (id === 'arc-reactor') return (await import('./models/arc-reactor.js')).createArcReactor();
  if (id === 'lightsaber') return (await import('./models/lightsaber.js')).createLightsaber();
  if (id === 'ipod') return (await import('./models/ipod.js')).createIPod();
  if (id === 'ronin-deck') return (await import('./models/deck-preview.js')).createDeckPreview();
  throw new Error('Unknown object');
}
