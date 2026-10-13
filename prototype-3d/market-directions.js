(function(global){
 'use strict';
 const tau=Math.PI*2,cardinals=[['北',0,-1],['東',1,0],['南',0,1],['西',-1,0]];
 function vector(dx,dz,yaw){return {x:dx*Math.cos(yaw)-dz*Math.sin(yaw),y:dx*Math.sin(yaw)+dz*Math.cos(yaw)}}
 function boundary(v,r){const cx=(r.left+r.right)/2,cy=(r.top+r.bottom)/2,hx=(r.right-r.left)/2,hy=(r.bottom-r.top)/2;
  const scale=Math.max(Math.abs(v.x)/Math.max(1,hx),Math.abs(v.y)/Math.max(1,hy));
  if(scale<1e-9)return {x:cx,y:r.bottom,edge:'bottom'};
  const x=cx+v.x/scale,y=cy+v.y/scale,edge=Math.abs(v.x)/hx>Math.abs(v.y)/hy?(v.x>0?'right':'left'):(v.y>0?'bottom':'top');return {x,y,edge};
 }
 function geographic(dx,dz){const a=(Math.atan2(dx,-dz)+tau)%tau;return ['北','東北','東','東南','南','西南','西','西北'][Math.round(a/(Math.PI/4))%8]}
 function layout(venues,player,yaw,rect){
  const markets=[];for(const v of venues){if(v.kind!=='market'||!v.location||![v.location.x,v.location.z].every(Number.isFinite))continue;
   const dx=v.location.x-player.x,dz=v.location.z-player.z,distance=Math.hypot(dx,dz),screen=vector(dx,dz,yaw),arrived=distance<2;
   markets.push({id:v.id,name:v.name,distance,arrived,direction:arrived?'此處':geographic(dx,dz),angle:arrived?0:Math.atan2(screen.x,-screen.y)*180/Math.PI,...boundary(screen,rect)});
  }markets.sort((a,b)=>a.distance-b.distance||String(a.id).localeCompare(String(b.id)));
  const compass=cardinals.map(([label,dx,dz])=>({label,...boundary(vector(dx,dz,yaw),rect)}));return {markets,compass};
 }
 function create(host,onSelect){
  const root=document.createElement('aside');root.className='market-directions';root.setAttribute('aria-label','附近市場方向與直線距離');host.appendChild(root);
  const panels={},badges={},buttons=new Map();for(const edge of ['top','right','bottom','left']){const p=document.createElement('div');p.className='market-edge market-edge-'+edge;p.dataset.edge=edge;root.appendChild(p);panels[edge]=p}
  for(const [label]of cardinals){const b=document.createElement('span');b.className='market-compass';b.textContent=label;b.setAttribute('aria-hidden','true');root.appendChild(b);badges[label]=b}
  const empty=document.createElement('span');empty.className='market-direction-empty';empty.textContent='附近圖資未收錄市場';root.appendChild(empty);
  function update({venues,player,yaw,rect,hidden,selected,compact=false}){
   root.classList.toggle('is-compact',compact);root.hidden=!!hidden;if(hidden)return;const r=layout(venues,player,yaw,rect),ids=new Set(r.markets.map(m=>m.id));
   for(const [id,b]of buttons)if(!ids.has(id)){b.remove();buttons.delete(id)}
   const indexes={top:0,right:0,bottom:0,left:0};
   for(const m of r.markets){let b=buttons.get(m.id);if(!b){b=document.createElement('button');b.type='button';b.className='market-edge-item';b.dataset.marketId=m.id;const arrow=document.createElement('span');arrow.className='market-direction-arrow';arrow.textContent='↑';const text=document.createElement('span'),name=document.createElement('b'),distance=document.createElement('small');text.append(name,distance);b.append(arrow,text);b.onclick=()=>onSelect(m.id);buttons.set(m.id,b)}
    const distance=m.distance>=1000?(m.distance/1000).toFixed(1)+' 公里':Math.round(m.distance)+' 公尺';b.children[0].style.transform='rotate('+m.angle+'deg)';b.children[0].textContent=m.arrived?'●':'↑';b.children[1].children[0].textContent=m.name;b.children[1].children[1].textContent=m.direction+' · '+distance;b.title=m.name+'，'+m.direction+'方，直線距離 '+distance;b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed',String(m.id===selected));b.dataset.direction=m.direction;b.dataset.angle=String(m.angle);b.dataset.distance=String(m.distance);const panel=panels[m.edge],index=indexes[m.edge]++;if(panel.children[index]!==b){const focused=document.activeElement===b;panel.insertBefore(b,panel.children[index]||null);if(focused)b.focus({preventScroll:true})}
   }
   const cx=(rect.left+rect.right)/2,cy=(rect.top+rect.bottom)/2,sideY=compact?cy:Math.max(cy,Math.min(296,rect.bottom-56)),offset=compact?8:13;
   for(const [edge,p]of Object.entries(panels)){p.hidden=!p.children.length;p.style.left=(edge==='left'?rect.left+12:edge==='right'?rect.right-12:edge==='top'&&!compact?cx+35:cx)+'px';p.style.top=(edge==='top'?rect.top+offset:edge==='bottom'?rect.bottom-offset:sideY)+'px'}
   for(const c of r.compass){badges[c.label].style.left=c.x+'px';badges[c.label].style.top=c.y+'px'}empty.hidden=r.markets.length>0;empty.style.top=(rect.top+14)+'px';
   root.dataset.marketCount=String(r.markets.length);root.dataset.yaw=String(yaw);return r;
  }
  return {root,update};
 }
 const api={layout,create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.MarketDirections=api;
})(typeof window!=='undefined'?window:globalThis);
