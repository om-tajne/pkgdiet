import { getAddedDependenciesFromGit } from './src/diff.js';
import * as cp from 'child_process';

const mockDiff = `
diff --git a/package-lock.json b/package-lock.json
--- a/package-lock.json
+++ b/package-lock.json
@@ -10,0 +11,3 @@
+    "node_modules/picocolors": {
+      "version": "1.0.0"
+    },
`;

const originalExec = cp.execSync;
cp.execSync = (cmd) => {
  if (cmd.includes('package-lock.json')) return mockDiff;
  return originalExec(cmd);
};

console.log(getAddedDependenciesFromGit());
