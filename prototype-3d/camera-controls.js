(function(global){
 'use strict';
 const clamp=v=>Math.max(.65,Math.min(3,v));
 function bind(canvas,{getZoom,setZoom,rotate}){
  const pointers=new Map();let pinch=0;
  function gap(){const p=[...pointers.values()];return p.length===2?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0}
  canvas.addEventListener('pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);pinch=gap()});
  canvas.addEventListener('pointermove',e=>{
   const old=pointers.get(e.pointerId);if(!old)return;
   pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(pointers.size===2){const next=gap();if(pinch>0&&next>0)setZoom(clamp(getZoom()*pinch/next));pinch=next}
   else if(pointers.size===1)rotate(-(e.clientX-old.x)*.008);
  });
  function end(e){pointers.delete(e.pointerId);pinch=gap()}
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,end);
  canvas.addEventListener('wheel',e=>{e.preventDefault();const pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight||800:1);setZoom(clamp(getZoom()*Math.exp(Math.max(-500,Math.min(500,pixels))*.0015)))},{passive:false});
  global.addEventListener?.('blur',()=>{pointers.clear();pinch=0});
 }
 const api={bind};if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.MarketCameraControls=api;
})(typeof window!=='undefined'?window:globalThis);
