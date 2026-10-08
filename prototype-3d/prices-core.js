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
  return {assess,search,sortPrices};
});
