/**
 * Street View Mock - Integration Test Environment
 * 
 * This creates a FAKE Street View environment that the REAL engine can run against.
 * The oracle acts as Street View:
 * - Generates URLs that look like real Street View URLs
 * - Responds to keyboard events (ArrowUp, ArrowLeft, ArrowRight)
 * - Changes URL based on movement and turns
 * 
 * This allows testing the ACTUAL algorithm with the ACTUAL engine,
 * just without real Google Street View.
 */

import { createEngine } from './engine.js';
import { TerritoryOracle } from './territory-oracle.js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// URL GENERATION (Mimics real Street View URLs)
// ============================================================================

/**
 * Generate a Street View-like URL from location and yaw
 */
function generateUrl(location, yaw) {
  const [lat, lng] = location.split(',');
  return `https://www.google.com/maps/@${lat},${lng},3a,75y,${yaw.toFixed(2)}h,90.00t/data=!3m4!1e1`;
}

/**
 * Extract location from URL
 */
function extractLocation(url) {
  const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) return `${match[1]},${match[2]}`;
  return null;
}

/**
 * Extract yaw from URL
 */
function extractYaw(url) {
  const match = url.match(/,([\d.]+)h/);
  if (match) return parseFloat(match[1]);
  return 0;
}

// ============================================================================
// TERRITORY GENERATORS
// ============================================================================

/**
 * Create a territory oracle for testing
 * @param {string} type - 'linear', 'square', or 'hex'
 * @param {number} param1 - Length (linear), width (square), or radius (hex)
 * @param {number} param2 - Height (square only)
 * @returns {TerritoryOracle}
 */
export function createTerritoryOracle(type, param1, param2) {
  let logContent = '';
  let step = 0;
  let tempFilename = '';
  
  if (type === 'linear') {
    const length = param1;
    for (let i = 0; i < length; i++) {
      const lat = (52.37 + i * 0.0001).toFixed(6);
      const lng = (4.87 + i * 0.0001).toFixed(6);
      const loc = `${lat},${lng}`;
      
      if (i > 0) {
        const prevLat = (52.37 + (i-1) * 0.0001).toFixed(6);
        const prevLng = (4.87 + (i-1) * 0.0001).toFixed(6);
        const prevLoc = `${prevLat},${prevLng}`;
        logContent += `[21:00:00] [DEBUG] currentLocation=${loc}, currentYaw=0.00, previousLocation=${prevLoc}\n`;
        logContent += `[21:00:00] 💓 [${step}] STUCK: 0 | YAW: 0° | LOC: ${loc}\n`;
        step++;
      }
    }
    tempFilename = `/tmp/linear-${length}.txt`;
    
  } else if (type === 'square') {
    const width = param1;
    const height = param2;
    for (let y = 0; y < height; y++) {
      const leftToRight = y % 2 === 0;
      for (let x = 0; x < width; x++) {
        const actualX = leftToRight ? x : (width - 1 - x);
        const lat = (52.37 + y * 0.001).toFixed(6);
        const lng = (4.87 + actualX * 0.001).toFixed(6);
        const loc = `${lat},${lng}`;
        
        let prevX = actualX - 1;
        let prevY = y;
        if (prevX < 0 && y > 0) {
          prevX = 0;
          prevY = y - 1;
        }
        
        if (prevX >= 0) {
          const prevLat = (52.37 + prevY * 0.001).toFixed(6);
          const prevLng = (4.87 + prevX * 0.001).toFixed(6);
          const prevLoc = `${prevLat},${prevLng}`;
          logContent += `[21:00:00] [DEBUG] currentLocation=${loc}, currentYaw=0.00, previousLocation=${prevLoc}\n`;
          logContent += `[21:00:00] 💓 [${step}] STUCK: 0 | YAW: 0° | LOC: ${loc}\n`;
          step++;
        }
      }
    }
    tempFilename = `/tmp/grid-${width}x${height}.txt`;
    
  } else if (type === 'hex') {
    const radius = param1;
    let prevLoc = null;
    for (let q = -radius; q <= radius; q++) {
      for (let r = -radius; r <= radius; r++) {
        if (Math.abs(q + r) > radius) continue;
        
        const lat = (52.37 + (q + radius) * 0.001).toFixed(6);
        const lng = (4.87 + (r + radius) * 0.001).toFixed(6);
        const loc = `${lat},${lng}`;
        
        if (prevLoc) {
          logContent += `[21:00:00] [DEBUG] currentLocation=${loc}, currentYaw=0.00, previousLocation=${prevLoc}\n`;
          logContent += `[21:00:00] 💓 [${step}] STUCK: 0 | YAW: 0° | LOC: ${loc}\n`;
          step++;
        }
        prevLoc = loc;
      }
    }
    tempFilename = `/tmp/hex-r${radius}.txt`;
  }
  
  // Write temp file and load as oracle
  fs.writeFileSync(tempFilename, logContent);
  return TerritoryOracle.fromWalkLog(tempFilename);
}

