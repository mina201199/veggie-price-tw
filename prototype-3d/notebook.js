(()=>{
'use strict';
const N=window.ShoppingNotes,$=id=>document.getElementById(id),form=$('noteForm'),editor=$('noteEditor'),detail=$('noteDetail');
let records=[],editingId=null,dirty=false;
// Accessing storage can itself throw in restricted browsers; surface the error.
const storage={getItem:k=>window.localStorage.getItem(k),setItem:(k,v)=>window.localStorage.setItem(k,v)};
const store=N.createStore(storage);
function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
function error(target,message){target.textContent=message;target.hidden=!message}
function money(v){return Number(v).toLocaleString('zh-TW',{maximumFractionDigits:2})}
function unitText(n){const k=N.perKg(n);return k===null?'未提供重量，不換算公斤價':`約 ${money(k)} 元／公斤`}
function quantityText(n){return n.quantity==null||n.quantity===''?'未記重量／數量':`${n.quantity} ${n.unit}`}
function readInput(){const n=Object.fromEntries(new FormData(form));n.share=form.elements.share.checked;return n}
function refresh(){try{records=store.load();error($('storageError'),'');$('addNote').disabled=false;render();fillSuggestions()}catch(e){error($('storageError'),`無法讀取筆記：${e.message}`);$('addNote').disabled=true;}}
function fillSuggestions(){
 const recent=[...records].sort((a,b)=>N.latest(b).date.localeCompare(N.latest(a).date)||b.createdAt.localeCompare(a.createdAt));
 for(const [id,key,chips]of [['knownVenues','venue','venueChips'],['knownProducts','product','productChips']]){
  const values=[...new Set(recent.map(r=>N.latest(r)[key]))];
  if(key==='product'){const counts=new Map();for(const r of records){const name=N.latest(r).product;counts.set(name,(counts.get(name)||0)+1)}values.sort((a,b)=>counts.get(b)-counts.get(a));}
  $(id).replaceChildren();$(chips).replaceChildren();
  for(const v of values){const o=document.createElement('option');o.value=v;$(id).append(o);}
  for(const v of values.slice(0,5)){const b=el('button',v,'chip');b.type='button';b.onclick=()=>{form.elements[key].value=v;dirty=true;updatePreviews()};$(chips).append(b);}
  $(chips).hidden=!values.length;
 }
 const seen=new Set(),list=$('repeatList');list.replaceChildren();
 for(const r of recent){const n=N.latest(r),key=JSON.stringify([n.venue,n.product,n.brand,n.spec]);if(seen.has(key))continue;seen.add(key);const b=el('button',undefined,'repeat-card');b.type='button';b.append(el('b',n.product),el('small',`${n.venue} · 上次 $${money(n.price)}`),el('span','再買一次 ＋'));b.onclick=()=>openEditor(r,true);list.append(b);if(seen.size===4)break;}
 $('quickRepeat').hidden=!recent.length;
}
function render(){
 const q=$('searchNotes').value.trim().toLocaleLowerCase(),list=$('noteList');list.replaceChildren();
 const matched=records.filter(r=>{const n=N.latest(r);return ['venue','product','brand','origin','spec','promo','freshness','taste','service','notes','date'].some(k=>String(n[k]||'').toLocaleLowerCase().includes(q))}).sort((a,b)=>N.latest(b).date.localeCompare(N.latest(a).date)||b.createdAt.localeCompare(a.createdAt));
 $('noteCount').textContent=`${matched.length} / ${records.length} 筆`;
 if(!matched.length){const box=el('div',undefined,'empty');box.append(el('b',q?'沒有符合的筆記':'你的第一筆採買，從這裡開始'),el('p',q?'試試其他品牌、商品或分店名稱。':'不用玩遊戲，也不用分享。\n記下今天買了什麼，留給下次的自己。'));list.append(box);return}
 for(const r of matched){const n=N.latest(r),card=el('button',undefined,'note-card');card.type='button';card.setAttribute('aria-label',`查看 ${n.product}，${n.venue}，${n.date}`);
  card.append(el('div',`${n.date} · ${n.venue}`,'meta'));const row=el('div',undefined,'row'),left=el('div');left.append(el('h3',n.product),el('p',[n.brand,n.spec].filter(Boolean).join(' · ')||'私人採買紀錄'));row.append(left,el('b',`$${money(n.price)}`,'price'));card.append(row,el('p',`${quantityText(n)} · ${unitText(n)}`));
  if(n.experience)card.append(el('span',`購買經驗：${n.experience}`,'tag'));
  if(n.repurchase)card.append(el('span',n.repurchase,'tag'));card.append(el('span','私人','tag'));if(r.versions.length>1)card.append(el('span',`${r.versions.length} 個版本`,'tag'));if(n.share)card.append(el('span','願分享價格・尚未送出','tag'));card.onclick=()=>showDetail(r.id);list.append(card);
 }
}
function openEditor(record,repeat=false){
 editingId=record&&!repeat?record.id:null;form.reset();error($('formError'),'');
 form.querySelectorAll('details').forEach(d=>d.open=false);
 if(record){const n=N.latest(record);for(const [key,val]of Object.entries(n)){const field=form.elements.namedItem(key);if(field){if(field.type==='checkbox')field.checked=val===true;else field.value=val??''}}}
 if(!record||repeat){form.elements.date.value=today();if(!record)form.elements.unit.value='g';form.elements.share.checked=false;}
 if(repeat)for(const key of ['price','promo','freshness','taste','service','notes','repurchase','experience'])form.elements[key].value='';
 if(!form.elements.unit.value)form.elements.unit.value='g';
 $('lastPriceHint').hidden=!repeat;
 $('lastPriceHint').textContent=repeat?`上次 $${money(N.latest(record).price)}，請輸入這次價格。${N.latest(record).quantity?'已沿用上次重量／規格，若不同請展開修改。':''}`:'';
 $('editorTitle').textContent=editingId?'修正紀錄・保留舊版本':repeat?'再買一次・新增紀錄':'新增採買筆記';
 dirty=false;updatePreviews();editor.showModal();
}
function requestClose(){if(dirty&&!window.confirm('尚未儲存的內容會放棄，要關閉嗎？'))return;editor.close();dirty=false;}
function updatePreviews(){
 const n=readInput();const price=Number(n.price),qty=Number(n.quantity);
 form.querySelectorAll('[data-experience]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.experience===n.experience)));
 $('dateLabel').textContent=n.date===today()?'今天':n.date||'請選擇日期';
 $('unitPreview').textContent=price>0&&qty>0?unitText({...n,price,quantity:qty}):'重量已知才換算每公斤；不猜測一包或一顆有多重。';
 const box=$('sharePreview');box.hidden=!n.share;box.replaceChildren();if(n.share){box.append(el('b','未來可分享的欄位預覽'));try{const p=N.sharePayload(N.validate(n));box.append(el('p',p?`${p.venue}｜${p.product}｜${p.brand||'無品牌'}｜${p.date}\n${p.price} 元／${p.quantity} ${p.unit}\n${[p.origin,p.spec,p.promo].filter(Boolean).join(' · ')}`:'可以先存私人筆記；未來分享可比價資料前需補重量／數量與單位。'))}catch(_){box.append(el('p','填妥地點、商品、日期與價格後可預覽。'))}box.append(el('p','僅記錄意願：不含新鮮度、口感、服務、回購意願與私人備註。'))}
}
function appendData(parent,n){const dl=el('dl',undefined,'detail-data');const pairs=[['分店／攤位',n.venue],['商品',n.product],['品牌',n.brand||'未填'],['產地／規格',[n.origin,n.spec].filter(Boolean).join(' · ')||'未填'],['購買／觀測日',n.date],['價格',`${money(n.price)} 元 · ${quantityText(n)}`],['重量換算',unitText(n)],['促銷條件',n.promo||'未記錄'],['新鮮度感受',n.freshness||'未評價'],['口感',n.taste||'未記錄'],['服務',n.service||'未記錄'],['回購',n.repurchase||'還沒決定'],['私人備註',n.notes||'未記錄'],['分享狀態',n.share?'願意分享價格；僅存本機，未送出':'私人；不分享']];for(const [label,value]of pairs)dl.append(el('dt',label),el('dd',value));parent.append(dl)}
function showDetail(id){const r=records.find(v=>v.id===id);if(!r)return;const n=N.latest(r),content=$('detailContent');content.replaceChildren();$('detailTitle').textContent=n.product;content.append(el('p',`購買經驗：${n.experience||'尚未評價'}`));appendData(content,n);
 const actions=el('div',undefined,'detail-actions'),edit=el('button','修正這筆','secondary'),repeat=el('button','再買一次','primary');edit.onclick=()=>{detail.close();openEditor(r)};repeat.onclick=()=>{detail.close();openEditor(r,true)};actions.append(edit,repeat);content.append(actions,el('h3','修訂歷史'),el('p','修正不會覆蓋舊版本；新的購買請使用「再買一次」。','history-note'));
 r.versions.slice().reverse().forEach((v,i)=>{const version=el('details',undefined,'revision');version.append(el('summary',`版本 ${r.versions.length-i}${i===0?' · 目前版本':''}｜${new Date(v.savedAt).toLocaleString('zh-TW')}`),el('p',`購買經驗：${v.experience||'尚未評價'}`));appendData(version,v);content.append(version)});detail.showModal();
}
$('addNote').onclick=()=>openEditor();$('closeEditor').onclick=requestClose;editor.addEventListener('cancel',e=>{e.preventDefault();requestClose()});$('closeDetail').onclick=()=>detail.close();
form.addEventListener('input',()=>{dirty=true;updatePreviews()});form.addEventListener('change',()=>{dirty=true;updatePreviews()});
 form.querySelectorAll('[data-experience]').forEach(b=>b.onclick=()=>{const f=form.elements.experience;f.value=f.value===b.dataset.experience?'':b.dataset.experience;dirty=true;updatePreviews();});
form.addEventListener('invalid',e=>{let parent=e.target.parentElement;while(parent&&parent!==form){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}},true);
form.onsubmit=e=>{e.preventDefault();try{store.save(readInput(),editingId);dirty=false;editor.close();refresh();$('noteStatus').textContent=editingId?'已儲存修正，舊版本完整保留。':'私人筆記已儲存在這台裝置。未傳送任何資料。'}catch(e){error($('formError'),`未儲存：${e.message}。請檢查內容或瀏覽器儲存空間；表單內容已保留。`)}};
$('searchNotes').oninput=render;
$('exportNotes').onclick=()=>{try{const blob=new Blob([store.exportJSON()],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=`shopping-notes-${today()}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);$('noteStatus').textContent='已要求下載完整備份，內含私人心得與所有版本，請妥善保管。'}catch(e){error($('storageError'),`匯出失敗：${e.message}`)}};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});window.addEventListener('storage',e=>{if(e.key==='veggie-shopping-notes-v1')refresh()});refresh();
})();
