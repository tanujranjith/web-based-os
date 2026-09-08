import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source=(await readFile(new URL('../src/core/focus-timer.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/export const /g,'const ')+'\nthis.timer=focusTimer;';
function harness(saved={}) {
  let now=100000, tick;
  const events=[];
  const context={store:{get:()=>saved,update:fn=>fn(saved)},bus:{emit:(name,data)=>events.push({name,data})},Date:{now:()=>now},setInterval:fn=>{tick=fn;}};
  vm.runInNewContext(source,context);
  return {timer:context.timer,events,saved,advance:seconds=>{now+=seconds*1000;tick();}};
}
test('pause and resume retain the original duration and remaining time',()=>{
  const h=harness();h.timer.toggle();h.advance(100);assert.equal(h.timer.snapshot().remaining,1400);
  h.timer.toggle();h.advance(90);assert.equal(h.timer.snapshot().remaining,1400);
  h.timer.toggle();h.advance(100);assert.equal(h.timer.snapshot().remaining,1300);assert.equal(h.timer.snapshot().total,1500);
});
test('skip changes mode without awarding a completed session',()=>{
  const h=harness();h.timer.toggle();h.timer.skip();assert.equal(h.timer.snapshot().mode,'short');assert.equal(h.timer.snapshot().remaining,300);assert.equal(h.timer.snapshot().completed,0);assert.equal(h.timer.snapshot().endAt,null);
});
test('completion fires once and switches to a stopped break',()=>{
  const h=harness();h.timer.toggle();h.advance(1600);h.advance(10);assert.equal(h.timer.snapshot().completed,1);assert.equal(h.timer.snapshot().mode,'short');assert.equal(h.events.filter(e=>e.name==='notify').length,1);
});
test('every fourth completed focus session earns a long break',()=>{
  const h=harness();for(let i=0;i<4;i++){h.timer.mode('focus');h.timer.toggle();h.advance(1500);}assert.equal(h.timer.snapshot().mode,'long');assert.equal(h.timer.snapshot().remaining,900);
});
test('reloading the module recovers a stored running deadline',()=>{
  const first=harness();first.timer.toggle();const second=harness(first.saved);second.advance(220);assert.equal(second.timer.snapshot().remaining,1280);assert.ok(second.timer.snapshot().endAt);
});
test('reset restores the full selected duration and stops the timer',()=>{
  const h=harness();h.timer.mode('long');h.timer.toggle();h.advance(100);h.timer.reset();assert.equal(h.timer.snapshot().remaining,900);assert.equal(h.timer.snapshot().endAt,null);
});
