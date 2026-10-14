import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';

const token='a'.repeat(64), origin='https://taoyuan-gps-walk.ruru0109lee.chatgpt.site';
async function fixture(){
 const script=readFileSync(new URL('./system-backup.mjs',import.meta.url),'utf8')+'\nexport default {fetch(request,env){return handleSystemBackup(request,env)}}';
 const mf=new Miniflare({modules:true,script,compatibilityDate:'2026-05-15',d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SYSTEM_BACKUP_GRANT:JSON.stringify({token,expiresAt:new Date(Date.now()+600000).toISOString()})}});
 const db=await mf.getD1Database('DB');
 await db.exec('CREATE TABLE cloud_notes(user_id TEXT PRIMARY KEY, version INTEGER, document TEXT); CREATE TABLE cloud_plans(user_id TEXT PRIMARY KEY, version INTEGER, document TEXT); CREATE INDEX note_version ON cloud_notes(version)');
 await db.prepare('INSERT INTO cloud_notes VALUES (?, ?, ?)').bind('alice',3,JSON.stringify({schema:1,records:[{id:'note1',versions:[{photo:'photo-123',price:12},{photo:'photo-456',price:15}]}]})).run();
 await db.prepare('INSERT INTO cloud_plans VALUES (?, ?, ?)').bind('bob',2,'["高麗菜"]').run();
 const bucket=await mf.getR2Bucket('BUCKET');
 await bucket.put('cloud-photos/alice/photo-123',new Uint8Array([137,80,78,71,13,10,26,10]),{httpMetadata:{contentType:'image/png'},customMetadata:{kind:'收據',width:'1'}});
 await bucket.put('orphan/from-deleted-note',new Uint8Array([255,216,255]),{httpMetadata:{contentType:'image/jpeg'},customMetadata:{kind:'其他'}});
 return {mf,db,bucket,request:(path,options={})=>mf.dispatchFetch(origin+'/api/system-backup/'+path,{...options,headers:{'X-System-Backup-Token':token,...options.headers}})};
}
test('real D1/R2 export includes every account, complete documents, schema and orphan objects',async()=>{
 const f=await fixture();try{
  const response=await f.request('database');assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
  const dump=await response.json();assert.equal(dump.tables.cloud_notes.length,1);assert.equal(JSON.parse(dump.tables.cloud_notes[0].document).records[0].versions.length,2);assert.equal(dump.tables.cloud_plans[0].user_id,'bob');assert.ok(dump.schema.some(s=>s.type==='index'&&s.name==='note_version'));
  const list=await (await f.request('objects?limit=1')).json();assert.equal(list.objects.length,1);assert.equal(list.truncated,true);assert.ok(list.cursor);
  const next=await (await f.request('objects?limit=1&cursor='+encodeURIComponent(list.cursor))).json();assert.equal(next.objects.length,1);assert.equal(next.truncated,false);assert.ok([...list.objects,...next.objects].some(o=>o.key==='orphan/from-deleted-note'));
  const object=await f.request('object?key='+encodeURIComponent('orphan/from-deleted-note'));assert.equal(object.status,200);assert.deepEqual(new Uint8Array(await object.arrayBuffer()),new Uint8Array([255,216,255]));
 }finally{await f.mf.dispose()}
});
test('invalid tokens, expired grants, foreign browser origin and all write methods are rejected',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('database',{headers:{'X-System-Backup-Token':'bad'}})).status,401);
  assert.equal((await f.request('database',{headers:{Origin:'https://evil.example'}})).status,403);
  for(const method of ['POST','PUT','DELETE'])assert.equal((await f.request('database',{method})).status,405);
  assert.equal((await f.request('object?key=missing')).status,404);
  assert.equal((await f.request('objects?limit=0')).status,400);
  await f.mf.setOptions({modules:true,script:readFileSync(new URL('./system-backup.mjs',import.meta.url),'utf8')+'\nexport default {fetch(r,e){return handleSystemBackup(r,e)}}',compatibilityDate:'2026-05-15',d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SYSTEM_BACKUP_GRANT:JSON.stringify({token,expiresAt:'2000-01-01T00:00:00Z'})}});
  assert.equal((await f.request('database')).status,401);
 }finally{await f.mf.dispose()}
});
