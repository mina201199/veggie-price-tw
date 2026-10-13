const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/road-network.js','utf8'),c);
const segments=[{a:{x:0,z:0},b:{x:10,z:0},width:7},{a:{x:10,z:0},b:{x:10,z:10},width:7},{a:{x:10,z:10},b:{x:20,z:10},width:7}];
const network=c.window.createRoadNetwork(segments);
const route=network.route({x:2,z:0},{x:18,z:10});assert.ok(route.length>=3,'must follow corner rather than cut across buildings');assert.ok(route.some(p=>p[0]===10&&p[1]===0));assert.ok(route.some(p=>p[0]===10&&p[1]===10));assert.equal(network.route({x:4,z:0},{x:8,z:0}).length,1);
const separate=c.window.createRoadNetwork([...segments,{a:{x:30,z:30},b:{x:40,z:30},width:7}]);assert.equal(separate.route({x:2,z:0},{x:35,z:30}),null,'disconnected roads must not produce a straight shortcut');
assert.ok(network.onRoad(5,3));assert.equal(network.onRoad(5,20),false);console.log('Road routing: corners, same segment, disconnected paths, road clearance PASS');
