# Drunk Walker: Firefox Extension Specification (v1.1)

## Executive Summary

**Drunk Walker** is a Firefox extension that transforms Google Street View into an automated, chaotic travelogue. It programmatically clicks at screen coordinates relative to the user's cursor or the screen center, attempting to "walk" through the map without any actual pathfinding logic or HTML awareness.

---

## 1. Overview

### 1.1 Concept
The extension treats Google Street View as a black box. It simulates user clicks at strategic screen locations, hoping to trigger "move forward" or "turn" interactions. The movement is "guided" by the user's mouse position but randomized by a "wobble" radius.

### 1.2 Core Philosophy
- **No DOM interaction** – Never reads or manipulates page elements.
- **Coordinate-based only** – All interaction is via screen coordinates.
- **Cursor-Relative** – Clicks happen near where the user is pointing.
- **Agnostic** – No concept of origin, destination, or specific paths.

---

## 2. Technical Architecture

### 2.1 Component Architecture

```
┌─────────────────┐
│   popup.html    │  User sets parameters (Interval, Radius)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  background.js  │  Manages state, triggers navigation loop
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   content.js    │  Injected into Maps tab
│                 │  • Tracks mouse position
│                 │  • Detects Street View & URL changes
│                 │  • Executes coordinate clicks
└─────────────────┘
```

---

## 3. Functional Requirements

### 3.1 User Input (Popup UI)

| Field | Type | Description |
|-------|------|-------------|
| Click Interval | Slider | 1-10 seconds between clicks |
| Click Radius | Slider | Random offset (px) from target |
| Max Steps | Number | Auto-stop limit |

### 3.2 Core Algorithm (v1.1)

1. **Track Cursor** – Content script monitors `mousemove` to store `lastMouseX/Y`.
2. **Determine Target**:
    - If mouse is in window: Target = Cursor Position.
    - If mouse is absent: Target = Screen Center (50%, 50%).
3. **Add Wobble** – Add random offset within `clickRadius`.
4. **Trigger Click** – Dispatch `mousedown/up/click` events at target.
5. **Panic Mode** – If URL hasn't changed in 3 clicks, click the screen sides (20% or 80% width).

---

## 4. Algorithm Deep Dive

### 4.1 Stagnation Detection
The extension monitors the browser URL. If the URL remains identical after a click command, it assumes the click hit a dead zone or a wall. After 3 failures, it enters **Panic Mode** to force a camera rotation.

---

## 5. Non-Functional Requirements

### 5.1 Ethical Considerations
- **Rate limiting** – Minimum 1 second interval.
- **Transparency** – HUD clearly shows "NAVIGATING" and target type (CURSOR/CENTER/PANIC).

---

## 6. Conclusion
Drunk Walker v1.1 shifts from a failed pathfinder to a successful chaos engine. By following the cursor, it gives the user a sense of "drunk steering" while maintaining the original promise of a coordinate-blind, automated journey.
