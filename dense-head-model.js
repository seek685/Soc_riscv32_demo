import { decodeBox, iou, sigmoidLookup } from './model.js';

// Five hand-made feature vectors, not a trained forward pass or a coordinate input.
// Their grid addresses are used ONLY by decodeBox, never supplied to the head.
// These small example weights/biases omit hardware SHIFT and saturation so the
// 32-to-4 sum is easy to inspect; the existing quantization lesson covers those.
const constantFeatures = Array.from({ length: 28 }, (_, i) => 2 + i % 7);
const firstWeights = [[8,0,8,0], [0,4,0,4], [-8,0,8,0], [0,-4,0,4]];
const weights = firstWeights.map((first, output) => [...first,
  ...constantFeatures.map((_, channel) => (channel + output) % 2 ? -1 - output % 2 : 1 + output % 2)]);
const baseline = [6,3,2,2, ...constantFeatures];
const desired = [44,14,52,16];
const sum = values => values.reduce((total, value) => total + value, 0);
const biases = weights.map((row, i) => desired[i] - sum(row.map((w, c) => w * baseline[c])));

const fixtures = [
  { id: 'A', grid: [30,20], first: [6,3,2,2], scores: [-5,-3,2,-6,-4] },
  { id: 'B', grid: [31,20], first: [7,3,2,2], scores: [-5,-3,4,-6,-4] },
  { id: 'C', grid: [30,21], first: [6,3,10,8], scores: [-5,-6,-3,-7,-4] },
  { id: 'D', grid: [55,26], first: [4,3,2,2], scores: [-5,-4,3,-6,-7] },
  { id: 'E', grid: [32,20], first: [8,3,2,2], scores: [-5,4,-3,-6,-4] },
];

// Classification compares the five classes AT ONE POSITION, not box distances.
export function classifyScores(scores) {
  const classId = scores.indexOf(Math.max(...scores));
  return { classId, confidence: sigmoidLookup(scores[classId]) };
}

export function headAt(id = 'A', override) {
  const fixture = fixtures.find(candidate => candidate.id === id);
  if (!fixture) throw new RangeError('Unknown teaching candidate.');
  const features = [...fixture.first, ...constantFeatures];
  if (override) {
    if (!Number.isInteger(override.channel) || override.channel < 0 || override.channel >= 32
      || !Number.isFinite(override.value)) throw new RangeError('Invalid teaching feature override.');
    features[override.channel] = override.value;
  }
  const products = weights.map(row => row.map((weight, channel) => weight * features[channel]));
  const sums = products.map(sum);
  const values = sums.map((total, output) => total + biases[output]);
  const distances = Object.fromEntries(['left','top','right','bottom'].map((name, i) => [name, values[i]]));
  return { id, grid: [...fixture.grid], features, weights, biases, products, sums, values, distances,
    box: decodeBox(...fixture.grid, distances), scores: [...fixture.scores], ...classifyScores(fixture.scores) };
}

export const candidates = fixtures.map(({ id }) => {
  const result = headAt(id);
  return { id, grid: result.grid, ltrb: result.values, distances: result.distances,
    score: result.confidence, classId: result.classId, box: result.box, scores: result.scores };
});

// The actual overlap test compares crop regions after margins/size clipping.
// All five fixtures stay inside the image and exceed the minimum 80×20 size.
function comparisonBox(box) {
  const margin = Math.max(10, Math.floor((box.x2 - box.x1) / 16));
  return { x1: box.x1 - margin, y1: box.y1 - 5, x2: box.x2 + margin, y2: box.y2 + 5 };
}

// Five arrivals illustrate one online frame. No global confidence sort, tracking,
// stale-frame handling or full hardware timing is simulated here. replaceAllowed
// stands for the real constraints (crop not active, scan above old box's top).
export function filterCandidates(threshold = 64, replaceAllowed = true, limit = candidates.length) {
  const rows = [], kept = [];
  for (const candidate of candidates.slice(0, limit)) {
    const row = { ...candidate, status: 'kept', reason: '达到阈值，且没有同类重复框，保留整组候选。' };
    rows.push(row);
    if (candidate.score < threshold) {
      row.status = 'low-score';
      row.reason = `分类分数 ${candidate.score} < ${threshold}，淘汰；LTRB 大小不是质量分数。`;
      continue;
    }
    const index = kept.findIndex(old => old.classId === candidate.classId
      && iou(comparisonBox(old.box), comparisonBox(candidate.box)) >= 0.5);
    if (index < 0) { kept.push(row); continue; }
    const old = kept[index];
    row.against = old.id;
    row.overlap = iou(comparisonBox(old.box), comparisonBox(candidate.box));
    if (candidate.score > old.score && replaceAllowed) {
      old.status = 'replaced'; old.replacedBy = candidate.id;
      old.reason = `与 ${candidate.id} 同类重叠，且新框分数更高、时序允许，被整组替换。`;
      row.reason = `与 ${old.id} 同类重叠，分数 ${candidate.score} > ${old.score}，时序允许，整组替换 ${old.id}。`;
      kept[index] = row;
    } else {
      row.status = 'duplicate';
      row.reason = replaceAllowed ? `与 ${old.id} 同类重复，新分数没有更高，保留旧框。`
        : `与 ${old.id} 同类重复，但旧框已经开始裁剪或扫描时序不允许替换，保留旧框。`;
    }
  }
  return { rows, kept };
}
