/**
 * URL Parsing Utilities for Google Street View URLs
 */

export function extractLocationFromUrl(url) {
  if (!url) return null;
  try {
    const hashMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (hashMatch) return `${hashMatch[1]},${hashMatch[2]}`;
  } catch (e) {}
  return null;
}

export function extractYawFromUrl(url) {
  if (!url) return null;
  const match = url.match(/yaw[=%]3D?([0-9.]+)/i) || url.match(/,([0-9.]+)h/i);
  return match ? parseFloat(match[1]) : null;
}

export function parseLocation(locationStr) {
  if (!locationStr) return null;
  const parts = locationStr.split(',').map(Number);
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  return { lat: parts[0], lng: parts[1] };
}
