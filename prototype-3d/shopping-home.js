(()=>{
'use strict';
const F=window.ShoppingFlow,N=window.ShoppingNotes,$=id=>document.getElementById(id);
const account=location.pathname.startsWith('/app/');
let scope=null,records=[],data=null,plan=null;
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function notice(message){$('shoppingStatus').textContent=message;}
const money=n=>Number(n).toLocaleString('zh-TW',{maximumFractionDigits:1});
async function json(path){const r=await fetch('/api/v1/'+path,{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('採買紀錄暫時無法讀取，請重新登入或稍後再試。');return r.json();}
function clearPrivate(){records=[];plan=null;scope=null;document.querySelectorAll('.shopping-history').forEach(n=>n.textContent='私人採買紀錄已清除，請回採買帳本重新登入。');render();}
async function ensureAccount(){if(!account)return;let s;try{s=await json('auth/session/');}catch(e){clearPrivate();throw e;}if(!s.authenticated||scope!=='account-'+s.user.id){clearPrivate();throw Error('帳號狀態已變更，請回採買帳本登入。');}}
function matching(product){return data?Prices.pickVariety(data.items,product)||data.items.find(x=>x.name===product):null;}
function openProduct(product){const x=matching(product);if(x)PriceList.openDetail(x);else { $('foodSearch').value=product;$('foodSearch').dispatchEvent(new Event('input'));Drawer.set('full');notice('目前沒有這項商品的行情，仍可加入清單並記錄實際購買價格。');}}
async function add(product){try{await ready;await ensureAccount();if(!plan)throw Error('待買清單尚未就緒，請重新載入或登入後再試。');plan.add(product);render();notice(`已加入「${product}」，買完儲存筆記後會從清單移除。`);}catch(e){notice(e.message);}}
async function record(item,price='',quantity='',unit='台斤'){
 try{await ready;if(!scope)throw Error('採買紀錄尚未就緒，請重新載入或回採買帳本登入。');await ensureAccount();F.putDraft(sessionStorage,scope,F.draft(item,price,quantity,unit));const destination=new URL(account?'mobile-app.html?purchase=1':'notebook.html?purchase=1',location.href);window.top.location.href=destination.href;}catch(e){notice(e.message);const inline=$('quoteError');if(inline)inline.textContent=e.message;}
}
function render(){
 const list=$('shoppingList'),recent=$('shoppingFrequent'),deals=$('shoppingDeals');list.replaceChildren();recent.replaceChildren();deals.replaceChildren();
 let products=[];try{products=plan?plan.load():[];}catch(e){notice(e.message);}
 $('shoppingCount').textContent=`${products.length} 項`;
 if(!products.length)list.append(el('p',scope?'還沒決定買什麼？從常買食材或划算行情加一項。':'登入後可建立待買清單。','sub'));
 for(const product of products){const row=el('div',undefined,'shopping-row'),view=el('button',product,'shopping-product'),buy=el('button','買了，記一筆','shopping-button'),remove=el('button','移除','shopping-remove');view.onclick=()=>openProduct(product);buy.onclick=()=>record({name:product});remove.onclick=async()=>{try{await ensureAccount();if(!plan)throw Error('請重新登入。');plan.remove(product);render();notice(`已移除「${product}」。`);}catch(e){notice(e.message);}};remove.setAttribute('aria-label',`移除 ${product}`);row.append(view,buy,remove);list.append(row);}
 const frequent=F.frequent(records);
 if(!frequent.length)recent.append(el('p','留下第一筆採買後，這裡會記住你常買的食材。','sub'));
 for(const n of frequent){const box=el('div',undefined,'shopping-tile'),view=el('button',n.product,'shopping-product');view.onclick=()=>openProduct(n.product);box.append(view,el('small',`${n.date} · ${n.venue} · $${money(n.price)}${n.quantity?`／${n.quantity} ${n.unit}`:'（總價）'}`));const x=matching(n.product);if(x){const state=Prices.assess(x,F.today());box.append(el('small',`${x.date} 批發參考：${state.stale?'歷史報價':state.label}`));}else box.append(el('small','尚無對應行情，仍可記錄'));const b=el('button','＋ 加入清單','shopping-button');b.onclick=()=>add(n.product);box.append(b);recent.append(box);}
 const best=data?Prices.bestDeals(data.items,F.today(),{limit:3}):[];
 if(!best.length)deals.append(el('p',data?'目前沒有符合條件的新鮮行情推薦，可搜尋其他食材。':'正在讀取行情…','sub'));
 for(const x of best){const box=el('div',undefined,'shopping-tile'),view=el('button',x.name,'shopping-product');view.onclick=()=>PriceList.openDetail(x);const b=el('button','＋ 加入清單','shopping-button');b.onclick=()=>add(x.name);box.append(view,el('small',`${x.date} · 批發 $${money(x.price)}／公斤`),el('small',`比往年同期低 ${Math.round((1-x.price/x.baseline)*100)}%`),b);deals.append(box);}
}
function attachQuote(box,x,fields){
 const actions=el('div',undefined,'shopping-quote-actions'),addButton=el('button','＋ 加入待買清單','shopping-button'),save=el('button','買了，帶入採買筆記','shopping-primary');addButton.type=save.type='button';addButton.onclick=()=>add(x.name);save.onclick=()=>record(x,fields.price.value,fields.qty.value,fields.unit.value);actions.append(addButton,save);
 const history=el('p',undefined,'shopping-history');history.setAttribute('aria-live','polite');const err=el('p',undefined,'sub');err.id='quoteError';err.setAttribute('role','status');
 function update(){const n=F.lastPurchase(records,x.name);if(!n){history.textContent='尚無這項食材的購買紀錄。這次記下後，下次就有得比。';return;}
 const c=F.compare(n,{price:fields.price.value,quantity:fields.qty.value,unit:{'台斤':'台斤','公斤':'kg','公克':'g'}[fields.unit.value]});
 history.textContent=`你上次：${n.date} · ${n.venue} · $${money(n.price)}${n.quantity?`／${n.quantity} ${n.unit}`:'（總價）'}。${c?`換算每${c.unit}後，這次${c.percent===0?'與上次相同':`${c.percent>0?'高':'低'} ${money(Math.abs(c.percent))}%`}。`:'填入價格與重量後可比較；缺少重量或單位不同時不判斷漲跌。'}${n.spec?`上次規格：${n.spec}。`:''}${n.promo?`上次促銷：${n.promo}。`:''}請確認品種、品質與促銷條件是否相近。`;}
 Object.values(fields).forEach(f=>f.addEventListener('input',update));update();ready.then(update);box.append(history,actions,err);
}
const ready=(async()=>{try{
 if(account){const session=await json('auth/session/');if(!session.authenticated){notice('菜價不需登入；使用私人紀錄與清單前，請先回採買帳本登入。');render();return;}scope='account-'+session.user.id;let page=1,count=Infinity;while(records.length<count){const result=await json('notes/?page='+page++);if(!result.records.length)break;records.push(...result.records);count=result.count;}await ensureAccount();}
 else {scope='local';records=N.createStore(localStorage).load();}
 plan=F.createPlan(localStorage,scope);render();
 }catch(e){clearPrivate();notice(e.message);}})();
 $('shoppingAddForm').onsubmit=e=>{e.preventDefault();add($('shoppingProduct').value);$('shoppingProduct').value='';};
 const noteLink=$('shoppingNotebook');noteLink.href=account?'mobile-app.html':'notebook.html';noteLink.target='_top';noteLink.textContent=account?'開啟採買帳本 →':'開啟採買筆記 →';
 const navNote=document.querySelector('.bottom-nav a[href="notebook.html"]');navNote.href=noteLink.href;navNote.target='_top';
 document.addEventListener('prices:loaded',e=>{data=e.detail;render();});document.addEventListener('prices:error',()=>{data=null;render();$('shoppingDeals').replaceChildren(el('p','行情暫時無法讀取；仍可使用待買清單和筆記。','sub'));});
 window.addEventListener('storage',e=>{if(e.key===F.planKey(scope))render();else if(!account&&e.key==='veggie-shopping-notes-v1'){try{records=N.createStore(localStorage).load();render();}catch(e){notice(e.message);}}});
 window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
 if(account){const check=()=>{if(scope)ensureAccount().catch(e=>notice(e.message));};window.addEventListener('focus',check);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});}
 window.PriceShopping={attachQuote,ready};
})();
