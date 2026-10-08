(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.Prices=api;})(typeof window==='object'?window:this,function(){
  'use strict';
  const DAY=86400000;
  const aliases={'甘藍':'高麗菜','包心白菜':'大白菜','包心白':'大白菜','青江白菜':'青江菜','蕹菜':'空心菜','甘薯葉':'地瓜葉','芫荽':'香菜','青花苔':'青花菜 綠花椰菜','胡瓜':'大黃瓜','花胡瓜':'小黃瓜','敏豆':'四季豆','扁蒲':'蒲瓜 瓠瓜','蘿蔔':'白蘿蔔','胡蘿蔔':'紅蘿蔔','甘薯':'地瓜','芋':'芋頭','金絲菇':'金針菇','濕香菇':'香菇','番石榴':'芭樂','紅龍果':'火龍果','甜橙':'柳丁','黃秋葵':'秋葵','番茄':'番茄 蕃茄'};
  function isoROC(s){const m=/^(\d{3})\.(\d{2})\.(\d{2})$/.exec(s);if(!m)return null;const date=`${+m[1]+1911}-${m[2]}-${m[3]}`;const t=Date.parse(date);return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===date?date:null;}
  function build(raw,today){
    const end=Date.parse(today);if(!Number.isFinite(end))throw new Error('Invalid date');
    const items=[];
    for(const [id,days] of Object.entries(raw)){
      const [type,code,official]=id.split('|');if(!['N04','N05'].includes(type)||!official||/其他花類|休市/.test(official))continue;
      const rows=Object.entries(days).flatMap(([d,pair])=>{const date=isoROC(d);return date&&Date.parse(date)<=end&&Array.isArray(pair)&&Number.isFinite(pair[0])&&pair[0]>0&&Number.isFinite(pair[1])&&pair[1]>0?[{date,price:pair[0],volume:pair[1]}]:[];}).sort((a,b)=>a.date.localeCompare(b.date));
      if(!rows.length)continue;
      const last=rows.at(-1),anchor=Date.parse(last.date);
      // Keep inactive foods searchable, but don't offer a current-price verdict for them.
      if(end-anchor>730*DAY)continue;
      const prior=rows.filter(x=>Date.parse(x.date)<anchor&&Date.parse(x.date)>=anchor-7*DAY);
      const windows=Array.from({length:5},(_,i)=>{const year=+last.date.slice(0,4)-i-1,month=+last.date.slice(5,7),day=+last.date.slice(8);const anniversary=Date.UTC(year,month-1,Math.min(day,new Date(Date.UTC(year,month,0)).getUTCDate()));return rows.filter(x=>Math.abs(Date.parse(x.date)-anniversary)<=15*DAY);});
      const prices=windows.flat().map(x=>x.price).sort((a,b)=>a-b),years=windows.filter(x=>x.length>0).length;
      const baseline=prices.length>=20&&years>=2?(prices[Math.floor((prices.length-1)/2)]+prices[Math.floor(prices.length/2)])/2:null;
      const base=official.split('-')[0];
      items.push({id,official,name:(aliases[base]||base).split(' ')[0],aliases:aliases[base]||'',category:type==='N05'?'水果':({'L':'葉菜','F':'瓜果豆','S':'根莖','M':'菇類'}[code[0]]||'其他蔬菜'),date:last.date,price:last.price,volume:last.volume,baseline,historyCount:prices.length,historyYears:years,recent:prior.length?prior.reduce((s,x)=>s+x.price*x.volume,0)/prior.reduce((s,x)=>s+x.volume,0):null,recentCount:prior.length,series:rows.filter(x=>Date.parse(x.date)>=anchor-29*DAY).map(x=>({date:x.date,price:x.price}))});
    }
    items.sort((a,b)=>b.date.localeCompare(a.date)||b.volume-a.volume);
    return {schema:1,asOf:today,latest:items[0]?.date||null,scope:'全臺有回報之果菜批發市場，依交易量加權',source:'農業部農產品交易行情（本機匯入資料）',items};
  }
  function assess(item,today){const stale=Date.parse(today)-Date.parse(item.date)>7*DAY;const ratio=!stale&&item.baseline>0&&item.price>0?item.price/item.baseline:null;return {stale,ratio,label:ratio===null?'資料不足':ratio<.88?'偏低':ratio>1.12?'偏高':'接近常態',tone:ratio===null?'muted':ratio<.88?'low':ratio>1.12?'high':'normal'};}
  function search(items,q,category='全部'){const query=q.trim().toLowerCase();return items.filter(x=>(category==='全部'||x.category===category)&&`${x.name} ${x.official} ${x.aliases}`.toLowerCase().includes(query));}
  function sortPrices(items,order,today){
    const copy=[...items];if(!['asc','desc'].includes(order))return copy;
    const rank=x=>!Number.isFinite(x.price)||x.price<=0?2:!Number.isFinite(Date.parse(x.date))||assess(x,today).stale?1:0;
    return copy.sort((a,b)=>rank(a)-rank(b)||(rank(a)===2?0:(a.price-b.price)*(order==='asc'?1:-1)));
  }
  return {build,assess,search,sortPrices};
});
