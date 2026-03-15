/**
 * Drunk Walker - Path Merge Utility
 * 
 * Merges multiple walk path JSON exports from different sessions
 * into a single unified path file.
 * 
 * Usage (Node.js):
 *   node merge-paths.js path1.json path2.json path3.json > merged.json
 * 
 * Usage (Browser Console):
 *   Paste this file content, then call:
 *   mergePaths([path1, path2, path3])
 * 
 * @param {Array} paths - Array of walk path arrays
 * @returns {Array} Merged and deduplicated walk path
 */

// Deduplicate paths by URL (keep first occurrence)
function deduplicatePaths(paths) {
  const seen = new Set();
  const result = [];
  
  for (const step of paths) {
    if (!seen.has(step.url)) {
      seen.add(step.url);
      result.push(step);
    }
  }
  
  return result;
}

// Merge multiple walk paths
function mergePaths(pathArrays) {
  if (!Array.isArray(pathArrays) || pathArrays.length === 0) {
    console.error('❌ mergePaths: Please provide an array of path arrays');
    return [];
  }
  
  // Flatten all paths into single array
  const allSteps = pathArrays.flat();
  
  // Validate structure
  for (const step of allSteps) {
    if (!step.url || typeof step.url !== 'string') {
      console.warn('⚠️  Invalid step detected:', step);
    }
  }
  
  // Sort by URL for better organization (optional)
  allSteps.sort((a, b) => a.url.localeCompare(b.url));
  
  // Deduplicate
  const merged = deduplicatePaths(allSteps);
  
  console.log(`🤪 DRUNK WALKER Path Merge:`);
  console.log(`   Input: ${pathArrays.length} sessions`);
  console.log(`   Total steps: ${allSteps.length}`);
  console.log(`   Unique nodes: ${merged.length}`);
  console.log(`   Deduplicated: ${allSteps.length - merged.length} steps`);
  
  return merged;
}

// Load JSON file (Node.js only)
function loadJsonFile(filePath) {
  if (typeof require !== 'undefined') {
    const fs = require('fs');
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  }
  throw new Error('loadJsonFile is only available in Node.js');
}

// CLI mode (Node.js)
if (typeof process !== 'undefined' && process.argv) {
  const args = process.argv.slice(2);
  
  if (args.length > 0 && args[0] !== '--help') {
    // Running as CLI: node merge-paths.js file1.json file2.json ...
    try {
      const paths = args.map(filePath => {
        console.error(`📂 Loading: ${filePath}`);
        return loadJsonFile(filePath);
      });
      
      const merged = mergePaths(paths);
      
      // Output as formatted JSON
      console.log(JSON.stringify(merged, null, 2));
      
      console.error(`\n✅ Merged ${paths.length} sessions into ${merged.length} unique nodes`);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }
}

// Export for browser/module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mergePaths, deduplicatePaths, loadJsonFile };
}

// Browser global
if (typeof window !== 'undefined') {
  window.DRUNK_WALKER_MERGE = { mergePaths, deduplicatePaths };
}
