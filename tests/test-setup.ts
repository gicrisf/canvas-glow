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

type ExtendedBase = {
    parseSexprActions: (sexpr: string) => PwAction[];
}

export const test = base.extend<ExtendedBase>({
    page: async({ page }, use) => {
        const handler = {
            get(obj, prop) {
                console.log(`getting property: ${prop}`);
                return obj[prop];
            },
            set(obj, prop, value) {
                console.log(`setting property: ${prop} to ${value}`);
                obj[prop] = value;
                return true
            }
        }
        const proxiedPage = new Proxy(page, handler);
        await use(proxiedPage);
    }
});
