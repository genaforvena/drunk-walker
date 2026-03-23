/**
 * Experiment Monitor Module
 * 
 * Provides real-time monitoring and statistics for long-running experiments.
 * Logs progress, detects anomalies, and triggers auto-exports.
 * 
 * Usage:
 *   const monitor = createExperimentMonitor(engine, algorithm, config);
 *   monitor.start();  // Begin monitoring
 * 
 * @version 1.0.0
 */

import { createDataExporter } from './exporter.js';

const DEFAULT_MONITOR_CONFIG = {
  logInterval: 30000,       // Log stats every 30 seconds
  exportInterval: 500,      // Auto-export every 500 steps
  checkAnomalies: true,     // Detect problems
  autoPauseOnAnomaly: false // Pause on serious issues
};

/**
 * Create experiment monitor
 */
export function createExperimentMonitor(engine, algorithm, config = {}) {
  const cfg = { ...DEFAULT_MONITOR_CONFIG, ...config };
  
  let intervalId = null;
  let lastLogTime = 0;
  let lastExportStep = 0;
  let startTime = Date.now();
  let isRunning = false;
  
  // Anomaly detection state
  let anomalyState = {
    lowEfficiencyWarning: false,
    highStuckWarning: false,
    loopDetected: false
  };
  
  // Create exporter
  const exporter = createDataExporter(engine, algorithm);
  
  /**
   * Collect current statistics
   */
  function collectStats() {
    const steps = engine.getSteps();
    const visited = engine.getVisitedCount();
    const stuck = engine.getStuckCount();
    const elapsed = Date.now() - startTime;
    
    return {
      steps,
      visited,
      ratio: steps > 0 ? (visited / steps).toFixed(4) : 0,
      stuck,
      elapsedMs: elapsed,
      elapsedSec: Math.floor(elapsed / 1000),
      elapsedMin: (elapsed / 60000).toFixed(2),
      stepsPerMin: elapsed > 0 ? ((steps / elapsed) * 60000).toFixed(2) : 0,
      visitedPerMin: elapsed > 0 ? ((visited / elapsed) * 60000).toFixed(2) : 0
    };
  }
  
  /**
   * Format statistics for display
   */
  function formatStats(stats) {
    return {
      'Steps': stats.steps,
      'Unique': stats.visited,
      'Ratio': stats.ratio,
      'Stuck': stats.stuck,
      'Runtime': stats.elapsedMin + ' min',
      'Steps/min': stats.stepsPerMin,
      'Visited/min': stats.visitedPerMin
    };
  }
  
  /**
   * Check for anomalies
   */
  function checkAnomalies(stats) {
    const anomalies = [];
    
    // Low efficiency (ratio < 0.3 after 1000+ steps)
    if (cfg.checkAnomalies && stats.steps > 1000 && parseFloat(stats.ratio) < 0.3) {
      anomalies.push({
        type: 'LOW_EFFICIENCY',
        severity: 'warning',
        message: `Low efficiency detected: ratio=${stats.ratio} (expected >0.3)`
      });
      
      if (!anomalyState.lowEfficiencyWarning) {
        console.warn('⚠️ [MONITOR] LOW EFFICIENCY: Ratio', stats.ratio, 'after', stats.steps, 'steps');
        anomalyState.lowEfficiencyWarning = true;
      }
    }
    
    // High stuck count
    if (cfg.checkAnomalies && stats.stuck > 20) {
      anomalies.push({
        type: 'HIGH_STUCK_COUNT',
        severity: 'warning',
        message: `High stuck count: ${stats.stuck} (possible CAPTCHA or blocked)`
      });
      
      if (!anomalyState.highStuckWarning) {
        console.warn('⚠️ [MONITOR] HIGH STUCK COUNT:', stats.stuck, '- Possible CAPTCHA detected');
        anomalyState.highStuckWarning = true;
      }
    }
    
    // Check for loops (visited/steps ratio decreasing)
    // This would need historical data - simplified version
    
    return anomalies;
  }
  
  /**
   * Log statistics to console
   */
  function logStats() {
    const stats = collectStats();
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 DRUNK WALKER EXPERIMENT MONITOR');
    console.log('='.repeat(50));
    console.table(formatStats(stats));
    
    // Check anomalies
    const anomalies = checkAnomalies(stats);
    if (anomalies.length > 0) {
      console.log('\n⚠️ ANOMALIES DETECTED:');
      anomalies.forEach(a => {
        console.log(`  [${a.severity.toUpperCase()}] ${a.message}`);
      });
      
      if (cfg.autoPauseOnAnomaly && anomalies.some(a => a.severity === 'critical')) {
        console.log('⏸️ Auto-pausing due to critical anomaly...');
        engine.stop();
      }
    }
    
    console.log('='.repeat(50) + '\n');
    
    lastLogTime = Date.now();
  }
  
  /**
   * Auto-export if threshold reached
   */
  function autoExport() {
    const steps = engine.getSteps();
    if (steps - lastExportStep >= cfg.exportInterval && steps > 0) {
      console.log(`[MONITOR] Auto-export at step ${steps}...`);
      exporter.exportSummary();
      lastExportStep = steps;
    }
  }
  
  /**
   * Monitor tick (called at interval)
   */
  function tick() {
    logStats();
    autoExport();
  }
  
  /**
   * Start monitoring
   */
  function start() {
    if (isRunning) {
      console.log('[MONITOR] Already running');
      return;
    }
    
    startTime = Date.now();
    isRunning = true;
    
    // Initial log
    console.log('[MONITOR] Started - logging every', cfg.logInterval / 1000, 'seconds');
    logStats();
    
    // Set up interval
    intervalId = setInterval(tick, cfg.logInterval);
    
    // Expose globally
    if (typeof window !== 'undefined') {
      window.__DRUNK_WALKER_MONITOR__ = {
        getStats: collectStats,
        logStats,
        export: () => exporter.exportJSON(),
        stop
      };
    }
  }
  
  /**
   * Stop monitoring
   */
  function stop() {
    if (!isRunning) return;
    
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    
    isRunning = false;
    console.log('[MONITOR] Stopped');
    
    // Final export
    exporter.exportJSON();
    
    // Clean up global
    if (typeof window !== 'undefined') {
      delete window.__DRUNK_WALKER_MONITOR__;
    }
  }
  
  /**
   * Get current statistics
   */
  function getStats() {
    return collectStats();
  }
  
  /**
   * Get anomaly state
   */
  function getAnomalyState() {
    return { ...anomalyState };
  }
  
  /**
   * Reset anomaly warnings
   */
  function resetAnomalies() {
    anomalyState = {
      lowEfficiencyWarning: false,
      highStuckWarning: false,
      loopDetected: false
    };
    console.log('[MONITOR] Anomaly warnings reset');
  }
  
  return {
    start,
    stop,
    getStats,
    getAnomalyState,
    resetAnomalies,
    logStats,
    export: () => exporter.exportJSON(),
    exporter,
    // Exposed for testing
    intervalId,
    isRunning,
    cfg
  };
}

export default createExperimentMonitor;
