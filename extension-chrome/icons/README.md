# Extension Icons

The extension requires three PNG icons:

- `icon-48.png` (48x48 pixels)
- `icon-96.png` (96x96 pixels)  
- `icon-128.png` (128x128 pixels)

## Quick Generation Options

### Option 1: Using ImageMagick (recommended)

```bash
# Install ImageMagick if needed
# macOS: brew install imagemagick
# Linux: sudo apt install imagemagick
# Windows: choco install imagemagick

# Generate all sizes from SVG
cd extension/icons
convert icon.svg -resize 48x48 icon-48.png
convert icon.svg -resize 96x96 icon-96.png
convert icon.svg -resize 128x128 icon-128.png
```

### Option 2: Using online converter

1. Go to https://cloudconvert.com/svg-to-png
2. Upload `icon.svg`
3. Set dimensions (48x48, 96x96, or 128x128)
4. Download and save in this directory

### Option 3: Using Node.js with canvas

```bash
npm install canvas
node scripts/generate-icons.js
```

## Icon Design

The icon features:
- Green gradient background circle
- Black face with green eyes (drunk/swirly look)
- Wavy green mouth
- Dashed trail line indicating movement
- Arrow showing forward direction

This matches the "Drunk Walker" theme of the extension.
