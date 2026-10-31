import test from 'node:test';
import assert from 'node:assert/strict';
import { layers, conv2d, relu, dot, decodeBox, clipBox, iou } from '../model.js';

test('convolution applies signed kernel, bias and valid output extent', () => {
  const result = conv2d([[1,2,3],[4,5,6],[7,8,9]], [[1,0],[0,-1]], 2);
  assert.deepEqual(result, [[-2,-2],[-2,-2]]);
  assert.deepEqual(result.map(row => row.map(relu)), [[0,0],[0,0]]);
});

test('stride 2 samples distinct windows; zero padding contributes no input', () => {
  assert.deepEqual(conv2d([[1,2,3],[4,5,6],[7,8,9]], [[1]], 0, 2), [[1,3],[7,9]]);
  assert.deepEqual(conv2d([[1,2],[3,4]], [[1,1,1],[1,1,1],[1,1,1]], 0, 1, 1), [[10,10],[10,10]]);
});

test('1×1 head combines channels, not spatial coordinates', () => {
  assert.equal(dot([2,3,4], [1,-2,0.5], 1), -1);
  assert.throws(() => dot([1,2],[3]), RangeError);
});

test('project backbone has four spatial reductions followed by two branches', () => {
  assert.deepEqual(layers.slice(0,5).map(layer => [layer.width,layer.height,layer.channels]),
    [[640,360,8],[320,180,16],[160,90,32],[80,45,64],[80,45,64]]);
  assert.deepEqual(layers.filter(layer => layer.branch === 'box').map(layer => layer.id), [5,6,7]);
  assert.deepEqual(layers.filter(layer => layer.branch === 'class').map(layer => layer.id), [8,9,10]);
  assert.equal(layers[7].usefulChannels, 4);
  assert.equal(layers[10].usefulChannels, 5);
  assert.equal(layers[7].relu, false);
  assert.equal(layers[10].relu, false);
});

test('grid cell and asymmetric LTRB distances produce an off-center box', () => {
  assert.deepEqual(decodeBox(39,22,{left:50,top:15,right:70,bottom:20}),
    {cx:632,cy:360,x1:532,y1:330,x2:772,y2:400});
  const oneCellRight = decodeBox(40,22,{left:50,top:15,right:70,bottom:20});
  assert.equal(oneCellRight.x1, 548);
  assert.equal(oneCellRight.x2, 788);
});

test('raw decoding preserves overflow; diagram clipping is explicit', () => {
  const raw = decodeBox(0,0,{left:10,top:10,right:1000,bottom:1000});
  assert.equal(raw.x1, -12);
  assert.equal(raw.x2, 2008);
  assert.deepEqual(clipBox(raw), {cx:8,cy:8,x1:0,y1:0,x2:1280,y2:720});
});

test('intersection-over-union handles overlapping, separate and empty boxes', () => {
  const a = {x1:0,y1:0,x2:10,y2:10};
  assert.equal(iou(a,a),1);
  assert.equal(iou(a,{x1:5,y1:0,x2:15,y2:10}),1/3);
  assert.equal(iou(a,{x1:10,y1:0,x2:20,y2:10}),0);
  assert.equal(iou({x1:0,y1:0,x2:0,y2:0},{x1:0,y1:0,x2:0,y2:0}),0);
});

test('hardware quantization rounds ties toward +infinity and saturates output', async () => {
  const { quantize } = await import('../model.js');
  assert.equal(quantize(3,1),2);
  assert.equal(quantize(-3,1,false),-1);
  assert.equal(quantize(-3,1,true),0);
  assert.equal(quantize(2000,1),255);
  assert.equal(quantize(-2000,1,false),-256);
  assert.equal(quantize(7,0,false),7);
});

test('signed9 LUT uses two-complement addresses and real ROM values', async () => {
  const { sigmoidLookup } = await import('../model.js');
  assert.equal(sigmoidLookup(0),128);
  assert.equal(sigmoidLookup(1),159);
  assert.equal(sigmoidLookup(2),186);
  assert.equal(sigmoidLookup(-1),96);
  assert.equal(sigmoidLookup(-256),0);
  assert.equal(sigmoidLookup(255),255);
  assert.throws(() => sigmoidLookup(256),RangeError);
  assert.throws(() => sigmoidLookup(0.5),RangeError);
});
