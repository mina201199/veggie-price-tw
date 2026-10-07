// Photo-linked notes: photo fields validate, one receipt saves as many notes atomically, backups list the photos.
const assert=require('node:assert/strict'),N=require('./notes-store.js');
const mem=()=>({value:null,getItem(){return this.value},setItem(k,v){this.value=v}});
const base={venue:'全聯測試店',date:'2026-10-07',price:45,product:'高麗菜',quantity:'',unit:'g'};
const id='8443037d-1c2b-4e5f-9a0b-123456789abc';

// Validation: notes without a photo are unchanged; a photo needs a valid id and a kind.
assert.equal(N.validate(base).photo,'');assert.equal(N.validate(base).photoKind,'');
assert.deepEqual([N.validate({...base,photo:id,photoKind:'收據'}).photo,N.validate({...base,photo:id,photoKind:'收據'}).photoKind],[id,'收據']);
assert.equal(N.validate({...base,photoKind:'收據'}).photoKind,'','a kind without a photo is dropped');
assert.throws(()=>N.validate({...base,photo:'../../etc',photoKind:'收據'}),/照片連結/);
assert.throws(()=>N.validate({...base,photo:id,photoKind:'發票'}),/照片類型/);
assert.throws(()=>N.validate({...base,photo:id}),/照片類型/);

// saveMany: all rows or none.
const m=mem(),s=N.createStore(m);
const rows=[{...base,photo:id,photoKind:'收據'},{...base,product:'雞胸肉',price:89,quantity:300,unit:'g',photo:id,photoKind:'收據'}];
const added=s.saveMany(rows);
assert.equal(added.length,2);assert.equal(s.load().length,2);
assert.ok(s.load().every(r=>r.versions[0].photo===id&&r.versions[0].photoKind==='收據'));
const before=m.value;
assert.throws(()=>s.saveMany([{...base,photo:id,photoKind:'收據'},{...base,price:''}]),/第 2 項/);
assert.equal(m.value,before,'a bad row writes nothing');
assert.throws(()=>s.saveMany([]));
const full=N.createStore({getItem(){return null},setItem(){throw Error('quota')}});
assert.throws(()=>full.saveMany(rows),/quota/);

// Edits keep the photo; backups list each photo once; import compares photo fields too.
s.save({...N.latest(added[0]),price:47},added[0].id);
assert.equal(N.latest(s.load()[0]).photo,id);
assert.deepEqual(N.photoIds(s.load()),[id]);
const target=N.createStore(mem());
assert.deepEqual(target.importJSON(s.exportJSON()),{added:2,updated:0,skipped:0});
const conflict=JSON.parse(s.exportJSON());conflict.records[0].versions[0].photoKind='標價';
assert.throws(()=>target.importJSON(JSON.stringify(conflict)),/衝突/);
// The share preview never carries the photo.
assert.equal('photo' in N.sharePayload({...N.validate({...base,quantity:1,unit:'kg',photo:id,photoKind:'收據'}),share:true}),false);
console.log('PASS: photo fields, atomic multi-item save, edits keep photos, backup photo list, import conflicts, share excludes photos');
