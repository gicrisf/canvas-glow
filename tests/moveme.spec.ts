// Import playwright
import { test, expect } from '@playwright/test';

// We want to see the movement
test.use({ headless: false });

// Define the test
test('play mouse movements on canvas', async ({ page }) => {
    // Open react app
    await page.goto('http://localhost:5173');
    // Find the canvas
    const canvas = await page.locator('canvas');
    // Find the boundings
    const boundingBox = await canvas.boundingBox();

    if (boundingBox) {
        // Define the coordinates inside the boundings
        const points = [
            // Start from the center
            [boundingBox.x + boundingBox.width / 2,
             boundingBox.y + boundingBox.height / 2],
            // Go to (100 100)
            [boundingBox.x + 100, boundingBox.y + 100],
            // Go to (200 200)
            [boundingBox.x + 200, boundingBox.y + 200],
            // Go to (300 300)
            [boundingBox.x + 300, boundingBox.y + 300],
        ];

        // For each point...
        for (const [x, y] of points) {
            // Move the cursor
            await page.mouse.move(x, y);
            // Wait before moving again
            await page.waitForTimeout(1000);
        }
    }
});
