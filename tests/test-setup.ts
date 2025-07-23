import { test as base } from '@playwright/test';

type Point = {
  X: number;
  Y: number;
}

export const test = base.extend<{
    getAllSeries: () => Promise<{ action: string, points: Point[] }[]>;
    replaySeries: (series: { action: string, points: { X: number, Y: number }[] }) => Promise<void>;
}>(
    {
        page: async ({ page }, use) => { 
            // Save the original mouse.click method
            const originalMouseClick = page.mouse.click.bind(page.mouse);

            // Override the mouse.click method to log any click, regardless of arguments
            page.mouse.click = async function (...args: Parameters<typeof page.mouse.click>) {
                console.log('Custom advice: before mouse.click', ...args);
                const result = await originalMouseClick(...args);
                console.log('Custom advice: after mouse.click', ...args);
                return result;
            };

            await use(page);
        },
        getAllSeries: async ({ page }, use) => {
            // Helper to extract series of points grouped by their preceding action
            const getSeries = async (): Promise<{ action: string, points: Point[] }[]> => {
                const locator = page.locator('[data-testid="all-points"]');
                await locator.waitFor({ state: 'visible', timeout: 10000 });
                const text = await locator.textContent();
                console.log('All points text:', text);
                if (!text) return [];
                // Split by 'Last action' and filter out empty segments
                const segments = text.split('Last action').map(s => s.trim()).filter(Boolean);
                const series: { action: string, points: Point[] }[] = [];
                for (const segment of segments) {
                    // Extract action (until first '{')
                    const actionMatch = segment.match(/^(.*?)\{/);
                    const action = actionMatch ? actionMatch[1].trim() : 'unknown';
                    // Extract all points
                    const pointMatches = Array.from(segment.matchAll(/\{ X: (\d+); Y: (\d+) \}/g));
                    const points: Point[] = pointMatches.map(m => ({ X: Number(m[1]), Y: Number(m[2]) }));
                    console.log('Extracted points:', points);
                    series.push({ action, points });
                }
                return series;
            };
            await use(getSeries);
        },
        replaySeries: async ({ page }, use) => {
            const replay = async (series: { action: string, points: { X: number, Y: number }[] }) => {
                console.log('Replaying:', series.action);
                for (const pt of series.points) {
                    await page.mouse.move(pt.X, pt.Y);
                    await page.waitForTimeout(500);
                }
            };
            await use(replay);
        },
    }
);