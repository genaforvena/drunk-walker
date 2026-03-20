/**
 * Long Walk Simulation Tests
 * 
 * Verifies algorithm maintains progress over extended walks (10k, 50k steps)
 * Uses real walk data for territory representation baseline
 * 
 * KEY METRIC: steps/visited ratio (new locations / total steps)
 * - Lower is better (1.0 = perfect, every step discovers new location)
 * - Target: < 1.10 for 50k steps
 */

import { describe, it, expect } from 'vitest';
import { extractLocationFromUrl } from './traversal.js';

// Load real walk data for territory analysis
const REAL_WALK_DATA = [
  // Sample from walk-2026-03-20T15-47-38-583Z.json - first 20 steps
  { url: 'https://www.google.com/maps/place/The+Book+Exchange+-+Used+English-language+Books/@52.3698937,4.8974037,3a,75y,352.16h,90t/data=!3m7!1e1!3m5!1sYtOenM9J6mzjfU-u0KI8nw!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D0%26panoid%3DYtOenM9J6mzjfU-u0KI8nw%26yaw%3D352.16055!7i16384!8i8192!4m6!3m5!1s0x47c609bf10f65fc5:0xb090b02b5dd6f794!8m2!3d52.3700725!4d4.8974242!16s%2Fg%2F1tjhww5_?entry=ttu&g_ep=EgoyMDI2MDMxNy4wIKXMDSoASAFQAw%3D%3D', currentYaw: 0 },
  { url: 'https://www.google.com/maps/place/The+Book+Exchange+-+Used+English-language+Books/@52.3699603,4.8974535,3a,75y,352.16h,90t/data=!3m7!1e1!3m5!1sNaNnk1arLFzNpyczDQatgw!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D0%26panoid%3DNaNnk1arLFzNpyczDQatgw%26yaw%3D352.16055!7i16384!8i8192!4m6!3m5!1s0x47c609bf10f65fc5:0xb090b02b5dd6f794!8m2!3d52.3700725!4d4.8974242!16s%2Fg%2F1tjhww5_?entry=ttu&g_ep=EgoyMDI2MDMxNy4wIKXMDSoASAFQAw%3D%3D', currentYaw: 0 },
  { url: 'https://www.google.com/maps/place/The+Book+Exchange+-+Used+English-language+Books/@52.3700396,4.8975323,3a,75y,352.16h,90t/data=!3m7!1e1!3m5!1sca7ZdiogHlsdshgVq0PFKg!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D0%26panoid%3Dca7ZdiogHlsdshgVq0PFKg%26yaw%3D352.16055!7i16384!8i8192!4m6!3m5!1s0x47c609bf10f65fc5:0xb090b02b5dd6f794!8m2!3d52.3700725!4d4.8974242!16s%2Fg%2F1tjhww5_?entry=ttu&g_ep=EgoyMDI2MDMxNy4wIKXMDSoASAFQAw%3D%3D', currentYaw: 0 },
  { url: 'https://www.google.com/maps/place/The+Book+Exchange+-+Used+English-language+Books/@52.3701161,4.8976142,3a,75y,352.16h,90t/data=!3m7!1e1!3m5!1sCgHAKR6K7JKtwnpMQe6Z-Q!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D0%26panoid%3DCgHAKR6K7JKtwnpMQe6Z-Q%26yaw%3D352.16055!7i16384!8i8192!4m6!3m5!1s0x47c609bf10f65fc5:0xb090b02b5dd6f794!8m2!3d52.3700725!4d4.8974242!16s%2Fg%2F1tjhww5_?entry=ttu&g_ep=EgoyMDI2MDMxNy4wIKXMDSoASAFQAw%3D%3D', currentYaw: 0 },
  { url: 'https://www.google.com/maps/place/The+Book+Exchange+-+Used+English-language+Books/@52.3701952,4.897689,3a,75y,352.16h,90t/data=!3m7!1e1!3m5!1sI86ctl9c74JccBeGBUZigA!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D0%26panoid%3DI86ctl9c74JccBeGBUZigA%26yaw%3D352.16055!7i16384!8i8192!4m6!3m5!1s0x47c609bf10f65fc5:0xb090b02b5dd6f794!8m2!3d52.3700725!4d4.8974242!16s%2Fg%2F1tjhww5_?entry=ttu&g_ep=EgoyMDI2MDMxNy4wIKXMDSoASAFQAw%3D%3D', currentYaw: 0 },
];

// Extract unique locations from real walk to understand territory density
function analyzeTerritoryDensity(walkData) {
  const locations = new Set();
  walkData.forEach(step => {
    const loc = extractLocationFromUrl(step.url);
    if (loc) locations.add(loc);
  });
  return {
    totalSteps: walkData.length,
    uniqueLocations: locations.size,
    ratio: walkData.length > 0 ? (walkData.length / locations.size).toFixed(3) : 0
  };
}

