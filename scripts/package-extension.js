/**
 * Package extension for store submission
 * Creates ZIP files for Chrome Web Store and Firefox Add-ons
 * Run: node scripts/package-extension.js
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Get all extension files
function getExtensionFiles() {
  const files = [];
  const extensionDir = 'extension';
  
  function walk(dir, prefix = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      
      // Skip unnecessary files
      if (entry.name.startsWith('.') || entry.name === 'README.md' || 
          (entry.name === 'icons' && prefix === '')) {
        continue;
      }
      
      // Skip icons README
      if (prefix === 'icons' && entry.name === 'README.md') {
        continue;
      }
      
      if (entry.isDirectory()) {
        walk(fullPath, relativePath);
      } else {
        files.push(relativePath);
      }
    }
  }
  
  walk(extensionDir);
  return files;
}

// Main
async function main() {
  console.log('📦 Packaging Drunk Walker extension...\n');
  
  // Create output directory
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }
  
  // Use system zip command for reliability
  try {
    // Package for Chrome
    console.log('Creating Chrome package...');
    execSync('cd extension && zip -r ../dist/drunk-walker-chrome.zip . -x "*.DS_Store" "README.md" "icons/README.md"', { 
      stdio: 'inherit',
      shell: true
    });
    const chromeStats = fs.statSync('dist/drunk-walker-chrome.zip');
    console.log(`✓ Created dist/drunk-walker-chrome.zip (${(chromeStats.size / 1024).toFixed(1)} KB)`);
    
    // Package for Firefox (same ZIP)
    console.log('\nCreating Firefox package...');
    fs.copyFileSync('dist/drunk-walker-chrome.zip', 'dist/drunk-walker-firefox.zip');
    const firefoxStats = fs.statSync('dist/drunk-walker-firefox.zip');
    console.log(`✓ Created dist/drunk-walker-firefox.zip (${(firefoxStats.size / 1024).toFixed(1)} KB)`);
    
    console.log('\n✅ Extension packaged!');
    console.log('\n📤 Next steps:');
    console.log('   Chrome: Upload to https://chrome.google.com/webstore/devconsole');
    console.log('   Firefox: Upload to https://addons.mozilla.org/developers/');
    
  } catch (error) {
    // Fallback: manual zip using Node.js
    console.log('⚠️  System zip not available, creating simple archive...\n');
    
    const files = getExtensionFiles();
    console.log('Files to package:');
    files.forEach(f => console.log(`  - ${f}`));
    console.log();
    
    // Create a simple tarball instead
    execSync('cd extension && tar -czf ../dist/drunk-walker-extension.tar.gz *', {
      stdio: 'inherit',
      shell: true
    });
    
    console.log('✓ Created dist/drunk-walker-extension.tar.gz');
    console.log('\nNote: Convert to ZIP manually or install zip utility');
  }
}

main().catch(console.error);
