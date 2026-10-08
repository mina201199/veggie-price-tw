(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.Prices=api;})(typeof window==='object'?window:this,function(){
  'use strict';
  const DAY=86400000;
  // prices-data.json is built by tools/build_prices.py, sharing names and same-period rules with the public site.
  function assess(item,today){const stale=Date.parse(today)-Date.parse(item.date)>7*DAY;const ratio=!stale&&item.baseline>0&&item.price>0?item.price/item.baseline:null;return {stale,ratio,label:ratio===null?'資料不足':ratio<.88?'偏低':ratio>1.12?'偏高':'接近常態',tone:ratio===null?'muted':ratio<.88?'low':ratio>1.12?'high':'normal'};}
  function search(items,q,category='全部'){const query=q.trim().toLowerCase();return items.filter(x=>(category==='全部'||x.category===category)&&`${x.name} ${x.official} ${x.aliases}`.toLowerCase().includes(query));}
  function sortPrices(items,order,today){
    const copy=[...items];if(!['asc','desc'].includes(order))return copy;
    const rank=x=>!Number.isFinite(x.price)||x.price<=0?2:!Number.isFinite(Date.parse(x.date))||assess(x,today).stale?1:0;
    return copy.sort((a,b)=>rank(a)-rank(b)||(rank(a)===2?0:(a.price-b.price)*(order==='asc'?1:-1)));
  }
  const imported=x=>/進口/.test(x.official);
  // 「今天最划算」：最新交易日、有往年基準、國產、成交量夠大（冷門品種價格容易亂跳），比往年同期便宜；同名只留最便宜的品種。
  function bestDeals(items,today,{minVolume=3000,limit=10}={}){
    const latest=items.reduce((m,x)=>x.date>m?x.date:m,'');
    if(!latest||Date.parse(today)-Date.parse(latest)>7*DAY)return [];
    const best=new Map();
    for(const x of items){
      if(x.date!==latest||!(x.volume>=minVolume)||imported(x))continue;
      const r=assess(x,today).ratio;if(r===null||r>=1)continue;
      if(!best.has(x.name)||r<best.get(x.name).r)best.set(x.name,{x,r});
    }
    return [...best.values()].sort((a,b)=>a.r-b.r).slice(0,limit).map(e=>e.x);
  }
  // 菜籃代表的品種：同名、國產，最新交易日裡成交量最大的。
  function pickVariety(items,name){
    let best=null;
    for(const x of items)if(x.name===name&&!imported(x)&&(!best||x.date>best.date||(x.date===best.date&&x.volume>best.volume)))best=x;
    return best;
  }
  return {assess,search,sortPrices,bestDeals,pickVariety};
});
