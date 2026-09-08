// A shared, dependency-free icon language for every NovaOS surface.
const paths = {
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 11h18M7 15h2M13 15h4M7 18h2"/>',
  studio: '<path d="m12 2 2.8 6.2L22 11l-7.2 2.8L12 21l-2.8-7.2L2 11l7.2-2.8ZM20 18v4M18 20h4"/>',
  files: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3Z"/>',
  notes: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  browser: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',
  terminal: '<path d="m5 7 5 5-5 5M13 17h6"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
  tasks: '<rect x="4" y="4" width="16" height="17" rx="3"/><path d="m8 12 3 3 5-6M9 2h6"/>',
  board: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16M15 4v16M5 8h2M11 8h2M17 8h2"/>',
  music: '<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="17" cy="16" rx="3" ry="3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  pomodoro: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6M18 5l2-2"/>',
  calculator: '<rect x="5" y="2" width="14" height="20" rx="3"/><path d="M8 7h8M8 12h1m6 0h1M8 17h1m6 0h1"/>',
  paint: '<path d="m14 4 6 6-9 9-7 1 1-7Z M11 7l6 6"/>',
  camera: '<path d="M3 7h5l2-3h4l2 3h5v13H3Z"/><circle cx="12" cy="13" r="4"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  game: '<path d="M7 7h10c4 0 6 13 2 13l-4-4H9l-4 4C1 20 3 7 7 7Z M8 10v5M5.5 12.5h5M16 11h.1M18 14h.1"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  moon: '<path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 17l10 5 10-5"/>',
  about: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
};
const aliases = { 'code-editor': 'code', 'image-viewer': 'image', 'pdf-viewer': 'notes', markdown: 'code', snake: 'game', 'game-2048': 'game', '2048': 'game', minesweeper: 'game' };
export function icon(id) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[aliases[id] || id] || paths.grid}</svg>`;
}
export function installIcons(registry) { registry.all().forEach(app => { app.icon = icon(app.id); }); }
export function escape(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
