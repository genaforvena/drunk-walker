# Drunk Walker: Firefox Extension Specification

## Executive Summary

**Drunk Walker** is a Firefox extension that transforms Google Street View into an automated, chaotic travelogue. Given an origin and destination, the extension enters full-screen mode and programmatically clicks at screen coordinates in a determined attempt to reach the destination—despite having no actual pathfinding ability. The result is a mesmerizing, often futile journey that prioritizes visual spectacle over navigation accuracy.

---

## 1. Overview

### 1.1 Concept
The extension treats Google Street View as a black box. Rather than parsing HTML elements or using APIs, it simulates user clicks at strategic screen locations, hoping to trigger "move forward" arrows. The algorithm is deterministic but fundamentally blind—it clicks where forward *should* be if the camera is oriented correctly, but has no way to verify.

### 1.2 Core Philosophy
- **No DOM interaction** – The extension never reads or manipulates page elements
- **Coordinate-based only** – All interaction is via screen coordinates
- **Assumes full-screen** – Browser chrome is hidden, maximizing available pixels
- **Tries its best** – When uncertain, it makes the most statistically promising guess

---

## 2. Technical Architecture

### 2.1 Manifest V3 Compliance
As required for new Firefox extensions, Drunk Walker uses Manifest V3 :

```json
{
  "manifest_version": 3,
  "name": "Drunk Walker",
  "version": "1.0.0",
  "description": "Automated chaotic Street View navigation",
  "permissions": [
    "activeTab",
    "storage",
    "scripting"
  ],
  "host_permissions": [
    "https://www.google.com/maps/*",
    "https://maps.google.com/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "Drunk Walker"
  },
  "background": {
    "scripts": ["background.js"]
  },
  "content_scripts": [{
    "matches": ["https://www.google.com/maps/*"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }]
}
```

### 2.2 Extension ID Requirement
Since this is a Manifest V3 extension intended for distribution, it must include a explicit extension ID in `browser_specific_settings` :

```json
"browser_specific_settings": {
  "gecko": {
    "id": "drunk-walker@example.com",
    "strict_min_version": "109.0"
  }
}
```

### 2.3 Component Architecture

```
┌─────────────────┐
│   popup.html    │  User enters origin/destination
│   (React/Vanilla)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  background.js  │  Manages state, triggers navigation
│  (Event Page)   │  
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   content.js    │  Injected into Maps tab
│                 │  • Detects Street View mode
│                 │  • Executes coordinate clicks
│                 │  • Reports position changes
└─────────────────┘
```

---

## 3. Functional Requirements

### 3.1 User Input (Popup UI)

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| Origin | Text input | Required | Starting location (address or lat,lng) |
| Destination | Text input | Required | Target location |
| Click Interval | Number slider | 1-10 seconds | Time between click attempts |
| Click Radius | Number slider | 10-100 pixels | Random offset from target coordinate |
| Max Steps | Number | 1-10,000 | Stop after this many clicks |
| Start Button | Action | - | Begins the journey |

### 3.2 State Management

```javascript
// Background script state
{
  status: 'idle' | 'navigating' | 'paused' | 'complete',
  origin: { lat: 56.2908486, lng: 43.9978324 },
  destination: { lat: 56.295, lng: 44.001 },
  currentPosition: { lat: null, lng: null }, // Updated from page
  stepsTaken: 0,
  maxSteps: 1000,
  clickInterval: 3000, // ms
  clickRadius: 50, // pixels
  sessionId: 'uuid-v4'
}
```

### 3.3 Core Algorithm

The extension uses **progressive optimistic clicking**:

1. **Calculate screen target** – Assume the "move forward" arrow appears in the lower-center region of the screen when the camera is oriented along the street [inferred from Street View UI behavior]
2. **Add random offset** – Within `clickRadius` pixels to simulate human imprecision
3. **Trigger click** – Dispatch mouse event at calculated coordinates
4. **Wait** – For `clickInterval` milliseconds
5. **Repeat** – Until destination reached (unlikely) or max steps exceeded

**Target coordinate formula**:
```
x = screenWidth * 0.5 + random(-radius, radius)
y = screenHeight * 0.7 + random(-radius, radius)
```

The 0.7 factor places clicks in the lower portion of the screen where navigation arrows typically appear when looking forward.

### 3.4 Full-Screen Handling

The extension assumes the browser is already in full-screen mode (F11). It does not attempt to enter full-screen programmatically due to browser restrictions on automation . A pre-flight check verifies full-screen status and warns the user if not detected.

### 3.5 Street View Detection

Content script continuously monitors the URL and DOM for indicators that Street View is active:

- URL pattern: `https://www.google.com/maps/@*/*/data=*` with panorama ID parameter
- Presence of Street View UI elements (detected via observation, not DOM access)

If Street View is not detected, navigation is paused and user is prompted to enter Street View mode.

---

## 4. User Interface Design

