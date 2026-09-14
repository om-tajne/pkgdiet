/**
 * PkgDiet - Alternatives Engine (Core Logic)
 * Contains the pure in-memory lookup functions without any fs or ESM path logic.
 */
export declare function injectAlternatives(db: any): void;
export declare function setLoader(fn: any): void;
export declare function getAlternatives(packageName: any): {
    replacements: any;
    reason: any;
    category: any;
    details: any;
};
export declare function findAlternatives(packageNames: any): any[];
export declare function getAllAlternatives(): any;
