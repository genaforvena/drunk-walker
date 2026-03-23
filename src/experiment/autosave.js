/**
 * Auto-Save Module for Drunk Walker Experiments
 * 
 * Provides automatic backup of walk progress to survive crashes.
 * Saves to IndexedDB (browser) or filesystem (Node.js).
 * 
 * Usage:
 *   const autosaver = createAutosaver(engine, algorithm);
 *   autosaver.start();  // Begin auto-saving every 60 seconds
 * 
 * @version 1.0.0
 */

// Default configuration
const DEFAULT_CONFIG = {
  intervalMs: 60000,        // Save every 60 seconds
  maxBackups: 5,            // Keep last 5 backups
  includeGraph: true,       // Include transition graph
  includePath: true,        // Include walk path
  compressPath: false       // Compress path (future optimization)
};

/**
 * Serialize transition graph for storage
 */
function serializeGraph(graph) {
  if (!graph) return null;
  
  const nodes = [];
  const connections = [];
  
  if (graph.nodes) {
    for (const [loc, node] of graph.nodes.entries()) {
      nodes.push({
        location: node.location,
        lat: node.lat,
        lng: node.lng,
        triedYaws: Array.from(node.triedYaws || []),
        successfulYaws: Array.from(node.successfulYaws || []),
        isFullyExplored: node.isFullyExplored || false
      });
    }
  }
  
  if (graph.connections) {
    for (const [loc, connSet] of graph.connections.entries()) {
      connections.push({
        from: loc,
        to: Array.from(connSet)
      });
    }
  }
  
  return { nodes, connections };
}

/**
 * IndexedDB wrapper for browser storage
 */
const IndexedDBStorage = {
  DB_NAME: 'DrunkWalkerAutosave',
  DB_VERSION: 1,
  STORE_NAME: 'backups',
  
  async open() {
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB not available');
    }
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  },
  
  async save(data) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      
      const request = store.put({
        id: 'latest',
        timestamp: Date.now(),
        data
      });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },
  
  async load() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      
      const request = store.get('latest');
      
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.data);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  },
  
  async clear() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};

/**
 * Create auto-saver instance
 * 
 * @param {Object} engine - Drunk Walker engine instance
 * @param {Object} algorithm - Traversal algorithm instance
 * @param {Object} config - Configuration options
 * @returns {Object} Auto-saver API
 */
