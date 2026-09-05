export function parseYarnLockfile(lockContent) {
    const result = new Map();
    if (!lockContent || !lockContent.trim())
        return result;
    const lines = lockContent.split(/\r?\n/);
    let currentName = null;
    for (const line of lines) {
        if (line.trim() === "" || line.startsWith("#"))
            continue;
        if (!line.startsWith(" ") && line.endsWith(":")) {
            // New package specifier, e.g. 'accepts@~1.3.0:' or '"@scope/pkg@^1.0.0":'
            const spec = line.slice(0, -1).trim().replace(/^"|"$/g, "");
            // Parse name from spec like "accepts@~1.3.0" or "@scope/pkg@^1.0.0"
            const atPos = spec.lastIndexOf("@");
            if (atPos <= 0)
                continue; // might be @scope/pkg
            currentName = spec.slice(0, atPos);
        }
        else if (currentName && line.trim().startsWith("version")) {
            const match = /version\s+"([^"]+)"/.exec(line);
            if (match) {
                const version = match[1];
                const key = `${currentName}@${version}`;
                result.set(key, {
                    name: currentName,
                    version,
                    isTransitive: true, // refine later
                });
            }
            currentName = null; // Wait for next package
        }
    }
    return result;
}
export function diffYarnLockfiles(base, head) {
    const baseMap = parseYarnLockfile(base);
    const headMap = parseYarnLockfile(head);
    const added = [];
    for (const [key, entry] of headMap.entries()) {
        if (!baseMap.has(key)) {
            added.push(entry);
        }
    }
    return added;
}
