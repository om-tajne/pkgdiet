import fs from 'fs';
import path from 'path';
import os from 'os';

export function isScopeMappedInNpmrc(packageName, projectPath = process.cwd()) {
  if (!packageName.startsWith('@')) return false;
  const scope = packageName.split('/')[0];

  // 1. Check environment variables (crucial for CI environments)
  for (const key of Object.keys(process.env)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === `npm_config_${scope}:registry` || lowerKey === `npm_config_${scope}_registry`) {
      return true;
    }
  }

  // 2. Check physical files
  const localNpmrc = path.join(projectPath, '.npmrc');
  const globalNpmrc = path.join(os.homedir(), '.npmrc');
  
  const checkFile = (file) => {
    if (!fs.existsSync(file)) return false;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    for (let line of lines) {
      line = line.trim();
      if (line.startsWith('#') || line.startsWith(';')) continue; // Ignore comments
      if (line.startsWith(`${scope}:registry=`)) return true;
    }
    return false;
  };
  
  return checkFile(localNpmrc) || checkFile(globalNpmrc);
}
