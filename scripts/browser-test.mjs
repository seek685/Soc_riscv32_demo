import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { serve } from './serve.mjs';
const server = await serve();
const browser = await chromium.launch();
await mkdir('test-artifacts', { recursive: true });
const errors = [];
let checks = 0;
async function slider(page, id, value) {
  await page.locator('#' + id).evaluate((el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(value));
}
try {
  const page = await browser.newPage({ viewport: { width: 1512, height: 1100 }, reducedMotion: 'reduce' });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:4173');
  await page.waitForSelector('#controls .control-heading');
  assert.equal(await page.locator('.node').count(), 12); checks++;
  await page.screenshot({ path: 'test-artifacts/desktop-overview.png', fullPage: true });
  const topics = await page.locator('.topic-bar button').evaluateAll(nodes => nodes.map(n => n.dataset.topic));
  for (const topic of topics) {
    await page.locator(`.topic-bar [data-topic="${topic}"]`).click();
    assert.equal(await page.locator('#explanations article').count(), 4);
    const before = await page.locator('#visual').evaluate(el => el.toDataURL());
    await slider(page, 'progress', 75);
    const after = await page.locator('#visual').evaluate(el => el.toDataURL());
    assert.notEqual(before, after, `${topic} has no visual progress`);
    await page.locator('#play').click();
    await page.waitForTimeout(140);
    await page.locator('#play').click();
    const paused = await page.locator('#progress').inputValue();
    await page.waitForTimeout(140);
    assert.equal(await page.locator('#progress').inputValue(), paused, `${topic} did not pause`);
    await page.locator('#reset').click();
    assert.equal(await page.locator('#progress').inputValue(), '0');
    if (['conv','heads','classify'].includes(topic)) await page.screenshot({ path: `test-artifacts/desktop-${topic}.png`, fullPage: true });
    checks += 4;
  }
  await page.locator('.topic-bar [data-topic="box"]').click();
  assert.equal(await page.locator('#box-result').textContent(), '(400,300) → (592,360)'); checks++;
  await slider(page, 'gx', 31);
  assert.equal(await page.locator('#box-result').textContent(), '(416,300) → (608,360)'); checks++;
  await slider(page, 'left', 50);
  assert.equal(await page.locator('#box-result').textContent(), '(404,300) → (608,360)'); checks++;
  await page.locator('#visual').focus(); await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#gx').inputValue(), '30'); checks++;
  await page.locator('#reset').click(); await slider(page, 'progress', 100);
  await page.screenshot({ path: 'test-artifacts/desktop-box.png', fullPage: true });
  await page.locator('.topic-bar [data-topic="classify"]').click();
  await slider(page, 'threshold', 186);
  assert.equal(await page.locator('#class-decision').textContent(), '通过'); checks++;
  const accepted = await page.locator('#visual').evaluate(el => el.toDataURL());
  await slider(page, 'threshold', 187);
  assert.equal(await page.locator('#class-decision').textContent(), '未通过'); checks++;
  assert.notEqual(await page.locator('#visual').evaluate(el => el.toDataURL()), accepted); checks++;
  assert.equal(await page.locator('#class-result').textContent(), '2 · 186/255'); checks++;
  await page.locator('.topic-bar [data-topic="recognition"]').click();
  await slider(page, 'progress', 100);
  assert.equal(await page.locator('#lpr-stage').textContent(), 'CTC 解码完成'); checks++;
  assert.equal(await page.locator('#ctc-result').textContent(), 'AAB'); checks++;
  await page.locator('#ctc').selectOption('1');
  assert.equal(await page.locator('#ctc-result').textContent(), 'ABC'); checks++;
  await page.locator('.topic-bar [data-topic="postprocess"]').click();
  await slider(page, 'overlap', 0);
  assert.equal(await page.locator('#iou-result').textContent(), '1.000'); checks++;
  await page.locator('#sameClass').uncheck();
  assert.equal(await page.locator('#iou-decision').textContent(), '继续检查其他槽'); checks++;
  await page.locator('.sample[data-sample="1"]').click();
  await page.locator('.topic-bar [data-topic="box"]').click();
  assert.equal(await page.locator('#gx').inputValue(), '42'); checks++;
  await page.locator('[data-node="10"]').click();
  assert.equal(await page.locator('.topic-bar .active').getAttribute('data-topic'), 'classify'); checks++;
  await page.setViewportSize({ width: 390, height: 844 });
  for (const topic of topics) {
    await page.locator(`.topic-bar [data-topic="${topic}"]`).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert.equal(overflow, false, `${topic} overflows mobile viewport`); checks++;
  }
  await page.locator('.topic-bar [data-topic="box"]').click();
  await slider(page, 'progress', 100);
  await page.screenshot({ path: 'test-artifacts/mobile-box.png', fullPage: true });
  assert.deepEqual(errors, []); checks++;
  console.log(`${checks} browser checks passed; desktop/mobile screenshots in test-artifacts.`);
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
