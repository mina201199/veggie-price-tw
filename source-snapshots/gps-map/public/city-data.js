(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MarketCityData=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const snapshots=[
    {name:'大園',file:'city-data/dayuan.json',bounds:[25.043,121.177,25.084,121.224]},
    {name:'中壢',file:'city-data/zhongli.json',bounds:[24.93,121.199,24.981,121.255]}
  ];
  // Official POST + browser CORS contract: https://dev.overpass-api.de/command_line.html
  // Availability is not guaranteed; local snapshots work without external requests.
  const endpoint='https://overpass-api.de/api/interpreter';
  const cache=new Map();
  const source='© OpenStreetMap contributors · ODbL 1.0 · https://www.openstreetmap.org/copyright';
  const valid=p=>p&&typeof p.lat==='number'&&Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&typeof (p.lon??p.lng)==='number'&&Number.isFinite(p.lon??p.lng)&&Math.abs(p.lon??p.lng)<=180;
  const inside=(p,b)=>valid(p)&&p.lat>=b[0]&&p.lat<=b[2]&&(p.lon??p.lng)>=b[1]&&(p.lon??p.lng)<=b[3];
  function points(geometry,min,closed){
    if(!Array.isArray(geometry)||geometry.length<min||geometry.some(p=>!valid(p)))return null;
    const list=geometry.map(p=>[p.lat,p.lon??p.lng]);
    if(closed&&(list[0][0]!==list.at(-1)[0]||list[0][1]!==list.at(-1)[1]||new Set(list.map(p=>p.join(','))).size<3))return null;
    return list;
  }
  const positive=value=>{const n=parseFloat(value);return Number.isFinite(n)&&n>0?n:null;};
  function normalize(overpass,bounds){
    if(!Array.isArray(bounds)||bounds.length!==4||bounds.some(v=>!Number.isFinite(v))||bounds[0]>=bounds[2]||bounds[1]>=bounds[3])throw new Error('無效的地理範圍');
    if(!overpass||!Array.isArray(overpass.elements)||overpass.remark)throw new Error('地理資料不完整，請稍後再試');
    const roads=[],buildings=[],venues=[],seen=new Set();
    for(const el of overpass.elements){
      if(!el||!['node','way','relation'].includes(el.type)||!Number.isSafeInteger(el.id))continue;
      const id=el.type+'/'+el.id;if(seen.has(id))continue;seen.add(id);
      const tags=el.tags||{};
      if(el.type==='way'&&tags.highway){const line=points(el.geometry,2,false);if(line)roads.push({id,name:tags.name||'',kind:tags.highway,points:line});}
      if(el.type==='way'&&tags.building&&tags.building!=='no'){const ring=points(el.geometry,4,true);if(ring)buildings.push({id,points:ring,levels:positive(tags['building:levels']),height:positive(tags.height)});}
      const kind=tags.amenity==='marketplace'?'market':tags.shop==='supermarket'?'supermarket':null;
      if(!kind)continue;
      let location=valid(el)?el:valid(el.center)?el.center:null;
      if(!location&&el.bounds&&valid({lat:el.bounds.minlat,lon:el.bounds.minlon})&&valid({lat:el.bounds.maxlat,lon:el.bounds.maxlon})){
        location={lat:(el.bounds.minlat+el.bounds.maxlat)/2,lon:(el.bounds.minlon+el.bounds.maxlon)/2};
      }
      if(!location&&Array.isArray(el.geometry)&&el.geometry.length&&el.geometry.every(valid)){
        const latitudes=el.geometry.map(p=>p.lat),longitudes=el.geometry.map(p=>p.lon);
        location={lat:(Math.min(...latitudes)+Math.max(...latitudes))/2,lon:(Math.min(...longitudes)+Math.max(...longitudes))/2};
      }
      if(!location||!inside(location,bounds))continue;
      const address=tags['addr:full']||[tags['addr:city'],tags['addr:district'],tags['addr:street'],tags['addr:housenumber']].filter(Boolean).join('')||'未提供';
      venues.push({id,name:tags['name:zh']||tags.name||tags.brand||(kind==='market'?'未命名市場':'未命名超市'),kind,lat:location.lat,lng:location.lon??location.lng,address,hours:tags.opening_hours||'未提供',sourceUrl:'https://www.openstreetmap.org/'+id});
    }
    return {bounds:bounds.slice(),roads,buildings,venues,source:overpass.source||source,checkedDate:overpass.checkedDate||overpass.osm3s?.timestamp_osm_base?.slice(0,10)||new Date().toISOString().slice(0,10)};
  }
  function pickSnapshot(point){return snapshots.find(s=>inside(point,s.bounds))||null;}
  function cancelled(signal){if(signal?.aborted)throw new DOMException('地圖載入已取消','AbortError');}
  function query(bounds){const box=bounds.join(',');return '[out:json][timeout:25][maxsize:33554432];(way[highway]('+box+');way[building]('+box+');nwr[shop=supermarket]('+box+');nwr[amenity=marketplace]('+box+'););out geom;';}
  async function load(point,{signal}={}){
    cancelled(signal);if(!valid(point))throw new Error('無效的 GPS 座標');
    const snapshot=pickSnapshot(point);
    const cached=snapshot?cache.get(snapshot.bounds.join(',')):[...cache.values()].find(data=>inside(point,data.bounds));if(cached)return cached;
    const lng=point.lng??point.lon;
    const bounds=snapshot?snapshot.bounds:[point.lat-.008,lng-.009,point.lat+.008,lng+.009];
    const controller=new AbortController();const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
    const timeout=setTimeout(()=>controller.abort(),35000);
    try{
      const response=await fetch(snapshot?snapshot.file:endpoint,snapshot?{signal:controller.signal}:{method:'POST',body:new URLSearchParams({data:query(bounds)}),signal:controller.signal});
      if(!response.ok)throw new Error('地圖來源暫時無法載入（'+response.status+'）');
      const raw=await response.json();cancelled(signal);
      const result=raw.elements?normalize(raw,bounds):raw;
      if(!Array.isArray(result.roads)||!Array.isArray(result.buildings)||!Array.isArray(result.venues)||!Array.isArray(result.bounds))throw new Error('地圖資料格式錯誤');
      if(!result.roads.length)throw new Error('此區域尚未取得可用道路資料');
      cache.set(bounds.join(','),result);while(cache.size>6)cache.delete(cache.keys().next().value);
      return result;
    }finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
  }
  return {normalize,load,pickSnapshot,snapshots,endpoint};
});
