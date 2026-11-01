import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

/** Exercise the public teaching controls; leave the shared browser in overview. */
export async function checkPredictions(page) {
  let checks = 0;
  const originalViewport = page.viewportSize();
  const check = (condition, message) => { assert.ok(condition, message); checks++; };
  const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
  const expanded = page.locator('#layer-expanded');
  const details = page.locator('#prediction-products');
  const example = page.locator('#prediction-example');
  const result = page.locator('#prediction-result');
  const canvas = page.locator('#visual');
  const ltrb = async () => (await page.locator('#prediction-ltrb').textContent()).split('/').map(Number);
  const slider = async (id, value) => page.locator(`#${id}`).evaluate((el, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  const stage = async index => {
    await page.locator(`[data-prediction-stage="${index}"]`).click();
    equal(await page.locator('[data-prediction-stage][aria-pressed="true"]').getAttribute('data-prediction-stage'),
      String(index), `Stage ${index + 1} is selected`);
    equal(await page.locator('#progress').inputValue(), String(index * 25), 'Stage button seeks the timeline');
  };
  // Capture actual canvas labels during a user-control redraw, without exposing
  // application state or changing the production drawing implementation.
  const drawnAt = async progress => page.evaluate(progress => {
    const ctx = document.querySelector('#visual').getContext('2d');
    const original = ctx.fillText, labels = [];
    ctx.fillText = function (value, ...args) { labels.push(String(value)); return original.call(this, value, ...args); };
    try {
      const input = document.querySelector('#progress');
      input.value = String(progress);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } finally { ctx.fillText = original; }
    return labels;
  }, progress);
  const table = () => page.locator('#prediction-products-body tr').evaluateAll(rows => rows.map(row => ({
    channel: row.querySelector('th').textContent,
    feature: Number(row.querySelector('td').textContent),
    terms: [...row.querySelectorAll('td')].slice(1).map(td => td.textContent.match(/(-?\d+(?:\.\d+)?)\s*×\s*(-?\d+(?:\.\d+)?)\s*=\s*(-?\d+(?:\.\d+)?)/)?.slice(1).map(Number)),
  })));
  const footer = () => page.locator('#prediction-products-foot tr').evaluateAll(rows => rows.map(row => [...row.querySelectorAll('td')].map(td => Number(td.textContent))));
  const screenshot = name => page.locator('#experiment').screenshot({ path: `test-artifacts/predictions-${name}.png` });
  const noOverflow = async label => {
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    check(dimensions.scroll <= dimensions.width + 1, `${label}: document ${dimensions.scroll}px exceeds viewport ${dimensions.width}px`);
  };

  await mkdir('test-artifacts', { recursive: true });
  await page.setViewportSize({ width: 1512, height: 1100 });
  if (await expanded.isVisible()) await page.locator('#return-network').click();
  await page.locator('.sample[data-sample="0"]').click();
  await page.locator('.node[data-node="7"] .layer-label').click();
  equal(await page.locator('.topic-bar .active').getAttribute('data-topic'), 'predictions', 'L7 opens the missing conceptual lesson');
  equal(await page.locator('#expanded-layer').inputValue(), '7', 'L7 still opens its per-output detail');
  check(await page.locator('#open-predictions').isVisible(), 'L7 detail links to all four outputs and all positions');
  await page.locator('#open-predictions').click();
  check(await page.locator('#prediction-example').isVisible(), 'Expanded L7 link reaches the prediction controls');
  await page.locator('#reset').click();
  equal(await example.inputValue(), 'A', 'Reset starts from candidate A');
  equal(await ltrb(), [44, 14, 52, 16], 'A exposes one complete LTRB tuple');
  equal(await page.locator('#explanations article').count(), 4, 'Four explanatory paragraphs accompany the experiment');
  check(await details.isVisible(), 'Channel-product disclosure is available in the weighted-sum stage');
  equal(await page.locator('#prediction-channel').getAttribute('max'), '31', 'All 32 input channels can be selected');
  const firstLabels = await drawnAt(24);
  equal(firstLabels.filter(label => /^f\d+$/.test(label)), Array.from({ length: 32 }, (_, i) => `f${i}`), 'Canvas displays all 32 individual input features');
  await details.locator('summary').click();
  const baseline = await table();
  equal(baseline.map(row => row.channel), Array.from({ length: 32 }, (_, i) => `f${i}`), 'Product table contains exactly channels 0 through 31');
  check(baseline.every(row => row.terms.length === 4 && row.terms.every(term => term && term[0] === row.feature && term[0] * term[1] === term[2])), 'Every input supplies four correctly calculated weighted contributions');
  const totals = await footer();
  equal(totals[0], Array.from({ length: 4 }, (_, output) => baseline.reduce((sum, row) => sum + row.terms[output][2], 0)), 'Four sums include all 32 products');
  equal(totals[0].map((sum, output) => sum + totals[1][output]), [44, 14, 52, 16], 'Separate biases complete the four sums');
  equal(totals[2], await ltrb(), 'Table and visible tuple agree');

  await slider('prediction-channel', 31);
  equal(await page.locator('#prediction-channel-value').textContent(), '31', 'Last input channel is selectable');
  equal(Number(await page.locator('#prediction-feature').inputValue()), baseline[31].feature, 'Selecting a channel exposes that channel\'s feature');
  await slider('prediction-channel', 4);
  const beforeEdit = await canvas.evaluate(el => el.toDataURL());
  await slider('prediction-feature', baseline[4].feature + 1);
  const changed = await ltrb();
  equal(changed, [45, 12, 53, 14], 'One feature changes all four outputs according to their separate weights');
  check(changed.every((value, i) => value !== totals[2][i]), 'This selected feature participates in every output, not a single candidate box');
  const edited = await table();
  equal(edited.filter((row, i) => JSON.stringify(row) !== JSON.stringify(baseline[i])).map(row => row.channel), ['f4'], 'Editing one feature changes only its four product terms');
  equal((await footer())[2], changed, 'The complete 32-term table recomputes the four outputs');
  check(await canvas.evaluate(el => el.toDataURL()) !== beforeEdit, 'Feature editing redraws the visible computation');
  await page.locator('#prediction-restore').click();
  equal(await ltrb(), [44, 14, 52, 16], 'Restore removes the feature override');
  equal(await table(), baseline, 'Restore also restores every table contribution');
  await details.locator('summary').click();
  await screenshot('stage0');

  await stage(1);
  check(!(await details.isVisible()), 'The per-channel table is hidden outside the weighted-sum stage');
  equal(await result.textContent(), '4 通道 · 3600 个位置', 'Output channel count is distinguished from spatial candidate count');
  const labelsA = await drawnAt(49);
  check(labelsA.some(label => label.includes('参考点 (488,328)')) && labelsA.some(label => label.includes('参考点 (504,328)')), 'Adjacent grid positions retain distinct reference coordinates');
  check(labelsA.some(label => label.includes('488 − 2×44 = 400')) && labelsA.some(label => label.includes('504 − 2×52 = 400')), 'Two different left distances decode to the same left edge');
  const beforeB = await canvas.evaluate(el => el.toDataURL());
  await example.selectOption('B');
  equal(await ltrb(), [52, 14, 44, 16], 'B has its own full tuple rather than choosing or splicing A\'s distances');
  check(await canvas.evaluate(el => el.toDataURL()) !== beforeB, 'Changing grid address updates the four highlighted map positions');
  await screenshot('stage1');

  await stage(2);
  let classLabels = await drawnAt(74);
  equal(await result.textContent(), 'B · 类别 2 · 225/255', 'B pairs its tuple with its own winning class and confidence');
  equal(classLabels.filter(label => /^z=/.test(label)), ['z=-5', 'z=-3', 'z=4', 'z=-6', 'z=-4'], 'The classifier compares five signed raw scores');
  check(classLabels.includes('完整框：(400,300)') && classLabels.includes('→ (592,360)'), 'B decodes to the full expected original-image box');
  equal(await ltrb(), [52, 14, 44, 16], 'Class argmax preserves all four B distances');
  await example.selectOption('A');
  classLabels = await drawnAt(74);
  equal(await result.textContent(), 'A · 类别 2 · 186/255', 'A keeps its own lower confidence');
  check(classLabels.includes('完整框：(400,300)') && classLabels.includes('→ (592,360)'), 'A and B decode the same box despite different reference points and L/R');
  equal(await ltrb(), [44, 14, 52, 16], 'Switching candidate does not retain the previous position\'s regression output');
  await screenshot('stage2');

  await stage(3);
  equal(await result.textContent(), '等待候选', 'Filtering starts before candidates arrive');
  await slider('progress', 80);
  equal(await result.textContent(), 'A', 'First arrival retains the full A candidate');
  await slider('progress', 85);
  equal(await result.textContent(), 'B', 'Higher confidence B replaces overlapping same-class A');
  await slider('progress', 90);
  equal(await result.textContent(), 'B', 'Large-distance but low-confidence C is rejected');
  check((await page.locator('#prediction-note').textContent()).includes('47 < 64'), 'Filtering explains the classification threshold, not a distance comparison');
  await slider('progress', 95);
  equal(await result.textContent(), 'B、D', 'A separate object survives alongside B');
  const allLabels = await drawnAt(100);
  equal(await result.textContent(), 'B、D、E', 'Different-class E survives overlap, giving three complete candidates');
  equal(await page.locator('#prediction-result-label').textContent(), '已处理 5 / 5 个候选', 'Completion processes all five arrivals');
  check(allLabels.includes('被高分框替换') && allLabels.includes('低分过滤'), 'Canvas exposes replacement and score rejection outcomes');
  await screenshot('stage3');
  await page.locator('#prediction-replace').uncheck();
  equal(await result.textContent(), 'A、D、E', 'When timing prevents replacement the old A remains');
  await page.locator('#prediction-replace').check();
  await slider('prediction-threshold', 225);
  equal(await result.textContent(), 'B、E', 'Threshold is inclusive: both candidates scoring 225 survive');
  await slider('prediction-threshold', 226);
  const none = await result.textContent();
  equal(none, '无候选保留', 'Completed filtering with no survivors is not reported as waiting');
  equal(await page.locator('#prediction-result-label').textContent(), '已处理 5 / 5 个候选', 'An empty result still records completed processing');
  await slider('prediction-threshold', 64);
  equal(await result.textContent(), 'B、D、E', 'Restoring threshold restores all valid whole candidates');

  await page.setViewportSize({ width: 390, height: 844 });
  for (let index = 0; index < 4; index++) {
    await stage(index);
    if (index === 0 && !(await details.evaluate(el => el.open))) await details.locator('summary').click();
    await noOverflow(`Prediction stage ${index + 1} on mobile`);
  }
  await slider('progress', 100);
  await screenshot('mobile');
  await stage(0);
  check(await details.isVisible(), 'Product disclosure returns when returning to the weighted-sum stage');
  await page.locator('.topic-bar [data-topic="box"]').click();
  check(!(await details.isVisible()), 'Navigating to another lesson hides the product disclosure');

  await page.locator('.topic-bar [data-topic="predictions"]').click();
  await page.locator('#reset').click();
  if (await details.evaluate(el => el.open)) await details.locator('summary').click();
  await page.locator('.topic-bar [data-topic="overview"]').click();
  if (await expanded.isVisible()) await page.locator('#return-network').click();
  if (originalViewport) await page.setViewportSize(originalViewport);
  return checks;
}
