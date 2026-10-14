(()=>{
 'use strict';
 const $=id=>document.getElementById(id),G=MarketGPS,T=THREE;
 try{
  const scene=new T.Scene();scene.background=new T.Color('#dce7d7');scene.fog=new T.Fog('#dce7d7',450,1100);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=T.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;$('world').appendChild(renderer.domElement);
  const camera=new T.PerspectiveCamera(48,1,.1,1500);scene.add(new T.HemisphereLight(0xfffaea,0x899c7e,2.3));const sun=new T.DirectionalLight(0xfff3d9,2.2);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-35,right:35,top:35,bottom:-35,near:1,far:160});sun.shadow.normalBias=.04;scene.add(sun,sun.target);
  const avatar=new T.Group(),body=new T.Group();body.scale.setScalar(1.35);avatar.add(body);scene.add(avatar);
  const ring=new T.Mesh(new T.RingGeometry(1.5,1.7,40),new T.MeshBasicMaterial({color:'#d79856',side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.07;scene.add(ring);
  let origin={...G.regions[0]},player={...origin,mode:'manual'},gps={active:false,status:'loading'},target={x:0,z:0},yaw=.25,zoom=1,overview=false,city=null,selected=null,keys={},joy={x:0,y:0},wardrobeOpen=false,coverage=null,manualDirty=false,lastShare=0,lastNow=performance.now(),lastUI=0,petIdle=0,loading=false,loadController=null,loadToken=0,loadedCenter=null,requestedCenter=null,savedOutside=null,savedYaw=0,savedZoom=1,autoPath=[],loadError=false,lastRegionId=null;
  function cityMessage(text,retry=false){$('mapStatus').replaceChildren(document.createTextNode(text));$('mapStatus').hidden=!text;if(retry){const b=document.createElement('button');b.textContent='重試街區';b.onclick=()=>loadCity(player,true);$('mapStatus').appendChild(b)}}
  function note(text){$('cityHint').textContent=text}
  const marketDirections=MarketDirections.create($('phone'),id=>chooseVenue(id));let lastDirections=0;
  function faceStreet(p){const q=city?.closest(p);if(q)yaw=Math.atan2(q.s.b.x-q.s.a.x,q.s.b.z-q.s.a.z)}
  function cameraUpdate(snap=false){
   const indoor=shopping?.isOpen(),p=avatar.position,distance=indoor?10:overview?180:18,height=indoor?10:overview?210:9;
   const goal=new T.Vector3(p.x+Math.sin(yaw)*distance*zoom,height*zoom,p.z+Math.cos(yaw)*distance*zoom);
   if(snap)camera.position.copy(goal);else camera.position.lerp(goal,.12);const lead=indoor?2:overview?0:3;camera.lookAt(p.x+Math.sin(yaw)*lead,indoor?1:1.3,p.z+Math.cos(yaw)*lead);camera.updateMatrixWorld();
  }
  function publishManual(){if(!manualDirty||shopping?.isOpen())return;manualDirty=false;window.MarketBridge?.send({type:'player',player})}
  function clearMovement(){keys={};joy={x:0,y:0};autoPath=[];$('stick').style.transform='';publishManual()}
  function rebase(p){origin={lat:p.lat,lng:p.lng};avatar.position.set(0,0,0);target={x:0,z:0}}
  function chooseVenue(id){if(!city)return;selected=city.venues.find(v=>v.id===id)||city.venues.reduce((best,v)=>!best||Math.hypot(v.x-avatar.position.x,v.z-avatar.position.z)<Math.hypot(best.x-avatar.position.x,best.z-avatar.position.z)?v:best,null);if(selected){$('cityVenueSelect').value=selected.id;const {id,name,kind,lat,lng,address,hours,sourceUrl}=selected;window.MarketBridge?.send({type:'place',venue:{id,name,kind,lat,lng,address,hours,sourceUrl}})}venueUI()}
  function venueUI(){
   if(shopping?.isOpen())return;
   const v=selected;
   $('venueName').textContent=v?v.name:loading?'正在建立街區…':'附近尚無收錄採買地點';
   $('venueKind').textContent=v?(v.kind==='market'?'市場 · 攤位探索':'超市 · 生鮮貨架'):'3D 採買地圖';
   const distance=v?Math.hypot(v.x-avatar.position.x,v.z-avatar.position.z):Infinity,near=distance<=25;
   $('venueDistance').textContent=v?'示意入口直線距離 '+Math.round(distance)+' 公尺 · '+(near?'可進店':'走近可進店'):'可以繼續探索街道；地點依地圖來源收錄。';
   $('enterVenue').disabled=!v||!near||loading;$('enterVenue').textContent=near?'進入探索':'走近進店';
   const tracking=gps.active||gps.status==='paused';$('previewVenue').disabled=tracking||!v||loading;$('guideVenue').disabled=tracking||!v||loading;$('cityVenueSelect').disabled=loading||!city?.venues.length;
   $('venueSource').href=v?.sourceUrl||'https://www.openstreetmap.org/copyright';$('venueSource').textContent=v?'地點來源 ↗':'地圖來源 ↗';
  }
  async function loadCity(point,force=false){
   if(shopping?.isOpen())return;
   if(window.MarketViewActive===false)return;
   if(!force&&loading&&requestedCenter&&G.distance(point,requestedCenter)<450)return;
   if(!force&&loadError&&requestedCenter&&G.distance(point,requestedCenter)<450)return;
   // Refresh before walking beyond the nearby detailed-facade coverage (240 m).
   if(!force&&city&&loadedCenter&&G.distance(point,loadedCenter)<180&&!loadError)return;
   loadController?.abort();const controller=new AbortController();loadController=controller;const token=++loadToken;loading=true;requestedCenter={...point};cityMessage('正在載入真實道路、建築與採買地點…');venueUI();
   try{
    const data=await MarketCityData.load(point,{signal:controller.signal});if(token!==loadToken||shopping.isOpen())return;
    const actual=G.unproject(avatar.position,origin);rebase(actual);
    const next=window.createCityWorld(T,data,origin);next.network=window.createRoadNetwork(next.segments);city?.dispose();city=next;scene.add(city.root);loadedCenter={...actual};loadError=false;loading=false;
    // Preview starts on a real nearby road; GPS always keeps its true received coordinates.
    if(player.mode==='manual'){const q=city.closest({x:0,z:0});if(q&&q.distance<40){avatar.position.set(q.x,0,q.z);player={...player,...G.unproject(avatar.position,origin),mode:'manual'};manualDirty=true;publishManual()}}
    target=G.project(player,origin);const oldId=selected?.id;$('cityVenueSelect').replaceChildren();
    for(const v of [...city.venues].sort((a,b)=>Math.hypot(a.x-avatar.position.x,a.z-avatar.position.z)-Math.hypot(b.x-avatar.position.x,b.z-avatar.position.z))){const o=document.createElement('option');o.value=v.id;o.textContent=(v.kind==='market'?'市 · ':'買 · ')+v.name;$('cityVenueSelect').appendChild(o)}
    chooseVenue(oldId);cityMessage('');faceStreet(avatar.position);cameraUpdate(true);note('真實道路 · 市容含圖資建物與示意街屋 · 入口與室內為示意');
   }catch(e){if(token!==loadToken||e.name==='AbortError')return;loading=false;loadError=true;if(city&&G.distance(point,loadedCenter)>450){city.dispose();city=null;selected=null}cityMessage('這個位置的 3D 街區暫時無法載入，GPS 位置仍保留。',true);venueUI()}
  }
  fetch('taiwan-counties.json').then(r=>{if(!r.ok)throw Error('coverage');return r.json()}).then(data=>coverage=G.createCoverage(data)).catch(()=>note('定位範圍載入失敗，請重新整理。'));
  const shopping=window.createCityShopping(T,{host:$('phone'),scene,avatar,body,
   onOpen(){clearMovement();savedOutside=G.unproject(avatar.position,origin);savedYaw=yaw;savedZoom=zoom;city.root.visible=false;body.scale.setScalar(1);ring.visible=false;yaw=0;zoom=1;$('phone').classList.add('is-indoor')},
   onClose(){const p=G.valid(player)?player:savedOutside;target=G.project(p,origin);avatar.position.set(target.x,0,target.z);body.scale.setScalar(1.35);ring.visible=true;if(city)city.root.visible=true;yaw=savedYaw;zoom=savedZoom;$('phone').classList.remove('is-indoor');clearMovement();cameraUpdate(true);loadCity(p);venueUI()},
   onNavigate(view){window.MarketBridge?.send({type:'navigate',view:view==='notebook'?'notes':view})}
  });
  function receive(state){
   gps=state.gps||gps;const p=state.player;if(!G.valid(p))return;
   const changed=G.distance(p,player)>.02,modeChanged=p.mode!==player.mode,firstGPS=player.mode!=='gps'&&p.mode==='gps';player=p;manualDirty=false;
   if(shopping.isOpen()&&state.region&&state.regionId!==lastRegionId)shopping.close();lastRegionId=state.regionId??lastRegionId;
   if(!shopping.isOpen()){
    const current=G.unproject(avatar.position,origin),distance=G.distance(p,current);
    if(firstGPS||changed&&distance>150){rebase(p);if(city){city.dispose();city=null;selected=null}cameraUpdate(true);loadCity(p,true)}
    else{target=G.project(p,origin);if(p.mode==='manual'&&(changed||modeChanged)){avatar.position.set(target.x,0,target.z);cameraUpdate(true)}loadCity(p)}
   }
   $('districtName').textContent=state.region?.name||p.county||gps.county||'3D 採買街區';$('coordinate').textContent=p.lat.toFixed(6)+', '+p.lng.toFixed(6);
   const tracking=gps.active||gps.status==='paused',indoor=shopping.isOpen();$('modeBadge').textContent=indoor?'室內示意試逛':tracking?(gps.status==='following'?'GPS 跟隨':'GPS 等待訊號'):'手動預覽';
   $('gpsToggle').textContent=tracking?'停止 GPS':'GPS 跟隨';$('gpsToggle').setAttribute('aria-pressed',String(tracking));$('gpsToggle').disabled=['loading','coverageError'].includes(gps.status);$('manualMode').hidden=!tracking||indoor;$('joystick').setAttribute('aria-disabled',String(tracking&&!indoor));
   $('trackingHint').textContent=indoor?'室內可用搖桿試逛 · 返回時回到最新戶外位置':tracking?(gps.status==='following'?'GPS 精度約 ±'+Math.round(gps.accuracy)+' 公尺':'定位暫停移動，請看上方狀態提示'):'手動預覽 · 開啟 GPS 回到實際位置';venueUI();
  }
  window.addEventListener('market:context',e=>receive(e.detail));
  const wardrobe=window.createCuteWardrobe(T,{host:$('phone'),body,onOpen:()=>{wardrobeOpen=true;clearMovement()},onClose:()=>wardrobeOpen=false});
  $('gpsToggle').onclick=()=>{clearMovement();window.MarketBridge?.send({type:'gps'})};$('manualMode').onclick=()=>window.MarketBridge?.send({type:'gps',action:'stop'});
  document.querySelectorAll('[data-region]').forEach(b=>b.onclick=()=>{if(shopping.isOpen())shopping.close();clearMovement();window.MarketBridge?.send({type:'region',regionId:b.dataset.region})});
  $('cityVenueSelect').onchange=()=>chooseVenue($('cityVenueSelect').value);
  $('previewVenue').onclick=()=>{if(gps.active||gps.status==='paused'||!selected)return;clearMovement();const p=selected.entrance;avatar.position.set(p.x,0,p.z);player={...G.unproject(p,origin),mode:'manual'};manualDirty=true;publishManual();$('nearbyShops').open=false;note('手動試逛：已移到 '+selected.name+' 的示意入口');faceStreet(p);cameraUpdate(true);venueUI()};
  $('guideVenue').onclick=()=>{if(gps.active||gps.status==='paused'||!selected)return;clearMovement();autoPath=city.network.route(avatar.position,selected.entrance)||[];note(autoPath.length?'沿來源道路示範前往入口；搖桿可以接手。':'附近道路尚未連通，可用「移到入口試逛」。')};
  $('enterVenue').onclick=()=>{if(!$('enterVenue').disabled&&selected){shopping.open(selected);cameraUpdate(true)}receive({player,gps})};
  $('rotateLeft').onclick=()=>yaw+=Math.PI/4;$('rotateRight').onclick=()=>yaw-=Math.PI/4;$('zoom').onclick=()=>zoom=zoom<1.5?2:1;
  $('overview').onclick=()=>{overview=!overview;$('overview').setAttribute('aria-pressed',String(overview));$('overview').textContent=overview?'跟隨':'總覽';cameraUpdate(true)};
  MarketCameraControls.bind(renderer.domElement,{getZoom:()=>zoom,setZoom:v=>zoom=v,rotate:d=>yaw+=d});
  let pointer=null;const pad=$('joystick');function canManual(){return shopping.isOpen()||!gps.active&&gps.status!=='paused'}
  function padMove(e){if(!canManual()||wardrobeOpen)return;const r=pad.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,s=Math.min(1,22/(Math.hypot(dx,dy)||1));joy={x:dx*s/22,y:dy*s/22};autoPath=[];$('stick').style.transform=`translate(${dx*s}px,${dy*s}px)`}
  pad.onpointerdown=e=>{if(!canManual())return;pointer=e.pointerId;pad.setPointerCapture(e.pointerId);padMove(e)};pad.onpointermove=e=>{if(pointer===e.pointerId)padMove(e)};for(const event of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(event,()=>{pointer=null;joy={x:0,y:0};$('stick').style.transform='';publishManual()});
  window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA','BUTTON'].includes(document.activeElement.tagName)||wardrobeOpen)return;const k=e.key.length===1?e.key.toLowerCase():e.key;if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(k)){e.preventDefault();keys[k]=true}});window.addEventListener('keyup',e=>keys[e.key.length===1?e.key.toLowerCase():e.key]=false);window.addEventListener('blur',clearMovement);
  window.addEventListener('market:visibility',e=>{if(!e.detail.active)clearMovement();else{cameraUpdate(true);loadCity(player)}});
  function manualStep(dx,dz){
   if(shopping.isOpen()){shopping.move(dx,dz);return}if(!city||!coverage)return;
   const p=avatar.position;const next={x:p.x+dx,z:p.z+dz},geo=G.unproject(next,origin);
   if(coverage(geo).supported&&city.onRoad(next)&&!city.blocked(next)){p.x=next.x;p.z=next.z;player={...geo,mode:'manual',county:coverage(geo).county};manualDirty=true;$('coordinate').textContent=geo.lat.toFixed(6)+', '+geo.lng.toFixed(6)}
  }
  function animate(now){requestAnimationFrame(animate);const dt=Math.min(.08,(now-lastNow)/1000);lastNow=now;if(window.MarketViewActive===false)return;const old=avatar.position.clone();
   if(!wardrobeOpen){
    if(!shopping.isOpen()&&gps.active&&gps.status==='following'){const alpha=1-Math.exp(-dt*5);avatar.position.x+=(target.x-avatar.position.x)*alpha;avatar.position.z+=(target.z-avatar.position.z)*alpha}
    else if(canManual()){
     let ix=joy.x+(keys.d||keys.ArrowRight?1:0)-(keys.a||keys.ArrowLeft?1:0),iy=joy.y+(keys.s||keys.ArrowDown?1:0)-(keys.w||keys.ArrowUp?1:0),length=Math.max(1,Math.hypot(ix,iy));ix/=length;iy/=length;
     let vx=ix*Math.cos(yaw)+iy*Math.sin(yaw),vz=-ix*Math.sin(yaw)+iy*Math.cos(yaw);
     if(ix||iy)autoPath=[];else if(autoPath.length&&!shopping.isOpen()){const [x,z]=autoPath[0],dx=x-avatar.position.x,dz=z-avatar.position.z,d=Math.hypot(dx,dz);if(d<.4)autoPath.shift();else{vx=dx/d;vz=dz/d}}
     if(vx||vz)manualStep(vx*dt*3.5,vz*dt*3.5);
    }
   }
   if(manualDirty&&now-lastShare>200){publishManual();lastShare=now}const dx=avatar.position.x-old.x,dz=avatar.position.z-old.z,speed=dt>0?Math.hypot(dx,dz)/dt:0,walking=speed>.15;
   if(walking){const a=Math.atan2(dx,dz),diff=Math.atan2(Math.sin(a-avatar.rotation.y),Math.cos(a-avatar.rotation.y));avatar.rotation.y+=diff*Math.min(1,dt*10)}const pet=wardrobe.active();petIdle=walking?0:petIdle+dt;if(pet){if(pet.cat){if(walking)pet.kit.setState('stand');else if(petIdle>4)pet.kit.setState('sit');pet.kit.update(dt,{speed:walking?Math.min(3.5,speed):0,look:camera.position})}else pet.kit.update(dt,{speed:walking?Math.min(3.5,speed):0})}
   $('movement').textContent=shopping.isOpen()?(walking?'正在逛攤位／貨架…':'室內用搖桿或方向鍵試逛'):(gps.active||gps.status==='paused')?(walking?'角色跟著你移動…':'GPS 模式 · 沿真實位置移動'):(walking?'沿街區漫遊…':'搖桿／方向鍵沿道路試走');
   sun.position.set(avatar.position.x-18,80,avatar.position.z+24);sun.target.position.copy(avatar.position);ring.position.x=avatar.position.x;ring.position.z=avatar.position.z;cameraUpdate();shopping.update(dt);
   if(now-lastDirections>100){const width=$('phone').clientWidth,footer=document.querySelector('.world-footer'),bottom=footer.offsetTop-8,compact=bottom-105<180;$('phone').classList.toggle('directions-compact',compact);marketDirections.update({venues:city?.venues||[],player:avatar.position,yaw:Math.atan2(camera.position.x-avatar.position.x,camera.position.z-avatar.position.z),rect:{left:7,right:width-7,top:compact?48:105,bottom},hidden:shopping.isOpen()||wardrobeOpen||!city||bottom<78,selected:selected?.id,compact});lastDirections=now}
   if(city&&!shopping.isOpen()){for(const label of city.labels){label.lookAt(camera.position);label.visible=overview||Math.hypot(label.position.x-avatar.position.x,label.position.z-avatar.position.z)<160}if(now-lastUI>300){venueUI();loadCity(player);lastUI=now}}
   renderer.render(scene,camera);
  }
  function resize(){const r=$('world').getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();cameraUpdate(true)}new ResizeObserver(resize).observe($('world'));resize();
  window.GPSWorld={position:()=>shopping.isOpen()?{...player}:G.unproject(avatar.position,origin),city:()=>city,shopping};
  $('loading').hidden=true;requestAnimationFrame(animate);
 }catch(e){console.error(e);$('loading').hidden=true;$('error').hidden=false}
})();

