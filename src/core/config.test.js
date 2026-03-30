/**
 * Config Module Tests
 */

import { describe, it, expect } from 'vitest';
import { CONFIG, YAW_BUCKETS } from './config.js';

describe('CONFIG', () => {
  it('should have all required sections', () => {
    expect(CONFIG).toHaveProperty('engine');
    expect(CONFIG).toHaveProperty('stuck');
    expect(CONFIG).toHaveProperty('bearing');
    expect(CONFIG).toHaveProperty('wallFollow');
    expect(CONFIG).toHaveProperty('yawBuckets');
    expect(CONFIG).toHaveProperty('node');
    expect(CONFIG).toHaveProperty('deadPocket');
    expect(CONFIG).toHaveProperty('breadcrumbs');
    expect(CONFIG).toHaveProperty('logs');
    expect(CONFIG).toHaveProperty('click');
    expect(CONFIG).toHaveProperty('graph');
  });

  describe('engine', () => {
    it('should have valid pace', () => {
      expect(CONFIG.engine.pace).toBe(2000);
      expect(CONFIG.engine.turnDuration).toBe(600);
      expect(CONFIG.engine.turnCooldownTicks).toBe(2);
    });
  });

  describe('stuck', () => {
    it('should have stuck detection thresholds', () => {
      expect(CONFIG.stuck.threshold).toBe(20);
      expect(CONFIG.stuck.panicThreshold).toBe(3);
      expect(CONFIG.stuck.fastFailStuckCount).toBe(2);
    });
  });

  describe('bearing', () => {
    it('should have bearing thresholds', () => {
      expect(CONFIG.bearing.faceForwardDiff).toBe(40);
      expect(CONFIG.bearing.tolerance).toBe(20);
      expect(CONFIG.bearing.wallFollowDiff).toBe(10);
    });
  });

  describe('wallFollow', () => {
    it('should have wall-follow config', () => {
      expect(CONFIG.wallFollow.turnAngle).toBe(105);
      expect(CONFIG.wallFollow.leftArcMin).toBe(90);
      expect(CONFIG.wallFollow.leftArcMax).toBe(180);
    });
  });

  describe('yawBuckets', () => {
    it('should have 6 yaw buckets', () => {
      expect(YAW_BUCKETS).toHaveLength(6);
      expect(YAW_BUCKETS).toEqual([0, 60, 120, 180, 240, 300]);
    });
  });

  describe('node', () => {
    it('should have node exploration config', () => {
      expect(CONFIG.node.fullyExploredThreshold).toBe(5);
      expect(CONFIG.node.maxYaws).toBe(6);
    });
  });

  describe('deadPocket', () => {
    it('should have dead pocket detection config', () => {
      expect(CONFIG.deadPocket.maxDetections).toBe(3);
      expect(CONFIG.deadPocket.componentCheckCount).toBe(3);
    });
  });

  describe('breadcrumbs', () => {
    it('should have breadcrumbs config', () => {
      expect(CONFIG.breadcrumbs.maxLength).toBe(200);
    });
  });

  describe('logs', () => {
    it('should have logs config', () => {
      expect(CONFIG.logs.maxSessionLogs).toBe(5000);
    });
  });
});
