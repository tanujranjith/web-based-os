import { bus } from '../core/event-bus.js';
import { store } from '../core/state.js';

// Orthographic surface rotation keeps the silhouette spherical at every angle.
export function initGlobe() {
  const planet = document.querySelector('.orbit-planet');
  const desktop = document.getElementById('desktop');
  const canvas = document.createElement('canvas');
  canvas.className = 'globe-surface';
  planet.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const layer = document.createElement('div');
  layer.className = 'globe-controls';
  layer.innerHTML = `<button class="globe-handle" aria-label="Rotate globe" aria-describedby="globe-help" title="Drag to rotate · Arrow keys to turn · Double-click or Home to reset"></button><span id="globe-help" class="globe-help">DRAG TO ORBIT <span>↔</span></span>`;
  desktop.prepend(layer);
  const handle = layer.querySelector('button');
  const help = layer.querySelector('.globe-help');
  const rings = [...document.querySelectorAll('.orbit-ring')];
  const moon = document.querySelector('.orbit-moon');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let yaw = 0, pitch = 0, velocityX = 0, velocityY = 0;
  let pointer = null, lastX = 0, lastY = 0, lastTime = 0;
  let frame = 0, lastFrame = 0, size = 0;
  let autoFrame = 0, autoTime = 0;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const hasMotion = () => !reduced.matches && !store.get().prefs.reduceMotion;

  function project(latitude, longitude) {
    const x = Math.cos(latitude) * Math.sin(longitude + yaw);
    const y = Math.sin(latitude);
    const z = Math.cos(latitude) * Math.cos(longitude + yaw);
    return { x, y: y * Math.cos(pitch) - z * Math.sin(pitch), z: y * Math.sin(pitch) + z * Math.cos(pitch) };
  }

  function drawLine(points, color, width) {
    ctx.beginPath();
    let visible = false;
    for (const [latitude, longitude] of points) {
      const p = project(latitude, longitude);
      if (p.z < 0.02) { visible = false; continue; }
      const x = size / 2 + p.x * size * 0.497;
      const y = size / 2 + p.y * size * 0.497;
      if (visible) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      visible = true;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  // A fixed set of surface contours makes horizontal rotation perceptible.
  const bands = Array.from({ length: 47 }, (_, i) => Array.from({ length: 161 }, (_, j) => {
    const longitude = j / 160 * Math.PI * 2;
    const latitude = -1.46 + i / 46 * 2.92;
    const ripple = (Math.sin(longitude * 3 + i * 0.15) * 0.035 + Math.sin(longitude * 7 - i * 0.09) * 0.018) * Math.cos(latitude);
    return [latitude + ripple, longitude];
  }));
  const meridians = Array.from({ length: 12 }, (_, i) => Array.from({ length: 81 }, (_, j) => [-Math.PI / 2 + j / 80 * Math.PI, i / 12 * Math.PI * 2]));

  function render() {
    ctx.clearRect(0, 0, size, size);
    for (let i = 0; i < bands.length; i++) drawLine(bands[i], i % 5 === 0 ? '#dce9ae38' : '#cfdea620', i % 5 === 0 ? 0.9 : 0.65);
    for (const line of meridians) drawLine(line, '#dce9ae20', 0.8);
    // Rotate the orbital plane alongside the surface, keeping the planet round.
    for (const ring of rings) ring.style.transform = `rotate(${-39 + yaw * 28}deg) scaleY(${1 + Math.sin(pitch) * 0.65})`;
    moon.style.transform = `translate(${Math.sin(yaw) * size * 0.22}px, ${Math.sin(pitch) * size * 0.2}px)`;
    handle.setAttribute('aria-description', `Longitude ${Math.round(yaw * 180 / Math.PI)} degrees, tilt ${Math.round(pitch * 180 / Math.PI)} degrees. Use arrow keys to rotate; Home to reset.`);
  }

  function stop() { cancelAnimationFrame(frame); frame = 0; velocityX = velocityY = 0; }
  function release() {
    if (pointer !== null && handle.hasPointerCapture(pointer)) handle.releasePointerCapture(pointer);
    pointer = null;
    layer.classList.remove('dragging');
  }
  function reset() { stop(); release(); yaw = pitch = 0; render(); }
  function sync() {
    const active = store.get().prefs.wallpaper === 'orbit';
    layer.hidden = !active;
    if (!active || !hasMotion()) { stop(); release(); }
    cancelAnimationFrame(autoFrame);autoFrame=0;autoTime=0;
    if(active && hasMotion() && store.get().prefs.globeAuto && !document.hidden)autoFrame=requestAnimationFrame(autoOrbit);
  }
  function autoOrbit(now) {
    const dt=autoTime?Math.min(32,now-autoTime):0;autoTime=now;
    if(pointer===null && !frame){yaw+=dt*0.000045;render();}
    autoFrame=requestAnimationFrame(autoOrbit);
  }
  function resize() {
    stop();
    const rect = planet.getBoundingClientRect();
    const bounds = desktop.getBoundingClientRect();
    size = rect.width;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    Object.assign(handle.style, { left: `${rect.left - bounds.left}px`, top: `${rect.top - bounds.top + desktop.scrollTop}px`, width: `${size}px`, height: `${size}px` });
    help.style.left = `${clamp(rect.left + size * 0.5 - bounds.left, 70, bounds.width - 70)}px`;
    help.style.top = `${Math.min(rect.bottom - bounds.top - 24, bounds.height - 25)}px`;
    render();
  }
  function coast(now) {
    const dt = Math.min(32, now - lastFrame);
    lastFrame = now;
    if (!hasMotion() || document.hidden) { stop(); return; }
    yaw += velocityX * dt;
    pitch = clamp(pitch + velocityY * dt, -1.3, 1.3);
    const decay = Math.pow(0.93, dt / 16.67);
    velocityX *= decay; velocityY *= decay;
    render();
    if (Math.abs(velocityX) + Math.abs(velocityY) > 0.00003) frame = requestAnimationFrame(coast);
    else stop();
  }

  handle.addEventListener('pointerdown', e => {
    if (e.button !== 0 || pointer !== null) return;
    stop();
    pointer = e.pointerId;
    lastX = e.clientX; lastY = e.clientY; lastTime = performance.now();
    handle.setPointerCapture(pointer);
    handle.focus({ preventScroll: true });
    layer.classList.add('dragging');
    e.preventDefault(); e.stopPropagation();
  });
  handle.addEventListener('pointermove', e => {
    if (pointer !== e.pointerId) return;
    const now = performance.now(), dt = Math.max(8, now - lastTime);
    const dx = (e.clientX - lastX) * 0.006, dy = (e.clientY - lastY) * 0.006;
    yaw += dx; pitch = clamp(pitch + dy, -1.3, 1.3);
    velocityX = clamp(dx / dt, -0.009, 0.009); velocityY = clamp(dy / dt, -0.009, 0.009);
    lastX = e.clientX; lastY = e.clientY; lastTime = now;
    render();
  });
  handle.addEventListener('pointerup', e => {
    if (pointer !== e.pointerId) return;
    const coastAllowed = hasMotion() && performance.now() - lastTime < 100;
    // Release first; the lost-capture handler must not cancel intentional momentum.
    const id = pointer; pointer = null;
    handle.releasePointerCapture(id); layer.classList.remove('dragging');
    if (coastAllowed) { lastFrame = performance.now(); frame = requestAnimationFrame(coast); }
    else stop();
  });
  const cancel = () => { stop(); release(); };
  handle.addEventListener('pointercancel', cancel);
  handle.addEventListener('lostpointercapture', () => { if (pointer !== null) cancel(); });
  handle.addEventListener('dblclick', e => { e.preventDefault(); reset(); });
  handle.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); });
  handle.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'Enter', ' '].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation(); stop();
    if (['Home', 'Enter', ' '].includes(e.key)) { reset(); return; }
    const step = e.shiftKey ? 0.2 : 0.07;
    yaw += e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
    pitch = clamp(pitch + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0), -1.3, 1.3);
    render();
  });
  window.addEventListener('resize', resize);
  new ResizeObserver(resize).observe(planet);
  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); sync(); });
  reduced.addEventListener('change', sync);
  bus.on('theme-change', sync);
  bus.on('state-change', sync);
  bus.on('globe-reset', reset);
  requestAnimationFrame(resize); sync();
}
