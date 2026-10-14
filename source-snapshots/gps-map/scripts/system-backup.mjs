import { mkdir,readFile,writeFile,stat,readdir } from 'node:fs/promises';
import { resolve,join,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Miniflare } from 'miniflare';
import { DatabaseSync } from 'node:sqlite';

const digest=data=>createHash('sha256').update(data).digest('hex');
const quote=name=>'"'+name.replaceAll('"','""')+'"';
const canonical=value=>JSON.stringify(sort(value));
function sort(value){if(Array.isArray(value))return value.map(sort);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sort(value[k])]));return value}
function logical(d){return canonical({schema:d.schema,tables:Object.fromEntries(Object.entries(d.tables).map(([k,rows])=>[k,[...rows].sort((a,b)=>canonical(a).localeCompare(canonical(b)))])),sqliteSequence:d.sqliteSequence||[]})}
async function createNew(path){try{await stat(path);throw Error('Destination already exists')}catch(e){if(e.code!=='ENOENT')throw e}await mkdir(path,{recursive:true})}
async function saveJson(path,value){await writeFile(path,JSON.stringify(value,null,2)+'\n',{flag:'wx'})}
function safePath(root,name){if(typeof name!=='string'||!name||name.includes('\\'))throw Error('Unsafe backup path');const target=resolve(root,name);if(!target.startsWith(resolve(root)+sep))throw Error('Unsafe backup path');return target}

