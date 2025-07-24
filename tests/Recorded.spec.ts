import { expect } from '@playwright/test';
import { test } from './test-setup';

test.use({ headless: false });

test('test', async ({ page, runAdvicedActions }) => {
  await page.goto('http://localhost:5173/');
  await page.locator('canvas').click({
    position: {
      x: 270,
      y: 221
    }
  });
  await page.locator('canvas').click({
    position: {
      x: 466,
      y: 279
    }
  });
  await page.locator('canvas').click({
    position: {
      x: 254,
      y: 346
    }
  });
  await page.locator('canvas').click({
    position: {
      x: 547,
      y: 270
    }
  });
  await page.locator('canvas').click({
    position: {
      x: 273,
      y: 199
    }
  });
  await page.locator('canvas').click({
    position: {
      x: 604,
      y: 247
    }
  });
  await page.locator('canvas').click({
    position: {
      x: 323,
      y: 282
    }
  });
  await page.locator('canvas').click({
    position: {
      x: 489,
      y: 273
    }
  });

    await runAdvicedActions();
});