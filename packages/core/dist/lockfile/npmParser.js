export function parseNpmLockfile(lockContent) {
    const result = new Map();
    if (!lockContent.trim())
        return result;
    try {
        const doc = JSON.parse(lockContent);
        const packages = doc.packages || {};
        for (const [key, value] of Object.entries(packages)) {
            if (!key)
                continue; // skip root ""
            const parts = key.split('node_modules/');
            const name = parts[parts.length - 1];
            if (!name || !value.version)
                continue;
            const version = value.version;
            const isTransitive = parts.length > 2; // if inside another node_modules
            result.set(`${name}@${version}`, { name, version, isTransitive });
        }
    }
    catch (err) {
        // ignore parse errors
    }
    return result;
}
export function diffNpmLockfiles(base, head) {
    const baseMap = parseNpmLockfile(base);
    const headMap = parseNpmLockfile(head);
    const added = [];
    for (const [key, entry] of headMap.entries()) {
        if (!baseMap.has(key)) {
            added.push(entry);
        }
    }
    return added;
}
