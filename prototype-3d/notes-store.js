(function(root){
'use strict';
const KEY='veggie-shopping-notes-v1';
const units=['g','kg','台斤','顆','包','盒','把'];
function clean(value,max=500){return String(value??'').trim().slice(0,max)}
function validate(input){
 const n={};for(const key of ['venue','product','brand','origin','spec','promo','freshness','taste','service','notes','repurchase'])n[key]=clean(input[key],key==='notes'?2000:200);
 n.date=clean(input.date,10);n.unit=clean(input.unit,4);n.price=Number(input.price);n.quantity=Number(input.quantity);n.share=input.share===true;
 n.experience=clean(input.experience,20);
 if(!['','不好','普通','優秀'].includes(n.experience))throw Error('請選擇有效的購買經驗。');
 if(!n.venue||!n.product)throw Error('請填寫分店／攤位和商品名稱。');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(n.date)||!Number.isFinite(Date.parse(n.date))||new Date(n.date).toISOString().slice(0,10)!==n.date)throw Error('請填寫有效的購買／觀測日期。');
 if(!Number.isFinite(n.price)||n.price<=0||n.price>1000000)throw Error('價格需大於 0，且不超過 1,000,000 元。');
 if(input.quantity==null||String(input.quantity).trim()===''){n.quantity=null;n.unit='';}
 else {if(!Number.isFinite(n.quantity)||n.quantity<=0||n.quantity>1000000)throw Error('請填寫大於 0 的重量或數量。');
 if(!units.includes(n.unit))throw Error('請選擇支援的計價單位。');}
 return n;
}
function latest(record){return record.versions[record.versions.length-1]}
function perKg(n){const multiplier={g:.001,kg:1,'台斤':.6}[n.unit];return multiplier&&Number(n.quantity)>0?n.price/(n.quantity*multiplier):null}
function sharePayload(n){if(!n.share||!(Number(n.quantity)>0)||!units.includes(n.unit))return null;const out={};for(const key of ['venue','product','brand','origin','spec','promo','date','price','quantity','unit'])out[key]=n[key];return out}
function createStore(storage){
 function load(){
  const raw=storage.getItem(KEY);if(!raw)return [];
  let doc;try{doc=JSON.parse(raw)}catch(_){throw Error('筆記資料無法讀取，已停止寫入以保護原資料。請先匯出備份。')}
  if(doc.schema!==1||!Array.isArray(doc.records)||doc.records.some(r=>!r.id||!Array.isArray(r.versions)||!r.versions.length))throw Error('筆記格式不相容，請先匯出原始備份。');
  for(const r of doc.records)for(const v of r.versions)validate(v);
  return doc.records;
 }
 function save(input,id){
  const n=validate(input),records=load(),now=new Date().toISOString();n.savedAt=now;
  let record;if(id){record=records.find(r=>r.id===id);if(!record)throw Error('找不到要修正的紀錄，請重新開啟。');record.versions.push(n)}else{
   const key=globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
   record={id:key,createdAt:now,versions:[n]};records.push(record);
  }
  storage.setItem(KEY,JSON.stringify({schema:1,records}));return record;
 }
 return {load,save,exportJSON:()=>storage.getItem(KEY)||JSON.stringify({schema:1,records:[]})};
}
const api={createStore,latest,perKg,sharePayload,validate};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ShoppingNotes=api;
})(typeof window==='undefined'?globalThis:window);
