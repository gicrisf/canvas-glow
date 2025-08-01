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

type ActionLambda = (() => Promise<void>) & {
    actionType: string;
    trail?: Point[];
}

const actionStream: ActionLambda[] = [];

// Store the parsed actions from assertion text
let capturedActions: PwAction[] = [];

const PW_ACTION_NAMES = ['openPage', 'check', 'click', 'fill', 'press', 'select', 'uncheck', 'setInputFiles'] as const;
type PwActionName = typeof PW_ACTION_NAMES[number];

type Point = {
    X: number;
    Y: number;
}

type PwAction = {
    name: PwActionName;
    index: number;
    points: Point[];
};

// Update action lambdas with trail data from captured actions
function updateActionsWithTrails() {
    const actionTypes = PW_ACTION_NAMES;
    
    for (const actionType of actionTypes) {
        const actions = capturedActions.filter(action => action.name === actionType);
        const lambdas = actionStream.filter(lambda => lambda.actionType === actionType);
        
        for (let i = 0; i < lambdas.length && i < actions.length; i++) {
            lambdas[i].trail = actions[i].points;
            console.log(`Updated ${actionType} lambda ${i} with ${actions[i].points.length} trail points:`, JSON.stringify(actions[i].points));
        }
    }
}

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
                            // Update stored actions with trail data
                            updateActionsWithTrails();
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

function createProxiedMouse(originalMouse: Page['mouse'], originalPage: Page) {
    return new Proxy(originalMouse, {
        get(obj, prop) {
            if (prop === 'click') {
                return async (x: number, y: number, options?: MouseClickOptions) => {
                    const lambda = Object.assign(
                        async () => {
                            await originalMouse.click(x, y, options);
                            // Post-action: simulate mouse movements along the trail if available
                            if (lambda.trail) {
                                console.log(`Simulating trail with ${lambda.trail.length} points`);
                                for (const point of lambda.trail) {
                                    await originalPage.mouse.move(point.X, point.Y);
                                }
                            }
                        },
                        { actionType: 'click' }
                    ) as ActionLambda;
                    
                    actionStream.push(lambda);
                    console.log(`Stored mouse click lambda ${actionStream.length - 1} at (${x}, ${y})`);
                };
            } else if (prop === 'move') {
                return async (x: number, y: number, options?: any) => {
                    const lambda = Object.assign(
                        async () => {
                            await originalMouse.move(x, y, options);
                        },
                        { actionType: 'move' }
                    ) as ActionLambda;
                    
                    actionStream.push(lambda);
                    console.log(`Stored mouse move lambda ${actionStream.length - 1} to (${x}, ${y})`);
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

function createGeneralProxy(originalObject: any, objectName: string) {
    return new Proxy(originalObject, {
        get(obj, prop) {
            const originalMethod = obj[prop];
            
            // If it's a function, wrap it to store in lambda stream
            if (typeof originalMethod === 'function' && typeof prop === 'string') {
                return async (...args: any[]) => {
                    const lambda = Object.assign(
                        async () => {
                            await originalMethod.apply(obj, args);
                        },
                        { actionType: `${objectName}.${prop}` }
                    ) as ActionLambda;
                    
                    actionStream.push(lambda);
                    console.log(`Stored ${objectName}.${prop} lambda ${actionStream.length - 1}`);
                };
            }
            
            return originalMethod;
        },
        set(obj, prop, value) {
            obj[prop] = value;
            return true;
        }
    });
}

function createProxiedLocator (originalLocator: Locator, originalPage: Page) {
    const proxiedLocator = new Proxy(originalLocator, {
        get(obj, prop) {
            if (prop === 'click') {
                return async (options: LocatorOptions) => {
                    const lambda = Object.assign(
                        async () => {
                            await obj.click(options);
                            // Post-action: simulate mouse movements along the trail if available
                            if (lambda.trail) {
                                console.log(`Simulating trail with ${lambda.trail.length} points`);
                                for (const point of lambda.trail) {
                                    await originalPage.mouse.move(point.X, point.Y);
                                }
                            }
                        },
                        { actionType: 'click' }
                    ) as ActionLambda;
                    
                    actionStream.push(lambda);
                    console.log(`Stored locator click lambda ${actionStream.length - 1}`);
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
    actionStream: ActionLambda[];
    executeActionStream: () => Promise<void>;
    capturedActions: PwAction[];
}

function createProxiedPage (originalPage: Page) {
    const proxiedPage = new Proxy(originalPage, {
        get(obj, prop) {
            if (prop === 'locator') {
                return (selector: string, options?: LocatorOptions) => {
                    const originalLocator = obj.locator(selector, options);
                    return createProxiedLocator(originalLocator, originalPage);
                }
            } else if (prop == 'getByTestId') {
                console.log("getting by test id!");
                return (testId: string | RegExp) => {
                    const originalLocator = obj.getByTestId(testId);
                    return createProxiedTrailGetter(originalLocator, testId);
                }
            } else if (prop === 'mouse') {
                return createProxiedMouse(obj.mouse, originalPage);
            } else if (prop === 'keyboard') {
                return createGeneralProxy(obj.keyboard, 'keyboard');
            } else if (prop === 'goto') {
                return async (url: string, options?: any) => {
                    const lambda = Object.assign(
                        async () => {
                            await obj.goto(url, options);
                            // Post-action: simulate mouse movements along the trail if available
                            if (lambda.trail) {
                                console.log(`Simulating openPage trail with ${lambda.trail.length} points`);
                                for (const point of lambda.trail) {
                                    await originalPage.mouse.move(point.X, point.Y);
                                }
                            }
                        },
                        { actionType: 'openPage' }
                    ) as ActionLambda;
                    
                    actionStream.push(lambda);
                    console.log(`Stored goto (openPage) lambda ${actionStream.length - 1} for URL: ${url}`);
                };
            } else if (prop === 'executeActionStream') {
                // Don't proxy this - execute immediately
                return obj[prop];
            } else if (typeof obj[prop] === 'function' && typeof prop === 'string') {
                // General handler for any other page methods
                const originalMethod = obj[prop];
                return async (...args: any[]) => {
                    const lambda = Object.assign(
                        async () => {
                            await originalMethod.apply(obj, args);
                        },
                        { actionType: `page.${prop}` }
                    ) as ActionLambda;
                    
                    actionStream.push(lambda);
                    console.log(`Stored page.${prop} lambda ${actionStream.length - 1}`);
                };
            }
            return obj[prop];
        },
        set(obj, prop, value) {
            // console.log(`setting property: ${String(prop)} to ${value}`);
            obj[prop] = value;
            return true
        }
    });
    
    // Expose the action stream on the proxied page
    (proxiedPage as ProxiedPage).actionStream = actionStream;
    
    // Expose the captured actions
    Object.defineProperty(proxiedPage, 'capturedActions', {
        get: () => capturedActions,
        enumerable: true,
        configurable: true
    });
    
    // Add method to execute all stored actions
    (proxiedPage as ProxiedPage).executeActionStream = async () => {
        console.log(`Executing ${actionStream.length} stored actions...`);
        for (let i = 0; i < actionStream.length; i++) {
            const action = actionStream[i];
            console.log(`Executing action ${i + 1}/${actionStream.length} (${action.actionType})`);
            await action();
        }
        console.log('All stored actions executed');
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
