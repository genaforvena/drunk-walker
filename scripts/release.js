#!/usr/bin/env node

/**
 * One-Click Release Script for Drunk Walker
 * 
 * Usage: npm run release [version]
 * Example: npm run release 6.1.6
 * 
 * This script:
 * 1. Validates version format
 * 2. Updates version in all files
 * 3. Runs tests
 * 4. Builds extension
 * 5. Verifies manifests
 * 6. Creates ZIP files
 * 7. Commits changes
 * 8. Creates git tag
 * 9. Pushes to GitHub
 * 10. Updates GitHub Release
 * 11. Verifies release assets
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname;

// Get version from command line or prompt
const version = process.argv[2];

if (!version) {
  console.error('❌ Usage: npm run release [version]');
  console.error('Example: npm run release 6.1.6');
  process.exit(1);
}

// Validate version format (semver)
const semverRegex = /^\d+\.\d+\.\d+$/;
if (!semverRegex.test(version)) {
  console.error(`❌ Invalid version format: ${version}`);
  console.error('Version must be in semver format: X.Y.Z (e.g., 6.1.6)');
  process.exit(1);
}

console.log(`\n🚀 Starting release process for v${version}...\n`);

// Helper function to run commands
function run(cmd, options = {}) {
  try {
    const result = execSync(cmd, { encoding: 'utf8', stdio: 'pipe', ...options });
    if (options.verbose) console.log(result.trim());
    return result.trim();
  } catch (error) {
    if (!options.silent) {
      console.error(`❌ Command failed: ${cmd}`);
      console.error(error.message);
    }
    throw error;
  }
}

// Helper function to update file content
function updateFile(filePath, regex, replacement) {
  const content = fs.readFileSync(filePath, 'utf8');
  const newContent = content.replace(regex, replacement);
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent);
    console.log(`✓ Updated ${filePath}`);
  }
}

try {
  // Step 1: Update version in all files
  console.log('📝 Updating version in files...');
  
  // package.json
  updateFile(
    path.join(rootDir, 'package.json'),
    /"version": "[^"]+"/,
    `"version": "${version}"`
  );
  
  // src/version.js
  updateFile(
    path.join(rootDir, 'src/version.js'),
    /export const VERSION = '[^']+'/,
    `export const VERSION = '${version}'`
  );
  
  // README.md - update download links and version history
  updateFile(
    path.join(rootDir, 'README.md'),
    /drunk-walker-chrome\.zip\)\([^)]+\)/g,
    `drunk-walker-chrome.zip)(https://github.com/genaforvena/drunk-walker/releases/download/v${version}/drunk-walker-chrome.zip)`
  );
  updateFile(
    path.join(rootDir, 'README.md'),
    /drunk-walker-firefox\.zip\)\([^)]+\)/g,
    `drunk-walker-firefox.zip)(https://github.com/genaforvena/drunk-walker/releases/download/v${version}/drunk-walker-firefox.zip)`
  );
  updateFile(
    path.join(rootDir, 'README.md'),
    /\*\*v6\.\d+\.\d+\*\* \|/,
    `**v${version}** | Latest release\n| **v6.1.5** |`
  );
  
  // index.html - update version badge and download links
  updateFile(
    path.join(rootDir, 'index.html'),
    /Latest Release: v[\d.]+/,
    `Latest Release: v${version}`
  );
  updateFile(
    path.join(rootDir, 'index.html'),
    /drunk-walker-chrome\.zip[^"]+/g,
    `drunk-walker-chrome.zip" class="btn-download">`
  );
  updateFile(
    path.join(rootDir, 'index.html'),
    /drunk-walker-firefox\.zip[^"]+/g,
    `drunk-walker-firefox.zip" class="btn-download firefox">`
  );
  
  console.log('');
  
  // Step 2: Run tests
  console.log('🧪 Running tests...');
  run('npm test', { verbose: false });
  console.log('✓ All tests passed\n');
  
  // Step 3: Build extension
  console.log('🔨 Building extension...');
  run('npm run build', { verbose: true });
  console.log('');
  
  // Step 4: Verify manifests
  console.log('🔍 Verifying manifests...');
  
  const chromeManifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'extension-chrome/manifest.json'), 'utf8'));
  const firefoxManifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'extension-firefox/manifest.json'), 'utf8'));
  
  // Verify Chrome manifest
  if (!chromeManifest.background?.service_worker) {
    throw new Error('Chrome manifest missing service_worker');
  }
  if (chromeManifest.background.type) {
    throw new Error('Chrome manifest should not have "type" property');
  }
  console.log('✓ Chrome manifest OK');
  
  // Verify Firefox manifest
  if (!firefoxManifest.background?.scripts) {
    throw new Error('Firefox manifest missing scripts array');
  }
  if (firefoxManifest.background.service_worker) {
    throw new Error('Firefox manifest should not have service_worker');
  }
  console.log('✓ Firefox manifest OK\n');
  
  // Step 5: Create ZIP files
  console.log('📦 Creating ZIP files...');
  const distDir = path.join(rootDir, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  
  // Use Python to create ZIPs (more reliable than system zip)
  run(`python3 -c "
import zipfile, os
for browser in ['chrome', 'firefox']:
    with zipfile.ZipFile('dist/drunk-walker-{browser}.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(f'extension-{browser}'):
            for file in files:
                filepath = os.path.join(root, file)
                arcname = os.path.relpath(filepath, f'extension-{browser}')
                zf.write(filepath, arcname)
print('Created ZIP files')
"`, { verbose: true });
  console.log('');
  
  // Step 6: Commit changes
  console.log('💾 Committing changes...');
  run('git add -A', { silent: true });
  run(`git commit -m "v${version}: Release"`, { silent: true });
  console.log('✓ Changes committed\n');
  
  // Step 7: Push to GitHub
  console.log('📤 Pushing to GitHub...');
  run('git push', { verbose: true });
  console.log('');
  
  // Step 8: Create git tag
  console.log('🏷️  Creating git tag...');
  run(`git tag -a v${version} -m "v${version}: Release"`, { verbose: true });
  run(`git push origin v${version}`, { verbose: true });
  console.log('');
  
  // Step 9: Update GitHub Release
  console.log('📋 Updating GitHub Release...');
  
  // Delete old assets if they exist
  try {
    run(`gh release delete-asset v${version} drunk-walker-chrome.zip --yes 2>/dev/null`, { silent: true });
    run(`gh release delete-asset v${version} drunk-walker-firefox.zip --yes 2>/dev/null`, { silent: true });
    run(`gh release delete-asset v${version} bookmarklet.js --yes 2>/dev/null`, { silent: true });
  } catch (e) {
    // Ignore errors - assets may not exist
  }
  
  // Upload new assets
  run(`gh release upload v${version} dist/drunk-walker-chrome.zip dist/drunk-walker-firefox.zip dist/bookmarklet.js --clobber`, { verbose: true });
  console.log('');
  
  // Step 10: Verify release assets
  console.log('🔍 Verifying release assets...');
  
  // Download and verify Firefox ZIP
  run(`curl -sL "https://github.com/genaforvena/drunk-walker/releases/download/v${version}/drunk-walker-firefox.zip" -o /tmp/release-verify-ff.zip`);
  run(`cd /tmp && rm -rf release-verify-ff && unzip -d release-verify-ff release-verify-ff.zip >/dev/null 2>&1`);
  const ffManifest = JSON.parse(fs.readFileSync('/tmp/release-verify-ff/manifest.json', 'utf8'));
  if (!ffManifest.background?.scripts || ffManifest.background.service_worker) {
    throw new Error('Firefox release ZIP has wrong manifest!');
  }
  console.log('✓ Firefox release ZIP OK');
  
  // Download and verify Chrome ZIP
  run(`curl -sL "https://github.com/genaforvena/drunk-walker/releases/download/v${version}/drunk-walker-chrome.zip" -o /tmp/release-verify-chrome.zip`);
  run(`cd /tmp && rm -rf release-verify-chrome && unzip -d release-verify-chrome release-verify-chrome.zip >/dev/null 2>&1`);
  const chromeManifestRelease = JSON.parse(fs.readFileSync('/tmp/release-verify-chrome/manifest.json', 'utf8'));
  if (!chromeManifestRelease.background?.service_worker || chromeManifestRelease.background.type) {
    throw new Error('Chrome release ZIP has wrong manifest!');
  }
  console.log('✓ Chrome release ZIP OK\n');
  
  // Cleanup
  try {
    fs.unlinkSync('/tmp/release-verify-ff.zip');
    fs.unlinkSync('/tmp/release-verify-chrome.zip');
    fs.rmSync('/tmp/release-verify-ff', { recursive: true, force: true });
    fs.rmSync('/tmp/release-verify-chrome', { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup errors
  }
  
  console.log('✅ Release v${version} completed successfully!\n');
  console.log('📦 Release assets:');
  console.log(`   https://github.com/genaforvena/drunk-walker/releases/tag/v${version}`);
  console.log('');
  console.log('🌐 GitHub Pages:');
  console.log('   https://genaforvena.github.io/drunk-walker/');
  console.log('');
  console.log('📋 Next steps:');
  console.log('   1. Test Firefox extension from release ZIP');
  console.log('   2. Test Chrome extension from release ZIP');
  console.log('   3. Verify gh.io page shows correct version');
  
} catch (error) {
  console.error('\n❌ Release failed!');
  console.error(error.message);
  console.error('\n📝 Manual recovery steps:');
  console.error('   1. Check what was committed: git log -1');
  console.error('   2. If needed, revert: git reset --hard HEAD~1');
  console.error('   3. Delete tag if created: git tag -d v' + version);
  console.error('   4. Fix the issue and try again');
  process.exit(1);
}
