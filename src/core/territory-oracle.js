/**
 * Territory Oracle - Mock Street View for Deterministic Replay
 * 
 * Creates a mock "territory" from walk log data that acts as an oracle:
 * - Knows which yaws lead to which locations (from actual walk data)
 * - Allows reverse connections (if A→B worked, B→A is allowed)
 * - Acts like real Street View for testing algorithm changes
 * 
 * USAGE:
 * ```javascript
 * const oracle = TerritoryOracle.fromWalkLog('walks/dw-logs-*.txt');
 * const result = oracle.tryMove(location, yawBucket);
 * ```
 */

import * as fs from 'fs';

/**
 * Normalize angle to [0, 360)
 */
function normalizeAngle(angle) {
  angle = angle % 360;
  if (angle < 0) angle += 360;
  return angle;
}

/**
 * Calculate yaw bucket (0, 60, 120, 180, 240, 300)
 */
function getYawBucket(yaw) {
  return Math.round(normalizeAngle(yaw) / 60) * 60 % 360;
}

export class TerritoryOracle {
  constructor() {
    // Map: location → Map<yawBucket, Connection[]>
    // Each connection: { targetLocation, exactYaw, isReverse }
    this.connections = new Map();
    
    // Map: location → visit count (from original walk)
    this.visitCounts = new Map();
    
    // Set of all known locations
    this.knownLocations = new Set();
    
    // Original walk steps (for replay comparison)
    this.originalSteps = [];
  }

  /**
   * Create oracle from walk log file
   */
  static fromWalkLog(filePath) {
    const oracle = new TerritoryOracle();
    const content = fs.readFileSync(filePath, 'utf-8');
    oracle.parseWalkLog(content);
    return oracle;
  }

  /**
   * Parse walk log and extract territory knowledge
   * Handles new format: [DEBUG] currentLocation=X,Y, currentYaw=Z, previousLocation=A,B
   */
  parseWalkLog(content) {
    const lines = content.split('\n');
    let previousLocation = null;
    let previousYaw = null;
    let stepIndex = 0;

    for (const line of lines) {
      // Parse DEBUG line with location info:
      // [DEBUG] currentLocation=31.8022848,35.2096765, currentYaw=195.58..., previousLocation=31.802331,35.2095847
      const debugMatch = line.match(/\[DEBUG\] currentLocation=([\d.-]+),([\d.-]+),\s*currentYaw=([\d.]+),\s*previousLocation=([\d.-]+),([\d.-]+)/);
      
      if (debugMatch) {
        const lat = debugMatch[1];
        const lng = debugMatch[2];
        const yaw = parseFloat(debugMatch[3]);
        const prevLat = debugMatch[4];
        const prevLng = debugMatch[5];
        
        const location = `${lat},${lng}`;
        const prevLocation = `${prevLat},${prevLng}`;

        this.knownLocations.add(location);
        
        // Track visit count
        const count = this.visitCounts.get(location) || 0;
        this.visitCounts.set(location, count + 1);

        // If location changed, record the connection
        if (prevLocation && prevLocation !== location && prevLocation !== 'null,null') {
          this.recordConnection(prevLocation, location, previousYaw || yaw, yaw);
          this.knownLocations.add(prevLocation);
        }

        // Store original step for replay comparison
        this.originalSteps.push({
          step: stepIndex,
          location,
          yaw,
          previousLocation: prevLocation !== 'null,null' ? prevLocation : null,
          moved: previousLocation !== location
        });

        previousLocation = location;
        previousYaw = yaw;
        stepIndex++;
      }

      // Parse heart beat for stuck count: 💓 [291] STUCK: 0 | YAW: 295° | LOC: 52.3881675,4.8890385
      const heartbeatMatch = line.match(/💓 \[(\d+)\] STUCK: (\d+) \| YAW: (\d+)° \| LOC: ([\d.-]+),([\d.-]+)/);
      if (heartbeatMatch) {
        // Update stuck count for last step
        if (this.originalSteps.length > 0) {
          const lastStep = this.originalSteps[this.originalSteps.length - 1];
          lastStep.stuckCount = parseInt(heartbeatMatch[2]);
        }
      }
    }

    // Add reverse connections (if A→B exists, B→A should exist)
    this.addReverseConnections();
  }

  /**
   * Record a connection from observed movement
   */
  recordConnection(fromLoc, toLoc, fromYaw, toYaw) {
    const yawBucket = getYawBucket(fromYaw);

    if (!this.connections.has(fromLoc)) {
      this.connections.set(fromLoc, new Map());
    }

    const fromConnections = this.connections.get(fromLoc);
    
    // Store ALL connections for this bucket (array, not single)
    if (!fromConnections.has(yawBucket)) {
      fromConnections.set(yawBucket, []);
    }
    
    const bucketConnections = fromConnections.get(yawBucket);
    
    // Check if this exact connection already exists
    const exists = bucketConnections.some(c => c.targetLocation === toLoc);
    if (!exists) {
      bucketConnections.push({
        targetLocation: toLoc,
        exactYaw: fromYaw,
        exactToYaw: toYaw
      });
    }
  }

