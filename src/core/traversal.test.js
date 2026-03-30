/**
 * Traversal Utility Tests
 * Tests helper functions from traversal.js
 */

import { describe, it, expect } from 'vitest';
import { extractYawFromUrl, extractLocationFromUrl } from './traversal.js';

describe('Traversal Utilities', () => {
  describe('extractYawFromUrl', () => {
    it('should extract yaw from URL with yaw%3D format', () => {
      const url = 'https://www.google.com/maps/place/...yaw%3D195.58...';
      expect(extractYawFromUrl(url)).toBe(195.58);
    });

    it('should return null for URL without yaw', () => {
      const url = 'https://www.google.com/maps/@52.37,4.87';
      expect(extractYawFromUrl(url)).toBe(null);
    });

    it('should return null for null/undefined', () => {
      expect(extractYawFromUrl(null)).toBe(null);
      expect(extractYawFromUrl(undefined)).toBe(null);
    });

    it('should handle integer yaw', () => {
      const url = 'https://www.google.com/maps/...yaw%3D90...';
      expect(extractYawFromUrl(url)).toBe(90);
    });
  });

  describe('extractLocationFromUrl', () => {
    it('should extract location from URL hash format', () => {
      const url = 'https://www.google.com/maps/@52.371234,4.876543,3a,75y,90h,90t';
      expect(extractLocationFromUrl(url)).toBe('52.371234,4.876543');
    });

    it('should extract location with negative coordinates', () => {
      const url = 'https://www.google.com/maps/@-33.8688,151.2093,3a,75y,90h,90t';
      expect(extractLocationFromUrl(url)).toBe('-33.8688,151.2093');
    });

    it('should return null for URL without location', () => {
      const url = 'https://www.google.com/maps/place/somewhere';
      expect(extractLocationFromUrl(url)).toBe(null);
    });

    it('should return null for null/undefined', () => {
      expect(extractLocationFromUrl(null)).toBe(null);
      expect(extractLocationFromUrl(undefined)).toBe(null);
    });

    it('should handle URL with additional parameters', () => {
      const url = 'https://www.google.com/maps/@52.37,4.87,3a,75y,90h,90t/data=!3m7!1e1!3m5';
      expect(extractLocationFromUrl(url)).toBe('52.37,4.87');
    });
  });
});
