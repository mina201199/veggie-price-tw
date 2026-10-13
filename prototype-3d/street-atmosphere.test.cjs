const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),T=require('./vendor/three.min.js');
const buttons=[],ctx={fillRect(){}};
const document={createElement(tag){return tag==='canvas'?{getContext:()=>ctx}:{style:{},setAttribute(){}}},getElementById(){return {appendChild:b=>buttons.push(b)}}};
const context={window:{},document,Math};vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/street-atmosphere.js','utf8'),context);
const scene=new T.Scene();scene.background=new T.Color();scene.fog=new T.Fog('#ffffff',32,100);const sun=new T.DirectionalLight();
const streetMesh=new T.Mesh(new T.PlaneGeometry(10,50),new T.MeshStandardMaterial());const city={streetMesh,buildings:new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial()),segments:[{a:{x:0,z:-30},b:{x:0,z:30},kind:'residential'}],venues:[{approach:{x:0,z:0}}],footprints:[],blocked:()=>false,closest:p=>({x:0,z:p.z,d:Math.abs(p.x),s:{a:{x:0,z:-30},b:{x:0,z:30},kind:'residential'}})};
const atmosphere=context.window.createStreetAtmosphere(T,scene,city,sun,()=>new T.Mesh(new T.PlaneGeometry(),new T.MeshBasicMaterial()));
assert.equal(city.blocked(0,0),false,'road center must remain walkable');assert.equal(city.blocked(8,-26),true,'new storefronts must have collision');
for(let i=0;i<3;i++){atmosphere.setWeather(i);atmosphere.update(.016,new T.Vector3(),false);assert.equal(buttons[0].hidden,false);assert.ok(Number.isFinite(sun.intensity));}
atmosphere.setWeather(2);atmosphere.update(.016,new T.Vector3(),true);assert.equal(buttons[0].hidden,true);assert.equal(sun.intensity,2.6);atmosphere.update(.016,new T.Vector3(),false);assert.equal(sun.intensity,.55);assert.equal(streetMesh.material.roughness,.28);
assert.ok(scene.children[0].children.filter(o=>o.isInstancedMesh).length<25,'street props should stay batched');console.log('Street atmosphere: weather, interior transition, road access and storefront collision PASS');