export function createAutosaver(engine, algorithm, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  let intervalId = null;
  let isSaving = false;
  let lastSaveTime = 0;
  let saveCount = 0;
  
  /**
   * Collect current state for saving
   */
  function collectState() {
    const state = {
      version: '6.1.3-autosave',
      timestamp: Date.now(),
      engine: {
        steps: engine.getSteps(),
        visitedCount: engine.getVisitedCount(),
        stuckCount: engine.getStuckCount(),
        status: engine.getStatus(),
        config: engine.getConfig()
      },
      path: null,
      graph: null
    };
    
    if (cfg.includePath) {
      state.path = engine.getWalkPath();
    }
    
    if (cfg.includeGraph && algorithm.enhancedGraph) {
      state.graph = serializeGraph(algorithm.enhancedGraph);
    }
    
    return state;
  }
  
  /**
   * Save current state
   */
  async function save() {
    if (isSaving) {
      console.log('[AUTOSAVE] Save already in progress, skipping...');
      return;
    }
    
    isSaving = true;
    const startTime = Date.now();
    
    try {
      const state = collectState();
      
      // Try IndexedDB first (browser)
      if (typeof indexedDB !== 'undefined') {
        await IndexedDBStorage.save(state);
        saveCount++;
        lastSaveTime = Date.now();
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`💾 [AUTOSAVE] Saved: step=${state.engine.steps}, visited=${state.engine.visitedCount}, graph.nodes=${state.graph?.nodes?.length || 0}, time=${elapsed}s`);
      } else {
        // Node.js environment - save to global for external handler
        if (typeof global !== 'undefined') {
          global.__DRUNK_WALKER_AUTOSAVE__ = state;
          saveCount++;
          lastSaveTime = Date.now();
          console.log(`💾 [AUTOSAVE] Saved to global (Node.js): step=${state.engine.steps}`);
        } else {
          console.warn('[AUTOSAVE] No storage available (not in browser or Node.js)');
        }
      }
    } catch (error) {
      console.error('[AUTOSAVE] Save failed:', error);
    } finally {
      isSaving = false;
    }
  }
  
  /**
   * Load latest backup
   */
  async function load() {
    try {
      let state = null;
      
      if (typeof indexedDB !== 'undefined') {
        state = await IndexedDBStorage.load();
      } else if (typeof global !== 'undefined' && global.__DRUNK_WALKER_AUTOSAVE__) {
        state = global.__DRUNK_WALKER_AUTOSAVE__;
      }
      
      if (!state) {
        console.log('[AUTOSAVE] No backup found');
        return null;
      }
      
      console.log(`[AUTOSAVE] Loaded backup: step=${state.engine.steps}, visited=${state.engine.visitedCount}, timestamp=${new Date(state.timestamp).toISOString()}`);
      
      return state;
    } catch (error) {
      console.error('[AUTOSAVE] Load failed:', error);
      return null;
    }
  }
  
  /**
   * Restore engine state from backup
   */
  async function restore() {
    const state = await load();
    if (!state) {
      return false;
    }
    
    try {
      // Restore engine state
      engine.setSteps(state.engine.steps);
      
      if (state.path && state.path.length > 0) {
        engine.setWalkPath(state.path);
        engine.restoreVisitedFromPath(state.path);
      }
      
      // Restore graph if available
      if (state.graph && algorithm.enhancedGraph) {
        // Restore nodes
        for (const nodeData of state.graph.nodes) {
          const node = algorithm.enhancedGraph.getOrCreate(
            nodeData.location,
            nodeData.lat,
            nodeData.lng,
            state.engine.steps
          );
          node.triedYaws = new Set(nodeData.triedYaws);
          node.successfulYaws = new Set(nodeData.successfulYaws);
          node.isFullyExplored = nodeData.isFullyExplored;
        }
        
        // Restore connections
        for (const conn of state.graph.connections) {
          const connSet = algorithm.enhancedGraph.connections.get(conn.from);
          if (connSet) {
            for (const to of conn.to) {
              connSet.add(to);
            }
          }
        }
        
        console.log(`[AUTOSAVE] Restored graph: ${state.graph.nodes.length} nodes, ${state.graph.connections.length} connections`);
      }
      
      console.log('[AUTOSAVE] ✅ Restoration complete');
      return true;
    } catch (error) {
      console.error('[AUTOSAVE] Restoration failed:', error);
      return false;
    }
  }
  
  /**
   * Start auto-save interval
   */
  function start() {
    stop();  // Clear any existing interval
    
    intervalId = setInterval(save, cfg.intervalMs);
    console.log(`[AUTOSAVE] Started: interval=${cfg.intervalMs / 1000}s`);
    
    // Save immediately on start
    save();
  }
  
  /**
   * Stop auto-save interval
   */
  function stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      console.log('[AUTOSAVE] Stopped');
    }
  }
  
  /**
   * Get auto-save statistics
   */
  function getStats() {
    return {
      saveCount,
      lastSaveTime,
      intervalMs: cfg.intervalMs,
      isSaving,
      isEnabled: intervalId !== null
    };
  }
  
  // Expose for debugging
  if (typeof window !== 'undefined') {
    window.__DRUNK_WALKER_AUTOSAVE__ = {
      save,
      load,
      restore,
      start,
      stop,
      getStats
    };
  }
  
  return {
    save,
    load,
    restore,
    start,
    stop,
    getStats
  };
}

export default createAutosaver;
