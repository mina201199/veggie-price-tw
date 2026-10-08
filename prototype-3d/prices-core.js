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
  // 攤販賣多少：價格換成元/台斤（1 台斤 = 600 公克）。
  function perJin(price,quantity,unit){
    const jin={'台斤':1,'公斤':1/.6,'公克':1/600}[unit]*quantity;
    return price>0&&jin>0&&Number.isFinite(jin)?price/jin:null;
  }
  // 跟一般零售範圍（tools/build.py 的 retail_estimate）比；門檻與公開網站的「攤販賣多少」相同（tools/template.html stallVerdict）。
  // marketTone 是這樣菜批發行情的判斷（assess 的 tone），用來補一句「是批發本來就貴」之類的說明。
  function judgeStall(re,pJin,marketTone){
    const r=pJin/re.est,up=Math.round((r-1)*100),down=Math.round((1-r)*100);
    const s=pJin<re.lo?{tone:'good',label:'划算',text:`比一般行情便宜約 ${down}%，可以買`,note:''}
      :pJin<=re.hi?{tone:'ok',label:'合理',text:'在一般零售行情內',note:''}
      :pJin<=re.hi*1.2?{tone:'warn',label:'偏貴',text:`比一般行情高約 ${up}%`,note:'可以比比看別攤，或問老闆能不能算便宜一點。'}
      :{tone:'bad',label:'太貴',text:`比一般行情高約 ${up}%`,note:'建議換一攤，或換別的菜。'};
    if(pJin<re.est*.5)s.note='便宜很多，留意一下新鮮度，或是不是次級品、剩貨出清。';
    else if(s.tone==='ok'&&marketTone==='high')s.note='攤販沒有亂開價，是這陣子批發本來就貴；想省可以看看公佈欄上划算的菜。';
    else if((s.tone==='warn'||s.tone==='bad')&&marketTone==='low')s.note='批發其實正便宜，這攤開得偏高，'+s.note;
    return Object.assign(s,{pJin});
  }
  return {assess,search,sortPrices,bestDeals,pickVariety,perJin,judgeStall};
});
