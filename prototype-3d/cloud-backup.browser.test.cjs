const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const N=require('./notes-store.js'),base=process.env.CLOUD_TEST_URL||'http://127.0.0.1:8891';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const cloud=await browser.newContext({acceptDownloads:true}),p=await cloud.newPage();await p.goto(base+'/signin-with-chatgpt?return_to=/notebook.html');await p.locator('#syncStatus').filter({hasText:'帳號'}).waitFor();
 const user=(await (await cloud.request.get(base+'/api/cloud/session')).json()).user;
 const planned='備份清單-'+Date.now();assert.equal((await cloud.request.put(base+'/api/cloud/plan',{headers:{'X-Sync-Request':'1','X-Sync-User':user.id,Origin:base,'Content-Type':'application/json'},data:{action:'add',product:planned}})).status(),200);
 const id='backup-photo-'+Date.now(),bytes=fs.readFileSync(__dirname+'/app-icon.png'),headers={'X-Sync-Request':'1','X-Sync-User':user.id,Origin:base};
 assert.equal((await cloud.request.put(base+'/api/cloud/photos/'+id,{headers:{...headers,'Content-Type':'image/png','X-Photo-Kind':encodeURIComponent('收據')},data:bytes})).status(),200);
 const current=await (await cloud.request.get(base+'/api/cloud/notes')).json();let raw=JSON.stringify(current.document);const store=N.createStore({getItem:()=>raw,setItem:(_,v)=>raw=v});
 const record=store.save({venue:'備份測試市場',product:'備份驗收-'+Date.now(),date:'2026-10-14',price:45,photo:id,photoKind:'收據'});store.save({...N.latest(record),price:50},record.id);
 assert.equal((await cloud.request.put(base+'/api/cloud/notes',{headers:{...headers,'Content-Type':'application/json'},data:{expectedVersion:current.version,document:JSON.parse(raw)}})).status(),200);
 await p.reload();await p.locator('#syncStatus').filter({hasText:'帳號'}).waitFor();const downloading=p.waitForEvent('download');await p.locator('#exportNotes').click();const download=await downloading,filename=await download.path(),backup=JSON.parse(fs.readFileSync(filename,'utf8'));
 assert.ok(backup.shoppingPlan?.includes(planned),'backup includes cloud shopping list');
 const exported=backup.records.find(r=>r.id===record.id);assert.deepEqual(exported.versions.map(v=>v.price),[45,50]);const photo=backup.photos.find(x=>x.id===id);assert.ok(photo);assert.deepEqual(Buffer.from(photo.data.split(',')[1],'base64'),bytes);
 // Restore only into a fresh, isolated local browser. Production data is never replaced.
 const local=await browser.newContext(),q=await local.newPage();await q.route('**/api/cloud/session',r=>r.fulfill({status:404,body:'{}'}));await q.goto(base+'/notebook.html');await q.locator('#syncStatus').filter({hasText:'本機模式'}).waitFor();
 const choosing=q.waitForEvent('filechooser');await q.locator('#importNotes').click();await (await choosing).setFiles(filename);await q.locator('#importDialog[open]').waitFor();await q.locator('#confirmImport').click();await q.locator('#importDialog').waitFor({state:'hidden'});
 const restored=await q.evaluate(()=>ShoppingNotes.createStore(localStorage).load());assert.deepEqual(restored,backup.records);
 assert.deepEqual(await q.evaluate(()=>ShoppingFlow.createPlan(localStorage,'local').load()),backup.shoppingPlan);
 const recovered=await q.evaluate(async id=>{const x=await NotePhotos.get(id);return {kind:x.kind,type:x.blob.type,bytes:Array.from(new Uint8Array(await x.blob.arrayBuffer()))}},id);assert.deepEqual(Buffer.from(recovered.bytes),bytes);assert.equal(recovered.kind,'收據');
 const choosingAgain=q.waitForEvent('filechooser');await q.locator('#importNotes').click();await (await choosingAgain).setFiles(filename);await q.locator('#importDialog[open]').waitFor();await q.locator('#confirmImport').click();await q.locator('#importDialog').waitFor({state:'hidden'});assert.equal(await q.evaluate(()=>ShoppingNotes.createStore(localStorage).load().length),backup.records.length);
 console.log('PASS isolated restore of exported cloud notes, complete revision history and exact image bytes; repeated import creates no duplicate records');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
