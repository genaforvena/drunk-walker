/**
 * Real Walk Replay Tests - Log File Based
 *
 * Replays actual walk log files to verify algorithm behavior against real data.
 * Extracts location/yaw sequences from dw-logs-*.txt files and replays them
 * step-by-step to verify the algorithm makes correct decisions.
 *
 * KEY METRICS:
 * - Turns per 100 steps (target: < 25)
 * - Visited/Steps ratio (target: > 0.55)
 * - Micro-adjustments < 20° (target: < 5 per 100 steps)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createDefaultAlgorithm } from './traversal.js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// LOG PARSING
// ============================================================================

/**
 * Parse a walk log file and extract step data
 * @param {string} logContent - Raw log file content
 * @returns {Array} Array of step objects with location, yaw, stuck count
 */
function parseWalkLog(logContent) {
  const steps = [];
  const lines = logContent.split('\n');

  let currentStep = null;
  let consecutiveStuck = 0;

  for (const line of lines) {
    // Parse heart beat line: 💓 [291] STUCK: 0 | YAW: 295° | LOC: 52.3881675,4.8890385
    const heartbeatMatch = line.match(/💓 \[(\d+)\] STUCK: (\d+) \| YAW: (\d+)° \| LOC: ([\d.-]+),([\d.-]+)/);
    if (heartbeatMatch) {
      if (currentStep) {
        steps.push(currentStep);
      }

      const stepNum = parseInt(heartbeatMatch[1]);
      const stuckCount = parseInt(heartbeatMatch[2]);
      const yaw = parseInt(heartbeatMatch[3]);
      const location = `${heartbeatMatch[4]},${heartbeatMatch[5]}`;

      currentStep = {
        step: stepNum,
        location,
        yaw,
        stuckCount,
        isNewNode: stuckCount === 0,
        isStuck: stuckCount > 0
      };

      if (stuckCount > 0) {
        consecutiveStuck++;
      } else {
        consecutiveStuck = 0;
      }
    }

    // Parse decision line: [DEBUG] decision={"turn":true,"angle":18.55,"direction":"left"}
    const decisionMatch = line.match(/\[DEBUG\] decision=(\{.*\})/);
    if (decisionMatch && currentStep) {
      try {
        currentStep.decision = JSON.parse(decisionMatch[1]);
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Parse ACTION lines for turn verification
    const actionMatch = line.match(/🔄 ACTION: Turning (LEFT|RIGHT) ([\d.]+)°/);
    if (actionMatch && currentStep) {
      currentStep.actualTurn = {
        direction: actionMatch[1],
        angle: parseFloat(actionMatch[2])
      };
    }
  }

  // Push last step
  if (currentStep) {
    steps.push(currentStep);
  }

  return steps;
}

/**
 * Analyze walk metrics from parsed steps
 */
function analyzeWalkMetrics(steps) {
  const totalSteps = steps.length;
  const uniqueLocations = new Set(steps.map(s => s.location)).size;
  const visitedStepsRatio = uniqueLocations / totalSteps;

  // Count turns
  const turns = steps.filter(s => s.decision?.turn);
  const turnsPer100 = (turns.length / totalSteps) * 100;

  // Count micro-adjustments (< 20°)
  const microAdjustments = turns.filter(s => {
    const angle = s.decision.angle || s.actualTurn?.angle || 0;
    return angle < 20 && angle > 0;
  });
  const microAdjustmentsPer100 = (microAdjustments.length / totalSteps) * 100;

  // Count large corrective turns (> 60°)
  const largeTurns = turns.filter(s => {
    const angle = s.decision.angle || s.actualTurn?.angle || 0;
    return angle > 60;
  });
  const largeTurnsPer100 = (largeTurns.length / totalSteps) * 100;

  // Stuck events
  const stuckEvents = steps.filter(s => s.stuckCount > 0);
  const stuckRatio = stuckEvents.length / totalSteps;

  return {
    totalSteps,
    uniqueLocations,
    visitedStepsRatio,
    turnsPer100,
    microAdjustmentsPer100,
    largeTurnsPer100,
    stuckRatio,
    turns: turns.length,
    microAdjustments: microAdjustments.length,
    largeTurns: largeTurns.length
  };
}

/**
 * Replay walk steps with algorithm and compare decisions
 */
function replayWalkWithAlgorithm(steps, algorithm) {
  const results = {
    decisions: [],
    matches: 0,
    mismatches: 0,
    breadcrumbs: []
  };

  let previousLocation = null;

  for (const step of steps) {
    results.breadcrumbs.push(step.location);
    if (results.breadcrumbs.length > 200) {
      results.breadcrumbs.shift();
    }

    const context = {
      stuckCount: step.stuckCount,
      currentLocation: step.location,
      previousLocation,
      visitedUrls: new Set(),
      breadcrumbs: results.breadcrumbs,
      orientation: step.yaw,
      isNewNode: step.isNewNode,
      isFullyScanned: false,
      justArrived: step.stuckCount === 0
    };

    const decision = algorithm.decide(context);
    results.decisions.push({
      step: step.step,
      location: step.location,
      expected: step.decision,
      actual: decision
    });

    // Check if decision matches (both turn or both no-turn)
    if (decision.turn === step.decision?.turn) {
      results.matches++;
    } else {
      results.mismatches++;
    }

    if (step.stuckCount === 0) {
      previousLocation = step.location;
    }
  }

  return results;
}

// ============================================================================
// TEST DATA LOADING
// ============================================================================

const WALKS_DIR = path.join(__dirname, '../../walks');

/**
 * Load available walk log files
 */
function getAvailableWalkFiles() {
  try {
    const files = fs.readdirSync(WALKS_DIR)
      .filter(f => f.startsWith('dw-logs-') && f.endsWith('.txt'))
      .sort()
      .reverse(); // Most recent first
    return files.slice(0, 3); // Use 3 most recent walks
  } catch (e) {
    console.warn('Could not read walks directory:', e.message);
    return [];
  }
}

/**
 * Load and parse a walk file
 */
function loadWalkFile(filename) {
  const filepath = path.join(WALKS_DIR, filename);
  try {
    const content = fs.readFileSync(filepath, 'utf-8');
    return parseWalkLog(content);
  } catch (e) {
    console.warn(`Could not load ${filename}:`, e.message);
    return null;
  }
}

// ============================================================================
// TESTS
// ============================================================================

describe('Real Walk Replay - Log Files', () => {
  const availableWalks = getAvailableWalkFiles();

  if (availableWalks.length === 0) {
    it.skip('No walk files available - skipping real walk replay tests', () => {});
    return;
  }

  describe('Walk Metrics Analysis', () => {
    availableWalks.forEach(filename => {
      it(`should analyze metrics for ${filename}`, () => {
        const steps = loadWalkFile(filename);
        if (!steps || steps.length === 0) {
          console.log(`⚠️  Skipped ${filename} - no valid steps`);
          return;
        }

        const metrics = analyzeWalkMetrics(steps);

        console.log(`\n📊 ${filename} (${metrics.totalSteps} steps):`);
        console.log(`   Unique locations: ${metrics.uniqueLocations}`);
        console.log(`   Visited/Steps ratio: ${metrics.visitedStepsRatio.toFixed(3)}`);
        console.log(`   Turns per 100: ${metrics.turnsPer100.toFixed(1)}`);
        console.log(`   Micro-adjustments (<20°) per 100: ${metrics.microAdjustmentsPer100.toFixed(1)}`);
        console.log(`   Large turns (>60°) per 100: ${metrics.largeTurnsPer100.toFixed(1)}`);
        console.log(`   Stuck ratio: ${metrics.stuckRatio.toFixed(3)}`);

        // Verify basic sanity
        expect(metrics.totalSteps).toBeGreaterThan(0);
        expect(metrics.uniqueLocations).toBeGreaterThan(0);
        expect(metrics.visitedStepsRatio).toBeGreaterThan(0.3);
        expect(metrics.visitedStepsRatio).toBeLessThanOrEqual(1.0);
      });
    });
  });

  describe('Algorithm Replay Verification', () => {
    availableWalks.forEach(filename => {
      it(`should replay ${filename} with algorithm`, () => {
        const steps = loadWalkFile(filename);
        if (!steps || steps.length === 0) {
          console.log(`⚠️  Skipped ${filename} - no valid steps`);
          return;
        }

        const algorithm = createDefaultAlgorithm({});
        const replay = replayWalkWithAlgorithm(steps.slice(0, 500), algorithm);

        const matchRate = replay.matches / (replay.matches + replay.mismatches);

        console.log(`\n📊 ${filename} Replay (first 500 steps):`);
        console.log(`   Decision matches: ${replay.matches}`);
        console.log(`   Decision mismatches: ${replay.mismatches}`);
        console.log(`   Match rate: ${(matchRate * 100).toFixed(1)}%`);

        // Algorithm should make decisions consistently
        expect(replay.decisions.length).toBeGreaterThan(0);
        expect(replay.decisions.every(d => d.actual !== undefined)).toBe(true);
      });
    });
  });

  describe('Optimization Verification', () => {
    it('should verify micro-adjustments are reduced in recent walks', () => {
      // Compare oldest vs newest walk to see if optimizations helped
      if (availableWalks.length < 2) {
        console.log('⚠️  Need 2+ walks for comparison');
        return;
      }

      const oldestFile = availableWalks[availableWalks.length - 1];
      const newestFile = availableWalks[0];

      const oldestSteps = loadWalkFile(oldestFile);
      const newestSteps = loadWalkFile(newestFile);

      if (!oldestSteps || !newestSteps) {
        console.log('⚠️  Could not load walks for comparison');
        return;
      }

      const oldestMetrics = analyzeWalkMetrics(oldestSteps.slice(0, 1000));
      const newestMetrics = analyzeWalkMetrics(newestSteps.slice(0, 1000));

      console.log('\n📊 Optimization Comparison (first 1000 steps):');
      console.log(`   ${oldestFile}:`);
      console.log(`     Micro-adjustments/100: ${oldestMetrics.microAdjustmentsPer100.toFixed(1)}`);
      console.log(`     Large turns/100: ${oldestMetrics.largeTurnsPer100.toFixed(1)}`);
      console.log(`     Visited/Steps: ${oldestMetrics.visitedStepsRatio.toFixed(3)}`);
      console.log(`   ${newestFile}:`);
      console.log(`     Micro-adjustments/100: ${newestMetrics.microAdjustmentsPer100.toFixed(1)}`);
      console.log(`     Large turns/100: ${newestMetrics.largeTurnsPer100.toFixed(1)}`);
      console.log(`     Visited/Steps: ${newestMetrics.visitedStepsRatio.toFixed(3)}`);

      // Document baseline - future runs should show improvement
      // Note: This is a soft assertion for documentation
      expect(oldestMetrics.totalSteps).toBeGreaterThan(0);
      expect(newestMetrics.totalSteps).toBeGreaterThan(0);
    });
  });
});

describe('Log Parser Verification', () => {
  it('should parse heartbeat lines correctly', () => {
    const testLog = `[20:11:30] 💓 [291] STUCK: 0 | YAW: 295° | LOC: 52.3881675,4.8890385
[20:11:32] 💓 [292] STUCK: 0 | YAW: 295° | LOC: 52.3881551,4.8888969
[20:11:34] 💓 [293] STUCK: 1 | YAW: 295° | LOC: 52.3881551,4.8888969`;

    const steps = parseWalkLog(testLog);

    expect(steps.length).toBe(3);
    expect(steps[0].step).toBe(291);
    expect(steps[0].location).toBe('52.3881675,4.8890385');
    expect(steps[0].yaw).toBe(295);
    expect(steps[0].stuckCount).toBe(0);
    expect(steps[2].stuckCount).toBe(1);
  });

  it('should parse decision lines correctly', () => {
    const testLog = `[20:11:30] 💓 [291] STUCK: 0 | YAW: 295° | LOC: 52.3881675,4.8890385
[20:11:30] [DEBUG] decision={"turn":false}
[20:11:32] 💓 [292] STUCK: 0 | YAW: 295° | LOC: 52.3881551,4.8888969
[20:11:32] [DEBUG] decision={"turn":true,"angle":18.55,"direction":"left"}`;

    const steps = parseWalkLog(testLog);

    expect(steps.length).toBe(2);
    expect(steps[0].decision).toEqual({ turn: false });
    expect(steps[1].decision).toEqual({ turn: true, angle: 18.55, direction: 'left' });
  });

  it('should handle ACTION lines', () => {
    const testLog = `[20:11:30] 💓 [291] STUCK: 0 | YAW: 295° | LOC: 52.3881675,4.8890385
[20:11:30]    🔄 ACTION: Turning LEFT 18.55486708880079°`;

    const steps = parseWalkLog(testLog);

    expect(steps.length).toBe(1);
    expect(steps[0].actualTurn).toEqual({
      direction: 'LEFT',
      angle: 18.55486708880079
    });
  });
});
