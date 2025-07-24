import { test as base } from '@playwright/test';

type Point = {
    X: number;
    Y: number;
}

type ActionName =
  'openPage' |
  'check' |
  'click' |
  'fill' |
  'press' |
  'select' |
  'uncheck' |
  'setInputFiles';

export const test = base.extend<{
    getAllSeries: () => Promise<{ action: string, points: Point[] }[]>;
    replaySeries: (series: { action: string, points: { X: number, Y: number }[] }) => Promise<void>;
    runAdvicedActions: () => Promise<void>;
}>(
    {
        page: async ({ page }, use) => {
            // Array to store action objects for this test only
            const pageActionLog: { action: ActionName, index: number, after: null, original: any[] }[] = [];
            // Expose for debugging
            (page as any).pageActionLog = pageActionLog;

            // Save the original mouse.click method
            const originalMouseClick = page.mouse.click.bind(page.mouse);

            // Override the mouse.click method to log any click, regardless of arguments
            page.mouse.click = async function (...args: Parameters<typeof page.mouse.click>) {
                const clickIndex = pageActionLog.filter(a => a.action === 'click').length;
                pageActionLog.push({
                    action: 'click',
                    index: clickIndex,
                    after: null,
                    original: args
                });
                console.log('Custom advice: mouse.click intercepted', ...args);
                return Promise.resolve();
            };

            // Patch Locator.prototype.click to also log clicks
            const Locator = Object.getPrototypeOf(page.locator('body')).constructor;
            if (!Locator.__advisedClick) {
                Locator.__advisedClick = true;
                const originalLocatorClick = Locator.prototype.click;
                Locator.prototype.click = async function (...args: any[]) {
                    // Try to extract position from args if present
                    let position: { x: number, y: number } | undefined = undefined;
                    if (args && args[0] && typeof args[0] === 'object' && 'position' in args[0]) {
                        const pos = (args[0] as { position?: { x: number, y: number } }).position;
                        if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
                            position = pos;
                        }
                    }
                    const clickIndex = pageActionLog.filter(a => a.action === 'click').length;
                    pageActionLog.push({
                        action: 'click',
                        index: clickIndex,
                        after: null,
                        original: position ? [position.x, position.y] : args
                    });
                    console.log('Custom advice: locator.click intercepted', ...args);
                    // Do not execute originalLocatorClick here
                    return Promise.resolve();
                };
            }

            await use(page);
            // Log the action log after the test
            console.log('pageActionLog:', pageActionLog);
            // Destroy the array after the test
            pageActionLog.length = 0;
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
                    let action = actionMatch ? actionMatch[1].trim() : 'unknown';
                    // Try to extract ActionName and index
                    const actionParts = action.match(/^(\w+)\s+(\d+)$/);
                    let actionName: string | undefined = undefined;
                    let actionIndex: number | undefined = undefined;
                    if (actionParts) {
                        actionName = actionParts[1];
                        actionIndex = parseInt(actionParts[2], 10);
                    }
                    // Extract all points
                    const pointMatches = Array.from(segment.matchAll(/\{ X: (\d+); Y: (\d+) \}/g));
                    const points: Point[] = pointMatches.map(m => ({ X: Number(m[1]), Y: Number(m[2]) }));
                    console.log('Extracted points:', points);
                    series.push({ action, points });
                    // If actionName and actionIndex are valid, try to find and update pageActionLog
                    if (actionName && typeof actionIndex === 'number' && (page as any).pageActionLog) {
                        const logEntry = (page as any).pageActionLog.find((a: any) => a.action === actionName && a.index === actionIndex);
                        if (logEntry) {
                            logEntry.after = { action, points };
                            console.log("logEntry found!");
                        }
                    }
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
        runAdvicedActions: async ({ page }, use) => {
            // This method replays all logged click actions using the original mouse.click
            const originalMouseClick = Object.getPrototypeOf(page.mouse).click.bind(page.mouse);
            const run = async () => {
                for (const entry of (page as any).pageActionLog || []) {
                    if (entry.action === 'click' && Array.isArray(entry.original)) {
                        await originalMouseClick(...entry.original);
                        if (entry.after && Array.isArray(entry.after.points)) {
                            for (const pt of entry.after.points) {
                                await page.mouse.move(pt.X, pt.Y);
                                // Inject a temporary red circle at the pressure point
                                await page.evaluate(({ x, y }) => {
                                    let circle = document.createElement('div');
                                    circle.style.position = 'fixed';
                                    circle.style.left = `${x - 10}px`;
                                    circle.style.top = `${y - 10}px`;
                                    circle.style.width = '20px';
                                    circle.style.height = '20px';
                                    circle.style.background = 'red';
                                    circle.style.borderRadius = '50%';
                                    circle.style.zIndex = '9999';
                                    circle.style.pointerEvents = 'none';
                                    circle.className = 'playwright-pressure-circle';
                                    document.body.appendChild(circle);
                                    setTimeout(() => {
                                        circle.remove();
                                    }, 400);
                                }, { x: pt.X, y: pt.Y });
                                console.log(`Moved to point in adviced: { X: ${pt.X}, Y: ${pt.Y} }`);
                                await page.waitForTimeout(500);
                            }
                        }
                    }
                }
            };
            await use(run);
        }
    }
);
