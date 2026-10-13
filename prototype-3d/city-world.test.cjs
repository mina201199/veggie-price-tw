const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const T=require('./vendor/three.min.js'),G=require('./gps-core.js');
const env={window:{MarketGPS:G},THREE:T,document:{createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){},measureText:t=>({width:t.length*15}),set fillStyle(v){},set font(v){},set textAlign(v){},set textBaseline(v){}})})}};
vm.createContext(env);if(fs.existsSync(__dirname+'/city-world.js'))vm.runInContext(fs.readFileSync(__dirname+'/city-world.js','utf8'),env);
test('the city renderer creates geographic 3D geometry',()=>assert.equal(typeof env.window.createCityWorld,'function'));
if(env.window.createCityWorld){
 const data={bounds:[24.94,121.21,24.96,121.23],roads:[{id:'r1',kind:'residential',name:'測試路',points:[[24.95,121.219],[24.95,121.222]]}],buildings:[{id:'b1',levels:3,points:[[24.9502,121.2202],[24.9502,121.2204],[24.9504,121.2204],[24.9504,121.2202],[24.9502,121.2202]]}],venues:[{id:'m',name:'測試市場',kind:'market',lat:24.9501,lng:121.2195},{id:'s',name:'測試超市',kind:'supermarket',lat:24.9501,lng:121.2215}]};
 const origin={lat:24.95,lng:121.22};
 test('GPS city retains the established tiled street facades, balconies and awnings',()=>{
  for(const buildings of [data.buildings,[]]){
   const city=env.window.createCityWorld(T,{...data,buildings},origin);
   for(const name of ['city-facade-windows','city-facade-balconies','city-facade-airconditioners','city-facade-storefronts','city-facade-awnings'])assert.ok(city.root.getObjectByName(name)?.geometry.getAttribute('position').count>0,name);
   assert.ok(city.root.getObjectByName('city-facade-tiles')?.material.map,'tiled walls from the established street style');
   assert.ok(city.root.userData.detailedFacades>0);assert.ok(city.root.userData.detailedFacades<=160,'phone geometry budget');
   city.dispose();
  }
 });
 test('real footprints become walls and roofs; roads stay at ground level',()=>{
  const city=env.window.createCityWorld(T,data,origin),buildings=city.root.getObjectByName('city-buildings'),roads=city.root.getObjectByName('city-roads');
  assert.ok(buildings?.isMesh);assert.ok(roads?.isMesh);
  const p=buildings.geometry.getAttribute('position');let height=0;for(let i=0;i<p.count;i++)height=Math.max(height,p.getY(i));assert.equal(height,9);
  assert.ok(roads.geometry.getAttribute('position').count>=6);
  const inside=G.project({lat:24.9503,lng:121.2203},origin);assert.equal(city.blocked(inside),true);assert.equal(city.blocked({x:0,z:0}),false);
  city.dispose();
 });
 test('market and supermarket keep source positions, distinct types and reachable entrances',()=>{
  const city=env.window.createCityWorld(T,data,origin);
  assert.equal(city.venues.length,2);for(const v of city.venues){assert.ok(v.root.isGroup);assert.equal(v.lat,24.9501);assert.ok(Math.abs(v.entrance.z)<.001,'entrance should be at the nearby road');assert.equal(city.blocked(v.entrance),false)}
  assert.notEqual(city.venues[0].root.userData.kind,city.venues[1].root.userData.kind);
  city.dispose();
 });
 test('dispose releases owned GPU resources and detaches the city group',()=>{
  const city=env.window.createCityWorld(T,data,origin),scene=new T.Scene();scene.add(city.root);let released=0;
  let instancesReleased=0;city.root.traverse(o=>{if(o.geometry)o.geometry.addEventListener('dispose',()=>released++);if(o.isInstancedMesh)o.addEventListener('dispose',()=>instancesReleased++)});city.dispose();assert.equal(scene.children.length,0);assert.ok(released>2);assert.ok(instancesReleased>0,'instance buffers must be released on street refresh');
 });
 test('streets near known shops retain illustrative houses when building footprints are missing',()=>{
  const city=env.window.createCityWorld(T,{...data,buildings:[]},origin);
  assert.ok(city.root.getObjectByName('city-illustrative-houses')?.geometry.getAttribute('position').count>0);
  assert.ok(city.footprints.every(f=>f.illustrative),'inferred houses must remain distinguishable from source footprints');city.dispose();
 });
}
