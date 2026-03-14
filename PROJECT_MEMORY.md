# 🧠 Drunk Walker: Project Memory

## 🎯 Project Essence
**Drunk Walker** is a standalone Bookmarklet that automates Google Street View navigation using keyboard events (default) or clicks. It prioritizes visual chaos and reactive exploration.

---

## 🏗️ System Architecture (v3.3-EXP - Modular)

### 1. Component Roles
- **`src/core/engine.js`** - Independent navigation logic with state management and Auto-Unstuck algorithm
- **`src/input/handlers.js`** - Keyboard/mouse event simulation (including long-press for turns)
- **`src/ui/controller.js`** - Control panel UI management
- **`src/main.js`** - Entry point combining all modules
- **`bookmarklet.js`** - Auto-generated bundle from `npm run build`
- **`index.html`** - One-click installation page (fetches bookmarklet from GitHub)

### 2. Test Structure
- **`src/core/engine.test.js`** - Tests for navigation logic and unstuck algorithm
- **`src/input/handlers.test.js`** - Tests for event simulation (including longKeyPress)
- **`src/bundle.test.js`** - Tests validating bundled output
- **`index.test.js`** - Integration tests
- **Total: 83 tests** - All must pass before push

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
- **Mandatory Testing**: Run `npm test` before every push to ensure no regressions.
- **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`) automatically runs tests and build verification on every push to `main`.
- **CRITICAL: CI Verification**: ALWAYS verify all CI checks pass (GREEN) after every push.
    - Check CI status: `gh run list` or visit GitHub Actions tab.
    - If any test fails, do NOT consider the task finished.
    - Fix failures immediately and push again.
- **CRITICAL: Post-Push Verification**: Verify that the live GitHub Pages site matches the local version AFTER pushing.
    - Check the deployment status using `gh run list`.
    - Use `curl` to verify the version string in the live HTML.
    - If deployment fails or version is outdated, do not consider the task finished.

---

## ⚡ Key Implementations & Logic

### 1. Navigation Algorithm (v3.3-EXP)
- **Control Panel**: Injected UI with **START/STOP** and **PACE slider**.
- **Keyboard Mode (DEFAULT)**: Simulates Arrow Up key press for forward movement.
- **Auto-Unstuck Algorithm** (Experimental Mode):
  - Triggers when URL unchanged for `panicThreshold` steps
  - **Step 1**: Hold ArrowLeft for 300ms (~30° turn left)
  - **Step 2**: Press ArrowUp to move forward
  - **Step 3**: Verify URL changed, reset stuck count on success
- **Click Mode (Fallback)**:
  - Default target: 50% width, 70% height (Forward direction).
  - Visual markers show click locations.
- **Smart Observation**: Pauses when user clicks/drags (`isUserMouseDown`).
- **Session-Based**: Dimensions recalculated on every START.

### 2. Extra Features (Kept in Code, Not Exposed in UI)
- Polygon-based click targeting
- Horizon finder and guides
- Dynamic pace adjustment via slider
- **Selection**: User draws a polygon on a canvas overlay.
- **Targeting**: Clicks are randomly picked within the polygon.
- **Targeting**: Default clicks at 70% height (`screenWidth * 0.5, screenHeight * 0.7`).
- **Session-Based**: Dimensions recalculated on every START.

---

## 🛠️ Implementation Progress

- [x] Modular Architecture (v3.2) - Core engine, input handlers, UI controller
- [x] Comprehensive Test Suite - 83 tests covering all modules
- [x] Bundle Validation Tests - Verify bookmarklet.js output
- [x] CI/CD Pipeline - GitHub Actions runs tests on every push
- [x] Keyboard Mode Default - Simulates Arrow Up for navigation
- [x] Smart Observation - Pauses on user drag
- [x] One-Click Installation Page - GitHub Pages with clipboard copy
- [x] Auto-Unstuck Algorithm (v3.3) - Turn left 30°, move forward, verify
- [x] Documentation Update - README, Spec, UNSTUCK_ALGORITHM.md
- [x] Repo Cleanup - Removed unnecessary files

---

## 📂 File Map
- `src/core/engine.js` - Navigation logic with unstuck state machine (testable without UI)
- `src/input/handlers.js` - Keyboard/mouse event simulation (including simulateLongKeyPress)
- `src/ui/controller.js` - Control panel management
- `src/main.js` - Entry point
- `bookmarklet.js` - Auto-generated bundle
- `index.html` - One-click installation page
- `index.test.js` - Integration tests
- `build.js` - Bundles src/ → bookmarklet.js
- `UNSTUCK_ALGORITHM.md` - Detailed unstuck algorithm documentation
- `PROJECT_MEMORY.md` - This knowledge base
- `backup/` - Rollback point (v3.2-stable)
