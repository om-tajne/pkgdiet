export declare const SUPPORTED_AGENTS: string[];
export declare function verifyAgents(cwd: any): ({
    agent: string;
    configured: boolean;
    mode: string;
    file?: undefined;
} | {
    agent: string;
    configured: any;
    mode: string;
    file: string;
} | {
    mode?: undefined;
    agent: string;
    configured: boolean;
    file: any;
})[];
export declare function setupAgents(agents: any, cwd: any, options?: {}): Promise<void>;
