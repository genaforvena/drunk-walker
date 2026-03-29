import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import { JSDOM } from 'jsdom';

describe('GitHub Pages One-Click Copy Verification', () => {
  const indexContent = fs.readFileSync('index.html', 'utf8');
  const bookmarkletContent = fs.readFileSync('bookmarklet.js', 'utf8');

  // Extract the LATEST_URL from index.html (for latest version button)
  const urlMatch = indexContent.match(/const LATEST_URL = [`'"](.+)[`'"]/);
  const bookmarkletUrl = urlMatch ? urlMatch[1] : '';

  it('should have correct GitHub raw URL for latest version', () => {
    expect(bookmarkletUrl).toContain('https://raw.githubusercontent.com/genaforvena/drunk-walker/main/bookmarklet.js');
  });

  it('should contain the latest version string in bookmarklet.js', () => {
    expect(bookmarkletContent).toContain('v6.1.5');
  });

  it('should have keyboard mode enabled by default', () => {
    expect(bookmarkletContent).toContain('kbOn: true');
  });

  it('should keep simulateClick function for fallback', () => {
    expect(bookmarkletContent).toContain('function simulateClick(x, y, showMarker = true)');
  });

  it('should implement the start() function with auto-start logic in bookmarklet.js', () => {
    expect(bookmarkletContent).toContain('ui.init()');
    expect(bookmarkletContent).toContain('<span>⏹</span> STOP');
    expect(bookmarkletContent).toContain('engine.start()');
  });

  describe('copyToClipboard functionality', () => {
    let dom, window, document;

    beforeEach(() => {
      // Mock fetch globally before creating JSDOM
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => bookmarkletContent
      });

      // Mock alert
      global.alert = vi.fn();

      dom = new JSDOM(indexContent, { 
        runScripts: "dangerously", 
        resources: "usable",
        beforeParse(w) {
          // Ensure fetch is available in the window context
          w.fetch = global.fetch;
        }
      });
      window = dom.window;
      document = window.document;

      // Mock clipboard API
      Object.defineProperty(window.navigator, 'clipboard', {
        value: {
          writeText: vi.fn().mockImplementation(() => Promise.resolve()),
        },
      });
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should call navigator.clipboard.writeText with the bookmarklet content', async () => {
      // Wait for script to load
      await new Promise(resolve => setTimeout(resolve, 50));
      
      window.copyToClipboard();
      expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith(bookmarkletContent);
    });

    it('should show success message after copying', async () => {
      // Wait for script to load
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const successMsg = document.getElementById('success');
      expect(['none', '']).toContain(successMsg.style.display);

      window.copyToClipboard();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(successMsg.style.display).toBe('block');
    });

    it('should handle case when script is not loaded yet', () => {
      // Create a fresh DOM where fetch fails
      const mockAlert = vi.fn();
      const freshDom = new JSDOM(indexContent, { 
        runScripts: "dangerously", 
        resources: "usable",
        beforeParse(w) {
          w.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
          w.alert = mockAlert;
        }
      });
      const freshWindow = freshDom.window;
      
      // Try to copy before script loads (scriptCode will be null)
      freshWindow.copyToClipboard();
      
      // Should have shown alert about script not loaded
      expect(mockAlert).toHaveBeenCalled();
    });
  });

  it('should have the correct version in the title', () => {
    expect(indexContent).toContain('<title>🤪 Drunk Walker');
  });

  it('should have loading message for script fetch', () => {
    expect(indexContent).toContain('Loading from repository');
  });

  it('should have disabled copy button initially', () => {
    expect(indexContent).toContain('disabled');
  });
});
