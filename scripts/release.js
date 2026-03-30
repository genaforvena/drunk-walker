#!/usr/bin/env node

/**
 * FULLY AUTOMATIC Release Script for Drunk Walker
 *
 * Usage: npm run release [version]
 * Example: npm run release 6.1.8
 *
 * Does EVERYTHING automatically:
 * 1. Updates version in ALL files
 * 2. Runs tests (fast, with mocked timers)
 * 3. Builds bookmarklet + Chrome extension + Firefox extension
 * 4. Creates ZIP files for BOTH Chrome and Firefox
 * 5. Commits ALL changes
 * 6. Pushes code to GitHub
 * 7. Creates and pushes git tag
 * 8. Creates GitHub Release with ALL assets
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Get version from command line
const version = process.argv[2];

if (!version) {
  console.error('❌ Usage: npm run release [version]');
  console.error('Example: npm run release 6.1.8');
  process.exit(1);
}

// Validate semver format
const semverRegex = /^\d+\.\d+\.\d+$/;
if (!semverRegex.test(version)) {
  console.error(`❌ Invalid version format: ${version}`);
  console.error('Version must be in semver format: X.Y.Z');
  process.exit(1);
}

console.log(`\n🚀 Starting FULLY AUTOMATIC release for v${version}...\n`);

// Helper: Run shell command
function run(cmd, options = {}) {
  try {
    const result = execSync(cmd, { encoding: 'utf8', stdio: options.stdio || 'pipe', ...options });
    if (options.verbose) console.log(result.trim());
    return result ? result.trim() : '';
  } catch (error) {
    console.error(`❌ Command failed: ${cmd}`);
    console.error(error.message);
    throw error;
  }
}

// Helper: Update file content
function updateFile(filePath, regex, replacement) {
  const fullPath = path.join(rootDir, filePath);
  const content = fs.readFileSync(fullPath, 'utf8');
  const newContent = content.replace(regex, replacement);
  if (content !== newContent) {
    fs.writeFileSync(fullPath, newContent);
    console.log(`✓ Updated ${filePath}`);
  }
}

// Helper: Create ZIP file
function createZip(sourceDir, zipPath) {
  try {
    run(`cd "${sourceDir}" && zip -qr "${zipPath}" .`);
    console.log(`✓ Created ${path.basename(zipPath)}`);
  } catch (e) {
    console.log(`⚠️  zip not available, folder ready: ${path.basename(sourceDir)}/`);
  }
}

try {
  // ========== STEP 1: Update version ==========
  console.log('📝 STEP 1: Updating version...\n');

  updateFile('package.json', /"version": "[^"]+"/, `"version": "${version}"`);
  updateFile('src/version.js', /export const VERSION = '[^']+'/, `export const VERSION = '${version}'`);
  updateFile('src/core/engine.test.js', /v\d+\.\d+\.\d+/, `v${version}`);
  updateFile('src/bundle.test.js', /v\d+\.\d+\.\d+/, `v${version}`);
  
  // Update README download links
  updateFile('README.md', 
    /drunk-walker-chrome\.zip\)\([^)]+\)/g,
    `drunk-walker-chrome.zip)(https://github.com/genaforvena/drunk-walker/releases/download/v${version}/drunk-walker-chrome.zip)`
  );
  updateFile('README.md',
    /drunk-walker-firefox\.zip\)\([^)]+\)/g,
    `drunk-walker-firefox.zip)(https://github.com/genaforvena/drunk-walker/releases/download/v${version}/drunk-walker-firefox.zip)`
  );
  updateFile('README.md',
    /\*\*v\d+\.\d+\.\d+\*\* \|/,
    `**v${version}** | Latest release\n| **v6.1.7** |`
  );
  
  // Update index.html
  updateFile('index.html', /Latest Release: v[\d.]+/, `Latest Release: v${version}`);
  
  console.log('');

  // ========== STEP 2: Run tests (FAST with mocked timers) ==========
  console.log('🧪 STEP 2: Running tests...\n');
  run('npm test', { stdio: 'inherit' });
  console.log('✓ All tests passed\n');

  // ========== STEP 3: Build everything ==========
  console.log('🔨 STEP 3: Building bookmarklet + extensions...\n');
  run('npm run build', { stdio: 'inherit' });
  console.log('');

  // ========== STEP 4: Create ZIPs for Chrome AND Firefox ==========
  console.log('📦 STEP 4: Creating extension ZIPs (Chrome + Firefox)...\n');
  
  const distDir = path.join(rootDir, 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
  
  // Chrome extension ZIP (from extension-chrome folder)
  const chromeZip = path.join(distDir, 'drunk-walker-chrome.zip');
  createZip(path.join(rootDir, 'extension-chrome'), chromeZip);
  
  // Firefox extension ZIP (from extension-firefox folder)
  const firefoxZip = path.join(distDir, 'drunk-walker-firefox.zip');
  createZip(path.join(rootDir, 'extension-firefox'), firefoxZip);
  
  console.log('');

  // ========== STEP 5: Commit ALL changes ==========
  console.log('💾 STEP 5: Committing changes...\n');
  run('git add -A');
  run(`git commit -m "v${version}: Release"`);
  console.log('✓ Changes committed\n');

  // ========== STEP 6: Push code to GitHub ==========
  console.log('📤 STEP 6: Pushing code to GitHub...\n');
  run('git push');
  console.log('✓ Code pushed\n');

  // ========== STEP 7: Create and push git tag ==========
  console.log('🏷️  STEP 7: Creating git tag...\n');
  run(`git tag -a v${version} -m "v${version}"`);
  run(`git push origin v${version}`);
  console.log(`✓ Tag v${version} pushed\n`);

  // ========== STEP 8: Create GitHub Release with ALL assets ==========
  console.log('📋 STEP 8: Creating GitHub Release...\n');
  
  const releaseNotes = `## v${version}

### Downloads
- [bookmarklet.js](bookmarklet.js) - Browser console version
- [drunk-walker-chrome.zip](drunk-walker-chrome.zip) - Chrome/Edge/Brave extension
- [drunk-walker-firefox.zip](drunk-walker-firefox.zip) - Firefox extension

### Installation

#### Chrome/Edge/Brave
1. Download \`drunk-walker-chrome.zip\`
2. Extract to folder
3. Go to \`chrome://extensions/\`
4. Enable Developer mode
5. Click "Load unpacked" → select folder

#### Firefox
1. Download \`drunk-walker-firefox.zip\`
2. Extract to folder
3. Go to \`about:debugging\`
4. Click "Load Temporary Add-on"
5. Select \`manifest.json\`

#### Bookmarklet
1. Visit https://genaforvena.github.io/drunk-walker/
2. Click "COPY BOOKMARKLET"
3. Paste into console on Google Maps Street View
`;

  run(`gh release create v${version} dist/bookmarklet.js dist/drunk-walker-chrome.zip dist/drunk-walker-firefox.zip --title "v${version}" --notes '${releaseNotes}'`);
  console.log('✓ GitHub Release created\n');

  // ========== DONE ==========
  console.log('✅ =========================================');
  console.log(`✅ RELEASE v${version} COMPLETE!`);
  console.log('✅ =========================================\n');
  console.log(`📦 Code: https://github.com/genaforvena/drunk-walker`);
  console.log(`🏷️  Tag: https://github.com/genaforvena/drunk-walker/releases/tag/v${version}`);
  console.log(`📋 Release: https://github.com/genaforvena/drunk-walker/releases/latest\n`);

} catch (error) {
  console.error('\n❌ =========================================');
  console.error('❌ RELEASE FAILED!');
  console.error('❌ =========================================\n');
  console.error('Error:', error.message);
  console.error('\n📝 Manual recovery:');
  console.error('   1. Check status: git status');
  console.error('   2. Revert if needed: git reset --hard HEAD~1');
  console.error('   3. Delete tag: git tag -d v' + version);
  console.error('   4. Fix and retry\n');
  process.exit(1);
}
