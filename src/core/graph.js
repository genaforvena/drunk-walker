/**
 * Enhanced Transition Graph - Graph Memory for PLEDGE Algorithm
 */

import { CONFIG, YAW_BUCKETS } from './config.js';
import { normalizeAngle } from './yaw.js';

export class NodeInfo {
  constructor(location, lat, lng, step) {
    this.location = location;
    this.lat = lat;
    this.lng = lng;
    this.triedYaws = new Set();
    this.successfulYaws = new Set();
    this.isFullyExplored = false;
  }

  recordAttempt(yaw, success, targetLocation = null) {
    const bucket = Math.round(normalizeAngle(yaw) / 60) * 60 % 360;
    this.triedYaws.add(bucket);
    if (success && targetLocation) {
      this.successfulYaws.add(bucket);
    }
    if (this.triedYaws.size >= CONFIG.node.fullyExploredThreshold) {
      this.isFullyExplored = true;
    }
  }

  hasUntriedYaws() {
    return this.triedYaws.size < CONFIG.node.maxYaws;
  }
}

export class EnhancedTransitionGraph {
  constructor() {
    this.nodes = new Map();
    this.connections = new Map();
  }

  getOrCreate(location, lat, lng, step = 0) {
    if (!this.nodes.has(location)) {
      this.nodes.set(location, new NodeInfo(location, lat, lng, step));
      this.connections.set(location, new Set());
    }
    return this.nodes.get(location);
  }

  get(location) {
    return this.nodes.get(location);
  }

  getConnections(location) {
    return this.connections.get(location) || new Set();
  }

  recordMovement(fromLoc, toLoc, fromYaw, toYaw, step) {
    const fromNode = this.getOrCreate(fromLoc, parseFloat(fromLoc.split(',')[0]), parseFloat(fromLoc.split(',')[1]), step);
    const toNode = this.getOrCreate(toLoc, parseFloat(toLoc.split(',')[0]), parseFloat(toLoc.split(',')[1]), step);

    fromNode.recordAttempt(fromYaw, true, toLoc);

    const fromParts = fromLoc.split(',').map(Number);
    const toParts = toLoc.split(',').map(Number);
    const dLat = fromParts[0] - toParts[0];
    const dLng = fromParts[1] - toParts[1];
    let reverseYaw = Math.atan2(dLng, dLat) * 180 / Math.PI;
    if (reverseYaw < 0) reverseYaw += 360;
    reverseYaw = Math.round(reverseYaw);
    toNode.recordAttempt(reverseYaw, true, fromLoc);

    if (!this.connections.get(fromLoc).has(toLoc)) {
      this.connections.get(fromLoc).add(toLoc);
    }
    if (!this.connections.get(toLoc).has(fromLoc)) {
      this.connections.get(toLoc).add(fromLoc);
    }
  }

  recordFailedAttempt(location, yaw, step) {
    const parts = location.split(',');
    const node = this.getOrCreate(location, parseFloat(parts[0]), parseFloat(parts[1]), step);
    node.recordAttempt(yaw, false, null);
  }

  getStats() {
    let crossroads = 0;
    let deadEnds = 0;
    
    for (const [location, connections] of this.connections) {
      if (connections.size > 2) crossroads++;
      if (connections.size === 1) deadEnds++;
    }
    
    return {
      totalNodes: this.nodes.size,
      crossroads,
      deadEnds
    };
  }

  isCrossroad(location) {
    const connections = this.connections.get(location);
    return connections && connections.size > 2;
  }
}
