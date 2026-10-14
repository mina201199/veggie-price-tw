(function(root){
'use strict';
const UNITS=['g','kg','台斤','顆','包','盒','把'];
function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value}
function decimal(value,label,places=3){const s=String(value??'').trim();if(!/^\d+(\.\d+)?$/.test(s)||!Number.isFinite(Number(s))||Number(s)<=0||Number(s)>1000000||(s.split('.')[1]||'').length>places)throw Error(`${label}需大於 0，不超過 1,000,000，最多 ${places} 位小數。`);return s}
function purchase(input){
 const product=String(input.product||'').trim(),venue=String(input.venue||'').trim();
 if(!product||!venue)throw Error('請填商品名稱與購買地點。');
 if(!validDate(input.date))throw Error('請填有效的購買日期。');
 const p={product,venue,date:input.date,price:decimal(input.price,'總金額',2),quantity:null,unit:'',notes:String(input.notes||'').trim(),photo:input.photo||'',photoKind:input.photoKind||'',share:false};
 if(String(input.quantity??'').trim()){p.quantity=decimal(input.quantity,'數量');p.unit=input.unit;if(!UNITS.includes(p.unit))throw Error('請選擇數量單位。');}
 return p;
}
function money(value){return Number(value||0).toLocaleString('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:2});}
function createSessionGate(){let epoch=0;return {capture:()=>epoch,advance:()=>{epoch++;},isCurrent:value=>value===epoch};}
const api={createSessionGate,UNITS,today,validDate,decimal,purchase,money};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MobileCore=api;
})(typeof window==='undefined'?globalThis:window);
