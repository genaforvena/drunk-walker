/**
 * Graph Module Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedTransitionGraph, NodeInfo } from './graph.js';

describe('NodeInfo', () => {
  let node;

  beforeEach(() => {
    node = new NodeInfo('52.37,4.87', 52.37, 4.87, 0);
  });

  it('should create node with location', () => {
    expect(node.location).toBe('52.37,4.87');
    expect(node.lat).toBe(52.37);
    expect(node.lng).toBe(4.87);
  });

  it('should start with empty tried yaws', () => {
    expect(node.triedYaws.size).toBe(0);
    expect(node.successfulYaws.size).toBe(0);
    expect(node.isFullyExplored).toBe(false);
  });

  describe('recordAttempt', () => {
    it('should record tried yaw', () => {
      node.recordAttempt(30, false, null);
      expect(node.triedYaws.size).toBe(1);
    });

    it('should record successful yaw', () => {
      node.recordAttempt(30, true, '52.38,4.87');
      expect(node.triedYaws.size).toBe(1);
      expect(node.successfulYaws.size).toBe(1);
    });

    it('should bucket yaws to 60-degree intervals', () => {
      node.recordAttempt(0, false, null);
      node.recordAttempt(60, false, null);
      node.recordAttempt(120, false, null);
      expect(node.triedYaws.size).toBe(3);
      expect(node.triedYaws.has(0)).toBe(true);
      expect(node.triedYaws.has(60)).toBe(true);
      expect(node.triedYaws.has(120)).toBe(true);
    });

    it('should mark as fully explored after 5 attempts', () => {
      for (let i = 0; i < 5; i++) {
        node.recordAttempt(i * 60, false, null);
      }
      expect(node.isFullyExplored).toBe(true);
    });

    it('should not mark as fully explored before 5 attempts', () => {
      for (let i = 0; i < 4; i++) {
        node.recordAttempt(i * 60, false, null);
      }
      expect(node.isFullyExplored).toBe(false);
    });
  });

  describe('hasUntriedYaws', () => {
    it('should return true when fewer than 6 yaws tried', () => {
      expect(node.hasUntriedYaws()).toBe(true);
    });

    it('should return false when 6 yaws tried', () => {
      [0, 60, 120, 180, 240, 300].forEach(y => node.recordAttempt(y, false, null));
      expect(node.hasUntriedYaws()).toBe(false);
    });
  });
});

describe('EnhancedTransitionGraph', () => {
  let graph;

  beforeEach(() => {
    graph = new EnhancedTransitionGraph();
  });

  it('should start empty', () => {
    expect(graph.nodes.size).toBe(0);
    expect(graph.connections.size).toBe(0);
  });

  describe('getOrCreate', () => {
    it('should create new node', () => {
      const node = graph.getOrCreate('52.37,4.87', 52.37, 4.87, 0);
      expect(node).toBeDefined();
      expect(node.location).toBe('52.37,4.87');
      expect(graph.nodes.size).toBe(1);
    });

    it('should return existing node', () => {
      const node1 = graph.getOrCreate('52.37,4.87', 52.37, 4.87, 0);
      const node2 = graph.getOrCreate('52.37,4.87', 52.37, 4.87, 0);
      expect(node1).toBe(node2);
      expect(graph.nodes.size).toBe(1);
    });

    it('should create connection set for node', () => {
      graph.getOrCreate('52.37,4.87', 52.37, 4.87, 0);
      expect(graph.connections.get('52.37,4.87')).toBeDefined();
    });
  });

  describe('get', () => {
    it('should return node if exists', () => {
      graph.getOrCreate('52.37,4.87', 52.37, 4.87, 0);
      expect(graph.get('52.37,4.87')).toBeDefined();
    });

    it('should return undefined if not exists', () => {
      expect(graph.get('52.37,4.87')).toBeUndefined();
    });
  });

  describe('getConnections', () => {
    it('should return empty set for unknown location', () => {
      expect(graph.getConnections('52.37,4.87').size).toBe(0);
    });

    it('should return connection set for known location', () => {
      graph.getOrCreate('52.37,4.87', 52.37, 4.87, 0);
      expect(graph.getConnections('52.37,4.87')).toBeDefined();
    });
  });

  describe('recordMovement', () => {
    it('should record bidirectional movement', () => {
      graph.recordMovement('52.37,4.87', '52.38,4.87', 0, 180, 0);
      
      const fromNode = graph.get('52.37,4.87');
      const toNode = graph.get('52.38,4.87');
      
      expect(fromNode).toBeDefined();
      expect(toNode).toBeDefined();
      expect(fromNode.successfulYaws.size).toBeGreaterThan(0);
      expect(toNode.successfulYaws.size).toBeGreaterThan(0);
    });

    it('should record connection', () => {
      graph.recordMovement('52.37,4.87', '52.38,4.87', 0, 180, 0);
      
      const connections = graph.getConnections('52.37,4.87');
      expect(connections.has('52.38,4.87')).toBe(true);
    });
  });

  describe('recordFailedAttempt', () => {
    it('should record failed yaw', () => {
      graph.recordFailedAttempt('52.37,4.87', 0, 0);
      
      const node = graph.get('52.37,4.87');
      expect(node.triedYaws.size).toBe(1);
      expect(node.successfulYaws.size).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should count total nodes', () => {
      graph.recordMovement('52.37,4.87', '52.38,4.87', 0, 180, 0);
      graph.recordMovement('52.38,4.87', '52.39,4.87', 0, 180, 1);
      
      const stats = graph.getStats();
      expect(stats.totalNodes).toBe(3);
    });

    it('should identify crossroads', () => {
      graph.recordMovement('52.37,4.87', '52.38,4.87', 0, 180, 0);
      graph.recordMovement('52.37,4.87', '52.36,4.87', 180, 0, 1);
      graph.recordMovement('52.37,4.87', '52.37,4.88', 90, 270, 2);
      
      const stats = graph.getStats();
      expect(stats.crossroads).toBe(1);
    });

    it('should identify dead ends', () => {
      graph.recordMovement('52.37,4.87', '52.38,4.87', 0, 180, 0);
      
      const stats = graph.getStats();
      expect(stats.deadEnds).toBe(2);
    });
  });

  describe('isCrossroad', () => {
    it('should return true for node with 3+ connections', () => {
      graph.recordMovement('52.37,4.87', '52.38,4.87', 0, 180, 0);
      graph.recordMovement('52.37,4.87', '52.36,4.87', 180, 0, 1);
      graph.recordMovement('52.37,4.87', '52.37,4.88', 90, 270, 2);
      
      expect(graph.isCrossroad('52.37,4.87')).toBe(true);
    });

    it('should return false for node with <3 connections', () => {
      graph.recordMovement('52.37,4.87', '52.38,4.87', 0, 180, 0);
      
      expect(graph.isCrossroad('52.37,4.87')).toBe(false);
    });

    it('should return false for unknown node', () => {
      expect(graph.isCrossroad('52.37,4.87')).toBeFalsy();
    });
  });
});
