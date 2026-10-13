(()=>{
  'use strict';
  const $=id=>document.getElementById(id),query=new URLSearchParams(location.search);
  const venues=window.XinyiPlaces.venues,regions=MarketGPS.regions;
  const session=MarketSession.create(venues.map(v=>v.id),query.get('view')||'world');
  const frames=new Map(),ready=new Set();
  let regionId=regions.some(r=>r.id===query.get('region'))?query.get('region'):'zhongli';
  let gps={active:false,status:'loading',accuracy:null},coverage=null,tracker=null,selectedPlace=null;
  const selector=$('market');
  regions.forEach(r=>{const o=document.createElement('option');o.value=r.id;o.textContent=r.name+'（預覽）';selector.appendChild(o)});
  const current=document.createElement('option');current.value='current';current.textContent='目前位置';selector.appendChild(current);
  session.setPlayer({...regions.find(r=>r.id===regionId),mode:'manual'});
  function context(){return {...session.state,regionId,region:regions.find(r=>r.id===regionId),venue:selectedPlace,gps}}
  function send(view,type,detail){const f=frames.get(view);if(f&&ready.has(view))f.contentWindow.dispatchEvent(new f.contentWindow.CustomEvent(type,{detail}))}
  function statusText(){const accuracy=gps.accuracy==null?'':' · 精度約 ±'+Math.round(gps.accuracy)+' 公尺';
    return ({loading:'正在準備定位範圍…',manual:'手動預覽 · 尚未使用 GPS',waiting:'GPS 定位中，請允許位置存取',following:'GPS 跟隨 · '+gps.county+accuracy,inaccurate:'GPS 精度不足'+accuracy+'，暫停移動',stale:'GPS 訊號過期，等待新的定位',outside:(gps.county||'目前位置')+'不在啟用範圍，暫停移動',denied:'定位權限被拒絕，請在瀏覽器設定允許',timeout:'GPS 定位逾時，正在等待訊號',unavailable:'GPS 暫時沒有訊號，等待更新',unsupported:'此瀏覽器不支援定位',insecure:'手機定位需要 HTTPS，請使用安全網址',paused:'GPS 已在背景暫停',coverageError:'定位範圍載入失敗，請重新整理'})[gps.status]||'手動預覽';
  }
  function broadcast(){
    selector.value=regionId;$('locationStatus').textContent=statusText();
    $('gpsControl').textContent=gps.active||gps.status==='paused'?'停止 GPS':'開啟 GPS';
    $('gpsControl').disabled=!tracker;$('gpsControl').setAttribute('aria-pressed',String(gps.active));
    current.textContent=(gps.county||session.state.player?.county||'目前位置')+' · '+(session.state.player?.mode==='gps'?'GPS':'手動');
    frames.forEach((_,view)=>send(view,'market:context',context()));
  }
  function selectRegion(id){const r=regions.find(r=>r.id===id);if(!r)return;tracker?.stop();regionId=id;session.setPlayer({...r,mode:'manual'});broadcast()}
  function toggleGPS(action){if(!tracker)return;if(action==='stop'||gps.active||gps.status==='paused'){
    tracker.stop();session.setPlayer({...session.state.player,mode:'manual',accuracy:null});broadcast();
  }else tracker.start()}
  function open(view){
    if(view==='map')view='world';if(view==='notebook')view='notes';
    session.switchView(view);
    if(!frames.has(view)){
      const f=document.createElement('iframe');f.title={prices:'今日菜價',world:'3D 採買城市',notes:'採買筆記'}[view];f.dataset.view=view;f.allow='geolocation';
      if(view==='notes')f.addEventListener('load',()=>{ready.add('notes');if(session.state.view==='notes')$('opening').hidden=true});
      f.src={prices:'prices.html?embed=1',world:'gps-world.html?embed=1',notes:'notebook.html?embed=1'}[view];frames.set(view,f);document.querySelector('.screens').appendChild(f);
    }
    frames.forEach((f,key)=>{f.classList.toggle('active',key===view);f.setAttribute('aria-hidden',String(key!==view));send(key,'market:visibility',{active:key===view})});
    document.querySelectorAll('.tabs button').forEach(b=>b.setAttribute('aria-current',b.dataset.view===view?'page':'false'));
    $('opening').hidden=ready.has(view);const url=new URL(location.href);url.searchParams.set('view',view);history.replaceState(null,'',url);broadcast();
  }
  window.MarketApp={context,receive(view,event){
    if(!frames.has(view))return;
    if(event.type==='ready'){ready.add(view);send(view,'market:visibility',{active:view===session.state.view});send(view,'market:context',context());if(view===session.state.view)$('opening').hidden=true}
    else if(event.type==='gps')toggleGPS(event.action);
    else if(event.type==='region')selectRegion(event.regionId);
    else if(event.type==='place'&&view==='world'){selectedPlace=event.venue;broadcast()}
    else if(event.type==='player'&&view==='world'&&!gps.active&&gps.status!=='paused'&&coverage?.(event.player).supported){
      session.setPlayer({...event.player,mode:'manual'});regionId='current';broadcast();
    }else if(event.type==='navigate'){if(event.venueId)session.selectVenue(event.venueId);open(event.view)}
    else if(event.type==='select'){session.selectVenue(event.venueId);broadcast()}
  }};
  $('gpsControl').onclick=()=>toggleGPS();selector.onchange=()=>selectRegion(selector.value);
  document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>open(b.dataset.view));open(session.state.view);
  fetch('taiwan-counties.json').then(r=>{if(!r.ok)throw new Error('coverage');return r.json()}).then(data=>{
    coverage=MarketGPS.createCoverage(data);
    tracker=MarketGPS.createTracker({geolocation:navigator.geolocation,secure:window.isSecureContext,coverage,
      onState:state=>{gps=state;if(!state.active&&state.status!=='paused')session.setPlayer({...session.state.player,mode:'manual',accuracy:null});broadcast()},onPosition:p=>{session.setPlayer(p);regionId='current';broadcast()}});
    gps={...tracker.state};broadcast();
  }).catch(()=>{gps={...gps,status:'coverageError'};broadcast()});
  setInterval(()=>tracker?.checkFreshness(),1000);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)tracker?.suspend();else tracker?.resume()});
  window.addEventListener('pagehide',()=>tracker?.suspend());
  window.addEventListener('pageshow',()=>{if(!document.hidden)tracker?.resume()});
})();
