import { createRequire } from 'node:module';
const FALLBACK_VERSION = '2.0.2';
function readVersion() {
    try {
        const require = createRequire(import.meta.url);
        const { version } = require('../package.json');
        if (typeof version === 'string' && /^\d+\.\d+\.\d+/.test(version))
            return version;
    }
    catch { /* fall through to the bundled fallback */ }
    return FALLBACK_VERSION;
}
/** The running PkgDiet CLI version, read from package.json at load time. */
export const CLI_VERSION = readVersion();
