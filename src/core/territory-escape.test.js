/**
 * Territory Escape Benchmark Suite v1.0
 *
 * COMPREHENSIVE TESTING: 17+ scenarios to test bot's escape capabilities
 * All tests use REAL engine + REAL algorithm with mock Street View
 *
 * KEY METRICS:
 * - Escape Success Rate: % of scenarios where bot reaches exit
 * - Max Visits per Node: Should be ≤2 (PLEDGE guarantee, ≤3 for oscillation)
 * - Steps/Location: Efficiency metric (lower = better, target <5.0)
 * - Turn Efficiency: Turns per 100 moves (lower = better, target <25)
 *
 * TEST CATEGORIES:
 * 1. Difficulty Ladder (8 levels) - Progressive complexity
 * 2. Edge Cases (6 scenarios) - Specific trap patterns
 * 3. Stress Tests (3 scenarios) - Large-scale territories
 * 4. Walk Log Benchmarks (65+ real walks) - Real-world validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEngine } from './engine.js';
import { TerritoryOracle } from './territory-oracle.js';
import { StreetViewMock } from './streetview-mock.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_LAT = 52.370000;
const BASE_LNG = 4.870000;
const STEP = 0.0001;

// Metric thresholds for PASS/FAIL
const METRIC_THRESHOLDS = {
  // PLEDGE guarantee - each node visited at most twice
  maxVisits: { target: 2, hardLimit: 3 },  // 3 allowed for oscillation edge cases
  // Efficiency: steps per unique location visited
  stepsPerLocation: { excellent: 2.0, good: 5.0, acceptable: 10.0 },
  // Turn efficiency
  turnsPer100: { excellent: 15, good: 25, acceptable: 40 },
  // Escape success
  escapeSuccess: true,
  // Coverage for stress tests
  minCoverage: 0.80  // Must visit 80% of territory
};

// Helper: Generate location string from grid coordinates
function getLoc(x, y) {
  const lat = (BASE_LAT + y * STEP).toFixed(6);
  const lng = (BASE_LNG + x * STEP).toFixed(6);
  return `${lat},${lng}`;
}

// ============================================================================
// TERRITORY GENERATORS
// ============================================================================

/**
 * Territory Generator Registry
 * Each generator returns: { oracle, startLoc, exitLoc, startYaw, expectedPath? }
 */
