#!/usr/bin/env node
/**
 * Walk Analysis Tool
 * 
 * Analyzes walk JSON files and generates visualizations and statistics
 * 
 * Usage: node scripts/analyze-walk.js [walk-file.json]
 * 
 * If no file specified, defaults to most recent walk in walks/ directory
 */

import fs from 'fs';
import path from 'path';

/**
 * Extract location from walk step URL
 */
function extractLocation(url) {
  const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  return match ? `${match[1]},${match[2]}` : null;
}

/**
 * Extract yaw from walk step URL
 */
function extractYaw(url) {
  const match = url.match(/yaw%3D([0-9.]+)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Analyze a single walk file
 */
function analyzeWalk(filePath, verbose = true) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const fileName = path.basename(filePath);
  
  const output = [];
  const log = (msg) => {
    output.push(msg);
    if (verbose) console.log(msg);
  };
  
  log('='.repeat(70));
  log(`WALK ANALYSIS: ${fileName}`);
  log('='.repeat(70));
  
  // Basic statistics
  const locationSteps = new Map();
  const yawDrifts = [];
  
  data.forEach((step, index) => {
    const loc = extractLocation(step.url);
    const urlYaw = extractYaw(step.url);
    
    if (loc) {
      if (!locationSteps.has(loc)) locationSteps.set(loc, []);
      locationSteps.get(loc).push(index);
    }
    
    if (urlYaw !== null && step.currentYaw !== undefined) {
      yawDrifts.push({
        step: index,
        currentYaw: step.currentYaw,
        urlYaw,
        drift: Math.abs(step.currentYaw - urlYaw)
      });
    }
  });
  
  const uniqueLocations = locationSteps.size;
  const ratio = data.length / uniqueLocations;
  
  log(`Total steps:        ${data.length}`);
  log(`Unique locations:   ${uniqueLocations}`);
  log(`Steps/Location:     ${ratio.toFixed(3)}`);
  log('');
  
  // Stuck analysis
  log('-'.repeat(70));
  log('STUCK ANALYSIS');
  log('-'.repeat(70));
  
  const stuckThreshold = 5;
  const stuckEvents = [];
  let currentStuck = { loc: null, start: 0, count: 0 };
  
  data.forEach((step, index) => {
    const loc = step.url.split('data=')[0];
    
    if (loc === currentStuck.loc) {
      currentStuck.count++;
    } else {
      if (currentStuck.count >= stuckThreshold) {
        stuckEvents.push({ ...currentStuck });
      }
      currentStuck = { loc, start: index, count: 1 };
    }
  });
  
  if (currentStuck.count >= stuckThreshold) {
    stuckEvents.push({ ...currentStuck });
  }
  
  log(`Stuck events (≥${stuckThreshold} steps): ${stuckEvents.length}`);
  stuckEvents.slice(0, 5).forEach((event, i) => {
    log(`  ${i + 1}. Steps ${event.start}-${event.start + event.count - 1} (${event.count} steps)`);
  });
  log('');
  
  // Orientation drift analysis
  log('-'.repeat(70));
  log('ORIENTATION DRIFT');
  log('-'.repeat(70));
  
  if (yawDrifts.length > 0) {
    const samples = [0, 0.25, 0.5, 0.75, 1.0].map(p => 
      yawDrifts[Math.floor((yawDrifts.length - 1) * p)]
    );
    
    const avgDriftVal = yawDrifts.reduce((sum, d) => sum + d.drift, 0) / yawDrifts.length;
    const maxDriftVal = Math.max(...yawDrifts.map(d => d.drift));
    
    log(`Average drift: ${avgDriftVal.toFixed(2)}°`);
    log(`Maximum drift: ${maxDriftVal.toFixed(2)}°`);
    log('');
    log('Sample points:');
    samples.forEach(s => {
      log(`  Step ${s.step.toString().padStart(5)}: current=${s.currentYaw.toFixed(0)}°, url=${s.urlYaw.toFixed(1)}°, drift=${s.drift.toFixed(1)}°`);
    });
  }
  log('');
  
  // Territory visualization
  log('-'.repeat(70));
  log('TERRITORY MAP');
  log('-'.repeat(70));
  
  const coords = Array.from(locationSteps.keys()).map(loc => {
    const [lat, lng] = loc.split(',').map(Number);
    return { lat, lng, loc, visits: locationSteps.get(loc).length };
  });
  
  if (coords.length > 0) {
    const minLat = Math.min(...coords.map(c => c.lat));
    const maxLat = Math.max(...coords.map(c => c.lat));
    const minLng = Math.min(...coords.map(c => c.lng));
    const maxLng = Math.max(...coords.map(c => c.lng));
    
    const gridWidth = 70;
    const gridHeight = 28;
    const grid = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(' '));
    
    coords.forEach(coord => {
      const x = Math.floor((coord.lng - minLng) / (maxLng - minLng || 1) * (gridWidth - 1));
      const y = Math.floor((coord.lat - minLat) / (maxLat - minLat || 1) * (gridHeight - 1));
      
      let char = '·';
      if (coord.visits > 20) char = '█';
      else if (coord.visits > 10) char = '▓';
      else if (coord.visits > 5) char = '▒';
      else if (coord.visits > 2) char = '░';
      
      if (y >= 0 && y < gridHeight && x >= 0 && x < gridWidth) {
        grid[gridHeight - 1 - y][x] = char;
      }
    });
    
    log('Density: · (1-2) < ░ (3-5) < ▒ (6-10) < ▓ (11-20) < █ (>20)');
    log('');
    grid.forEach(row => log('| ' + row.join('')));
    log('');
    
    const heightM = (maxLat - minLat) * 111000;
    const widthM = (maxLng - minLng) * 111000 * Math.cos(minLat * Math.PI / 180);
    log(`Bounding box: ${heightM.toFixed(0)}m × ${widthM.toFixed(0)}m`);
  }
  log('');
  
  // Graph analysis
  log('-'.repeat(70));
  log('TERRITORY GRAPH');
  log('-'.repeat(70));
  
  const adjacency = new Map();
  for (let i = 0; i < data.length - 1; i++) {
    const url1 = data[i].url.split('data=')[0];
    const url2 = data[i + 1].url.split('data=')[0];
    
    if (url1 !== url2) {
      if (!adjacency.has(url1)) adjacency.set(url1, new Set());
      if (!adjacency.has(url2)) adjacency.set(url2, new Set());
      adjacency.get(url1).add(url2);
      adjacency.get(url2).add(url1);
    }
  }
  
  const degrees = Array.from(adjacency.entries())
    .map(([loc, neighbors]) => ({ loc, degree: neighbors.size }))
    .sort((a, b) => b.degree - a.degree);
  
  const totalEdges = Array.from(adjacency.values()).reduce((sum, n) => sum + n.size, 0) / 2;
  const avgDegree = adjacency.size > 0 ? totalEdges * 2 / adjacency.size : 0;
  
  log(`Nodes:      ${adjacency.size}`);
  log(`Edges:      ${totalEdges}`);
  log(`Avg degree: ${avgDegree.toFixed(2)}`);
  log('');
  
  if (degrees.length > 0) {
    log('Most connected nodes:');
    degrees.slice(0, 5).forEach((node, i) => {
      const shortLoc = node.loc.substring(0, 50);
      log(`  ${i + 1}. ${shortLoc}... (${node.degree} connections)`);
    });
  }
  log('');
  
  // Progress over time
  log('-'.repeat(70));
  log('PROGRESS OVER TIME');
  log('-'.repeat(70));
  
  const seen = new Set();
  const checkpoints = [0.1, 0.25, 0.5, 0.75, 1.0];
  let lastIdx = 0;
  
  checkpoints.forEach(cp => {
    const idx = Math.floor(data.length * cp);
    for (let i = lastIdx; i < idx; i++) {
      const loc = extractLocation(data[i].url);
      if (loc) seen.add(loc);
    }
    lastIdx = idx;
    
    const ratio = seen.size / idx;
    log(`${(cp * 100).toFixed(0)}%: ${seen.size.toString().padStart(5)} unique / ${idx.toString().padStart(5)} steps = ${ratio.toFixed(3)} ratio`);
  });
  log('');
  
  // Summary
  log('='.repeat(70));
  log('SUMMARY');
  log('='.repeat(70));
  
  const isOrientationOk = yawDrifts.length > 0 && yawDrifts[yawDrifts.length - 1]?.drift < 5;
  const isRatioOk = ratio < 2.0;
  const isGraphLinear = avgDegree < 2.5;
  
  log(`Orientation fix:  ${isOrientationOk ? '✅ WORKING' : '❌ DRIFT DETECTED'}`);
  log(`Progress ratio:   ${isRatioOk ? '✅ GOOD' : '❌ RETRACING'}`);
  log(`Graph structure:  ${isGraphLinear ? '⚠️  LINEAR TRAP' : '✅ GRID'}`);
  log('');
  
  if (!isRatioOk && isGraphLinear) {
    log('🔍 DIAGNOSIS: Linear territory trap - walker bouncing on single street');
    log('💡 RECOMMENDATION: Implement entropy-based exploration');
  } else if (!isOrientationOk) {
    log('🔍 DIAGNOSIS: Orientation drift - internal yaw diverging from reality');
    log('💡 RECOMMENDATION: Check orientation recalibration in engine.js');
  } else {
    log('🔍 DIAGNOSIS: Walk appears healthy');
  }
  
  return {
    fileName,
    totalSteps: data.length,
    uniqueLocations,
    ratio,
    stuckEvents,
    avgDrift: yawDrifts.length > 0 ? avgDriftVal : null,
    maxDrift: yawDrifts.length > 0 ? maxDriftVal : null,
    avgDegree,
    isOrientationOk,
    isRatioOk,
    isGraphLinear
  };
}

