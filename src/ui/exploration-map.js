/**
 * Exploration Map Component
 * Renders a mini-map showing explored territory from walker's perspective
 */

export function createExplorationMap() {
  let canvas = null;
  let ctx = null;
  let container = null;
  let isVisible = false;
  let isExpanded = false;
  
  // Map state
  let centerLat = 0;
  let centerLng = 0;
  let zoom = 1;
  const baseZoom = 0.0001; // meters per pixel
  
  // Create map container and canvas
  function init() {
    // Create container
    container = document.createElement('div');
    container.id = 'dw-map-container';
    container.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.85);
      border: 2px solid #444;
      border-radius: 8px;
      padding: 8px;
      z-index: 999998;
      display: none;
      font-family: monospace;
      font-size: 11px;
      color: #fff;
      min-width: 320px;
    `;
    
    // Header with controls
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
      padding: 0 4px;
    `;
    
    const title = document.createElement('span');
    title.textContent = '🗺️ EXPLORATION MAP';
    title.style.cssText = 'font-weight: bold; color: #4fc3f7;';
    
    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; gap: 6px;';
    
    // Expand/collapse button
    const expandBtn = document.createElement('button');
    expandBtn.textContent = '⛶';
    expandBtn.title = 'Expand/Collapse';
    expandBtn.style.cssText = `
      background: #333;
      border: 1px solid #555;
      color: #fff;
      padding: 2px 6px;
      cursor: pointer;
      border-radius: 3px;
      font-size: 12px;
    `;
    expandBtn.onmouseover = () => expandBtn.style.background = '#444';
    expandBtn.onmouseout = () => expandBtn.style.background = '#333';
    expandBtn.onclick = () => toggleExpand();
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.title = 'Close (M)';
    closeBtn.style.cssText = `
      background: #333;
      border: 1px solid #555;
      color: #fff;
      padding: 2px 6px;
      cursor: pointer;
      border-radius: 3px;
      font-size: 12px;
    `;
    closeBtn.onmouseover = () => closeBtn.style.background = '#c62828';
    closeBtn.onmouseout = () => closeBtn.style.background = '#333';
    closeBtn.onclick = () => hide();
    
    controls.appendChild(expandBtn);
    controls.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(controls);
    
    // Stats bar
    const statsBar = document.createElement('div');
    statsBar.id = 'dw-map-stats';
    statsBar.style.cssText = `
      display: flex;
      gap: 12px;
      padding: 4px 8px;
      background: rgba(50, 50, 50, 0.5);
      border-radius: 4px;
      margin-bottom: 6px;
      font-size: 10px;
    `;
    statsBar.innerHTML = `
      <span style="color: #81c784;">● Visited: <strong id="dw-stat-visited">0</strong></span>
      <span style="color: #ffb74d;">★ Crossroads: <strong id="dw-stat-crossroads">0</strong></span>
      <span style="color: #e57373;">⚑ Dead ends: <strong id="dw-stat-deadends">0</strong></span>
    `;
    
    // Canvas container
    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = `
      position: relative;
      border: 1px solid #444;
      border-radius: 4px;
      overflow: hidden;
    `;
    
    // Create canvas
    canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    canvas.style.cssText = 'display: block;';
    
    canvasContainer.appendChild(canvas);
    ctx = canvas.getContext('2d');
    
    container.appendChild(header);
    container.appendChild(statsBar);
    container.appendChild(canvasContainer);
    
    document.body.appendChild(container);
    
    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggle();
      }
    });
  }
  
  // Toggle map visibility
  function toggle() {
    if (!container) init();
    isVisible = !isVisible;
    container.style.display = isVisible ? 'block' : 'none';
    if (isVisible) render();
  }
  
  // Show map
  function show() {
    if (!container) init();
    isVisible = true;
    container.style.display = 'block';
    render();
  }
  
  // Hide map
  function hide() {
    isVisible = false;
    if (container) container.style.display = 'none';
  }
  
  // Toggle expanded mode
  function toggleExpand() {
    isExpanded = !isExpanded;
    if (isExpanded) {
      canvas.width = 600;
      canvas.height = 400;
    } else {
      canvas.width = 300;
      canvas.height = 200;
    }
    render();
  }
  
  // Convert GPS to screen coordinates
  function gpsToScreen(lat, lng, centerLat, centerLng, width, height, zoom) {
    const scale = zoom * 10000000; // Scale factor
    const x = width / 2 + (lng - centerLng) * scale;
    const y = height / 2 - (lat - centerLat) * scale * 1.5; // Adjust for lat distortion
    return { x, y };
  }
  
  // Render the map
  function render(transitionGraph, currentLocation, visitedUrls) {
    if (!ctx || !canvas) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    if (!transitionGraph) {
      // Show "no data" message
      ctx.fillStyle = '#666';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Walk in progress...', width / 2, height / 2);
      return;
    }
    
    // Get all locations
    const stats = transitionGraph.getStats();
    const locations = Array.from(transitionGraph.connections.keys());
    
    if (locations.length === 0) {
      ctx.fillStyle = '#666';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No locations yet...', width / 2, height / 2);
      return;
    }
    
    // Calculate bounds
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    locations.forEach(loc => {
      const [lat, lng] = loc.split(',').map(Number);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    });
    
    // Set center
    centerLat = (minLat + maxLat) / 2;
    centerLng = (minLng + maxLng) / 2;
    
    // Calculate zoom to fit all points
    const latRange = maxLat - minLat || 0.0001;
    const lngRange = maxLng - minLng || 0.0001;
    zoom = Math.min(width / lngRange / 100000, height / latRange / 100000) * 0.8;
    
    // Draw connections first (edges)
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    
    locations.forEach(loc => {
      const connections = transitionGraph.getConnections(loc);
      const [lat1, lng1] = loc.split(',').map(Number);
      const pos1 = gpsToScreen(lat1, lng1, centerLat, centerLng, width, height, zoom);
      
      connections.forEach(conn => {
        const [lat2, lng2] = conn.split(',').map(Number);
        const pos2 = gpsToScreen(lat2, lng2, centerLat, centerLng, width, height, zoom);
        
        ctx.beginPath();
        ctx.moveTo(pos1.x, pos1.y);
        ctx.lineTo(pos2.x, pos2.y);
        ctx.stroke();
      });
    });
    
    // Draw nodes
    locations.forEach(loc => {
      const [lat, lng] = loc.split(',').map(Number);
      const pos = gpsToScreen(lat, lng, centerLat, centerLng, width, height, zoom);
      
      const isCrossroad = transitionGraph.isCrossroad(loc);
      const isCurrent = loc === currentLocation;
      const isVisited = visitedUrls ? visitedUrls.has(loc) : false;
      
      // Node style
      if (isCurrent) {
        // Current position - pulsing circle
        ctx.fillStyle = '#4fc3f7';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Outer ring
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
        ctx.stroke();
      } else if (isCrossroad) {
        // Crossroad - star/larger circle
        ctx.fillStyle = '#ffb74d';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (isVisited) {
        // Visited - green circle
        ctx.fillStyle = '#81c784';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Unvisited - red dot
        ctx.fillStyle = '#e57373';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    
    // Update stats
    const deadEnds = locations.filter(loc => {
      const conns = transitionGraph.getConnections(loc);
      return conns.size === 1;
    }).length;
    
    document.getElementById('dw-stat-visited').textContent = locations.length;
    document.getElementById('dw-stat-crossroads').textContent = stats.crossroads || 0;
    document.getElementById('dw-stat-deadends').textContent = deadEnds;
  }
  
  return {
    init,
    toggle,
    show,
    hide,
    toggleExpand,
    render,
    isVisible: () => isVisible
  };
}