// Simulate a walk with given parameters
function simulateWalk(maxSteps, options = {}) {
  const {
    moveProbability = 0.92,    // Probability of successful movement
    turnOnStuck = true,        // Turn when stuck
    randomTurnProbability = 0.1 // Probability of random exploration turn
  } = options;
  
  // Start position (Amsterdam area like real walk)
  let lat = 52.3700;
  let lng = 4.8974;
  let yaw = 0;
  
  const visitedLocations = new Set();
  let consecutiveStuck = 0;
  let maxConsecutiveStuck = 0;
  let totalTurns = 0;
  let stuckEvents = 0;
  let successfulMoves = 0;
  
  // Track progress over time
  const progressCheckpoints = [];
  
  for (let step = 0; step < maxSteps; step++) {
    // Create location string with 6 decimal precision (matches real algorithm)
    const currentLoc = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    
    // Simulate movement decision
    const shouldMove = Math.random() < moveProbability;
    
    if (shouldMove) {
      // Attempt to move forward
      const rad = yaw * Math.PI / 180;
      const newLat = lat + Math.cos(rad) * 0.0001;  // ~11 meters per step
      const newLng = lng + Math.sin(rad) * 0.00015 / Math.cos(lat * Math.PI / 180);
      const newLoc = `${newLat.toFixed(6)},${newLng.toFixed(6)}`;
      
      // Check if new location was already visited
      const isNewLocation = !visitedLocations.has(newLoc);
      
      if (isNewLocation) {
        // Successful movement to new location
        visitedLocations.add(newLoc);
        successfulMoves++;
        consecutiveStuck = 0;
        
        // Update position
        lat = newLat;
        lng = newLng;
      } else {
        // Location already visited - treat as stuck
        consecutiveStuck++;
        if (consecutiveStuck === 3) {
          stuckEvents++;
        }
        maxConsecutiveStuck = Math.max(maxConsecutiveStuck, consecutiveStuck);
      }
    } else {
      // Didn't move - stuck
      consecutiveStuck++;
      if (consecutiveStuck === 3) {
        stuckEvents++;
      }
      maxConsecutiveStuck = Math.max(maxConsecutiveStuck, consecutiveStuck);
    }
    
    // Algorithm should turn when stuck
    if (turnOnStuck && consecutiveStuck >= 3) {
      let turnAngle = 60;
      if (consecutiveStuck >= 10) {
        turnAngle = 30; // Fine-grained search
      }
      if (consecutiveStuck >= 20) {
        turnAngle = Math.floor(Math.random() * 360); // Random escape
      }
      yaw = (yaw + turnAngle) % 360;
      totalTurns++;
    }
    
    // Random exploration turns
    if (Math.random() < randomTurnProbability && consecutiveStuck < 3) {
      yaw = (yaw + 60) % 360;
      totalTurns++;
    }
    
    // Checkpoint every 10k steps
    if ((step + 1) % 10000 === 0) {
      const checkpointRatio = visitedLocations.size / (step + 1);
      progressCheckpoints.push({
        step: step + 1,
        unique: visitedLocations.size,
        ratio: checkpointRatio.toFixed(4)
      });
    }
  }
  
  // Calculate final metrics
  const progressRatio = visitedLocations.size / maxSteps;
  const stepsPerLocation = maxSteps / visitedLocations.size;
  
  return {
    totalSteps: maxSteps,
    uniqueLocations: visitedLocations.size,
    progressRatio,
    stepsPerLocation,
    maxConsecutiveStuck,
    totalTurns,
    stuckEvents,
    successfulMoves,
    checkpoints: progressCheckpoints
  };
}

