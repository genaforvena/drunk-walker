# Drunk Walker: Street View Chaos Specification (v3.3-EXP)

## Executive Summary

**Drunk Walker** is a cross-browser automation engine that transforms Google Street View into a chaotic travelogue. It programmatically clicks at screen coordinates to navigate the map. The primary version is a **Console Script** distributed via a "One-Click Copy" web page.

---

## 1. Overview

### 1.1 Concept
The engine simulates user clicks at strategic screen locations. Movement is randomized by a "wobble" radius or constrained by a user-drawn polygon. v3.3-EXP introduces **Auto-Unstuck Algorithm** for automatic recovery when navigation gets stuck.

### 1.2 Core Philosophy
- **No DOM interaction** – All interaction is via coordinate clicks or keyboard events.
- **Forward-Default** – Default clicks at 50% width, 70% height.
- **Custom Selection** – User can draw a polygon to define a specific click zone.
- **Auto-Recovery** – When stuck, automatically turns left 30° and moves forward.
- **Strictly Autonomous** – No mouse tracking, no drag detection. The script ONLY clicks.

---

## 2. Version History

| Version | Key Features |
|---------|--------------|
| v3.3-EXP | Auto-Unstuck Algorithm (turn left 30°, move forward, verify) |
| v3.2-EXP | Keyboard mode default, Smart Observation, Persistent control panel |
| v3.0 | Strict autonomy, forward-default targeting |

---

## 3. Functional Requirements

### 3.1 User Input (Control Panel UI)

| Field | Type | Description |
|-------|------|-------------|
| Pace | Slider | 0.5 - 5.0 seconds between clicks |
| Panic Threshold | Number | Steps before triggering unstuck algorithm |
| Experimental Mode | Toggle | Enables URL-stuck detection and auto-recovery |
| Keyboard Mode | Toggle | Simulates Arrow Up instead of mouse clicks |
| LEVEL URL | Button | Modifies URL pitch to 90t (horizontal) |
| SHOW HORIZON | Button | Toggles a guide line at 50% screen height |
| DRAW CLICK AREA | Button | Opens an overlay to draw a custom click polygon |

### 3.2 Core Algorithm (v3.3)

1. **Track State**:
    - Monitor `window.location.href` for stuck detection.
2. **Determine Mode**:
    - If `Keyboard Mode` ON:
        - Execute `ArrowUp` key press (forward movement).
    - Else (Click Mode):
        - If `customArea` (polygon) is defined:
            - Pick a random point `(tx, ty)` inside the polygon.
        - Else:
            - Target = "Forward" (50% width, 70% height).
3. **Stuck Detection & Unstuck**:
    - If `Experimental Mode` ON and `currentUrl == lastUrl`:
        - `stuckCount++`.
        - If `stuckCount >= panicThreshold`: Trigger **Unstuck Algorithm**.
    - Else:
        - `stuckCount = 0`.
4. **Unstuck Algorithm** (when stuckCount >= threshold):
    - **Step 1 (TURN)**: Hold `ArrowLeft` for 300ms (~30° turn left).
    - **Step 2 (MOVE)**: Press `ArrowUp` to move forward in new direction.
    - **Step 3 (VERIFY)**: After one pace interval, check if URL changed.
        - Success: `stuckCount = 0`, resume normal walking.
        - Failure: `stuckCount++`, retry on next cycle.
5. **Trigger Action**:
    - If `Keyboard Mode`: Dispatch `keydown/keyup` for target key.
    - Else: Dispatch `mousedown/up/click` events at target with `radius` offset.
6. **Update HUD**:
    - Show steps, status (WALKING/STUCK/PANIC), and mode.

### 3.3 Unstuck State Machine

| State       | Description                          | Action                            |
|-------------|--------------------------------------|-----------------------------------|
| `IDLE`      | Normal walking                       | Press ArrowUp                     |
| `TURNING`   | Executing turn left                  | Hold ArrowLeft for 300ms          |
| `MOVING`    | Moving forward after turn            | Press ArrowUp                     |
| `VERIFYING` | Checking if unstuck succeeded        | Compare URL before/after sequence |

---

## 4. Non-Functional Requirements

### 4.1 Ethical Considerations
- **Rate limiting** – Minimum 0.5 second interval.
- **Transparency** – HUD clearly shows current status and step count.

### 4.2 Performance
- **Bundle size** – Keep under 50KB for quick loading.
- **No external dependencies** – Pure vanilla JavaScript.

---

## 5. Conclusion
Drunk Walker v3.3-EXP focuses on autonomous navigation with intelligent recovery. The Auto-Unstuck Algorithm enables the walker to recover from stuck situations by turning left 30° and attempting to move in a new direction, creating a more robust and continuous exploration experience.
