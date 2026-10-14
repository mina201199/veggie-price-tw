(()=>{
  'use strict';
  const $=id=>document.getElementById(id),G=MarketGPS;
  const map=L.map('map',{zoomControl:false,zoomAnimation:false,fadeAnimation:false}).setView([24.9537,121.225],18);
  L.control.zoom({position:'topright'}).addTo(map);L.control.scale({imperial:false,position:'bottomleft'}).addTo(map);
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,keepBuffer:0,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(map);
  let follow=true,player=null,gps={},failures=0,lastPosition=null;
  const icon=L.divIcon({className:'player-icon',html:'<span class="player-pin">🚶</span>',iconSize:[36,36],iconAnchor:[18,18]});
  const marker=L.marker([24.9537,121.225],{icon,title:'角色目前位置'}).addTo(map).bindTooltip('角色 · 手動預覽');
  const accuracy=L.circle([24.9537,121.225],{radius:0,color:'#41865a',weight:1,fillColor:'#75b489',fillOpacity:.12});
  tiles.on('loading',()=>failures=0);tiles.on('tileerror',()=>{failures++;$('mapStatus').hidden=false});tiles.on('load',()=>{$('mapStatus').hidden=failures===0});
  $('retryTiles').onclick=()=>{failures=0;tiles.redraw()};
  fetch('taiwan-counties.json').then(r=>r.json()).then(data=>L.geoJSON(data,{filter:f=>G.excluded.includes(f.properties.county),style:{color:'#887f74',weight:1,fillColor:'#958e82',fillOpacity:.25},onEachFeature:(f,l)=>l.bindTooltip(f.properties.county+' · 尚未啟用')}).addTo(map)).catch(()=>{});
  function setFollow(value){follow=value;$('followPlayer').setAttribute('aria-pressed',String(value));$('followPlayer').textContent=value?'跟隨角色':'回到角色';if(value&&player)map.setView([player.lat,player.lng],Math.max(16,map.getZoom()),{animate:false})}
  map.on('dragstart',()=>setFollow(false));$('followPlayer').onclick=()=>setFollow(true);
  $('mapGps').onclick=()=>window.MarketBridge?.send({type:'gps'});$('worldView').onclick=()=>window.MarketBridge?.send({type:'navigate',view:'world'});
  function receive(state){
    gps=state.gps||gps;player=state.player;if(!G.valid(player))return;
    const p=[player.lat,player.lng],tracking=gps.active||gps.status==='paused';
    marker.setLatLng(p);marker.setTooltipContent(tracking?'角色 · GPS 位置':'角色 · 手動預覽');
    if(tracking&&Number.isFinite(gps.accuracy)&&gps.status==='following'){accuracy.setLatLng(p);accuracy.setRadius(gps.accuracy);if(!map.hasLayer(accuracy))accuracy.addTo(map)}else if(map.hasLayer(accuracy))map.removeLayer(accuracy);
    if(window.MarketViewActive!==false&&follow&&(!lastPosition||G.distance(player,lastPosition)>1))map.setView(p,map.getZoom(),{animate:false});lastPosition={...player};
    $('mapLocation').textContent=player.lat.toFixed(6)+', '+player.lng.toFixed(6);$('mapRegion').textContent=state.region?.name||player.county||'目前位置';
    $('mapMode').textContent=tracking?(gps.status==='following'?'GPS 跟隨 · 精度約 ±'+Math.round(gps.accuracy)+' 公尺':'GPS 等待訊號 · 請看上方狀態提示'):'手動預覽 · 尚未使用 GPS';
    $('mapGps').textContent=tracking?'停止 GPS':'開啟 GPS';$('mapGps').setAttribute('aria-pressed',String(tracking));$('mapGps').disabled=['loading','coverageError'].includes(gps.status);
  }
  window.addEventListener('market:context',e=>receive(e.detail));
  window.addEventListener('market:visibility',e=>{if(e.detail.active){map.invalidateSize({pan:false});if(follow&&player)map.setView([player.lat,player.lng],map.getZoom(),{animate:false})}});
})();

