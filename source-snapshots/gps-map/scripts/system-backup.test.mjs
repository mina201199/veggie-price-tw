import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Miniflare } from 'miniflare';
import { captureBackup,restoreBackup } from './system-backup.mjs';

test('full capture and isolated D1/R2 restore preserve multiple users, orphan bytes, metadata and sequences; corruption fails before restore',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'veggie-backup-test-'));
 const token='b'.repeat(64);
 const script=await readFile(new URL('../lib/system-backup.mjs',import.meta.url),'utf8');
 const mf=new Miniflare({modules:true,script:script+'\nexport default {fetch(r,e){return handleSystemBackup(r,e)}}',compatibilityDate:'2026-05-15',d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SYSTEM_BACKUP_GRANT:JSON.stringify({token,expiresAt:new Date(Date.now()+600000).toISOString()})}});
 try{
  const db=await mf.getD1Database('DB');
  await db.exec('CREATE TABLE notes(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, body TEXT, image BLOB); CREATE TABLE xcf_notes(value TEXT); CREATE INDEX note_owner ON notes(user_id)');
  await db.prepare('INSERT INTO notes VALUES (?,?,?,?)').bind(5,'alice','{"versions":[1,2]}',new Uint8Array([0,255])).run();
  await db.prepare('INSERT INTO notes VALUES (?,?,?,?)').bind(10,'bob','{"versions":[3]}',null).run();
  await db.exec('DELETE FROM notes WHERE id=10');
  await db.prepare('INSERT INTO xcf_notes VALUES (?)').bind('kept').run();
  const bucket=await mf.getR2Bucket('BUCKET');
  await bucket.put('orphan/../special',new Uint8Array([0,5,255]),{httpMetadata:{contentType:'image/png',cacheControl:'private'},customMetadata:{kind:'收據'}});
  const backup=join(dir,'backup'),restored=join(dir,'restored');
  const fetcher=(url,opts)=>mf.dispatchFetch(url,opts);
  const result=await captureBackup({origin:'https://taoyuan-gps-walk.ruru0109lee.chatgpt.site',token,output:backup,fetcher});assert.equal(result.objects,1);assert.equal(result.tables,2);
  const report=await restoreBackup({backup,output:restored});assert.equal(report.integrityCheck,'ok');assert.equal(report.objectsVerified,1);assert.equal(report.tablesVerified,2);
  const manifest=JSON.parse(await readFile(join(backup,'manifest.json'),'utf8'));
  await writeFile(join(backup,manifest.objects[0].file),new Uint8Array([1]));
  await assert.rejects(restoreBackup({backup,output:join(dir,'corrupt-restore')}),/checksum/);
 }finally{await mf.dispose()}
});
test('changing database is rejected rather than marking a backup complete',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'veggie-backup-changing-'));let reads=0;
 const fetcher=async url=>url.includes('/database')?Response.json({format:'sites-d1-logical-v1',schema:[],tables:{a:[{v:++reads}]},sqliteSequence:[]}):Response.json({objects:[],truncated:false,cursor:null});
 await assert.rejects(captureBackup({origin:'https://taoyuan-gps-walk.ruru0109lee.chatgpt.site',token:'c'.repeat(64),output:join(dir,'backup'),fetcher}),/changed/);
});
