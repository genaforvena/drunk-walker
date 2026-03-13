# 🧠 Drunk Walker: Project Memory

## 🎯 Project Essence
**Drunk Walker** is a cross-browser extension (Firefox & Chromium-based) and a standalone Bookmarklet that automates Google Street View navigation using a "blind," coordinate-based approach. It prioritizes visual chaos and reactive exploration via cursor-relative clicks.

---

## 🏗️ System Architecture

### 1. Component Roles
- **Popup (`popup.html`, `popup.js`)**: Single-toggle START/STOP control center.
- **Background (`background.js`)**: State machine (`idle`, `navigating`, `complete`). Now configured as a `service_worker` for cross-browser support.
- **Content (`content.js`)**: Executes clicks relative to cursor or "Forward" region.
- **Bookmarklet (`bookmarklet.js`)**: A standalone version of the navigation logic that works on any device.

### 2. Cross-Browser & Multi-Device Support
- **Polyfill**: Uses `browserAPI` to bridge `browser.*` and `chrome.*` namespaces.
- **Bookmarklet**: Provides a "one-click" experience on mobile and desktop via `index.html`.

---

## 🚀 Deployment & Sharing

### One-Click "No-Install" (GitHub Pages)
The primary shareable link is: **[https://genaforvena.github.io/drunk-walker/](https://genaforvena.github.io/drunk-walker/)**
- **Method**: Single button to **Copy JS to Clipboard**.
- **Execution**: User pastes into the **Browser Console (F12)** on a Street View page.
- **Benefits**: Works instantly on any modern browser without installation or store approvals.

### GitHub Automation (User Preference)
- **Prefer `gh` CLI**: The user prefers using the GitHub CLI (`gh`) for automating repository settings, creating releases, and enabling GitHub Pages.
- **Bypass Jekyll**: A `.nojekyll` file is used to ensure simple HTML deployment on Pages.
- **Mandatory Testing**: Run `npm test` before every push to ensure no regressions in core logic (Start/Stop, Drag-detection, Targeting).
- **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`) automatically runs tests on every push to `main`.

---

## ⚡ Key Implementations & Logic

### 1. Click Algorithm (v1.7)
- **Control Panel**: Injects a fixed UI with a **START/STOP toggle** and a **PACE slider** (0.5s to 5.0s).
- **Drag Detection**: Automated clicks are paused if `isUserMouseDown` is true (detected via `isTrusted` mousedown events).
- **Targeting**: Clicks are targeted around the **Center** of the viewport as captured when the script is first loaded.
- **No Scaling**: Logic relies on initial window dimensions rather than dynamic recalculation.

### 2. YOLO Mode
A high-chaos preset: Interval 1.0s, Radius 100px, Glitch effects.

---

## 🛠️ Implementation Progress

- [x] Manifest V3 Setup (Cross-browser compatible)
- [x] Background State Management (Service Worker mode)
- [x] Cursor-relative Click Simulation (v1.1)
- [x] Simplified Movement (v1.2): Default Forward.
- [x] Minimalist UI (Single Toggle)
- [x] **One-Click Installation Page** (GitHub Pages)
- [x] **Bookmarklet Version** (Mobile Support)
- [ ] **Next Up**: Dynamic Radius scaling (increasing wobble over time)
- [ ] **Next Up**: Screen shake effects on click

---

## 📂 File Map
- `manifest.json`: Cross-browser extension config.
- `background.js`: Timing loop (Service Worker).
- `content.js`: Mouse tracking and click execution.
- `popup.js`: Toggle logic and user parameters.
- `index.html`: One-click installation page.
- `PROJECT_MEMORY.md`: This knowledge base.