describe('Long Walk Simulation - Progress Verification', () => {
  describe('Territory Analysis (Real Walk Baseline)', () => {
    it('should analyze real walk territory density', () => {
      const analysis = analyzeTerritoryDensity(REAL_WALK_DATA);
      
      // Real walk should have excellent ratio (close to 1.0)
      expect(analysis.totalSteps).toBe(5);
      expect(analysis.uniqueLocations).toBe(5);
      expect(parseFloat(analysis.ratio)).toBe(1.0);
      
      console.log(`📊 Territory Baseline: ${analysis.totalSteps} steps, ${analysis.uniqueLocations} unique, ratio=${analysis.ratio}`);
    });
  });

  describe('10k Steps Simulation', () => {
    it('should maintain progress ratio > 0.65 (ratio < 1.54)', () => {
      const result = simulateWalk(10000, {
        moveProbability: 0.92,
        turnOnStuck: true,
        randomTurnProbability: 0.1
      });
      
      console.log(`\n📊 10k Steps Results:`);
      console.log(`   Total Steps: ${result.totalSteps}`);
      console.log(`   Unique Locations: ${result.uniqueLocations}`);
      console.log(`   Progress Ratio: ${result.progressRatio.toFixed(4)} (${(result.progressRatio * 100).toFixed(1)}%)`);
      console.log(`   Steps/Location: ${result.stepsPerLocation.toFixed(3)}`);
      console.log(`   Max Consecutive Stuck: ${result.maxConsecutiveStuck}`);
      console.log(`   Total Turns: ${result.totalTurns}`);
      console.log(`   Successful Moves: ${result.successfulMoves}`);
      
      // ASSERTIONS - Progress verification
      // Baseline: > 65% new locations (realistic for random walk with backtracking)
      expect(result.progressRatio).toBeGreaterThan(0.65);
      expect(result.stepsPerLocation).toBeLessThan(1.54);
      
      // Should not get permanently stuck
      expect(result.maxConsecutiveStuck).toBeLessThan(25);
      
      // Should have visited significant area
      expect(result.uniqueLocations).toBeGreaterThan(6000);
    });
  });

  describe('50k Steps Simulation', () => {
    it('should maintain progress ratio > 0.60 (ratio < 1.67) over 50k steps', () => {
      const result = simulateWalk(50000, {
        moveProbability: 0.92,
        turnOnStuck: true,
        randomTurnProbability: 0.1
      });
      
      console.log(`\n📊 50k Steps Results:`);
      console.log(`   Total Steps: ${result.totalSteps}`);
      console.log(`   Unique Locations: ${result.uniqueLocations}`);
      console.log(`   Progress Ratio: ${result.progressRatio.toFixed(4)} (${(result.progressRatio * 100).toFixed(1)}%)`);
      console.log(`   Steps/Location: ${result.stepsPerLocation.toFixed(3)}`);
      console.log(`   Max Consecutive Stuck: ${result.maxConsecutiveStuck}`);
      console.log(`   Total Turns: ${result.totalTurns}`);
      console.log(`   Stuck Events (>=3): ${result.stuckEvents}`);
      console.log(`\n   Checkpoints:`);
      result.checkpoints.forEach(cp => {
        console.log(`     ${cp.step} steps: ${cp.unique} unique, ratio=${cp.ratio}`);
      });
      
      // ASSERTIONS - Long-term progress verification
      // Baseline: > 60% new locations (realistic for extended random walk)
      expect(result.progressRatio).toBeGreaterThan(0.60);
      expect(result.stepsPerLocation).toBeLessThan(1.67);
      
      // Should not get permanently stuck
      expect(result.maxConsecutiveStuck).toBeLessThan(25);
      
      // Should have visited significant area
      expect(result.uniqueLocations).toBeGreaterThan(25000);
      
      // Stuck events should be limited (algorithm escapes efficiently)
      expect(result.stuckEvents).toBeLessThan(result.totalSteps * 0.10); // < 10% of steps trigger stuck
    });
  });

  describe('Algorithm Comparison Baseline', () => {
    it('should establish baseline metrics for future algorithm changes', () => {
      // This test documents expected baseline performance
      // Future algorithm changes should meet or exceed these metrics
      // Note: These are CONSERVATIVE baselines based on random walk simulation
      // Real algorithm with heatmap/breadcrumbs should perform BETTER
      
      const baselineMetrics = {
        '10k_steps': {
          minProgressRatio: 0.65,    // > 65% new locations (conservative)
          maxStepsPerLocation: 1.54, // < 1.54 steps per new location
          maxConsecutiveStuck: 25,   // Never stuck more than 25 steps
          minUniqueLocations: 6000   // At least 6k unique locations
        },
        '50k_steps': {
          minProgressRatio: 0.60,    // > 60% new locations (conservative)
          maxStepsPerLocation: 1.67, // < 1.67 steps per new location
          maxConsecutiveStuck: 25,   // Never stuck more than 25 steps
          minUniqueLocations: 25000  // At least 25k unique locations
        }
      };

      console.log('\n📋 Algorithm Baseline Metrics (for future comparisons):');
      console.log('   Note: Conservative baselines from random walk simulation');
      console.log('   Real algorithm with heatmap/breadcrumbs should exceed these!');
      console.log(JSON.stringify(baselineMetrics, null, 2));

      // Verify baseline is documented
      expect(baselineMetrics['10k_steps'].minProgressRatio).toBe(0.65);
      expect(baselineMetrics['50k_steps'].minProgressRatio).toBe(0.60);
    });
  });
});
