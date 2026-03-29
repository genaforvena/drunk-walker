# Release Process - ONE CLICK!

**Every release is now automated. No manual checks needed.**

---

## One-Click Release

```bash
npm run release X.Y.Z
```

**Example:**
```bash
npm run release 6.1.6
```

**What it does:**
1. ✅ Validates version format (X.Y.Z)
2. ✅ Updates version in ALL files (package.json, src/version.js, README.md, index.html)
3. ✅ Runs all tests (must pass)
4. ✅ Builds extension (bookmarklet.js + extension-chrome/ + extension-firefox/)
5. ✅ Verifies manifests (Chrome: service_worker, Firefox: scripts)
6. ✅ Creates ZIP files (dist/drunk-walker-*.zip)
7. ✅ Commits changes to git
8. ✅ Pushes to GitHub
9. ✅ Creates git tag
10. ✅ Pushes tag to GitHub
11. ✅ Updates GitHub Release (deletes old assets, uploads new)
12. ✅ Verifies release assets (downloads and checks manifests)

**If it succeeds:** Release is complete and verified!
**If it fails:** Script shows recovery steps.

---

## Manual Release (if script fails)

### 1. Update Version

```bash
# Update package.json
# Update src/version.js
# Update README.md
# Update index.html
```

### 2. Build and Test

```bash
npm test
npm run build
```

### 3. Verify Manifests

```bash
# Chrome
cat extension-chrome/manifest.json | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'service_worker' in d['background'] and 'type' not in d['background'], 'WRONG!'"

# Firefox
cat extension-firefox/manifest.json | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'scripts' in d['background'] and 'service_worker' not in d['background'], 'WRONG!'"
```

### 4. Create ZIPs

```bash
python3 -c "
import zipfile, os
for browser in ['chrome', 'firefox']:
    with zipfile.ZipFile(f'dist/drunk-walker-{browser}.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(f'extension-{browser}'):
            for file in files:
                filepath = os.path.join(root, file)
                arcname = os.path.relpath(filepath, f'extension-{browser}')
                zf.write(filepath, arcname)
"
```

### 5. Commit and Tag

```bash
git add -A
git commit -m "vX.Y.Z: Release"
git push
git tag -a vX.Y.Z -m "vX.Y.Z: Release"
git push origin vX.Y.Z
```

### 6. Update Release

```bash
# Delete old assets
gh release delete-asset vX.Y.Z drunk-walker-chrome.zip --yes
gh release delete-asset vX.Y.Z drunk-walker-firefox.zip --yes
gh release delete-asset vX.Y.Z bookmarklet.js --yes

# Upload new assets
gh release upload vX.Y.Z dist/drunk-walker-chrome.zip dist/drunk-walker-firefox.zip dist/bookmarklet.js
```

### 7. Verify Release

```bash
# Firefox
curl -sL "https://github.com/genaforvena/drunk-walker/releases/download/vX.Y.Z/drunk-walker-firefox.zip" -o /tmp/ff.zip
cd /tmp && rm -rf ff && unzip -d ff ff.zip
cat ff/manifest.json | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'scripts' in d['background'], 'WRONG!'; print('✓ OK')"

# Chrome
curl -sL "https://github.com/genaforvena/drunk-walker/releases/download/vX.Y.Z/drunk-walker-chrome.zip" -o /tmp/chrome.zip
cd /tmp && rm -rf chrome && unzip -d chrome chrome.zip
cat chrome/manifest.json | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'service_worker' in d['background'] and 'type' not in d['background'], 'WRONG!'; print('✓ OK')"
```

---

## Common Mistakes to Avoid

1. **Forgetting to update release assets** - Script handles this automatically
2. **Wrong Firefox manifest** - Script verifies `"scripts"` array
3. **Not verifying downloaded ZIPs** - Script downloads and verifies
4. **Committing extension/ folder** - Only commit extension-chrome/ and extension-firefox/
5. **Old version strings in code** - Script updates all files

---

**REMEMBER:** Use `npm run release X.Y.Z` for all releases!
