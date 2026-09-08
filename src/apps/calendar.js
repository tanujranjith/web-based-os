import { store } from '../core/state.js';
import { bus } from '../core/event-bus.js';
import { dateKey, parseDate, monthDays, eventsForDay, normalizeEvent } from '../core/calendar.js';
import { icon, escape } from '../ui/icons.js';

export default {
  id: 'calendar', name: 'Calendar', category: 'Productivity', keywords: ['events','schedule','agenda','planner'], defaultSize: { w: 1060, h: 700 },
  mount(container, ctx) {
    const el = document.createElement('div'); el.className = 'calendar-app'; container.appendChild(el);
    let selected = dateKey(), month = new Date(), editing = null;
    el.innerHTML = `<header class="calendar-toolbar"><div><span class="studio-eyebrow">MAKE TIME FOR WHAT MATTERS</span><h1></h1></div><div><button class="btn" data-nav="-1" aria-label="Previous month">‹</button><button class="btn" data-today>Today</button><button class="btn" data-nav="1" aria-label="Next month">›</button><button class="btn primary" data-new>＋ Event</button></div></header><div class="calendar-layout"><section class="calendar-month"><div class="calendar-weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=>`<span>${day}</span>`).join('')}</div><div class="calendar-grid"></div><footer><span class="event-dot personal"></span>Personal <span class="event-dot work"></span>Work <span class="event-dot important"></span>Important</footer></section><aside class="calendar-agenda"><span class="studio-eyebrow">YOUR SCHEDULE</span><h2></h2><div class="calendar-events"></div><button class="btn" data-day-add>＋ Add to this day</button><form class="event-form" hidden><h3></h3><label>Title<input class="input" name="title" aria-label="Event title" maxlength="160" required></label><div class="event-fields"><label>Date<input class="input" name="date" aria-label="Event date" type="date" required></label><label>Time<input class="input" name="time" aria-label="Event time" type="time"></label></div><label>Calendar<select class="input" name="category" aria-label="Event calendar"><option value="personal">Personal</option><option value="work">Work</option><option value="important">Important</option></select></label><label>Details<textarea class="input" name="details" aria-label="Event details" maxlength="2000" rows="3"></textarea></label><p class="event-error" role="alert"></p><div class="event-actions"><button class="btn" type="button" data-cancel>Cancel</button><button class="btn primary" type="submit">Save event</button></div></form></aside></div>`;
    const form = el.querySelector('form');
    let pendingDelete=null;
    const confirmation=document.createElement('div');confirmation.className='calendar-confirm';confirmation.hidden=true;
    confirmation.setAttribute('role','alertdialog');confirmation.setAttribute('aria-label','Delete calendar event');
    confirmation.innerHTML='<strong>Delete this event?</strong><p>This removes it from your local calendar.</p><button class="btn" data-keep>Keep event</button><button class="btn" data-confirm-delete>Delete event</button>';
    el.querySelector('.calendar-agenda').appendChild(confirmation);
    confirmation.querySelector('[data-keep]').onclick=()=>{confirmation.hidden=true;pendingDelete=null;};
    confirmation.querySelector('[data-confirm-delete]').onclick=()=>{if(editing===pendingDelete)form.hidden=true;store.update(s=>{s.events=s.events.filter(event=>event.id!==pendingDelete);});confirmation.hidden=true;pendingDelete=null;};
    const events = () => store.get().events || [];
    function render() {
      const today = dateKey();
      el.querySelector('h1').textContent = month.toLocaleDateString([], {month:'long', year:'numeric'});
      el.querySelector('.calendar-grid').innerHTML = monthDays(month.getFullYear(), month.getMonth()).map(date=>{
        const key=dateKey(date), dayEvents=eventsForDay(events(),key);
        return `<button class="calendar-day ${date.getMonth()!==month.getMonth()?'outside':''} ${key===today?'today':''} ${key===selected?'selected':''}" data-date="${key}" aria-label="${escape(date.toLocaleDateString([], {dateStyle:'full'}))}, ${dayEvents.length} events" aria-pressed="${key===selected}"><span class="day-number">${date.getDate()}</span><span class="day-event-list">${dayEvents.slice(0,2).map(event=>`<span class="day-event ${event.category}">${escape(event.title)}</span>`).join('')}${dayEvents.length>2?`<small>+${dayEvents.length-2} more</small>`:''}</span></button>`;
      }).join('');
      el.querySelectorAll('[data-date]').forEach(button=>button.onclick=()=>{selected=button.dataset.date;form.hidden=true;render();el.querySelector(`[data-date="${selected}"]`)?.focus();});
      el.querySelector('.calendar-agenda h2').textContent=parseDate(selected).toLocaleDateString([], {weekday:'long',month:'short',day:'numeric'});
      const items=eventsForDay(events(),selected);
      el.querySelector('.calendar-events').innerHTML=items.length?items.map(event=>`<article class="agenda-event ${event.category}"><small>${event.time?escape(event.time):'ALL DAY'} · ${escape(event.category)}</small><button data-edit="${escape(event.id)}">${escape(event.title)}</button>${event.details?`<p>${escape(event.details)}</p>`:''}<button class="event-delete" data-delete="${escape(event.id)}" aria-label="Delete ${escape(event.title)}">×</button></article>`).join(''):`<div class="calendar-empty">${icon('calendar')}<h3>A little room to breathe.</h3><p>Nothing scheduled. Make space for something good.</p></div>`;
      el.querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>edit(events().find(event=>event.id===button.dataset.edit)));
      el.querySelectorAll('[data-delete]').forEach(button=>button.onclick=()=>{pendingDelete=button.dataset.delete;confirmation.hidden=false;confirmation.querySelector('[data-keep]').focus();});
    }
    function edit(event) {
      editing=event?.id || null; form.reset();
      form.querySelector('h3').textContent=event?'Edit event':'A new possibility';
      for(const key of ['title','date','time','category','details']) form.elements[key].value=event?.[key] || (key==='date'?selected:key==='category'?'personal':'');
      form.querySelector('.event-error').textContent='';form.hidden=false;form.elements.title.focus();
    }
    el.querySelectorAll('[data-nav]').forEach(button=>button.onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+Number(button.dataset.nav),1,12);render();});
    el.querySelector('[data-today]').onclick=()=>{selected=dateKey();month=new Date();form.hidden=true;render();};
    el.querySelector('[data-new]').onclick=()=>edit();el.querySelector('[data-day-add]').onclick=()=>edit();
    el.querySelector('[data-cancel]').onclick=()=>{form.hidden=true;el.querySelector('[data-day-add]').focus();};
    form.onsubmit=event=>{
      event.preventDefault();
      try {
        const entry=normalizeEvent(Object.fromEntries(new FormData(form)));
        selected=entry.date;month=parseDate(selected);form.hidden=true;
        store.update(s=>{s.events??=[];const old=s.events.find(item=>item.id===editing);if(old)Object.assign(old,entry);else s.events.push({id:crypto.randomUUID(),...entry});});
      } catch(error) {form.hidden=false;form.querySelector('.event-error').textContent=error.message;}
    };
    const off=bus.on('state-change',render);
    const onOpen=opts=>{if(parseDate(opts?.date)){selected=opts.date;month=parseDate(selected);}render();if(opts?.newEvent)edit();};
    onOpen(ctx.opts);
    return {onOpen,unmount(){off();el.remove();}};
  },
};
