const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const bounds = [24,120,26,122];
function api(fetch) {
  const context = {module:{exports:{}},fetch,URLSearchParams,AbortController,DOMException,setTimeout,clearTimeout};
  const file = path.join(__dirname,'city-data.js');
  if(fs.existsSync(file)) vm.runInNewContext(fs.readFileSync(file,'utf8'),context);
  return context.module.exports;
}
test('retains road and closed footprint coordinates, skips broken geometry',()=>{
  const city=api(); assert.equal(typeof city.normalize,'function');
  const result=city.normalize({elements:[
    {type:'way',id:1,tags:{highway:'residential',name:'測試路'},geometry:[{lat:25},{lat:25.01,lon:121.01}]},
    {type:'way',id:2,tags:{highway:'primary'},geometry:[{lat:25,lon:121},{lat:25.01,lon:121.01}]},
    {type:'way',id:3,tags:{building:'yes','building:levels':'4'},geometry:[{lat:25,lon:121},{lat:25,lon:121.01},{lat:25.01,lon:121.01},{lat:25,lon:121}]},
    {type:'way',id:4,tags:{building:'yes'},geometry:[{lat:NaN,lon:121},{lat:25,lon:121}]}
  ]},bounds);
  assert.equal(result.roads.length,1);
  assert.deepEqual(JSON.parse(JSON.stringify(result.roads[0].points)),[[25,121],[25.01,121.01]]);
  assert.equal(result.buildings.length,1); assert.equal(result.buildings[0].levels,4);
  assert.equal(result.buildings[0].points.length,4);
});
test('distinguishes venues, handles node, way center, relation and honest missing metadata',()=>{
  const city=api(); assert.equal(typeof city.normalize,'function');
  const result=city.normalize({elements:[
    {type:'node',id:1,lat:25,lon:121,tags:{amenity:'marketplace',name:'市場'}},
    {type:'way',id:2,center:{lat:25.1,lon:121.1},tags:{shop:'supermarket',name:'超市','addr:street':'中山路','addr:housenumber':'1','opening_hours':'08:00-22:00'}},
    {type:'relation',id:3,center:{lat:25.2,lon:121.2},tags:{shop:'supermarket'}},
    {type:'node',id:4,lat:999,lon:121,tags:{shop:'supermarket'}}
  ]},bounds);
  assert.equal(result.venues.length,3);
  assert.equal(result.venues[0].kind,'market'); assert.equal(result.venues[0].hours,'未提供');
  assert.equal(result.venues[1].kind,'supermarket'); assert.equal(result.venues[1].address,'中山路1');
  assert.equal(result.venues[1].sourceUrl,'https://www.openstreetmap.org/way/2');
  assert.equal(result.venues[2].name,'未命名超市');
});
test('selects snapshots only inside their real geographic bounds',()=>{
  const city=api(); assert.equal(typeof city.pickSnapshot,'function');
  assert.match(city.pickSnapshot({lat:25.063,lng:121.197}).file,/dayuan/);
  assert.match(city.pickSnapshot({lat:24.9537,lng:121.225}).file,/zhongli/);
  assert.equal(city.pickSnapshot({lat:25.04,lng:121.56}),null);
});
test('loads packaged geographic snapshot and rejects failed response honestly',async()=>{
  const city=api(async(url)=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(__dirname,url),'utf8'))}));
  assert.equal(typeof city.load,'function');
  const result=await city.load({lat:25.063,lng:121.197});
  assert.ok(result.roads.length>30); assert.ok(result.buildings.length>10);
  assert.ok(result.venues.some(v=>v.kind==='market')); assert.ok(result.venues.some(v=>v.kind==='supermarket'));
  const broken=api(async()=>({ok:false,status:503}));
  await assert.rejects(broken.load({lat:25.04,lng:121.56}),/503/);
});
test('outside snapshots uses limited geographic data and cancelled loads never return stale cache',async()=>{
  let call;
  const city=api(async(url,options)=>{call={url,options};return {ok:true,json:async()=>({elements:[{type:'way',id:1,tags:{highway:'residential'},geometry:[{lat:25.04,lon:121.56},{lat:25.041,lon:121.561}]}]})};});
  assert.equal(typeof city.load,'function');
  const result=await city.load({lat:25.04,lng:121.56});
  assert.equal(result.roads.length,1); assert.ok(result.bounds[2]-result.bounds[0]<0.03);
  assert.equal(call.options.method,'POST'); assert.match(String(call.options.body),/highway/);
  const controller=new AbortController();controller.abort();
  await assert.rejects(city.load({lat:25.04,lng:121.56},{signal:controller.signal}),{name:'AbortError'});
});
test('relations with Overpass geom bounds keep their real venue location',()=>{
  const result=api().normalize({elements:[{type:'relation',id:80,bounds:{minlat:25.1,minlon:121.1,maxlat:25.2,maxlon:121.2},tags:{amenity:'marketplace',name:'關聯市場'}}]},bounds);
  assert.equal(result.venues.length,1);assert.equal(result.venues[0].lat,25.15);assert.ok(Math.abs(result.venues[0].lng-121.15)<1e-9);
});
test('Zhongli packaged geometry contains actual closed buildings and both venue types',async()=>{
  const city=api(async(url)=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(__dirname,url),'utf8'))}));
  const result=await city.load({lat:24.9537,lng:121.225});
  assert.ok(result.roads.length>100);assert.ok(result.buildings.length>100);
  assert.ok(result.venues.some(v=>v.id==='way/734186821'&&v.name==='新明市場'));
  assert.ok(result.venues.some(v=>v.kind==='supermarket'));
  for(const b of result.buildings) assert.deepEqual(b.points[0],b.points.at(-1));
});
test('entering Dayuan selects its snapshot even when a smaller external patch is cached',async()=>{
  const city=api(async(url)=>url.startsWith('city-data/')
    ? {ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(__dirname,url),'utf8'))}
    : {ok:true,json:async()=>({elements:[{type:'way',id:901,tags:{highway:'residential'},geometry:[{lat:25.042,lon:121.198},{lat:25.043,lon:121.199}]}]})});
  const exterior=await city.load({lat:25.042,lng:121.198});
  assert.equal(exterior.roads.length,1);
  const interior=await city.load({lat:25.046,lng:121.198});
  assert.ok(interior.roads.length>30);
  assert.ok(interior.venues.some(v=>v.id==='node/6854091465'));
  assert.deepEqual(JSON.parse(JSON.stringify(interior.bounds)),[25.043,121.177,25.084,121.224]);
});
