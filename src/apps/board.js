import { store } from '../core/state.js';
import { icon, escape } from '../ui/icons.js';

const columns = [{id:'ideas',name:'On the horizon',color:'#b8b4d8'},{id:'doing',name:'In motion',color:'#e8c280'},{id:'done',name:'Made it happen',color:'#a8c78d'}];
export default {
  id:'board', name:'Project Board', category:'Productivity', icon:'▥', defaultSize:{w:1000,h:640}, keywords:['kanban','projects','plan','ideas'],
  mount(container) {
    const el=document.createElement('div');el.className='project-board';container.appendChild(el);
    let query='',dragged=null,editing=null;
    el.innerHTML=`<div class="board-heading"><div><div class="home-eyebrow">SMALL STEPS. BIG POSSIBILITIES.</div><h1>Make it happen<span>.</span></h1><p>A home for everything you're working toward.</p></div><span class="board-logo">${icon('board')}</span></div><div class="board-toolbar"><span id="board-summary"></span><input class="input" aria-label="Search cards" placeholder="Find a card…"><button class="btn primary" id="board-add">＋ New card</button></div><form class="board-form" hidden><input class="input" name="title" maxlength="160" placeholder="What do you want to work on?" aria-label="Card title" required><textarea class="input" name="description" maxlength="4000" placeholder="Add a few details…" aria-label="Card description"></textarea><div><select class="input" name="priority" aria-label="Card priority"><option>Normal</option><option>High</option><option>Low</option></select><button class="btn" type="button" id="board-cancel">Cancel</button><button class="btn primary" type="submit">Save card</button></div></form><div class="board-columns"></div><div class="board-bottom">Drag cards between columns, or use their move control.<span>Saved locally · Your space, your pace</span></div>`;
    const form=el.querySelector('form');
    const cards=()=>store.get().board||[];
    function render(){
      const all=cards(),done=all.filter(c=>c.status==='done').length;
      el.querySelector('#board-summary').textContent=`${all.length} cards · ${done} complete`;
      el.querySelector('.board-columns').innerHTML=columns.map(col=>{
        const list=all.filter(c=>c.status===col.id&&`${c.title} ${c.description}`.toLowerCase().includes(query));
        return `<section class="board-column" data-column="${col.id}"><header><span style="background:${col.color}"></span><h2>${col.name}</h2><small>${list.length}</small><button data-add="${col.id}" aria-label="Add card to ${col.name}">＋</button></header><div class="board-card-list">${list.map(c=>`<article class="board-card" draggable="true" data-id="${c.id}"><div class="card-meta"><span class="priority priority-${c.priority.toLowerCase()}">${escape(c.priority)} priority</span><button data-edit="${c.id}" aria-label="Edit ${escape(c.title)}">•••</button></div><h3>${escape(c.title)}</h3>${c.description?`<p>${escape(c.description)}</p>`:''}<footer><select aria-label="Move ${escape(c.title)}" data-status="${c.id}">${columns.map(x=>`<option value="${x.id}" ${x.id===c.status?'selected':''}>${x.name}</option>`).join('')}</select><button data-delete="${c.id}" aria-label="Delete ${escape(c.title)}">×</button></footer></article>`).join('')||`<div class="board-empty">${icon(col.id==='done'?'tasks':'layers')}<p>${query?'No matching cards':col.id==='ideas'?'Every great thing starts with an idea.':col.id==='doing'?'Pick an idea. Give it some momentum.':'Good things take a little doing.'}</p></div>`}</div></section>`;
      }).join('');
      el.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>showForm(null,b.dataset.add));
      el.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>showForm(b.dataset.edit));
      el.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{if(confirm('Delete this card?')){store.update(s=>{s.board=cards().filter(c=>c.id!==b.dataset.delete);});render();}});
      el.querySelectorAll('[data-status]').forEach(b=>b.onchange=()=>move(b.dataset.status,b.value));
      el.querySelectorAll('.board-card').forEach(c=>{c.ondragstart=e=>{dragged=c.dataset.id;e.dataTransfer.setData('text/plain',dragged);e.dataTransfer.effectAllowed='move';c.classList.add('dragging');};c.ondragend=()=>{dragged=null;c.classList.remove('dragging');el.querySelectorAll('.drag-over').forEach(n=>n.classList.remove('drag-over'));};});
      el.querySelectorAll('[data-column]').forEach(c=>{c.ondragover=e=>{if(!dragged)return;e.preventDefault();c.classList.add('drag-over');};c.ondragleave=e=>{if(!c.contains(e.relatedTarget))c.classList.remove('drag-over');};c.ondrop=e=>{e.preventDefault();if(dragged)move(dragged,c.dataset.column);dragged=null;};});
    }
    function move(id,status){store.update(s=>{const c=s.board.find(x=>x.id===id);if(c)c.status=status;});render();}
    function showForm(id,status='ideas'){
      editing=id;form.reset();form.dataset.status=status;
      const card=cards().find(c=>c.id===id);
      if(card){form.elements.title.value=card.title;form.elements.description.value=card.description;form.elements.priority.value=card.priority;form.dataset.status=card.status;}
      form.hidden=false;form.elements.title.focus();
    }
    el.querySelector('#board-add').onclick=()=>showForm(null);
    el.querySelector('#board-cancel').onclick=()=>{form.hidden=true;editing=null;};
    el.querySelector('.board-toolbar input').oninput=e=>{query=e.target.value.toLowerCase();render();};
    form.onsubmit=e=>{e.preventDefault();const title=form.elements.title.value.trim();if(!title)return;const entry={title,description:form.elements.description.value.trim(),priority:form.elements.priority.value,status:form.dataset.status};store.update(s=>{s.board??=[];const old=s.board.find(c=>c.id===editing);if(old)Object.assign(old,entry);else s.board.push({id:crypto.randomUUID(),createdAt:Date.now(),...entry});});form.hidden=true;render();};
    render();return{unmount(){el.remove();}};
  }
};
