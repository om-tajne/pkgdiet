export function injectAlternatives(db: any): void;
export function setLoader(fn: any): void;
export function getAlternatives(packageName: any): {
    replacements: any;
    reason: any;
    category: any;
    details: any;
};
export function findAlternatives(packageNames: any): {
    current: any;
    reason: any;
    alternatives: any;
    category: any;
}[];
export function getAllAlternatives(): any;
