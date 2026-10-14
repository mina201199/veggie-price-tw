// Only deploy on this owner-private Site. A short-lived secret is also required.
const ORIGIN='https://taoyuan-gps-walk.ruru0109lee.chatgpt.site';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Type':'application/json'};
const json=(body,status=200)=>Response.json(body,{status,headers});
const quoted=name=>'"'+name.replaceAll('"','""')+'"';
async function authorized(request,env){
 let grant;try{grant=JSON.parse(env.SYSTEM_BACKUP_GRANT||'null')}catch{return false}
 const supplied=request.headers.get('X-System-Backup-Token')||'';
 if(!grant||!Number.isFinite(Date.parse(grant.expiresAt))||Date.parse(grant.expiresAt)<=Date.now()||typeof grant.token!=='string'||grant.token.length!==64||supplied.length!==64)return false;
 const encode=new TextEncoder();
 const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',encode.encode(supplied)),crypto.subtle.digest('SHA-256',encode.encode(grant.token))]);
 const left=new Uint8Array(a),right=new Uint8Array(b);let difference=0;
 for(let i=0;i<left.length;i++)difference|=left[i]^right[i];
 return difference===0;
}
export async function handleSystemBackup(request,env){
 if(!await authorized(request,env))return json({error:'Backup authorization required'},401);
 if(request.headers.get('Origin')&&request.headers.get('Origin')!==ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'Foreign origin rejected'},403);
 if(request.method!=='GET')return json({error:'Read-only endpoint'},405);
 if(!env.DB||!env.BUCKET)return json({error:'Storage unavailable'},503);
 const url=new URL(request.url),part=url.pathname.split('/').at(-1);
 try{
  if(part==='database'){
   const schemaResult=await env.DB.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT GLOB 'sqlite_*' AND name NOT GLOB '_cf_*' ORDER BY type,name").all();
   if(!schemaResult.success)throw Error('Schema read failed');
   const schema=schemaResult.results,tables=schema.filter(s=>s.type==='table');
   if(tables.length>200)throw Error('Too many tables for bounded export');
   const hasSequence=(await env.DB.prepare("SELECT name FROM sqlite_schema WHERE name='sqlite_sequence'").all()).results.length>0;
   const statements=tables.map(t=>env.DB.prepare('SELECT * FROM '+quoted(t.name)));
   if(hasSequence)statements.push(env.DB.prepare('SELECT name,seq FROM sqlite_sequence ORDER BY name'));
   const results=statements.length?await env.DB.batch(statements):[];
   if(results.some(r=>!r.success))throw Error('Incomplete table export');
   const rows=Object.fromEntries(tables.map((t,i)=>[t.name,results[i].results.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,Array.isArray(v)?{$blob:v}:v])))]));
   const payload={format:'sites-d1-logical-v1',capturedAt:new Date().toISOString(),schema,tables:rows,sqliteSequence:hasSequence?results.at(-1).results:[],excludes:['Cloudflare-managed internal tables']};
   if(new TextEncoder().encode(JSON.stringify(payload)).byteLength>50000000)throw Error('Database requires streaming export');
   return json(payload);
  }
  if(part==='objects'){
   const limit=Number(url.searchParams.get('limit')||100);
   if(!Number.isInteger(limit)||limit<1||limit>100)return json({error:'Invalid page size'},400);
   const cursor=url.searchParams.get('cursor');
   if(cursor&&cursor.length>4096)return json({error:'Invalid cursor'},400);
   const page=await env.BUCKET.list({limit,...(cursor?{cursor}:{}),include:['httpMetadata','customMetadata']});
   if(page.truncated&&!page.cursor)throw Error('Incomplete object listing');
   return json({objects:page.objects.map(o=>({key:o.key,size:o.size,etag:o.etag,version:o.version,uploaded:o.uploaded,httpMetadata:o.httpMetadata||{},customMetadata:o.customMetadata||{},storageClass:o.storageClass,checksums:o.checksums?.toJSON?.()||{}})),truncated:page.truncated,cursor:page.truncated?page.cursor:null});
  }
  if(part==='object'){
   const key=url.searchParams.get('key');if(!key||new TextEncoder().encode(key).byteLength>1024)return json({error:'Invalid key'},400);
   const expected=url.searchParams.get('etag');
   const object=await env.BUCKET.get(key,expected?{onlyIf:{etagMatches:expected}}:undefined);if(!object)return json({error:'Object missing'},404);
   if(!object.body)return json({error:'Object changed during backup'},412);
   return new Response(object.body,{headers:{...headers,'Content-Type':'application/octet-stream','X-Backup-ETag':object.etag,'X-Backup-Size':String(object.size)}});
  }
  return json({error:'Unknown backup operation'},404);
 }catch{return json({error:'Incomplete storage export; retry without replacing previous backup'},503)}
}
