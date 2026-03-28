# Creating GitHub Releases

This guide explains how to create releases for the Drunk Walker extension.

## Manual Release Process

### 1. Build and Package

```bash
# Make sure you have latest code
git pull

# Install dependencies
npm install

# Run tests
npm test

# Build extension
npm run build

# Package for distribution
npm run extension:package
```

This creates:
- `dist/drunk-walker-chrome.zip`
- `dist/drunk-walker-firefox.zip`

### 2. Create Release on GitHub

1. Go to https://github.com/genaforvena/drunk-walker/releases
2. Click **Draft a new release**
3. **Tag version**: Enter version number (e.g., `v6.1.4`)
4. **Release title**: Same as tag or descriptive name
5. **Description**: Add release notes (changes, fixes, features)
6. **Upload files**: Drag and drop both ZIP files from `dist/`
7. Click **Publish release**

### 3. Verify Release

After publishing:
- Both ZIP files should be downloadable
- Release appears at https://github.com/genaforvena/drunk-walker/releases
- README download links work

## Automated Releases (GitHub Actions)

If Actions are enabled, the workflow `.github/workflows/build-extension.yml` will:

1. **On every push to main**: Create/update `latest-build` pre-release
2. **On version tags (v*)**: Create official release with ZIP files

### Trigger Automated Release

```bash
# Tag a release
git tag v6.1.4
git push origin v6.1.4
```

This triggers the workflow which:
- Runs tests
- Builds extension
- Creates GitHub release with ZIP files attached

## Release Notes Template

```markdown
## Changes

### Features
- New feature description

### Fixes
- Bug fix description

### Performance
- Optimization description

## Installation

Download the appropriate ZIP file for your browser:
- **Chrome/Edge/Brave**: `drunk-walker-chrome.zip`
- **Firefox**: `drunk-walker-firefox.zip`

Extract and load as unpacked extension (see README for detailed instructions).
```

## Version Numbering

Follow semantic versioning: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

Current version is stored in:
- `src/version.js`
- `extension/manifest.json` (updated automatically by build)
