# Drunk Walker Specification (v3.4-EXP)

## Executive Summary

**Drunk Walker** is a browser automation engine for Google Street View. It presses the **Arrow Up** key repeatedly to move forward, with automatic recovery when stuck. Path recording is available as an opt-in feature.

---

## 1. Overview

### 1.1 Concept
The engine simulates keyboard input (Arrow Up) at regular intervals to navigate Street View. When the URL remains unchanged for 3 consecutive steps, an auto-unstuck algorithm turns left 60° and attempts to continue.

### 1.2 Core Philosophy
- **Keyboard-first** — Simulates Arrow Up key press (not mouse clicks)
- **Auto-recovery** — Unstuck algorithm runs automatically when stuck
- **Opt-in recording** — Path recording is disabled by default, local-only
- **Zero install** — Runs entirely in browser console

---

## 2. Version History

| Version | Key Features |
|---------|--------------|
| v3.4-EXP | Path recording with JSON export, fixed 60° turn angle |
| v3.3-EXP | Auto-Unstuck Algorithm (turn left 60°, move forward, verify) |
| v3.2-EXP | Keyboard mode default, Smart Observation, Persistent control panel |
| v3.0 | Strict autonomy, forward-default targeting |

---

## 3. Functional Requirements

### 3.1 Control Panel UI

| Element | Type | Description |
|---------|------|-------------|
| START/STOP | Button | Toggle walking on/off |
| STATUS | Text | Shows WALKING, STUCK, or IDLE |
| STEPS | Counter | Total steps taken |
| PACE | Slider | 0.5 - 5.0 seconds between steps |
| Record Path | Checkbox | Enable path recording (off by default) |
| Copy Path JSON | Button | Export recorded path as JSON |

### 3.2 Core Algorithm (v3.4)

**Normal Walking:**
1. Wait for pace interval (default 2000ms)
2. Simulate ArrowUp key press
3. Record step (if path recording enabled)
4. Increment step counter

**Unstuck Sequence (automatic when stuck ≥ 3 steps):**
1. Hold ArrowLeft for 600ms (~60° turn)
2. Press ArrowUp to move forward
3. Wait one pace interval
4. Check if URL changed:
   - **Success**: Reset stuck count, resume walking
   - **Failure**: Increment stuck count, retry next cycle

### 3.3 Path Recording

**When enabled (checkbox checked):**
- Record `{ url: window.location.href, rotation: 60 }` after each step
- Store in memory array `walkPath[]`
- On "Copy Path JSON": export as formatted JSON to clipboard

**When disabled (default):**
- No data recorded
- No data sent anywhere
- walkPath array remains empty

---

## 4. Technical Specification

### 4.1 Engine State

```javascript
{
  status: 'IDLE' | 'WALKING',
  steps: number,
  stuckCount: number,
  unstuckState: 'IDLE' | 'TURNING' | 'MOVING' | 'VERIFYING',
  walkPath: Array<{ url: string, rotation: number }>
}
```

### 4.2 Configuration

```javascript
const defaultConfig = {
  pace: 2000,              // ms between steps
  kbOn: true,              // Keyboard mode (always on)
  expOn: true,             // Unstuck enabled (always on)
  panicThreshold: 3,       // Steps before unstuck triggers
  turnDuration: 600,       // ms for 60° left turn
  collectPath: false       // Path recording (off by default)
};
```

### 4.3 Event Simulation

**ArrowUp (forward):**
```javascript
targetEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
targetEl.dispatchEvent(new KeyboardEvent('keypress', { key: 'ArrowUp' }));
setTimeout(() => {
  targetEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp' }));
}, 50);
```

**ArrowLeft (turn, held):**
```javascript
targetEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
setTimeout(() => {
  targetEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft' }));
  callback();  // Continue with next step
}, turnDuration);  // 600ms default
```

---

## 5. Non-Functional Requirements

### 5.1 Performance
- **Bundle size**: Under 50KB
- **No dependencies**: Pure vanilla JavaScript
- **Load time**: Instant (no external resources)

### 5.2 Privacy
- **No tracking**: No analytics, no telemetry
- **Local storage**: Path data stays in browser memory
- **No identifiers**: No IP logging, no fingerprints
- **Opt-in only**: Recording disabled by default

### 5.3 Compatibility
- **Browsers**: Chrome, Firefox, Safari, Edge
- **No installation**: Console-based execution
- **Mobile support**: Works via remote console apps

---

## 6. User Interaction

### 6.1 Smart Pause
- Detects user mousedown events (isTrusted = true)
- Pauses walking while user drags to look around
- Resumes automatically when user releases

### 6.2 Control Panel
- Injected into page DOM (position: fixed, top-right)
- Cyberpunk aesthetic (green on black)
- Minimal footprint (180px wide)

---

## 7. Error Handling

### 7.1 Unstuck Failures
- If unstuck fails after multiple attempts, stuck count continues incrementing
- Status shows "STUCK (N)" or "PANIC! (STUCK N)"
- User can manually stop and reposition

### 7.2 Clipboard Failures
- If clipboard API unavailable, show alert
- Path recording continues to work locally

### 7.3 Network Failures
- No network calls in current version
- Backend server is optional and separate

---

## 8. Testing Requirements

### 8.1 Test Coverage
- **83 total tests** across 4 test files
- **100% pass required** before merge

### 8.2 Test Files
| File | Tests | Coverage |
|------|-------|----------|
| engine.test.js | 22 | Navigation, state, unstuck |
| handlers.test.js | 18 | Event simulation |
| bundle.test.js | 29 | Build validation |
| index.test.js | 14 | Integration |

---

## 9. Build Requirements

### 9.1 Output
- `bookmarklet.js` — Standard IIFE bundle
- `bookmarklet-console.js` — Console-friendly bundle

### 9.2 Validation
- File exists and is under 50KB
- Contains version string (v3.4-EXP)
- No ES6 imports/exports in output
- Wrapped in IIFE or void function

---

## 10. Deployment

### 10.1 GitHub Pages
- **Files**: index.html, bookmarklet.js, dashboard.html
- **URL**: https://genaforvena.github.io/drunk-walker/
- **Trigger**: Automatic on push to main

### 10.2 Backend Server (Optional)
- **Endpoint**: POST /api/submit-walk
- **Database**: SQLite (walks table)
- **Dashboard**: /dashboard route

---

## 11. Conclusion

Drunk Walker v3.4-EXP is a minimalist automation tool that:
1. Moves forward automatically (Arrow Up)
2. Recovers from stuck positions (60° left turn)
3. Records path optionally (local JSON export)
4. Respects user control (smart pause)

All features work without installation, dependencies, or data collection.
