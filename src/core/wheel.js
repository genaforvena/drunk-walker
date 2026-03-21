/**
 * Wheel component for Drunk Walker
 * Manages orientation and turning (left and right)
 */

export function createWheel(callbacks) {
  let orientation = 0; // 0-359

  const getOrientation = () => orientation;

  const setOrientation = (newOrientation) => {
    orientation = normalizeAngle(newOrientation);
  };

  const turnLeft = (angle, callback) => {
    // Update orientation IMMEDIATELY (intent-based)
    orientation = normalizeAngle(orientation - angle);

    // Convert angle to duration (10ms per degree as per existing code)
    const duration = Math.round(angle * 10);
    const clampedDuration = Math.max(300, Math.min(900, duration));

    let callbackCalled = false;
    const safeCallback = () => {
      if (callbackCalled) return;
      callbackCalled = true;
      if (callback) callback();
    };

    if (callbacks.onLongKeyPress) {
      callbacks.onLongKeyPress('ArrowLeft', clampedDuration, safeCallback);
      // Safety timeout in case onLongKeyPress doesn't call back
      setTimeout(safeCallback, clampedDuration + 500);
    } else {
      safeCallback();
    }
  };

  const turnRight = (angle, callback) => {
    // Update orientation IMMEDIATELY (intent-based)
    orientation = normalizeAngle(orientation + angle);

    // Convert angle to duration (10ms per degree)
    const duration = Math.round(angle * 10);
    const clampedDuration = Math.max(300, Math.min(900, duration));

    let callbackCalled = false;
    const safeCallback = () => {
      if (callbackCalled) return;
      callbackCalled = true;
      if (callback) callback();
    };

    if (callbacks.onLongKeyPress) {
      callbacks.onLongKeyPress('ArrowRight', clampedDuration, safeCallback);
      // Safety timeout
      setTimeout(safeCallback, clampedDuration + 500);
    } else {
      safeCallback();
    }
  };

  const normalizeAngle = (angle) => {
    angle = angle % 360;
    if (angle < 0) angle += 360;
    return angle;
  };

  return {
    getOrientation,
    setOrientation,
    turnLeft,
    turnRight,
    reset: () => { orientation = 0; }
  };
}
