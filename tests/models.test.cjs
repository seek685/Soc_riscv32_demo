'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('../evolution-models.js');

test('catalogue has unique routes and scope statements for all 13 topics',()=>{
  assert.equal(M.topics.length,13);
  assert.equal(new Set(M.topics.map(t=>t.id)).size,13);
  for(const topic of M.topics){assert.ok(topic.steps.length>=7);assert.ok(topic.scope);assert.ok(topic.source.length);}
});
test('dynamic crop margin follows integer RTL rule at threshold and large widths',()=>{
  assert.equal(M.margin(80),10);assert.equal(M.margin(160),10);
  assert.equal(M.margin(175),10);assert.equal(M.margin(176),11);
  assert.equal(M.margin(320),20);assert.equal(M.margin(1000),62);
});
test('interleaved targets cannot share votes; each needs five frames across 600 ms',()=>{
  const before=M.trackSimulation(8);assert.equal(before.accepted,0);
  assert.equal(before.tracks.A.votes,4);assert.equal(before.tracks.B.votes,4);
  const a=M.trackSimulation(9);assert.equal(a.accepted,1);assert.equal(a.tracks.B.accepted,false);
  const both=M.trackSimulation(10);assert.equal(both.accepted,2);assert.equal(both.oldAccepted,0);
});
test('repeated frames, old frames and hardware flushes add no confirmation votes',()=>{
  const before=M.trackSimulation(10),after=M.trackSimulation(13);
  assert.equal(after.tracks.A.votes,before.tracks.A.votes);
  assert.equal(after.tracks.B.votes,before.tracks.B.votes);
  assert.equal(after.skipped,3);assert.equal(after.accepted,2);
});
test('touch needs paired same-page events, limited drag and the actual rectangle',()=>{
  const down={page:1,x:150,y:365};
  assert.equal(M.tapAction(down,{...down},1,false),'target');
  assert.equal(M.tapAction(null,down,1,false),null);
  assert.equal(M.tapAction(down,{...down,x:180},1,false),null);
  assert.equal(M.tapAction(down,{...down,page:2},1,false),null);
  assert.equal(M.tapAction(down,down,1,true),null);
  assert.equal(M.tapAction({page:1,x:260,y:40},{page:1,x:260,y:40},1,false),'parking');
  assert.equal(M.tapAction({page:1,x:292,y:365},{page:1,x:292,y:365},1,false),null);
});
test('refresh safety rejects changed slots and reused record identities',()=>{
  const valid={dirty:false,slot:2,drawnSlot:2,number:13,drawnNumber:13};
  assert.equal(M.safeDelete(valid),true);
  for(const delta of [{dirty:true},{slot:3},{number:14},{valid:false}])assert.equal(M.safeDelete({...valid,...delta}),false);
});
test('mailbox remains frozen during CPU reading and drops a busy completion',()=>{
  assert.equal(M.mailbox(1).frozen,true);assert.equal(M.mailbox(3).valid,true);
  assert.equal(M.mailbox(5).dropped,1);assert.equal(M.mailbox(5).frozen,true);
  assert.equal(M.mailbox(6).valid,false);assert.equal(M.mailbox(7).frozen,true);
  assert.equal(M.mailbox(8).frozen,false);
});
test('invalid CRC never runs new firmware and power cycle restores defaults',()=>{
  assert.equal(M.loader(5).hold,true);assert.equal(M.loader(6).newFirmware,true);
  const bad=M.loader(6,true);assert.equal(bad.hold,true);assert.equal(bad.running,false);
  assert.equal(M.loader(7,true).newFirmware,false);
  const reset=M.loader(8,true);assert.equal(reset.defaultRestored,true);assert.equal(reset.newFirmware,false);assert.equal(reset.hold,false);
});
test('scene clocks freeze parking during screening and preserve records on return',()=>{
  for(let step=1;step<=5;step++)assert.equal(M.scene(step).parkingSeconds,1);
  assert.equal(M.scene(5).hits,1);assert.equal(M.scene(6).parkingSeconds,2);
  assert.equal(M.scene(6).screenCount,2);assert.equal(M.scene(6).page,0);
});
test('HDMI publication waits for VS and clears stale identities',()=>{
  assert.equal(M.textState(4).visible,false);assert.equal(M.textState(5).visible,true);
  assert.equal(M.textState(7).visible,false);assert.equal(M.textState(7).targetMatched,false);
});
test('HMI structure check and official compile remain distinct states',()=>{
  const bad=M.directories(2);assert.notEqual(bad.countA,bad.countB);assert.equal(bad.crcA,false);
  const fixed=M.directories(6);assert.equal(fixed.countA,fixed.countB);assert.equal(fixed.structuralPass,true);assert.equal(fixed.officialCompile,false);
  assert.equal(M.directories(7).officialCompile,true);
});
