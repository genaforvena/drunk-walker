/**
 * Yaw Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeAngle,
  yawDifference,
  getLeftTurnAngle,
  getTurnDirection,
  calculateYawFromMove,
  calculateForwardBearing,
  getYawBuckets,
  getUntriedYaws
} from './yaw.js';

describe('normalizeAngle', () => {
  it('should handle positive angles', () => {
    expect(normalizeAngle(90)).toBe(90);
    expect(normalizeAngle(180)).toBe(180);
    expect(normalizeAngle(270)).toBe(270);
  });

  it('should handle angles >= 360', () => {
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(450)).toBe(90);
    expect(normalizeAngle(720)).toBe(0);
  });

  it('should handle negative angles', () => {
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(-180)).toBe(180);
    expect(normalizeAngle(-270)).toBe(90);
  });
});

describe('yawDifference', () => {
  it('should return 0 for same angle', () => {
    expect(yawDifference(90, 90)).toBe(0);
    expect(yawDifference(0, 0)).toBe(0);
  });

  it('should handle small differences', () => {
    expect(yawDifference(90, 60)).toBe(30);
    expect(yawDifference(60, 90)).toBe(30);
  });

  it('should handle wrap-around differences', () => {
    expect(yawDifference(350, 10)).toBe(20);
    expect(yawDifference(10, 350)).toBe(20);
  });

  it('should handle opposite directions', () => {
    expect(yawDifference(0, 180)).toBe(180);
    expect(yawDifference(90, 270)).toBe(180);
  });

  it('should return shortest distance', () => {
    expect(yawDifference(0, 270)).toBe(90);
    expect(yawDifference(270, 0)).toBe(90);
  });
});

describe('getLeftTurnAngle', () => {
  it('should return 0 for same angle', () => {
    expect(getLeftTurnAngle(90, 90)).toBe(0);
  });

  it('should calculate left turn angle', () => {
    expect(getLeftTurnAngle(90, 0)).toBe(90);
    expect(getLeftTurnAngle(180, 90)).toBe(90);
    expect(getLeftTurnAngle(270, 180)).toBe(90);
  });

  it('should handle wrap-around', () => {
    expect(getLeftTurnAngle(0, 270)).toBe(90);
    expect(getLeftTurnAngle(90, 0)).toBe(90);
  });

  it('should handle right turns (return left equivalent)', () => {
    expect(getLeftTurnAngle(0, 90)).toBe(270);
    expect(getLeftTurnAngle(90, 180)).toBe(270);
  });
});

describe('getTurnDirection', () => {
  it('should return left for smaller left angle', () => {
    expect(getTurnDirection(0, 270)).toBe('left');
    expect(getTurnDirection(90, 0)).toBe('left');
  });

  it('should return right for smaller right angle', () => {
    expect(getTurnDirection(0, 90)).toBe('right');
    expect(getTurnDirection(270, 0)).toBe('right');
  });

  it('should return left for equal angles', () => {
    expect(getTurnDirection(90, 90)).toBe('left');
  });
});

describe('calculateYawFromMove', () => {
  it('should return null for same location', () => {
    expect(calculateYawFromMove('52.37,4.87', '52.37,4.87')).toBeNull();
  });

  it('should return null for null inputs', () => {
    expect(calculateYawFromMove(null, '52.37,4.87')).toBeNull();
    expect(calculateYawFromMove('52.37,4.87', null)).toBeNull();
  });

  it('should calculate yaw for north movement', () => {
    const yaw = calculateYawFromMove('52.37,4.87', '52.38,4.87');
    expect(yaw).toBe(0);
  });

  it('should calculate yaw for east movement', () => {
    const yaw = calculateYawFromMove('52.37,4.87', '52.37,4.88');
    expect(yaw).toBe(90);
  });

  it('should calculate yaw for south movement', () => {
    const yaw = calculateYawFromMove('52.38,4.87', '52.37,4.87');
    expect(yaw).toBe(180);
  });

  it('should calculate yaw for west movement', () => {
    const yaw = calculateYawFromMove('52.37,4.88', '52.37,4.87');
    expect(yaw).toBe(270);
  });
});

describe('calculateForwardBearing', () => {
  it('should produce same result as calculateYawFromMove', () => {
    const from = '52.37,4.87';
    const to = '52.38,4.87';
    expect(calculateForwardBearing(from, to)).toBe(calculateYawFromMove(from, to));
  });

  it('should handle null inputs like calculateYawFromMove', () => {
    expect(calculateForwardBearing(null, '52.37,4.87')).toBeNull();
    expect(calculateForwardBearing('52.37,4.87', null)).toBeNull();
  });
});

describe('getYawBuckets', () => {
  it('should return all 6 yaw buckets', () => {
    const buckets = getYawBuckets();
    expect(buckets).toHaveLength(6);
    expect(buckets).toEqual([0, 60, 120, 180, 240, 300]);
  });
});

describe('getUntriedYaws', () => {
  it('should return all yaws when none tried', () => {
    const tried = new Set();
    const untried = getUntriedYaws(tried);
    expect(untried).toHaveLength(6);
  });

  it('should filter out tried yaws', () => {
    const tried = new Set([0, 60]);
    const untried = getUntriedYaws(tried);
    expect(untried).toHaveLength(4);
    expect(untried).not.toContain(0);
    expect(untried).not.toContain(60);
  });

  it('should return empty when all tried', () => {
    const tried = new Set([0, 60, 120, 180, 240, 300]);
    const untried = getUntriedYaws(tried);
    expect(untried).toHaveLength(0);
  });
});
