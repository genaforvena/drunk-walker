# Drunk Walker: Street View Chaos Specification (v3.1-EXP)

## Executive Summary

**Drunk Walker** is a cross-browser automation engine that transforms Google Street View into a chaotic travelogue. It programmatically clicks at screen coordinates to navigate the map. The primary version is a **Console Script** distributed via a "One-Click Copy" web page.

---

## 1. Overview

### 1.1 Concept
The engine simulates user clicks at strategic screen locations. Movement is randomized by a "wobble" radius or constrained by a user-drawn polygon. v3.1-EXP enforces **Strict Autonomy**, removing all dependencies on user mouse movement or drag states.

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
| Panic Threshold | Number | Steps before entering "Panic Mode" if URL is stuck |
| Experimental Mode | Toggle | Enables URL-stuck detection and chaos recovery |
| Keyboard Mode | Toggle | Simulates Arrow Up instead of mouse clicks |
| LEVEL URL | Button | Modifies URL pitch to 90t (horizontal) |
| SHOW HORIZON | Button | Toggles a guide line at 50% screen height |
| DRAW CLICK AREA | Button | Opens an overlay to draw a custom click polygon |

### 3.2 Core Algorithm (v3.0)

1. **Track State**:
    - Monitor `window.location.href` for stuck detection.
2. **Determine Mode**:
    - If `Keyboard Mode` ON:
        - If `Experimental Mode` ON and `isPanicMode`:
            - Target = "ArrowLeft" (30° turn).
        - Else:
            - Target = "ArrowUp" (Forward).
    - Else (Click Mode):
        - If `customArea` (polygon) is defined:
            - Pick a random point `(tx, ty)` inside the polygon.
        - Else:
            - Target = "Forward" (50% width, 70% height).
3. **Calculate Radius / Panic**:
    - If `Experimental Mode` ON and `currentUrl == lastUrl`:
        - `stuckCount++`.
        - If `stuckCount >= panicThreshold`: `isPanicMode = true`.
        - If in Click Mode and `isPanicMode`: `radius = clickRadius * (1.5 ^ (stuckCount - panicThreshold + 1))`.
    - Else:
        - `stuckCount = 0`, `isPanicMode = false`, `radius = clickRadius`.
4. **Trigger Action**:
    - If `Keyboard Mode`: Dispatch `keydown/keyup` for target key.
    - Else: Dispatch `mousedown/up/click` events at target with `radius` offset.
5. **Update HUD**:
    - Show steps, status (NAVIGATING/STUCK), target, and mode.

---

## 4. Non-Functional Requirements

### 4.1 Ethical Considerations
- **Rate limiting** – Minimum 1 second interval.
- **Transparency** – HUD clearly shows "NAVIGATING" and target type (CURSOR/FORWARD).

---

## 5. Conclusion
Drunk Walker v1.2 focuses on simplicity. By default, it moves forward; however, the user can easily guide it with their mouse, turning the experience into an interactive "drunken" exploration of Street View.
