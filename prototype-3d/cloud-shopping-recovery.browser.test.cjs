const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.CLOUD_TEST_URL||'http://127.0.0.1:8891';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const context=await browser.newContext(),page=await context.newPage(),localTab=await context.newPage();
 await page.goto(base+'/signin-with-chatgpt?return_to=/prices.html');await page.evaluate(()=>PriceShopping.ready);await page.evaluate(()=>Drawer.set('full'));
 await localTab.goto(base+'/prices.html');await localTab.evaluate(()=>PriceShopping.ready);
 const foreign='其他本機歷史-'+Date.now(),event=page.evaluate(()=>new Promise(resolve=>window.addEventListener('storage',()=>resolve(),{once:true})));
 await localTab.evaluate(product=>ShoppingNotes.createStore(localStorage).save({venue:'本機市場',product,date:'2026-10-14',price:20}),foreign);await event;
 assert.doesNotMatch(await page.locator('#shoppingFrequent').textContent(),new RegExp(foreign),'cloud history must never be replaced by local storage');
 let outage=true;await page.route('**/api/cloud/plan',r=>outage?r.fulfill({status:503,body:'{}'}):r.continue());
 const wanted='斷線恢復-'+Date.now();await page.locator('#shoppingProduct').fill(wanted);await page.locator('#shoppingAddForm button').click();await page.locator('#shoppingStatus').filter({hasText:'尚未同步'}).waitFor();assert.equal(await page.locator('#shoppingProduct').inputValue(),wanted);
 outage=false;await page.locator('#shoppingAddForm button').click();await page.locator('#shoppingList .shopping-row').filter({hasText:wanted}).waitFor({timeout:5000});
 console.log('PASS account history ignores local storage events and transient list outage recovers without page reload');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
