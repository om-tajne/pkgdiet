export declare const SUPPORTED_AGENTS: string[];
export declare function verifyAgents(cwd: any): ({
    agent: string;
    configured: boolean;
    mode: string;
    file?: undefined;
} | {
    mode?: undefined;
    agent: string;
    configured: boolean;
    file: any;
})[];
export declare function setupAgents(agents: any, cwd: any, options?: {}): Promise<void>;
