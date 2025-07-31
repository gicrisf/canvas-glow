import { test as base } from '@playwright/test';
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

type AdvicedLocator = {
    originalObj: Locator,
    originalProp: 'click',
    originalOptions: LocatorOptions,
    trail: Point[],
}

const advicedLocators: AdvicedLocator[] = [];

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

function createProxiedLocator (originalLocator: Locator) {
    const proxiedLocator = new Proxy(originalLocator, {
        get(obj, prop) {
            if (prop === 'click') {
                return async (options: LocatorOptions) => {
                    const adviced: AdvicedLocator = {
                        originalObj: obj,
                        originalProp: prop,
                        originalOptions: options,
                        // Hardcoded during development
                        trail: [{ X: 659, Y: 567 }, { X: 584, Y: 739} ]
                    };
                    advicedLocators.push(adviced);
                    // Debugging lines
                    // const last = advicedLocators[advicedLocators.length - 1];
                    console.log(advicedLocators);
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
    advicedLocators: AdvicedLocator[];
    executeStoredClicks: () => Promise<void>;
}

function createProxiedPage (originalPage: Page) {
    const proxiedPage = new Proxy(originalPage, {
        get(obj, prop) {
            if (prop === 'locator') {
                return (selector: string, options?: LocatorOptions) => {
                    const originalLocator = obj.locator(selector, options);
                    return createProxiedLocator(originalLocator);
                }
            }
            return obj[prop];
        },
        set(obj, prop, value) {
            // console.log(`setting property: ${String(prop)} to ${value}`);
            obj[prop] = value;
            return true
        }
    });
    
    // Expose the recordedClickOptions array on the proxied page
    (proxiedPage as ProxiedPage).advicedLocators = advicedLocators;
    
    // Add method to execute all stored clicks
    (proxiedPage as ProxiedPage).executeStoredClicks = async () => {
        console.log(`Executing ${advicedLocators.length} stored clicks...`);
        for (let i = 0; i < advicedLocators.length; i++) {
            const adviced = advicedLocators[i];
            console.log(`Executing click ${i + 1}/${advicedLocators.length}`);
            
            // Execute the click first
            await adviced.originalObj.click(adviced.originalOptions);
            
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

type ExtendedBase = {
    parseSexprActions: (sexpr: string) => PwAction[];
}

export const test = base.extend<ExtendedBase>({
    page: async({ page }, use) => {
        const proxiedPage = createProxiedPage(page);
        await use(proxiedPage);
    }
});
