import test from 'node:test';
import assert from 'node:assert/strict';
import { layers, quantize } from '../model.js';
import { createExample, inspectPixel } from '../explorer-model.js';

const sum = values => values.reduce((total, value) => total + value, 0);

test('explorer retains the real channel counts and L4 fork with teaching-sized slices', () => {
  const first = createExample(0);
  assert.equal(first.layer, layers[0]);
  assert.equal(first.sourceId, 'input');
  assert.equal(first.inputs.length, 3);
  assert.deepEqual([first.inputWidth, first.inputHeight, first.width, first.height], [32,18,16,9]);
  const shared = createExample(4);
  assert.equal(shared.inputs.length, 64);
  assert.deepEqual([shared.width, shared.height], [32,18]);
  const box = createExample(5);
  const classes = createExample(8);
  assert.equal(box.sourceId, 4);
  assert.equal(classes.sourceId, 4);
  assert.deepEqual(box.inputs, classes.inputs);
  assert.equal(box.inputs.length, 64);
  assert.equal(classes.inputs.length, 64);
});

test('both 1x1 heads preserve all 32 input channels and do not add padding', () => {
  for (const layer of [7,10]) {
    const example = createExample(layer);
    assert.equal(example.inputs.length, 32);
    assert.equal(example.padding, 0);
    assert.deepEqual([example.width, example.height], [32,18]);
    for (const kernel of example.kernels) assert.deepEqual([kernel.length,kernel[0].length], [1,1]);
    const inspected = inspectPixel(example, 31, 9, 8);
    assert.deepEqual(inspected.window, [[example.inputs[31][8][9]]]);
    assert.equal(inspected.contribution, example.inputs[31][8][9] * example.kernels[31][0][0]);
  }
});

test('every output pixel sums every channel before bias and the actual layer quantization', () => {
  const actualShifts = [9,6,8,9,8,9,7,9,9,8,9];
  for (let id = 0; id < layers.length; id++) {
    const example = createExample(id);
    assert.equal(example.shift, actualShifts[id]);
    assert.equal(example.contributions.length, layers[id].inputChannels);
    assert.equal(example.kernels.length, layers[id].inputChannels);
    for (let y = 0; y < example.height; y++) for (let x = 0; x < example.width; x++) {
      const total = sum(example.contributions.map(channel => channel[y][x]));
      assert.equal(example.sum[y][x], total);
      assert.equal(example.biased[y][x], total + example.bias);
      assert.equal(example.output[y][x], quantize(total + example.bias, actualShifts[id], layers[id].relu));
    }
  }
});

test('pixel inspection includes unselected contributions rather than just the visible channel', () => {
  const example = createExample(4, 3);
  const selected = 5;
  const inspected = inspectPixel(example, selected, 13, 10);
  const other = sum(example.contributions.filter((_, channel) => channel !== selected).map(channel => channel[10][13]));
  assert.notEqual(other, 0);
  assert.equal(inspected.otherSum, other);
  assert.equal(inspected.contribution, sum(inspected.products.flat()));
  assert.equal(inspected.contribution + inspected.otherSum, inspected.sum);
  assert.equal(inspected.sum, example.sum[10][13]);
  assert.equal(inspected.output, example.output[10][13]);
});

test('boundary windows expose zero padding and stride 2 advances input coordinates twice', () => {
  const example = createExample(0);
  const edge = inspectPixel(example, 0, 0, 0);
  assert.deepEqual(edge.window[0], [0,0,0]);
  assert.deepEqual(edge.window.map(row => row[0]), [0,0,0]);
  assert.equal(edge.window[1][1], example.inputs[0][0][0]);
  const next = inspectPixel(example, 0, 1, 1);
  assert.deepEqual(next.window, example.inputs[0].slice(1,4).map(row => row.slice(1,4)));
  const corner = inspectPixel(createExample(4), 0, 31, 17);
  assert.deepEqual(corner.window[2], [0,0,0]);
  assert.deepEqual(corner.window.map(row => row[2]), [0,0,0]);
});

test('input channels, output weights, moved targets and contrast all change numeric data deterministically', () => {
  const base = createExample(4,0,0);
  assert.notDeepEqual(base.inputs[0], base.inputs[1]);
  const differentOutput = createExample(4,1,0);
  assert.deepEqual(base.inputs, differentOutput.inputs);
  assert.notDeepEqual(base.kernels, differentOutput.kernels);
  assert.notDeepEqual(base.output, differentOutput.output);
  const moved = createExample(4,0,1);
  const lowContrast = createExample(4,0,2);
  assert.notDeepEqual(base.inputs, moved.inputs);
  assert.notDeepEqual(base.output, moved.output);
  assert.notDeepEqual(base.inputs, lowContrast.inputs);
  assert.notDeepEqual(base.output, lowContrast.output);
  assert.equal(createExample(4,0,0), base);
  for (const example of [base, moved, lowContrast]) {
    for (const input of example.inputs) for (const value of input.flat())
      assert.ok(Number.isInteger(value) && value >= 0 && value <= 255);
  }
});

test('RGB teaching scene moves exactly six columns and lowers image contrast', () => {
  const base = createExample(0,0,0);
  const moved = createExample(0,0,1);
  const low = createExample(0,0,2);
  for (let channel = 0; channel < 3; channel++) {
    assert.equal(base.inputs[channel][10][11], moved.inputs[channel][10][17]);
    const contrast = example => Math.abs(example.inputs[channel][10][11] - example.inputs[channel][10][10]);
    assert.ok(contrast(low) < contrast(base));
  }
});
