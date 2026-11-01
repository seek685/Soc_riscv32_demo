import { layers, conv2d, quantize } from './model.js';

// Independent teaching slices, not a forward pass through the trained network.
// In particular, a slice in this layer is not the preceding example's full output.
const shifts = [9, 6, 8, 9, 8, 9, 7, 9, 9, 8, 9];
const inputWidth = 32;
const inputHeight = 18;
const cache = new Map();
const matrix = (width, height, value) => Array.from({ length: height }, (_, y) =>
  Array.from({ length: width }, (_, x) => value(x, y)));

function scenePixel(x, y, sample) {
  const dx = sample === 1 ? 6 : 0;
  const px = x - dx;
  const vehicle = (px >= 6 && px <= 22 && y >= 7 && y <= 13)
    || (px >= 9 && px <= 19 && y >= 4 && y <= 8);
  const plate = px >= 10 && px <= 17 && y >= 10 && y <= 11;
  const glyph = plate && y === 10 && px % 2 === 1;
  let rgb = y < 10 ? [206, 224, 233] : [179, 190, 197];
  if (vehicle) rgb = [70, 112, 140];
  if (px >= 10 && px <= 18 && y >= 5 && y <= 7) rgb = [158, 194, 210];
  if ((px === 8 || px === 20) && y >= 13 && y <= 14) rgb = [40, 48, 57];
  if (plate) rgb = glyph ? [237, 244, 249] : [35, 70, 112];
  if (sample === 2) rgb = rgb.map(value => Math.round(150 + (value - 150) * 0.25));
  return { rgb, vehicle, plate, glyph };
}

function makeInput(sourceId, channel, sample) {
  return matrix(inputWidth, inputHeight, (x, y) => {
    const pixel = scenePixel(x, y, sample);
    if (sourceId === 'input') return pixel.rgb[channel];
    const gray = pixel.rgb.reduce((sum, value) => sum + value, 0) / 3;
    const previousX = scenePixel(Math.max(0, x - 1), y, sample).rgb;
    const previousY = scenePixel(x, Math.max(0, y - 1), sample).rgb;
    const edgeX = Math.abs(gray - previousX.reduce((sum, value) => sum + value, 0) / 3);
    const edgeY = Math.abs(gray - previousY.reduce((sum, value) => sum + value, 0) / 3);
    const contrast = sample === 2 ? 0.25 : 1;
    const responses = [gray * 0.7, edgeX * 2, edgeY * 2,
      (pixel.vehicle ? 90 : 8) * contrast,
      (pixel.plate ? 180 : pixel.vehicle ? 35 : 4) * contrast,
      (pixel.glyph ? 220 : 10) * contrast];
    const scale = 0.65 + (channel % 7) * 0.06;
    return Math.min(255, Math.max(0, Math.round(responses[channel % responses.length] * scale
      + 4 + (channel * 3 + sourceId * 5) % 17)));
  });
}

export function createExample(layerId, outputChannel = 0, sample = 0) {
  const layer = layers[layerId];
  if (!Number.isInteger(layerId) || !layer) throw new RangeError('Unknown layer.');
  if (!Number.isInteger(outputChannel) || outputChannel < 0 || outputChannel >= layer.channels)
    throw new RangeError('Output channel is outside this layer.');
  if (![0, 1, 2].includes(sample)) throw new RangeError('Unknown teaching sample.');
  const key = `${layerId}:${outputChannel}:${sample}`;
  if (cache.has(key)) {
    const example = cache.get(key);
    cache.delete(key);
    cache.set(key, example);
    return example;
  }
  const sourceId = layerId === 0 ? 'input' : layerId === 8 ? 4 : layerId - 1;
  const padding = layer.kernel === 3 ? 1 : 0;
  const shift = shifts[layerId];
  const bias = (2 ** shift) * (1 + outputChannel % 4);
  const inputs = Array.from({ length: layer.inputChannels }, (_, channel) => makeInput(sourceId, channel, sample));
  const kernels = inputs.map((_, channel) => matrix(layer.kernel, layer.kernel, (x, y) =>
    ((channel * 3 + outputChannel * 5 + layerId + y * 2 + x * 4
      + ((outputChannel + 1) * (channel + 1) % 5)) % 9) - 4));
  const contributions = inputs.map((input, channel) => conv2d(input, kernels[channel], 0, layer.stride, padding));
  const height = contributions[0].length;
  const width = contributions[0][0].length;
  const sum = matrix(width, height, (x, y) => contributions.reduce((total, contribution) => total + contribution[y][x], 0));
  const biased = sum.map(row => row.map(value => value + bias));
  const output = biased.map(row => row.map(value => quantize(value, shift, layer.relu)));
  const example = { layer, sourceId, inputs, kernels, contributions, sum, biased, output,
    bias, shift, padding, inputWidth, inputHeight, width, height, outputChannel, sample };
  // Callers only read examples. LRU eviction limits retained channel matrices.
  cache.set(key, example);
  if (cache.size > 100) cache.delete(cache.keys().next().value);
  return example;
}

export function inspectPixel(example, inputChannel, x, y) {
  if (!Number.isInteger(inputChannel) || inputChannel < 0 || inputChannel >= example.inputs.length
    || !Number.isInteger(x) || x < 0 || x >= example.width
    || !Number.isInteger(y) || y < 0 || y >= example.height)
    throw new RangeError('Pixel or input channel is outside this example.');
  const input = example.inputs[inputChannel];
  const kernel = example.kernels[inputChannel];
  const window = matrix(example.layer.kernel, example.layer.kernel, (kx, ky) =>
    input[y * example.layer.stride + ky - example.padding]?.[x * example.layer.stride + kx - example.padding] ?? 0);
  const products = window.map((row, ky) => row.map((value, kx) => value * kernel[ky][kx]));
  const contribution = products.flat().reduce((total, value) => total + value, 0);
  return { window, products, contribution, otherSum: example.sum[y][x] - contribution,
    sum: example.sum[y][x], biased: example.biased[y][x], output: example.output[y][x] };
}
