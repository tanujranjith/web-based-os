import { bus } from '../core/event-bus.js';
import { manager } from '../core/window-manager.js';
import { store } from '../core/state.js';
import { theme } from '../core/theme.js';
import { contextMenu } from './context-menu.js';
import { icon } from './icons.js';
import { trapFocus } from './focus-trap.js';

export function initMacShell() {
  const bar = document.querySelector('.system-bar');
  const brand = bar.querySelector('.system-brand');
  brand.innerHTML = '<span class="mac-nova-mark" aria-hidden="true">✦</span>';
  brand.setAttribute('aria-label', 'NovaOS menu');
  const menus = document.createElement('nav');
  menus.className = 'mac-menus';
  menus.setAttribute('aria-label', 'Application menu');
  menus.innerHTML = ['File','Edit','View','Window','Help'].map(name=>`<button data-menu="${name}" aria-haspopup="menu">${name}</button>`).join('');
  bar.querySelector('#active-app').after(menus);
  const showMenu = (button, items) => {
    const rect = button.getBoundingClientRect();
    contextMenu.open(rect.left, rect.bottom + 5, items);
  };
  const actions = {
    File: [
      {label:'New Note', action:()=>manager.open('notes',{newNote:true})},
      {label:'Open Files', action:()=>manager.open('files')},
      {label:'Project Board', action:()=>manager.open('board')},
      {sep:true},
      {label:'Close Window',shortcut:'Ctrl W',action:()=>manager.close(manager.focused()),disabled:()=>!manager.focused()},
    ],
    Edit: [
      {label:'Find in Workspace…',shortcut:'Ctrl K',action:()=>bus.emit('palette-open')},
      {label:'Edit Notes…',action:()=>manager.open('notes')},
      {label:'Edit Code…',action:()=>manager.open('code-editor')},
    ],
    View: [
      {label:'Customize Desktop…',action:()=>manager.open('studio')},
      {label:'Open Calendar',action:()=>manager.open('calendar')},
      {label:'Show All Apps',shortcut:'Ctrl Space',action:()=>bus.emit('launcher-open')},
      {label:'Show Desktop',action:()=>manager.showDesktop()},
      {label:'Mission Control',action:()=>bus.emit('overview-open')},
      {sep:true},
      {label:'Change Wallpaper…',action:()=>manager.open('settings',{tab:'appearance'})},
    ],
    Window: [
      {label:'Move to Left Half',action:()=>manager.snap(manager.focused(),'left')},
      {label:'Move to Right Half',action:()=>manager.snap(manager.focused(),'right')},
      {label:'Restore Floating Window',action:()=>manager.unsnap(manager.focused())},
      {label:'Minimize',action:()=>manager.minimize(manager.focused())},
      {label:'Zoom',action:()=>manager.toggleMaximize(manager.focused())},
      {label:'Tile Windows',action:()=>manager.tile()},
      {sep:true},
      ...['Personal','Studio','Focus'].map((name,index)=>({label:`Switch to ${name}`,action:()=>manager.switchWorkspace(index)})),
    ],
    Help: [
      {label:'About NovaOS',action:()=>manager.open('about')},
      {label:'Globe: drag to rotate · double-click to reset',action:()=>document.querySelector('.globe-handle')?.focus()},
      {label:'Search Apps & Commands…',shortcut:'Ctrl K',action:()=>bus.emit('palette-open')},
    ],
  };
  brand.onclick = () => showMenu(brand,[
    {label:'About NovaOS',action:()=>manager.open('about')},
    {label:'System Settings…',action:()=>manager.open('settings')},
    {label:'Desktop Studio…',action:()=>manager.open('studio')},
    {sep:true},
    {label:'Lock Screen',action:()=>bus.emit('lock')},
    {label:'Show All Apps',action:()=>bus.emit('launcher-open')},
  ]);
  menus.querySelectorAll('button').forEach(button=>button.onclick=()=>showMenu(button,actions[button.dataset.menu].map(item=>({...item,disabled:typeof item.disabled==='function'?item.disabled():item.disabled}))));

  const controls = document.createElement('button');
  controls.className='mac-control-button';
  controls.innerHTML=icon('settings');
  controls.setAttribute('aria-label','Control Center');
  controls.setAttribute('aria-expanded','false');
  bar.querySelector('#system-time').before(controls);
  const panel=document.createElement('section');
  panel.className='mac-control-center'; panel.hidden=true;
  panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Control Center');
  panel.innerHTML=`<header><strong>Control Center</strong><button aria-label="Close Control Center">×</button></header><div class="mac-control-grid"><button data-control="theme">${icon('moon')}<span>Dark Mode</span><small></small></button><button data-control="sounds">${icon('music')}<span>System Sounds</span><small></small></button><button data-control="motion">${icon('layers')}<span>Reduce Motion</span><small></small></button><button data-control="focus">${icon('pomodoro')}<span>Focus</span><small>Open timer</small></button></div><label class="glass-slider"><span>Liquid Glass <small id="glass-value"></small></span><input aria-label="Glass tint" type="range" min="0" max="100" step="1"><span class="glass-slider-captions"><small>Clear</small><small>Tinted</small></span></label><button class="mac-settings-link">System Settings…</button>`;
  document.getElementById('os').appendChild(panel);
  let release;
  const close=()=>{const restore=panel.contains(document.activeElement);panel.hidden=true;controls.setAttribute('aria-expanded','false');release?.();release=null;if(restore)controls.focus();};
  const refresh=()=>{
    const prefs=store.get().prefs;
    for(const [key,on] of Object.entries({theme:document.documentElement.dataset.theme==='dark',sounds:prefs.sounds,motion:prefs.reduceMotion})){
      const b=panel.querySelector(`[data-control="${key}"]`);b.setAttribute('aria-pressed',String(!!on));b.querySelector('small').textContent=on?'On':'Off';
    }
    const tint=prefs.glassTint ?? 48;
    panel.querySelector('input').value=tint;
    panel.querySelector('#glass-value').textContent=`${tint}%`;
    document.documentElement.style.setProperty('--glass-alpha',String(0.22+tint/100*0.72));
  };
  controls.onclick=()=>{if(!panel.hidden){close();return;}refresh();panel.hidden=false;controls.setAttribute('aria-expanded','true');release=trapFocus(panel);panel.querySelector('button').focus();};
  panel.querySelector('header button').onclick=close;
  panel.querySelector('[data-control="theme"]').onclick=()=>theme.setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
  panel.querySelector('[data-control="sounds"]').onclick=()=>store.update(s=>{s.prefs.sounds=!s.prefs.sounds;});
  panel.querySelector('[data-control="motion"]').onclick=()=>theme.toggleReduceMotion();
  panel.querySelector('[data-control="focus"]').onclick=()=>{close();manager.open('pomodoro');};
  panel.querySelector('.mac-settings-link').onclick=()=>{close();manager.open('settings');};
  panel.querySelector('input').oninput=e=>store.update(s=>{s.prefs.glassTint=Number(e.target.value);});
  document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!controls.contains(e.target))close();});
  bus.on('escape',close);bus.on('state-change',refresh);bus.on('theme-change',refresh);
  if(store.get().prefs.accent==='#a8c78d')theme.setAccent('#0a84ff');
  refresh();

  // Magnify nearby Dock items; the container itself stays stationary.
  const dock=document.getElementById('dock');
  dock.addEventListener('pointermove',e=>{
    if(e.pointerType==='touch'||store.get().prefs.reduceMotion||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    dock.querySelectorAll('.dock-item').forEach(item=>{
      const rect=item.getBoundingClientRect();
      const proximity=Math.max(0,1-Math.abs(e.clientX-(rect.left+rect.width/2))/115);
      item.style.setProperty('--dock-scale',String(1+proximity*0.38));
      item.style.setProperty('--dock-lift',`${-proximity*10}px`);
    });
  });
  dock.addEventListener('pointerleave',()=>dock.querySelectorAll('.dock-item').forEach(item=>{item.style.removeProperty('--dock-scale');item.style.removeProperty('--dock-lift');}));
}
