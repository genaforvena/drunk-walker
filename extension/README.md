# 🤪 Drunk Walker - Browser Extension

**Automated Google Street View explorer using the PLEDGE algorithm**

[![Version](https://img.shields.io/badge/version-6.1.4-blue)](https://github.com/genaforvena/drunk-walker/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](../LICENSE)

## Download

- **Chrome Web Store** - Coming soon
- **Firefox Add-ons** - Coming soon
- **Manual Installation** - See below

## What It Does

Drunk Walker is an automated explorer that lives inside Google Maps Street View. It uses the **PLEDGE algorithm** (Parametric Labyrinth Exploration with Drift-Guided Escape) to discover new paths by:

- 🧭 **Following walls** - Uses left-hand rule for maze exploration
- 🎯 **Facing forward** - Always oriented in direction of travel
- 🔄 **Avoiding loops** - Each location visited at most twice
- 📊 **Tracking progress** - Real-time stats on exploration efficiency

The bot doesn't have a map—it **produces** the map by walking it.

## Installation

### Chrome (Manual)

1. Download or clone this repository
2. Run `npm install && npm run build` to generate the extension bundle
3. Open `chrome://extensions/`
4. Enable **Developer mode** (toggle in top right)
5. Click **Load unpacked**
6. Select the `extension/` folder
7. The Drunk Walker icon should appear in your toolbar

### Firefox (Manual)

1. Download or clone this repository
2. Run `npm install && npm run build` to generate the extension bundle
3. Open `about:debugging#/runtime/this-firefox`
4. Click **Load Temporary Add-on**
5. Navigate to `extension/manifest.json` and select it
6. The extension will load until Firefox restarts

### Permanent Firefox Installation

1. Download the repository
2. Run `npm install && npm run build`
3. Zip the contents of the `extension/` folder
4. Go to [Firefox Add-on Developer Hub](https://addons.mozilla.org/developers/)
5. Submit your add-on for signing
6. Install the signed XPI file

## Usage

1. **Open Google Maps** - Navigate to [google.com/maps](https://www.google.com/maps)
2. **Enter Street View** - Click on any blue location or drag the Pegman
3. **Click the extension icon** - The Drunk Walker popup will appear
4. **Click START** - Watch it explore automatically

### Controls

| Button | Action |
|--------|--------|
| **START/STOP** | Begin or pause exploration |
| **💾 Path** | Export walk path as JSON |
| **📄 Logs** | Export session logs |

### On-Page Panel

Once started, a draggable control panel appears on the Street View page with:
- **Steps counter** - Total movements made
- **Visited counter** - Unique locations discovered
- **Pace slider** - Adjust decision speed (0.5s - 5.0s)
- **START/STOP button** - Quick toggle

The panel can be dragged anywhere on the page by clicking and holding anywhere except the buttons.

## How It Works

### PLEDGE Algorithm

The bot uses a wall-following approach guaranteed to explore any maze:

```
┌─────────────────────────────────────────────────────────┐
│  PLEDGE STATE MACHINE                                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  FORWARD MODE:                                          │
│  • Face direction of travel (prev→cur bearing)          │
│  • Move straight into new territory                     │
│                                                         │
│  ↓ (All 6 yaws tried - dead end)                        │
│                                                         │
│  TURN LEFT 105°:                                        │
│  • Face left wall for backtracking                      │
│                                                         │
│  ↓                                                      │
│                                                         │
│  WALL-FOLLOW MODE:                                      │
│  • Scan for LEFT exits (90-180° from forward)           │
│  • Found exit? Take it, resume FORWARD                  │
│  • No exit? Continue backtracking                       │
│                                                         │
│  ↓ (Truly stuck)                                        │
│                                                         │
│  BREAK WALL:                                            │
│  • Retry successful yaw from graph memory               │
│  • Escape and resume FORWARD                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Six Yaw Buckets

Street View divides 360° into 6 discrete directions:
- 0°, 60°, 120°, 180°, 240°, 300°

At each location, the bot tracks which directions it has tried and which succeeded.

### Performance Metrics

| Metric | Target | Meaning |
|--------|--------|---------|
| **Progress Ratio** | > 0.55 | unique / totalSteps |
| **Steps/Location** | < 2.0 | Inverse of progress |
| **Turns per 100** | < 25 | Efficiency metric |
| **Max Revisits** | ≤ 2 | PLEDGE guarantee |

## Development

### Build

```bash
# Install dependencies
npm install

# Build bookmarklet and extension bundle
npm run build

# Run tests
npm test
```

### Project Structure

```
extension/
├── manifest.json       # Extension manifest (MV3)
├── background.js       # Background service worker
├── content.js          # Content script (messaging)
├── popup.html          # Popup UI
├── popup.js            # Popup logic
├── drunk-walker.js     # Main bundle (auto-generated)
└── icons/
    ├── icon-48.png
    ├── icon-96.png
    └── icon-128.png
```

### Testing Locally

1. Load the extension as described above
2. Open Google Maps Street View
3. Open the extension popup
4. Click START
5. Watch the console for debug logs

### Debugging

**Chrome:**
- Extension logs: `chrome://extensions/` → Inspect views
- Content script logs: Street View page console (F12)
- Popup logs: Right-click popup → Inspect

**Firefox:**
- Extension logs: `about:debugging` → Inspect
- Content script logs: Street View page console (F12)
- Popup logs: Right-click popup → Inspect Element

## Store Submission

### Chrome Web Store

1. **Prepare assets:**
   - 1280x800 or 640x400 promo image
   - 440x280 small promo image
   - 920x680 marquee image (optional)
   - At least one screenshot (1280x800 or 640x400)

2. **Create ZIP:**
   ```bash
   cd extension
   zip -r ../drunk-walker-chrome.zip .
   ```

3. **Submit:**
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Pay $5 one-time fee (if first-time developer)
   - Create new item
   - Upload ZIP
   - Fill in store listing details
   - Submit for review

### Firefox Add-ons

1. **Prepare assets:**
   - 648x432 icon
   - At least one screenshot (1280x800 or 640x400)

2. **Create XPI:**
   ```bash
   cd extension
   zip -r ../drunk-walker-firebase.xpi .
   ```

3. **Submit:**
   - Go to [Firefox Add-on Developer Hub](https://addons.mozilla.org/developers/)
   - Create new add-on
   - Upload XPI
   - Fill in listing details
   - Submit for review (if listed)

### Store Listing Template

**Short Description (Chrome):**
> Automated Street View explorer that discovers new paths using wall-following algorithms.

**Long Description:**
```
Drunk Walker is an automated Google Street View explorer that uses the PLEDGE algorithm to discover new paths.

🧭 HOW IT WORKS:
• Wall-following for guaranteed maze exploration
• Forward-facing for natural path following
• Each location visited at most twice
• Real-time progress tracking

🎮 USAGE:
1. Open Google Maps Street View
2. Click the extension icon
3. Press START
4. Watch it explore!

📊 FEATURES:
• Draggable control panel
• Adjustable pace (0.5s - 5.0s)
• Export walk paths as JSON
• Export session logs
• Real-time statistics

🔧 TECHNICAL:
The PLEDGE algorithm (Parametric Labyrinth Exploration with Drift-Guided Escape) guarantees complete exploration with each node visited at most twice. It handles Street View's unique geometry including yaw drift and hidden branches.

This extension runs entirely in your browser. No data is sent to external servers.

Not affiliated with Google.
```

**Category:** Productivity / Fun

**Languages:** English

## Privacy

This extension:
- ✅ Runs entirely in your browser
- ✅ Does not collect personal data
- ✅ Does not send data to external servers (except fetching Street View from Google)
- ✅ Does not use cookies or tracking
- ✅ Is open source (MIT license)

## Troubleshooting

**Extension icon not showing:**
- Make sure you're on `google.com/maps`
- Check if extension is enabled in `chrome://extensions/` or `about:addons`

**Drunk Walker not starting:**
- Make sure you're in Street View mode (not map view)
- Refresh the page and try again
- Check browser console for errors

**Panel not appearing:**
- The panel might be off-screen - try resizing browser
- Check if popup shows "Running" status
- Try STOP then START again

**Export not working:**
- Make sure you've taken at least one step
- Check browser download folder
- Allow pop-ups for Google Maps if blocked

## License

MIT License - See [LICENSE](../LICENSE) file

## Contributing

Contributions welcome! See [CONTRIBUTING.md](../CONTRIBUTING.md)

## Links

- [GitHub Repository](https://github.com/genaforvena/drunk-walker)
- [GitHub Pages](https://genaforvena.github.io/drunk-walker/)
- [Documentation](../docs/)
- [Report Issue](https://github.com/genaforvena/drunk-walker/issues)

---

*The bot doesn't have a map. It learns the labyrinth by walking it.*
