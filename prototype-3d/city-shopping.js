(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else {root.CityShopping=api;root.createCityShopping=api.createCityShopping;}
})(typeof window==='object'?window:globalThis,function(root){
 'use strict';
 const vegetable={id:'vegetables',icon:'🥬',name:'蔬菜',priceCategories:['葉菜','根莖','瓜果豆','辛香','菇類']};
 const fruit={id:'fruit',icon:'🍎',name:'水果',priceCategories:['水果']};
 function categories(kind){return (kind==='market'?[vegetable,fruit,{id:'fish',icon:'🐟',name:'魚鮮'},{id:'meat',icon:'🐷',name:'肉品'},{id:'eggs',icon:'🥚',name:'雞蛋'},{id:'dry',icon:'🌾',name:'乾貨'}]:[vegetable,fruit,{id:'meat',icon:'🐔',name:'肉品'},{id:'dairy',icon:'🐄',name:'乳品'},{id:'drinks',icon:'🧃',name:'飲料'},{id:'pantry',icon:'🌾',name:'米糧乾貨'}]).map(c=>({...c}));}
 function references(data,category,today,Prices){
  if(!Prices||!Array.isArray(data?.items)||!category?.priceCategories)return [];
  const names=[...new Set(data.items.filter(x=>category.priceCategories.includes(x.category)).map(x=>x.name))];
  return names.map(name=>Prices.pickVariety(data.items,name)).filter(x=>x&&Number.isFinite(x.price)&&x.price>0&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&Number.isFinite(Date.parse(x.date))).map(item=>({item,price:item.price,date:item.date,stale:Prices.assess(item,today).stale})).sort((a,b)=>b.item.volume-a.item.volume).slice(0,8);
 }
 function savePurchase(store,input){try{if(!store)throw Error('採買筆記未載入，請稍後再試。');return {ok:true,record:store.save(input)};}catch(e){return {ok:false,error:e.message||'無法儲存筆記。'};}}
 function localDate(now=new Date()){const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));return [values.year,values.month,values.day].join('-');}
 function createCityShopping(T,{host,scene,avatar,body,onOpen=()=>{},onClose=()=>{},onNavigate=()=>{}}){
  const doc=host.ownerDocument||root.document;
  let room=null,venue=null,stops=[],walls=[],active=0,data=null,dataError='',store=null,nearest=-1;
  const collected=new Map(),materials=new Set(),geometries=new Set(),textures=new Set();
  function el(tag,text,className,parent){const e=doc.createElement(tag);if(text!=null)e.textContent=text;if(className)e.className=className;if(parent)parent.appendChild(e);return e;}
  function button(text,parent,fn){const b=el('button',text,'',parent);b.type='button';b.onclick=fn;return b;}
  const overlay=el('section',null,'shop-interior',host);overlay.id='shopInterior';overlay.hidden=true;overlay.setAttribute('aria-label','室內採買');
  const head=el('header',null,'shop-head',overlay),title=el('h2','室內採買','',head);
  const leave=button('← 返回城市',head,close);leave.id='shopLeave';
  el('p','室內配置與商品模型為示意；品項不代表此店庫存。','shop-disclaimer',overlay);
  const panel=el('div',null,'shop-panel',overlay),categoryButtons=el('nav',null,'shop-categories',panel);categoryButtons.id='shopCategories';categoryButtons.setAttribute('aria-label','採買分類');
  const nearHint=el('p','走近金色圓圈可查看分類，也可直接點選上方分類。','shop-hint',panel);
  const detailTitle=el('h3','','',panel),pricesBox=el('div',null,'shop-prices',panel);pricesBox.id='shopPrices';
  const actions=el('div',null,'shop-actions',panel);
  const collect=button('收藏品項卡',actions,()=>{const c=stops[active]?.category;if(!c)return;collected.set(venue.id+':'+c.id,{venue:venue.name,category:c.name,icon:c.icon});renderCollection();showStop(active);});collect.id='shopCollect';
  button('完整批發行情',actions,()=>onNavigate('prices'));
  const collection=el('details',null,'shop-collection',panel);el('summary','已收藏的探索品項卡','',collection);const collectionList=el('div',null,'',collection);collectionList.id='shopCollection';
  const form=el('form',null,'shop-note-form',panel);form.id='shopNoteForm';el('h3','記下實際採買／觀測價格','',form);el('p','請自行輸入現場價格。只存於這個瀏覽器，不會公開或送審。','',form);
  const fields={};
  function input(name,label,type='text',required=false){const l=el('label',label,'',form),i=el('input',null,'',l);i.name=name;i.type=type;i.required=required;i.setAttribute('aria-label',label);fields[name]=i;return i;}
  input('venue','分店／攤位','text',true);input('product','商品名稱','text',true);input('date','購買／觀測日期','date',true);const price=input('price','實際總價（元）','number',true);price.min='.01';price.step='any';
  const qty=input('quantity','重量／數量（可留空）','number');qty.min='.001';qty.step='any';
  const unitLabel=el('label','單位','',form),unit=el('select',null,'',unitLabel);unit.name='unit';unit.setAttribute('aria-label','單位');for(const u of ['','g','kg','台斤','顆','包','盒','把']){const o=el('option',u||'未填數量','',unit);o.value=u;}fields.unit=unit;
  const notesLabel=el('label','採買心得／攤位位置','',form),notes=el('textarea',null,'',notesLabel);notes.name='notes';notes.rows=2;fields.notes=notes;
  const submit=el('button','存到本機採買筆記','',form);submit.type='submit';submit.id='shopSave';
  const status=el('p','','shop-save-status',form);status.id='shopSaveStatus';status.setAttribute('role','status');
  button('查看採買筆記',form,()=>onNavigate('notebook'));
  form.onsubmit=e=>{e.preventDefault();const values={};for(const k of Object.keys(fields))values[k]=fields[k].value;const result=savePurchase(store,values);status.textContent=result.ok?'已儲存到這個瀏覽器的採買筆記。':result.error;status.dataset.state=result.ok?'saved':'error';};
  try{store=root.ShoppingNotes?.createStore(root.localStorage);}catch(e){status.textContent='本機儲存無法使用：'+e.message;}
  function renderCollection(){collectionList.replaceChildren();if(!collected.size)el('p','尚未收藏；收藏只是探索紀錄，不是購買或庫存。','',collectionList);for(const c of collected.values())el('p',c.icon+' '+c.category+' · '+c.venue,'',collectionList);}
  function showStop(index){if(!room||!stops[index])return;active=index;const c=stops[index].category;detailTitle.textContent=c.icon+' '+c.name;categoryButtons.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===active)));pricesBox.replaceChildren();
   el('p','真實批發參考（非分店售價）','shop-reference-label',pricesBox);
   if(!data){el('p',dataError||'載入農業部批發行情…','',pricesBox);}
   else {el('p',`${data.source||'農業部農產品交易行情'} · ${data.scope||'果菜批發市場'} · 資料日期 ${data.asOf||'未提供'}`,'shop-source',pricesBox);const refs=references(data,c,localDate(),root.Prices);
    if(!refs.length)el('p',c.priceCategories?'此分類目前沒有可用的批發參考。':'這個分類沒有本機果菜批發行情；請輸入現場實際觀測價格。','',pricesBox);
    for(const r of refs){const card=el('article',null,'shop-price-card',pricesBox);el('strong',r.item.name,'',card);el('span',r.price.toFixed(2)+' 元／公斤','',card);el('small',r.item.official+' · 交易日 '+r.date+(r.stale?' · 超過 7 天，僅供歷史參考':''),'',card);const choose=button('記錄 '+r.item.name,card,()=>{fields.product.value=r.item.name;fields.price.value='';status.textContent='請輸入現場價格後儲存。';fields.price.focus();});choose.dataset.product=r.item.name;}
   }
   const key=venue.id+':'+c.id;collect.disabled=collected.has(key);collect.textContent=collect.disabled?'✓ 已收藏品項卡':'收藏 '+c.icon+' '+c.name+' 品項卡';
  }
  function mesh(geometry,color,x,y,z,parent=room,basic=false){geometries.add(geometry);const material=basic?new T.MeshBasicMaterial({color,side:T.DoubleSide}):new T.MeshStandardMaterial({color,roughness:.86});materials.add(material);const m=new T.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m;}
  function box(w,h,d,color,x,y,z,parent){return mesh(new T.BoxGeometry(w,h,d),color,x,y,z,parent);}
  function cyl(a,b,h,color,x,y,z,parent){return mesh(new T.CylinderGeometry(a,b,h,12),color,x,y,z,parent);}
  function ball(r,color,x,y,z,parent){return mesh(new T.SphereGeometry(r,12,8),color,x,y,z,parent);}
  function sign(text,x,y,z,w){const canvas=doc.createElement('canvas');canvas.width=768;canvas.height=128;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.fillStyle='#faf5e8';ctx.fillRect(0,0,768,128);ctx.fillStyle='#264b42';ctx.font='bold 46px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,384,64,730);const texture=new T.CanvasTexture(canvas);textures.add(texture);const g=new T.PlaneGeometry(w,w/6);geometries.add(g);const mat=new T.MeshBasicMaterial({map:texture,side:T.DoubleSide});materials.add(mat);const s=new T.Mesh(g,mat);s.position.set(x,y,z);room.add(s);}
  function open(nextVenue){if(!nextVenue)return false;if(room)close();venue=nextVenue;
   room=new T.Group();room.name='city-shopping-room';scene.add(room);const traditional=venue.kind==='market';stops=[];walls=[];nearest=-1;
   box(19,.3,26,traditional?'#d5c6a7':'#e1e9df',0,-.2,0);for(let x=-9;x<10;x+=2)box(.025,.01,26,'#bfccb9',x,-.035,0);for(let z=-13;z<14;z+=2)box(19,.01,.025,'#bfccb9',0,-.035,z);box(19,4,.35,traditional?'#e9d6b3':'#b8cfbf',0,2,-13);box(.25,1.1,26,'#ccd7c2',-9.5,.55,0);box(.25,1.1,26,'#ccd7c2',9.5,.55,0);sign(venue.name+'（室內示意）',0,3,-12.78,9);
   categoryButtons.replaceChildren();categories(venue.kind).forEach((category,i)=>{const {icon,name}=category,x=i%2===0?-5:5,z=-7+Math.floor(i/2)*7,color=['#71975c','#bd7970','#719ea7','#dfad57','#a6a06d','#879d7b'][i];stops.push({x,z:z+2.4,category});walls.push({x,z,w:2.5,d:1.6});const b=button(icon+' '+name,categoryButtons,()=>showStop(i));b.dataset.category=category.id;
    box(4.2,1.2,2.3,traditional?'#b59360':'#afc2b1',x,.6,z);box(4.5,.18,2.5,traditional?'#e8cf9d':'#f3f2e8',x,1.28,z);
    if(traditional){for(const dx of [-2,2])cyl(.075,.075,3.2,'#887458',x+dx,1.6,z-.9);for(let k=0;k<8;k++)box(.55,.12,2.9,k%2?'#f3e7cb':color,x-1.925+k*.55,3.3,z);sign(name,x,2.75,z+1.1,3.9);const vendor=new T.Group();vendor.position.set(x,0,z-1.8);room.add(vendor);cyl(.3,.4,.8,color,0,1.1,0,vendor);ball(.34,'#e9bd95',0,1.82,0,vendor);cyl(.4,.36,.18,'#f4eedc',0,2.08,0,vendor);box(.42,.6,.08,'#e9e6d3',0,1.15,.32,vendor);ball(.045,'#41392d',-.11,1.85,.3,vendor);ball(.045,'#41392d',.11,1.85,.3,vendor);}
    else{box(4.3,2.6,.2,'#d4dfd0',x,1.35,z-1.15);for(const y of [1.9,2.6]){box(4.3,.12,1.1,'#f6f3e9',x,y,z-.6);for(let k=0;k<7;k++)box(.38,.48,.4,k%2?color:'#f2e5c5',x-1.7+k*.55,y+.3,z-.6);}sign(name,x,3.2,z-.95,3.8);}
    for(let k=0;k<12;k++){const px=x-1.6+(k%4)*1.05,pz=z-.7+Math.floor(k/4)*.6;if(category.id==='fish'){const fish=ball(.24,'#82b1bd',px,1.54,pz);fish.scale.set(1.6,.45,.65);const tail=mesh(new T.ConeGeometry(.16,.3,3),'#709cad',px-.43,1.54,pz);tail.rotation.z=Math.PI/2;}else if(category.id==='meat')box(.5,.17,.34,'#c5817b',px,1.49,pz);else if(['dairy','drinks'].includes(category.id))box(.32,.56,.32,k%2?'#f1eede':'#a6c4bc',px,1.65,pz);else{const food=ball(.24,category.id==='vegetables'?'#6e994f':category.id==='fruit'?'#ce7150':category.id==='eggs'?'#f2e4bd':'#d4ac65',px,1.55,pz);if(category.id==='vegetables')food.scale.y=1.3;}}
    const ring=mesh(new T.RingGeometry(.55,.65,32),'#e5b953',x,.025,z+2.4,room,true);ring.rotation.x=-Math.PI/2;
   });box(3,.08,1.4,'#7ea598',0,.01,10.3);sign('出口 → 城市',0,1.7,11.7,3.6);
   // The owner saves outdoor coordinates before the avatar moves.
   onOpen(venue);avatar.position.set(0,0,8);avatar.rotation.y=Math.PI;if(body)body.rotation.y=0;overlay.hidden=false;title.textContent=venue.name+' · '+(traditional?'市場攤位':'超市貨架');fields.venue.value=venue.name;fields.product.value='';fields.price.value='';fields.quantity.value='';fields.unit.value='';fields.notes.value='';fields.date.value=localDate();status.textContent='';renderCollection();showStop(0);return true;
  }
  function close(){if(!room)return;scene.remove(room);for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();geometries.clear();materials.clear();textures.clear();room=null;stops=[];walls=[];overlay.hidden=true;onClose(venue);venue=null;}
  function move(dx,dz){if(!room||!Number.isFinite(dx)||!Number.isFinite(dz))return false;const p=avatar.position;function clear(x,z){return x> -8.9&&x<8.9&&z> -12.2&&z<11.9&&!walls.some(w=>Math.abs(x-w.x)<w.w&&Math.abs(z-w.z)<w.d);}if(clear(p.x+dx,p.z))p.x+=dx;if(clear(p.x,p.z+dz))p.z+=dz;return true;}
  function update(){if(!room)return;const p=avatar.position;let index=-1,distance=Infinity;stops.forEach((s,i)=>{const d=Math.hypot(p.x-s.x,p.z-s.z);if(d<distance){distance=d;index=i;}});const closeEnough=distance<2.5;if(closeEnough&&index!==nearest){nearest=index;showStop(index);}if(!closeEnough)nearest=-1;nearHint.textContent=Math.hypot(p.x,p.z-10.3)<1.4?'已到出口，點「返回城市」繼續採買。':closeEnough?'靠近 '+stops[index].category.name+'：可查看批發參考、收藏與記錄價格。':'走近金色圓圈可查看分類，也可直接點選上方分類。';}
  if(typeof root.fetch==='function')root.fetch('prices-data.json').then(r=>{if(!r.ok)throw Error('批發行情暫時無法載入。');return r.json();}).then(d=>{if(!Array.isArray(d.items))throw Error('批發行情格式無法讀取。');data=d;if(room)showStop(active);}).catch(e=>{dataError=e.message||'批發行情暫時無法載入。';if(room)showStop(active);});else dataError='批發行情暫時無法載入。';
  return {open,close,get room(){return room;},update,move,showStop,isOpen:()=>!!room};
 }
 return {categories,references,savePurchase,localDate,createCityShopping};
});
