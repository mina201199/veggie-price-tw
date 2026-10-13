from pathlib import Path
base=Path(__file__).parent
p=base/'app.js';s=p.read_text(encoding='utf-8')
s=s.replace('let lastUi=0,petIdle=0;','let lastUi=0,petIdle=0,lastShared=0,sharedNearest=venues[0].id;')
s=s.replace("const v=venues[nearest];$('venueName')","const v=venues[nearest];if(window.MarketBridge&&city.liveDistrict&&clock.elapsedTime-lastShared>.5){lastShared=clock.elapsedTime;const geo=city.unproject(p);window.MarketBridge.send({type:'player',player:{...geo,yaw},venueId:v.id!==sharedNearest?v.id:null});sharedNearest=v.id;}$('venueName')")
s=s.replace('requestAnimationFrame(tick);const dt=','requestAnimationFrame(tick);if(window.MarketViewActive===false){clock.getDelta();return}const dt=')
s=s.replace('const outdoorUI=ui;',"window.addEventListener('market:context',e=>{const i=venues.findIndex(v=>v.id===e.detail.venueId);if(i>=0)tour.value=i});window.addEventListener('market:go',e=>{const i=venues.findIndex(v=>v.id===e.detail.venueId);if(i>=0){tour.value=i;travelNearby()}});const outdoorUI=ui;")
p.write_text(s,encoding='utf-8')
for name in ['index.html','prices.html','xinyi-map.html']:
 p=base/name;s=p.read_text(encoding='utf-8');s=s.replace('</body>','<script src="market-bridge.js?v=1"></script></body>').replace('xinyi-20261012c','shared-20261013').replace('xinyi-map.js?v=1','xinyi-map.js?v=2');p.write_text(s,encoding='utf-8')
