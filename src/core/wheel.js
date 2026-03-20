/**
 * Wheel component for Drunk Walker
 * Manages orientation and turning (only left)
 */

export function createWheel(callbacks) {
  let orientation = 0; // 0-359

  const getOrientation = () => orientation;

  const setOrientation = (newOrientation) => {
    orientation = normalizeAngle(newOrientation);
  };

  const turnLeft = (angle, callback) => {
    // Convert angle to duration (10ms per degree as per existing code)
    const duration = Math.round(angle * 10);
    const clampedDuration = Math.max(300, Math.min(900, duration));

    if (callbacks.onLongKeyPress) {
      callbacks.onLongKeyPress('ArrowLeft', clampedDuration, () => {
        orientation = normalizeAngle(orientation - angle);
        if (callback) callback();
      });
    } else {
      orientation = normalizeAngle(orientation - angle);
      if (callback) callback();
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
    reset: () => { orientation = 0; }
  };
}
