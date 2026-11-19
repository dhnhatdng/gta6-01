// Keyboard and mouse input for Solara Bay: WASD, Shift, Space, E, 1/2, M, Esc,
// plus mouse-drag orbit and click-to-attack. Keeps a live key set and edge-triggered presses.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let dragDX = 0, dragDY = 0;
  let dragging = false;
  let lastX = 0, lastY = 0;
  let clicked = false;
  let clickX = 0, clickY = 0;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    dragDX += e.clientX - lastX;
    dragDY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mouseup', (e) => {
    if (dragging && Math.hypot(e.clientX - lastX, e.clientY - lastY) < 6 && e.target === canvas) {
      clicked = true; clickX = e.clientX; clickY = e.clientY;
    }
    dragging = false;
  });

  return {
    isDown(code) { return keys.has(code); },
    wasPressed(code) { return pressed.has(code); },
    takeDrag() { const d = { dx: dragDX, dy: dragDY }; dragDX = 0; dragDY = 0; return d; },
    takeClick() {
      if (!clicked) return null;
      clicked = false;
      return { x: clickX, y: clickY };
    },
    endFrame() { pressed.clear(); },
  };
}
