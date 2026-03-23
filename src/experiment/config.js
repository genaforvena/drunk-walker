/**
 * Experiment Configuration Module
 * 
 * Provides configuration management for long-running experiments.
 * 
 * Usage:
 *   const config = createExperimentConfig();
 *   config.load();  // Load from localStorage
 *   config.apply(engine);  // Apply to engine
 * 
 * @version 1.0.0
 */

const DEFAULT_EXPERIMENT_CONFIG = {
  // Experiment identification
  name: 'untitled-experiment',
  description: '',
  startTime: null,
  
  // Target settings
  targetSteps: 10000,
  targetVisited: null,
  maxDuration: null,  // milliseconds, null = unlimited
  
  // Export settings
  exportInterval: 500,    // Export data every N steps
  autoSaveInterval: 60000,  // Auto-save every N milliseconds
  
  // Pacing (human-like behavior)
  pace: 2000,             // Base time between decisions (ms)
  paceVariance: 500,      // Random variance (ms)
  maxStepsPerHour: 1800,  // Rate limiting
  
  // Starting location
  startLocation: {
    lat: 52.360997,
    lng: 4.9245011,
    name: 'Amsterdam Center'
  },
  
  // Algorithm settings
  algorithm: 'PLEDGE',    // PLEDGE, DFS, RANDOM
  
  // Data collection
  collectImages: false,   // Don't collect images by default (TOS)
  collectGraph: true,     // Collect transition graph
  collectPath: true,      // Collect walk path
  
  // Safety limits
  maxStuckCount: 50,      // Pause if stuck too many times
  autoPauseOnCaptcha: true,
  
  // Monitoring
  enableMonitoring: true,
  logInterval: 30000,     // Log stats every 30 seconds
  
  // Recovery
  autoRecover: true,      // Auto-recover from backup on crash
  maxRecoverAttempts: 3
};

/**
 * Create experiment configuration manager
 */
export function createExperimentConfig() {
  const STORAGE_KEY = 'drunk-walker-experiment-config';
  let config = { ...DEFAULT_EXPERIMENT_CONFIG };
  let isLoaded = false;
  
  /**
   * Load configuration from localStorage
   */
  function load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        config = { ...DEFAULT_EXPERIMENT_CONFIG, ...parsed };
        isLoaded = true;
        console.log('[EXPERIMENT] Configuration loaded:', config.name);
      } else {
        console.log('[EXPERIMENT] No saved configuration, using defaults');
      }
    } catch (error) {
      console.error('[EXPERIMENT] Failed to load configuration:', error);
    }
    return config;
  }
  
  /**
   * Save configuration to localStorage
   */
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      console.log('[EXPERIMENT] Configuration saved');
    } catch (error) {
      console.error('[EXPERIMENT] Failed to save configuration:', error);
    }
  }
  
  /**
   * Update configuration values
   */
  function update(updates) {
    config = { ...config, ...updates };
    save();
    console.log('[EXPERIMENT] Configuration updated');
  }
  
  /**
   * Reset to default configuration
   */
  function reset() {
    config = { ...DEFAULT_EXPERIMENT_CONFIG };
    localStorage.removeItem(STORAGE_KEY);
    console.log('[EXPERIMENT] Configuration reset to defaults');
  }
  
  /**
   * Apply configuration to engine
   */
  function apply(engine) {
    if (!engine) return;
    
    engine.setPace(config.pace);
    
    console.log('[EXPERIMENT] Configuration applied to engine');
  }
  
  /**
   * Get current configuration
   */
  function get() {
    return { ...config };
  }
  
  /**
   * Check if experiment should stop
   */
  function shouldStop(stats) {
    if (config.targetSteps && stats.steps >= config.targetSteps) {
      return { reason: 'targetSteps', value: config.targetSteps };
    }
    
    if (config.targetVisited && stats.visited >= config.targetVisited) {
      return { reason: 'targetVisited', value: config.targetVisited };
    }
    
    if (config.maxDuration && config.startTime) {
      const elapsed = Date.now() - config.startTime;
      if (elapsed >= config.maxDuration) {
        return { reason: 'maxDuration', value: config.maxDuration };
      }
    }
    
    if (config.maxStuckCount && stats.stuckCount >= config.maxStuckCount) {
      return { reason: 'maxStuckCount', value: config.maxStuckCount };
    }
    
    return null;
  }
  
  /**
   * Start experiment (set start time)
   */
  function start() {
    config.startTime = Date.now();
    save();
    console.log('[EXPERIMENT] Started:', config.name);
  }
  
  /**
   * Get experiment statistics
   */
  function getStats(currentStats) {
    const elapsed = config.startTime ? Date.now() - config.startTime : 0;
    const remaining = config.maxDuration ? config.maxDuration - elapsed : null;
    
    return {
      name: config.name,
      steps: currentStats?.steps || 0,
      visited: currentStats?.visited || 0,
      ratio: currentStats?.steps ? (currentStats.visited / currentStats.steps).toFixed(3) : 0,
      elapsed: Math.floor(elapsed / 1000),
      remaining: remaining ? Math.floor(remaining / 1000) : null,
      progress: config.targetSteps ? (currentStats?.steps / config.targetSteps * 100).toFixed(1) : null,
      pace: config.pace,
      algorithm: config.algorithm
    };
  }
  
  // Load on creation
  load();
  
  return {
    load,
    save,
    update,
    reset,
    apply,
    get,
    shouldStop,
    start,
    getStats,
    DEFAULT: DEFAULT_EXPERIMENT_CONFIG
  };
}

export default createExperimentConfig;
