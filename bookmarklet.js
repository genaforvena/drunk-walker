(function(){
  if (window.DRUNK_WALKER_ACTIVE) return;
  window.DRUNK_WALKER_ACTIVE = true;
  console.log("🤪 DRUNK WALKER v3.0-EXP Loaded.");

  let status = 'IDLE';
  let steps = 0;
  let intervalId = null;
  let pace = 2000; 
  let isUserMouseDown = false;
  let cw = window.innerWidth;
  let ch = window.innerHeight;
  let hzLine = null;
  let poly = [];
  let isDrawing = false;
  let drawOverlay = null;

  document.addEventListener('mousedown', (e) => { if (e.isTrusted) isUserMouseDown = true; }, true);
  document.addEventListener('mouseup', (e) => { if (e.isTrusted) isUserMouseDown = false; }, true);

  const container = document.createElement('div');
  container.id = 'dw-ctrl-panel';
  container.style.cssText = 'position:fixed;top:20px;right:20px;background:rgba(0,0,0,0.9);color:#0f0;padding:15px;font-family:monospace;z-index:999999;border:2px solid #0f0;border-radius:10px;box-shadow:0 0 15px #0f0;min-width:180px;user-select:none;';
  
  const title = document.createElement('div');
  title.innerHTML = '🤪 DRUNK WALKER v3.0-EXP<hr style="border-color:#0f0">';
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

  const expLabel = document.createElement('label');
  expLabel.style.cssText = 'display:flex;align-items:center;font-size:10px;margin-top:5px;cursor:pointer;';
  const expToggle = document.createElement('input');
  expToggle.type = 'checkbox';
  expToggle.id = 'dw-exp-toggle';
  expToggle.style.marginRight = '5px';
  expLabel.appendChild(expToggle);
  expLabel.appendChild(document.createTextNode('EXPERIMENTAL MODE (STUCK DETECT)'));
  container.appendChild(expLabel);

  const kbLabel = document.createElement('label');
  kbLabel.style.cssText = 'display:flex;align-items:center;font-size:10px;margin-top:5px;cursor:pointer;';
  const kbToggle = document.createElement('input');
  kbToggle.type = 'checkbox';
  kbToggle.id = 'dw-kb-toggle';
  kbToggle.style.marginRight = '5px';
  kbLabel.appendChild(kbToggle);
  kbLabel.appendChild(document.createTextNode('KEYBOARD MODE (ARROW UP)'));
  container.appendChild(kbLabel);

  const lvlBtn = document.createElement('button');
  lvlBtn.innerText = '⚖️ LEVEL URL';
  lvlBtn.style.cssText = 'width:100%;margin-top:10px;padding:5px;background:#444;color:#0f0;border:1px solid #0f0;font-family:monospace;cursor:pointer;font-size:10px;';
  lvlBtn.onclick = () => {
    const u = window.location.href;
    const m = u.match(/,(\d+(\.\d+)?)t/);
    if(m) {
      const nu = u.replace(m[0], ',90t');
      history.replaceState(null, null, nu);
    }
  };
  container.appendChild(lvlBtn);

  const hzBtn = document.createElement('button');
  hzBtn.innerText = '🌅 SHOW HORIZON';
  hzBtn.style.cssText = 'width:100%;margin-top:5px;padding:5px;background:#444;color:#0f0;border:1px solid #0f0;font-family:monospace;cursor:pointer;font-size:10px;';
  hzBtn.onclick = () => {
    if(hzLine) {
      hzLine.remove();
      hzLine = null;
      hzBtn.style.background = '#444';
    } else {
      hzLine = document.createElement('div');
      hzLine.style.cssText = 'position:fixed;top:50%;left:0;width:100%;height:2px;background:rgba(255,0,0,0.5);z-index:999998;pointer-events:none;box-shadow:0 0 5px red;';
      document.body.appendChild(hzLine);
      hzBtn.style.background = '#060';
    }
  };
  container.appendChild(hzBtn);

  const drawBtn = document.createElement('button');
  drawBtn.innerText = '📐 DRAW CLICK AREA';
  drawBtn.style.cssText = 'width:100%;margin-top:5px;padding:5px;background:#444;color:#0f0;border:1px solid #0f0;font-family:monospace;cursor:pointer;font-size:10px;';
  drawBtn.onclick = () => {
    if(isDrawing) finishDrawing();
    else startDrawing();
  };
  container.appendChild(drawBtn);

  function startDrawing(){
    isDrawing = true;
    poly = [];
    drawBtn.innerText = '✅ DONE SELECTION';
    drawBtn.style.background = '#060';
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
    drawBtn.innerText = '📐 DRAW CLICK AREA' + (poly.length > 2 ? ' (SET)' : '');
    drawBtn.style.background = '#444';
    if(drawOverlay) drawOverlay.remove();
    drawOverlay = null;
  }

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
    const opt = { key: k, code: k, keyCode: k === 'ArrowUp' ? 38 : 37, which: k === 'ArrowUp' ? 38 : 37, bubbles: true, cancelable: true };
    document.dispatchEvent(new KeyboardEvent('keydown', opt));
    setTimeout(() => document.dispatchEvent(new KeyboardEvent('keyup', opt)), 50);
  }

  function inPoly(p, vs) {
    var x = p.x, y = p.y, inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i].x, yi = vs[i].y, xj = vs[j].x, yj = vs[j].y;
        var intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
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
      const expOn = document.getElementById('dw-exp-toggle')?.checked;
      const kbOn = document.getElementById('dw-kb-toggle')?.checked;
      let radius = 50;
      let panicThreshold = 3;

      if (expOn) {
        if (window.location.href === lastUrl) {
          stuckCount++;
        } else {
          lastUrl = window.location.href;
          stuckCount = 0;
        }
        if (stuckCount >= panicThreshold) {
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

      if (kbOn) {
        if (expOn && stuckCount >= panicThreshold) {
          key('ArrowLeft');
        } else {
          key('ArrowUp');
        }
      } else {
        if (expOn && stuckCount >= panicThreshold) {
          radius = 50 * Math.pow(1.5, stuckCount - panicThreshold + 1);
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
