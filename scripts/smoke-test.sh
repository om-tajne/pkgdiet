#!/bin/bash
set -e

echo "Running Clean-Room Registry Smoke Test for PkgDiet v2.0.1..."

# Create a temporary directory outside the repo
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

echo "Initializing empty project in $TEMP_DIR..."
npm init -y > /dev/null

echo "Installing pkgdiet@2.0.1 from the public npm registry..."
npm install pkgdiet@2.0.1

echo "Verifying CLI installation..."
npx pkgdiet --version

echo "Testing 'check' command..."
npx pkgdiet check moment

echo "Testing 'check' command on request..."
npx pkgdiet check request

echo "Testing 'audit --json' command..."
npx pkgdiet audit --json

echo "Testing 'policy-check' command..."
npx pkgdiet policy-check

echo "Verifying package metadata from registry..."
npm view pkgdiet@2.0.1 version dependencies bin
npm view @pkgdiet/core@2.0.1 version exports
npm view @pkgdiet/mcp@2.0.1 version dependencies

echo ""
echo "✅ Smoke test completed successfully!"
echo "If all commands above succeeded and returned expected v2.0.1 data, you are clear to announce!"
echo "Cleaning up..."
rm -rf "$TEMP_DIR"
