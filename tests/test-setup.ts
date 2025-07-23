import { test as base } from '@playwright/test';

type Point = {
  X: number;
  Y: number;
}

export const test = base.extend<{ getAllSeries: () => Promise<{ action: string, points: Point[] }[]> }>(
  {
    getAllSeries: async ({ page }, use) => {
      // Helper to extract series of points grouped by their preceding action
      const getSeries = async (): Promise<{ action: string, points: Point[] }[]> => {
        const locator = page.locator('[data-testid="all-points"]');
        await locator.waitFor({ state: 'visible', timeout: 10000 });
        const text = await locator.textContent();
        if (!text) return [];
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const series: { action: string, points: Point[] }[] = [];
        let currentAction = '';
        let currentPoints: Point[] = [];
        for (const line of lines) {
          if (line.startsWith('Last action')) {
            if (currentPoints.length > 0) {
              series.push({ action: currentAction, points: currentPoints });
              currentPoints = [];
            }
            currentAction = line;
          } else {
            const match = line.match(/\{ X: (\d+); Y: (\d+) \}/);
            if (match) {
              currentPoints.push({ X: Number(match[1]), Y: Number(match[2]) });
            }
          }
        }
        if (currentPoints.length > 0) {
          series.push({ action: currentAction, points: currentPoints });
        }
        return series;
      };
      await use(getSeries);
    },
  }
);