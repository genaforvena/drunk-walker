/**
 * Bundled Bookmarklet Validation Tests
 * Validates the bookmarklet.js build output
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { execSync } from 'child_process';

describe('Bundled Bookmarklet Validation', () => {
  let bookmarkletCode;

  beforeAll(() => {
    // Ensure fresh build
    execSync('npm run build', { stdio: 'pipe' });
    bookmarkletCode = fs.readFileSync('bookmarklet.js', 'utf8');
  });

  describe('Build Output', () => {
    it('should create bookmarklet.js file', () => {
      expect(fs.existsSync('bookmarklet.js')).toBe(true);
    });

    it('should be wrapped in IIFE', () => {
      expect(bookmarkletCode).toMatch(/\(\(\)\s*=>\s*\{/);
      expect(bookmarkletCode).toMatch(/\}\(\);[\s\n]*$/);
    });

    it('should have version header', () => {
      expect(bookmarkletCode).toContain('Drunk Walker v6.1.5');
    });

    it('should prevent multiple instances', () => {
      expect(bookmarkletCode).toContain('if (window.DRUNK_WALKER)');
      expect(bookmarkletCode).toContain('window.DRUNK_WALKER_ACTIVE = true;');
    });
  });

  describe('Core Engine Module', () => {
    it('should contain createEngine function', () => {
      expect(bookmarkletCode).toContain('function createEngine(config = {})');
    });

    it('should have default config with keyboard mode ON', () => {
      expect(bookmarkletCode).toContain('kbOn: true');
      expect(bookmarkletCode).toContain('pace: 2000');
    });

    it('should have navigation tick function', () => {
      expect(bookmarkletCode).toContain('const tick = () => {');
    });

    it('should have start/stop functions', () => {
      expect(bookmarkletCode).toContain('const start = () => {');
      expect(bookmarkletCode).toContain('const stop = () => {');
    });

    it('should have keyboard mode logic', () => {
      expect(bookmarkletCode).toContain('if (cfg.kbOn)');
      expect(bookmarkletCode).toContain("'ArrowUp'");
    });

    it('should have click mode logic', () => {
      expect(bookmarkletCode).toContain('calculateClickTarget');
      expect(bookmarkletCode).toContain('targetX: 0.4');
      expect(bookmarkletCode).toContain('targetY: 0.8');
    });
  });

  describe('Input Handlers Module', () => {
    it('should contain simulateKeyPress function', () => {
      expect(bookmarkletCode).toContain('function simulateKeyPress(key, target = null)');
    });

    it('should contain simulateClick function', () => {
      expect(bookmarkletCode).toContain('function simulateClick(x, y, showMarker = true)');
    });

    it('should have keyboard event dispatch', () => {
      expect(bookmarkletCode).toContain("new KeyboardEvent('keydown'");
      expect(bookmarkletCode).toContain("new KeyboardEvent('keypress'");
      expect(bookmarkletCode).toContain("new KeyboardEvent('keyup'");
    });

    it('should have mouse event dispatch', () => {
      expect(bookmarkletCode).toContain("new MouseEvent('mousedown'");
      expect(bookmarkletCode).toContain("new MouseEvent('mouseup'");
      expect(bookmarkletCode).toContain("new MouseEvent('click'");
    });

    it('should target Street View canvas', () => {
      expect(bookmarkletCode).toContain("document.querySelector('canvas')");
    });
  });

  describe('UI Controller Module', () => {
    it('should contain createControlPanel function', () => {
      expect(bookmarkletCode).toContain('function createControlPanel(engine, options = {})');
    });

    it('should have auto-start option', () => {
      expect(bookmarkletCode).toContain('autoStart:');
    });

    it('should create control panel UI', () => {
      expect(bookmarkletCode).toContain('dw-float-ui');
      expect(bookmarkletCode).toContain('▶</span> START');
      expect(bookmarkletCode).toContain('⏹</span> STOP');
    });

    it('should have pace slider', () => {
      expect(bookmarkletCode).toContain('type="range"');
      expect(bookmarkletCode).toContain('paceSlider');
    });
  });

  describe('Main Entry Point', () => {
    it('should initialize engine with keyboard mode', () => {
      expect(bookmarkletCode).toContain('createEngine({');
      expect(bookmarkletCode).toContain('kbOn: true');
    });

    it('should set up action handlers', () => {
      expect(bookmarkletCode).toContain('setActionHandlers({');
      expect(bookmarkletCode).toContain('keyPress:');
      expect(bookmarkletCode).toContain('mouseClick:');
    });

    it('should set up interaction listeners', () => {
      expect(bookmarkletCode).toContain('setupInteractionListeners({');
      expect(bookmarkletCode).toContain('onUserMouseDown:');
    });

    it('should initialize UI and start walking', () => {
      expect(bookmarkletCode).toContain('createControlPanel(engine, {');
      expect(bookmarkletCode).toContain('ui.init()');
      expect(bookmarkletCode).toContain('engine.start()');
    });

    it('should expose DRUNK_WALKER API', () => {
      expect(bookmarkletCode).toContain('window.DRUNK_WALKER = {');
      expect(bookmarkletCode).toContain('stop:');
    });
  });

  describe('Code Quality', () => {
    it('should not contain ES module imports', () => {
      expect(bookmarkletCode).not.toMatch(/import\s+.*\s+from\s+['"]/);
    });

    it('should not contain ES module exports', () => {
      expect(bookmarkletCode).not.toMatch(/export\s+(const|function|{|class|let|var|default)/);
    });

    it('should not contain any export keywords at all', () => {
      // Catch any export statement (more strict check)
      // Exclude comments by checking for actual export syntax
      const exportMatches = bookmarkletCode.match(/\bexport\s+(const|let|var|function|class|default|{)/g);
      expect(exportMatches).toBeNull();
    });

    it('should not contain any import keywords at all', () => {
      // Catch any import statement (more strict check)
      // Exclude comments by checking for actual import syntax
      const importMatches = bookmarkletCode.match(/\bimport\s+.*\s+from\b/g);
      expect(importMatches).toBeNull();
    });

    it('should be under 100KB', () => {
      const sizeKB = bookmarkletCode.length / 1024;
      expect(sizeKB).toBeLessThan(100);
    });

    it('should have console.log for loading message', () => {
      expect(bookmarkletCode).toContain('console.log');
      expect(bookmarkletCode).toContain('Loaded');
    });
  });

  describe('Functional Requirements', () => {
    it('should have user interaction pause support', () => {
      expect(bookmarkletCode).toContain('isUserMouseDown');
      // Check for pause condition (pattern may vary)
      expect(bookmarkletCode).toMatch(/isUserMouseDown.*isDrawing|isDrawing.*isUserMouseDown/);
    });

    it('should have experimental mode support (kept in code)', () => {
      expect(bookmarkletCode).toContain('expOn');
      expect(bookmarkletCode).toContain('stuckCount');
    });

    it('should have polygon support (kept in code)', () => {
      expect(bookmarkletCode).toContain('poly = []');
      expect(bookmarkletCode).toContain('isDrawing');
    });

    it('should have visual click markers', () => {
      expect(bookmarkletCode).toContain('background:cyan');
      expect(bookmarkletCode).toContain('border-radius:50%');
    });
  });
});
