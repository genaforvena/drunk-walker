import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./walk-2026-03-18T13-48-30-343Z.json', 'utf8'));

console.log('=== WALK ANALYSIS ===\n');
console.log('Total steps:', data.length);

// Extract unique locations
const extractLocation = (url) => {
  const m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  return m ? `${m[1]},${m[2]}` : null;
};

const locations = data.map(s => extractLocation(s.url)).filter(Boolean);
const uniqueLocations = new Set(locations);
console.log('Unique locations:', uniqueLocations.size);
console.log('Revisit rate:', ((1 - uniqueLocations.size / locations.length) * 100).toFixed(2) + '%');

// Analyze yaw changes
const yaws = data.map(s => s.currentYaw);
const yawChanges = [];
for (let i = 1; i < yaws.length; i++) {
  if (yaws[i] !== yaws[i-1]) {
    yawChanges.push({ index: i, from: yaws[i-1], to: yaws[i] });
  }
}
console.log('\nYaw change events:', yawChanges.length);

// Analyze yaw distribution
const yawHistogram = {};
yaws.forEach(y => {
  const bucket = Math.floor(y / 30) * 30;
  yawHistogram[bucket] = (yawHistogram[bucket] || 0) + 1;
});
console.log('\nYaw distribution (by 30° buckets):');
Object.entries(yawHistogram).sort((a, b) => a[0] - b[0]).forEach(([yaw, count]) => {
  console.log(`  ${yaw}°-${parseInt(yaw)+30}°: ${count} steps (${(count/data.length*100).toFixed(1)}%)`);
});

// Find consecutive same-location sequences (stuck patterns)
let stuckSequences = [];
let currentSeq = { location: locations[0], count: 1, startIndex: 0 };
for (let i = 1; i < locations.length; i++) {
  if (locations[i] === locations[i-1]) {
    currentSeq.count++;
  } else {
    if (currentSeq.count > 1) stuckSequences.push(currentSeq);
    currentSeq = { location: locations[i], count: 1, startIndex: i };
  }
}
if (currentSeq.count > 1) stuckSequences.push(currentSeq);

console.log('\nStuck sequences (same location, multiple steps):', stuckSequences.length);
const maxStuck = Math.max(...stuckSequences.map(s => s.count));
console.log('Max consecutive stuck:', maxStuck);

// Analyze movement patterns - calculate bearing between points
const coords = locations.map(loc => {
  const [lat, lng] = loc.split(',').map(Number);
  return { lat, lng };
});

// Calculate initial bearings
const bearings = [];
for (let i = 1; i < coords.length; i++) {
  const bearing = calculateBearing(coords[i-1], coords[i]);
  bearings.push(bearing);
}

// Bearing distribution
const bearingHistogram = {};
bearings.forEach(b => {
  const bucket = Math.floor(b / 30) * 30;
  bearingHistogram[bucket] = (bearingHistogram[bucket] || 0) + 1;
});
console.log('\nMovement bearing distribution (actual travel direction):');
Object.entries(bearingHistogram).sort((a, b) => a[0] - b[0]).forEach(([bearing, count]) => {
  console.log(`  ${bearing}°-${parseInt(bearing)+30}°: ${count} steps (${(count/bearings.length*100).toFixed(1)}%)`);
});

// Check for backtracking (180° reversals)
let backtrackCount = 0;
for (let i = 1; i < bearings.length; i++) {
  const diff = Math.abs(bearings[i] - bearings[i-1]);
  const normalizedDiff = diff > 180 ? 360 - diff : diff;
  if (normalizedDiff > 150) {
    backtrackCount++;
  }
}
console.log('\nBacktrack events (180° reversals):', backtrackCount, `(${(backtrackCount/bearings.length*100).toFixed(1)}%)`);

// Calculate total displacement
const firstCoord = coords[0];
const lastCoord = coords[coords.length - 1];
const displacement = calculateDistance(firstCoord, lastCoord);
console.log('\nNet displacement from start:', displacement.toFixed(2), 'meters');
console.log('Total steps:', data.length);
console.log('Efficiency (displacement / steps):', (displacement / data.length).toFixed(4), 'm/step');

// Helper functions
function calculateBearing(from, to) {
  const φ1 = from.lat * Math.PI / 180;
  const φ2 = to.lat * Math.PI / 180;
  const Δλ = (to.lng - from.lng) * Math.PI / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  const bearing = (θ * 180 / Math.PI + 360) % 360;
  return bearing;
}

function calculateDistance(from, to) {
  const R = 6371000; // Earth radius in meters
  const φ1 = from.lat * Math.PI / 180;
  const φ2 = to.lat * Math.PI / 180;
  const Δφ = (to.lat - from.lat) * Math.PI / 180;
  const Δλ = (to.lng - from.lng) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
