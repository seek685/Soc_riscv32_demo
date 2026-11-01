import test from 'node:test';
import assert from 'node:assert/strict';
import { headAt, classifyScores, candidates, filterCandidates } from '../dense-head-model.js';
import { sigmoidLookup } from '../model.js';

test('32 features produce four sums using four shared weight vectors, without selecting a channel', () => {
  for (const candidate of candidates) {
    const head = headAt(candidate.id);
    assert.equal(head.features.length, 32);
    assert.equal(head.weights.length, 4);
    assert.equal(head.biases.length, 4);
    for (let output = 0; output < 4; output++) {
      assert.equal(head.weights[output].length, 32);
      const products = head.features.map((value, channel) => value * head.weights[output][channel]);
      assert.deepEqual(products, head.products[output]);
      const sum = products.reduce((total, value) => total + value, 0);
      assert.equal(head.sums[output], sum);
      assert.equal(head.values[output], sum + head.biases[output]);
    }
    assert.deepEqual(head.weights, headAt('A').weights);
    assert.deepEqual(head.biases, headAt('A').biases);
    assert.deepEqual(candidate.ltrb, head.values);
    assert.deepEqual(candidate.box, head.box);
  }
});

test('adjacent positions use different LTRB tuples and decode the same rectangle', () => {
  const a = headAt('A'), b = headAt('B');
  assert.deepEqual(a.values, [44,14,52,16]);
  assert.deepEqual(b.values, [52,14,44,16]);
  for (const head of [a,b]) {
    const { x1,y1,x2,y2 } = head.box;
    assert.deepEqual({x1,y1,x2,y2}, {x1:400,y1:300,x2:592,y2:360});
  }
  assert.equal(a.features[0], 6);
  assert.equal(b.features[0], 7);
  assert.notEqual(a.features[0], a.grid[0], 'Teaching features are not supplied grid coordinates');
});

test('editing one feature changes its contributions, while every other channel stays in the sums', () => {
  const a = headAt('A'), changed = headAt('A', {channel:0,value:7});
  assert.deepEqual(changed.values, headAt('B').values);
  assert.deepEqual(changed.grid, a.grid, 'Changing a feature does not change the spatial address');
  assert.notEqual(changed.box.x1, a.box.x1);
  const last = headAt('A', {channel:31,value:a.features[31]+1});
  // A smaller contribution still affects the sum even when the largest term is unchanged.
  assert.equal(Math.max(...last.products[0]),Math.max(...a.products[0]));
  assert.notEqual(last.values[0],a.values[0]);
  for (let output=0;output<4;output++) {
    assert.equal(last.values[output]-a.values[output], a.weights[output][31]);
    assert.deepEqual(last.products[output].slice(0,31),a.products[output].slice(0,31));
  }
});

test('argmax belongs to classification at a position, with first-arriving tie handling', () => {
  assert.deepEqual(classifyScores([-5,-3,2,-6,-4]), {classId:2,confidence:186});
  assert.deepEqual(classifyScores([2,2,-1,-3,-6]), {classId:0,confidence:186});
  assert.deepEqual(classifyScores([-5,-6,-3,-7,-4]), {classId:2,confidence:47});
  for (const candidate of candidates) {
    assert.equal(candidate.score, sigmoidLookup(Math.max(...candidate.scores)));
  }
});

test('default online comparison replaces A with B, rejects large low-score C, and retains D and other-class E', () => {
  const {rows,kept}=filterCandidates();
  assert.deepEqual(kept.map(candidate=>candidate.id), ['B','D','E']);
  assert.equal(rows[0].status,'replaced');
  assert.equal(rows[0].replacedBy,'B');
  assert.equal(rows[1].against,'A');
  assert.equal(rows[1].overlap,1);
  assert.equal(rows[2].status,'low-score');
  assert.ok(candidates[2].ltrb.every((value,index)=>value>candidates[0].ltrb[index]));
  assert.notEqual(candidates[4].classId,candidates[1].classId);
  assert.equal(rows[4].status,'kept');
});

test('threshold equality passes and threshold changes filter individual whole candidates', () => {
  assert.deepEqual(filterCandidates(225).kept.map(candidate=>candidate.id),['B','E']);
  assert.deepEqual(filterCandidates(226).kept,[]);
  assert.equal(filterCandidates(47).rows.find(candidate=>candidate.id==='C').status,'kept');
  assert.equal(filterCandidates(48).rows.find(candidate=>candidate.id==='C').status,'low-score');
});

test('higher confidence cannot replace a duplicate when crop/scan timing forbids it', () => {
  const {rows,kept}=filterCandidates(64,false);
  assert.deepEqual(kept.map(candidate=>candidate.id),['A','D','E']);
  assert.equal(rows[1].status,'duplicate');
  assert.deepEqual(kept[0].ltrb,[44,14,52,16]);
});

test('online arrival limit reveals the intermediate slot before its later replacement', () => {
  assert.deepEqual(filterCandidates(64,true,0),{rows:[],kept:[]});
  assert.deepEqual(filterCandidates(64,true,1).kept.map(candidate=>candidate.id),['A']);
  assert.equal(filterCandidates(64,true,1).rows[0].status,'kept');
  assert.deepEqual(filterCandidates(64,true,2).kept.map(candidate=>candidate.id),['B']);
  assert.equal(filterCandidates(64,true,2).rows[0].status,'replaced');
});
