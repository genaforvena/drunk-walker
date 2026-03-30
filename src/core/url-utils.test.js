/**
 * URL Utils Tests
 */

import { describe, it, expect } from 'vitest';
import {
  extractLocationFromUrl,
  extractYawFromUrl,
  parseLocation
} from './url-utils.js';

describe('extractLocationFromUrl', () => {
  it('should return null for null/undefined', () => {
    expect(extractLocationFromUrl(null)).toBeNull();
    expect(extractLocationFromUrl(undefined)).toBeNull();
    expect(extractLocationFromUrl('')).toBeNull();
  });

  it('should return null for invalid URL', () => {
    expect(extractLocationFromUrl('not-a-url')).toBeNull();
    expect(extractLocationFromUrl('https://example.com')).toBeNull();
  });

  it('should extract location from @lat,lng format', () => {
    const url = 'https://www.google.com/maps/@52.371234,4.876543,15z/';
    expect(extractLocationFromUrl(url)).toBe('52.371234,4.876543');
  });

  it('should handle negative latitudes', () => {
    const url = 'https://www.google.com/maps/@-33.8688,151.2093,15z/';
    expect(extractLocationFromUrl(url)).toBe('-33.8688,151.2093');
  });

  it('should handle negative longitudes', () => {
    const url = 'https://www.google.com/maps/@52.37,-4.87,15z/';
    expect(extractLocationFromUrl(url)).toBe('52.37,-4.87');
  });

  it('should handle both negative coordinates', () => {
    const url = 'https://www.google.com/maps/@-33.8,-122.4,15z/';
    expect(extractLocationFromUrl(url)).toBe('-33.8,-122.4');
  });

  it('should handle various precision levels', () => {
    expect(extractLocationFromUrl('https://www.google.com/maps/@52.3,4.8,15z/')).toBe('52.3,4.8');
    expect(extractLocationFromUrl('https://www.google.com/maps/@52.37123456,4.87654321,15z/')).toBe('52.37123456,4.87654321');
  });

  it('should work with full Street View URLs', () => {
    const url = 'https://www.google.com/maps/@52.370500,4.870500,3a,75y,270.00h,90.00t/data=!3m4!1e1';
    expect(extractLocationFromUrl(url)).toBe('52.370500,4.870500');
  });
});

describe('extractYawFromUrl', () => {
  it('should return null for null/undefined', () => {
    expect(extractYawFromUrl(null)).toBeNull();
    expect(extractYawFromUrl(undefined)).toBeNull();
    expect(extractYawFromUrl('')).toBeNull();
  });

  it('should return null for URL without yaw', () => {
    expect(extractYawFromUrl('https://www.google.com/maps/@52.37,4.87,15z/')).toBeNull();
  });

  it('should extract yaw from yaw%3D format', () => {
    const url = 'https://www.google.com/maps/@52.37,4.87,15z/data=!3m1!1e3?yaw%3D123.45';
    expect(extractYawFromUrl(url)).toBe(123.45);
  });

  it('should extract yaw from ,yawh format', () => {
    const url = 'https://www.google.com/maps/@52.370500,4.870500,3a,75y,270.00h,90.00t/data=!3m4!1e1';
    expect(extractYawFromUrl(url)).toBe(270);
  });

  it('should handle decimal yaws in yaw%3D format', () => {
    const url = 'https://www.google.com/maps/@52.37,4.87,15z?yaw%3D45.5';
    expect(extractYawFromUrl(url)).toBe(45.5);
  });

  it('should handle 0 yaw', () => {
    const url = 'https://www.google.com/maps/@52.370000,4.870000,3a,75y,0.00h,90.00t/data=!3m4!1e1';
    expect(extractYawFromUrl(url)).toBe(0);
  });
});

describe('parseLocation', () => {
  it('should return null for null/undefined', () => {
    expect(parseLocation(null)).toBeNull();
    expect(parseLocation(undefined)).toBeNull();
    expect(parseLocation('')).toBeNull();
  });

  it('should return null for invalid format', () => {
    expect(parseLocation('invalid')).toBeNull();
    expect(parseLocation('52.37')).toBeNull();
    expect(parseLocation('a,b,c')).toBeNull();
  });

  it('should parse valid location', () => {
    const result = parseLocation('52.37,4.87');
    expect(result.lat).toBe(52.37);
    expect(result.lng).toBe(4.87);
  });

  it('should handle negative coordinates', () => {
    const result = parseLocation('-33.8688,151.2093');
    expect(result.lat).toBe(-33.8688);
    expect(result.lng).toBe(151.2093);
  });

  it('should handle high precision', () => {
    const result = parseLocation('52.37123456789,4.87654321098');
    expect(result.lat).toBe(52.37123456789);
    expect(result.lng).toBe(4.87654321098);
  });
});
