/* Account-owned notes. Local browser notes are only imported after an explicit action. */
(function(root){
'use strict';
const empty=()=>({schema:1,records:[]}),copy=x=>JSON.parse(JSON.stringify(x));
function memory(doc=empty()){let raw=JSON.stringify(doc);return {getItem:()=>raw,setItem:(_,v)=>{raw=v}}}
async function createStore(options={}){
 const N=options.notes||root.ShoppingNotes,fetcher=options.fetch||root.fetch.bind(root),storage=options.storage||root.localStorage,local=N.createStore(storage);
 let expectedUser=null;
 const request=(path,o={})=>fetcher('/api/cloud/'+path,{credentials:'same-origin',cache:'no-store',...o,headers:{...(expectedUser?{'X-Sync-User':expectedUser}:{}),...o.headers}});
 const session=await request('session');
 if(session.status===404)return {...local,mode:'local',user:null,ready:Promise.resolve(),sync:async()=>{},photos:options.photos||root.NotePhotos};
 if(session.status===401)throw Error('請登入後再使用帳號筆記。');
 if(!session.ok)throw Error('無法連線到帳號服務，請稍後再試。');
 const {user}=await session.json();if(!user?.id)throw Error('請登入後再使用帳號筆記。');expectedUser=user.id;
 let document=empty(),version=0,invalid=false,queue=Promise.resolve(),pendingDocument=null,pendingOperation=null;
 const P=options.photos||root.NotePhotos,uploaded=new Set(),photoCache=new Map();
 function changed(){options.onChange?.(store);if(root.dispatchEvent&&root.CustomEvent)root.dispatchEvent(new root.CustomEvent('cloudnotes:changed',{detail:{store}}))}
 function status(message){options.onStatus?.(message,store)}
 function validateDocument(doc){const s=N.createStore(memory());s.importJSON(JSON.stringify(doc));return JSON.parse(s.exportJSON())}
 function accept(data){if(!Number.isInteger(data.version)||data.version<0)throw Error('雲端版本格式不正確。');document=validateDocument(data.document);version=data.version;changed()}
 function clear(){invalid=true;document=empty();pendingDocument=null;pendingOperation=null;uploaded.clear();for(const p of photoCache.values())if(p.url)URL.revokeObjectURL(p.url);photoCache.clear();changed()}
 async function checkAccount(){if(invalid)throw Error('帳號已變更，請重新整理後登入。');const r=await request('session');if(r.status===401){clear();throw Error('登入已過期，請重新登入。')}if(!r.ok)throw Error('帳號服務暫時無法使用。');const current=await r.json();if(current.user?.id!==user.id){clear();throw Error('帳號已變更，請重新整理。')}}
 function enqueue(fn){const p=queue.then(fn);queue=p.catch(()=>{});return p}
 async function syncNow(){await checkAccount();const r=await request('notes');if(!r.ok)throw Error('筆記同步失敗，請稍後再試。');const data=await r.json();await checkAccount();accept(data);status('已同步');}
 async function uploadPhotos(doc){if(!P)return;for(const id of N.photoIds(doc.records)){if(uploaded.has(id))continue;const rec=await P.get(id);if(!rec)continue;const r=await request('photos/'+encodeURIComponent(id),{method:'PUT',headers:{'X-Sync-Request':'1','Content-Type':rec.blob.type||rec.type||'image/jpeg','X-Photo-Kind':encodeURIComponent(rec.kind||'其他'),'X-Photo-Created-At':rec.createdAt||new Date().toISOString(),'X-Photo-Width':String(rec.width||0),'X-Photo-Height':String(rec.height||0)},body:rec.blob});if(!r.ok)throw Error('照片同步失敗，筆記尚未儲存。');uploaded.add(id)}}
 async function mutate(method,args,snapshot){return enqueue(async()=>{await checkAccount();const signature=JSON.stringify([method,args]);if(snapshot&&pendingOperation?.signature!==signature){const current=document.records.find(r=>r.id===snapshot.id);if(!current||JSON.stringify(current.versions)!==JSON.stringify(snapshot.versions))throw Error('這筆筆記已在另一台裝置修正，發生衝突。請查看最新歷史後再修改。')}
  let result,candidate;
  if(pendingOperation?.signature===signature){result=pendingOperation.result;candidate=copy(pendingDocument)}else{const temp=N.createStore(memory(document));result=temp[method](...args);candidate=JSON.parse(temp.exportJSON());pendingOperation={signature,result:copy(result),baseVersion:version}}
  let writeVersion=pendingOperation.baseVersion;
  pendingDocument=copy(candidate);status('正在同步…');await uploadPhotos(candidate);
  for(let attempt=0;attempt<4;attempt++){
   const r=await request('notes',{method:'PUT',headers:{'Content-Type':'application/json','X-Sync-Request':'1'},body:JSON.stringify({expectedVersion:writeVersion,document:candidate})});
   if(r.status===401){clear();throw Error('登入已過期，請重新登入。')}
   const data=r.status===409||r.ok?await r.json():null;
   if(r.status===409){await checkAccount();const latest=validateDocument(data.document),merged=N.createStore(memory(latest));try{merged.importJSON(JSON.stringify(candidate))}catch(_){accept(data);throw Error('這筆筆記在另一台裝置有不同修正，發生衝突。內容已保留；請先查看最新歷史再決定修正。')}writeVersion=data.version;pendingOperation.baseVersion=writeVersion;candidate=JSON.parse(merged.exportJSON());pendingDocument=copy(candidate);continue}
   if(!r.ok)throw Error('同步未完成，內容已保留，請再試一次。');await checkAccount();accept(data);pendingDocument=null;pendingOperation=null;status('已同步');return result;
  }throw Error('同步衝突持續發生，內容已保留，請稍後再試。');
 })}
 // Cloud photos use account-scoped memory; never trust an unscoped local cache when reading cloud notes.
 async function getPhoto(id){await checkAccount();if(photoCache.has(id))return photoCache.get(id);const r=await request('photos/'+encodeURIComponent(id));if(r.status===404)return null;if(!r.ok)throw Error('照片讀取失敗，請重新登入或稍後再試。');const blob=await r.blob();await checkAccount();let kind='其他';try{kind=decodeURIComponent(r.headers.get('X-Photo-Kind')||'')||kind}catch{}const rec={id,blob,type:blob.type,kind,createdAt:r.headers.get('X-Photo-Created-At')||new Date().toISOString(),width:Number(r.headers.get('X-Photo-Width'))||0,height:Number(r.headers.get('X-Photo-Height'))||0};photoCache.set(id,rec);return rec}
 const photos=P?{...P,get:getPhoto,url:async id=>{const p=await getPhoto(id);if(!p)return null;if(!p.url)p.url=URL.createObjectURL(p.blob);return p.url},exportFor:async ids=>{const out=[];for(const id of ids){const p=await getPhoto(id);if(!p)throw Error('備份不完整：無法找到引用的私人照片 '+id+'，請先確認照片。');const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(p.blob)});const {blob,url,...meta}=p;out.push({...meta,data})}return out}}:null;
 const store={mode:'cloud',user,load:()=>copy(document.records),exportJSON:()=>JSON.stringify(document),save:(input,id,snapshot)=>mutate('save',[input,id],snapshot),saveMany:(...a)=>mutate('saveMany',a),importJSON:(text,preview=false)=>preview?N.createStore(memory(document)).importJSON(text,true):mutate('importJSON',[text]),importLocal:()=>mutate('importJSON',[local.exportJSON()]),sync:()=>enqueue(syncNow),photos,get pendingDocument(){return pendingDocument&&copy(pendingDocument)},ready:Promise.resolve()};
 await syncNow();return store;
}
function watch(store,onError=()=>{}){if(store.mode!=='cloud')return ()=>{};let active=root.MarketViewActive!==false;const refresh=()=>{if(active&&!root.document?.hidden)store.sync().catch(onError)},view=e=>{active=!!e.detail.active;if(active)refresh()};root.addEventListener('focus',refresh);root.addEventListener('market:visibility',view);root.document.addEventListener('visibilitychange',refresh);const timer=root.setInterval(refresh,30000);return ()=>{root.clearInterval(timer);root.removeEventListener('focus',refresh);root.removeEventListener('market:visibility',view);root.document.removeEventListener('visibilitychange',refresh)}}
const api={createStore,init:createStore,ready:createStore,watch};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CloudNotes=api;
})(typeof window==='undefined'?globalThis:window);
