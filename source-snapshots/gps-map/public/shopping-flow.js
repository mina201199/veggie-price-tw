(function(root){
'use strict';
const planKey=scope=>'veggie-shopping-plan-v1:'+scope;
const draftKey=scope=>'veggie-shopping-draft-v1:'+scope;
const clean=value=>String(value??'').trim().slice(0,200);
function today(){const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;}
function createPlan(storage,scope){
 function load(){const raw=storage.getItem(planKey(scope));if(!raw)return [];let list;try{list=JSON.parse(raw)}catch(_){throw Error('待買清單無法讀取，請保留原資料。')}
 if(!Array.isArray(list)||list.length>100||list.some(p=>typeof p!=='string'||!p.trim()||p.length>200))throw Error('待買清單格式無法讀取。');return list;}
 function write(list){storage.setItem(planKey(scope),JSON.stringify(list));return list;}
 return {load,add(product){const p=clean(product),list=load();if(!p)throw Error('請填寫想買的商品。');if(list.includes(p))return list;if(list.length>=100)throw Error('待買清單最多 100 項。');return write([...list,p]);},remove(product){return write(load().filter(p=>p!==product));}};
}
function lastPurchase(records,product,date=today()){return records.map(r=>r.versions[r.versions.length-1]).filter(n=>n.product===product&&n.date<=date).sort((a,b)=>b.date.localeCompare(a.date)||String(b.savedAt||'').localeCompare(String(a.savedAt||'')))[0]||null;}
function frequent(records,date=today()){
 const counts=new Map();for(const r of records){const n=r.versions[r.versions.length-1];if(n.date>date)continue;counts.set(n.product,(counts.get(n.product)||0)+1)}
 return [...counts.keys()].sort((a,b)=>counts.get(b)-counts.get(a)||lastPurchase(records,b,date).date.localeCompare(lastPurchase(records,a,date).date)).slice(0,6).map(p=>lastPurchase(records,p,date));
}
function compare(previous,current){
 const factors={g:.001,kg:1,'台斤':.6},a=factors[previous.unit],b=factors[current.unit];
 if(!(Number(previous.price)>0&&Number(current.price)>0&&Number(previous.quantity)>0&&Number(current.quantity)>0))return null;
 if(!(a&&b)&&previous.unit!==current.unit)return null;
 const before=Number(previous.price)/(Number(previous.quantity)*(a||1)),now=Number(current.price)/(Number(current.quantity)*(b||1));
 return {before,now,percent:Math.round((now/before-1)*10000)/100,unit:a&&b?'公斤':current.unit};
}
function draft(item,price='',quantity='',unit='台斤'){
 return {product:clean(item.name),spec:clean(item.official),venue:'',price:String(price),quantity:String(quantity),unit:{'公斤':'kg','公克':'g','台斤':'台斤'}[unit]||'',share:false};
}
function putDraft(storage,scope,value){storage.setItem(draftKey(scope),JSON.stringify(value));}
function takeDraft(storage,scope){const key=draftKey(scope),raw=storage.getItem(key);if(!raw)return null;let value;try{value=JSON.parse(raw)}catch(_){throw Error('採買內容無法讀取，請重新從行情頁記一筆。')}
 if(!value||typeof value.product!=='string'||!value.product||value.product.length>200)throw Error('採買內容無法讀取。');storage.removeItem(key);return value;}
const api={today,planKey,createPlan,lastPurchase,frequent,compare,draft,putDraft,takeDraft};
if(typeof module==='object')module.exports=api;else root.ShoppingFlow=api;
})(typeof window==='undefined'?globalThis:window);