### 4.1 Popup Window

```
┌─────────────────────────────┐
│  Drunk Walker  v1.0         │
├─────────────────────────────┤
│  Origin:  [................] │
│  Dest:    [................] │
├─────────────────────────────┤
│  Click Interval: 3.0s  [----●] │
│  Click Radius:    50px  [----●] │
│  Max Steps:       1000  [----●] │
├─────────────────────────────┤
│  [🔴 STOP]  [▶ START]  [⏸ PAUSE] │
├─────────────────────────────┤
│  Status: Idle                │
│  Progress: 0/1000 steps      │
│  Position: --.--, --.--      │
│  Distance to dest: -- km     │
└─────────────────────────────┘
```

### 4.2 In-Page Overlay (Optional)

A small heads-up display can be injected showing:
- Current step count
- Destination bearing (approximate)
- "Drunk-o-meter" (randomness indicator)

This overlay is positioned in a corner and does not interfere with click targets.

---

## 5. Algorithm Deep Dive

### 5.1 The "Trying Its Best" Logic

Since the extension cannot know if a click actually triggered movement, it employs **optimistic navigation**:

1. **Assume forward movement** – After each click, increment a "confidence counter"
2. **Stagnation detection** – If URL/lat/lng hasn't changed after 3 clicks, assume stuck
3. **Panic mode** – When stuck, expand click radius and shift target region (try side arrows)
4. **Reset** – After 10 stuck clicks, return to default targeting

### 5.2 Position Tracking

The extension extracts current latitude/longitude from the URL format you identified:

```
https://www.google.com/maps/@56.2908486,43.9978324,3a,75y,...
                     ↑__________↑__________
                     lat        lng
```

A regex extracts these values after each URL change. This provides the only feedback loop.

### 5.3 Destination Proximity

Haversine formula calculates distance from current position to destination. When distance decreases, confidence increases; when distance increases, the algorithm may:
- Reduce click radius (tighter targeting)
- Shift target region slightly
- Log the event as "interesting"

---

## 6. Non-Functional Requirements

### 6.1 Performance
- Minimal CPU usage when idle
- Click execution < 50ms overhead
- Memory footprint < 50MB

### 6.2 Reliability
- Graceful degradation if Google Maps UI changes
- Automatic pause on navigation errors
- Session persistence across browser restarts (optional)

### 6.3 Ethical Considerations
- **Rate limiting** – Never click faster than 1 second intervals to avoid appearing as an attack
- **User consent** – Explicit start required; clear stop button always available
- **Transparency** – Logs all actions to browser console for user inspection

### 6.4 Security
- No external data transmission
- All processing local to browser
- Host permissions limited to Google Maps domains only 

---

## 7. Acceptance Criteria

### 7.1 Functional Tests

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| F01 | Enter valid origin/destination | Extension accepts input, enables Start |
| F02 | Start in Street View mode | Begins clicking at specified interval |
| F03 | Start outside Street View | Shows warning, waits for manual entry |
| F04 | Click execution | Mouse events dispatched at calculated coordinates |
| F05 | Position detection | URL parsed correctly, lat/lng updated |
| F06 | Max steps reached | Stops automatically, shows summary |
| F07 | Pause/Resume | Halts and resumes clicking |
| F08 | Stop | Terminates session, returns to idle |

### 7.2 Performance Tests

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| P01 | 1000 clicks | No memory leaks, stable performance |
| P02 | 1s interval | Consistent timing ±100ms |
| P03 | Full-screen toggle | Detection works, appropriate warnings |

### 7.3 Edge Cases

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| E01 | No Street View at origin | Pauses, prompts user |
| E02 | Google Maps UI update | May break; extension should fail gracefully |
| E03 | Network interruption | Pauses, resumes when connection restored |
| E04 | Destination unreachable | Runs until max steps, reports "lost" |

---

## 8. Installation & Distribution

### 8.1 Development Installation
1. Clone repository
2. Run `npm install` (if using build tools)
3. Navigate to `about:debugging`
4. Load temporary extension from `dist/` folder

### 8.2 Distribution on AMO
- Requires signed extension with unique ID 
- Must specify minimum Firefox version (109+ for MV3) 
- Self-distribution option available for beta testing 

---

## 9. Future Enhancements (V2)

- **Machine learning** – Train model on successful click patterns
- **Path recording** – Save journeys as GPX tracks
- **Social sharing** – Share "drunk walks" with friends
- **Voice narration** – Add commentary on the futile attempt to reach destination

---

## 10. Conclusion

Drunk Walker embraces the absurdity of trying to navigate with no pathfinding ability. It's part art project, part technical experiment, and entirely honest about its limitations. The extension doesn't pretend to be useful—it promises entertainment, chaos, and occasionally beautiful accidents.

As you noted, the chances of reaching the destination are astronomically low. But that's not the point. The point is to watch the world stumble by, one blind click at a time.