// ============================================================================
// STREET VIEW MOCK CLASS
// ============================================================================

/**
 * Mock Street View environment
 * Acts like real Street View but uses oracle territory data
 */
export class StreetViewMock {
  /**
   * @param {TerritoryOracle} oracle - Territory oracle with connection data
   */
  constructor(oracle) {
    this.oracle = oracle;
    this.currentLocation = null;
    this.currentYaw = 0;
    this.url = '';
    this.stuckCount = 0;
    this.lastLocation = null;
    
    // Event handlers
    this.onKeyPress = null;
    this.onMouseClick = null;
  }
  
  /**
   * Initialize at a starting location
   */
  initialize(startLocation, startYaw = 0) {
    this.currentLocation = startLocation;
    this.currentYaw = startYaw;
    this.url = generateUrl(startLocation, startYaw);
    this.stuckCount = 0;
    this.lastLocation = null;
    return this.url;
  }
  
  /**
   * Get current URL (called by engine)
   */
  getUrl() {
    return this.url;
  }
  
  /**
   * Handle keyboard events (called by engine)
   */
  handleKeyPress(key) {
    this.lastLocation = this.currentLocation;
    
    if (key === 'ArrowUp') {
      this._moveForward();
    } else if (key === 'ArrowLeft') {
      this.currentYaw = (this.currentYaw - 60 + 360) % 360;
      this.url = generateUrl(this.currentLocation, this.currentYaw);
    } else if (key === 'ArrowRight') {
      this.currentYaw = (this.currentYaw + 60) % 360;
      this.url = generateUrl(this.currentLocation, this.currentYaw);
    }
    
    return this.url;
  }
  
  /**
   * Move forward based on current yaw
   * 
   * REALISTIC BEHAVIOR: Only moves if facing a valid connection direction.
   * Does NOT pick the "best" connection - algorithm must align properly.
   */
  _moveForward() {
    const connections = this.oracle.getConnections(this.currentLocation);
    if (connections.length === 0) {
      this.stuckCount++;
      return;  // No connections
    }

    // Check if current yaw aligns with ANY connection (within ±30° = one yaw bucket)
    // Real Street View: you move in the direction you're facing, not the "best" direction
    let alignedConn = null;
    
    for (const conn of connections) {
      const yawDiff = Math.abs(conn.exactYaw - this.currentYaw);
      const normalizedDiff = yawDiff > 180 ? 360 - yawDiff : yawDiff;

      // Only allow movement if facing within ±30° of connection yaw
      // This forces algorithm to properly align before moving
      if (normalizedDiff <= 30) {
        alignedConn = conn;
        break;  // Take first aligned connection (not necessarily "best")
      }
    }

    // Move if aligned with a connection
    if (alignedConn) {
      if (alignedConn.targetLocation !== this.currentLocation) {
        this.currentLocation = alignedConn.targetLocation;
        this.currentYaw = alignedConn.exactToYaw || this.currentYaw;
        this.stuckCount = 0;
      } else {
        this.stuckCount++;
      }
    } else {
      // Not aligned with any connection - stuck!
      this.stuckCount++;
    }

    this.url = generateUrl(this.currentLocation, this.currentYaw);
  }
  
