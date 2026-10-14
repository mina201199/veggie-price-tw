const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.CLOUD_TEST_URL||'http://127.0.0.1:8891';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const a=await browser.newContext({viewport:{width:390,height:844}}),b=await browser.newContext({viewport:{width:1280,height:900}}),pages=await Promise.all([a.newPage(),b.newPage()]);
 const errors=[];pages.forEach(p=>p.on('pageerror',e=>errors.push(e.message)));
 for(const p of pages){await p.goto(base+'/signin-with-chatgpt?return_to=/prices.html');await p.evaluate(()=>PriceShopping.ready);await p.evaluate(()=>Drawer.set('full'));}
 const product='雲端待買-'+Date.now();
 await pages[0].locator('#shoppingProduct').fill(product);await pages[0].locator('#shoppingAddForm button').click();await pages[0].locator('#shoppingList .shopping-row').filter({hasText:product}).waitFor();
 await pages[1].reload();await pages[1].evaluate(()=>PriceShopping.ready);await pages[1].evaluate(()=>Drawer.set('full'));await pages[1].locator('#shoppingList .shopping-row').filter({hasText:product}).waitFor();
 await pages[0].locator('#shoppingList .shopping-row').filter({hasText:product}).locator('.shopping-button').click();await pages[0].locator('#noteEditor[open]').waitFor();assert.equal(await pages[0].locator('#noteForm [name=product]').inputValue(),product);
 pages[0].once('dialog',d=>d.accept());await pages[0].locator('#closeEditor').click();assert.ok((await (await a.request.get(base+'/api/cloud/plan')).json()).items.includes(product),'cancel preserves cloud list');
 await pages[0].goto(base+'/prices.html');await pages[0].evaluate(()=>PriceShopping.ready);await pages[0].evaluate(()=>Drawer.set('full'));await pages[0].locator('#shoppingList .shopping-row').filter({hasText:product}).locator('.shopping-button').click();await pages[0].locator('#noteEditor[open]').waitFor();
 await pages[0].locator('#noteForm [name=venue]').fill('雲端測試市場');await pages[0].locator('#noteForm [name=price]').fill('45');
 // A failed note write must preserve the pending item and form.
 await pages[0].route('**/api/cloud/notes',r=>r.request().method()==='PUT'?r.fulfill({status:503,body:'{}'}):r.continue());await pages[0].locator('#noteForm button[type=submit]').click();await pages[0].locator('#formError').filter({hasText:'未儲存'}).waitFor();assert.ok((await (await a.request.get(base+'/api/cloud/plan')).json()).items.includes(product));
 await pages[0].unroute('**/api/cloud/notes');await pages[0].locator('#noteForm button[type=submit]').click();await pages[0].locator('#noteEditor').waitFor({state:'hidden'});await pages[0].locator('#noteStatus').filter({hasText:'已從待買清單移除'}).waitFor();
 assert.ok(!(await (await a.request.get(base+'/api/cloud/plan')).json()).items.includes(product),'acknowledged save removes cloud item');
 await pages[1].reload();await pages[1].evaluate(()=>PriceShopping.ready);await pages[1].evaluate(()=>Drawer.set('full'));assert.equal(await pages[1].locator('#shoppingList .shopping-row').filter({hasText:product}).count(),0);assert.match(await pages[1].locator('#shoppingFrequent').textContent(),/雲端測試市場/);
 const session=await (await a.request.get(base+'/api/cloud/session')).json();const note=await (await a.request.get(base+'/api/cloud/notes')).json();assert.ok(note.document.records.some(r=>r.versions.at(-1).product===product));
 await pages[1].goto(base+'/signout-with-chatgpt?return_to=/prices.html');await pages[1].evaluate(()=>PriceShopping.ready);assert.doesNotMatch(await pages[1].locator('#shoppingFrequent').textContent(),/雲端測試市場/);
 assert.deepEqual(errors,[]);console.log('PASS cloud list across devices, account history, scoped purchase draft, cancellation and failed-save preservation, successful removal and logout isolation');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
