# Release Checklist - MANDATORY

**Every release MUST follow this checklist. No exceptions.**

---

## Pre-Release Checks

### 1. Version Bump

**Mandatory:** Update version in ALL locations:

```bash
# Check current version
grep -r "version" package.json src/version.js

# Check for OLD version strings in source files (CRITICAL!)
grep -r "6\.1\.[0-4]\|6\.0\.0" src/ --include="*.js" | grep -v test.js
# Should return EMPTY - all should be updated to current version
```

**Files to update:**
- [ ] `package.json` - `"version": "X.Y.Z"`
- [ ] `src/version.js` - `export const VERSION = 'X.Y.Z';`
- [ ] `src/core/engine.js` - Update comment `vX.Y.Z`
- [ ] `src/core/traversal.js` - Update comment `vX.Y.Z`
- [ ] `src/ui/exploration-map.js` - Update comment `vX.Y.Z`
- [ ] `extension/manifest-chrome.json` - Updated by build script
- [ ] `extension/manifest-firefox.json` - Updated by build script
- [ ] `index.html` - Update "Latest Release: vX.Y.Z"
- [ ] `index.html` - Update download links to vX.Y.Z
- [ ] `docs/ALGORITHM.md` - Update version in title
- [ ] `src/README.md` - Update version history table
- [ ] `README.md` - Update version and download links
- [ ] All test files - Update version expectations

### 2. Run All Tests

```bash
npm test
```

**Required:** All 162+ tests must pass

### 3. Build Extension

```bash
npm run build
```

**Verify:**
- [ ] `bookmarklet.js` generated (~85 KB)
- [ ] `extension-chrome/` created with `manifest.json` (uses `service_worker`)
- [ ] `extension-firefox/` created with `manifest.json` (uses `scripts` array)
- [ ] `extension/` folder is NOT committed (build artifact, in .gitignore)

**CRITICAL: Check for OLD version strings in built files!**

```bash
# Check bookmarklet.js for old versions (MUST be empty!)
grep -E "6\.1\.[0-4]|6\.0\.0-CYBERPUNK" bookmarklet.js
# If this returns anything, DO NOT RELEASE - fix version strings first!

# Check extension-chrome manifest
cat extension-chrome/manifest.json | grep -E "service_worker|type"
# Should show: "service_worker": "background.js" (NO "type": "module")

# Check extension-firefox manifest
cat extension-firefox/manifest.json | grep -E "scripts|service_worker|type"
# Should show: "scripts": ["background.js"] (NO "service_worker", NO "type")
```

### 4. Test Extension Loads

**Chrome/Edge:**
1. Go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select `extension-chrome/` folder
5. **Verify:** No errors in console

