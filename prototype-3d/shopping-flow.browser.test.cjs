const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const port=Number(process.env.SHOPPING_TEST_PORT||8897),url=`http://localhost:${port}`,root=path.resolve(__dirname,'..');
let server,browser;
(async()=>{try{
 server=spawn(process.env.MAP_TEST_PYTHON||'python',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',__dirname],{windowsHide:true,stdio:'ignore'});
 for(let i=0;i<60;i++){try{const r=await fetch(url+'/prices.html');await r.text();if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:390,height:844},locale:'zh-TW',timezoneId:'Asia/Taipei'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'prices-data.json'),'utf8'));const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 fixture.items=[{...fixture.items.find(x=>x.name==='高麗菜'),date,price:20,baseline:40,volume:10000,official:'甘藍-初秋',series:[{date,price:20}]}];fixture.latest=date;fixture.retail={高麗菜:{lo:20,hi:40,est:30,src:'category'}};
 await page.route('**/prices-data.json',route=>route.fulfill({json:fixture}));
 await page.goto(url+'/prices.html');await page.waitForFunction(()=>window.PriceList?.data());await page.evaluate(()=>PriceShopping.ready);
 assert.equal(await page.locator('#drawer').getAttribute('data-state'),'half');
 await page.evaluate(()=>Drawer.set('full'));
 await page.locator('#shoppingDeals .shopping-button').click();assert.equal(await page.locator('#shoppingCount').textContent(),'1 項');
 await page.reload();await page.waitForFunction(()=>window.PriceList?.data());await page.evaluate(()=>PriceShopping.ready);await page.evaluate(()=>Drawer.set('full'));assert.equal(await page.locator('#shoppingCount').textContent(),'1 項','清單重新整理後保留');
 await page.locator('#shoppingList .shopping-product').click();await page.locator('[aria-label="攤販開的價格（元）"]').fill('60');await page.locator('[aria-label="重量"]').fill('1');await page.locator('[aria-label="重量單位"]').selectOption('公斤');
 await page.getByRole('button',{name:'買了，帶入採買筆記',exact:true}).click();await page.locator('#noteEditor[open]').waitFor();
 assert.equal(await page.locator('#noteForm [name=product]').inputValue(),'高麗菜');assert.equal(await page.locator('#noteForm [name=price]').inputValue(),'60');assert.equal(await page.locator('#noteForm [name=quantity]').inputValue(),'1');assert.equal(await page.locator('#noteForm [name=unit]').inputValue(),'kg');assert.equal(await page.locator('#noteForm [name=venue]').inputValue(),'');
 assert.equal(await page.evaluate(()=>ShoppingNotes.createStore(localStorage).load().length),0,'跳轉不會自動儲存');
 await page.locator('#noteForm .save').click();assert.equal(await page.locator('#noteEditor').getAttribute('open'),'','缺店家時維持表單');assert.equal(await page.evaluate(()=>ShoppingFlow.createPlan(localStorage,'local').load().length),1);
 await page.locator('#noteForm [name=venue]').fill('驗收市場');await page.locator('#noteForm .save').click();await page.locator('#noteEditor').waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>ShoppingNotes.createStore(localStorage).load().length),1);assert.equal(await page.evaluate(()=>ShoppingFlow.createPlan(localStorage,'local').load().length),0);
 await page.locator('.back').click();await page.waitForFunction(()=>window.PriceList?.data());await page.evaluate(()=>PriceShopping.ready);await page.evaluate(()=>Drawer.set('full'));
 assert.match(await page.locator('#shoppingFrequent').textContent(),/驗收市場/);await page.locator('#shoppingFrequent .shopping-product').click();await page.locator('[aria-label="攤販開的價格（元）"]').fill('36');await page.locator('[aria-label="重量"]').fill('500');await page.locator('[aria-label="重量單位"]').selectOption('公克');assert.match(await page.locator('.shopping-history').textContent(),/高 20%/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'手機不橫向溢出');await page.locator('#closeDetail').click();
 await page.locator('#shoppingProduct').fill('雞蛋');await page.locator('#shoppingAddForm button').click();await page.locator('#shoppingList .shopping-button').click();await page.locator('#noteEditor[open]').waitFor();page.once('dialog',dialog=>dialog.accept());await page.locator('#closeEditor').click();assert.equal(await page.evaluate(()=>ShoppingFlow.createPlan(localStorage,'local').load().length),1,'取消時保留清單');
 // Reload returns the durable list; stale market data cannot give an on-site verdict.
 fixture.items[0].date='2020-01-01';fixture.latest='2020-01-01';await page.goto(url+'/prices.html');await page.waitForFunction(()=>window.PriceList?.data());await page.evaluate(()=>PriceShopping.ready);await page.evaluate(()=>Drawer.set('full'));assert.equal(await page.locator('#shoppingDeals .shopping-tile').count(),0);await page.locator('#shoppingFrequent .shopping-product').click();await page.locator('[aria-label="攤販開的價格（元）"]').fill('60');assert.match(await page.locator('.stall-out').textContent(),/暫不判斷/);assert.equal(await page.locator('.stall-pill').count(),0);
 // A full storage must keep the editor open and the list intact.
 await page.locator('#closeDetail').click();await page.locator('#shoppingList .shopping-button').click();await page.locator('#noteEditor[open]').waitFor();await page.locator('#noteForm [name=venue]').fill('驗收市場');await page.locator('#noteForm [name=price]').fill('50');await page.evaluate(()=>{Storage.prototype.setItem=function(){throw Error('驗收：空間不足')}});await page.locator('#noteForm .save').click();assert.match(await page.locator('#formError').textContent(),/未儲存/);assert.equal(await page.locator('#noteEditor').getAttribute('open'),'');assert.equal(await page.evaluate(()=>ShoppingFlow.createPlan(localStorage,'local').load().length),1);
 assert.deepEqual(errors,[],'無頁面錯誤');console.log('PASS: 真實手機瀏覽器完成清單→現場比價→筆記→下次比較；驗證取消、儲存失敗與過期行情');
 }catch(e){console.error(e);process.exitCode=1;}finally{if(browser)await browser.close();if(server)server.kill();}})();