/**
 * Analyze all walks in directory
 */
function analyzeAllWalks(dir = './walks') {
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();
  
  console.log(`Found ${files.length} walk files\n`);
  
  const results = [];
  files.forEach(file => {
    try {
      const result = analyzeWalk(path.join(dir, file), false);
      results.push(result);
      
      console.log(`${file}:`);
      console.log(`  Steps: ${result.totalSteps}, Unique: ${result.uniqueLocations}, Ratio: ${result.ratio.toFixed(3)}`);
      console.log(`  Drift: ${result.avgDrift?.toFixed(1) || 'N/A'}°, Graph: ${result.avgDegree.toFixed(2)}`);
      console.log(`  Status: ${result.isOrientationOk ? '✅' : '❌'} ${result.isRatioOk ? '✅' : '❌'} ${result.isGraphLinear ? '⚠️' : '✅'}`);
      console.log('');
    } catch (e) {
      console.error(`Error analyzing ${file}:`, e.message);
    }
  });
  
  return results;
}

// Main execution
const arg = process.argv[2];

if (arg === '--all') {
  analyzeAllWalks();
} else if (arg === '--help' || arg === '-h') {
  console.log('Walk Analysis Tool');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/analyze-walk.js [file.json]    Analyze specific walk');
  console.log('  node scripts/analyze-walk.js --all          Analyze all walks');
  console.log('  node scripts/analyze-walk.js --help         Show this help');
  console.log('');
  console.log('Output:');
  console.log('  - Territory visualization (ASCII map)');
  console.log('  - Orientation drift analysis');
  console.log('  - Graph connectivity metrics');
  console.log('  - Progress over time');
  console.log('  - Diagnosis and recommendations');
} else {
  const file = arg || './walks/walk-2026-03-20T17-41-15-205Z.json';
  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }
  analyzeWalk(file);
}