**Firefox:**
1. Go to `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select `extension-firefox/manifest.json`
5. **Verify:** No errors

---

## Release Steps

### 5. Commit Changes

```bash
git add -A
git commit -m "vX.Y.Z: Release summary"
git push
```

### 6. Create Git Tag

```bash
git tag -a vX.Y.Z -m "vX.Y.Z: Release summary"
git push origin vX.Y.Z
```

### 7. Create Release ZIP Files

```bash
# Using Python (if zip command not available)
python3 -c "
import zipfile, os
for browser in ['chrome', 'firefox']:
    with zipfile.ZipFile(f'/tmp/drunk-walker-{browser}.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(f'extension-{browser}'):
            for file in files:
                filepath = os.path.join(root, file)
                arcname = os.path.relpath(filepath, f'extension-{browser}')
                zf.write(filepath, arcname)
print('Created ZIP files')
"
```

**Verify ZIP contents:**

```bash
# Chrome ZIP should have manifest.json with "service_worker"
unzip -p /tmp/drunk-walker-chrome.zip manifest.json | grep service_worker

# Firefox ZIP should have manifest.json with "scripts" (NOT "service_worker")
unzip -p /tmp/drunk-walker-firefox.zip manifest.json | grep scripts
```

### 8. Create GitHub Release

```bash
# Delete old assets if they exist
gh release delete-asset vX.Y.Z drunk-walker-chrome.zip --yes 2>/dev/null
gh release delete-asset vX.Y.Z drunk-walker-firefox.zip --yes 2>/dev/null

# Upload new assets
gh release upload vX.Y.Z /tmp/drunk-walker-chrome.zip /tmp/drunk-walker-firefox.zip bookmarklet.js

# Edit release notes
gh release edit vX.Y.Z --notes "Release notes..."
```

### 9. Verify Release Assets

**CRITICAL: Download and verify each asset!**

```bash
# Download Firefox ZIP
curl -sL "https://github.com/genaforvena/drunk-walker/releases/download/vX.Y.Z/drunk-walker-firefox.zip" -o /tmp/verify-ff.zip

# Extract and check manifest
cd /tmp && rm -rf verify-ff && unzip -d verify-ff verify-ff.zip
cat verify-ff/manifest.json | python3 -c "import sys,json; d=json.load(sys.stdin); b=d.get('background',{}); assert 'scripts' in b and 'service_worker' not in b, 'WRONG MANIFEST!'; print('✓ Firefox manifest OK')"

# Download Chrome ZIP
curl -sL "https://github.com/genaforvena/drunk-walker/releases/download/vX.Y.Z/drunk-walker-chrome.zip" -o /tmp/verify-chrome.zip

# Extract and check manifest
cd /tmp && rm -rf verify-chrome && unzip -d verify-chrome verify-chrome.zip
cat verify-chrome/manifest.json | python3 -c "import sys,json; d=json.load(sys.stdin); b=d.get('background',{}); assert 'service_worker' in b and 'type' not in b, 'WRONG MANIFEST!'; print('✓ Chrome manifest OK')"
```

### 10. Verify GitHub Pages

```bash
# Check gh.io page version
curl -s https://genaforvena.github.io/drunk-walker/ | grep "Latest Release"

# Check extension-chrome manifest
curl -s https://genaforvena.github.io/drunk-walker/extension-chrome/manifest.json | grep service_worker

# Check extension-firefox manifest
curl -s https://genaforvena.github.io/drunk-walker/extension-firefox/manifest.json | grep scripts
```

---

## Post-Release Verification

### 11. Verify Release

**Check:**
- [ ] GitHub Release exists and is downloadable
- [ ] Firefox ZIP has correct manifest (`"scripts"` array, NO `"service_worker"`)
- [ ] Chrome ZIP has correct manifest (`"service_worker"`, NO `"type"`)
- [ ] Bookmarklet works in browser console
- [ ] Extension loads without errors in Chrome
- [ ] Extension loads without errors in Firefox
- [ ] Version shown in extension matches release

### 12. Update Documentation

**In release notes:**
- [ ] List of changes (features, fixes, performance)
- [ ] Installation instructions
- [ ] Known issues (if any)

---

## Quick Reference

```bash
# Full release process
npm test                    # Run all tests
npm run build               # Build extension
git add -A                  # Stage changes
git commit -m "vX.Y.Z: ..." # Commit
git push                    # Push to GitHub
git tag -a vX.Y.Z -m "..."  # Create tag
git push origin vX.Y.Z      # Push tag

# Create ZIPs
python3 -c "import zipfile,os; [zipfile.ZipFile(f'/tmp/drunk-walker-{b}.zip','w').write(f'extension-{b}/{f}',f) for b in['chrome','firefox'] for f in os.listdir(f'extension-{b}')]"

# Update release
gh release delete-asset vX.Y.Z drunk-walker-chrome.zip --yes
gh release delete-asset vX.Y.Z drunk-walker-firefox.zip --yes
gh release upload vX.Y.Z /tmp/drunk-walker-chrome.zip /tmp/drunk-walker-firefox.zip bookmarklet.js

# Verify
curl -sL "https://github.com/genaforvena/drunk-walker/releases/download/vX.Y.Z/drunk-walker-firefox.zip" | python3 -c "import sys,zipfile,json; z=zipfile.ZipFile(sys.stdin.buffer); m=json.loads(z.read('manifest.json')); assert 'scripts' in m['background'], 'WRONG!'; print('✓ OK')"
```

---

## Common Mistakes to Avoid

1. **Forgetting to update release assets** - Always delete old assets before uploading new ones
2. **Wrong Firefox manifest** - Firefox uses `"scripts"` array, NOT `"service_worker"` + `"type"`
3. **Not verifying downloaded ZIPs** - Always download and verify the actual release assets
4. **Committing extension/ folder** - Only commit extension-chrome/ and extension-firefox/
5. **Old version strings in code** - Check all source files before release

---

**REMEMBER:** Every version MUST be published to ALL channels:
1. ✅ GitHub Releases (tag + ZIP files with CORRECT manifests)
2. ✅ GitHub Pages (extension-chrome/ and extension-firefox/)
3. ✅ bookmarklet.js

**No release is complete until all channels are verified working.**
