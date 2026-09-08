import { store } from '../core/state.js';
import { bus } from '../core/event-bus.js';
import { theme, wallpapers } from '../core/theme.js';
import { icon } from '../ui/icons.js';

export default {
  id:'studio', name:'Desktop Studio', category:'System', keywords:['customize','wallpaper','globe','widgets','appearance'], defaultSize:{w:930,h:690},
  mount(container) {
    const el=document.createElement('div');el.className='studio-app';container.appendChild(el);
    el.innerHTML=`<header class="studio-header"><div><span class="studio-eyebrow">DESIGNED AROUND YOU</span><h1>Your desktop.<br><em>Your universe.</em></h1><p>Shape the space where your next idea begins.</p></div><div class="studio-orb" aria-hidden="true"><span></span></div></header><div class="studio-sections"><section><h2>Set the atmosphere</h2><p>A different backdrop. A different state of mind.</p><div class="studio-wallpapers">${Object.entries(wallpapers).map(([key,value])=>`<button data-wallpaper="${key}" aria-label="${value.name} background"><span style="background:${value.css}"></span><strong>${value.name}</strong></button>`).join('')}</div></section><section><h2>Orbital playground</h2><p>Drag the globe to rotate. Tune its look here.</p><div class="studio-materials">${[['ice','Glacier'],['violet','Amethyst'],['ember','Solar'],['mint','Jade']].map(([key,name])=>`<button data-material="${key}"><i class="material-${key}"></i>${name}</button>`).join('')}</div><label class="studio-range"><span>Globe scale <output data-output="globeZoom"></output></span><input type="range" min="65" max="120" step="1" data-pref="globeZoom" aria-label="Globe scale"></label><div class="studio-row"><div><strong>Automatic orbit</strong><small>A slow rotation when you're not interacting</small></div><button class="studio-toggle" data-toggle="globeAuto" aria-label="Automatic orbit"></button></div><div class="studio-row"><div><strong>Orbital rings</strong><small>Trace the globe's rotating plane</small></div><button class="studio-toggle" data-toggle="globeRings" aria-label="Orbital rings"></button></div><button class="btn" data-reset>Reset globe orientation</button></section><section><h2>Less clutter. More you.</h2><p>Keep your favorite information within reach.</p>${[['showCalendar','Today widget','Clock and a glance at your week'],['showFocus','Focus widget','Keep your current session in sight'],['showScratchpad','Scratchpad','A place for passing thoughts'],['showShelf','Recent-app shelf','Jump between your latest tools'],['doNotDisturb','Do Not Disturb','Keep notifications in the center, without banners or sounds']].map(([key,name,description])=>`<div class="studio-row"><div><strong>${name}</strong><small>${description}</small></div><button class="studio-toggle" data-toggle="${key}" aria-label="${name}"></button></div>`).join('')}</section><section><h2>Finish with glass</h2><div class="studio-appearance"><button data-theme="light">${icon('about')}Light</button><button data-theme="dark">${icon('moon')}Dark</button><button data-theme="system">${icon('settings')}System</button></div><label class="studio-range"><span>Glass tint <output data-output="glassTint"></output></span><input type="range" min="0" max="100" data-pref="glassTint" aria-label="Desktop glass tint"></label><p class="studio-local">Changes are saved to this profile, on this device.</p></section></div>`;
    const defaults={globeAuto:false,globeRings:true,showCalendar:true,showFocus:true,showScratchpad:true,showShelf:true,doNotDisturb:false,globeZoom:100,glassTint:48};
    function refresh(){
      const prefs=store.get().prefs;
      el.querySelectorAll('[data-toggle]').forEach(button=>button.setAttribute('aria-pressed',String(prefs[button.dataset.toggle]??defaults[button.dataset.toggle])));
      el.querySelectorAll('[data-pref]').forEach(input=>{const value=prefs[input.dataset.pref]??defaults[input.dataset.pref];input.value=value;el.querySelector(`[data-output="${input.dataset.pref}"]`).textContent=`${value}%`;});
      for(const [attr,value] of [['wallpaper',prefs.wallpaper],['material',prefs.globeMaterial||'ice'],['theme',prefs.theme]])el.querySelectorAll(`[data-${attr}]`).forEach(button=>button.setAttribute('aria-pressed',String(button.dataset[attr]===value)));
    }
    el.querySelectorAll('[data-toggle]').forEach(button=>button.onclick=()=>store.update(s=>{const key=button.dataset.toggle;s.prefs[key]=!(s.prefs[key]??defaults[key]);}));
    el.querySelectorAll('[data-pref]').forEach(input=>input.oninput=()=>store.update(s=>{s.prefs[input.dataset.pref]=Number(input.value);}));
    el.querySelectorAll('[data-wallpaper]').forEach(button=>button.onclick=()=>theme.setWallpaper(button.dataset.wallpaper));
    el.querySelectorAll('[data-material]').forEach(button=>button.onclick=()=>store.update(s=>{s.prefs.globeMaterial=button.dataset.material;}));
    el.querySelectorAll('[data-theme]').forEach(button=>button.onclick=()=>theme.setTheme(button.dataset.theme));
    el.querySelector('[data-reset]').onclick=()=>bus.emit('globe-reset');
    const off=bus.on('state-change',refresh);refresh();
    return {unmount(){off();el.remove();}};
  },
};
