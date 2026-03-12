# Drunk Walker: Firefox Extension Specification (v1.2)

## Executive Summary

**Drunk Walker** is a Firefox extension that transforms Google Street View into an automated, chaotic travelogue. It programmatically clicks at screen coordinates relative to the user's cursor or the "Forward" arrow region, attempting to "walk" through the map without any actual pathfinding logic or HTML awareness.

---

## 1. Overview

### 1.1 Concept
The extension treats Google Street View as a black box. It simulates user clicks at strategic screen locations. Movement is "guided" by the user's mouse position but randomized by a "wobble" radius. If the mouse is not present, it defaults to clicking forward.

### 1.2 Core Philosophy
- **No DOM interaction** – Never reads or manipulates page elements.
- **Coordinate-based only** – All interaction is via screen coordinates.
- **Cursor-Relative / Forward-Default** – Clicks happen near where the user points or in the forward direction.
- **Agnostic** – No concept of specific destinations.

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

### 3.2 Core Algorithm (v1.2)

1. **Track Cursor** – Content script monitors `mousemove` to store `lastMouseX/Y`.
2. **Determine Target**:
    - If mouse is in window: Target = Cursor Position.
    - If mouse is absent: Target = "Forward" (50% width, 70% height).
3. **Add Wobble** – Add random offset within `clickRadius`.
4. **Trigger Click** – Dispatch `mousedown/up/click` events at target.

---

## 4. Non-Functional Requirements

### 4.1 Ethical Considerations
- **Rate limiting** – Minimum 1 second interval.
- **Transparency** – HUD clearly shows "NAVIGATING" and target type (CURSOR/FORWARD).

---

## 5. Conclusion
Drunk Walker v1.2 focuses on simplicity. By default, it moves forward; however, the user can easily guide it with their mouse, turning the experience into an interactive "drunken" exploration of Street View.
