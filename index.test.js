import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { JSDOM } from 'jsdom';

describe('GitHub Pages One-Click Copy Verification', () => {
  const indexContent = fs.readFileSync('index.html', 'utf8');
  const bookmarkletContent = fs.readFileSync('bookmarklet.js', 'utf8');
  
  // Extract scriptCode content (unescaping it from the JSON-stringified format in index.html)
  // The line is: const scriptCode = " ... ";
  const match = indexContent.match(/const scriptCode = (.*);/);
  const rawScriptContent = match ? match[1] : '';
  const scriptCode = JSON.parse(rawScriptContent);

  it('should match bookmarklet.js exactly', () => {
    expect(scriptCode).toBe(bookmarkletContent);
  });

  it('should contain the latest version string', () => {
    expect(scriptCode).toContain('v3.0-EXP');
  });

  it('should include Keyboard Mode toggle', () => {
    expect(scriptCode).toContain('dw-kb-toggle');
    expect(scriptCode).toContain('KEYBOARD MODE (ARROW UP)');
  });

  it('should implement the start() function with auto-start logic', () => {
    expect(scriptCode).toContain('start();\n})();');
    expect(scriptCode).toContain('btn.innerText = \'🔴 STOP\'');
  });

  describe('copyToClipboard functionality', () => {
    let dom, window, document;

    beforeEach(() => {
      dom = new JSDOM(indexContent, { runScripts: "dangerously", resources: "usable" });
      window = dom.window;
      document = window.document;
      
      // Mock clipboard API
      Object.defineProperty(window.navigator, 'clipboard', {
        value: {
          writeText: vi.fn().mockImplementation(() => Promise.resolve()),
        },
      });
    });

    it('should call navigator.clipboard.writeText with the correct scriptCode', () => {
      // Trigger the function
      window.copyToClipboard();
      
      expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith(scriptCode);
    });

    it('should show success message after copying', async () => {
      const successMsg = document.getElementById('success');
      // Initially it might be empty string in JSDOM because it's defined in <style> block, not inline
      expect(['none', '']).toContain(successMsg.style.display);
      
      window.copyToClipboard();
      
      // Since it's a promise, we wait a bit
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(successMsg.style.display).toBe('block');
    });
  });

  it('should have the correct version in the title', () => {
    expect(indexContent).toContain('<title>🤪 Drunk Walker v3.0-EXP');
  });
});
