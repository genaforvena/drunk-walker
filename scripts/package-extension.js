/**
 * Package extension for store submission
 * Creates ZIP files for Chrome Web Store and Firefox Add-ons
 * Run: node scripts/package-extension.js
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import zlib from 'zlib';

// CRC32 table
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

function crc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(files, outputPath) {
  const entries = [];
  let offset = 0;

  // First pass: calculate all offsets
  files.forEach(({ filename, content }) => {
    const filenameBuf = Buffer.from(filename);
    const compressed = zlib.deflateRawSync(content, { level: 9 });
    const crc = crc32(content);
    
    entries.push({
      filename,
      filenameBuf,
      content,
      compressed,
      crc,
      offset
    });
    
    offset += 30 + filenameBuf.length + compressed.length;
  });

  // Central directory offset
  const centralDirOffset = offset;
  const centralDirEntries = [];

  // Second pass: create local headers and central directory
  const localHeaders = entries.map(entry => {
    const localHeader = Buffer.alloc(30 + entry.filenameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(8, 8); // compression (deflate)
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0, 12); // mod date
    localHeader.writeUInt32LE(entry.crc, 14); // crc32
    localHeader.writeUInt32LE(entry.compressed.length, 18); // compressed size
    localHeader.writeUInt32LE(entry.content.length, 22); // uncompressed size
    localHeader.writeUInt16LE(entry.filenameBuf.length, 26); // filename length
    localHeader.writeUInt16LE(0, 28); // extra field length
    entry.filenameBuf.copy(localHeader, 30);
    
    return Buffer.concat([localHeader, entry.compressed]);
  });

  entries.forEach(entry => {
    const centralHeader = Buffer.alloc(46 + entry.filenameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(8, 10); // compression
    centralHeader.writeUInt16LE(0, 12); // mod time
    centralHeader.writeUInt16LE(0, 14); // mod date
    centralHeader.writeUInt32LE(entry.crc, 16); // crc32
    centralHeader.writeUInt32LE(entry.compressed.length, 20); // compressed size
    centralHeader.writeUInt32LE(entry.content.length, 24); // uncompressed size
    centralHeader.writeUInt16LE(entry.filenameBuf.length, 28); // filename length
    centralHeader.writeUInt16LE(0, 30); // extra field length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number
    centralHeader.writeUInt16LE(0, 36); // internal attributes
    centralHeader.writeUInt32LE(0, 38); // external attributes
    centralHeader.writeUInt32LE(entry.offset, 42); // local header offset
    entry.filenameBuf.copy(centralHeader, 46);
    
    centralDirEntries.push(centralHeader);
  });

  const centralDir = Buffer.concat(centralDirEntries);

  // End of central directory
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0); // signature
  endRecord.writeUInt16LE(0, 4); // disk number
  endRecord.writeUInt16LE(0, 6); // disk with central directory
  endRecord.writeUInt16LE(entries.length, 8); // entries on this disk
  endRecord.writeUInt16LE(entries.length, 10); // total entries
  endRecord.writeUInt32LE(centralDir.length, 12); // central directory size
  endRecord.writeUInt32LE(centralDirOffset, 16); // central directory offset
  endRecord.writeUInt16LE(0, 20); // comment length

  // Write everything
  const zipData = Buffer.concat([...localHeaders, centralDir, endRecord]);
  fs.writeFileSync(outputPath, zipData);
}

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
      if (entry.name.startsWith('.')) {
        continue;
      }
      
      // Skip documentation files
      if (entry.name === 'README.md' || entry.name === 'STORE_ASSETS.md') {
        continue;
      }
      
      if (entry.isDirectory()) {
        walk(fullPath, relativePath);
      } else {
        const content = fs.readFileSync(fullPath);
        files.push({ filename: relativePath, content });
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
  
  const files = getExtensionFiles();
  
  console.log('Files to package:');
  files.forEach(f => console.log(`  - ${f.filename}`));
  console.log();
  
  // Create ZIP for Chrome
  const chromeZip = 'dist/drunk-walker-chrome.zip';
  createZip(files, chromeZip);
  const chromeStats = fs.statSync(chromeZip);
  console.log(`✓ Created ${chromeZip} (${(chromeStats.size / 1024).toFixed(1)} KB)`);
  
  // Create ZIP for Firefox (same file, different name)
  const firefoxZip = 'dist/drunk-walker-firefox.zip';
  fs.copyFileSync(chromeZip, firefoxZip);
  const firefoxStats = fs.statSync(firefoxZip);
  console.log(`✓ Created ${firefoxZip} (${(firefoxStats.size / 1024).toFixed(1)} KB)`);
  
  // Also create tar.gz for alternative download
  const tarGz = 'dist/drunk-walker-extension.tar.gz';
  try {
    execSync(`cd extension && tar -czf ../${tarGz} manifest.json background.js content.js drunk-walker.js popup.html popup.js icons/`, {
      stdio: 'pipe'
    });
    const tarStats = fs.statSync(tarGz);
    console.log(`✓ Created ${tarGz} (${(tarStats.size / 1024).toFixed(1)} KB)`);
  } catch (e) {
    console.log('⚠️  Could not create tar.gz');
  }
  
  console.log('\n✅ Extension packaged!');
  console.log('\n📤 Download locations:');
  console.log('   - dist/drunk-walker-chrome.zip');
  console.log('   - dist/drunk-walker-firefox.zip');
  console.log('\n📦 Upload to GitHub Releases for distribution');
}

main().catch(console.error);
