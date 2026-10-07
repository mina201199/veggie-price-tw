(function(root){
'use strict';
const KEY='veggie-shopping-notes-v1';
const units=['g','kg','台斤','顆','包','盒','把'],photoKinds=['收據','標價','其他'];
function clean(value,max=500){return String(value??'').trim().slice(0,max)}
function validate(input){
 const n={};for(const key of ['venue','product','brand','origin','spec','promo','freshness','taste','service','notes','repurchase'])n[key]=clean(input[key],key==='notes'?2000:200);
 n.date=clean(input.date,10);n.unit=clean(input.unit,4);n.price=Number(input.price);n.quantity=Number(input.quantity);n.share=input.share===true;
 n.experience=clean(input.experience,20);
 if(!['','不好','普通','優秀'].includes(n.experience))throw Error('請選擇有效的購買經驗。');
 // A receipt or price-tag photo kept on this device (photos.js); the note holds only its id.
 n.photo=clean(input.photo,64);if(n.photo&&!/^[A-Za-z0-9-]{8,64}$/.test(n.photo))throw Error('照片連結格式不正確。');
 n.photoKind=n.photo?clean(input.photoKind,4):'';if(n.photo&&!photoKinds.includes(n.photoKind))throw Error('請選擇照片類型（收據、標價或其他）。');
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
const newKey=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
// Every photo id any version of any note refers to (for backups).
function photoIds(records){return [...new Set(records.flatMap(r=>r.versions.map(v=>v.photo).filter(Boolean)))]}
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
   record={id:newKey(),createdAt:now,versions:[n]};records.push(record);
  }
  storage.setItem(KEY,JSON.stringify({schema:1,records}));return record;
 }
 // Several new notes at once (one receipt, many items): all rows are checked first, then written in one go,
 // so a bad row or a full storage leaves nothing half-saved.
 function saveMany(inputs){
  if(!Array.isArray(inputs)||!inputs.length||inputs.length>100)throw Error('一次可以存 1 到 100 筆。');
  const list=inputs.map((input,i)=>{try{return validate(input)}catch(e){throw Error(`第 ${i+1} 項：${e.message}`)}});
  const records=load(),now=new Date().toISOString();
  const added=list.map(n=>{n.savedAt=now;const record={id:newKey(),createdAt:now,versions:[n]};records.push(record);return record});
  storage.setItem(KEY,JSON.stringify({schema:1,records}));return added;
 }
 function importJSON(text,preview=false){
  if(typeof text!=='string'||text.length>5000000)throw Error('備份檔過大，請使用 5 MB 以內的筆記備份。');
  let doc;try{doc=JSON.parse(text.replace(/^\uFEFF/,''))}catch(_){throw Error('不是有效的 JSON 備份。')}
  if(!doc||doc.schema!==1||!Array.isArray(doc.records)||doc.records.length>10000)throw Error('不支援的筆記備份格式。');
  const ids=new Set(),validTime=v=>typeof v==='string'&&v.length<=40&&Number.isFinite(Date.parse(v));
  const incoming=doc.records.map(r=>{
   if(!r||typeof r.id!=='string'||!r.id||r.id.length>200||ids.has(r.id)||!validTime(r.createdAt)||!Array.isArray(r.versions)||!r.versions.length||r.versions.length>10000)throw Error('備份包含無效或重複的筆記。');
   ids.add(r.id);
   const versions=r.versions.map(v=>{if(!v||typeof v!=='object'||!validTime(v.savedAt))throw Error('備份的修改歷史格式不正確。');const n=validate(v);return {...n,savedAt:v.savedAt};});
   return {id:r.id,createdAt:r.createdAt,versions};
  });
  const records=load(),result={added:0,updated:0,skipped:0};
  const canonical=v=>JSON.stringify({...validate(v),savedAt:v.savedAt});
  for(const r of incoming){const existing=records.find(x=>x.id===r.id);
   if(!existing){records.push(r);result.added++;continue;}
   if(existing.createdAt!==r.createdAt||existing.versions.slice(0,Math.min(existing.versions.length,r.versions.length)).some((v,i)=>canonical(v)!==canonical(r.versions[i])))throw Error('同一筆記有不同修改歷史，匯入已停止以避免衝突；原資料沒有更動。');
   if(r.versions.length>existing.versions.length){existing.versions.push(...r.versions.slice(existing.versions.length));result.updated++;}else result.skipped++;
  }
  if(!preview&&(result.added||result.updated))storage.setItem(KEY,JSON.stringify({schema:1,records}));
  return result;
 }
 return {load,save,saveMany,importJSON,exportJSON:()=>storage.getItem(KEY)||JSON.stringify({schema:1,records:[]})};
}
const api={createStore,latest,perKg,sharePayload,validate,photoIds,photoKinds};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ShoppingNotes=api;
})(typeof window==='undefined'?globalThis:window);
