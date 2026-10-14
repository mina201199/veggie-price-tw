(function(root){
'use strict';
async function load({fetch:fetcher=root.fetch.bind(root),backend=false}={}){
 async function read(url){const response=await fetcher(url,{cache:'no-store'});if(!response.ok)throw Error('行情暫時無法取得。');const data=await response.json();if(data.schema!==1||!Array.isArray(data.items)||!data.items.length)throw Error('行情格式無法讀取。');return data}
 if(backend)return read('/api/v1/prices/');
 try{return await read('/api/prices')}catch{return {...await read('prices-data.json'),sourceNotice:'更新服務暫時無法讀取，使用保存的行情快照；請確認交易日期。'}}
}
const api={load};if(typeof module==='object')module.exports=api;else root.PriceSource=api;
})(typeof window==='undefined'?globalThis:window);
