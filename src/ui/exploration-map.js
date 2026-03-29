/**
 * Exploration Map Component
 * Renders a mini-map showing explored territory from walker's perspective
 * v6.1.5
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
  
  // Styles
  const CSS = {
    container: `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(18, 18, 20, 0.85);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 12px;
      z-index: 999998;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
      font-size: 11px;
      color: #fff;
      box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0, 0, 0, 0.3);
      min-width: 320px;
      transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    `,
    header: `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding: 0 4px;
    `,
    title: `
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.3px;
      display: flex;
      align-items: center;
      gap: 6px;
    `,
    controls: `
      display: flex; 
      gap: 6px;
    `,
    btn: `
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.7);
      width: 24px;
      height: 24px;
      cursor: pointer;
      border-radius: 6px;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    `,
    statsBar: `
      display: flex;
      gap: 16px;
      padding: 8px 12px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      margin-bottom: 10px;
      font-size: 10px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    `,
    statItem: `
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.6);
    `,
    canvasContainer: `
      position: relative;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      overflow: hidden;
      background: #000;
    `
  };

  function init() {
    container = document.createElement('div');
    container.id = 'dw-map-container';
    container.style.cssText = CSS.container;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = CSS.header;
    
    const title = document.createElement('span');
    title.innerHTML = '<span>🗺️</span> EXPLORATION MAP';
    title.style.cssText = CSS.title;
    
    const controls = document.createElement('div');
    controls.style.cssText = CSS.controls;
    
    const expandBtn = document.createElement('button');
    expandBtn.innerHTML = '⛶';
    expandBtn.title = 'Expand/Collapse';
    expandBtn.style.cssText = CSS.btn;
    expandBtn.onmouseover = () => { expandBtn.style.background = 'rgba(255,255,255,0.1)'; expandBtn.style.color = '#fff'; };
    expandBtn.onmouseout = () => { expandBtn.style.background = 'rgba(255,255,255,0.05)'; expandBtn.style.color = 'rgba(255,255,255,0.7)'; };
    expandBtn.onclick = () => toggleExpand();
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.title = 'Close (M)';
    closeBtn.style.cssText = CSS.btn;
    closeBtn.onmouseover = () => { closeBtn.style.background = 'rgba(255, 50, 50, 0.2)'; closeBtn.style.color = '#ff4d4d'; closeBtn.style.borderColor = 'rgba(255, 50, 50, 0.3)'; };
    closeBtn.onmouseout = () => { closeBtn.style.background = 'rgba(255,255,255,0.05)'; closeBtn.style.color = 'rgba(255,255,255,0.7)'; closeBtn.style.borderColor = 'rgba(255,255,255,0.1)'; };
    closeBtn.onclick = () => hide();
    
    controls.appendChild(expandBtn);
    controls.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(controls);
    
    // Stats bar
    const statsBar = document.createElement('div');
    statsBar.id = 'dw-map-stats';
    statsBar.style.cssText = CSS.statsBar;
    
    const stat = (color, label, id) => `
      <div style="${CSS.statItem}">
        <span style="width:6px;height:6px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color};"></span>
        <span>${label}: <strong id="${id}" style="color:#fff;">0</strong></span>
      </div>
    `;
    
    statsBar.innerHTML = `
      ${stat('#00ff80', 'Visited', 'dw-stat-visited')}
      ${stat('#ffb74d', 'Crossroads', 'dw-stat-crossroads')}
      ${stat('#ff4d4d', 'Dead ends', 'dw-stat-deadends')}
    `;
    
    // Canvas container
    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = CSS.canvasContainer;
    
    canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    canvas.style.cssText = 'display: block; width: 100%; height: 100%;';
    
    canvasContainer.appendChild(canvas);
    ctx = canvas.getContext('2d');
    
    container.appendChild(header);
    container.appendChild(statsBar);
    container.appendChild(canvasContainer);
    
    document.body.appendChild(container);
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggle();
      }
    });
  }
  
  function toggle() {
    if (!container) init();
    isVisible = !isVisible;
    container.style.display = isVisible ? 'block' : 'none';
    if (isVisible) render();
  }
  
  function show() {
    if (!container) init();
    isVisible = true;
    container.style.display = 'block';
    render();
  }
  
  function hide() {
    isVisible = false;
    if (container) container.style.display = 'none';
  }
  
  function toggleExpand() {
    isExpanded = !isExpanded;
    if (isExpanded) {
      canvas.width = 600;
      canvas.height = 400;
      container.style.minWidth = '620px';
    } else {
      canvas.width = 300;
      canvas.height = 200;
      container.style.minWidth = '320px';
    }
    render();
  }
  
  function gpsToScreen(lat, lng, centerLat, centerLng, width, height, zoom) {
    const scale = zoom * 10000000;
    const x = width / 2 + (lng - centerLng) * scale;
    const y = height / 2 - (lat - centerLat) * scale * 1.5;
    return { x, y };
  }
  
  function render(transitionGraph, currentLocation, visitedUrls) {
    if (!ctx || !canvas) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas with deep space blue
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, width, height);
    
    // Grid background
    ctx.strokeStyle = '#1a1a1c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let x=0; x<width; x+=20) { ctx.moveTo(x,0); ctx.lineTo(x,height); }
    for(let y=0; y<height; y+=20) { ctx.moveTo(0,y); ctx.lineTo(width,y); }
    ctx.stroke();
    
    if (!transitionGraph) {
      ctx.fillStyle = '#444';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('AWAITING TELEMETRY...', width / 2, height / 2);
      return;
    }
    
    const stats = transitionGraph.getStats();
    const locations = Array.from(transitionGraph.connections.keys());
    
    if (locations.length === 0) {
      ctx.fillStyle = '#444';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('NO DATA COLLECTED', width / 2, height / 2);
      return;
    }
    
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    locations.forEach(loc => {
      const [lat, lng] = loc.split(',').map(Number);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    });
    
    centerLat = (minLat + maxLat) / 2;
    centerLng = (minLng + maxLng) / 2;
    
    const latRange = maxLat - minLat || 0.0001;
    const lngRange = maxLng - minLng || 0.0001;
    zoom = Math.min(width / lngRange / 100000, height / latRange / 100000) * 0.7;
    
    // Draw edges
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
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
      
      if (isCurrent) {
        // Pulse effect
        const pulse = (Date.now() / 1000) % 1;
        ctx.fillStyle = `rgba(0, 255, 128, ${1-pulse})`;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 12 * pulse + 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#00ff80';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
        ctx.stroke();
      } else if (isCrossroad) {
        ctx.fillStyle = '#ffb74d';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (isVisited) {
        ctx.fillStyle = '#00ff80';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#ff4d4d';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    
    const deadEnds = locations.filter(loc => {
      const conns = transitionGraph.getConnections(loc);
      return conns.size === 1;
    }).length;
    
    document.getElementById('dw-stat-visited').textContent = locations.length;
    document.getElementById('dw-stat-crossroads').textContent = stats.crossroads || 0;
    document.getElementById('dw-stat-deadends').textContent = deadEnds;
  }
  
  return {
    init, toggle, show, hide, toggleExpand, render, isVisible: () => isVisible
  };
}
