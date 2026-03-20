/**
 * Analyze transition graph and yaw relationships from walk data
 */

import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./walks/walk-2026-03-20T18-22-18-128Z.json', 'utf8'));

function extractInfo(url) {
  const locMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const yawMatch = url.match(/yaw%3D([0-9.]+)/);
  return {
    loc: locMatch ? `${locMatch[1]},${locMatch[2]}` : null,
    yaw: yawMatch ? parseFloat(yawMatch[1]) : null
  };
}

const transitions = new Map();
const connections = new Map();

for (let i = 0; i < data.length - 1; i++) {
  const from = extractInfo(data[i].url);
  const to = extractInfo(data[i + 1].url);
  
  if (from.loc && to.loc && from.loc !== to.loc) {
    const key = `${from.loc}->${to.loc}`;
    if (!transitions.has(key)) transitions.set(key, []);
    transitions.get(key).push({ fromYaw: from.yaw, toYaw: to.yaw });
    
    if (!connections.has(from.loc)) connections.set(from.loc, new Set());
    if (!connections.has(to.loc)) connections.set(to.loc, new Set());
    connections.get(from.loc).add(to.loc);
    connections.get(to.loc).add(from.loc);
  }
}

console.log('=== TRANSITION ANALYSIS ===');
console.log('Total unique transitions:', transitions.size);
console.log('Total unique locations:', connections.size);

// Find bidirectional transitions
let bidirectional = 0;
const yawDeltas = [];

for (const [key, vals] of transitions) {
  const [from, to] = key.split('->');
  const reverseKey = `${to}->${from}`;
  
  if (transitions.has(reverseKey)) {
    bidirectional++;
    const forwardYaw = vals[0]?.fromYaw;
    const reverseYaw = transitions.get(reverseKey)[0]?.fromYaw;
    
    if (forwardYaw !== null && reverseYaw !== null) {
      let delta = Math.abs(forwardYaw - reverseYaw);
      if (delta > 180) delta = 360 - delta;
      yawDeltas.push(delta);
    }
  }
}

console.log('Bidirectional pairs:', bidirectional);
console.log('');

if (yawDeltas.length > 0) {
  const avg = yawDeltas.reduce((a,b) => a+b, 0) / yawDeltas.length;
  console.log('=== YAW DELTA (A->B vs B->A) ===');
  console.log('Average:', avg.toFixed(1) + '°');
  console.log('Expected: ~180° for opposite directions');
  console.log('');
  
  // Show distribution
  const buckets = { '150-170': 0, '170-180': 0, '180-190': 0, '190-210': 0, 'other': 0 };
  yawDeltas.forEach(d => {
    if (d >= 150 && d < 170) buckets['150-170']++;
    else if (d >= 170 && d < 180) buckets['170-180']++;
    else if (d >= 180 && d < 190) buckets['180-190']++;
    else if (d >= 190 && d < 210) buckets['190-210']++;
    else buckets.other++;
  });
  console.log('Distribution:', JSON.stringify(buckets, null, 2));
}

console.log('');
console.log('=== SAMPLE TRANSITIONS ===');
let count = 0;
for (const [key, vals] of transitions) {
  if (count >= 10) break;
  const [from, to] = key.split('->');
  const shortFrom = from.split(',').map(n => parseFloat(n).toFixed(4)).join(',');
  const shortTo = to.split(',').map(n => parseFloat(n).toFixed(4)).join(',');
  console.log(`${shortFrom} -> ${shortTo}`);
  console.log(`  Yaw: ${vals[0]?.fromYaw?.toFixed(1)}° -> ${vals[0]?.toYaw?.toFixed(1)}°`);
  count++;
}

// Calculate graph degree
console.log('');
console.log('=== GRAPH STRUCTURE ===');
const degrees = Array.from(connections.values()).map(n => n.size);
const avgDegree = degrees.reduce((a,b) => a+b, 0) / degrees.length;
console.log('Avg connections per node:', avgDegree.toFixed(2));
console.log('Linear (degree=2):', degrees.filter(d => d === 2).length);
console.log('Branching (degree>2):', degrees.filter(d => d > 2).length);
