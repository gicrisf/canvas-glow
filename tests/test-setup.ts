import { test as base } from '@playwright/test';

export const test = base.extend<{ getAllPoints: () => Promise<string[]> }>({
  getAllPoints: async ({ page }, use) => {
    // Helper to extract points from the textContent
    const getPoints = async () => {
      const locator = page.locator('[data-testid="all-points"]');
      await locator.waitFor({ state: 'visible', timeout: 10000 });
      const text = await locator.textContent();
      if (!text) return [];
      // Match all { X: ...; Y: ... } blocks
      return Array.from(text.matchAll(/\{ X: \d+; Y: \d+ \}/g)).map(m => m[0]);
    };
    await use(getPoints);
  },
});
