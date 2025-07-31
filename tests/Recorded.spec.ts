// import { expect } from '@playwright/test';
import { test } from './test-setup';

test('test', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.locator('canvas').click({
    position: {
      x: 440,
      y: 206
    }
  });
  await page.locator('canvas').click({
    position: {
      x: 385,
      y: 241
    }
  });
  await page.locator('canvas').click({
    position: {
      x: 550,
      y: 210
    }
  });
  await page.locator('canvas').click({
    position: {
      x: 551,
      y: 313
    }
  });
  await page.locator('canvas').click({
    position: {
      x: 358,
      y: 235
    }
  });
  await page.locator('canvas').click({
    position: {
      x: 268,
      y: 351
    }
  });
  await page.locator('canvas').click({
    position: {
      x: 634,
      y: 38
    }
  });
  await page.locator('canvas').click({
    position: {
      x: 532,
      y: 224
    }
  });

  await page.executeStoredClicks();
  // await expect(page.getByTestId('all-points')).toContainText('((openPage 0 ((966 412) (580 341) (710 325))) (click 0 ((671 432) (753 331))) (click 1 ((612 466) (676 425))) (click 2 ((380 557) (690 421) (809 488))) (click 3 ((606 661))) (click 4 ((622 479) (776 597))) (click 5 ((489 558) (799 535))) (click 6 ((888 307) (555 383))))');
});
