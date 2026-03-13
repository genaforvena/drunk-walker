# Drunk Walker: Street View Chaos Specification (v2.4-EXP)

## Executive Summary

**Drunk Walker** is a cross-browser automation engine that transforms Google Street View into a chaotic travelogue. It programmatically clicks at screen coordinates to navigate the map. The primary version is a **Console Script** distributed via a "One-Click Copy" web page.

---

## 1. Overview

### 1.1 Concept
The engine simulates user clicks at strategic screen locations. Movement is randomized by a "wobble" radius or constrained by a user-drawn polygon. v2.4-EXP enforces **Strict Autonomy**, removing all dependencies on user mouse movement or drag states.

### 1.2 Core Philosophy
- **No DOM interaction** – All interaction is via coordinate clicks.
- **Forward-Default** – Default clicks at 50% width, 70% height.
- **Custom Selection** – User can draw a polygon to define a specific click zone.
- **Auto-Recovery** – Exponential radius growth when the URL remains unchanged.
- **Strictly Autonomous** – No mouse tracking, no drag detection. The script ONLY clicks.

---

## 3. Functional Requirements

### 3.1 User Input (Control Panel UI)

| Field | Type | Description |
|-------|------|-------------|
| Pace | Slider | 0.5 - 5.0 seconds between clicks |
| Experimental Mode | Toggle | Enables URL-stuck detection and exponential chaos recovery |
| LEVEL URL | Button | Modifies URL pitch to 90t (horizontal) |
| SHOW HORIZON | Button | Toggles a guide line at 50% screen height |
| DRAW CLICK AREA | Button | Opens an overlay to draw a custom click polygon |

### 3.2 Core Algorithm (v2.4-EXP)

1. **Track State**:
    - Monitor `window.location.href` for stuck detection.
2. **Determine Target**:
    - If `customArea` (polygon) is defined:
        - Pick a random point `(tx, ty)` inside the polygon.
    - Else:
        - Target = "Forward" (50% width, 70% height).
3. **Calculate Radius**:
    - If `Experimental Mode` ON and `currentUrl == lastUrl`:
        - `stuckCount++`, `radius = 50 * (1.5 ^ stuckCount)`
    - Else:
        - `stuckCount = 0`, `radius = 50`
4. **Trigger Click**:
    - Apply random offset within `radius` if no `customArea`.
    - Dispatch `mousedown/up/click` events at target.
5. **Update HUD**:
    - Show steps and status.

---

## 4. Non-Functional Requirements

### 4.1 Ethical Considerations
- **Rate limiting** – Minimum 1 second interval.
- **Transparency** – HUD clearly shows "NAVIGATING" and target type (CURSOR/FORWARD).

---

## 5. Conclusion
Drunk Walker v1.2 focuses on simplicity. By default, it moves forward; however, the user can easily guide it with their mouse, turning the experience into an interactive "drunken" exploration of Street View.
