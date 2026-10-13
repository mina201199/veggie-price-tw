const {test}=require('node:test'),assert=require('node:assert/strict');
let D;try{D=require('./market-directions.js')}catch{}
test('market direction geometry exists',()=>assert.equal(typeof D?.layout,'function'));
if(D){
 const venues=[{id:'north',name:'北市場',kind:'market',location:{x:0,z:-100}},{id:'east',name:'東市場',kind:'market',location:{x:100,z:0}},{id:'south',name:'南市場',kind:'market',location:{x:0,z:100}},{id:'west',name:'西市場',kind:'market',location:{x:-100,z:0}},{id:'store',kind:'supermarket',location:{x:20,z:0}}];
 const rect={left:8,right:382,top:100,bottom:350};
 test('all source markets point to geographic locations, exclude supermarkets, retain accurate distance',()=>{
  const r=D.layout(venues,{x:0,z:0},0,rect);assert.equal(r.markets.length,4);
  assert.deepEqual(r.markets.map(p=>p.edge).sort(),['bottom','left','right','top']);assert.ok(r.markets.every(p=>p.distance===100));
  const entranceChanged=venues.map(v=>({...v,entrance:{x:999,z:999}}));assert.deepEqual(D.layout(entranceChanged,{x:0,z:0},0,rect).markets,r.markets);
 });
 test('a quarter turn moves north to the right and west to the top; full turns restore directions',()=>{
  const q=D.layout(venues,{x:0,z:0},Math.PI/2,rect);assert.equal(q.markets.find(p=>p.id==='north').edge,'right');assert.equal(q.markets.find(p=>p.id==='west').edge,'top');
  const a=D.layout(venues,{x:0,z:0},0,rect),b=D.layout(venues,{x:0,z:0},Math.PI*2,rect);for(let i=0;i<4;i++){assert.equal(a.markets[i].edge,b.markets[i].edge);assert.ok(Math.abs(a.markets[i].distance-b.markets[i].distance)<1e-8)}
 });
 test('moving player changes distances, coincident markets remain selectable, bad coordinates skipped',()=>{
  const r=D.layout([...venues,{id:'bad',kind:'market',location:{x:NaN,z:0}}],{x:100,z:0},0,rect);assert.equal(r.markets.length,4);assert.equal(r.markets[0].id,'east');assert.equal(r.markets[0].distance,0);assert.equal(r.markets[0].arrived,true);assert.ok(r.markets.every(p=>Number.isFinite(p.angle)));
 });
 test('compass cardinal positions follow the same rotation as market arrows',()=>{
  const r=D.layout(venues,{x:0,z:0},Math.PI/2,rect);assert.equal(r.compass.find(p=>p.label==='北').edge,'right');assert.equal(r.compass.find(p=>p.label==='東').edge,'bottom');
  assert.deepEqual(D.layout([],{x:0,z:0},0,rect).markets,[]);
 });
}