  /**
   * Add reverse connections (geometric guarantee)
   * If A→B at yaw X, then B→A at reverse yaw should work
   */
  addReverseConnections() {
    for (const [fromLoc, connections] of this.connections.entries()) {
      for (const [yawBucket, connArray] of connections.entries()) {
        for (const conn of connArray) {
          const toLoc = conn.targetLocation;
          
          // Calculate reverse yaw (geometric)
          const reverseYaw = this.calculateReverseYaw(fromLoc, toLoc);
          const reverseBucket = getYawBucket(reverseYaw);

          if (!this.connections.has(toLoc)) {
            this.connections.set(toLoc, new Map());
          }

          const toConnections = this.connections.get(toLoc);
          
          // Add reverse connection if not already present
          if (!toConnections.has(reverseBucket)) {
            toConnections.set(reverseBucket, []);
          }
          
          const reverseConns = toConnections.get(reverseBucket);
          const exists = reverseConns.some(c => c.targetLocation === fromLoc);
          if (!exists) {
            reverseConns.push({
              targetLocation: fromLoc,
              exactYaw: reverseYaw,
              isReverse: true  // Mark as inferred (not observed)
            });
          }
        }
      }
    }
  }

  /**
   * Calculate reverse yaw from coordinates
   */
  calculateReverseYaw(fromLoc, toLoc) {
    const fromParts = fromLoc.split(',').map(Number);
    const toParts = toLoc.split(',').map(Number);
    
    // FROM neighbor TO current (reverse direction)
    const dLat = fromParts[0] - toParts[0];
    const dLng = fromParts[1] - toParts[1];
    
    let yaw = Math.atan2(dLng, dLat) * 180 / Math.PI;
    if (yaw < 0) yaw += 360;
    
    return yaw;
  }

  /**
   * Try to move from location at given yaw bucket
   * If multiple connections exist, pick the one closest to current yaw
   * @returns { success: boolean, targetLocation?: string, isReverse?: boolean }
   */
  tryMove(location, yawBucket, exactYaw = null) {
    const connections = this.connections.get(location);
    if (!connections) {
      return { success: false, reason: 'unknown_location' };
    }

    const bucketConns = connections.get(yawBucket);
    if (!bucketConns || bucketConns.length === 0) {
      return { success: false, reason: 'blocked' };
    }

    // If only one connection, use it
    if (bucketConns.length === 1) {
      const conn = bucketConns[0];
      return {
        success: true,
        targetLocation: conn.targetLocation,
        isReverse: conn.isReverse || false
      };
    }

    // Multiple connections - pick closest to exactYaw
    if (exactYaw !== null) {
      let bestConn = null;
      let bestDiff = Infinity;

      for (const conn of bucketConns) {
        const diff = Math.abs(normalizeAngle(conn.exactYaw) - normalizeAngle(exactYaw));
        if (diff < bestDiff) {
          bestDiff = diff;
          bestConn = conn;
        }
      }

      if (bestConn) {
        return {
          success: true,
          targetLocation: bestConn.targetLocation,
          isReverse: bestConn.isReverse || false
        };
      }
    }

    // No exact yaw provided - use first connection
    const conn = bucketConns[0];
    return {
      success: true,
      targetLocation: conn.targetLocation,
      isReverse: conn.isReverse || false
    };
  }

  /**
   * Get all known connections from a location
   */
  getConnections(location) {
    const connections = this.connections.get(location);
    if (!connections) {
      return [];
    }

    const result = [];
    for (const [bucket, connArray] of connections.entries()) {
      for (const conn of connArray) {
        result.push({
          yawBucket: bucket,
          targetLocation: conn.targetLocation,
          isReverse: conn.isReverse || false,
          exactYaw: conn.exactYaw
        });
      }
    }
    return result;
  }

  /**
   * Get visit count for a location (from original walk)
   */
  getVisitCount(location) {
    return this.visitCounts.get(location) || 0;
  }

  /**
   * Check if location is known
   */
  isKnownLocation(location) {
    return this.knownLocations.has(location);
  }

  /**
   * Get all known locations
   */
  getAllLocations() {
    return Array.from(this.knownLocations);
  }

  /**
   * Get territory statistics
   */
  getStats() {
    const totalConnections = Array.from(this.connections.values())
      .reduce((sum, conns) => sum + Array.from(conns.values()).reduce((s, arr) => s + arr.length, 0), 0);
    
    return {
      totalLocations: this.knownLocations.size,
      totalConnections,
      originalSteps: this.originalSteps.length,
      avgConnectionsPerNode: this.knownLocations.size > 0 ? totalConnections / this.knownLocations.size : 0
    };
  }

  /**
   * Replay original walk and verify oracle matches
   */
  verifyOracle() {
    const errors = [];
    let previousLocation = null;
    let previousYaw = null;

    for (const step of this.originalSteps) {
      if (previousLocation && previousLocation !== step.location && step.moved) {
        // Verify connection exists
        const yawBucket = getYawBucket(previousYaw);
        const result = this.tryMove(previousLocation, yawBucket, previousYaw);
        
        if (!result.success) {
          errors.push({
            step: step.step,
            from: previousLocation,
            to: step.location,
            yaw: previousYaw,
            error: 'missing_connection'
          });
        } else if (result.targetLocation !== step.location) {
          // This can happen with multiple connections in same bucket
          // Check if the actual location is at least in the connections
          const connections = this.getConnections(previousLocation);
          const hasConnection = connections.some(c => 
            c.yawBucket === yawBucket && c.targetLocation === step.location
          );
          if (!hasConnection) {
            errors.push({
              step: step.step,
              from: previousLocation,
              expected: step.location,
              actual: result.targetLocation,
              error: 'wrong_target'
            });
          }
        }
      }

      previousLocation = step.location;
      previousYaw = step.yaw;
    }

    return {
      valid: errors.length === 0,
      errors,
      totalSteps: this.originalSteps.length,
      verifiedSteps: this.originalSteps.length - errors.length
    };
  }
}
