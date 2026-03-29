# Release Checklist - MANDATORY

**Every release MUST follow this checklist. No exceptions.**

---

## Pre-Release Checks

### 1. Version Bump

**Mandatory:** Update version in ALL locations:

```bash
# Check current version
grep -r "version" package.json src/version.js extension/manifest.json

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
- [ ] `extension/manifest.json` - Updated automatically by build
- [ ] `index.html` - Update "Latest Release: vX.Y.Z"
- [ ] `index.html` - Update download links to vX.Y.Z
- [ ] `docs/ALGORITHM.md` - Update version in title
- [ ] `src/README.md` - Update version history table
- [ ] All test files - Update version expectations

### 2. Run All Tests

```bash
npm test
```

**Required:** All tests must pass (162+ tests)

### 3. Build Extension

```bash
npm run build
```

**Verify:**
- [ ] `bookmarklet.js` generated (~85 KB)
- [ ] `extension/drunk-walker.js` generated (~86 KB)
- [ ] `extension/manifest.json` created (Chrome - uses `service_worker`)
- [ ] `extension/manifest-firefox.json` created (Firefox - uses `scripts`)

**CRITICAL: Check for OLD version strings in built files!**

```bash
# Check bookmarklet.js for old versions (MUST be empty!)
grep -E "6\.1\.[0-4]|6\.0\.0-CYBERPUNK" bookmarklet.js
# If this returns anything, DO NOT RELEASE - fix version strings first!

# Check extension/drunk-walker.js for old versions
grep -E "6\.1\.[0-4]|6\.0\.0-CYBERPUNK" extension/drunk-walker.js
```

**Note:** The build script now creates two manifests:
- `manifest.json` - Chrome/Edge/Brave (uses `"service_worker"`)
- `manifest-firefox.json` - Firefox (uses `"scripts"` array)

### 4. Test Extension Loads

**Chrome/Edge:**
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `extension/` folder
5. **Verify:** No errors in console

**Firefox:**
1. Go to `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select `extension/manifest-firefox.json` (IMPORTANT: use manifest-firefox.json!)
5. **Verify:** No errors

**Note:** Firefox requires `manifest-firefox.json` which uses `"scripts"` array instead of `"service_worker"`.

---

## Release Steps

### 5. Commit Changes

```bash
git add .
git commit -m "vX.Y.Z: Release summary"
git push
```

### 6. Create Git Tag

```bash
git tag -a vX.Y.Z -m "vX.Y.Z: Release summary"
git push origin vX.Y.Z
```

### 7. Create GitHub Release

1. Go to https://github.com/genaforvena/drunk-walker/releases
2. Click **Draft a new release**
3. **Tag:** `vX.Y.Z`
4. **Title:** `vX.Y.Z`
5. **Description:** Use template below
6. **Upload:** Both ZIP files from `dist/` (if using packaging)
7. Click **Publish release**

### 8. Publish to All Channels

**GitHub Releases:**
- [ ] Release created at https://github.com/genaforvena/drunk-walker/releases
- [ ] ZIP files uploaded (bookmarklet.js, extension ZIPs)

**GitHub Pages (Bookmarklet):**
- [ ] `bookmarklet.js` committed to `main` branch
- [ ] https://genaforvena.github.io/drunk-walker/ updated

**Extension (Manual Distribution):**
- [ ] Extension ZIPs created in `dist/`
- [ ] Uploaded to GitHub Releases
- [ ] Distribution instructions in release notes

---

## Post-Release Verification

### 9. Verify Release

**Check:**
- [ ] GitHub Release exists and is downloadable
- [ ] Bookmarklet works in browser console
- [ ] Extension loads without errors
- [ ] Version shown in extension matches release

### 10. Update Documentation

**In release notes:**
- [ ] List of changes (features, fixes, performance)
- [ ] Installation instructions
- [ ] Known issues (if any)

---

## Release Notes Template

```markdown
## vX.Y.Z - [Release Name]

**Date:** YYYY-MM-DD

### Changes

#### Features
- Feature description

#### Fixes
- Bug fix description

#### Performance
- Optimization description

### Installation

#### Bookmarklet (Browser Console)
1. Go to https://genaforvena.github.io/drunk-walker/
2. Copy bookmarklet code
3. Paste into browser console on Google Maps

#### Browser Extension
1. Download `drunk-walker-chrome.zip` (Chrome/Edge/Brave)
   or `drunk-walker-firefox.zip` (Firefox)
2. Extract ZIP file
3. Load as unpacked extension (see README for details)

### Verification

- All 162+ tests passing
- Extension loads without errors
- Bookmarklet works in latest Chrome/Firefox

### Files

- `bookmarklet.js` (XX KB)
- `drunk-walker-chrome.zip` (XX KB)
- `drunk-walker-firefox.zip` (XX KB)
```

---

## Automated Release (GitHub Actions)

If Actions are enabled, tagging a release triggers automated build:

```bash
# Tag and push
git tag -a vX.Y.Z -m "vX.Y.Z: Summary"
git push origin vX.Y.Z
```

**Workflow creates:**
- GitHub Release with tag
- ZIP files attached (if configured)
- Deployment to GitHub Pages (if configured)

**Still required:**
- Manual verification that extension loads
- Manual testing of bookmarklet
- Manual distribution to any other channels

---

## Version Numbering

Follow semantic versioning: `MAJOR.MINOR.PATCH`

- **MAJOR** (6.0.0 → 7.0.0): Breaking changes
- **MINOR** (6.1.0 → 6.2.0): New features (backwards compatible)
- **PATCH** (6.1.3 → 6.1.4): Bug fixes (backwards compatible)

**Current version locations:**
- `package.json` - NPM package version
- `src/version.js` - Single source of truth
- `extension/manifest.json` - Extension version (auto-updated by build)

---

## Troubleshooting

### Extension Won't Load

**Error:** "Extension is invalid"

**Check:**
1. Manifest version is 3 (not 2)
2. No `"type": "module"` in background (MV3 doesn't support it)
3. All required files exist in `extension/` folder
4. Icons are valid PNG files

**Fix:**
```bash
# Rebuild extension
npm run build

# Check manifest
cat extension/manifest.json | grep -A2 '"background"'
# Should NOT have "type": "module"
```

### Tests Fail After Build

**Cause:** Build may introduce issues

**Fix:**
1. Check build output for errors
2. Verify `bookmarklet.js` size is reasonable (~85 KB)
3. Run tests again: `npm test`

### Version Mismatch

**Symptom:** Different files show different versions

**Fix:**
1. Update `src/version.js` (source of truth)
2. Update `package.json`
3. Run `npm run build` (updates manifest automatically)
4. Commit all changes together

---

## Quick Reference

```bash
# Full release process
npm test                    # Run all tests
npm run build               # Build extension
git add .                   # Stage changes
git commit -m "vX.Y.Z: ..." # Commit
git push                    # Push to GitHub
git tag -a vX.Y.Z -m "..."  # Create tag
git push origin vX.Y.Z      # Push tag (triggers release)
```

---

**REMEMBER:** Every version MUST be published to ALL channels:
1. ✅ GitHub Releases (tag + ZIP files)
2. ✅ GitHub Pages (bookmarklet.js)
3. ✅ Extension (loadable from `extension/` folder)

**No release is complete until all channels are updated.**
