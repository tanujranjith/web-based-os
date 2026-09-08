import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source=(await readFile(new URL('../src/core/state.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace('export const store','const store')+'\nthis.storeApi=store;';
function harness() {
  const data=new Map();let full=false;
  const context={profiles:{storageKey:()=> 'novaos:profile:test',active:()=>({name:'Tester',avatar:'T'})},bus:{emit(){}},localStorage:{getItem:k=>data.get(k),setItem:(k,v)=>{if(full)throw new Error('Storage full');data.set(k,v);},removeItem:k=>data.delete(k)},window:{addEventListener(){}},console,setTimeout:()=>1,clearTimeout(){}};
  vm.runInNewContext(source,context);
  return{store:context.storeApi,data,setFull:()=>{full=true;}};
}
test('old backups inherit new defaults without losing notes',()=>{
  const h=harness();h.store.restore({version:1,notes:[{id:'kept',title:'Kept',body:'My work'}],prefs:{theme:'light'}});assert.equal(h.store.get().prefs.theme,'light');assert.equal(h.store.get().notes[0].body,'My work');assert.equal(h.store.get().board.length,0);
});
test('restore writes to the active profile and subsequent flush retains it',()=>{
  const h=harness();h.store.restore({version:1,quickNote:'Restored'});h.store.flush();assert.equal(JSON.parse(h.data.get('novaos:profile:test')).quickNote,'Restored');assert.equal(h.data.has('novaos:v1'),false);
});
test('invalid backup fields leave the current state intact',()=>{
  const h=harness();h.store.set('quickNote','Keep me');assert.throws(()=>h.store.restore({version:1,notes:'invalid'}));assert.equal(h.store.get().quickNote,'Keep me');
});
test('failed backup persistence does not replace the live state',()=>{
  const h=harness();h.store.set('quickNote','Original');h.setFull();assert.throws(()=>h.store.restore({version:1,quickNote:'Replacement'}));assert.equal(h.store.get().quickNote,'Original');
});
test('prototype keys in imported preferences are ignored',()=>{
  const h=harness();h.store.restore(JSON.parse('{"version":1,"prefs":{"__proto__":{"polluted":true}}}'));assert.equal(h.store.get().prefs.polluted,undefined);assert.equal({}.polluted,undefined);
});

test('calendar events and desktop customizations survive backup restore',()=>{
  const h=harness();
  h.store.restore({version:1,events:[{id:'e1',title:'Planning',date:'2026-09-07',time:'09:00',category:'work'}],prefs:{globeMaterial:'violet',globeZoom:85,doNotDisturb:true}});
  h.store.flush();
  const saved=JSON.parse(h.data.get('novaos:profile:test'));
  assert.equal(saved.events[0].title,'Planning');assert.equal(saved.prefs.globeZoom,85);assert.equal(saved.prefs.doNotDisturb,true);
  assert.throws(()=>h.store.restore({version:1,events:'invalid'}));assert.equal(h.store.get().events.length,1);
});
