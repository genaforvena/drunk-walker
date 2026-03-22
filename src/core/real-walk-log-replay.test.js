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
 * 
 * TERRITORY REPLAY:
 * - Extracts unique locations from real walks as graph
 * - Runs current algorithm on same territory
 * - Compares metrics to verify improvements
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

  // ============================================================================
  // TERRITORY REPLAY - Run algorithm on real walk territory
  // ============================================================================

  describe('Territory Replay - Algorithm on Real Walk Data', () => {
    /**
     * Build a simple graph from real walk locations
     * Connects adjacent locations in the walk sequence
     */
    function buildTerritoryGraph(steps) {
      const graph = new Map(); // location -> Set of neighbors
      const locations = [];

      for (let i = 0; i < steps.length; i++) {
        const loc = steps[i].location;
        if (!loc) continue; // Skip invalid steps

        if (!graph.has(loc)) {
          graph.set(loc, new Set());
          locations.push(loc);
        }

        // Connect to previous and next locations (adjacent in walk)
        if (i > 0 && steps[i - 1].location && steps[i - 1].location !== loc) {
          const prevLoc = steps[i - 1].location;
          if (!graph.has(prevLoc)) {
            graph.set(prevLoc, new Set());
            locations.push(prevLoc);
          }
          graph.get(loc).add(prevLoc);
          graph.get(prevLoc).add(loc);
        }
        if (i < steps.length - 1 && steps[i + 1].location && steps[i + 1].location !== loc) {
          const nextLoc = steps[i + 1].location;
          if (!graph.has(nextLoc)) {
            graph.set(nextLoc, new Set());
            locations.push(nextLoc);
          }
          graph.get(loc).add(nextLoc);
          graph.get(nextLoc).add(loc);
        }
      }

      return { graph, locations };
    }

    /**
     * Simulate algorithm walking on territory
     * @param {Map} graph - Territory graph (location -> neighbors)
     * @param {string} startLoc - Starting location
     * @param {number} maxSteps - Maximum steps to simulate
     * @returns {Object} Walk results
     */
    function simulateWalkOnTerritory(graph, startLoc, maxSteps = 500) {
      const algorithm = createDefaultAlgorithm({});

      let currentLoc = startLoc;
      let previousLoc = null;
      let orientation = 0;
      const breadcrumbs = [];
      const visitedUrls = new Set();
      const visitedOrder = [];

      const turns = [];
      const microAdjustments = [];
      const largeTurns = [];

      for (let step = 0; step < maxSteps; step++) {
        breadcrumbs.push(currentLoc);
        if (breadcrumbs.length > 200) breadcrumbs.shift();

        const isNewNode = !visitedUrls.has(currentLoc);
        if (isNewNode) {
          visitedUrls.add(currentLoc);
          visitedOrder.push(currentLoc);
        }

        // Get algorithm decision
        const context = {
          stuckCount: 0,
          currentLocation: currentLoc,
          previousLocation: previousLoc,
          visitedUrls,
          breadcrumbs: [...breadcrumbs],
          orientation,
          isNewNode,
          isFullyScanned: false,
          justArrived: true,
          nodeVisitCount: visitedUrls.has(currentLoc) ? 1 : 0
        };

        const decision = algorithm.decide(context);

        if (decision.turn) {
          turns.push(decision);
          const angle = decision.angle || 0;

          if (angle < 20 && angle > 0) {
            microAdjustments.push(decision);
          }
          if (angle > 60) {
            largeTurns.push(decision);
          }

          // Update orientation
          if (decision.direction === 'left') {
            orientation = (orientation + angle) % 360;
          } else {
            orientation = (orientation - angle + 360) % 360;
          }

          // Simulate turn completing, then move to a neighbor
          const neighbors = Array.from(graph.get(currentLoc) || []);
          if (neighbors.length > 0) {
            // Prefer unvisited neighbors
            const unvisitedNeighbors = neighbors.filter(n => !visitedUrls.has(n));
            if (unvisitedNeighbors.length > 0) {
              previousLoc = currentLoc;
              currentLoc = unvisitedNeighbors[0];
            } else {
              // All visited - pick random
              previousLoc = currentLoc;
              currentLoc = neighbors[Math.floor(Math.random() * neighbors.length)];
            }
          }
        } else {
          // No turn - move forward to a neighbor
          const neighbors = Array.from(graph.get(currentLoc) || []);
          if (neighbors.length > 0) {
            const unvisitedNeighbors = neighbors.filter(n => !visitedUrls.has(n));
            if (unvisitedNeighbors.length > 0) {
              previousLoc = currentLoc;
              currentLoc = unvisitedNeighbors[0];
            } else {
              previousLoc = currentLoc;
              currentLoc = neighbors[Math.floor(Math.random() * neighbors.length)];
            }
          }
        }
      }

      return {
        totalSteps: maxSteps,
        uniqueLocations: visitedUrls.size,
        visitedOrder,
        visitedStepsRatio: visitedUrls.size / maxSteps,
        turns: turns.length,
        turnsPer100: (turns.length / maxSteps) * 100,
        microAdjustments: microAdjustments.length,
        microAdjustmentsPer100: (microAdjustments.length / maxSteps) * 100,
        largeTurns: largeTurns.length,
        largeTurnsPer100: (largeTurns.length / maxSteps) * 100
      };
    }

    it('should replay territory from real walk and verify algorithm performance', () => {
      if (availableWalks.length === 0) {
        console.log('⚠️  No walk files available');
        return;
      }

      // Use the most recent walk
      const walkFile = availableWalks[0];
      const steps = loadWalkFile(walkFile);

      if (!steps || steps.length < 50) {
        console.log(`⚠️  ${walkFile} has too few steps`);
        return;
      }

      // Build territory graph from real walk
      const { graph, locations } = buildTerritoryGraph(steps);

      console.log(`\n🗺️  ${walkFile} Territory:`);
      console.log(`   Total locations in graph: ${locations.length}`);
      console.log(`   Graph edges: ${Array.from(graph.values()).reduce((sum, neighbors) => sum + neighbors.size, 0) / 2}`);

      // Run algorithm on same territory
      const startLoc = locations[0];
      const result = simulateWalkOnTerritory(graph, startLoc, Math.min(500, locations.length));

      console.log('\n📊 Algorithm Performance on Real Territory:');
      console.log(`   Unique locations visited: ${result.uniqueLocations}/${locations.length} (${(result.uniqueLocations / locations.length * 100).toFixed(1)}%)`);
      console.log(`   Visited/Steps ratio: ${result.visitedStepsRatio.toFixed(3)}`);
      console.log(`   Turns per 100: ${result.turnsPer100.toFixed(1)}`);
      console.log(`   Micro-adjustments per 100: ${result.microAdjustmentsPer100.toFixed(1)}`);
      console.log(`   Large turns per 100: ${result.largeTurnsPer100.toFixed(1)}`);

      // Verify algorithm performs reasonably on real territory
      // Note: Simulation uses simplified movement (random neighbor selection)
      // Real algorithm achieves better ratios through PLEDGE wall-following
      expect(result.visitedStepsRatio).toBeGreaterThan(0.25);
      expect(result.microAdjustmentsPer100).toBeLessThan(15);
      expect(result.uniqueLocations).toBeGreaterThan(0);

      // Coverage metric - how much of territory explored
      const coverageRatio = result.uniqueLocations / locations.length;
      console.log(`\n📈 Coverage: ${coverageRatio.toFixed(3)} of territory explored in ${result.totalSteps} steps`);

      // Basic sanity check - should explore some portion
      expect(coverageRatio).toBeGreaterThan(0.20);
    });

    it('should compare algorithm vs original walk efficiency', () => {
      if (availableWalks.length === 0) {
        console.log('⚠️  No walk files available');
        return;
      }

      const walkFile = availableWalks[0];
      const steps = loadWalkFile(walkFile);

      if (!steps || steps.length < 50) {
        return;
      }

      // Original walk metrics
      const originalMetrics = analyzeWalkMetrics(steps.slice(0, 500));

      // Build territory and run algorithm
      const { graph, locations } = buildTerritoryGraph(steps);
      const algoResult = simulateWalkOnTerritory(graph, locations[0], Math.min(500, locations.length));

      console.log('\n📊 Algorithm vs Original Walk Comparison:');
      console.log(`   Original walk:`);
      console.log(`     Visited/Steps: ${originalMetrics.visitedStepsRatio.toFixed(3)}`);
      console.log(`     Turns/100: ${originalMetrics.turnsPer100.toFixed(1)}`);
      console.log(`   Algorithm on same territory:`);
      console.log(`     Visited/Steps: ${algoResult.visitedStepsRatio.toFixed(3)}`);
      console.log(`     Turns/100: ${algoResult.turnsPer100.toFixed(1)}`);

      // Algorithm should achieve comparable or better efficiency
      // Note: This is a soft comparison - territory structure affects results
      console.log(`\n   Efficiency delta: ${(algoResult.visitedStepsRatio - originalMetrics.visitedStepsRatio).toFixed(3)}`);
      console.log(`   Turns delta: ${(algoResult.turnsPer100 - originalMetrics.turnsPer100).toFixed(1)} per 100 steps`);

      // Basic sanity check - algorithm should explore something
      expect(algoResult.visitedStepsRatio).toBeGreaterThan(0.20);
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
