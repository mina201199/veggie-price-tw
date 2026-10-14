'use strict';
const $=id=>document.getElementById(id);
let dataset=null,category='全部',limit=24,mode=null;// mode: a fixed list such as today's best deals, instead of search results
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const money=n=>Number.isFinite(n)?n.toFixed(1):'—';
const delta=(a,b)=>`${a>=b?'高':'低'} ${Math.abs((a/b-1)*100).toFixed(0)}%`;
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function icon(x){if(/甘藍|包心|白菜|萵苣/.test(x.official))return '🥬';if(/番茄/.test(x.official))return '🍅';if(/胡蘿蔔/.test(x.official))return '🥕';if(/香蕉/.test(x.official))return '🍌';if(/茄子/.test(x.official))return '🍆';if(/玉米/.test(x.official))return '🌽';return {'葉菜':'🥬','辛香':'🧄','瓜果豆':'🥒','根莖':'🥔','菇類':'🍄','水果':'🍊'}[x.category]||'🌱';}
function render(){
  if(!dataset)return;
  const results=mode?mode.items:Prices.sortPrices(Prices.search(dataset.items,$('foodSearch').value,category),$('priceSort').value,today());
  $('count').textContent=mode?`${results.length} 種`:`${results.length} 個品項／品種`;
  if($('listTitle'))$('listTitle').textContent=mode?mode.title:'今日菜價';
  $('cards').replaceChildren();
  if(mode){const back=el('button','← 回到全部菜價','back-all');back.type='button';back.addEventListener('click',showAll);$('cards').append(back);if(!results.length)$('cards').append(el('p',mode.empty,'empty'));}
  else if(!results.length){$('cards').append(el('p','找不到這個食材，試試其他名稱或切換「全部」。目前只收錄蔬菜水果，沒有肉品或海鮮行情。','empty'));}
  for(const x of results.slice(0,limit)){
    const state=Prices.assess(x,today()),card=el('button',undefined,'card');card.type='button';
    card.setAttribute('aria-label',`${x.name}，${x.official}，${x.price}元每公斤，${state.label}，查看詳情`);
    const emoji=el('span',icon(x),'food-icon');emoji.setAttribute('aria-hidden','true');
    const when=mode&&state.ratio!==null?`比往年同期低 ${Math.round((1-state.ratio)*100)}%`:`${x.date} · ${state.stale?'歷史報價':'最新交易日'}`;
    const copy=el('div');copy.append(el('h3',x.name),el('small',x.official),el('small',when));
    const quote=el('div',undefined,'quote');quote.append(el('strong',`$${money(x.price)}`),el('div','元／公斤','unit'),el('span',state.label,`badge ${state.tone}`));
    card.append(emoji,copy,quote);card.addEventListener('click',()=>openDetail(x));$('cards').append(card);
  }
  $('more').hidden=results.length<=limit;
}
function chart(x){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 440 170');svg.classList.add('chart');svg.setAttribute('role','img');svg.setAttribute('aria-label',`${x.official}最近30日交易價走勢；無交易的日期不補價，詳細數字見下方表格。`);
  const series=x.series,lo=Math.min(...series.map(p=>p.price)),hi=Math.max(...series.map(p=>p.price)),end=Date.parse(x.date),start=end-29*86400000;
  const xpos=d=>48+(Date.parse(d)-start)/(29*86400000)*374,ypos=v=>125-(v-lo)/(hi-lo||1)*96;
  function add(tag,attrs,text){const node=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))node.setAttribute(k,v);if(text)node.textContent=text;svg.append(node);}
  for(const [y,value]of [[29,hi],[125,lo]]){add('line',{x1:48,x2:422,y1:y,y2:y,stroke:'#dce5d0','stroke-dasharray':'4 5'});add('text',{x:3,y:y+4},money(value));}
  // Connecting lines represent consecutive observations, not invented prices on missing dates.
  add('polyline',{points:series.map(p=>`${xpos(p.date)},${ypos(p.price)}`).join(' '),fill:'none',stroke:'#5b8150','stroke-width':2.5});
  for(const p of series)add('circle',{cx:xpos(p.date),cy:ypos(p.price),r:3,fill:'#5b8150'});
  add('text',{x:48,y:155},new Date(start).toISOString().slice(5,10));add('text',{x:422,y:155,'text-anchor':'end'},x.date.slice(5));return svg;
}
function openDetail(x){
  const body=$('detailBody'),state=Prices.assess(x,today());body.replaceChildren();
  const title=el('h2',`${icon(x)} ${x.name}`);title.id='detailTitle';
  body.append(title,el('p',`${x.official} · 作物代號 ${x.id.split('|')[1]}`,'sub'),el('span',state.label,`badge ${state.tone}`));
  const price=el('div',`$${money(x.price)} `,'detail-price');price.append(el('small','元／公斤'));body.append(price,el('p',`交易日期 ${x.date} · 當日加權均價${state.stale?'（歷史報價）':''}`,'sub'));
  let text=state.stale?'超過 7 天沒有較新交易紀錄，這筆價格只供歷史參考，暫不判斷現在貴不貴。':state.ratio===null?'往年同期的可用紀錄不足，暫不判斷貴不貴。':`這個品種的最新批發均價，比往年同期中位數${delta(x.price,x.baseline)}，屬於「${state.label}」。`;
  if(!state.stale&&x.recent>0)text+=` 相較此交易日前 7 天的交易量加權均價${delta(x.price,x.recent)}。`;
  body.append(el('p',text,'analysis'),stallSection(x,state));
  const stats=el('div',undefined,'stats');
  for(const [label,value,note]of [['往年同期中位數',x.baseline,`${x.historyCount} 個日紀錄 · ${x.historyYears} 年`],['交易日前 7 天均價',x.recent,`${x.recentCount} 個交易日 · 不含當日`]]){const s=el('div',label);s.append(el('b',value===null?'資料不足':`$${money(value)}`),el('span',note));stats.append(s);}
  body.append(stats,el('h3','最近 30 日交易價 · 元／公斤','chart-heading'),chart(x),el('p','每個點代表有交易紀錄的日期；連線不代表中間日期有報價。','sub'));
  const tableDetails=el('details'),table=el('table'),head=el('thead'),headrow=el('tr');headrow.append(el('th','交易日期'),el('th','元／公斤'));head.append(headrow);table.append(head);const tbody=el('tbody');for(const p of [...x.series].reverse()){const row=el('tr');row.append(el('td',p.date),el('td',money(p.price)));tbody.append(row);}table.append(tbody);tableDetails.append(el('summary','查看每日數值'),table);body.append(tableDetails,el('p',`${dataset.scope}。每日市場回報組合可能不同，僅供行情參考，不代表任何攤商的實際售價。`,'sub'));
  $('detail').showModal();$('detail').scrollTop=0;
  document.dispatchEvent(new CustomEvent('prices:open',{detail:x}));
}
// 攤販賣多少：輸入攤販開的價格和重量，跟一般零售範圍（以常用名計，tools/build.py 估的）比。只在本機計算。
const ym=s=>`${s.slice(0,4)}/${+s.slice(5,7)}`;
function stallSection(x,state){
  const box=el('section',undefined,'stall'),re=dataset.retail&&dataset.retail[x.name];
  box.append(el('h3','攤販賣多少？幫你看合不合理'));
  if(!re){box.append(el('p','沒有這項食材的零售估計，仍可對照自己的購買紀錄。','sub'));}
  const row=el('div',undefined,'stall-row'),price=document.createElement('input'),qty=document.createElement('input'),unit=document.createElement('select');
  Object.assign(price,{type:'number',min:'0',step:'1',inputMode:'decimal',placeholder:'例如 60'});Object.assign(qty,{type:'number',min:'0',step:'0.1',inputMode:'decimal',value:'1'});
  for(const u of ['台斤','公斤','公克'])unit.append(new Option(u,u));
  price.setAttribute('aria-label','攤販開的價格（元）');qty.setAttribute('aria-label','重量');unit.setAttribute('aria-label','重量單位');
  const lp=el('label','價格 '),lq=el('label','重量 ');lp.append(price,document.createTextNode(' 元'));lq.append(qty,unit);row.append(lp,lq);
  const out=el('div',undefined,'stall-out');out.setAttribute('aria-live','polite');
  const range=re?`一般零售大約 ${Math.round(re.lo)}–${Math.round(re.hi)} 元／台斤（約 ${Math.round(re.lo/.6)}–${Math.round(re.hi/.6)} 元／公斤）`:'';
  function update(){
    out.replaceChildren();
    if(!re||state.stale){out.className='stall-out';out.append(el('span',state.stale?'行情超過 7 天未更新，暫不判斷現在的零售價格；可對照自己的上次採買。':'尚無零售估計，請對照自己的上次採買。'));return;}
    const pJin=Prices.perJin(Number(price.value),Number(qty.value),unit.value);
    if(pJin===null){out.className='stall-out';out.append(el('span',`行情參考：${range}。`));return;}
    const v=Prices.judgeStall(re,pJin,state.tone);
    out.className=`stall-out s-${v.tone}`;
    out.append(el('span',v.label,'stall-pill'),el('span',`你看到的是約 ${Math.round(pJin)} 元／台斤，${v.text}。`),el('small',`${range}。${v.note}`));
  }
  for(const i of [price,qty,unit])i.addEventListener('input',update);
  update();
  box.append(row,out);
  window.PriceShopping?.attachQuote(box,x,{price,qty,unit});
  if(!re)return box;
  const src=dataset.retailSource,how=re.src==='item'?`依臺北市公有零售市場 ${ym(src.from)}–${ym(src.to)} 共 ${re.months} 個月的零售價，對照同月批發價推算，平均誤差約 ±${Math.round(re.err*100)}%。`
    :re.src==='twin'?`臺北市零售行情沒有分進口，這裡借用國產${re.twin}的零售和批發關係推算，參考就好。`
    :'臺北市零售行情沒有這一項，用同類菜的平均加價倍數估計，範圍放得比較寬，參考就好。';
  box.append(el('p',`以「${x.name}」所有品種合計的近 14 天批發價估計。${how}一般零售範圍只是參考，不代表任何攤商的實際售價。`,'sub'));
  return box;
}
function showDeals(items,title,empty){mode={items,title,empty};limit=24;render();}
function showAll(){mode=null;limit=24;render();}
async function load(){
  $('error').hidden=true;$('cards').setAttribute('aria-busy','true');$('cards').replaceChildren(el('p','正在讀取行情…'));$('more').hidden=true;
  try{
    const data=await PriceSource.load({backend:location.pathname.startsWith('/app/')});if(data.schema!==1||!Array.isArray(data.items))throw new Error('Invalid data');dataset=data;
    $('dataDate').textContent=data.latest?(data.latest===today()?`今日已有交易資料：${data.latest}`:`最新可用行情：${data.latest}（非今日）`):'目前沒有可用行情';
    $('dataScope').textContent=`${data.source} · 新臺幣／公斤`;
    $('generated').textContent=`${data.sourceNotice?data.sourceNotice+' ':''}${data.scope}。快照產生：${new Date(data.generatedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})}（臺灣時間）`;
    render();
    document.dispatchEvent(new CustomEvent('prices:loaded',{detail:data}));
  }catch(e){dataset=null;$('error').hidden=false;$('dataDate').textContent='尚無法取得行情';$('cards').replaceChildren();$('count').textContent='';document.dispatchEvent(new CustomEvent('prices:error'));}
  finally{$('cards').setAttribute('aria-busy','false');}
}
$('foodSearch').addEventListener('input',()=>{mode=null;limit=24;render();});
$('priceSort').addEventListener('change',()=>{mode=null;limit=24;render();});
$('clearSearch').addEventListener('click',()=>{$('foodSearch').value='';mode=null;limit=24;render();$('foodSearch').focus();});
document.querySelectorAll('[data-search]').forEach(b=>b.addEventListener('click',()=>{$('foodSearch').value=b.dataset.search;setCategory('全部');}));
function setCategory(value){category=value;mode=null;limit=24;document.querySelectorAll('.filters button').forEach(b=>{b.classList.toggle('selected',b.textContent===category);b.setAttribute('aria-pressed',String(b.textContent===category));});render();}
document.querySelectorAll('.filters button').forEach(b=>b.addEventListener('click',()=>setCategory(b.textContent)));
$('more').addEventListener('click',()=>{limit+=24;render();});$('retry').addEventListener('click',load);$('closeDetail').addEventListener('click',()=>$('detail').close());
// For pages that wrap this list (the cat guide home): it listens for prices:loaded / prices:error / prices:open.
window.PriceList={today,data:()=>dataset,showDeals,showAll,openDetail};
load();
