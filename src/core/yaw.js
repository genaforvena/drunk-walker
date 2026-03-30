/**
 * Yaw Utilities - Angle and Direction Math
 */

import { YAW_BUCKETS } from './config.js';

export function normalizeAngle(angle) {
  angle = angle % 360;
  if (angle < 0) angle += 360;
  return angle;
}

export function yawDifference(yaw1, yaw2) {
  let diff = Math.abs(normalizeAngle(yaw1) - normalizeAngle(yaw2));
  if (diff > 180) diff = 360 - diff;
  return diff;
}

export function getLeftTurnAngle(currentYaw, targetYaw) {
  let angle = (normalizeAngle(currentYaw) - normalizeAngle(targetYaw) + 360) % 360;
  return angle;
}

export function getTurnDirection(currentYaw, targetYaw) {
  const leftAngle = getLeftTurnAngle(currentYaw, targetYaw);
  const rightAngle = (360 - leftAngle) % 360;
  return rightAngle < leftAngle ? 'right' : 'left';
}

export function calculateYawFromMove(fromLocation, toLocation) {
  if (!fromLocation || !toLocation || fromLocation === toLocation) {
    return null;
  }
  const fromParts = fromLocation.split(',').map(Number);
  const toParts = toLocation.split(',').map(Number);
  const dLat = toParts[0] - fromParts[0];
  const dLng = toParts[1] - fromParts[1];
  let yaw = Math.atan2(dLng, dLat) * 180 / Math.PI;
  if (yaw < 0) yaw += 360;
  return Math.round(yaw);
}

export function calculateForwardBearing(previousLocation, currentLocation) {
  return calculateYawFromMove(previousLocation, currentLocation);
}

export function getYawBuckets() {
  return [...YAW_BUCKETS];
}

export function getUntriedYaws(triedYaws) {
  return YAW_BUCKETS.filter(y => !triedYaws.has(y));
}
