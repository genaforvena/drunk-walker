# Drunk Walker: Street View Chaos Specification (v2.0-EXP)

## Executive Summary

**Drunk Walker** is a cross-browser automation engine that transforms Google Street View into a chaotic travelogue. It programmatically clicks at screen coordinates to navigate the map. The primary version is a **Console Script** distributed via a "One-Click Copy" web page.

---

## 1. Overview

### 1.1 Concept
The engine simulates user clicks at strategic screen locations. Movement is randomized by a "wobble" radius. v2.0-EXP introduces **Experimental Mode** for automatic recovery when the walker gets stuck in a loop or a dead end.

### 1.2 Core Philosophy
- **No DOM interaction** – Never reads or manipulates page elements.
- **Coordinate-based only** – All interaction is via screen coordinates.
- **Forward-Default** – Clicks happen near the "Forward" direction (50% width, 70% height).
- **Chaos-Driven Recovery** – If the URL remains unchanged, the system expands its search radius exponentially to find a clickable path.

---

## 3. Functional Requirements

### 3.1 User Input (Control Panel UI)

| Field | Type | Description |
|-------|------|-------------|
| Pace | Slider | 0.5 - 5.0 seconds between clicks |
| Experimental Mode | Toggle | Enables URL-stuck detection and exponential chaos recovery |

### 3.2 Core Algorithm (v2.0-EXP)

1. **Track State**:
    - Monitor `window.location.href` to detect stuck state.
    - Monitor `mousedown/up` to pause during manual drags.
2. **Determine Target**:
    - Target = "Forward" (50% width, 70% height).
3. **Calculate Radius**:
    - If `Experimental Mode` ON and `currentUrl == lastUrl`:
        - `stuckCount++`
        - `radius = 50 * (1.5 ^ stuckCount)`
    - Else:
        - `stuckCount = 0`, `radius = 50`
4. **Trigger Click**:
    - Apply random offset within `radius` to X and Y.
    - Dispatch `mousedown/up/click` events at target.
5. **Update HUD**:
    - Show steps and status (e.g., `WALKING` or `STUCK CHAOS LVL X`).

---

## 4. Non-Functional Requirements

### 4.1 Ethical Considerations
- **Rate limiting** – Minimum 1 second interval.
- **Transparency** – HUD clearly shows "NAVIGATING" and target type (CURSOR/FORWARD).

---

## 5. Conclusion
Drunk Walker v1.2 focuses on simplicity. By default, it moves forward; however, the user can easily guide it with their mouse, turning the experience into an interactive "drunken" exploration of Street View.
