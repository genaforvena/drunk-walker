javascript:(function(){
  if (window.DRUNK_WALKER_ACTIVE) return;
  window.DRUNK_WALKER_ACTIVE = true;

  let status = 'IDLE';
  let steps = 0;
  let intervalId = null;
  let pace = 2000; 
  let isUserMouseDown = false;
  let cw = window.innerWidth;
  let ch = window.innerHeight;
  let hzLine = null;

  document.addEventListener('mousedown', (e) => { if (e.isTrusted) isUserMouseDown = true; }, true);
  document.addEventListener('mouseup', (e) => { if (e.isTrusted) isUserMouseDown = false; }, true);

  const container = document.createElement('div');
  container.id = 'dw-ctrl-panel';
  container.style.cssText = 'position:fixed;top:20px;right:20px;background:rgba(0,0,0,0.9);color:#0f0;padding:15px;font-family:monospace;z-index:999999;border:2px solid #0f0;border-radius:10px;box-shadow:0 0 15px #0f0;min-width:180px;user-select:none;';
  
  const title = document.createElement('div');
  title.innerHTML = '🤪 DRUNK WALKER v2.2-EXP<hr style="border-color:#0f0">';
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
  expLabel.appendChild(document.createTextNode('EXPERIMENTAL MODE (v2.0)'));
  container.appendChild(expLabel);

  // LEVEL URL Button
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

  // SHOW HORIZON Button
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
      if (isUserMouseDown) return; 
      const expOn = document.getElementById('dw-exp-toggle')?.checked;
      let radius = 50;
      if (expOn) {
        if (window.location.href === lastUrl) {
          stuckCount++;
        } else {
          lastUrl = window.location.href;
          stuckCount = 0;
        }
        if (stuckCount > 0) {
          radius = 50 * Math.pow(1.5, stuckCount);
          document.getElementById('dw-status').innerText = `STUCK (CHAOS LVL ${stuckCount})`;
        } else {
          document.getElementById('dw-status').innerText = 'WALKING';
        }
      } else {
          stuckCount = 0;
          document.getElementById('dw-status').innerText = 'WALKING';
      }
      const off = () => (Math.random()*2-1)*radius;
      const tx = cw * 0.5 + off();
      const ty = ch * 0.7 + off();
      click(tx, ty);
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
})();