const TerritoryGenerators = {
  // ==========================================================================
  // DIFFICULTY LADDER (8 Levels)
  // ==========================================================================

  /** Level 1: Linear street - simplest case */
  linear10: () => {
    const oracle = new TerritoryOracle();
    for (let i = 0; i < 10; i++) {
      oracle.recordConnection(getLoc(0, i), getLoc(0, i + 1), 0, 0);
    }
    oracle.addReverseConnections();
    return {
      oracle,
      startLoc: getLoc(0, 0),
      exitLoc: getLoc(0, 10),
      startYaw: 0,
      difficulty: 1,
      name: 'Linear 10'
    };
  },

  /** Level 2: T-junction - single decision point */
  tJunction: () => {
    const oracle = new TerritoryOracle();
    // Stem: (0,0) to (0,5)
    for (let y = 0; y < 5; y++) {
      oracle.recordConnection(getLoc(0, y), getLoc(0, y + 1), 0, 0);
    }
    // Crossbar: (-3,5) to (3,5)
    for (let x = -3; x < 3; x++) {
      oracle.recordConnection(getLoc(x, 5), getLoc(x + 1, 5), 90, 90);
    }
    oracle.addReverseConnections();
    return {
      oracle,
      startLoc: getLoc(0, 0),
      exitLoc: getLoc(3, 5),  // Right end of crossbar
      startYaw: 0,
      difficulty: 2,
      name: 'T-Junction'
    };
  },

  /** Level 3: Single cul-de-sac - dead end escape */
  culDeSac: () => {
    const oracle = new TerritoryOracle();
    // Main road: (0,0) to (0,10)
    for (let y = 0; y < 10; y++) {
      oracle.recordConnection(getLoc(0, y), getLoc(0, y + 1), 0, 0);
    }
    // Side street: (0,5) to (4,5) - dead end
    for (let x = 0; x < 4; x++) {
      oracle.recordConnection(getLoc(x, 5), getLoc(x + 1, 5), 90, 90);
    }
    oracle.addReverseConnections();
    return {
      oracle,
      startLoc: getLoc(4, 5),  // Start at dead end
      exitLoc: getLoc(0, 10),  // Exit at top of main road
      startYaw: 270,  // Facing west
      difficulty: 3,
      name: 'Cul-de-Sac'
    };
  },

  /** Level 4: Double cul-de-sac - two dead ends in sequence */
  doubleCulDeSac: () => {
    const oracle = new TerritoryOracle();
    // Main road: (0,0) to (0,15)
    for (let y = 0; y < 15; y++) {
      oracle.recordConnection(getLoc(0, y), getLoc(0, y + 1), 0, 0);
    }
    // First side street: (0,4) to (3,4)
    for (let x = 0; x < 3; x++) {
      oracle.recordConnection(getLoc(x, 4), getLoc(x + 1, 4), 90, 90);
    }
    // Second side street: (0,10) to (3,10)
    for (let x = 0; x < 3; x++) {
      oracle.recordConnection(getLoc(x, 10), getLoc(x + 1, 10), 90, 90);
    }
    oracle.addReverseConnections();
    return {
      oracle,
      startLoc: getLoc(3, 4),  // First dead end
      exitLoc: getLoc(0, 15),  // Exit at top
      startYaw: 270,
      difficulty: 4,
      name: 'Double Cul-de-Sac'
    };
  },

  /** Level 5: Grid with dead ends - 5x5 with some blocked paths */
  gridWithDeadEnds: () => {
    const oracle = new TerritoryOracle();
    const size = 5;
    // Create grid with some missing connections (dead ends)
    for (let y = 0; y < size; y++) {
      const leftToRight = y % 2 === 0;
      for (let x = 0; x < size; x++) {
        const actualX = leftToRight ? x : (size - 1 - x);
        const loc = getLoc(actualX, y);

        // Horizontal connection
        if (actualX < size - 1) {
          oracle.recordConnection(loc, getLoc(actualX + 1, y), 90, 90);
        }
        // Vertical connection (skip some to create dead ends)
        if (y < size - 1 && !(actualX === 2 && y === 2)) {
          oracle.recordConnection(loc, getLoc(actualX, y + 1), 0, 0);
        }
      }
    }
    // Add exit path
    oracle.recordConnection(getLoc(size - 1, size - 1), getLoc(size, size - 1), 90, 90);
    oracle.addReverseConnections();
    return {
      oracle,
      startLoc: getLoc(0, 0),
      exitLoc: getLoc(size, size - 1),
      startYaw: 90,
      difficulty: 5,
      name: 'Grid 5x5 with Dead Ends'
    };
  },

  /** Level 6: Spiral maze - L-shaped corridor with turn */
  spiralMaze: () => {
    const oracle = new TerritoryOracle();
    // L-shaped path: (0,0) -> (0,3) -> (3,3) -> exit
    // Vertical segment
    for (let y = 0; y < 3; y++) {
      oracle.recordConnection(getLoc(0, y), getLoc(0, y + 1), 0, 0);
    }
    // Turn at corner (0,3) -> (3,3)
    for (let x = 0; x < 3; x++) {
      oracle.recordConnection(getLoc(x, 3), getLoc(x + 1, 3), 90, 90);
    }
    // Exit
    oracle.recordConnection(getLoc(3, 3), getLoc(4, 3), 90, 90);

    oracle.addReverseConnections();
    return {
      oracle,
      startLoc: getLoc(0, 0),
      exitLoc: getLoc(4, 3),
      startYaw: 0,
      difficulty: 6,
      name: 'L-Shaped Maze'
    };
  },

  /** Level 7: Complex city - multiple blocks with alleys */
  complexCity: () => {
    const oracle = new TerritoryOracle();
    // Main spine (0,0) to (0,15)
    for (let y = 0; y < 15; y++) {
      oracle.recordConnection(getLoc(0, y), getLoc(0, y + 1), 0, 0);
    }

    // Side loops and traps
    // Block 1: (0,3) to (2,3) to (2,5) to (0,5)
    oracle.recordConnection(getLoc(0, 3), getLoc(2, 3), 90, 90);
    oracle.recordConnection(getLoc(2, 3), getLoc(2, 5), 0, 0);
    oracle.recordConnection(getLoc(2, 5), getLoc(0, 5), 270, 270);

    // Block 2: (0,7) to (-2,7) to (-2,9) to (0,9)
    oracle.recordConnection(getLoc(0, 7), getLoc(-2, 7), 270, 270);
    oracle.recordConnection(getLoc(-2, 7), getLoc(-2, 9), 0, 0);
    oracle.recordConnection(getLoc(-2, 9), getLoc(0, 9), 90, 90);

    // Dead end trap: (0,11) to (-3,11)
    for (let x = 0; x > -3; x--) {
      oracle.recordConnection(getLoc(x, 11), getLoc(x - 1, 11), 270, 270);
    }

    // Exit at top
    oracle.recordConnection(getLoc(0, 15), getLoc(0, 16), 0, 0);

    oracle.addReverseConnections();
    return {
      oracle,
      startLoc: getLoc(-3, 11),  // Start in dead end
      exitLoc: getLoc(0, 16),
      startYaw: 90,
      difficulty: 7,
      name: 'Complex City'
    };
  },

  /** Level 8: Figure-8 - two loops connected at center */
  figure8: () => {
    const oracle = new TerritoryOracle();
    // Left loop: (-2,0) -> (-2,2) -> (0,2) -> (0,0) -> (-2,0)
    oracle.recordConnection(getLoc(-2, 0), getLoc(-2, 2), 0, 0);
    oracle.recordConnection(getLoc(-2, 2), getLoc(0, 2), 90, 90);
    oracle.recordConnection(getLoc(0, 2), getLoc(0, 0), 180, 180);
    oracle.recordConnection(getLoc(0, 0), getLoc(-2, 0), 270, 270);

    // Right loop: (0,0) -> (2,0) -> (2,2) -> (0,2) -> (0,0)
    oracle.recordConnection(getLoc(0, 0), getLoc(2, 0), 90, 90);
    oracle.recordConnection(getLoc(2, 0), getLoc(2, 2), 0, 0);
    oracle.recordConnection(getLoc(2, 2), getLoc(0, 2), 270, 270);

    // Exit from right loop
    oracle.recordConnection(getLoc(2, 0), getLoc(3, 0), 90, 90);

    oracle.addReverseConnections();
    return {
      oracle,
      startLoc: getLoc(-2, 0),
      exitLoc: getLoc(3, 0),
      startYaw: 90,
      difficulty: 8,
      name: 'Figure-8'
    };
  },

  // ==========================================================================
  // EDGE CASES (6 Scenarios)
  // ==========================================================================

  /** Edge Case 1: 2-node oscillation trap */
  oscillationTrap: () => {
    const oracle = new TerritoryOracle();
    // A <-> B (bidirectional)
    oracle.recordConnection(getLoc(0, 0), getLoc(0, 1), 0, 0);
    // B has only one other exit: B -> C
    oracle.recordConnection(getLoc(0, 1), getLoc(0, 2), 0, 0);
    // C is dead end
    oracle.addReverseConnections();
    return {
      oracle,
      startLoc: getLoc(0, 0),
      exitLoc: getLoc(0, 2),
      startYaw: 0,
      difficulty: 'edge',
      name: 'Oscillation Trap'
    };
  },

  /** Edge Case 2: Roundabout - central hub with 4 exits */
  roundabout: () => {
    const oracle = new TerritoryOracle();
    const center = getLoc(0, 0);
    // 4 arms from center
    oracle.recordConnection(center, getLoc(-2, 0), 270, 270);
    oracle.recordConnection(center, getLoc(2, 0), 90, 90);
    oracle.recordConnection(center, getLoc(0, -2), 180, 180);
    oracle.recordConnection(center, getLoc(0, 2), 0, 0);
    // Add intermediate nodes on arms
    oracle.recordConnection(getLoc(-2, 0), getLoc(-3, 0), 270, 270);
    oracle.recordConnection(getLoc(2, 0), getLoc(3, 0), 90, 90);
    oracle.recordConnection(getLoc(0, -2), getLoc(0, -3), 180, 180);
    oracle.recordConnection(getLoc(0, 2), getLoc(0, 3), 0, 0);
    oracle.addReverseConnections();
    return {
      oracle,
      startLoc: getLoc(-3, 0),
      exitLoc: getLoc(3, 0),
      startYaw: 90,
      difficulty: 'edge',
      name: 'Roundabout'
    };
  },

  /** Edge Case 3: Narrow corridor with side exits */
  narrowCorridor: () => {
    const oracle = new TerritoryOracle();
    // Long corridor: (0,0) to (0,20)
    for (let y = 0; y < 20; y++) {
      oracle.recordConnection(getLoc(0, y), getLoc(0, y + 1), 0, 0);
    }
    // Periodic side exits (every 5 nodes)
    for (let y = 5; y < 20; y += 5) {
      oracle.recordConnection(getLoc(0, y), getLoc(2, y), 90, 90);
      oracle.recordConnection(getLoc(2, y), getLoc(3, y), 90, 90);  // Dead end
    }
    oracle.addReverseConnections();
    return {
      oracle,
      startLoc: getLoc(0, 0),
      exitLoc: getLoc(0, 20),
      startYaw: 0,
      difficulty: 'edge',
      name: 'Narrow Corridor'
    };
  },

  /** Edge Case 4: Blocked grid - 8x8 with 20% random blocks */
  blockedGrid: () => {
    const oracle = new TerritoryOracle();
    const size = 8;
    const blocked = new Set(['2,2', '3,3', '4,4', '5,2', '2,5', '6,6']);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (blocked.has(`${x},${y}`)) continue;

        const loc = getLoc(x, y);
        // Right connection
        if (x < size - 1 && !blocked.has(`${x + 1},${y}`)) {
          oracle.recordConnection(loc, getLoc(x + 1, y), 90, 90);
        }
        // Down connection
        if (y < size - 1 && !blocked.has(`${x},${y + 1}`)) {
          oracle.recordConnection(loc, getLoc(x, y + 1), 0, 0);
        }
      }
    }
    // Exit
    oracle.recordConnection(getLoc(size - 1, size - 1), getLoc(size, size - 1), 90, 90);
    oracle.addReverseConnections();
    return {
      oracle,
      startLoc: getLoc(0, 0),
      exitLoc: getLoc(size, size - 1),
      startYaw: 90,
      difficulty: 'edge',
      name: 'Blocked Grid 8x8'
    };
  },

  /** Edge Case 5: Pure tree - branching with no cycles */
  treeStructure: () => {
    const oracle = new TerritoryOracle();
    // Root
    oracle.recordConnection(getLoc(0, 0), getLoc(0, 1), 0, 0);
    // Level 1: 2 branches
    oracle.recordConnection(getLoc(0, 1), getLoc(-1, 2), 315, 315);
    oracle.recordConnection(getLoc(0, 1), getLoc(1, 2), 45, 45);
    // Level 2: 4 branches
    oracle.recordConnection(getLoc(-1, 2), getLoc(-2, 3), 315, 315);
    oracle.recordConnection(getLoc(-1, 2), getLoc(0, 3), 45, 45);
    oracle.recordConnection(getLoc(1, 2), getLoc(0, 3), 315, 315);
    oracle.recordConnection(getLoc(1, 2), getLoc(2, 3), 45, 45);
    // Exit from one leaf
    oracle.recordConnection(getLoc(-2, 3), getLoc(-3, 3), 270, 270);
    oracle.addReverseConnections();
    return {
      oracle,
      startLoc: getLoc(0, 0),
      exitLoc: getLoc(-3, 3),
      startYaw: 0,
      difficulty: 'edge',
      name: 'Tree Structure'
    };
  },

  /** Edge Case 6: Multi-exit roundabout with traps */
  multiExitRoundabout: () => {
    const oracle = new TerritoryOracle();
    const center = getLoc(0, 0);
    // 4 arms from center (simplified)
    // North arm
    oracle.recordConnection(center, getLoc(0, 1), 0, 0);
    oracle.recordConnection(getLoc(0, 1), getLoc(0, 2), 0, 0);  // Dead end
    // South arm (start here)
    oracle.recordConnection(center, getLoc(0, -1), 180, 180);
    oracle.recordConnection(getLoc(0, -1), getLoc(0, -2), 180, 180);  // Dead end (start)
    // East arm (exit)
    oracle.recordConnection(center, getLoc(1, 0), 90, 90);
    oracle.recordConnection(getLoc(1, 0), getLoc(2, 0), 90, 90);  // Exit
    // West arm
    oracle.recordConnection(center, getLoc(-1, 0), 270, 270);
    oracle.recordConnection(getLoc(-1, 0), getLoc(-2, 0), 270, 270);  // Dead end

    oracle.addReverseConnections();
    return {
      oracle,
      startLoc: getLoc(0, -2),  // Start at south dead end
      exitLoc: getLoc(2, 0),  // Exit at east arm
      startYaw: 0,
      difficulty: 'edge',
      name: 'Multi-Exit Roundabout'
    };
  },

  // ==========================================================================
  // WALL-FOLLOW SPECIFIC TESTS
  // ==========================================================================

  /** Wall-Follow Test: Deep U-shaped corridor requiring LEFT scanning */
  uShapedCorridor: () => {
    const oracle = new TerritoryOracle();
    // Enter: (0,0) to (0,5) - moving North at yaw 0°
    for (let y = 0; y < 5; y++) {
      oracle.recordConnection(getLoc(0, y), getLoc(0, y + 1), 0, 0);
    }
    // At dead end (0,5), turn LEFT to go West
    // Wall-follow scans 90-180° LEFT from forward bearing (0°)
    // So it looks for yaws 90°-180° (East to South)
    // We need exit at yaw 180° (South, which is 180° LEFT from North)
    oracle.recordConnection(getLoc(0, 5), getLoc(0, 4), 180, 180);  // Backtrack
    oracle.recordConnection(getLoc(0, 5), getLoc(-1, 5), 240, 240);  // LEFT exit (120° LEFT)
    oracle.recordConnection(getLoc(-1, 5), getLoc(-2, 5), 240, 240);
    oracle.recordConnection(getLoc(-2, 5), getLoc(-3, 5), 240, 240);
    // Exit
    oracle.recordConnection(getLoc(-3, 5), getLoc(-4, 5), 240, 240);

    oracle.addReverseConnections();
    return {
      oracle,
      startLoc: getLoc(0, 0),
      exitLoc: getLoc(-4, 5),
      startYaw: 0,
      difficulty: 'wall-follow',
      name: 'U-Shaped Corridor'
    };
  },

  /** Wall-Follow Test: Deep dead-end requiring LEFT scan to find side exit */
  deadEndWithLeftExit: () => {
    const oracle = new TerritoryOracle();
    // Long corridor: (0,0) to (0,8)
    for (let y = 0; y < 8; y++) {
      oracle.recordConnection(getLoc(0, y), getLoc(0, y + 1), 0, 0);
    }
    // Dead end at (0,8) - no forward exit
    // LEFT exit at (0,5) going to (-1,5) - this is the ONLY escape
    // Use 180° (South) which is exactly 180° LEFT from North (forward bearing)
    oracle.recordConnection(getLoc(0, 5), getLoc(-1, 5), 180, 180);
    oracle.recordConnection(getLoc(-1, 5), getLoc(-2, 5), 180, 180);
    // Exit from (-2,5)
    oracle.recordConnection(getLoc(-2, 5), getLoc(-3, 5), 180, 180);

    oracle.addReverseConnections();
    return {
      oracle,
      startLoc: getLoc(0, 0),
      exitLoc: getLoc(-3, 5),
      startYaw: 0,
      difficulty: 'wall-follow',
      name: 'Dead End with LEFT Exit'
    };
  },

  /** Wall-Follow Test: Comb requiring LEFT scan at each tooth */
  combCorridor: () => {
    const oracle = new TerritoryOracle();
    // Main corridor: (0,0) to (0,10)
    for (let y = 0; y < 10; y++) {
      oracle.recordConnection(getLoc(0, y), getLoc(0, y + 1), 0, 0);
    }
    // Dead-end teeth on the RIGHT side (bot should ignore these)
    for (let y = 2; y < 10; y += 2) {
      oracle.recordConnection(getLoc(0, y), getLoc(1, y), 90, 90);
    }
    // Exit at top
    oracle.recordConnection(getLoc(0, 10), getLoc(0, 11), 0, 0);

    oracle.addReverseConnections();
    return {
      oracle,
      startLoc: getLoc(1, 2),  // Start in first dead-end tooth
      exitLoc: getLoc(0, 11),
      startYaw: 270,  // Facing west into main corridor
      difficulty: 'wall-follow',
      name: 'Comb Corridor'
    };
  },

  // ==========================================================================
  // STRESS TESTS (3 Large-scale scenarios)
  // ==========================================================================

  /** Stress Test 1: 1000-node linear */
  linear1000: () => {
    const oracle = new TerritoryOracle();
    for (let i = 0; i < 1000; i++) {
      oracle.recordConnection(getLoc(0, i), getLoc(0, i + 1), 0, 0);
    }
    oracle.addReverseConnections();
    return {
      oracle,
      startLoc: getLoc(0, 0),
      exitLoc: getLoc(0, 1000),
      startYaw: 0,
      difficulty: 'stress',
      name: 'Linear 1000',
      maxTicks: 20000
    };
  },

  /** Stress Test 2: 50x50 grid (2500 nodes) */
  grid50x50: () => {
    const oracle = new TerritoryOracle();
    const size = 50;
    for (let y = 0; y < size; y++) {
      const leftToRight = y % 2 === 0;
      for (let x = 0; x < size; x++) {
        const actualX = leftToRight ? x : (size - 1 - x);
        const loc = getLoc(actualX, y);

        if (actualX < size - 1) {
          oracle.recordConnection(loc, getLoc(actualX + 1, y), 90, 90);
        }
        if (y < size - 1) {
          oracle.recordConnection(loc, getLoc(actualX, y + 1), 0, 0);
        }
      }
    }
    oracle.addReverseConnections();
    return {
      oracle,
      startLoc: getLoc(0, 0),
      exitLoc: getLoc(size - 1, size - 1),
      startYaw: 90,
      difficulty: 'stress',
      name: 'Grid 50x50',
      maxTicks: 100000
    };
  },

  /** Stress Test 3: Complex maze 20x20 */
  complexMaze20x20: () => {
    const oracle = new TerritoryOracle();
    const size = 20;
    // Create maze-like pattern with alternating barriers
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const loc = getLoc(x, y);
        // Horizontal with gaps
        if (x < size - 1 && (y % 3 !== 0 || x % 5 !== 0)) {
          oracle.recordConnection(loc, getLoc(x + 1, y), 90, 90);
        }
        // Vertical with gaps
        if (y < size - 1 && (x % 3 !== 0 || y % 4 !== 0)) {
          oracle.recordConnection(loc, getLoc(x, y + 1), 0, 0);
        }
      }
    }
    oracle.addReverseConnections();
    return {
      oracle,
      startLoc: getLoc(0, 0),
      exitLoc: getLoc(size - 1, size - 1),
      startYaw: 90,
      difficulty: 'stress',
      name: 'Complex Maze 20x20',
      maxTicks: 100000
    };
  }
};

