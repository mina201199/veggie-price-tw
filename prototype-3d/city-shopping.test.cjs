const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=fs.existsSync(__dirname+'/city-shopping.js')?require('./city-shopping.js'):{};
const Prices=require('./prices-core.js');
const Notes=require('./notes-store.js');
const data=require('./prices-data.json');
function memory(){let value=null;return {getItem:()=>value,setItem:(_,v)=>{value=v;}};}
test('purchase date uses Taiwan midnight even when UTC is still the previous day',()=>{
 assert.equal(typeof api.localDate,'function');
 assert.equal(api.localDate(new Date('2026-10-12T16:30:00Z')),'2026-10-13');
 assert.equal(api.localDate(new Date('2026-10-12T15:59:59Z')),'2026-10-12');
});
test('market stalls and supermarket shelves have distinct useful categories',()=>{
 assert.equal(typeof api.categories,'function');
 const market=api.categories('market'),supermarket=api.categories('supermarket');
 assert.ok(market.some(c=>c.id==='fish'));assert.ok(supermarket.some(c=>c.id==='dairy'));
 assert.ok(!market.some(c=>c.id==='dairy'));assert.ok(!supermarket.some(c=>c.id==='fish'));
 assert.ok(market.every(c=>c.name&&c.icon));
});
test('wholesale references use actual latest domestic high-volume variety, never retail estimate',()=>{
 assert.equal(typeof api.references,'function');
 const c=api.categories('market').find(c=>c.id==='vegetables');
 const refs=api.references(data,c,'2026-10-13',Prices);
 assert.ok(refs.length>0);
 for(const ref of refs){assert.ok(data.items.includes(ref.item));assert.equal(ref.item,Prices.pickVariety(data.items,ref.item.name));assert.equal(ref.price,ref.item.price);assert.equal(ref.date,ref.item.date);}
 assert.ok(api.references(data,api.categories('market').find(c=>c.id==='fish'),'2026-10-13',Prices).length===0);
 assert.ok(api.references(data,c,'2026-11-01',Prices).every(r=>r.stale));
});
test('reference excludes unusable or invalid dates instead of displaying zero as a price',()=>{
 assert.equal(typeof api.references,'function');
 const items=[{name:'高麗菜',official:'甘藍',category:'葉菜',price:0,date:'2026-10-07',volume:3},{name:'小白菜',official:'白菜',category:'葉菜',price:30,date:'bad',volume:4}];
 assert.deepEqual(api.references({items},api.categories('market')[0],'2026-10-13',Prices),[]);
});
test('local purchase saves required fields through existing NotesStore',()=>{
 assert.equal(typeof api.savePurchase,'function');
 const store=Notes.createStore(memory());
 const result=api.savePurchase(store,{venue:'大園市場',product:'高麗菜',date:'2026-10-13',price:'40',quantity:'',unit:'',notes:'攤位 A'});
 assert.equal(result.ok,true);assert.equal(store.load().length,1);
 assert.equal(Notes.latest(store.load()[0]).price,40);assert.equal(Notes.latest(store.load()[0]).notes,'攤位 A');
});
test('invalid input and storage failure do not report success or partially add a record',()=>{
 assert.equal(typeof api.savePurchase,'function');
 const storage=memory(),store=Notes.createStore(storage);
 assert.equal(api.savePurchase(store,{venue:'市場',product:'',date:'2026-10-13',price:40}).ok,false);
 assert.equal(store.load().length,0);
 const broken=Notes.createStore({getItem:()=>null,setItem:()=>{throw Error('空間不足');}});
 const r=api.savePurchase(broken,{venue:'市場',product:'菜',date:'2026-10-13',price:40});
 assert.equal(r.ok,false);assert.match(r.error,/空間不足/);assert.equal(r.record,undefined);
});
// The actual bundled Three library builds the room; this tiny DOM supplies only
// the element surface here. The owner also runs the real browser integration.
function dom(){
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.value='';this.textContent='';}
  appendChild(e){this.children.push(e);return e;}
  replaceChildren(){this.children=[];}
  setAttribute(k,v){this.attributes[k]=v;}
  querySelectorAll(tag){return this.children.flatMap(c=>[...(c.tagName===tag?[c]:[]),...c.querySelectorAll(tag)]);}
  getContext(){return {fillRect(){},fillText(){}};}
  focus(){}
 }
 const doc={createElement:tag=>new Element(tag)},host=new Element('main');host.ownerDocument=doc;
 return {host,find:id=>{let all=[host];while(all.length){const e=all.shift();if(e.id===id)return e;all.push(...e.children);}}};
}
test('actual Three room keeps stalls/shelves and callbacks preserve outdoor state; owned resources dispose',()=>{
 const T=require('./vendor/three.min.js'),scene=new T.Scene(),avatar=new T.Group(),body=new T.Group();avatar.position.set(120,0,80);scene.add(avatar);
 const outsideGeometry=new T.BoxGeometry(1,1,1),outsideMaterial=new T.MeshBasicMaterial();let outsideDisposed=false;outsideGeometry.addEventListener('dispose',()=>outsideDisposed=true);scene.add(new T.Mesh(outsideGeometry,outsideMaterial));
 const ui=dom(),events=[];const previous={fetch:globalThis.fetch,ShoppingNotes:globalThis.ShoppingNotes,localStorage:globalThis.localStorage};globalThis.fetch=undefined;globalThis.ShoppingNotes=Notes;globalThis.localStorage=memory();
 try{
  const shop=api.createCityShopping(T,{host:ui.host,scene,avatar,body,onOpen:()=>events.push(['open',avatar.position.x,avatar.position.z]),onClose:()=>events.push(['close',shop.room])});
  shop.open({id:'m',name:'<市場>',kind:'market'});assert.deepEqual(events[0],['open',120,80]);assert.equal(avatar.position.z,8);assert.equal(ui.find('shopInterior').hidden,false);
  const marketRoom=shop.room;let marketMeshes=0,disposed=0;marketRoom.traverse(o=>{if(o.isMesh){marketMeshes++;o.geometry.addEventListener('dispose',()=>disposed++);}});assert.ok(marketMeshes>180);assert.equal(marketRoom.children.filter(o=>o.isGroup).length,6);
  shop.move(0,-12.6);shop.move(-5,0);shop.update(.016);assert.equal(ui.find('shopCategories').children[0].attributes['aria-pressed'],'true');
  const before=avatar.position.z;shop.move(0,-2);assert.equal(avatar.position.z,before,'counter blocks entering fixture');
  ui.find('shopCategories').children[1].onclick();assert.equal(ui.find('shopCategories').children[1].attributes['aria-pressed'],'true');ui.find('shopCollect').onclick();assert.equal(ui.find('shopCollection').children.length,1);
  shop.close();assert.equal(shop.room,null);assert.deepEqual(events[1],['close',null]);assert.equal(disposed,marketMeshes);assert.equal(outsideDisposed,false);assert.equal(scene.children.includes(marketRoom),false);
  shop.open({id:'s',name:'超市',kind:'supermarket'});assert.equal(shop.room.children.filter(o=>o.isGroup).length,0);let shelves=0;shop.room.traverse(o=>{if(o.geometry?.parameters?.width===4.3&&o.geometry.parameters.height===.12)shelves++;});assert.equal(shelves,12);shop.close();
 } finally {for(const [k,v] of Object.entries(previous))globalThis[k]=v;}
});
test('form reports success only after real NotesStore write and retains invalid input for repair',()=>{
 const T=require('./vendor/three.min.js'),scene=new T.Scene(),avatar=new T.Group(),ui=dom(),storage=memory();
 const previous={fetch:globalThis.fetch,ShoppingNotes:globalThis.ShoppingNotes,localStorage:globalThis.localStorage};globalThis.fetch=undefined;globalThis.ShoppingNotes=Notes;globalThis.localStorage=storage;
 try{
  const shop=api.createCityShopping(T,{host:ui.host,scene,avatar});shop.open({id:'m',name:'市場',kind:'market'});
  const form=ui.find('shopNoteForm'),inputs=form.querySelectorAll('input'),get=n=>inputs.find(e=>e.name===n);get('product').value='高麗菜';get('price').value='';form.onsubmit({preventDefault(){}});assert.equal(ui.find('shopSaveStatus').dataset.state,'error');assert.equal(Notes.createStore(storage).load().length,0);
  get('price').value='45';form.onsubmit({preventDefault(){}});assert.equal(ui.find('shopSaveStatus').dataset.state,'saved');assert.equal(Notes.createStore(storage).load().length,1);shop.close();
 } finally {for(const [k,v] of Object.entries(previous))globalThis[k]=v;}
});
