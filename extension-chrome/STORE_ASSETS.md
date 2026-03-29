# Store Assets Guide

This document describes the assets needed for Chrome Web Store and Firefox Add-ons submission.

## Required Assets

### Chrome Web Store

| Asset | Size | Format | Description |
|-------|------|--------|-------------|
| **Tile Icon** | 440x280 | PNG | Small promotional image |
| **Promo Image** | 1400x560 | PNG | Large promotional image |
| **Screenshots** | 1280x800 or 640x400 | PNG/JPG | At least 1, up to 5 |
| **Marquee Image** | 920x680 | PNG | Optional hero image |

### Firefox Add-ons

| Asset | Size | Format | Description |
|-------|------|--------|-------------|
| **Icon** | 648x432 | PNG | Add-on icon |
| **Screenshots** | 1280x800 or 640x400 | PNG/JPG | At least 1, up to 10 |
| **Promo Image** | 720x480 | PNG | Optional featured image |

## Screenshot Guidelines

### What to Capture

1. **Extension Popup**
   - Open Google Maps Street View
   - Click the Drunk Walker extension icon
   - Capture the popup showing START button

2. **Control Panel in Action**
   - Start the exploration
   - Show the draggable control panel with stats
   - Capture it actively walking (Steps/Visited changing)

3. **Settings/Controls**
   - Show the pace slider
   - Show Path/Logs export buttons

4. **Before/After**
   - Show the path visualization (if using the map overlay)

### Screenshot Tips

- Use a clean, recognizable Street View location
- Ensure text is readable (minimum 16px font)
- Add annotations/arrows if needed
- Show the extension in action, not just static UI
- Use browser window at 1280x800 for consistency

## Promo Image Design

### Tile Icon (440x280)

```
┌────────────────────────────────────┐
│  [Drunk Walker Icon]               │
│                                    │
│  🤪 DRUNK WALKER                   │
│  Automated Street View Explorer    │
│                                    │
│  [Green gradient background]       │
└────────────────────────────────────┘
```

### Promo Image (1400x560)

```
┌──────────────────────────────────────────────────────────┐
│  🤪 DRUNK WALKER                                         │
│                                                          │
│  Automated Google Street View Explorer                   │
│  Using the PLEDGE Wall-Following Algorithm               │
│                                                          │
│  [Screenshot of control panel]  [Extension icon]         │
│                                                          │
│  ✓ No installation needed                                │
│  ✓ Real-time exploration                                 │
│  ✓ Export your walks                                     │
│                                                          │
│  [Green gradient with path trail]                        │
└──────────────────────────────────────────────────────────┘
```

## Store Listing Text

### Chrome Web Store

**Name:** Drunk Walker - Street View Explorer

**Short Description (132 chars):**
> Automated Google Street View explorer using wall-following algorithms to discover new paths.

**Long Description:**
```
Drunk Walker is an automated Google Street View explorer that uses the PLEDGE algorithm (Parametric Labyrinth Exploration with Drift-Guided Escape) to discover new paths.

🧭 HOW IT WORKS:
• Wall-following for guaranteed maze exploration
• Forward-facing for natural path following  
• Each location visited at most twice
• Real-time progress tracking

🎮 USAGE:
1. Open Google Maps Street View
2. Click the extension icon
3. Press START
4. Watch it explore automatically!

📊 FEATURES:
• Draggable control panel with live stats
• Adjustable pace (0.5s - 5.0s)
• Export walk paths as JSON
• Export session logs
• Works entirely in your browser

🔧 TECHNICAL:
The PLEDGE algorithm guarantees complete exploration with each node visited at most twice. It handles Street View's unique geometry including yaw drift and hidden branches.

This extension runs entirely in your browser. No data is sent to external servers.

Not affiliated with Google.
```

**Category:** Productivity

**Languages:** English

### Firefox Add-ons

**Name:** Drunk Walker - Street View Explorer

**Summary (60 chars):**
> Automated Street View explorer using wall-following algorithms

**Description:**
```
Drunk Walker automatically explores Google Street View using the PLEDGE algorithm.

Features:
- Wall-following exploration (guaranteed coverage)
- Each location visited at most twice
- Real-time statistics
- Export walk paths and logs
- Adjustable exploration pace
- Draggable control panel

Privacy: This extension runs entirely in your browser. No data is collected or sent to external servers.

Not affiliated with Google.
```

**License:** MIT License

**Homepage:** https://genaforvena.github.io/drunk-walker/

**Support URL:** https://github.com/genaforvena/drunk-walker/issues

## Creating Assets

### Using Canva (Free)

1. Go to canva.com
2. Create custom size design
3. Use green gradient background (#0f0 to #00aa00)
4. Add extension icon (from extension/icons/)
5. Add text in monospace font
6. Export as PNG

### Using GIMP (Free)

1. Open GIMP
2. Create new image (required size)
3. Create gradient background
4. Import extension icon as layer
5. Add text layers
6. Export as PNG

### Using Photoshop

1. Create new document
2. Use gradient tool for background
3. Place extension icon
4. Add text with Courier New or similar
5. Export for Web (PNG-24)

## Submission Checklist

### Chrome Web Store

- [ ] Developer account created ($5 one-time fee)
- [ ] ZIP file created (`npm run package`)
- [ ] Tile icon (440x280)
- [ ] Promo image (1400x560)
- [ ] At least 1 screenshot (1280x800)
- [ ] Store listing text prepared
- [ ] Privacy policy URL (can use GitHub page)
- [ ] Submitted for review

### Firefox Add-ons

- [ ] Developer account created (free)
- [ ] ZIP/XPI file created (`npm run package`)
- [ ] Icon (648x432)
- [ ] At least 1 screenshot
- [ ] Store listing text prepared
- [ ] Submitted for review (if listed)

## Privacy Policy Template

If you need a privacy policy, add this to your GitHub Pages:

```markdown
# Privacy Policy - Drunk Walker

Drunk Walker is a browser extension that runs entirely locally in your browser.

## Data Collection

This extension does NOT:
- Collect personal data
- Send data to external servers (except Google Maps requests)
- Use cookies or tracking
- Share usage data

## How It Works

The extension injects code into Google Maps Street View pages to control navigation. All processing happens in your browser.

## Third-Party Services

- Google Maps Street View (google.com/maps)
- GitHub Pages for extension hosting

## Contact

For questions: [your email or GitHub issues link]

Last updated: [date]
```

## Version History Template

```
v6.1.4 - Initial Release
- PLEDGE wall-following algorithm
- Draggable control panel
- Export walk paths and logs
- Adjustable exploration pace
```
