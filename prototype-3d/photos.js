/* Receipt and price-tag photos for 採買筆記. A photo is shrunk on this device (long edge 1568 px, the size an image
   model reads without resizing) and kept in this browser's IndexedDB; notes store only its id. Nothing is uploaded.
   Backups carry photos as data URLs so they move with the notes. */
(function(root){
'use strict';
const DB='veggie-shopping-photos',STORE='photos',MAX_EDGE=1568,QUALITY=.82,MAX_INPUT=40e6,MAX_STORED=6e6;
const KINDS=['收據','標價','其他'],ID=/^[A-Za-z0-9-]{8,64}$/;
let dbPromise=null;const urls=new Map();
function open(){
 if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
  if(typeof indexedDB==='undefined'){reject(Error('這個瀏覽器不支援本機照片儲存。'));return}
  const req=indexedDB.open(DB,1);
  req.onupgradeneeded=()=>req.result.createObjectStore(STORE,{keyPath:'id'});
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error('無法開啟照片儲存區。'));
 }).catch(e=>{dbPromise=null;throw e});
 return dbPromise;
}
// Run one request in its own transaction; resolve once the transaction commits.
function run(mode,fn){
 return open().then(db=>new Promise((resolve,reject)=>{
  const t=db.transaction(STORE,mode),req=fn(t.objectStore(STORE));
  t.oncomplete=()=>resolve(req?req.result:undefined);
  t.onerror=t.onabort=()=>reject(t.error||Error('照片儲存失敗，可能是瀏覽器空間不足。'));
 }));
}
const newId=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
// Decode with EXIF orientation applied, scale the long edge down to MAX_EDGE, re-encode as JPEG.
async function shrink(file){
 if(!file||!/^image\//.test(file.type||''))throw Error('請選擇照片檔（JPG、PNG、HEIC 等圖片）。');
 if(file.size>MAX_INPUT)throw Error('照片太大，請選擇 40 MB 以內的照片。');
 let img;
 try{img=await createImageBitmap(file,{imageOrientation:'from-image'})}
 catch(_){throw Error('這張照片無法讀取，可能是瀏覽器不支援這種格式。請改用 JPG 或 PNG。')}
 const k=Math.min(1,MAX_EDGE/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*k)),h=Math.max(1,Math.round(img.height*k));
 const c=document.createElement('canvas');c.width=w;c.height=h;
 c.getContext('2d').drawImage(img,0,0,w,h);img.close?.();
 const blob=await new Promise(res=>c.toBlob(res,'image/jpeg',QUALITY));
 if(!blob)throw Error('照片處理失敗，請再試一次。');
 return {blob,width:w,height:h};
}
// Prepare a photo for saving: shrunk and previewable, but not stored until save() so a cancelled entry leaves nothing behind.
async function prepare(file,kind){
 const s=await shrink(file);
 return {id:newId(),kind:KINDS.includes(kind)?kind:'其他',createdAt:new Date().toISOString(),type:'image/jpeg',width:s.width,height:s.height,bytes:s.blob.size,blob:s.blob};
}
const save=rec=>run('readwrite',s=>s.put(rec));
const get=id=>ID.test(id||'')?run('readonly',s=>s.get(id)):Promise.resolve(undefined);
const remove=id=>{const u=urls.get(id);if(u){URL.revokeObjectURL(u);urls.delete(id)}return run('readwrite',s=>s.delete(id))};
// An object URL for showing a stored photo (cached per id); null when this device does not have it.
async function url(id){
 if(urls.has(id))return urls.get(id);
 const rec=await get(id);if(!rec)return null;
 const u=URL.createObjectURL(rec.blob);urls.set(id,u);return u;
}
const toDataURL=blob=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(blob)});
// For backups: the given photos as plain objects with data URLs. Ids this device does not have are skipped.
async function exportFor(ids){
 const out=[];
 for(const id of new Set(ids)){const rec=await get(id);if(rec)out.push({id:rec.id,kind:rec.kind,createdAt:rec.createdAt,type:rec.type,width:rec.width,height:rec.height,data:await toDataURL(rec.blob)})}
 return out;
}
// Check backup photo entries without writing anything; throws on the first bad one.
function check(list){
 if(list==null)return [];
 if(!Array.isArray(list)||list.length>5000)throw Error('備份裡的照片清單格式不正確。');
 const seen=new Set();
 return list.map(p=>{
  if(!p||!ID.test(p.id||'')||seen.has(p.id))throw Error('備份裡有無效或重複的照片。');
  seen.add(p.id);
  const m=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(p.data||'');
  if(!m||m[2].length*.75>MAX_STORED)throw Error('備份裡有無法讀取或過大的照片。');
  return {id:p.id,kind:KINDS.includes(p.kind)?p.kind:'其他',createdAt:typeof p.createdAt==='string'?p.createdAt.slice(0,40):new Date().toISOString(),type:'image/'+m[1],width:Number(p.width)||0,height:Number(p.height)||0,data:p.data};
 });
}
// Restore checked backup photos; photos already on this device (same id) are kept as they are.
async function importChecked(list){
 let added=0;
 for(const p of list){
  if(await get(p.id))continue;
  const bin=atob(p.data.split(',')[1]),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  const blob=new Blob([bytes],{type:p.type});
  await save({id:p.id,kind:p.kind,createdAt:p.createdAt,type:p.type,width:p.width,height:p.height,bytes:blob.size,blob});added++;
 }
 return added;
}
root.NotePhotos={KINDS,prepare,save,get,remove,url,exportFor,check,importChecked,isId:id=>ID.test(id||'')};
})(typeof window==='undefined'?globalThis:window);
