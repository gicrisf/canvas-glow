import { expect } from '@playwright/test';
import { test } from './test-setup';

test.use({ headless: false });

test('get all points received after canvas clicks', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Click at several points on the canvas
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
            await page.mouse.click(x, y);
            await page.waitForTimeout(1000);
        }
    }

    // Get the textContent of the 'All points received' container
    const allPointsText = await page.locator('[data-testid="all-points"]').textContent();
    console.log('All points received after clicks:', allPointsText);

    expect(allPointsText).toBeTruthy();
});
