/** Mathematical teaching helpers. No pretrained network inference is performed here. */
export const layers = [
  { id: 0, name: 'L0', width: 640, height: 360, inputChannels: 3, channels: 8, kernel: 3, stride: 2, branch: 'backbone', relu: true },
  { id: 1, name: 'L1', width: 320, height: 180, inputChannels: 8, channels: 16, kernel: 3, stride: 2, branch: 'backbone', relu: true },
  { id: 2, name: 'L2', width: 160, height: 90, inputChannels: 16, channels: 32, kernel: 3, stride: 2, branch: 'backbone', relu: true },
  { id: 3, name: 'L3', width: 80, height: 45, inputChannels: 32, channels: 64, kernel: 3, stride: 2, branch: 'backbone', relu: true },
  { id: 4, name: 'L4', width: 80, height: 45, inputChannels: 64, channels: 64, kernel: 3, stride: 1, branch: 'backbone', relu: true },
  { id: 5, name: 'L5', width: 80, height: 45, inputChannels: 64, channels: 32, kernel: 3, stride: 1, branch: 'box', relu: true },
  { id: 6, name: 'L6', width: 80, height: 45, inputChannels: 32, channels: 32, kernel: 3, stride: 1, branch: 'box', relu: true },
  { id: 7, name: 'L7', width: 80, height: 45, inputChannels: 32, channels: 16, usefulChannels: 4, kernel: 1, stride: 1, branch: 'box', relu: false },
  { id: 8, name: 'L8', width: 80, height: 45, inputChannels: 64, channels: 32, kernel: 3, stride: 1, branch: 'class', relu: true },
  { id: 9, name: 'L9', width: 80, height: 45, inputChannels: 32, channels: 32, kernel: 3, stride: 1, branch: 'class', relu: true },
  { id: 10, name: 'L10', width: 80, height: 45, inputChannels: 32, channels: 16, usefulChannels: 5, kernel: 1, stride: 1, branch: 'class', relu: false },
];

// CNN "convolution" uses cross-correlation: the kernel is not reversed.
export function conv2d(input, kernel, bias = 0, stride = 1, padding = 0) {
  const height = Math.floor((input.length + 2 * padding - kernel.length) / stride) + 1;
  const width = Math.floor((input[0].length + 2 * padding - kernel[0].length) / stride) + 1;
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => {
    let sum = bias;
    for (let ky = 0; ky < kernel.length; ky++) {
      for (let kx = 0; kx < kernel[ky].length; kx++) {
        sum += (input[y * stride + ky - padding]?.[x * stride + kx - padding] ?? 0) * kernel[ky][kx];
      }
    }
    return sum;
  }));
}

export const relu = value => Math.max(0, value);

export function dot(features, weights, bias = 0) {
  if (features.length !== weights.length) throw new RangeError('Feature and weight counts must match.');
  return features.reduce((sum, value, index) => sum + value * weights[index], bias);
}

// Decoder coordinates before production margins, minimum-size filtering and clipping.
// Distance units are 2 original-image pixels; grid cells cover 16 × 16 pixels.
export function decodeBox(gx, gy, { left, top, right, bottom }) {
  const cx = gx * 16 + 8;
  const cy = gy * 16 + 8;
  return { cx, cy, x1: cx - 2 * left, y1: cy - 2 * top, x2: cx + 2 * right, y2: cy + 2 * bottom };
}

// Generic image-boundary clipping for diagrams, not the production crop policy.
export function clipBox(box, width = 1280, height = 720) {
  const clamp = (value, max) => Math.min(max, Math.max(0, value));
  return { ...box, x1: clamp(box.x1, width), y1: clamp(box.y1, height), x2: clamp(box.x2, width), y2: clamp(box.y2, height) };
}

export function iou(a, b) {
  const area = box => Math.max(0, box.x2 - box.x1) * Math.max(0, box.y2 - box.y1);
  const intersection = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1))
    * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const union = area(a) + area(b) - intersection;
  return union ? intersection / union : 0;
}

// Matches output_layer.sv: arithmetic shift, ties toward +infinity, saturation.
// The input accumulator already includes bias. This omits finite accumulator overflow.
export function quantize(value, shift = 0, reluEnabled = true) {
  const rounded = Math.floor(value / (2 ** shift) + 0.5);
  return reluEnabled ? Math.max(0, Math.min(255, rounded)) : Math.max(-256, Math.min(255, rounded));
}

// Exact 512-byte ROM from sigmoid_lut_9bit_to_8bit_h.mem, indexed by signed9 & 511.
const sigmoidLut = [128,159,186,208,225,236,243,248,250,252,253,254,254,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,2,3,5,7,12,19,30,47,69,96];
export function sigmoidLookup(code) {
  if (!Number.isInteger(code) || code < -256 || code > 255) throw new RangeError('Expected a signed 9-bit integer.');
  return sigmoidLut[code & 511];
}
