import { test as base, expect as originalExpect } from '@playwright/test';
import { Page, Locator } from '@playwright/test';

// Redefining rn
// Can I import them somehow?
// Seem "exported" but still internal
type LocatorOptions = {
  hasText?: string | RegExp;
  hasNotText?: string | RegExp;
  has?: Locator;
  hasNot?: Locator;
  visible?: boolean;
};

type MouseClickOptions = {
  delay?: number;
  // Using string union to replace MouseButton
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
};
// ./Redefining

type AdvicedLocatorClick = {
    type: 'locator',
    originalObj: Locator,
    originalOptions: LocatorOptions,
    trail: Point[],
}

type AdvicedMouseClick = {
    type: 'mouse',
    x: number,
    y: number,
    originalOptions: MouseClickOptions,
    trail: Point[],
}

type AdvicedClick = AdvicedLocatorClick | AdvicedMouseClick;

const advicedClicks: AdvicedClick[] = [];

// Store the parsed actions from assertion text
let capturedActions: PwAction[] = [];

// Update stored clicks with trail data from captured actions
function updateClicksWithTrails() {
    const clickActions = capturedActions.filter(action => action.name === 'click');
    
    for (let i = 0; i < advicedClicks.length && i < clickActions.length; i++) {
        advicedClicks[i].trail = clickActions[i].points;
        console.log(`Updated click ${i} with ${clickActions[i].points.length} trail points:`, JSON.stringify(clickActions[i].points));
    }
}

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

function createProxiedExpect(originalExpect: typeof originalExpect) {
    // Helper to parse s-expressions
    const parseSexprActions = (sexpr: string): PwAction[] => {
        const trimmed = sexpr.trim().replace(/^\(|\)$/g, '');
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
            result.push({ name: action as PwActionName, index: Number(index), points });
        }
        return result;
    };

    return function proxiedExpect(actual: any) {
        const expectation = originalExpect(actual);
        
        return new Proxy(expectation, {
            get(obj, prop) {
                const originalMethod = obj[prop];
                
                if (typeof originalMethod === 'function' && prop === 'toContainText') {
                    return function(...args: any[]) {
                        // Parse the text and store the resulting actions
                        const sexprText = args[0];
                        try {
                            capturedActions = parseSexprActions(sexprText);
                            console.log('Captured and parsed actions:', capturedActions);
                            // Update stored clicks with trail data
                            updateClicksWithTrails();
                        } catch (error) {
                            console.warn('Failed to parse s-expression:', sexprText, error);
                            capturedActions = [];
                        }
                        return Promise.resolve(); // Return resolved promise to avoid assertion
                    };
                }
                
                return originalMethod;
            }
        });
    };
}

function createProxiedTrailGetter(originalLocator: Locator, testId: string | RegExp) {
    return new Proxy(originalLocator, {
        get(obj, prop) {
            // Don't log internal properties that Playwright uses for type checking
            if (prop !== 'constructor' && prop !== Symbol.toStringTag && typeof prop === 'string') {
                console.log(`Method called on getByTestId('${testId}'): ${String(prop)}`);
            }
            
            // Capture the original method/property
            const originalMethod = obj[prop];
            
            // If it's a function and not a constructor, wrap it to log the call
            if (typeof originalMethod === 'function' && prop !== 'constructor') {
                // I don't know about this rest, but I'll leave it for a while
                return function(...args: any[]) {
                    console.log(`Calling ${String(prop)} with args:`, args);
                    return originalMethod.apply(obj, args);
                };
            }
            
            // If not, return the original property as-is
            return originalMethod;
        },
        set(obj, prop, value) {
            obj[prop] = value;
            return true;
        }
    });
}

function createProxiedMouse(originalMouse: Page['mouse']) {
    return new Proxy(originalMouse, {
        get(obj, prop) {
            if (prop === 'click') {
                return async (x: number, y: number, options?: MouseClickOptions) => {
                    const adviced: AdvicedMouseClick = {
                        type: 'mouse',
                        x,
                        y,
                        originalOptions: options || {},
                        trail: [] // Will be populated later
                    };
                    advicedClicks.push(adviced);
                    console.log(`Stored mouse click ${advicedClicks.length - 1} at (${x}, ${y}) (trail will be added later)`);
                };
            }
            return obj[prop];
        },
        set(obj, prop, value) {
            obj[prop] = value;
            return true;
        }
    });
}

function createProxiedLocator (originalLocator: Locator) {
    const proxiedLocator = new Proxy(originalLocator, {
        get(obj, prop) {
            if (prop === 'click') {
                return async (options: LocatorOptions) => {
                    const adviced: AdvicedLocatorClick = {
                        type: 'locator',
                        originalObj: obj,
                        originalOptions: options,
                        trail: [] // Will be populated later
                    };
                    advicedClicks.push(adviced);
                    console.log(`Stored click ${advicedClicks.length - 1} (trail will be added later)`);
                }
            }
        },
        set(obj, prop, value) {
            obj[prop] = value;
            return true;
        }
    });

    return proxiedLocator;
}

type ProxiedPage = Page & {
    advicedClicks: AdvicedClick[];
    executeStoredClicks: () => Promise<void>;
    capturedActions: PwAction[];
}

function createProxiedPage (originalPage: Page) {
    const proxiedPage = new Proxy(originalPage, {
        get(obj, prop) {
            if (prop === 'locator') {
                return (selector: string, options?: LocatorOptions) => {
                    const originalLocator = obj.locator(selector, options);
                    return createProxiedLocator(originalLocator);
                }
            } else if (prop == 'getByTestId') {
                console.log("getting by test id!");
                return (testId: string | RegExp) => {
                    const originalLocator = obj.getByTestId(testId);
                    return createProxiedTrailGetter(originalLocator, testId);
                }
            } else if (prop === 'mouse') {
                return createProxiedMouse(obj.mouse);
            }
            return obj[prop];
        },
        set(obj, prop, value) {
            // console.log(`setting property: ${String(prop)} to ${value}`);
            obj[prop] = value;
            return true
        }
    });
    
    // Expose the recorded clicks array on the proxied page
    (proxiedPage as ProxiedPage).advicedClicks = advicedClicks;
    
    // Expose the captured actions
    Object.defineProperty(proxiedPage, 'capturedActions', {
        get: () => capturedActions,
        enumerable: true,
        configurable: true
    });
    
    // Add method to execute all stored clicks
    (proxiedPage as ProxiedPage).executeStoredClicks = async () => {
        console.log(`Executing ${advicedClicks.length} stored clicks...`);
        for (let i = 0; i < advicedClicks.length; i++) {
            const adviced = advicedClicks[i];
            console.log(`Executing click ${i + 1}/${advicedClicks.length}`);
            
            // Execute the click first
            if (adviced.type === 'mouse') {
                // Direct mouse click
                await originalPage.mouse.click(adviced.x, adviced.y, adviced.originalOptions);
            } else {
                // Locator click
                await adviced.originalObj.click(adviced.originalOptions);
            }
            
            // Post-advising: simulate mouse movements along the trail
            console.log(`Simulating trail with ${adviced.trail.length} points`);
            for (const point of adviced.trail) {
                await originalPage.mouse.move(point.X, point.Y);
            }
        }
        console.log('All stored clicks executed');
    };
    
    return proxiedPage;
}

type ExtendedBase = {}

export const test = base.extend<ExtendedBase>({
    page: async({ page }, use) => {
        const proxiedPage = createProxiedPage(page);
        await use(proxiedPage);
    }
});

export const expect = createProxiedExpect(originalExpect);
