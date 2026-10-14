(function(global){
  'use strict';
  const R=6378137,rad=Math.PI/180;
  const regions=[
    {id:'zhongli',name:'桃園市 · 中壢區',lat:24.9537,lng:121.225},
    {id:'dayuan',name:'桃園市 · 大園區',lat:25.063,lng:121.197},
    {id:'taipei',name:'臺北市',lat:25.033,lng:121.5654},
    {id:'hsinchu',name:'新竹市',lat:24.8047,lng:120.971},
    {id:'taichung',name:'臺中市',lat:24.1477,lng:120.6736},
    {id:'tainan',name:'臺南市',lat:22.9997,lng:120.227},
    {id:'kaohsiung',name:'高雄市',lat:22.6273,lng:120.3014},
    {id:'pingtung',name:'屏東縣',lat:22.669,lng:120.486}
  ];
  const excluded=['宜蘭縣','花蓮縣','臺東縣','南投縣'];
  function valid(p){return !!p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<85&&Math.abs(p.lng)<=180}
  function mercator(p){return {x:R*p.lng*rad,y:R*Math.log(Math.tan(Math.PI/4+p.lat*rad/2))}}
  function fromMercator(p){return {lat:(2*Math.atan(Math.exp(p.y/R))-Math.PI/2)/rad,lng:p.x/R/rad}}
  function project(p,origin){const a=mercator(p),b=mercator(origin),scale=Math.cos(origin.lat*rad);return {x:(a.x-b.x)*scale,z:-(a.y-b.y)*scale}}
  function unproject(p,origin){const b=mercator(origin),scale=Math.cos(origin.lat*rad);return fromMercator({x:b.x+p.x/scale,y:b.y-p.z/scale})}
  function distance(a,b){const p=project(a,b);return Math.hypot(p.x,p.z)}
  function inRing(p,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];if((a[1]>p.lat)!==(b[1]>p.lat)&&p.lng<(b[0]-a[0])*(p.lat-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }return inside}
  function inPolygon(p,rings){return inRing(p,rings[0])&&!rings.slice(1).some(r=>inRing(p,r))}
  function createCoverage(data){
    const features=data.features.map(f=>{const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;const points=polys.flat(2);return {county:(f.properties.county||f.properties.COUNTYNAME).replace('桃園縣','桃園市'),polys,minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minY:Math.min(...points.map(p=>p[1])),maxY:Math.max(...points.map(p=>p[1]))}});
    return p=>{if(!valid(p))return {supported:false,county:null};const f=features.find(f=>p.lng>=f.minX&&p.lng<=f.maxX&&p.lat>=f.minY&&p.lat<=f.maxY&&f.polys.some(r=>inPolygon(p,r)));return {supported:!!f&&!excluded.includes(f.county),county:f?.county||null}};
  }
  function createTracker({geolocation,secure,coverage,onPosition,onState,now=()=>Date.now()}){
    const state={active:false,status:'manual',accuracy:null,county:null};
    let watch=null,generation=0,wanted=false,last=null,lastFix=0,lastTimestamp=0;
    function emit(status,extra={}){Object.assign(state,extra,{status});onState({...state})}
    function clear(){generation++;if(watch!==null){geolocation.clearWatch(watch);watch=null}}
    function subscribe(){
      const token=++generation;last=null;lastFix=0;lastTimestamp=0;state.active=true;emit('waiting',{accuracy:null,county:null});
      try{watch=geolocation.watchPosition(fix=>{
        if(token!==generation||!state.active)return;
        const c=fix.coords,p={lat:c.latitude,lng:c.longitude,accuracy:c.accuracy,timestamp:fix.timestamp};
        if(!valid(p)||!Number.isFinite(p.accuracy)||p.accuracy<0){emit('unavailable');return}
        if(!Number.isFinite(p.timestamp)||now()-p.timestamp>15000||p.timestamp>now()+5000){emit('stale');return}
        if(p.timestamp<lastTimestamp)return;
        lastTimestamp=p.timestamp;
        if(p.accuracy>60){emit('inaccurate',{accuracy:p.accuracy});return}
        const area=coverage(p);if(!area.supported){emit('outside',{county:area.county,accuracy:p.accuracy});return}
        lastFix=p.timestamp;emit('following',{accuracy:p.accuracy,county:area.county});
        if(last&&distance(p,last)<Math.max(2,Math.min(6,p.accuracy*.25)))return;
        if(Number.isFinite(c.heading))p.heading=c.heading;
        if(Number.isFinite(c.speed)&&c.speed>=0)p.speed=c.speed;
        p.mode='gps';p.county=area.county;last=p;onPosition(p);
      },error=>{
        if(token!==generation||!state.active)return;
        if(error.code===1){clear();wanted=false;state.active=false;emit('denied')}
        else emit(error.code===3?'timeout':'unavailable');
      },{enableHighAccuracy:true,maximumAge:0,timeout:12000});
      }catch(_){clear();wanted=false;state.active=false;emit('unavailable')}
    }
    return {state,
      start(){if(state.active)return;if(!secure){emit('insecure');return}if(!geolocation){emit('unsupported');return}wanted=true;subscribe()},
      stop(){wanted=false;clear();state.active=false;emit('manual',{accuracy:null,county:null})},
      suspend(){if(!wanted)return;clear();state.active=false;emit('paused')},
      resume(){if(wanted&&!state.active)subscribe()},
      checkFreshness(){if(state.active&&state.status==='following'&&now()-lastFix>15000)emit('stale')}
    };
  }
  const api={regions,excluded,valid,mercator,fromMercator,project,unproject,distance,createCoverage,createTracker};
  if(typeof module==='object'&&module.exports)module.exports=api;else global.MarketGPS=api;
})(typeof window==='undefined'?globalThis:window);
