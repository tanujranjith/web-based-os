import { store } from '../core/state.js';
import { bus } from '../core/event-bus.js';
import { manager } from '../core/window-manager.js';
import { registry } from '../core/app-registry.js';
import { icon, escape } from './icons.js';
import { dateKey, eventsForDay } from '../core/calendar.js';

export function initDesktopPlus() {
  const os=document.getElementById('os');
  const shelf=document.createElement('aside');shelf.className='activity-shelf';shelf.setAttribute('aria-label','Recent apps');os.appendChild(shelf);
  const bottom=document.querySelector('.desktop-bottom');
  const customize=document.createElement('button');customize.className='customize-desktop';customize.setAttribute('aria-label','Customize desktop');customize.innerHTML=`${icon('settings')}<span>Customize desktop</span>`;customize.onclick=()=>manager.open('studio');bottom.prepend(customize);
  const date=document.getElementById('orbit-date');
  const calendarButton=document.createElement('button');calendarButton.className='today-calendar-link';calendarButton.setAttribute('aria-label','Open Calendar');date.replaceWith(calendarButton);calendarButton.appendChild(date);calendarButton.onclick=()=>manager.open('calendar');
  const upcoming=document.createElement('button');upcoming.className='upcoming-event';upcoming.onclick=()=>manager.open('calendar',{date:dateKey()});document.querySelector('.orbit-today').appendChild(upcoming);
  const dnd=document.createElement('button');dnd.className='dnd-indicator';dnd.innerHTML=icon('moon');dnd.setAttribute('aria-label','Disable Do Not Disturb');dnd.title='Do Not Disturb is on';dnd.onclick=()=>store.update(s=>{s.prefs.doNotDisturb=false;});document.querySelector('.system-actions').prepend(dnd);
  let shelfSignature='';
  function render(){
    const prefs=store.get().prefs;
    document.documentElement.dataset.globeMaterial=prefs.globeMaterial||'ice';
    document.documentElement.style.setProperty('--globe-zoom',String(Math.min(120,Math.max(65,Number(prefs.globeZoom)||100))/100));
    document.documentElement.dataset.globeRings=String(prefs.globeRings!==false);
    for(const [selector,key] of [['.orbit-today','showCalendar'],['.orbit-focus','showFocus'],['.widget-quick-note','showScratchpad']])document.querySelector(selector).classList.toggle('widget-disabled',prefs[key]===false);
    shelf.hidden=prefs.showShelf===false;dnd.hidden=!prefs.doNotDisturb;
    const records=manager.list().filter(rec=>!rec.closing),ids=[...new Set([...records.map(rec=>rec.id),...store.get().recent])].filter(id=>registry.get(id)).slice(0,5);
    const signature=JSON.stringify([ids,records.map(rec=>[rec.id,rec.state.minimized,rec.state.workspace]),manager.focused()]);
    if(signature!==shelfSignature){shelfSignature=signature;shelf.innerHTML=`<span class="shelf-caption">RECENT</span>${ids.length?ids.map(id=>{const app=registry.get(id),rec=records.find(r=>r.id===id);return `<button data-shelf-app="${id}" data-app="${id}" class="${manager.focused()===id?'active':''}" aria-label="Switch to ${escape(app.name)}"><span class="shelf-icon">${app.icon}</span><span><strong>${escape(app.name)}</strong><small>${rec?`${['Personal','Studio','Focus'][rec.state.workspace]} · ${rec.state.minimized?'Minimized':'Open'}`:'Open app'}</small></span>${rec?'<i></i>':''}</button>`;}).join(''):'<p>Your recent apps<br>will appear here.</p>'}<button class="shelf-overview">${icon('layers')}<span>All windows</span></button>`;shelf.querySelectorAll('[data-shelf-app]').forEach(button=>button.onclick=()=>manager.open(button.dataset.shelfApp));shelf.querySelector('.shelf-overview').onclick=()=>bus.emit('overview-open');}
    const events=eventsForDay(store.get().events||[],dateKey());
    upcoming.hidden=!events.length;
    if(events.length)upcoming.innerHTML=`<span class="event-dot ${events[0].category}"></span><span><small>${events[0].time||'ALL DAY'} · TODAY</small><strong>${escape(events[0].title)}</strong></span>${icon('arrow')}`;
  }
  ['state-change','window-open','window-close','window-focus','window-minimize','window-restore','workspace-change'].forEach(event=>bus.on(event,render));
  render();setInterval(render,60000);
}