export async function captureBackup({origin,token,serviceToken,output,fetcher=fetch}){
 if(origin!=='https://taoyuan-gps-walk.ruru0109lee.chatgpt.site')throw Error('Unexpected Site origin');
 output=resolve(output);await createNew(output);await mkdir(join(output,'objects'));
 const headers={'X-System-Backup-Token':token,...(serviceToken?{'OAI-Sites-Authorization':'Bearer '+serviceToken}:{})};
 async function call(path){const r=await fetcher(origin+'/api/system-backup/'+path,{headers,redirect:'error',signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error('Backup request failed: '+r.status);return r}
 async function inventory(){const objects=[],seen=new Set();let cursor=null;do{
  const page=await (await call('objects?limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''))).json();
  if(!Array.isArray(page.objects)||page.truncated&&!page.cursor)throw Error('Incomplete inventory');
  for(const o of page.objects){if(seen.has(o.key))throw Error('Duplicate object inventory');seen.add(o.key);objects.push(o)}
  if(page.truncated&&page.cursor===cursor)throw Error('Cursor did not advance');cursor=page.truncated?page.cursor:null;
 }while(cursor);return objects.sort((a,b)=>a.key.localeCompare(b.key))}
 const db=await (await call('database')).json();if(db.format!=='sites-d1-logical-v1')throw Error('Unsupported database format');
 const before=await inventory(),objects=[];
 for(const item of before){
  const r=await call('object?key='+encodeURIComponent(item.key)+'&etag='+encodeURIComponent(item.etag));
  const bytes=Buffer.from(await r.arrayBuffer());
  if(bytes.length!==item.size||r.headers.get('X-Backup-ETag')!==item.etag)throw Error('Object changed during capture');
  const file='objects/'+digest(item.key)+'.bin';await writeFile(join(output,file),bytes,{flag:'wx'});
  objects.push({...item,file,sha256:digest(bytes)});
 }
 const afterDb=await (await call('database')).json(),after=await inventory();
 if(logical(db)!==logical(afterDb)||canonical(before)!==canonical(after))throw Error('Storage changed during capture; retry to a new destination');
 await saveJson(join(output,'database.json'),db);
 const databaseBytes=await readFile(join(output,'database.json'));
 const manifest={format:'sites-full-logical-backup-v1',complete:true,siteOrigin:origin,capturedAt:new Date().toISOString(),database:{file:'database.json',sha256:digest(databaseBytes)},objects,consistency:'Two database exports and complete R2 inventories matched before/after download; not a distributed point-in-time snapshot.',excludes:db.excludes};
 await saveJson(join(output,'manifest.json'),manifest);
 return {tables:Object.keys(db.tables).length,rows:Object.values(db.tables).reduce((n,r)=>n+r.length,0),objects:objects.length,bytes:objects.reduce((n,o)=>n+o.size,0),output};
}

export async function restoreBackup({backup,output}){
 backup=resolve(backup);output=resolve(output);
 if(output===backup||output.startsWith(backup+sep)||backup.startsWith(output+sep))throw Error('Restore must use a separate destination');
 const manifest=JSON.parse(await readFile(join(backup,'manifest.json'),'utf8'));
 if(manifest.format!=='sites-full-logical-backup-v1'||!manifest.complete)throw Error('Incomplete backup');
 const raw=await readFile(safePath(backup,manifest.database.file));if(digest(raw)!==manifest.database.sha256)throw Error('Database checksum mismatch');
 const db=JSON.parse(raw),objects=new Map();
 for(const item of manifest.objects){if(objects.has(item.key))throw Error('Duplicate object key');const bytes=await readFile(safePath(backup,item.file));if(bytes.length!==item.size||digest(bytes)!==item.sha256)throw Error('Object checksum mismatch');objects.set(item.key,bytes)}
 await createNew(output);
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("isolated")}}',compatibilityDate:'2026-05-15',d1Databases:['DB'],r2Buckets:['BUCKET'],d1Persist:join(output,'d1'),r2Persist:join(output,'r2')});
 let disposed=false;
 try{
  const database=await mf.getD1Database('DB'),bucket=await mf.getR2Bucket('BUCKET');
  await database.exec('PRAGMA foreign_keys=OFF');
  for(const entry of db.schema.filter(s=>s.type==='table'))await database.prepare(entry.sql).run();
  for(const [table,rows] of Object.entries(db.tables)){
   for(let offset=0;offset<rows.length;offset+=50){const statements=rows.slice(offset,offset+50).map(row=>{const keys=Object.keys(row);return database.prepare('INSERT INTO '+quote(table)+' ('+keys.map(quote).join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')').bind(...keys.map(k=>row[k]&&typeof row[k]==='object'&&'$blob' in row[k]?new Uint8Array(row[k].$blob):row[k]))});if(statements.length)await database.batch(statements)}
  }
  if(db.sqliteSequence?.length){await database.prepare('DELETE FROM sqlite_sequence').run();for(const row of db.sqliteSequence)await database.prepare('INSERT INTO sqlite_sequence(name,seq) VALUES (?,?)').bind(row.name,row.seq).run()}
  for(const entry of db.schema.filter(s=>s.type!=='table'))await database.prepare(entry.sql).run();
  for(const item of manifest.objects)await bucket.put(item.key,objects.get(item.key),{httpMetadata:item.httpMetadata,customMetadata:item.customMetadata,...(item.storageClass?{storageClass:item.storageClass}:{})});
  // Use the same read-only exporter against real isolated D1 and R2 bindings.
  const {handleSystemBackup}=await import('../lib/system-backup.mjs');
  const grantToken='restore-validation-token-'.padEnd(64,'x'),env={DB:database,BUCKET:bucket,SYSTEM_BACKUP_GRANT:JSON.stringify({token:grantToken,expiresAt:new Date(Date.now()+600000).toISOString()})};
  const r=await handleSystemBackup(new Request('https://taoyuan-gps-walk.ruru0109lee.chatgpt.site/api/system-backup/database',{headers:{'X-System-Backup-Token':grantToken}}),env);if(!r.ok)throw Error('Restored database export failed');
  const restored=await r.json();if(logical(restored)!==logical(db))throw Error('Restored schema or table contents mismatch');
  const restoredObjects=[];let cursor;do{const page=await bucket.list({limit:100,...(cursor?{cursor}:{}),include:['httpMetadata','customMetadata']});restoredObjects.push(...page.objects);cursor=page.truncated?page.cursor:undefined}while(cursor);
  if(restoredObjects.length!==manifest.objects.length)throw Error('Restored object count mismatch');
  for(const item of manifest.objects){const object=await bucket.get(item.key);if(!object)throw Error('Restored object missing');const bytes=Buffer.from(await object.arrayBuffer());if(digest(bytes)!==item.sha256||canonical(object.httpMetadata||{})!==canonical(item.httpMetadata||{})||canonical(object.customMetadata||{})!==canonical(item.customMetadata||{})||object.storageClass!==item.storageClass)throw Error('Restored object bytes or metadata mismatch')}
  await mf.dispose();
  disposed=true;
  async function sqliteFiles(dir){const paths=[];for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())paths.push(...await sqliteFiles(path));else if(entry.name.endsWith('.sqlite'))paths.push(path)}return paths}
  const databases=(await sqliteFiles(join(output,'d1'))).filter(p=>!p.endsWith(sep+'metadata.sqlite'));if(databases.length!==1)throw Error('Expected one isolated D1 database');
  const physical=new DatabaseSync(databases[0],{readOnly:true});
  try{const integrity=physical.prepare('PRAGMA integrity_check').all();if(integrity.length!==1||Object.values(integrity[0])[0]!=='ok')throw Error('Database integrity check failed');if(physical.prepare('PRAGMA foreign_key_check').all().length)throw Error('Foreign key check failed')}finally{physical.close()}
  const report={status:'passed',scope:'All exported D1 user schema/rows and all R2 objects restored to isolated local Miniflare D1/R2.',integrityCheck:'ok',foreignKeyCheck:'ok',schemaObjects:db.schema.length,tablesVerified:Object.keys(db.tables).length,rowsVerified:Object.values(db.tables).reduce((n,rows)=>n+rows.length,0),objectsVerified:manifest.objects.length,objectBytesVerified:manifest.objects.reduce((n,o)=>n+o.size,0),metadataVerified:true,sqliteSequencesVerified:true,productionWrites:0,uploadedTimestamps:'Original upload times, object versions and ETags recorded in manifest; provider-generated values change on restore.',excludes:manifest.excludes,completedAt:new Date().toISOString()};
  await saveJson(join(output,'verification-report.json'),report);return report;
 }finally{if(!disposed)await mf.dispose()}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{let input='';for await(const chunk of process.stdin)input+=chunk;const options=JSON.parse(input);const result=options.mode==='restore'?await restoreBackup(options):options.mode==='capture'?await captureBackup(options):(()=>{throw Error('Unknown operation')})();console.log(JSON.stringify(result))}catch(error){console.error(error.message);process.exitCode=1}
}
