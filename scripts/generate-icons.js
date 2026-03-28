/**
 * Generate simple PNG icons for Drunk Walker extension
 * Uses pako for deflate compression (built into Node.js via zlib)
 * Run: node scripts/generate-icons.js
 */

import fs from 'fs';
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
  return crc ^ 0xffffffff;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type);
  const lengthBuf = Buffer.alloc(4);
  lengthBuf.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0);
  return Buffer.concat([lengthBuf, typeBuf, data, crcBuf]);
}

function createPNG(width, height, getPixel) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);  // bit depth
  ihdrData.writeUInt8(6, 9);  // color type (RGBA)
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);
  
  // IDAT - raw image data with filter bytes
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(width * 4 + 1);
    row[0] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y);
      const idx = 1 + x * 4;
      row[idx] = r;
      row[idx + 1] = g;
      row[idx + 2] = b;
      row[idx + 3] = a;
    }
    rawRows.push(row);
  }
  const rawData = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = createChunk('IDAT', compressed);
  
  // IEND
  const iendChunk = createChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function generateIcon(size) {
  const centerX = size / 2;
  const centerY = size / 2;
  
  return (x, y) => {
    // Green gradient background
    const gradient = (x + y) / (size * 2);
    let r = Math.floor(gradient * 100);
    let g = 255;
    let b = Math.floor((1 - gradient) * 170);
    let a = 255;
    
    // Background circle
    const dx = x - centerX;
    const dy = y - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > size * 0.47) {
      return [0, 0, 0, 0]; // transparent outside circle
    }
    
    // Face circle (black)
    const faceDx = x - centerX;
    const faceDy = y - centerY * 0.9;
    const faceDist = Math.sqrt(faceDx * faceDx + faceDy * faceDy);
    if (faceDist <= size * 0.22) {
      // Inside face - draw features
      
      // Eyes
      const eyeY = centerY * 0.82;
      const eyeOffset = size * 0.08;
      const eyeRadius = size * 0.045;
      const pupilRadius = size * 0.02;
      
      // Left eye
      const leftEyeDx = x - (centerX - eyeOffset);
      const leftEyeDy = y - eyeY;
      const leftEyeDist = Math.sqrt(leftEyeDx * leftEyeDx + leftEyeDy * leftEyeDy);
      
      // Right eye
      const rightEyeDx = x - (centerX + eyeOffset);
      const rightEyeDy = y - eyeY;
      const rightEyeDist = Math.sqrt(rightEyeDx * rightEyeDx + rightEyeDy * rightEyeDy);
      
      if (leftEyeDist <= eyeRadius || rightEyeDist <= eyeRadius) {
        // Eye whites (green)
        r = 0; g = 255; b = 0;
        
        // Pupils (black)
        if (leftEyeDist <= pupilRadius || rightEyeDist <= pupilRadius) {
          r = 0; g = 0; b = 0;
        }
      }
      
      // Mouth (wavy)
      const mouthY = centerY * 1.12;
      const mouthWidth = size * 0.12;
      const mouthDx = x - centerX;
      if (Math.abs(mouthDx) <= mouthWidth) {
        const mouthWave = Math.sin((mouthDx + mouthWidth) / (mouthWidth * 2) * Math.PI) * 3;
        if (Math.abs(y - (mouthY + mouthWave)) <= 2) {
          r = 0; g = 255; b = 0;
        }
      }
      
      return [r, g, b, a];
    }
    
    return [r, g, b, a];
  };
}

// Generate icons
const sizes = [48, 96, 128];

console.log('🎨 Generating Drunk Walker extension icons...\n');

sizes.forEach(size => {
  const png = createPNG(size, size, generateIcon(size));
  const filename = `extension/icons/icon-${size}.png`;
  fs.writeFileSync(filename, png);
  console.log(`✓ Generated ${filename} (${png.length} bytes)`);
});

console.log('\n✅ All icons generated!');