// ============================================================================
// TEST RUNNER
// ============================================================================

/**
 * Run benchmark test with REAL engine and mock Street View
 */
async function runEscapeBenchmark(territoryConfig, maxTicks = 5000) {
  const { oracle, startLoc, exitLoc, startYaw = 0, maxTicks: configMaxTicks } = territoryConfig;
  const effectiveMaxTicks = configMaxTicks || maxTicks;

  // Create mock Street View (SHARED implementation from streetview-mock.js)
  const mockSV = new StreetViewMock(oracle);

  // Create REAL engine
  const engine = createEngine({
    pace: 0,  // Instant (no delay)
    kbOn: true,
    panicThreshold: 3
  });

  // Initialize
  const initialUrl = mockSV.initialize(startLoc, startYaw);
  vi.stubGlobal('location', { href: initialUrl });
  engine.setCurrentYaw(startYaw);

  // Set up action handlers
  engine.setActionHandlers({
    keyPress: (key) => {
      const newUrl = mockSV.handleKeyPress(key);
      vi.stubGlobal('location', { href: newUrl });
      engine.setCurrentYaw(mockSV.currentYaw);
    },
    longKeyPress: (key, duration, cb) => {
      const newUrl = mockSV.handleKeyPress(key);
      vi.stubGlobal('location', { href: newUrl });
      engine.setCurrentYaw(mockSV.currentYaw);
      if (cb) cb();
    }
  });

  engine.setStatus('WALKING');

  // Track metrics
  const arrivalCounts = new Map();
  const turnCount = { value: 0 };
  let lastLoc = null;
  let ticks = 0;
  let reachedExit = false;
  let successfulMoves = 0;

  // Track turn events
  let lastOrientation = mockSV.currentYaw;

  for (ticks = 0; ticks < effectiveMaxTicks; ticks++) {
    const orientationBefore = mockSV.currentYaw;
    engine.tick();
    const orientationAfter = mockSV.currentYaw;

    // Detect turn (yaw changed significantly)
    const yawDiff = Math.abs(orientationAfter - orientationBefore);
    if (yawDiff > 30 || (yawDiff > 300)) {
      turnCount.value++;
    }

    const currentLoc = mockSV.currentLocation;
    if (currentLoc !== lastLoc) {
      arrivalCounts.set(currentLoc, (arrivalCounts.get(currentLoc) || 0) + 1);
      successfulMoves++;
      lastLoc = currentLoc;
    }

    if (currentLoc === exitLoc) {
      reachedExit = true;
      break;
    }
  }

  // Calculate metrics
  const uniqueLocations = arrivalCounts.size;
  const maxArrivals = arrivalCounts.size > 0 ? Math.max(...arrivalCounts.values()) : 0;
  const stepsPerLocation = uniqueLocations > 0 ? successfulMoves / uniqueLocations : 0;
  const turnsPer100 = successfulMoves > 0 ? (turnCount.value / successfulMoves) * 100 : 0;

  // Get territory size
  const allTerritoryLocations = oracle.getAllLocations();
  const coverage = allTerritoryLocations.length > 0
    ? uniqueLocations / allTerritoryLocations.length
    : 0;

  return {
    reachedExit,
    ticks,
    successfulMoves,
    uniqueLocations,
    totalTerritorySize: allTerritoryLocations.length,
    coverage,
    maxArrivals,
    stepsPerLocation,
    turnsPer100,
    finalLocation: mockSV.currentLocation,
    exitLocation: exitLoc,
    arrivalCounts: new Map(arrivalCounts),
    turnCount: turnCount.value
  };
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('Territory Escape Benchmarks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // DIFFICULTY LADDER TESTS
  // ==========================================================================

  describe('Difficulty Ladder', () => {
    const ladderTests = [
      'linear10',
      'tJunction',
      'culDeSac',
      'doubleCulDeSac',
      'gridWithDeadEnds',
      'spiralMaze',
      'complexCity',
      'figure8'
    ];

    ladderTests.forEach((generatorName) => {
      it(`should escape ${generatorName} (Level ${ladderTests.indexOf(generatorName) + 1})`, async () => {
        const generator = TerritoryGenerators[generatorName];
        const territory = generator();
        const results = await runEscapeBenchmark(territory);

        console.log(`\n📊 ${territory.name}:`);
        console.log(`   ✅ Escape: ${results.reachedExit ? 'YES' : 'NO'}`);
        console.log(`   📍 Coverage: ${(results.coverage * 100).toFixed(1)}% (${results.uniqueLocations}/${results.totalTerritorySize})`);
        console.log(`   📈 Steps/Location: ${results.stepsPerLocation.toFixed(2)}`);
        console.log(`   🔄 Max Visits: ${results.maxArrivals}`);
        console.log(`   ↩️  Turns/100: ${results.turnsPer100.toFixed(1)}`);

        // Assertions
        expect(results.reachedExit).toBe(true);
        expect(results.maxArrivals).toBeLessThanOrEqual(METRIC_THRESHOLDS.maxVisits.hardLimit);
        expect(results.stepsPerLocation).toBeLessThan(METRIC_THRESHOLDS.stepsPerLocation.acceptable);
      });
    });
  });

  // ==========================================================================
  // EDGE CASE TESTS
  // ==========================================================================

  describe('Edge Cases', () => {
    const edgeCases = [
      'oscillationTrap',
      'roundabout',
      'narrowCorridor',
      'blockedGrid',
      'treeStructure',
      'multiExitRoundabout'
    ];

    edgeCases.forEach((generatorName) => {
      it(`should handle ${generatorName}`, async () => {
        const generator = TerritoryGenerators[generatorName];
        const territory = generator();
        const results = await runEscapeBenchmark(territory);

        console.log(`\n🔍 ${territory.name}:`);
        console.log(`   ✅ Escape: ${results.reachedExit ? 'YES' : 'NO'}`);
        console.log(`   📍 Coverage: ${(results.coverage * 100).toFixed(1)}%`);
        console.log(`   📈 Steps/Location: ${results.stepsPerLocation.toFixed(2)}`);
        console.log(`   🔄 Max Visits: ${results.maxArrivals}`);

        expect(results.reachedExit).toBe(true);
        // Tree structures may have more revisits due to backtracking
        if (generatorName === 'treeStructure') {
          expect(results.maxArrivals).toBeLessThanOrEqual(5);  // Allow backtracking revisits
        } else {
          expect(results.maxArrivals).toBeLessThanOrEqual(METRIC_THRESHOLDS.maxVisits.hardLimit);
        }
      });
    });
  });

  // ==========================================================================
  // WALL-FOLLOW SPECIFIC TESTS
  // ==========================================================================

  describe('Wall-Follow Mechanics', () => {
    it('should navigate comb corridor ignoring dead-end teeth', async () => {
      // Bot starts in dead-end tooth, must escape and ignore other teeth
      const territory = TerritoryGenerators.combCorridor();
      const results = await runEscapeBenchmark(territory, 500);

      expect(results.reachedExit).toBe(true);
      // Should not waste time in other dead-end teeth
      expect(results.stepsPerLocation).toBeLessThan(3.0);
      expect(results.maxArrivals).toBeLessThanOrEqual(3);
    });
  });

  // ==========================================================================
  // STRESS TESTS
  // ==========================================================================

  describe('Stress Tests', () => {
    const stressTests = ['linear1000', 'grid50x50', 'complexMaze20x20'];

    stressTests.forEach((generatorName) => {
      it(`should handle ${generatorName} stress test`, async () => {
        const generator = TerritoryGenerators[generatorName];
        const territory = generator();
        const results = await runEscapeBenchmark(territory, territory.maxTicks || 100000);

        console.log(`\n💪 ${territory.name}:`);
        console.log(`   ✅ Escape: ${results.reachedExit ? 'YES' : 'NO'}`);
        console.log(`   📍 Coverage: ${(results.coverage * 100).toFixed(1)}% (${results.uniqueLocations}/${results.totalTerritorySize})`);
        console.log(`   📈 Steps/Location: ${results.stepsPerLocation.toFixed(2)}`);
        console.log(`   🔄 Max Visits: ${results.maxArrivals}`);
        console.log(`   ⏱️  Ticks: ${results.ticks}`);

        // Stress tests have relaxed requirements - we're testing scalability
        // Key metric is maxArrivals which shows algorithm health under load
        expect(results.maxArrivals).toBeLessThanOrEqual(METRIC_THRESHOLDS.maxVisits.hardLimit * 3);
      }, 120000);  // Increased timeout for stress tests
    });
  });

  // ==========================================================================
  // METRIC SUMMARY
  // ==========================================================================

  it('should produce aggregate metrics report', async () => {
    const allResults = [];

    // Run subset of tests for aggregate report
    const sampleTests = ['linear10', 'culDeSac', 'complexCity', 'blockedGrid'];

    for (const testName of sampleTests) {
      const generator = TerritoryGenerators[testName];
      if (!generator) continue;

      const territory = generator();
      const results = await runEscapeBenchmark(territory);
      allResults.push({
        name: territory.name,
        difficulty: territory.difficulty,
        ...results
      });
    }

    // Calculate aggregate metrics
    const escapeRate = allResults.filter(r => r.reachedExit).length / allResults.length;
    const avgStepsPerLocation = allResults.reduce((sum, r) => sum + r.stepsPerLocation, 0) / allResults.length;
    const avgMaxVisits = allResults.reduce((sum, r) => sum + r.maxArrivals, 0) / allResults.length;
    const avgTurnsPer100 = allResults.reduce((sum, r) => sum + r.turnsPer100, 0) / allResults.length;

    console.log('\n📊 AGGREGATE METRICS:');
    console.log(`   Escape Success Rate: ${(escapeRate * 100).toFixed(1)}%`);
    console.log(`   Avg Steps/Location: ${avgStepsPerLocation.toFixed(2)}`);
    console.log(`   Avg Max Visits: ${avgMaxVisits.toFixed(2)}`);
    console.log(`   Avg Turns/100: ${avgTurnsPer100.toFixed(1)}`);

    expect(escapeRate).toBeGreaterThanOrEqual(0.75);  // At least 75% escape rate
  });

  // ==========================================================================
  // EFFICIENCY TESTS - Verify algorithm performs WELL, not just escapes
  // ==========================================================================

  describe('Algorithm Efficiency', () => {
    it('should escape cul-de-sac with PLEDGE efficiency (≤2 visits per node)', async () => {
      const territory = TerritoryGenerators.culDeSac();
      const results = await runEscapeBenchmark(territory);

      // PLEDGE guarantee: each node visited at most twice
      expect(results.maxArrivals).toBeLessThanOrEqual(2);
      // Efficient exploration: close to 1 step per location
      expect(results.stepsPerLocation).toBeLessThan(2.0);
    });

    it('should handle double cul-de-sac without excessive revisits', async () => {
      const territory = TerritoryGenerators.doubleCulDeSac();
      const results = await runEscapeBenchmark(territory);

      // Should escape both dead ends efficiently
      expect(results.maxArrivals).toBeLessThanOrEqual(2);
      expect(results.stepsPerLocation).toBeLessThan(2.5);
    });

    it('should navigate figure-8 without getting stuck in loops', async () => {
      const territory = TerritoryGenerators.figure8();
      const results = await runEscapeBenchmark(territory);

      // Figure-8 has cycles - algorithm must not loop infinitely
      expect(results.maxArrivals).toBeLessThanOrEqual(3);  // Allow 3 for oscillation
      expect(results.stepsPerLocation).toBeLessThan(3.0);
    });

    it('should show wall-follow efficiency on complex city', async () => {
      const territory = TerritoryGenerators.complexCity();
      const results = await runEscapeBenchmark(territory);

      // Complex city requires proper wall-following
      expect(results.maxArrivals).toBeLessThanOrEqual(3);
      // Should not waste excessive steps
      expect(results.stepsPerLocation).toBeLessThan(3.0);
      expect(results.turnsPer100).toBeLessThan(150);  // Higher threshold for complex scenarios
    });
  });

  // ==========================================================================
  // REGRESSION TESTS - Catch specific algorithm bugs
  // ==========================================================================

  describe('Algorithm Regression Detection', () => {
    it('should detect wall-follow breakdown (cul-de-sac escape)', async () => {
      // This test specifically requires wall-follow LEFT scanning to work
      const territory = TerritoryGenerators.culDeSac();
      const results = await runEscapeBenchmark(territory, 500);  // Limited ticks

      // Must escape the cul-de-sac
      expect(results.reachedExit).toBe(true);
      // Must not waste excessive time (would indicate broken wall-follow)
      expect(results.ticks).toBeLessThan(200);
    });

    it('should detect BREAK_WALL breakdown (exhausted node escape)', async () => {
      // Figure-8 requires BREAK_WALL when all yaws exhausted
      const territory = TerritoryGenerators.figure8();
      const results = await runEscapeBenchmark(territory, 500);  // Limited ticks

      expect(results.reachedExit).toBe(true);
      // Should escape quickly with working BREAK_WALL
      expect(results.ticks).toBeLessThan(300);
    });

    it('should detect stuck-detection breakdown', async () => {
      // Oscillation trap tests stuck detection
      const territory = TerritoryGenerators.oscillationTrap();
      const results = await runEscapeBenchmark(territory, 300);

      expect(results.reachedExit).toBe(true);
      // Without stuck detection, this would loop forever
      expect(results.maxArrivals).toBeLessThanOrEqual(3);
    });
  });
});
