import { describe, it, expect } from 'vitest';
import fs from 'fs';

describe('GitHub Pages One-Click Copy Verification', () => {
  const indexContent = fs.readFileSync('index.html', 'utf8');
  
  // Extract scriptCode content
  const match = indexContent.match(/const scriptCode = "(.*)";/s);
  const scriptCode = match ? match[1] : '';

  it('should contain the latest version string', () => {
    expect(scriptCode).toContain('v3.0-EXP');
  });

  it('should include Keyboard Mode toggle', () => {
    expect(scriptCode).toContain('dw-kb-toggle');
    expect(scriptCode).toContain('KEYBOARD MODE (ARROW UP)');
  });

  it('should include Experimental Mode toggle with updated label', () => {
    expect(scriptCode).toContain('dw-exp-toggle');
    expect(scriptCode).toContain('EXPERIMENTAL MODE (STUCK DETECT)');
  });

  it('should implement the start() function with auto-start logic', () => {
    // Check if start() is called at the end
    // Note: in index.html, it's a string with escaped newlines like \n
    expect(scriptCode).toMatch(/start\(\);(\\n|\s)*\}\)\(\);/);
    // Check if start() sets the button to STOP
    expect(scriptCode).toContain('btn.innerText = \'🔴 STOP\'');
  });

  it('should implement keyboard navigation logic', () => {
    expect(scriptCode).toContain('key(\'ArrowUp\')');
    expect(scriptCode).toContain('key(\'ArrowLeft\')');
  });

  it('should have the correct version in the title', () => {
    expect(indexContent).toContain('<title>🤪 Drunk Walker v3.0-EXP');
  });
});
