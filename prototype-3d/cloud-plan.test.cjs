const test=require('node:test'),assert=require('node:assert/strict');
const N=require('./notes-store.js');
let P;try{P=require('./cloud-plan.js')}catch{}
test('cloud shopping list preserves concurrent additions, idempotent retry and account isolation',async()=>{
 assert.ok(P,'cloud plan adapter must exist');
 const {handleCloudRequest}=await import('../hosted/gps-map/lib/cloud-notes-server.mjs');
 const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE cloud_plans(user_id TEXT PRIMARY KEY,version INTEGER NOT NULL,document TEXT NOT NULL)');
 const env={DB:{prepare:sql=>({bind:(...args)=>({first:async()=>db.prepare(sql).get(...args),run:async()=>({meta:{changes:db.prepare(sql).run(...args).changes}})})})}};
 let user='a',fail=false;
 const fetch=async(path,o={})=>{const response=await handleCloudRequest(new Request('https://taoyuan-gps-walk.ruru0109lee.chatgpt.site'+path,{...o,headers:{Origin:'https://taoyuan-gps-walk.ruru0109lee.chatgpt.site','oai-authenticated-user-id':user,...o.headers}}),env);if(fail&&o.method==='PUT'){fail=false;throw Error('lost acknowledgement')}return response};
 const a=await P.create({fetch,user:{id:'a'}}),b=await P.create({fetch,user:{id:'a'}});
 await Promise.all([a.add('菜'),b.add('蛋')]);await a.sync();assert.deepEqual(a.load().sort(),['菜','蛋'].sort());
 fail=true;await assert.rejects(a.add('奶'));await a.add('奶');assert.equal(a.load().filter(x=>x==='奶').length,1);
 await b.remove('菜');await a.sync();assert.deepEqual(a.load().sort(),['奶','蛋'].sort());
 user='b';await assert.rejects(a.add('不應寫入'),/登入|帳號/);assert.deepEqual(a.load(),[]);
 const c=await P.create({fetch,user:{id:'b'}});assert.deepEqual(c.load(),[]);
 db.close();
});
test('plan API rejects anonymous, foreign origin and oversized products',async()=>{
 const {handleCloudRequest}=await import('../hosted/gps-map/lib/cloud-notes-server.mjs');
 const origin='https://taoyuan-gps-walk.ruru0109lee.chatgpt.site';
 assert.equal((await handleCloudRequest(new Request(origin+'/api/cloud/plan'),{})).status,401);
 const req=(headers,product)=>new Request(origin+'/api/cloud/plan',{method:'PUT',headers:{'oai-authenticated-user-id':'a','X-Sync-User':'a','X-Sync-Request':'1','Content-Type':'application/json',Origin:origin,...headers},body:JSON.stringify({action:'add',product})});
 assert.equal((await handleCloudRequest(req({Origin:'https://bad.example'},'菜'),{})).status,403);
 assert.equal((await handleCloudRequest(req({},'x'.repeat(201)),{DB:{}})).status,400);
});
