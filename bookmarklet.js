(function(){
  if (window.DRUNK_WALKER_ACTIVE) return;
  window.DRUNK_WALKER_ACTIVE = true;
  console.log("🤪 DRUNK WALKER v3.2-EXP Loaded.");

  let status = 'IDLE';
  let steps = 0;
  let intervalId = null;
  let pace = 2000;
  let isUserMouseDown = false;
  let cw = window.innerWidth;
  let ch = window.innerHeight;

  // Extra features (kept in code but not exposed in UI)
  let hzLine = null;
  let poly = [];
  let isDrawing = false;
  let drawOverlay = null;
  let expOn = false;
  let kbOn = true; // Keyboard mode is DEFAULT

  document.addEventListener('mousedown', (e) => { if (e.isTrusted) isUserMouseDown = true; }, true);
  document.addEventListener('mouseup', (e) => { if (e.isTrusted) isUserMouseDown = false; }, true);

  const container = document.createElement('div');
  container.id = 'dw-ctrl-panel';
  container.style.cssText = 'position:fixed;top:20px;right:20px;background:rgba(0,0,0,0.9);color:#0f0;padding:15px;font-family:monospace;z-index:999999;border:2px solid #0f0;border-radius:10px;box-shadow:0 0 15px #0f0;min-width:180px;user-select:none;';

  const title = document.createElement('div');
  title.innerHTML = '🤪 DRUNK WALKER v3.2-EXP<hr style="border-color:#0f0">';
  container.appendChild(title);

  const stats = document.createElement('div');
  stats.style.margin = '10px 0';
  stats.innerHTML = 'STATUS: <span id="dw-status">IDLE</span><br>STEPS: <span id="dw-steps">0</span>';
  container.appendChild(stats);

  const paceLabel = document.createElement('div');
  paceLabel.style.fontSize = '10px';
  paceLabel.innerHTML = 'PACE: <span id="dw-pace-val">2.0</span>s';
  container.appendChild(paceLabel);

  const paceSlider = document.createElement('input');
  paceSlider.type = 'range';
  paceSlider.min = '500';
  paceSlider.max = '5000';
  paceSlider.step = '100';
  paceSlider.value = pace;
  paceSlider.style.width = '100%';
  paceSlider.oninput = () => {
    pace = parseInt(paceSlider.value);
    document.getElementById('dw-pace-val').innerText = (pace/1000).toFixed(1);
    if (status === 'WALKING') {
      stop();
      start();
    }
  };
  container.appendChild(paceSlider);

  const btn = document.createElement('button');
  btn.innerText = '▶ START';
  btn.style.cssText = 'width:100%;margin-top:10px;padding:8px;background:#0f0;color:#000;border:none;font-weight:bold;cursor:pointer;border-radius:5px;';
  btn.onclick = () => {
    if (status === 'IDLE') start();
    else stop();
  };
  container.appendChild(btn);

  document.body.appendChild(container);

  function click(x, y){
    const opt = { bubbles:true, cancelable:true, view:window, clientX:x, clientY:y };
    const el = document.elementFromPoint(x, y) || document.body;
    el.dispatchEvent(new MouseEvent('mousedown', opt));
    el.dispatchEvent(new MouseEvent('mouseup', opt));
    el.dispatchEvent(new MouseEvent('click', opt));
    const m = document.createElement('div');
    m.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:15px;height:15px;background:cyan;border-radius:50%;z-index:999999;pointer-events:none;transform:translate(-50%,-50%);opacity:0.8;transition:transform 0.3s, opacity 0.3s;`;
    document.body.appendChild(m);
    setTimeout(() => { m.style.transform='translate(-50%,-50%) scale(2)'; m.style.opacity='0'; setTimeout(()=>m.remove(),300); }, 50);
  }

  function key(k){
    const keyCodes = {
      ArrowUp: { keyCode: 38, code: 'ArrowUp' },
      ArrowLeft: { keyCode: 37, code: 'ArrowLeft' },
      ArrowDown: { keyCode: 40, code: 'ArrowDown' },
      ArrowRight: { keyCode: 39, code: 'ArrowRight' }
    };
    const { keyCode, code } = keyCodes[k] || { keyCode: 0, code: k };
    const opt = {
      key: k,
      code: code,
      keyCode: keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
      view: window,
      location: 2,
      repeat: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false
    };
    const svCanvas = document.querySelector('canvas[width][height]') ||
                     document.querySelector('.scene-viewer') ||
                     document.querySelector('[class*="streetview"]') ||
                     document.documentElement;
    svCanvas.dispatchEvent(new KeyboardEvent('keydown', opt));
    svCanvas.dispatchEvent(new KeyboardEvent('keypress', opt));
    setTimeout(() => svCanvas.dispatchEvent(new KeyboardEvent('keyup', opt)), 50);
  }

  // Extra feature functions (kept for potential future use)
  function inPoly(p, vs) {
    var x = p.x, y = p.y, inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i].x, yi = vs[i].y, xj = vs[j].x, yj = vs[j].y;
        var intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
  }

  function startDrawing(){
    isDrawing = true;
    poly = [];
    drawOverlay = document.createElement('canvas');
    drawOverlay.width = window.innerWidth;
    drawOverlay.height = window.innerHeight;
    drawOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:999997;cursor:crosshair;';
    document.body.appendChild(drawOverlay);
    const ctx = drawOverlay.getContext('2d');
    drawOverlay.onclick = (e) => {
      const p = {x: e.clientX, y: e.clientY};
      if(poly.length > 2 && Math.hypot(p.x - poly[0].x, p.y - poly[0].y) < 20) {
        finishDrawing();
        return;
      }
      poly.push(p);
      redraw();
    };
    function redraw(){
      ctx.clearRect(0,0,drawOverlay.width,drawOverlay.height);
      ctx.strokeStyle = '#0f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      poly.forEach((p, i) => { if(i===0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.stroke();
      poly.forEach(p => { ctx.fillStyle = '#f0f'; ctx.fillRect(p.x-3, p.y-3, 6, 6); });
    }
  }

  function finishDrawing(){
    isDrawing = false;
    if(drawOverlay) drawOverlay.remove();
    drawOverlay = null;
  }

  function start(){
    cw = window.innerWidth;
    ch = window.innerHeight;
    let lastUrl = window.location.href;
    let stuckCount = 0;
    status = 'WALKING';
    btn.innerText = '🔴 STOP';
    btn.style.background = '#f00';
    document.getElementById('dw-status').innerText = 'WALKING';
    intervalId = setInterval(() => {
      if (isUserMouseDown || isDrawing) return;

      // Experimental mode logic (kept in code)
      if (expOn) {
        if (window.location.href === lastUrl) {
          stuckCount++;
        } else {
          lastUrl = window.location.href;
          stuckCount = 0;
        }
        if (stuckCount >= 3) {
          document.getElementById('dw-status').innerText = `PANIC! (STUCK ${stuckCount})`;
        } else if (stuckCount > 0) {
          document.getElementById('dw-status').innerText = `STUCK (${stuckCount})`;
        } else {
          document.getElementById('dw-status').innerText = 'WALKING';
        }
      } else {
        stuckCount = 0;
        document.getElementById('dw-status').innerText = 'WALKING';
      }

      // Keyboard mode (DEFAULT) or click mode
      if (kbOn) {
        if (expOn && stuckCount >= 3) {
          key('ArrowLeft');
        } else {
          key('ArrowUp');
        }
      } else {
        let radius = 50;
        if (expOn && stuckCount >= 3) {
          radius = 50 * Math.pow(1.5, stuckCount - 3 + 1);
        }
        let tx, ty;
        if(poly.length > 2){
          const minX = Math.min(...poly.map(p=>p.x)), maxX = Math.max(...poly.map(p=>p.x));
          const minY = Math.min(...poly.map(p=>p.y)), maxY = Math.max(...poly.map(p=>p.y));
          let attempts = 0;
          do {
            tx = minX + Math.random() * (maxX - minX);
            ty = minY + Math.random() * (maxY - minY);
            attempts++;
          } while(!inPoly({x:tx, y:ty}, poly) && attempts < 100);
        } else {
          const off = () => (Math.random()*2-1)*radius;
          tx = cw * 0.5 + off();
          ty = ch * 0.7 + off();
        }
        click(tx, ty);
      }
      steps++;
      document.getElementById('dw-steps').innerText = steps;
    }, pace);
  }

  function stop(){
    status = 'IDLE';
    btn.innerText = '▶ START';
    btn.style.background = '#0f0';
    document.getElementById('dw-status').innerText = 'IDLE';
    if (intervalId) clearInterval(intervalId);
  }

  // Auto-start
  start();
})();
