import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

/** Run against an already loaded site. The caller owns browser lifetime/errors. */
export async function checkExplorer(page) {
  let checks = 0;
  const originalViewport = page.viewportSize();
  const check = (condition, message) => { assert.ok(condition, message); checks++; };
  const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
  const overview = page.locator('#network-overview');
  const expanded = page.locator('#layer-expanded');
  const inspector = page.locator('#pixel-inspector');
  const layerSelect = page.locator('#expanded-layer');
  const outputSelect = page.locator('#expanded-output-channel');
  const output = page.locator('#expanded-output canvas, canvas#expanded-output').first();
  const firstTile = page.locator('.node[data-node="0"] .feature-tile[data-output="0"]');
  const rows = page.locator('[data-input-row]');

  async function dimensions() {
    return output.evaluate(canvas => ({ cols: Number(canvas.dataset.cols), rows: Number(canvas.dataset.rows) }));
  }
  async function point(x, y, click = false) {
    await output.scrollIntoViewIfNeeded();
    const box = await output.boundingBox();
    assert.ok(box, 'Output canvas must be visible');
    const size = await dimensions();
    const clientX = box.x + (x + 0.5) / size.cols * box.width;
    const clientY = box.y + (y + 0.5) / size.rows * box.height;
    if (click) await page.mouse.click(clientX, clientY);
    else await page.mouse.move(clientX, clientY);
  }
  async function address() {
    const text = await page.locator('#pixel-address').textContent();
    const match = text.match(/\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
    assert.ok(match, `Pixel address must expose (x, y), got ${text}`);
    return [Number(match[1]), Number(match[2])];
  }
  async function openPixel() {
    if (!(await inspector.isVisible())) await rows.first().click();
    await inspector.waitFor({ state: 'visible' });
  }
  async function values() {
    return Promise.all(['pixel-total', 'pixel-bias', 'pixel-code'].map(async id => (
      await page.locator(`#${id}`).textContent()
    ).trim()));
  }
  async function selectLayer(id) {
    await layerSelect.selectOption(String(id));
    equal(await page.evaluate(()=>document.activeElement.id),'expanded-layer','Layer selection keeps keyboard focus');
    await output.waitFor({ state: 'visible' });
  }
  async function noDocumentOverflow(label) {
    const size = await page.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth }));
    check(size.scroll <= size.width + 1, `${label}: document width ${size.scroll} exceeds viewport ${size.width}`);
  }

  await mkdir('test-artifacts', { recursive: true });
  await page.setViewportSize({ width: 1512, height: 1100 });
  if (await expanded.isVisible()) await page.locator('#return-network').click();
  await page.locator('.sample[data-sample="0"]').click();
  await overview.waitFor({ state: 'visible' });

  // Hover changes the actual incoming dependency links, not a decorative dot.
  await firstTile.locator('canvas').hover();
  check(await page.locator('#connections .network-link[data-to="0"].active').count() > 0,
    'Hovering L0 output 0 must highlight incoming links');
  await page.mouse.move(1, 1);
  await page.waitForFunction(() => document.querySelectorAll('#connections .network-link.active').length === 0);
  equal(await page.locator('#connections .network-link.active').count(), 0, 'Leaving feature removes hover highlight');
  await firstTile.click();
  await expanded.waitFor({ state: 'visible' });
  check(!(await overview.isVisible()), 'Expansion replaces overview in the network area');
  equal(await layerSelect.inputValue(), '0', 'Clicked layer is selected');
  equal(await outputSelect.inputValue(), '0', 'Clicked output channel is selected');
  equal(await layerSelect.locator('option').count(), 11, 'Every real detector layer is selectable');

  const channelCounts = [8, 16, 32, 64, 64, 32, 32, 4, 32, 32, 5];
  for (let layer = 0; layer <= 10; layer++) {
    await selectLayer(layer);
    equal(await outputSelect.locator('option').count(), channelCounts[layer], `L${layer} exposes all useful output channels`);
    equal(await dimensions(), layer < 4 ? { cols: 16, rows: 9 } : { cols: 32, rows: 18 },
      `L${layer} uses its actual stride on a 32×18 teaching input`);
  }
  await selectLayer(8);
  check(/\bL4\b/.test(await page.locator('#expanded-source').textContent()), 'L8 reads shared L4, not L7');

  await selectLayer(0);
  await point(5, 3);
  equal(await address(), [5, 3], 'Hover selects the corresponding output pixel');
  await point(6, 4, true);
  equal(await address(), [6, 4], 'Click selects the corresponding output pixel');
  await output.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  equal(await address(), [7, 5], 'Arrow keys move the selected pixel');
  await page.screenshot({ path: 'test-artifacts/expanded-layer.png', fullPage: true });

  await rows.first().click();
  await inspector.waitFor({ state: 'visible' });
  equal(await inspector.locator('.product-cell').count(), 9, '3×3 detail exposes nine products');
  const before = await values();
  check(before.every(value => /\d/.test(value)), 'Pixel detail shows numeric total, bias and quantized code');
  await outputSelect.selectOption('1');
  equal(await page.evaluate(()=>document.activeElement.id),'expanded-output-channel','Output selection keeps keyboard focus');
  await openPixel();
  const after = await values();
  check(JSON.stringify(before) !== JSON.stringify(after), 'Switching output channel changes the computed numbers');
  await page.screenshot({ path: 'test-artifacts/expanded-pixel.png', fullPage: true });
  await page.locator('#close-pixel').click();
  check(!(await inspector.isVisible()), 'Close button dismisses numeric detail');
  check(await expanded.isVisible(), 'Closing numeric detail retains the expanded layer');

  await selectLayer(7);
  await openPixel();
  equal(await inspector.locator('.product-cell').count(), 1, '1×1 head detail exposes one product per input channel');
  equal(await dimensions(), { cols: 32, rows: 18 }, '1×1 head preserves the teaching grid');

  // Visit all 64 source channels rather than silently displaying only three.
  await selectLayer(4);
  await openPixel();
  const totalBeforePaging = await values();
  const seen = [];
  for (let pageIndex = 0; pageIndex < 22; pageIndex++) {
    const visible = await rows.evaluateAll(elements => elements.map(element => Number(element.dataset.inputRow)));
    const expected = Array.from({ length: Math.min(3, 64 - pageIndex * 3) }, (_, i) => pageIndex * 3 + i);
    equal(visible, expected, `Source page ${pageIndex + 1} shows the next actual channel indices`);
    seen.push(...visible);
    if (pageIndex < 21) await page.locator('#source-page-next').click();
  }
  equal(seen, Array.from({ length: 64 }, (_, i) => i), 'Source pagination reaches every input channel exactly once');
  check(await page.locator('#source-page-next').isDisabled(), 'Last source page cannot advance past channel 63');
  await openPixel();
  equal(await values(), totalBeforePaging, 'Paging input channels must not change the full-channel sum, bias or output code');

  await selectLayer(7);
  await outputSelect.selectOption('1');
  await point(10, 6, true);
  await openPixel();
  await page.locator('.sample[data-sample="1"]').click();
  check(await expanded.isVisible(), 'Changing sample retains expanded layer');
  check(await inspector.isVisible(), 'Changing sample retains numeric detail');
  equal(await layerSelect.inputValue(), '7', 'Changing sample retains selected layer');
  equal(await outputSelect.inputValue(), '1', 'Changing sample retains selected output channel');

  // Interaction should pause a real window scan immediately, without timer assertions.
  await page.locator('#close-pixel').click();
  await page.locator('#scan-window').click();
  equal(await page.locator('#scan-window').getAttribute('aria-pressed'), 'true', 'Window scan starts');
  const scanAddress=await page.locator('#pixel-address').textContent();
  await page.waitForFunction(previous=>document.querySelector('#pixel-address').textContent!==previous,scanAddress);
  checks++;
  await point(12, 8);
  equal(await page.locator('#scan-window').getAttribute('aria-pressed'), 'false', 'Touching the output canvas pauses scan');
  equal(await address(), [12, 8], 'Manual selection controls the paused scan location');

  await openPixel();
  await page.keyboard.press('Escape');
  check(!(await inspector.isVisible()), 'First Escape closes numeric detail');
  check(await expanded.isVisible(), 'First Escape leaves layer expansion open');
  await page.keyboard.press('Escape');
  await overview.waitFor({ state: 'visible' });
  check(!(await expanded.isVisible()), 'Second Escape returns to network overview');
  await firstTile.click();
  await page.locator('.sample[data-sample="2"]').click();
  await page.locator('#return-network').click();
  check(await page.locator('.node[data-node="0"] .feature-tile[data-output="0"]').evaluate(el=>el===document.activeElement),'Returning after sample change restores focus');
  check(await overview.isVisible(), 'Return button restores network overview');

  // Overflow is checked both with and without the numerical inspector.
  for (const width of [1512, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 });
    await noDocumentOverflow(`Overview at ${width}px`);
    await firstTile.click();
    await expanded.waitFor({ state: 'visible' });
    await noDocumentOverflow(`Expanded layer at ${width}px`);
    await openPixel();
    await noDocumentOverflow(`Pixel inspector at ${width}px`);
    if (width === 390) await page.screenshot({ path: 'test-artifacts/expanded-mobile.png', fullPage: true });
    await page.locator('#return-network').click();
  }
  await page.locator('.sample[data-sample="0"]').click();
  if (originalViewport) await page.setViewportSize(originalViewport);
  return checks;
}
