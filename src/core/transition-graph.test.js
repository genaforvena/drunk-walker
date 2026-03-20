/**
 * Transition Graph Tests
 */

import { describe, it, expect } from 'vitest';
import { createTransitionGraph } from './transition-graph.js';

describe('TransitionGraph', () => {
  describe('Basic Operations', () => {
    it('should record transitions', () => {
      const graph = createTransitionGraph();
      
      graph.record('52.37,4.90', '52.371,4.901', 90, 95);
      
      expect(graph.hasConnection('52.37,4.90', '52.371,4.901')).toBe(true);
      expect(graph.stats.totalTransitions).toBe(1);
    });
    
    it('should track unique connections', () => {
      const graph = createTransitionGraph();
      
      graph.record('A', 'B', 90, 95);
      graph.record('A', 'B', 90, 96);  // Same connection, different yaw
      graph.record('A', 'C', 90, 180);  // New connection
      
      expect(graph.stats.uniqueConnections).toBe(2);
      expect(graph.stats.totalTransitions).toBe(3);
    });
    
    it('should get connections for a location', () => {
      const graph = createTransitionGraph();
      
      graph.record('A', 'B', 90, 95);
      graph.record('A', 'C', 90, 180);
      graph.record('A', 'D', 90, 270);
      
      const connections = graph.getConnections('A');
      
      expect(connections.has('B')).toBe(true);
      expect(connections.has('C')).toBe(true);
      expect(connections.has('D')).toBe(true);
      expect(connections.size).toBe(3);
    });
    
    it('should return empty set for unknown location', () => {
      const graph = createTransitionGraph();
      
      const connections = graph.getConnections('unknown');
      
      expect(connections.size).toBe(0);
    });
  });
  
  describe('Find Escape', () => {
    it('should find unvisited escape', () => {
      const graph = createTransitionGraph();
      const visitedUrls = new Map();
      
      graph.record('A', 'B', 90, 95);
      graph.record('A', 'C', 90, 180);
      graph.record('A', 'D', 90, 270);
      
      // Mark B as visited
      visitedUrls.set('B', 1);
      
      const escape = graph.findEscape('A', visitedUrls);
      
      // Should return C or D (unvisited)
      expect(escape).toMatch(/^[CD]$/);
    });
    
    it('should return null if all connections visited', () => {
      const graph = createTransitionGraph();
      const visitedUrls = new Map();
      
      graph.record('A', 'B', 90, 95);
      graph.record('A', 'C', 90, 180);
      
      visitedUrls.set('B', 1);
      visitedUrls.set('C', 1);
      
      const escape = graph.findEscape('A', visitedUrls);
      
      expect(escape).toBe(null);
    });
  });
  
  describe('Yaw Correction', () => {
    it('should calculate average yaw from transitions', () => {
      const graph = createTransitionGraph();
      
      graph.record('A', 'B', 90, 95);
      graph.record('A', 'B', 90, 100);
      graph.record('A', 'B', 90, 98);
      
      const avgYaw = graph.getYawCorrection('A', 'B');
      
      expect(avgYaw).toBeCloseTo(97.67, 1);  // (95 + 100 + 98) / 3
    });
    
    it('should return null for unknown transition', () => {
      const graph = createTransitionGraph();
      
      const yaw = graph.getYawCorrection('A', 'B');
      
      expect(yaw).toBe(null);
    });
  });
  
  describe('Bidirectional Analysis', () => {
    it('should find bidirectional pairs', () => {
      const graph = createTransitionGraph();
      
      graph.record('A', 'B', 90, 95);
      graph.record('B', 'A', 270, 265);
      graph.record('C', 'D', 180, 185);  // Unidirectional
      
      const pairs = graph.getBidirectionalPairs();
      
      expect(pairs.length).toBe(1);
      expect(pairs[0]).toEqual({ a: 'A', b: 'B' });
    });
    
    it('should analyze yaw deltas', () => {
      const graph = createTransitionGraph();
      
      // Create pairs with different yaw deltas
      graph.record('A', 'B', 90, 95);
      graph.record('B', 'A', 270, 265);  // Delta: 170°
      
      graph.record('C', 'D', 0, 5);
      graph.record('D', 'C', 180, 175);  // Delta: 170°
      
      const analysis = graph.analyzeYawDeltas();
      
      expect(analysis.count).toBe(2);
      expect(analysis.avg).toBeCloseTo(170, 0);
    });
    
    it('should return empty stats for no bidirectional pairs', () => {
      const graph = createTransitionGraph();
      
      graph.record('A', 'B', 90, 95);
      graph.record('C', 'D', 180, 185);  // No reverse
      
      const analysis = graph.analyzeYawDeltas();
      
      expect(analysis.count).toBe(0);
    });
  });
  
  describe('Graph Statistics', () => {
    it('should calculate graph statistics', () => {
      const graph = createTransitionGraph();
      
      // Create linear chain: A-B-C-D (with returns)
      graph.record('A', 'B', 90, 95);
      graph.record('B', 'A', 270, 265);
      graph.record('B', 'C', 90, 95);
      graph.record('C', 'B', 270, 265);
      graph.record('C', 'D', 90, 95);
      graph.record('D', 'C', 270, 265);
      
      const stats = graph.getStats();
      
      expect(stats.locations).toBe(4);  // A, B, C, D all have outgoing
      expect(stats.linearNodes).toBe(2);  // B and C have degree 2 (after bidirectional)
      expect(stats.branchingNodes).toBe(0);
    });
    
    it('should detect branching nodes', () => {
      const graph = createTransitionGraph();
      
      // Create star: A connected to B, C, D
      graph.record('A', 'B', 90, 95);
      graph.record('A', 'C', 180, 185);
      graph.record('A', 'D', 270, 265);
      
      const stats = graph.getStats();
      
      expect(stats.locations).toBe(1);  // Only A has outgoing connections
      expect(stats.branchingNodes).toBe(1);  // A has degree 3
    });
  });
  
  describe('Serialization', () => {
    it('should export to JSON', () => {
      const graph = createTransitionGraph();
      
      graph.record('A', 'B', 90, 95);
      graph.record('B', 'A', 270, 265);
      
      const json = graph.toJSON();
      
      expect(json.connections).toBeDefined();
      expect(json.transitions).toBeDefined();
      expect(json.stats.totalTransitions).toBe(2);
    });
    
    it('should import from JSON', () => {
      const graph1 = createTransitionGraph();
      graph1.record('A', 'B', 90, 95);
      
      const json = graph1.toJSON();
      
      const graph2 = createTransitionGraph();
      graph2.fromJSON(json);
      
      expect(graph2.hasConnection('A', 'B')).toBe(true);
      expect(graph2.stats.totalTransitions).toBe(1);
    });
    
    it('should clear data on import', () => {
      const graph = createTransitionGraph();
      graph.record('A', 'B', 90, 95);
      
      graph.fromJSON({ connections: [], transitions: [], stats: { totalTransitions: 0, uniqueConnections: 0 } });
      
      expect(graph.hasConnection('A', 'B')).toBe(false);
      expect(graph.stats.totalTransitions).toBe(0);
    });
  });
  
  describe('Clear', () => {
    it('should clear all data', () => {
      const graph = createTransitionGraph();
      
      graph.record('A', 'B', 90, 95);
      graph.record('B', 'A', 270, 265);
      graph.clear();
      
      expect(graph.stats.totalTransitions).toBe(0);
      expect(graph.stats.uniqueConnections).toBe(0);
      expect(graph.hasConnection('A', 'B')).toBe(false);
    });
  });
});

describe('TransitionGraph Integration', () => {
  it('should handle realistic walk data', () => {
    const graph = createTransitionGraph();
    
    // Simulate a linear walk: A → B → C → D → C → B → A
    const walk = [
      { loc: 'A', yaw: 0 },
      { loc: 'B', yaw: 90 },
      { loc: 'C', yaw: 90 },
      { loc: 'D', yaw: 90 },
      { loc: 'C', yaw: 270 },
      { loc: 'B', yaw: 270 },
      { loc: 'A', yaw: 270 }
    ];
    
    for (let i = 1; i < walk.length; i++) {
      graph.record(walk[i-1].loc, walk[i].loc, walk[i-1].yaw, walk[i].yaw);
    }
    
    // Verify graph structure
    expect(graph.stats.totalTransitions).toBe(6);
    expect(graph.stats.uniqueConnections).toBe(6);  // A→B, B→C, C→D, D→C, C→B, B→A
    
    // Check bidirectional analysis
    const analysis = graph.analyzeYawDeltas();
    expect(analysis.count).toBe(3);  // A↔B, B↔C, C↔D
  });
});
