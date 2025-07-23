import { test } from './test-setup';
import { expect } from '@playwright/test';

test.use({ headless: false });

test('get all points received after mouse movements', async ({ page, getAllPoints }) => {
    // Open the application
    await page.goto('http://localhost:5173');

    // Get the canvas bounding box
    const canvas = await page.locator('canvas');
    const boundingBox = await canvas.boundingBox();
    if (!boundingBox) { return }

    // Choose a starting point (center of canvas)
    const startX = boundingBox.x + boundingBox.width / 2;
    const startY = boundingBox.y + boundingBox.height / 2;

    // Click at the starting point
    await page.mouse.click(startX, startY);
    await page.waitForTimeout(1000);

    // Simulate mouse movement
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

    // Click again at the starting point
    await page.mouse.click(startX, startY);
    await page.waitForTimeout(1000);

    // Use the helper after actions
    const allPoints = await getAllPoints();
    expect(allPoints.length).toBeGreaterThan(0);

    // Get coordinates from allPoints and move mouse to each
    for (const pt of allPoints) {
        await page.mouse.move(pt.X, pt.Y);
        await page.waitForTimeout(500);
    }
});


