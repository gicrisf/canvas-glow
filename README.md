# I saw the Lazo Glow

Partiamo dal caso di un lazo, come quello che potremmo avere nel componente misure.

## Obiettivo

Registrare con Playwright le seguenti azioni:
- Azioni supportate di default (es. click)
- Movimenti del mouse (non supportate dal recorder)

Perche' sottolineo che non sono supportate dal *recorder*? Perche', in realta', l'engine di pw supporta le mousemoves. E' molto semplice scrivere uno script di pw che esegua delle mousemove, praticamente basta passargli un array. Vediamo un esempio molto semplice.

```typescript
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
```

Run it:

```
npx playwright test moveme
```

Vedi video dimostrativo:

<video src="https://do-app-01.it.esaote.priv/ESAOTE_US/9da48d28-4209-4b9c-8e4d-c38323eb7abd/_apis/git/repositories/6a301a7f-2ed4-4b48-afea-ffde55770f85/items?path=/.attachments/codegen-01.mp4" width=800 controls>
</video>

