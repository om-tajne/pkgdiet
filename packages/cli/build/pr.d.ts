/**
 * pkgdiet pr — Generate a reviewer-ready pull request for adding PkgDiet to any GitHub repo.
 *
 * Prints the exact PR title, description, and file contents to submit.
 * Designed to be accepted by any reviewer: minimal permissions, never blocks CI on first add,
 * single file change, zero new dependencies.
 */
export declare function runPr(cwd: any, options?: {}): Promise<void>;
export declare const KNOWN_REPOS: {
    antigravity: {
        url: string;
        type: string;
        note: string;
    };
    langchain: {
        url: string;
        type: string;
        note: string;
    };
    llamaindex: {
        url: string;
        type: string;
        note: string;
    };
    'vercel-ai': {
        url: string;
        type: string;
        note: string;
    };
    cline: {
        url: string;
        type: string;
        note: string;
    };
    continue: {
        url: string;
        type: string;
        note: string;
    };
};
