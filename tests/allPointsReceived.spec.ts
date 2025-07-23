import { test } from './test-setup';
import { expect } from '@playwright/test';

test.use({ headless: false });

test('get all points received after mouse movements', async ({ page, getAllPoints }) => {
  await page.goto('http://localhost:5173');

  // Simulate mouse movement
  const canvas = await page.locator('canvas');
  const boundingBox = await canvas.boundingBox();

  if (boundingBox) {
    const points = [
      [boundingBox.x + boundingBox.width / 2, boundingBox.y + boundingBox.height / 2],
      [boundingBox.x + 100, boundingBox.y + 100],
      [boundingBox.x + 200, boundingBox.y + 200],
      [boundingBox.x + 300, boundingBox.y + 300],
    ];
    for (const [x, y] of points) {
      await page.mouse.move(x, y);
      await page.waitForTimeout(1000);
    }
  }

  // Use the helper after actions
  const allPoints = await getAllPoints();
  console.log('All points received:', allPoints);
  expect(allPoints.length).toBeGreaterThan(0);
});
