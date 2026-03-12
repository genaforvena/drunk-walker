javascript:(function(){
  const width = window.innerWidth;
  const height = window.innerHeight;
  let status = 'IDLE';
  let steps = 0;
  let interval = null;
  let lastMouseX = null, lastMouseY = null, isMouseIn = false;

  document.addEventListener('mousemove', (e) => { lastMouseX = e.clientX; lastMouseY = e.clientY; isMouseIn = true; });
  document.addEventListener('mouseleave', () => isMouseIn = false);
  document.addEventListener('mouseenter', () => isMouseIn = true);

  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;top:10px;right:10px;background:rgba(0,0,0,0.8);color:#0f0;padding:10px;font-family:monospace;z-index:999999;border:1px solid #0f0;pointer-events:none;';
  document.body.appendChild(hud);

  function updateHUD(t){ hud.innerHTML = `DRUNK WALKER v1.2<br>STATUS: ${status}<br>STEPS: ${steps}<br>TARGET: ${t}`; }
  
  function click(x, y){
    const opt = { bubbles:true, cancelable:true, view:window, clientX:x, clientY:y };
    const el = document.elementFromPoint(x, y) || document.body;
    el.dispatchEvent(new MouseEvent('mousedown', opt));
    el.dispatchEvent(new MouseEvent('mouseup', opt));
    el.dispatchEvent(new MouseEvent('click', opt));
    
    const m = document.createElement('div');
    m.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:15px;height:15px;background:cyan;border-radius:50%;z-index:999999;pointer-events:none;transform:translate(-50%,-50%);`;
    document.body.appendChild(m);
    setTimeout(() => m.remove(), 300);
  }

  function start(){
    status = 'WALKING';
    interval = setInterval(() => {
      let tx, ty, t;
      const off = () => (Math.random()*2-1)*50;
      if(isMouseIn && lastMouseX !== null){ tx = lastMouseX+off(); ty = lastMouseY+off(); t = 'CURSOR'; }
      else { tx = width*0.5+off(); ty = height*0.7+off(); t = 'FORWARD'; }
      click(tx, ty);
      steps++;
      updateHUD(t);
    }, 2000);
  }

  if(confirm("Drunk Walker: Start walking? (Click anywhere on screen to turn/guide)")){
    start();
  } else {
    hud.remove();
  }
})();
