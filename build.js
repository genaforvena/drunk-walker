/**
 * Build Script - Creates both regular and console-friendly versions
 */

import fs from 'fs';

const outfile = 'bookmarklet.js';
const consoleFile = 'bookmarklet-console.js';

// Read all source files
const engine = fs.readFileSync('src/core/engine.js', 'utf8');
const handlers = fs.readFileSync('src/input/handlers.js', 'utf8');
const controller = fs.readFileSync('src/ui/controller.js', 'utf8');
const main = fs.readFileSync('src/main.js', 'utf8');

// Regular build (IIFE)
let bundled = `
// Drunk Walker v3.66.6-EXP - Bundled Build
// Generated automatically by build.js
// Paste this entire code into browser console on Google Street View
// NOTE: If you see "Allow pasting?" warning, type: allow pasting

(function(){
  if (window.DRUNK_WALKER_ACTIVE) return;
  window.DRUNK_WALKER_ACTIVE = true;

  // === CORE ENGINE ===
  ${engine
    .replace(/export \{[^}]+\};/g, '')
    .replace(/export const/g, 'const')
    .replace(/export function/g, 'function')
  }

  // === INPUT HANDLERS ===
  ${handlers
    .replace(/export \{[^}]+\};/g, '')
    .replace(/export function/g, 'function')
    .replace(/export const/g, 'const')
  }

  // === UI CONTROLLER ===
  ${controller
    .replace(/export \{[^}]+\};/g, '')
    .replace(/export function/g, 'function')
  }

  // === MAIN ENTRY ===
  ${main
    .replace(/import \{[^}]+\} from ['"]\.\/core\/engine\.js['"];?/g, '')
    .replace(/import \{[^}]+\} from ['"]\.\/input\/handlers\.js['"];?/g, '')
    .replace(/import \{[^}]+\} from ['"]\.\/ui\/controller\.js['"];?/g, '')
  }
})();
`.trim();

// Console-friendly build (no outer IIFE, uses void operator)
let consoleFriendly = `
// Drunk Walker v3.66.6-EXP - CONSOLE VERSION
// This version is optimized for pasting into browser console
// 1. Type: allow pasting
// 2. Paste this code
// 3. Press Enter

void function initDrunkWalker(){
  if (window.DRUNK_WALKER_ACTIVE) {
    console.log('🤪 Drunk Walker already running. Refresh page to restart.');
    return;
  }
  window.DRUNK_WALKER_ACTIVE = true;

  // === CORE ENGINE ===
  ${engine
    .replace(/export \{[^}]+\};/g, '')
    .replace(/export const/g, 'const')
    .replace(/export function/g, 'function')
  }

  // === INPUT HANDLERS ===
  ${handlers
    .replace(/export \{[^}]+\};/g, '')
    .replace(/export function/g, 'function')
    .replace(/export const/g, 'const')
  }

  // === UI CONTROLLER ===
  ${controller
    .replace(/export \{[^}]+\};/g, '')
    .replace(/export function/g, 'function')
  }

  // === MAIN ENTRY ===
  ${main
    .replace(/import \{[^}]+\} from ['"]\.\/core\/engine\.js['"];?/g, '')
    .replace(/import \{[^}]+\} from ['"]\.\/input\/handlers\.js['"];?/g, '')
    .replace(/import \{[^}]+\} from ['"]\.\/ui\/controller\.js['"];?/g, '')
    // Remove the IIFE wrapper from main.js since we're wrapping it ourselves
    .replace(/^\(function\(\) \{/, '')
    .replace(/\}\)\(\);[\s\n]*$/, '')
  }
}();
`.trim();

fs.writeFileSync(outfile, bundled);
fs.writeFileSync(consoleFile, consoleFriendly);

console.log(`✓ Built ${outfile} (${(bundled.length / 1024).toFixed(1)} KB)`);
console.log(`✓ Built ${consoleFile} (${(consoleFriendly.length / 1024).toFixed(1)} KB)`);
console.log(`\n📋 For browser console, use ${consoleFile} - it's more reliable for pasting!`);
