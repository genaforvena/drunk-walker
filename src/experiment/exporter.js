/**
 * Data Export Module for Drunk Walker Experiments
 * 
 * Exports walk data in various formats for analysis.
 * 
 * Usage:
 *   const exporter = createDataExporter(engine, algorithm);
 *   exporter.exportJSON();  // Download as JSON
 *   exporter.exportCSV();   // Download path as CSV
 * 
 * @version 1.0.0
 */

/**
 * Serialize transition graph
 */
function serializeGraph(graph) {
  if (!graph) return null;
  
  const nodes = [];
  const edges = [];
  
  if (graph.nodes) {
    for (const [loc, node] of graph.nodes.entries()) {
      nodes.push({
        id: loc,
        location: node.location,
        lat: node.lat,
        lng: node.lng,
        triedYaws: Array.from(node.triedYaws || []),
        successfulYaws: Array.from(node.successfulYaws || []),
        isFullyExplored: node.isFullyExplored || false,
        visitCount: node.visitCount || 1
      });
    }
  }
  
  if (graph.connections) {
    for (const [from, toSet] of graph.connections.entries()) {
      for (const to of toSet) {
        edges.push({ from, to });
      }
    }
  }
  
  return { nodes, edges };
}

/**
 * Format step data for export
 */
function formatStepData(path) {
  return path.map((step, index) => ({
    step: index + 1,
    timestamp: step.timestamp,
    location: step.location || extractLocation(step.url),
    url: step.url
  }));
}

/**
 * Extract location from URL
 */
function extractLocation(url) {
  if (!url) return null;
  const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  return match ? `${match[1]},${match[2]}` : null;
}

/**
 * Download data as file
 */
function downloadFile(filename, content, mimeType = 'application/json') {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`[EXPORT] Downloaded: ${filename}`);
  } catch (error) {
    // In test environment or Node.js, just log
    console.log(`[EXPORT] Would download: ${filename} (${content.length} bytes)`);
  }
}

/**
 * Create data exporter instance
 * 
 * @param {Object} engine - Drunk Walker engine instance
 * @param {Object} algorithm - Traversal algorithm instance
 * @returns {Object} Exporter API
 */
export function createDataExporter(engine, algorithm) {
  let lastExportStep = 0;
  let exportCount = 0;
  
  /**
   * Export complete walk data as JSON
   */
  function exportJSON(includeGraph = true) {
    const data = {
      version: '1.0',
      exportTime: new Date().toISOString(),
      experiment: {
        steps: engine.getSteps(),
        visited: engine.getVisitedCount(),
        ratio: (engine.getVisitedCount() / engine.getSteps()).toFixed(4),
        config: engine.getConfig()
      },
      path: formatStepData(engine.getWalkPath())
    };
    
    if (includeGraph && algorithm?.enhancedGraph) {
      data.graph = serializeGraph(algorithm.enhancedGraph);
    }
    
    const filename = `drunk-walker-${Date.now()}.json`;
    downloadFile(filename, JSON.stringify(data, null, 2));
    exportCount++;
    lastExportStep = engine.getSteps();
    
    return data;
  }
  
  /**
   * Export walk path as CSV
   */
  function exportCSV() {
    const path = engine.getWalkPath();
    const headers = ['step', 'timestamp', 'lat', 'lng', 'url'];
    
    const rows = path.map((step, index) => {
      const loc = extractLocation(step.url);
      const [lat, lng] = loc ? loc.split(',') : ['', ''];
      return [
        index + 1,
        step.timestamp,
        lat,
        lng,
        step.url
      ];
    });
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const filename = `drunk-walker-path-${Date.now()}.csv`;
    downloadFile(filename, csv, 'text/csv');
    exportCount++;
    lastExportStep = engine.getSteps();
    
    console.log(`[EXPORT] CSV exported: ${rows.length} steps`);
  }
  
  /**
   * Export graph as GeoJSON (for mapping tools)
   */
  function exportGeoJSON() {
    if (!algorithm?.enhancedGraph) {
      console.warn('[EXPORT] No graph available');
      return null;
    }
    
    const graphData = serializeGraph(algorithm.enhancedGraph);
    
    const geojson = {
      type: 'FeatureCollection',
      features: [
        // Nodes as points
        ...graphData.nodes.map(node => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [parseFloat(node.lng), parseFloat(node.lat)]
          },
          properties: {
            id: node.id,
            triedYaws: node.triedYaws.length,
            successfulYaws: node.successfulYaws.length,
            isFullyExplored: node.isFullyExplored
          }
        })),
        // Edges as lines (if we have coordinates for both ends)
        ...graphData.edges.map(edge => {
          const fromNode = graphData.nodes.find(n => n.id === edge.from);
          const toNode = graphData.nodes.find(n => n.id === edge.to);
          
          if (!fromNode || !toNode) return null;
          
          return {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [parseFloat(fromNode.lng), parseFloat(fromNode.lat)],
                [parseFloat(toNode.lng), parseFloat(toNode.lat)]
              ]
            },
            properties: {
              from: edge.from,
              to: edge.to
            }
          };
        }).filter(f => f !== null)
      ]
    };
    
    const filename = `drunk-walker-graph-${Date.now()}.geojson`;
    downloadFile(filename, JSON.stringify(geojson, null, 2), 'application/geo+json');
    exportCount++;
    
    console.log(`[EXPORT] GeoJSON exported: ${graphData.nodes.length} nodes, ${graphData.edges.length} edges`);
    return geojson;
  }
  
  /**
   * Export summary statistics
   */
  function exportSummary() {
    const path = engine.getWalkPath();
    const graph = algorithm?.enhancedGraph;
    
    const summary = {
      exportTime: new Date().toISOString(),
      basic: {
        totalSteps: engine.getSteps(),
        uniqueVisited: engine.getVisitedCount(),
        ratio: (engine.getVisitedCount() / engine.getSteps()).toFixed(4),
        pathLength: path.length
      },
      graph: graph ? {
        nodeCount: graph.nodes?.size || 0,
        connectionCount: graph.connections?.size || 0,
        avgDegree: graph.nodes ? 
          (Array.from(graph.connections.values()).reduce((sum, set) => sum + set.size, 0) / graph.nodes.size).toFixed(2) 
          : 0
      } : null,
      time: {
        firstStep: path[0]?.timestamp,
        lastStep: path[path.length - 1]?.timestamp,
        duration: path.length > 0 ? path[path.length - 1].timestamp - path[0].timestamp : 0
      }
    };
    
    const filename = `drunk-walker-summary-${Date.now()}.json`;
    downloadFile(filename, JSON.stringify(summary, null, 2));
    exportCount++;
    
    return summary;
  }
  
  /**
   * Auto-export at interval (called by monitoring module)
   */
  function autoExport() {
    const currentSteps = engine.getSteps();
    if (currentSteps - lastExportStep >= 500 && currentSteps > 0) {
      // Export summary every 500 steps
      exportSummary();
      return true;
    }
    return false;
  }
  
  /**
   * Get export statistics
   */
  function getStats() {
    return {
      exportCount,
      lastExportStep,
      totalSteps: engine.getSteps()
    };
  }
  
  // Expose for debugging
  if (typeof window !== 'undefined') {
    window.__DRUNK_WALKER_EXPORTER__ = {
      exportJSON,
      exportCSV,
      exportGeoJSON,
      exportSummary,
      getStats
    };
  }
  
  return {
    exportJSON,
    exportCSV,
    exportGeoJSON,
    exportSummary,
    autoExport,
    getStats
  };
}

export default createDataExporter;
