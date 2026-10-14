/* Account-owned shopping list. Send individual idempotent operations, never overwrite a stale list. */
(function(root){
'use strict';
async function create({user,fetch:fetcher=root.fetch.bind(root),onChange=()=>{}}){
 if(!user?.id)throw Error('請先登入。');
 let items=[],invalid=false,queue=Promise.resolve();
 function accept(data){if(!Array.isArray(data.items)||data.items.length>100||data.items.some(x=>typeof x!=='string'||!x.trim()||x.length>200))throw Error('待買清單格式不正確。');items=[...data.items];onChange(store);return store.load()}
 async function request(options={}){
  if(invalid)throw Error('帳號已變更，請重新登入。');
  const response=await fetcher('/api/cloud/plan',{credentials:'same-origin',cache:'no-store',...options,headers:{'X-Sync-User':user.id,...options.headers}});
  if(response.status===401){invalid=true;items=[];onChange(store);throw Error('帳號已變更或登入已過期，請重新登入。')}
  if(!response.ok)throw Error('待買清單尚未同步，請稍後再試。');
  return accept(await response.json());
 }
 function enqueue(fn){const result=queue.then(fn);queue=result.catch(()=>{});return result}
 const store={mode:'cloud',load:()=>[...items],sync:()=>enqueue(()=>request()),add:product=>change('add',product),remove:product=>change('remove',product)};
 function change(action,product){return enqueue(()=>request({method:'PUT',headers:{'Content-Type':'application/json','X-Sync-Request':'1'},body:JSON.stringify({action,product})}))}
 await store.sync();return store;
}
const api={create};if(typeof module==='object')module.exports=api;else root.CloudPlan=api;
})(typeof window==='undefined'?globalThis:window);
