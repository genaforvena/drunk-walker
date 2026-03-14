/**
 * Build Script - Bundles src/ modules into single bookmarklet.js
 * Simple concatenation approach - no extra dependencies
 */

import fs from 'fs';

const outfile = 'bookmarklet.js';

// Read all source files
const engine = fs.readFileSync('src/core/engine.js', 'utf8');
const handlers = fs.readFileSync('src/input/handlers.js', 'utf8');
const controller = fs.readFileSync('src/ui/controller.js', 'utf8');
const main = fs.readFileSync('src/main.js', 'utf8');

// Remove ES module exports/imports and combine
let bundled = `
// Drunk Walker v3.2-EXP - Bundled Build
// Generated automatically by build.js

(function(){
  if (window.DRUNK_WALKER_ACTIVE) return;
  window.DRUNK_WALKER_ACTIVE = true;

  // === CORE ENGINE ===
  ${engine.replace(/export \{[^}]+\};/g, '').replace(/export const/g, 'const').replace(/export function/g, 'function')}

  // === INPUT HANDLERS ===
  ${handlers.replace(/export \{[^}]+\};/g, '').replace(/export function/g, 'function').replace(/export const/g, 'const')}

  // === UI CONTROLLER ===
  ${controller.replace(/export \{[^}]+\};/g, '').replace(/export function/g, 'function')}

  // === MAIN ENTRY ===
  ${main
    .replace(/import \{[^}]+\} from ['"]\.\/core\/engine\.js['"];?/g, '')
    .replace(/import \{[^}]+\} from ['"]\.\/input\/handlers\.js['"];?/g, '')
    .replace(/import \{[^}]+\} from ['"]\.\/ui\/controller\.js['"];?/g, '')
    .replace(/return;/g, 'return;')
  }
})();
`.trim();

fs.writeFileSync(outfile, bundled);
console.log(`✓ Built ${outfile} (${(bundled.length / 1024).toFixed(1)} KB)`);
