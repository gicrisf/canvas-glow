import { test as base } from '@playwright/test';

type PwActionName =
    'openPage' |
    'check' |
    'click' | 
    'fill' |
    'press' |
    'select' |
    'uncheck' |
    'setInputFiles';

type Point = {
    X: number;
    Y: number;
}

type PwAction = {
    name: PwActionName;
    index: number;
    points: Point[];
};

export const test = base.extend<{
    getAllSeries: () => Promise<PwAction[]>;
    replaySeries: (series: PwAction) => Promise<void>;
    runAdvicedActions: () => Promise<void>;
    parseSexprActions: (sexpr: string) => PwAction[];
}>(
    {
        page: async ({ page }, use) => {
            // Array to store action objects for this test only
            const pageActionLog: { action: PwActionName, index: number, after: null, original: any[] }[] = [];
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
        parseSexprActions: ({ page }, use) => {
            // Helper to extract series of actions and points from s-expression format
            const parseSexprActionsHelper = (sexpr: string): PwAction[] => {
                // Remove outer parentheses and trim
                const trimmed = sexpr.trim().replace(/^\(|\)$/g, '');
                // Match each action s-expression
                const actionRegex = /\((\w+)\s+(\d+)\s+\(((?:\(\d+\s+\d+\)\s*)*)\)\)/g;
                const result: PwAction[] = [];
                let match;
                while ((match = actionRegex.exec(trimmed)) !== null) {
                    const [, action, index, pointsStr] = match;
                    const points: Point[] = [];
                    const pointRegex = /\((\d+)\s+(\d+)\)/g;
                    let pointMatch;
                    while ((pointMatch = pointRegex.exec(pointsStr)) !== null) {
                        points.push({ X: Number(pointMatch[1]), Y: Number(pointMatch[2]) });
                    }
                    console.log(`Parsed action: ${action} ${index}`, points);
                    result.push({ name: action as PwActionName, index: Number(index), points });
                }
                return result;
            };

            use(parseSexprActionsHelper);
        }, 
        getAllSeries: async ({ page, parseSexprActions }, use) => {
            // This method extracts all actions and points from the 'All points received' container
            const getSeries = async (): Promise<PwAction[]> => {
                const locator = page.locator('[data-testid="all-points"]');
                await locator.waitFor({ state: 'visible', timeout: 10000 });
                const text = await locator.textContent();
                console.log('All points text:', text);
                if (!text) return [];
                const seriesRaw = parseSexprActions(text); 
                // Optionally update pageActionLog if needed (not shown here)
                return seriesRaw;
            };
            // Use getSeries, but return PwAction[] directly
            await use(getSeries);
        },
        replaySeries: async ({ page }, use) => {
            // Accept a PwAction instead of a plain object
            const replay = async (series: PwAction) => {
                console.log('Replaying:', series.name);
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
