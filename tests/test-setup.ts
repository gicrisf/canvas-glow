import { test as base } from '@playwright/test';

type Point = {
  X: number;
  Y: number;
}

export const test = base.extend<{ getAllPoints: () => Promise<Point[]> }>({
  getAllPoints: async ({ page }, use) => {
    // Helper to extract points from the textContent
    const getPoints = async (): Promise<Point[]> => {
      const locator = page.locator('[data-testid="all-points"]');
      await locator.waitFor({ state: 'visible', timeout: 10000 });
      const text = await locator.textContent();
      if (!text) return [];
      // Match all { X: ...; Y: ... } blocks and parse them into Point objects
      return Array.from(text.matchAll(/\{ X: (\d+); Y: (\d+) \}/g)).map(m => ({
        X: Number(m[1]),
        Y: Number(m[2]),
      }));
    };
    await use(getPoints);
  },
});