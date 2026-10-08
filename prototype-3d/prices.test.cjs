const assert = require('node:assert/strict');
const fs = require('node:fs');
assert.ok(fs.existsSync(__dirname + '/prices-core.js'), 'price analysis module exists');
const P = require('./prices-core.js');
const history = {};
for (const y of [113,114]) for (let d=1;d<=12;d++) history[`${y}.10.${String(d).padStart(2,'0')}`]=[20,100];
const raw = {'N04|LA1|甘藍-初秋':{...history,'115.10.01':[10,100],'115.10.06':[30,300],'115.10.08':[999,10]},'N04|LA2|甘藍-改良種':{'115.10.06':[12,100]},'N04|XX|壞資料':{'115.10.06':[0,0]}};
const data=P.build(raw,'2026-10-07');
assert.equal(data.latest,'2026-10-06');
assert.equal(data.items.length,2);
const a=data.items.find(x=>x.id==='N04|LA1|甘藍-初秋');
assert.equal(a.price,30); // must not silently replace latest daily price with smoothed price
assert.equal(a.baseline,20);
assert.equal(a.historyCount,24);
assert.equal(a.recent,10); // latest day excluded from preceding 7-day comparison
assert.equal(P.assess(a,'2026-10-07').label,'偏高');
assert.equal(P.assess(a,'2026-11-07').label,'資料不足');
assert.equal(P.assess(data.items[1],'2026-10-07').label,'資料不足');
assert.equal(P.search(data.items,'高麗菜').length,2);
assert.equal(P.search(data.items,'初秋').length,1);
assert.equal(P.search(data.items,'不存在的食物').length,0);
assert.equal(P.search(data.items,'  甘藍  ').length,2);
assert.equal(P.build({},'2026-10-07').latest,null);
assert.equal(P.build({'N04|A|測試':{'115.02.30':[10,100]}},'2026-10-07').items.length,0);
assert.equal(P.assess({...a,price:17},'2026-10-07').label,'偏低');
assert.equal(P.assess({...a,price:21},'2026-10-07').label,'接近常態');
assert.equal(P.assess({...a,baseline:null},'2026-10-07').ratio,null);
const crossYear={'115.01.05':[30,100]};
for(const year of [113,114]){
  for(let day=1;day<=10;day++)crossYear[`${year}.01.${String(day).padStart(2,'0')}`]=[10,100];
  for(let day=21;day<=31;day++)crossYear[`${year-1}.12.${day}`]=[100,100];
}
const boundary=P.build({'N04|LA1|甘藍-初秋':crossYear},'2026-01-05').items[0];
assert.equal(boundary.historyCount,42,'January windows must include preceding December');
assert.equal(boundary.baseline,100);
assert.equal(boundary.historyYears,2);
assert.equal(P.assess(boundary,'2026-01-05').label,'偏低');
assert.equal(typeof P.sortPrices,'function','price sorting is available');
const sorting=[{id:'old',price:1,date:'2026-09-01'},{id:'big',price:100,date:'2026-10-07'},{id:'small',price:9,date:'2026-10-07'},{id:'mid',price:20,date:'2026-10-07'},{id:'missing',price:null,date:'2026-10-07'}];
assert.deepEqual(P.sortPrices(sorting,'asc','2026-10-07').map(x=>x.id),['small','mid','big','old','missing']);
assert.deepEqual(P.sortPrices(sorting,'desc','2026-10-07').map(x=>x.id),['big','mid','small','old','missing']);
assert.deepEqual(P.sortPrices(sorting,'default','2026-10-07'),sorting);
assert.equal(sorting[0].id,'old','sorting must not mutate default ordering');
assert.deepEqual(P.sortPrices([],'asc','2026-10-07'),[]);
console.log('PASS: analysis, search, ascending/descending numeric sorting, stale prices last and immutable default ordering');
