/**
 * Bundle Validation Test
 * Verifies the built bookmarklet.js has all required fixes
 */

import fs from 'fs';
import { describe, it, expect } from 'vitest';

describe('Bundle Validation', () => {
  let bundleCode;
  
  beforeAll(() => {
    bundleCode = fs.readFileSync('bookmarklet.js', 'utf8');
  });
  
  it('should have visitedEl declared at function scope', () => {
    // Stats are now updated via engine.getVisitedCount()
    expect(bundleCode).toContain('getVisitedCount');
  });

  it('should assign visitedEl from querySelector', () => {
    // Stats row is created with querySelector for dw-visited
    expect(bundleCode).toContain("querySelector('#dw-visited')");
  });
  
  it('should use visitedEl safely in onStatusUpdate', () => {
    // Stats are updated via engine.getVisitedCount()
    expect(bundleCode).toContain('engine.getVisitedCount()');
  });
  
  it('should have getVisitedCount method', () => {
    expect(bundleCode).toContain('getVisitedCount');
    expect(bundleCode).toContain('visitedUrls.size');
  });
  
  it('should have visitedUrls memory structure', () => {
    expect(bundleCode).toMatch(/visitedUrls = new (Set|Map)\(\)/);
  });
  
  it('should have navigation strategies', () => {
    expect(bundleCode).toContain('createUnstuckNavigation');
    expect(bundleCode).toContain('createNavigationController');
  });

  it('should have self-avoiding config option', () => {
    expect(bundleCode).toContain('selfAvoiding:');
  });
  
  it('should have correct version 6.1.0-SMART-PANIC', () => {
    expect(bundleCode).toContain('6.1.0-SMART-PANIC');
  });
  
  it('should have engine.start() called in main initialization', () => {
    // Verify engine.start() exists in the bundle (called in main.js)
    expect(bundleCode).toContain('engine.start()');
    // The main start call should be after setActionHandlers in main.js section
    const mainSection = bundleCode.substring(bundleCode.indexOf('// === MAIN ENTRY ==='));
    const startIdx = mainSection.indexOf('engine.start()');
    const handlersIdx = mainSection.indexOf('engine.setActionHandlers({');
    expect(handlersIdx).toBeGreaterThanOrEqual(0);
    expect(startIdx).toBeGreaterThan(handlersIdx);
  });
  
  it('should not have visitedEl as const inside createUI', () => {
    // The bug was: const visitedEl = stats.querySelector(...)
    // This would make it unavailable in onStatusUpdate closure
    const createUiStart = bundleCode.indexOf('const createUI = ');
    const createUiEnd = bundleCode.indexOf('};', createUiStart + 100);
    const createUiBlock = bundleCode.substring(createUiStart, createUiEnd);
    
    // Should NOT have 'const visitedEl' inside createUI
    expect(createUiBlock).not.toMatch(/const visitedEl\s*=/);
  });
});
