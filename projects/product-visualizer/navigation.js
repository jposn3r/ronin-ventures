// Keep mobile page navigation outside the canvas's orbit/pinch gesture handling.
// Native anchors still work if the 3D renderer fails to initialize.
(() => {
  const jump = document.querySelector('.mobile-jump');
  const configuration = document.querySelector('#configuration');
  let pending = false;
  function update() {
    const atControls = configuration.getBoundingClientRect().top <= window.innerHeight * .45;
    const target = atControls ? 'product-preview' : 'configuration';
    jump.textContent = atControls ? '↑ Back to object' : 'Customize ↓';
    jump.setAttribute('href', '#' + target);
    jump.setAttribute('aria-controls', target);
    pending = false;
  }
  function scheduleUpdate() {
    if (!pending) { pending = true; requestAnimationFrame(update); }
  }
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  update();
})();
