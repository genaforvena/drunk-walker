/**
 * Centralized Configuration for Drunk Walker
 * All magic numbers and tunable parameters in one place
 */

export const CONFIG = {
  // Engine timing
  engine: {
    pace: 2000,
    turnDuration: 600,
    turnCooldownTicks: 2
  },

  // Stuck detection
  stuck: {
    threshold: 20,
    panicThreshold: 3,
    fastFailStuckCount: 2
  },

  // Bearing/orientation
  bearing: {
    faceForwardDiff: 40,
    tolerance: 20,
    wallFollowDiff: 10,
    maxLeftDiff: 150,
    maxRightDiff: 165
  },

  // Wall-follow configuration
  wallFollow: {
    turnAngle: 105,
    leftArcMin: 90,
    leftArcMax: 180
  },

  // Yaw buckets (Street View's 6 directions)
  yawBuckets: [0, 60, 120, 180, 240, 300],

  // Node exploration
  node: {
    fullyExploredThreshold: 5,
    maxYaws: 6
  },

  // Dead pocket detection
  deadPocket: {
    maxDetections: 3,
    componentCheckCount: 3
  },

  // Breadcrumbs
  breadcrumbs: {
    maxLength: 200
  },

  // Session logs
  logs: {
    maxSessionLogs: 5000
  },

  // Mouse click targets
  click: {
    targetX: 0.4,
    targetY: 0.8,
    radius: 50
  },

  // Graph memory
  graph: {
    maxConnectionsPerNode: 10
  }
};

export const YAW_BUCKETS = CONFIG.yawBuckets;
