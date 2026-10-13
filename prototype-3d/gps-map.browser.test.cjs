const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.GPS_TEST_URL||'http://localhost:8879/app';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const context=await browser.newContext({viewport:{width:390,height:844},permissions:['geolocation'],geolocation:{latitude:24.9537,longitude:121.225,accuracy:5}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/app.html?view=world');const world=page.frameLocator('iframe[data-view=world]');await page.locator('#gpsControl:enabled').waitFor();await world.locator('#gpsToggle').click();await page.waitForFunction(()=>MarketApp.context().gps.status==='following');
 await page.evaluate(()=>{window.testHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.testHidden});document.dispatchEvent(new Event('visibilitychange'))});assert.equal(await page.evaluate(()=>MarketApp.context().gps.status),'paused');
 await context.setGeolocation({latitude:24.96,longitude:121.225,accuracy:5});assert.equal(await page.evaluate(()=>MarketApp.context().player.lat),24.9537);
 await context.setGeolocation({latitude:24.9537,longitude:121.225,accuracy:5});await page.evaluate(()=>{window.testHidden=false;document.dispatchEvent(new Event('visibilitychange'))});await page.waitForFunction(()=>MarketApp.context().gps.status==='following');
 await context.setGeolocation({latitude:24.954,longitude:121.225,accuracy:5});await page.waitForFunction(()=>{const w=document.querySelector('iframe[data-view=world]').contentWindow;return Math.abs(w.GPSWorld.position().lat-24.954)<.000003});
 await context.setGeolocation({latitude:23.915,longitude:120.684,accuracy:5});await page.waitForFunction(()=>MarketApp.context().gps.status==='outside');assert.equal(await page.evaluate(()=>MarketApp.context().player.lat),24.954);
 await context.setGeolocation({latitude:25.063,longitude:121.197,accuracy:200});await page.waitForFunction(()=>MarketApp.context().gps.status==='inaccurate');assert.equal(await page.evaluate(()=>MarketApp.context().player.lat),24.954);
 await context.setGeolocation({latitude:25.063,longitude:121.197,accuracy:5});await world.locator('#coordinate').filter({hasText:'25.063000'}).waitFor();await page.waitForFunction(()=>document.querySelector('iframe[data-view=world]').contentWindow.GPSWorld.city()?.venues.length>0);
 await world.locator('#gpsToggle').click();await world.locator('#avatarTrigger').click();await world.locator('#avatarCards button[data-id=chief]').click();await world.locator('#wearAvatar').click();assert.equal(await page.evaluate(()=>localStorage.getItem('veggie-avatar-v1')),'chief');
 // A geography failure must not replace real city streets with a raster tile floor or move the GPS position.
 await context.route('**/city-data/zhongli.json',r=>r.abort());
 await page.locator('#market').selectOption('zhongli');
 // The in-memory snapshot cache is legitimate; use a fresh page so this is an actual failed source request.
 await page.reload();await world.locator('#mapStatus').filter({hasText:'無法載入'}).waitFor();await context.setGeolocation({latitude:24.9537,longitude:121.225,accuracy:5});await world.locator('#gpsToggle').click();await page.waitForFunction(()=>MarketApp.context().gps.status==='following');assert.equal(await page.evaluate(()=>MarketApp.context().player.lat),24.9537);
 await context.unroute('**/city-data/zhongli.json');await world.locator('#mapStatus button').click();await page.waitForFunction(()=>document.querySelector('iframe[data-view=world]').contentWindow.GPSWorld.city()?.venues.length>0);assert.deepEqual(errors,[]);await context.close();
 const denied=await browser.newContext({permissions:[]}),p=await denied.newPage();await p.goto(base+'/app.html?view=world');await p.locator('#gpsControl:enabled').waitFor();await p.locator('#gpsControl').click();await p.waitForFunction(()=>MarketApp.context().gps.status==='denied');assert.equal(await p.evaluate(()=>MarketApp.context().gps.active),false);await denied.close();
 console.log('PASS geographic city GPS: real movement, background pause, excluded county, inaccurate fix, wardrobe, source failure/recovery and permission denial');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
