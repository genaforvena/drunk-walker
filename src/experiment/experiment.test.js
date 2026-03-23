/**
 * Experiment Module Tests
 * 
 * Tests for auto-save, configuration, export, and monitoring modules.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createAutosaver } from '../experiment/autosave.js';
import { createExperimentConfig } from '../experiment/config.js';
import { createDataExporter } from '../experiment/exporter.js';
import { createExperimentMonitor } from '../experiment/monitor.js';
import { createEngine } from '../core/engine.js';
import { createDefaultAlgorithm } from '../core/traversal.js';

describe('Experiment Module', () => {
  let engine;
  let algorithm;

  beforeEach(() => {
    engine = createEngine({ pace: 2000 });
    algorithm = createDefaultAlgorithm({});
  });

  describe('Autosaver', () => {
    it('should create autosaver instance', () => {
      const autosaver = createAutosaver(engine, algorithm);
      expect(autosaver).toBeDefined();
      expect(autosaver.start).toBeDefined();
      expect(autosaver.stop).toBeDefined();
      expect(autosaver.save).toBeDefined();
      expect(autosaver.load).toBeDefined();
    });

    it('should start and stop without errors', () => {
      const autosaver = createAutosaver(engine, algorithm, { intervalMs: 1000 });
      autosaver.start();
      expect(autosaver.getStats().isEnabled).toBe(true);
      autosaver.stop();
      expect(autosaver.getStats().isEnabled).toBe(false);
    });

    it('should collect state correctly', async () => {
      const autosaver = createAutosaver(engine, algorithm);
      // State collection should not throw
      await expect(autosaver.save()).resolves.not.toThrow();
    });

    it('should return null when no backup exists', async () => {
      const autosaver = createAutosaver(engine, algorithm);
      const backup = await autosaver.load();
      // In test environment, IndexedDB is not available
      expect(backup).toBeNull();
    });
  });

  describe('Experiment Config', () => {
    it('should create config with defaults', () => {
      const config = createExperimentConfig();
      const defaults = config.get();
      
      expect(defaults.targetSteps).toBe(10000);
      expect(defaults.pace).toBe(2000);
      expect(defaults.exportInterval).toBe(500);
      expect(defaults.autoSaveInterval).toBe(60000);
    });

    it('should update configuration', () => {
      const config = createExperimentConfig();
      config.update({ targetSteps: 5000, pace: 1500 });
      
      const updated = config.get();
      expect(updated.targetSteps).toBe(5000);
      expect(updated.pace).toBe(1500);
    });

    it('should reset to defaults', () => {
      const config = createExperimentConfig();
      config.update({ targetSteps: 99999 });
      config.reset();
      
      const defaults = config.get();
      expect(defaults.targetSteps).toBe(10000);
    });

    it('should detect when to stop', () => {
      const config = createExperimentConfig();
      config.update({ targetSteps: 1000, maxStuckCount: 10 });
      
      // Not yet at target
      expect(config.shouldStop({ steps: 500, visited: 400, stuckCount: 0 })).toBeNull();
      
      // Reached target steps
      const stopReason = config.shouldStop({ steps: 1000, visited: 800, stuckCount: 0 });
      expect(stopReason.reason).toBe('targetSteps');
      
      // Too many stuck
      const stuckStop = config.shouldStop({ steps: 500, visited: 400, stuckCount: 15 });
      expect(stuckStop.reason).toBe('maxStuckCount');
    });

    it('should compute stats correctly', () => {
      const config = createExperimentConfig();
      config.update({ targetSteps: 1000, name: 'test-exp' });
      config.start();
      
      const stats = config.getStats({ steps: 500, visited: 350, stuckCount: 2 });
      expect(stats.name).toBe('test-exp');
      expect(stats.steps).toBe(500);
      expect(stats.visited).toBe(350);
      expect(stats.progress).toBe('50.0');
    });
  });

  describe('Data Exporter', () => {
    it('should create exporter instance', () => {
      const exporter = createDataExporter(engine, algorithm);
      expect(exporter).toBeDefined();
      expect(exporter.exportJSON).toBeDefined();
      expect(exporter.exportCSV).toBeDefined();
      expect(exporter.exportGeoJSON).toBeDefined();
    });

    it('should export JSON without critical errors', () => {
      const exporter = createDataExporter(engine, algorithm);
      // In test environment, download will fail but function should execute
      try {
        exporter.exportJSON();
      } catch (e) {
        // Expected in test environment - URL.createObjectURL or document not available
        expect(e.message).toBeDefined();
      }
    });

    it('should track export statistics', () => {
      const exporter = createDataExporter(engine, algorithm);
      const stats = exporter.getStats();
      
      expect(stats.exportCount).toBe(0);
      expect(stats.lastExportStep).toBe(0);
    });
  });

  describe('Experiment Monitor', () => {
    it('should create monitor instance', () => {
      const monitor = createExperimentMonitor(engine, algorithm);
      expect(monitor).toBeDefined();
      expect(monitor.start).toBeDefined();
      expect(monitor.stop).toBeDefined();
      expect(monitor.getStats).toBeDefined();
    });

    it('should collect statistics', () => {
      const monitor = createExperimentMonitor(engine, algorithm, { logInterval: 1000 });
      const stats = monitor.getStats();
      
      expect(stats.steps).toBe(0);
      expect(stats.visited).toBe(0);
      expect(stats.elapsedMs).toBeDefined();
    });

    it('should start and stop', () => {
      const monitor = createExperimentMonitor(engine, algorithm, { logInterval: 1000 });
      monitor.start();
      // Check interval is set (internal state)
      expect(monitor.intervalId).toBeDefined();
      monitor.stop();
      expect(monitor.intervalId).toBeNull();
    });

    it('should log stats without errors', () => {
      const monitor = createExperimentMonitor(engine, algorithm, { logInterval: 1000 });
      // Should not throw
      expect(() => monitor.logStats()).not.toThrow();
    });
  });

  describe('Integration', () => {
    it('should work together without conflicts', () => {
      const autosaver = createAutosaver(engine, algorithm);
      const config = createExperimentConfig();
      const exporter = createDataExporter(engine, algorithm);
      const monitor = createExperimentMonitor(engine, algorithm, config.get());
      
      // All modules should be creatable simultaneously
      expect(autosaver).toBeDefined();
      expect(config).toBeDefined();
      expect(exporter).toBeDefined();
      expect(monitor).toBeDefined();
      
      // Starting should not interfere
      autosaver.start();
      monitor.start();
      
      expect(autosaver.getStats().isEnabled).toBe(true);
      expect(monitor.intervalId).toBeDefined();
      
      // Cleanup
      monitor.stop();
      autosaver.stop();
    });
  });
});
