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
    // Should be declared with 'let' at the createControlPanel scope
    expect(bundleCode).toMatch(/let visitedEl = null;/);
  });
  
  it('should assign visitedEl from querySelector', () => {
    expect(bundleCode).toContain("visitedEl = stats.querySelector('#dw-visited')");
  });
  
  it('should use visitedEl safely in onStatusUpdate', () => {
    // Should check if visitedEl exists before using it
    expect(bundleCode).toMatch(/if \(visitedEl\)\s*visitedEl\.innerText/);
  });
  
  it('should have getVisitedCount method', () => {
    expect(bundleCode).toContain('getVisitedCount');
    expect(bundleCode).toContain('visitedUrls.size');
  });
  
  it('should have visitedUrls Set', () => {
    expect(bundleCode).toContain('visitedUrls = new Set()');
  });
  
  it('should have navigation strategies (createSelfAvoidingNavigation)', () => {
    expect(bundleCode).toContain('createSelfAvoidingNavigation');
    expect(bundleCode).toContain('createUnstuckNavigation');
    expect(bundleCode).toContain('createNavigationController');
  });

  it('should have self-avoiding config option', () => {
    expect(bundleCode).toContain('selfAvoiding:');
  });
  
  it('should have correct version 3.67.6', () => {
    expect(bundleCode).toContain('3.67.6-EXP');
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
