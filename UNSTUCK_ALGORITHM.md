# Unstuck Algorithm v3.67.0-EXP

## Overview

When the walker detects it's stuck (URL hasn't changed for `panicThreshold` consecutive steps), it automatically executes an unstuck sequence to recover navigation.

**Design Principle:** Always turns left (~60°). This ensures consistent, predictable behavior—even if the walker ends up in a circular path, it's always turning in the same direction.

## Algorithm Flow

```
┌─────────────┐
│   WALKING   │
│  (ArrowUp)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐     No     ┌─────────────┐
│ URL Changed?│───────────▶│ stuckCount++│
└──────┬──────┘            └──────┬──────┘
       │ Yes                      │
       │                          ▼
       │                   ┌─────────────┐
       │                   │ stuckCount  │
       │                   │ >= threshold│
       │                   └──────┬──────┘
       │                          │ Yes
       │                          ▼
       │                  ┌───────────────┐
       │                  │ UNSTUCK MODE  │
       │                  └───────┬───────┘
       │                          │
       │                          ▼
       │                  ┌───────────────┐
       │                  │ Step 1: TURN  │
       │                  │ Hold ArrowLeft│
       │                  │ ~300ms (30°)  │
       │                  └───────┬───────┘
       │                          │
       │                          ▼
       │                  ┌───────────────┐
       │                  │ Step 2: MOVE  │
       │                  │ Press ArrowUp │
       │                  └───────┬───────┘
       │                          │
       │                          ▼
       │                  ┌───────────────┐
       │                  │ Step 3: VERIFY│
       │                  │ Check URL     │
       │                  └───────┬───────┘
       │                          │
       │         ┌────────────────┴────────────────┐
       │         │                                 │
       │         ▼                                 ▼
       │  ┌─────────────┐                 ┌─────────────┐
       │  │  SUCCESS    │                 │   FAILED    │
       │  │ stuckCount=0│                 │ stuckCount++│
       │  │ Resume walk │                 │ Retry next  │
       │  └─────────────┘                 └─────────────┘
       │
       └──────────────────────────────────────┘
```

## State Machine

The unstuck algorithm uses a state machine with 4 states:

| State       | Description                          | Action                            |
|-------------|--------------------------------------|-----------------------------------|
| `IDLE`      | Normal walking                       | Press ArrowUp                     |
| `TURNING`   | Executing turn left                  | Hold ArrowLeft (600ms, ~60°)      |
| `MOVING`    | Moving forward after turn            | Press ArrowUp                     |
| `VERIFYING` | Checking if unstuck succeeded        | Compare URL before/after sequence |

## Configuration

```javascript
const config = {
  pace: 2000,           // Time between steps (ms)
  panicThreshold: 3,    // Stuck count before unstuck triggers
  turnDuration: 600     // Hold ArrowLeft for ~60° turn (ms) - fixed
};
```

**Turn Angle:** Fixed at ~60° (600ms hold time)

## How It Works

### 1. Stuck Detection

When `expOn: true` (experimental mode), the engine tracks URL changes:
- If URL stays the same: `stuckCount++`
- If URL changes: `stuckCount = 0`

### 2. Unstuck Trigger

When `stuckCount >= panicThreshold`:
- Normal walking pauses
- Unstuck sequence begins

### 3. Turn Left

The algorithm holds `ArrowLeft` for `turnDuration` (600ms):
- This rotates the view left by approximately 60 degrees
- **Fixed angle:** Always turns left, ensuring consistent behavior
- Calibrated for Google Street View's turn speed

### 4. Move Forward

After turning, press `ArrowUp` once:
- Attempts to move in the new direction
- May find a path that was previously unavailable

### 5. Verification

After one `pace` interval (2000ms):
- Compare current URL with URL before unstuck
- **Success**: `stuckCount = 0`, resume normal walking
- **Failure**: `stuckCount++`, will retry on next tick

## User Interaction Safety

The unstuck sequence respects user interaction:
- Pauses if user clicks/drags (`isUserMouseDown`)
- Pauses if user is drawing (`isDrawing`)
- Only one unstuck sequence at a time (`unstuckState !== 'IDLE'`)

## Console Output

```
🤪 DRUNK WALKER: Unstuck successfully!
🤪 DRUNK WALKER: Still stuck after unstuck attempt
```

## Rollback

If issues occur, restore the previous version:
```bash
cp backup/bookmarklet-v3.2-stable.js bookmarklet.js
```

## Future Enhancements

- [ ] Adaptive turn duration based on environment
- [ ] Back up before turning
- [ ] Machine learning for optimal unstuck strategy
- [ ] Self-avoiding walk improvements
