import ora from 'ora';
import chalk from 'chalk';
import { readPackageJson, resolveProjectPath } from './utils.js';
import { scanDependencies } from './scanner.js';
import { analyzeHealth } from './health.js';
import { analyzeSize } from './size.js';
import { findAlternatives } from './alternatives.js';
export async function run(options = {}) {
    const projectPath = resolveProjectPath(options.path);
    let pkgJson;
    try {
        pkgJson = readPackageJson(projectPath);
    }
    catch (err) {
        if (err.code === 'ENOENT') {
            throw new Error(`No package.json found at ${projectPath}.`);
        }
        throw err;
    }
    const directDeps = {
        ...pkgJson.dependencies,
        ...pkgJson.devDependencies,
    };
    if (Object.keys(directDeps).length === 0) {
        return {
            projectName: pkgJson.name || path.basename(projectPath),
            directDeps: 0,
            filesScanned: 0,
            nodeModulesSize: 0,
            unusedDeps: [],
            unhealthyDeps: [],
            sizeIssues: []
        };
    }
    const scanResult = scanDependencies(projectPath);
    const unusedDeps = [];
    const unhealthyDeps = [];
    const sizeIssues = [];
    for (const dep of Object.keys(directDeps)) {
        if (!scanResult.usedDependencies.has(dep)) {
            unusedDeps.push(dep);
        }
    }
    for (const dep of scanResult.usedDependencies) {
        const health = await analyzeHealth(dep);
        if (health !== null && health < 40) {
            unhealthyDeps.push({ name: dep, healthScore: health });
        }
    }
    const { totalSize, bloatedPackages } = analyzeSize(projectPath);
    for (const bloat of bloatedPackages) {
        sizeIssues.push(bloat);
    }
    return {
        projectName: pkgJson.name || 'pkgdiet-monorepo',
        directDeps: Object.keys(directDeps).length,
        filesScanned: scanResult.filesScanned,
        nodeModulesSize: totalSize,
        unusedDeps,
        unhealthyDeps,
        sizeIssues
    };
}