  /**
   * Check if stuck (same location for too many moves)
   */
  isStuck() {
    return this.stuckCount > 10;
  }
  
  /**
   * Escape stuck situation
   */
  escapeStuck() {
    // Force a random turn
    this.currentYaw = (this.currentYaw + 120) % 360;
    this.url = generateUrl(this.currentLocation, this.currentYaw);
    this.stuckCount = 0;
  }
}

// ============================================================================
// INTEGRATION TEST HELPER
// ============================================================================

/**
 * Run the REAL engine against a mock Street View environment
 * @param {TerritoryOracle} oracle - Territory oracle
 * @param {Object} config - Engine configuration
 * @param {number} maxSteps - Maximum steps to run
 * @returns {Object} - Test results
 */
export function runIntegrationTest(oracle, config = {}, maxSteps = 1000) {
  // Create mock Street View
  const mockSV = new StreetViewMock(oracle);

  // Create REAL engine
  const engine = createEngine({
    pace: 0,  // Instant (no delay)
    kbOn: true,  // Keyboard mode
    ...config
  });

  // Get all locations from oracle
  const allLocations = oracle.getAllLocations();
  if (allLocations.length === 0) {
    return { error: 'Empty territory' };
  }

  // Initialize at first location
  const startLocation = allLocations[0];
  mockSV.initialize(startLocation);

  // Set up action handlers
  engine.setActionHandlers({
    keyPress: (key) => {
      mockSV.handleKeyPress(key);
      // Sync wheel orientation with mock's yaw (critical for algorithm!)
      engine.setCurrentYaw(mockSV.currentYaw);
    },
    mouseClick: (x, y) => {
      mockSV.handleKeyPress('ArrowUp');
      engine.setCurrentYaw(mockSV.currentYaw);
    },
    statusUpdate: () => {},
    longKeyPress: () => {},
    walkStop: () => {}
  });

  // Set engine to WALKING status for testing (don't use start() which creates interval)
  engine.setStatus('WALKING');
  
  // Sync wheel orientation with mock's yaw (critical for algorithm to work!)
  // The algorithm uses wheel.getOrientation() but mock has its own yaw
  // We need to keep them in sync
  const wheel = engine.getCurrentYaw ? null : null;  // Can't access wheel directly
  
  // Track metrics
  const visitedLocations = new Map();
  let maxVisits = 0;
  let successfulMoves = 0;
  let lastLocation = null;
  const visitedUrls = engine.getVisitedUrls();

  // Run engine tick by tick
  for (let tick = 0; tick < maxSteps && visitedUrls.size < allLocations.length; tick++) {
    // Get location BEFORE tick
    const urlBefore = mockSV.getUrl();
    const locationBefore = extractLocation(urlBefore);

    // Check if stuck and escape
    if (mockSV.isStuck()) {
      mockSV.escapeStuck();
    }

    // Tick the engine (this will call keyPress handler which updates mock)
    engine.tick();

    // Get location AFTER tick
    const urlAfter = mockSV.getUrl();
    const locationAfter = extractLocation(urlAfter);

    // Track visits (only count when we're at a location)
    const count = (visitedLocations.get(locationAfter) || 0) + 1;
    visitedLocations.set(locationAfter, count);
    if (count > maxVisits) maxVisits = count;

    // Count successful moves
    if (locationAfter !== locationBefore) {
      successfulMoves++;
    }

    lastLocation = locationAfter;
  }

  // Calculate metrics
  const uniqueLocations = visitedLocations.size;
  const totalTerritorySize = allLocations.length;
  const coveragePercent = totalTerritorySize > 0 ? (uniqueLocations / totalTerritorySize) * 100 : 0;

  return {
    steps: successfulMoves,
    uniqueLocations,
    totalTerritorySize,
    coveragePercent,
    maxVisits,
    stepsPerLocation: uniqueLocations > 0 ? successfulMoves / uniqueLocations : 0,
    visitedStepsRatio: successfulMoves > 0 ? uniqueLocations / successfulMoves : 0,
    finalUrl: mockSV.getUrl(),
    totalTicks: maxSteps
  };
}
