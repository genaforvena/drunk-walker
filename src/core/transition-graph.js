/**
 * Transition Graph for Drunk Walker
 * 
 * Learns actual Street View connectivity from observed transitions
 * instead of relying on mathematical prediction
 * 
 * Key Insight: Google Street View yaw drifts along paths
 * - Average yaw delta (A→B vs B→A): 125.8° (not 180°!)
 * - Only 7% of bidirectional pairs have expected 180° delta
 * - Mathematical prediction fails for ~60% of nodes
 * 
 * Solution: Learn from actual transitions (100% accurate for learned nodes)
 */

export class TransitionGraph {
  constructor() {
    // location -> Set<connectedLocations>
    this.connections = new Map();
    
    // "loc1->loc2" -> Array<{fromYaw, toYaw, timestamp}>
    this.transitions = new Map();
    
    // Statistics
    this.stats = {
      totalTransitions: 0,
      uniqueConnections: 0
    };
  }

  /**
   * Record a transition from one location to another
   * @param {string} fromLoc - Starting location "lat,lng"
   * @param {string} toLoc - Destination location "lat,lng"
   * @param {number} fromYaw - Yaw at starting location
   * @param {number} toYaw - Yaw at destination location
   */
  record(fromLoc, toLoc, fromYaw, toYaw) {
    if (!fromLoc || !toLoc || fromLoc === toLoc) return;
    
    // Record connection
    if (!this.connections.has(fromLoc)) {
      this.connections.set(fromLoc, new Set());
    }
    const wasNew = !this.connections.get(fromLoc).has(toLoc);
    this.connections.get(fromLoc).add(toLoc);
    
    if (wasNew) {
      this.stats.uniqueConnections++;
    }
    
    // Record transition details
    const key = `${fromLoc}->${toLoc}`;
    if (!this.transitions.has(key)) {
      this.transitions.set(key, []);
    }
    this.transitions.get(key).push({
      fromYaw,
      toYaw,
      timestamp: Date.now()
    });
    
    this.stats.totalTransitions++;
  }

  /**
   * Get all connected locations from a given location
   * @param {string} location - Location "lat,lng"
   * @returns {Set<string>} Set of connected locations
   */
  getConnections(location) {
    return this.connections.get(location) || new Set();
  }

  /**
   * Find an unvisited escape direction from current location
   * @param {string} currentLocation - Current location "lat,lng"
   * @param {Map} visitedUrls - Map of visited locations
   * @returns {string|null} Connected unvisited location or null
   */
  findEscape(currentLocation, visitedUrls) {
    const connections = this.getConnections(currentLocation);
    
    for (const connected of connections) {
      if (!visitedUrls.has(connected)) {
        return connected;  // Found unvisited escape!
      }
    }
    
    return null;  // All learned connections are visited
  }

  /**
   * Get the average yaw correction for a transition
   * @param {string} fromLoc - Starting location
   * @param {string} toLoc - Destination location
   * @returns {number|null} Average toYaw or null if no data
   */
  getYawCorrection(fromLoc, toLoc) {
    const key = `${fromLoc}->${toLoc}`;
    const transitions = this.transitions.get(key);
    
    if (!transitions || transitions.length === 0) return null;
    
    const avgYaw = transitions.reduce((sum, t) => sum + t.toYaw, 0) / transitions.length;
    return avgYaw;
  }

  /**
   * Check if a connection exists
   * @param {string} fromLoc - Starting location
   * @param {string} toLoc - Destination location
   * @returns {boolean} True if connection exists
   */
  hasConnection(fromLoc, toLoc) {
    const connections = this.connections.get(fromLoc);
    return connections ? connections.has(toLoc) : false;
  }

  /**
   * Get bidirectional connections (A↔B)
   * @returns {Array<{a: string, b: string}>} Array of bidirectional pairs
   */
  getBidirectionalPairs() {
    const pairs = [];
    const seen = new Set();
    
    for (const [from, connections] of this.connections) {
      for (const to of connections) {
        const key = [from, to].sort().join('|');
        if (!seen.has(key) && this.hasConnection(to, from)) {
          pairs.push({ a: from, b: to });
          seen.add(key);
        }
      }
    }
    
    return pairs;
  }

  /**
   * Analyze yaw deltas for bidirectional transitions
   * @returns {Object} Statistics about yaw deltas
   */
  analyzeYawDeltas() {
    const pairs = this.getBidirectionalPairs();
    const deltas = [];
    
    for (const { a, b } of pairs) {
      const forward = this.getYawCorrection(a, b);
      const reverse = this.getYawCorrection(b, a);
      
      if (forward !== null && reverse !== null) {
        let delta = Math.abs(forward - reverse);
        if (delta > 180) delta = 360 - delta;
        deltas.push(delta);
      }
    }
    
    if (deltas.length === 0) {
      return { count: 0, avg: null, min: null, max: null };
    }
    
    return {
      count: deltas.length,
      avg: deltas.reduce((a, b) => a + b, 0) / deltas.length,
      min: Math.min(...deltas),
      max: Math.max(...deltas),
      distribution: this._getDistribution(deltas)
    };
  }

  _getDistribution(deltas) {
    const buckets = {
      '150-170': 0,
      '170-180': 0,
      '180-190': 0,
      '190-210': 0,
      'other': 0
    };
    
    deltas.forEach(d => {
      if (d >= 150 && d < 170) buckets['150-170']++;
      else if (d >= 170 && d < 180) buckets['170-180']++;
      else if (d >= 180 && d < 190) buckets['180-190']++;
      else if (d >= 190 && d < 210) buckets['190-210']++;
      else buckets.other++;
    });
    
    return buckets;
  }

  /**
   * Get graph statistics
   * @returns {Object} Graph statistics
   */
  getStats() {
    const degrees = Array.from(this.connections.values()).map(c => c.size);
    const avgDegree = degrees.length > 0 
      ? degrees.reduce((a, b) => a + b, 0) / degrees.length 
      : 0;
    
    return {
      ...this.stats,
      locations: this.connections.size,
      avgDegree: avgDegree.toFixed(2),
      linearNodes: degrees.filter(d => d === 2).length,
      branchingNodes: degrees.filter(d => d > 2).length
    };
  }

  /**
   * Clear all data
   */
  clear() {
    this.connections.clear();
    this.transitions.clear();
    this.stats = { totalTransitions: 0, uniqueConnections: 0 };
  }

  /**
   * Export graph to JSON (for persistence)
   * @returns {Object} Serializable graph data
   */
  toJSON() {
    return {
      connections: Array.from(this.connections.entries()).map(([loc, set]) => [loc, Array.from(set)]),
      transitions: Array.from(this.transitions.entries()),
      stats: this.stats
    };
  }

  /**
   * Import graph from JSON (from persistence)
   * @param {Object} data - Serialized graph data
   */
  fromJSON(data) {
    this.clear();
    
    if (data.connections) {
      for (const [loc, connections] of data.connections) {
        this.connections.set(loc, new Set(connections));
      }
    }
    
    if (data.transitions) {
      for (const [key, transitions] of data.transitions) {
        this.transitions.set(key, transitions);
      }
    }
    
    if (data.stats) {
      this.stats = data.stats;
    }
  }
}

/**
 * Create a transition graph instance
 */
export function createTransitionGraph() {
  return new TransitionGraph();
}
