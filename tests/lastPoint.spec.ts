import { test, expect } from '@playwright/test';

test.use({ headless: false });

test('capture and replay mouse movements on canvas', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Simulate mouse movement and capture coordinates
  const canvas = await page.locator('canvas');
  const boundingBox = await canvas.boundingBox();
  const coordinates: { x: number, y: number }[] = [];

  if (boundingBox) {
    const points = [
      [boundingBox.x + boundingBox.width / 2, boundingBox.y + boundingBox.height / 2],
      [boundingBox.x + 100, boundingBox.y + 100],
      [boundingBox.x + 200, boundingBox.y + 200],
      [boundingBox.x + 300, boundingBox.y + 300],
    ];
    for (const [x, y] of points) {
      await page.mouse.move(x, y);
      await page.waitForTimeout(1000); // Increased wait for UI update
      coordinates.push({ x, y });
    }
  }

  // Print captured coordinates
  console.log('Captured coordinates:', coordinates);

  // Replay the movements using the captured coordinates
  // Helper to extract coordinates from the string
  function extractCoords(str: string): string | null {
    const match = str.match(/\{[^}]+\}/);
    return match ? match[0] : null;
  }

  // Replay the movements and assert coordinates match expected mouse positions
  function toCanvasCoords(x: number, y: number): string {
    return `{ X: ${Math.round(x)}; Y: ${Math.round(y)} }`;
  }

  // Tolerance function for coordinates
  function coordsAlmostEqual(actual: string | null, expected: string): boolean {
    if (!actual) return false;
    const actualMatch = actual.match(/\{ X: (\d+); Y: (\d+) \}/);
    const expectedMatch = expected.match(/\{ X: (\d+); Y: (\d+) \}/);
    if (!actualMatch || !expectedMatch) return false;
    const ax = parseInt(actualMatch[1], 10);
    const ay = parseInt(actualMatch[2], 10);
    const ex = parseInt(expectedMatch[1], 10);
    const ey = parseInt(expectedMatch[2], 10);
    return Math.abs(ax - ex) <= 1 && Math.abs(ay - ey) <= 1;
  }

  for (const coord of coordinates) {
    await page.mouse.move(coord.x, coord.y);
    await page.waitForTimeout(1000); // Increased wait for UI update
    const lastPoint = await page.locator('h3', { hasText: 'Last point received:' }).textContent();
    const actualCoords = extractCoords(lastPoint ?? '');
    const expectedCoords = toCanvasCoords(coord.x, coord.y);
    console.log('actualCoords:', actualCoords, 'expectedCoords:', expectedCoords);
    expect(coordsAlmostEqual(actualCoords, expectedCoords)).toBe(true);
  }
});
