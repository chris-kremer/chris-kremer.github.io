// Run: NODE_PATH=/path/to/node_modules node tests/index-performance-slider.cjs
// Requires Playwright and Chromium; optionally set SLIDER_URL and CHROMIUM_PATH.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  try {
    for (const width of [320, 390, 860, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.SLIDER_URL || pathToFileURL(path.resolve(__dirname,
        '../projects/index-performance/app/index.html')).href);
      await page.evaluate(() => document.fonts.ready);
      const ticks = await page.locator('.ticks span').evaluateAll(labels => labels.map(label => {
        const r = label.getBoundingClientRect();
        return { year: Number(label.textContent), x: r.x + r.width / 2,
          left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      }));
      const slider = page.locator('#yearSlider');
      await slider.scrollIntoViewIfNeeded();
      const box = await slider.boundingBox();
      for (const tick of ticks) {
        // Native thumb is 26px across: its center travels from 13px to width-13px.
        const bounds = await slider.evaluate(el => [Number(el.min), Number(el.max)]);
        const expectedX = box.x + 13 + (box.width - 26) *
          (tick.year - bounds[0]) / (bounds[1] - bounds[0]);
        assert.ok(Math.abs(tick.x - expectedX) < 1,
          `${width}px: ${tick.year} label is ${(tick.x - expectedX).toFixed(1)}px off the thumb center`);
        // Reset to avoid an existing thumb intercepting a nearby track click.
        await slider.fill('1800');
        await page.mouse.click(tick.x, box.y + box.height / 2);
        assert.equal(await slider.inputValue(), String(tick.year), `${width}px: click at ${tick.year}`);
        assert.equal(await page.locator('#yearBig').textContent(), String(tick.year));
        assert.match(await page.locator('#yearCaption').textContent(), new RegExp(`before ${tick.year}`));
        // Verify that the selected cutoff actually reaches the constituent filter.
        const statuses = await page.locator('.ctable tbody tr').evaluateAll(rows => rows.map(row => ({
          founded: Number(row.children[1].textContent.replace(/[^0-9]/g, '')),
          out: row.classList.contains('is-out'),
        })));
        assert.ok(statuses.length > 0, 'constituent filter must be rendered');
        for (const status of statuses) {
          assert.equal(status.out, status.founded < tick.year, `${width}px: founding-year filter`);
        }
      }
      for (let i = 0; i < ticks.length; i++) {
        for (let j = i + 1; j < ticks.length; j++) {
          const a = ticks[i], b = ticks[j];
          assert.ok(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top,
            `${width}px: ${a.year}/${b.year} labels overlap`);
        }
      }
      for (const preset of await page.locator('.preset').all()) {
        await preset.click();
        const year = await preset.getAttribute('data-year');
        assert.equal(await slider.inputValue(), year);
        assert.equal(await page.locator('#yearBig').textContent(), year);
        assert.equal(await preset.getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('.preset[aria-pressed="true"]').count(), 1);
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: 6 tick positions/clicks, filter, label overlap, all presets, no JS errors`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
