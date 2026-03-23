/**
 * Drunk Walker Experiment Module
 * 
 * Unified interface for experiment management:
 * - Auto-save for crash recovery
 * - Configuration management
 * - Data export (JSON, CSV, GeoJSON)
 * - Real-time monitoring
 * 
 * Usage:
 *   import { createExperiment } from './experiment/index.js';
 *   const experiment = createExperiment(engine, algorithm);
 *   experiment.start();
 * 
 * @version 1.0.0
 */

import { createAutosaver } from './autosave.js';
import { createExperimentConfig } from './config.js';
import { createDataExporter } from './exporter.js';
import { createExperimentMonitor } from './monitor.js';

/**
 * Create experiment manager
 * 
 * @param {Object} engine - Drunk Walker engine instance
 * @param {Object} algorithm - Traversal algorithm instance  
 * @returns {Object} Experiment API
 */
export function createExperiment(engine, algorithm) {
  // Create sub-modules
  const autosaver = createAutosaver(engine, algorithm);
  const config = createExperimentConfig();
  const exporter = createDataExporter(engine, algorithm);
  const monitor = createExperimentMonitor(engine, algorithm, config.get());
  
  let isRunning = false;
  
  /**
   * Start experiment with configuration
   */
  function start(experimentConfig = {}) {
    if (isRunning) {
      console.warn('[EXPERIMENT] Already running');
      return;
    }
    
    // Apply configuration updates
    if (Object.keys(experimentConfig).length > 0) {
      config.update(experimentConfig);
    }
    
    // Apply to engine
    const cfg = config.get();
    config.apply(engine);
    
    // Start sub-modules
    autosaver.start();
    monitor.start();
    
    // Mark experiment as started
    config.start();
    
    isRunning = true;
    
    console.log('🧪 EXPERIMENT STARTED');
    console.log('   Name:', cfg.name);
    console.log('   Target:', cfg.targetSteps, 'steps');
    console.log('   Auto-save: every', cfg.autoSaveInterval / 1000, 'seconds');
    console.log('   Export: every', cfg.exportInterval, 'steps');
    console.log('   Monitor: every', cfg.logInterval / 1000, 'seconds');
    console.log('');
    console.log('Commands:');
    console.log('  DRUNK_WALKER.experiment.stop()    - Stop experiment');
    console.log('  DRUNK_WALKER.experiment.export()  - Export data now');
    console.log('  DRUNK_WALKER.experiment.stats()   - Show statistics');
  }
  
  /**
   * Stop experiment
   */
  function stop() {
    if (!isRunning) return;
    
    console.log('\n🧪 EXPERIMENT STOPPING...');
    
    // Stop sub-modules
    monitor.stop();
    autosaver.stop();
    
    // Final export
    exporter.exportJSON();
    
    isRunning = false;
    console.log('🧪 Experiment stopped. Final export complete.');
  }
  
  /**
   * Export data manually
   */
  function exportData(format = 'json') {
    switch (format) {
      case 'json':
        return exporter.exportJSON();
      case 'csv':
        return exporter.exportCSV();
      case 'geojson':
        return exporter.exportGeoJSON();
      case 'summary':
        return exporter.exportSummary();
      default:
        console.warn('[EXPERIMENT] Unknown format:', format);
        return null;
    }
  }
  
  /**
   * Get current statistics
   */
  function getStats() {
    return {
      experiment: config.getStats({
        steps: engine.getSteps(),
        visited: engine.getVisitedCount(),
        stuckCount: engine.getStuckCount()
      }),
      monitor: monitor.getStats(),
      autosave: autosaver.getStats(),
      export: exporter.getStats()
    };
  }
  
  /**
   * Show statistics in console
   */
  function showStats() {
    const stats = getStats();
    
    console.log('\n' + '='.repeat(60));
    console.log('🧪 DRUNK WALKER EXPERIMENT STATUS');
    console.log('='.repeat(60));
    console.table(stats.experiment);
    console.log('');
    console.log('Auto-save:', stats.autosave.saveCount, 'saves');
    console.log('Exports:', stats.export.exportCount);
    console.log('='.repeat(60) + '\n');
  }
  
  /**
   * Load backup and restore
   */
  async function recover() {
    console.log('[EXPERIMENT] Attempting recovery...');
    const restored = await autosaver.restore();
    if (restored) {
      console.log('[EXPERIMENT] ✅ Recovery successful');
      return true;
    } else {
      console.log('[EXPERIMENT] ❌ No backup found or recovery failed');
      return false;
    }
  }
  
  /**
   * Update configuration
   */
  function updateConfig(updates) {
    config.update(updates);
    monitor.cfg = { ...monitor.cfg, ...updates };
  }
  
  // Expose globally
  if (typeof window !== 'undefined') {
    window.__DRUNK_WALKER_EXPERIMENT__ = {
      start,
      stop,
      export: exportData,
      stats: getStats,
      showStats,
      recover,
      updateConfig,
      config,
      autosaver,
      exporter,
      monitor
    };
  }
  
  return {
    start,
    stop,
    export: exportData,
    getStats,
    showStats,
    recover,
    updateConfig,
    config,
    autosaver,
    exporter,
    monitor
  };
}

export default createExperiment;
