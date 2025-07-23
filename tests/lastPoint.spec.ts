import { test, expect } from '@playwright/test';

test('reads last point received from canvas-glow app', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Simulate mouse movement on the canvas
  const canvas = await page.locator('canvas');
  const boundingBox = await canvas.boundingBox();
  if (boundingBox) {
    // Move mouse to the center of the canvas
    await page.mouse.move(
      boundingBox.x + boundingBox.width / 2,
      boundingBox.y + boundingBox.height / 2
    );
    // Optionally, move to a few more points
    await page.mouse.move(boundingBox.x + 100, boundingBox.y + 100);
    await page.mouse.move(boundingBox.x + 200, boundingBox.y + 200);
  }

  // Wait for the UI to update
  await page.waitForTimeout(300); // Adjust if needed

  // Locate the h3 element containing "Last point received"
  const lastPoint = await page.locator('h3', { hasText: 'Last point received:' }).textContent();

  console.log('Last point received:', lastPoint);

  // Optionally, extract just the value
  const match = lastPoint?.match(/Last point received:\s*(.*)/);
  const value = match ? match[1] : null;

  expect(value).not.toBeNull();
  // You can add more assertions here if needed
});
