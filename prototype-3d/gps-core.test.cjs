const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const core=fs.existsSync(__dirname+'/gps-core.js')?require('./gps-core.js'):{};
const counties=JSON.parse(fs.readFileSync(__dirname+'/taiwan-counties.json','utf8'));
test('GPS core exposes coverage, projection and tracking',()=>{
  assert.equal(typeof core.createTracker,'function','GPS tracking is missing');
  assert.equal(typeof core.createCoverage,'function');
  assert.equal(typeof core.project,'function');
});
if(core.createTracker){
  const coverage=core.createCoverage(counties);
  test('accepts Taiwan test towns and western cities; rejects excluded counties and overseas',()=>{
    for(const [lat,lng] of [[25.063,121.197],[24.9537,121.225],[25.033,121.5654],[24.1477,120.6736],[22.9997,120.227],[22.6273,120.3014],[22.669,120.486]])assert.equal(coverage({lat,lng}).supported,true,`${lat},${lng}`);
    for(const [lat,lng,county] of [[24.757,121.753,'宜蘭縣'],[23.987,121.601,'花蓮縣'],[22.755,121.15,'臺東縣'],[23.915,120.684,'南投縣']]){const r=coverage({lat,lng});assert.equal(r.supported,false);assert.equal(r.county,county)}
    assert.equal(coverage({lat:35.68,lng:139.76}).supported,false);
    assert.equal(coverage({lat:NaN,lng:121}).supported,false);
  });
  test('projection keeps east positive and north negative and round trips at Taoyuan',()=>{
    const origin={lat:24.95,lng:121.22};
    const east=core.project({lat:24.95,lng:121.2201},origin),north=core.project({lat:24.9501,lng:121.22},origin);
    assert.ok(east.x>10&&east.x<10.2);assert.ok(Math.abs(east.z)<.001);assert.ok(north.z<-11&&north.z>-11.2);
    const round=core.unproject(core.project({lat:25.063,lng:121.197},origin),origin);
    assert.ok(Math.abs(round.lat-25.063)<1e-8);assert.ok(Math.abs(round.lng-121.197)<1e-8);
  });
  function fixture(secure=true){let now=100000,success,error,clears=0;const positions=[],states=[];
    const geo={watchPosition(s,e){success=s;error=e;return 0},clearWatch(){clears++}};
    const tracker=core.createTracker({geolocation:geo,secure,coverage,now:()=>now,onPosition:p=>positions.push(p),onState:s=>states.push({...s})});
    const fix=(lat=24.9537,lng=121.225,accuracy=5,timestamp=now)=>success({coords:{latitude:lat,longitude:lng,accuracy,heading:null,speed:null,altitude:null,altitudeAccuracy:null},timestamp});
    return {tracker,fix,positions,states,error:c=>error({code:c,message:'test'}),later:ms=>now+=ms,old:()=>success,clears:()=>clears};
  }
  test('first fix, movement and small jitter have distinct accepted results',()=>{
    const f=fixture();f.tracker.start();f.fix();assert.equal(f.positions.length,1);assert.equal(f.positions[0].lat,24.9537);
    f.later(1000);f.fix(24.953701);assert.equal(f.positions.length,1,'stationary noise should not walk');
    f.later(1000);f.fix(24.9539);assert.equal(f.positions.length,2);assert.equal(f.tracker.state.status,'following');
  });
  test('stale and inaccurate fixes cannot move the character; good fixes recover',()=>{
    const f=fixture();f.tracker.start();f.fix(24.9537,121.225,200);assert.equal(f.positions.length,0);assert.equal(f.tracker.state.status,'inaccurate');
    f.fix(24.9537,121.225,5,1000);assert.equal(f.positions.length,0);assert.equal(f.tracker.state.status,'stale');
    f.fix();assert.equal(f.positions.length,1);f.later(20000);f.tracker.checkFreshness();assert.equal(f.tracker.state.status,'stale');
    f.fix(24.954);assert.equal(f.tracker.state.status,'following');assert.equal(f.positions.length,2);
  });
  test('stop and suspend invalidate late callbacks and resume requires a fresh fix',()=>{
    const f=fixture();f.tracker.start();const late=f.old();f.fix();f.tracker.stop();
    late({coords:{latitude:24.96,longitude:121.225,accuracy:5},timestamp:100000});assert.equal(f.positions.length,1);assert.equal(f.clears(),1);
    f.tracker.start();f.tracker.suspend();f.fix();assert.equal(f.positions.length,1);assert.equal(f.tracker.state.status,'paused');
    f.tracker.resume();f.fix(25.063,121.197);assert.equal(f.positions.length,2);
  });
  test('HTTPS and permission errors are explicit; transient errors keep tracking',()=>{
    const insecure=fixture(false);insecure.tracker.start();assert.equal(insecure.tracker.state.status,'insecure');assert.equal(insecure.tracker.state.active,false);
    const f=fixture();f.tracker.start();f.error(2);assert.equal(f.tracker.state.active,true);assert.equal(f.tracker.state.status,'unavailable');f.fix();assert.equal(f.positions.length,1);
    f.error(1);assert.equal(f.tracker.state.status,'denied');assert.equal(f.tracker.state.active,false);assert.equal(f.clears(),1);
  });
  test('excluded locations leave the last supported character location in place',()=>{
    const f=fixture();f.tracker.start();f.fix();f.later(1000);f.fix(23.915,120.684);
    assert.equal(f.positions.length,1);assert.equal(f.tracker.state.status,'outside');assert.equal(f.tracker.state.county,'南投縣');
    f.later(1000);f.fix(25.063,121.197);assert.equal(f.positions.length,2);assert.equal(f.tracker.state.status,'following');
  });
}
