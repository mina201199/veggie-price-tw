const assert = require('node:assert/strict');
const fs = require('node:fs');
assert.ok(fs.existsSync(__dirname + '/prices-core.js'), 'price analysis module exists');
const P = require('./prices-core.js');
// The snapshot is built once, by tools/build_prices.py, with the same rules as the public site (tools/test_build_prices.py).
assert.equal(P.build, undefined, 'the browser must not compute prices a second way');
const a={id:'N04|LA1|甘藍-初秋',official:'甘藍-初秋',name:'高麗菜',aliases:'',category:'葉菜',date:'2026-10-06',price:30,baseline:20};
const b={id:'N04|LA2|甘藍-改良種',official:'甘藍-改良種',name:'高麗菜',aliases:'',category:'葉菜',date:'2026-10-06',price:12,baseline:null};
const tomato={id:'N04|FJ3|番茄-黑柿',official:'番茄-黑柿',name:'番茄',aliases:'蕃茄',category:'瓜果豆',date:'2026-10-06',price:40,baseline:40};
const items=[a,b,tomato];
assert.equal(P.assess(a,'2026-10-07').label,'偏高');
assert.equal(P.assess(a,'2026-11-07').label,'資料不足');
assert.equal(P.assess(b,'2026-10-07').label,'資料不足');
assert.equal(P.assess({...a,price:17},'2026-10-07').label,'偏低');
assert.equal(P.assess({...a,price:21},'2026-10-07').label,'接近常態');
assert.equal(P.assess({...a,baseline:null},'2026-10-07').ratio,null);
assert.equal(P.search(items,'高麗菜').length,2);
assert.equal(P.search(items,'初秋').length,1);
assert.equal(P.search(items,'蕃茄').length,1);
assert.equal(P.search(items,'不存在的食物').length,0);
assert.equal(P.search(items,'  甘藍  ').length,2);
assert.equal(P.search(items,'','瓜果豆').length,1);
assert.equal(typeof P.sortPrices,'function','price sorting is available');
const sorting=[{id:'old',price:1,date:'2026-09-01'},{id:'big',price:100,date:'2026-10-07'},{id:'small',price:9,date:'2026-10-07'},{id:'mid',price:20,date:'2026-10-07'},{id:'missing',price:null,date:'2026-10-07'}];
assert.deepEqual(P.sortPrices(sorting,'asc','2026-10-07').map(x=>x.id),['small','mid','big','old','missing']);
assert.deepEqual(P.sortPrices(sorting,'desc','2026-10-07').map(x=>x.id),['big','mid','small','old','missing']);
assert.deepEqual(P.sortPrices(sorting,'default','2026-10-07'),sorting);
assert.equal(sorting[0].id,'old','sorting must not mutate default ordering');
assert.deepEqual(P.sortPrices([],'asc','2026-10-07'),[]);

// 公佈欄「今天最划算」：今天有交易、有往年基準、國產、成交量 ≥ 3000 公斤、比往年同期便宜，同名只留一個品種。
const day='2026-10-07',v=(id,name,official,price,baseline,volume,date=day)=>({id,name,official,price,baseline,volume,date,category:'葉菜',aliases:''});
const pool=[
  v('celery','芹菜','芹菜-白梗',45,100,5000),
  v('celery2','芹菜','芹菜-其他',60,100,4000),
  v('yam','地瓜','甘薯-臺農66號',48,100,30000),
  v('bokchoy','小白菜','小白菜-其他',43,100,1500),
  v('orange','柳橙（進口）','甜橙-進口',30,100,9000),
  v('cabbage','高麗菜','甘藍-初秋',105,100,80000),
  v('onion','青蔥','青蔥-北蔥',50,100,20000,'2026-10-06'),
  v('nobase','金針菇','金絲菇-金針菇',10,null,9000)];
assert.deepEqual(P.bestDeals(pool,day).map(x=>x.id),['celery','yam'],'cheapest variety per name, volume, import, not-cheaper, not-today and no-baseline rules');
const many=Array.from({length:12},(_,i)=>v('d'+i,'菜'+i,'菜'+i+'-種',50+i,100,3000));
assert.deepEqual(P.bestDeals(many,day).map(x=>x.id),['d0','d1','d2','d3','d4','d5','d6','d7','d8','d9'],'top 10, cheapest first');
assert.deepEqual(P.bestDeals(pool,'2026-10-20'),[],'no ranking when the latest trade day is over 7 days old');
assert.deepEqual(P.bestDeals([],day),[]);

// 菜籃用哪個品種：同名、國產，最新交易日裡成交量最大的。
const baskets=[v('old','高麗菜','甘藍-初秋',30,30,90000,'2026-10-01'),v('small','高麗菜','甘藍-改良種',30,30,100),v('main','高麗菜','甘藍-初秋',30,30,300),v('imp','高麗菜（進口）','甘藍-進口',30,30,9000)];
assert.equal(P.pickVariety(baskets,'高麗菜').id,'main');
assert.equal(P.pickVariety(baskets,'南瓜'),null);
console.log('PASS: analysis, search, sorting, best deals and basket varieties');
