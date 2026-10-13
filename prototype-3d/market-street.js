/* An authored, walkable market lane. Architecture is illustrative, not a survey. */
window.createMarketStreetWorld=function(T,scene,sign){
 const root=new T.Group();root.name='market-street';scene.add(root);
 const walls=[],crowd=[],hanging=[],materials=new Map(),batches=new Map();let time=0,seed=82;
 const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 function material(color){if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.83}));return materials.get(color)}
 function mesh(g,c,x,y,z,parent=root){const m=new T.Mesh(g,typeof c==='string'?material(c):c);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
 const box=(w,h,d,c,x,y,z,p)=>mesh(new T.BoxGeometry(w,h,d),c,x,y,z,p);
 const ball=(r,c,x,y,z,p)=>mesh(new T.SphereGeometry(r,12,8),c,x,y,z,p);
 function texture(draw,size=256){const canvas=document.createElement('canvas');canvas.width=canvas.height=size;draw(canvas.getContext('2d'),size);const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;return t}
 const tiles=texture((c,n)=>{c.fillStyle='#c9c1ae';c.fillRect(0,0,n,n);for(let y=0;y<n;y+=32)for(let x=0;x<n;x+=32){c.fillStyle=['#c9c1ae','#bdb5a3','#d3caba','#c2beac'][Math.floor(random()*4)];c.fillRect(x+1,y+1,30,30)}});
 const pavement=texture((c,n)=>{c.fillStyle='#b9b6aa';c.fillRect(0,0,n,n);for(let y=0;y<n;y+=64)for(let x=0;x<n;x+=32){c.fillStyle=random()>.5?'#cac6b9':'#c2bfb2';c.fillRect(x+1+(y/64%2)*16,y+1,30,62)}});pavement.repeat.set(2,18);
 const roadGeo=new T.PlaneGeometry(10,92);roadGeo.rotateX(-Math.PI/2);const streetMesh=mesh(roadGeo,'#5b6060',0,.025,-23);streetMesh.castShadow=false;
 box(180,.25,180,'#97a684',0,-.25,-22);
 for(const side of [-1,1]){box(2.4,.18,92,new T.MeshStandardMaterial({map:pavement,roughness:1}),side*6.2,.04,-23);box(.18,.21,92,'#b5b2a6',side*5.05,.025,-23);box(.12,.014,86,'#b65d52',side*4.92,.05,-23)}
 for(const x of [-.14,.14])box(.09,.012,76,'#e4b553',x,.049,-23);
 for(let k=-5;k<=5;k++)box(.52,.016,3.1,'#e9e5d8',k*.85,.052,12);
 const facadeColors=['#d7c8ab','#bdc5b7','#c9bcb5','#aabbb7','#c9bfa3','#c1bec9'];
 const names=['阿珠青菜','福氣水果行','阿明鮮魚','永和豆腐','巷口早餐','古早味茶舖','阿嬤雜貨','福和肉舖','今天吃什麼','手作饅頭','阿伯修車','市場花店'];
 function board(text,x,y,z,width,side,bg='#29594e',fg='#fff0cf',vertical=false){
  const t=texture((c,n)=>{c.fillStyle=bg;c.fillRect(0,0,n,n);c.fillStyle=fg;c.textAlign='center';c.textBaseline='middle';c.font=vertical?'bold 48px sans-serif':'bold 42px sans-serif';if(vertical){[...text].slice(0,4).forEach((v,i)=>c.fillText(v,n/2,35+i*60))}else c.fillText(text,n/2,n/2)},256);
  const m=mesh(new T.PlaneGeometry(vertical?.75:width,vertical?2.9:.9),new T.MeshBasicMaterial({map:t,side:T.DoubleSide}),x,y,z);m.rotation.y=side>0?-Math.PI/2:Math.PI/2;return m;
 }
 function rail(x,y,z,w){box(.06,.06,w,'#667273',x,y,z);for(let k=-w/2;k<w/2;k+=.33)box(.05,.6,.05,'#667273',x,y-.3,z+k)}
 const shutter=texture((c,n)=>{c.fillStyle='#7f8e88';c.fillRect(0,0,n,n);for(let y=0;y<n;y+=12){c.fillStyle='#65756f';c.fillRect(0,y,n,2)}c.fillStyle='#a5aca1';c.fillRect(35,0,4,n)});
 for(let i=0;i<14;i++){
  const side=i%2?1:-1,index=Math.floor(i/2),z=7-index*8,height=[12.8,10.6,15.2,11.8,13.9,10.9,14][index]+(side>0?1.1:0),front=side*6.15;
  const tiled=new T.MeshStandardMaterial({map:tiles,color:facadeColors[i%6],roughness:.95});box(8,height,7.8,tiled,side*10.15,height/2,z);walls.push({x:side*10.15,z,w:4,d:3.9});
  box(8.3,.25,8.05,'#d9d3c4',side*10.15,height+.08,z);box(.28,1.1,7.9,'#b2ac9f',side*6.05,height+.4,z);
  for(let floor=0;floor<Math.floor((height-3)/2.8);floor++){
   const y=4.8+floor*2.8;
   for(const offset of [-2.2,.1,2.35]){box(.12,1.65,1.6,'#e0ddd0',front-side*.02,y,z+offset);box(.15,1.4,1.38,'#486976',front-side*.09,y,z+offset);box(.18,1.42,.045,'#ced2c9',front-side*.18,y,z+offset);box(.18,.04,1.4,'#ced2c9',front-side*.18,y,z+offset);box(.22,.13,1.9,'#e9e1cc',front-side*.22,y-.87,z+offset)}
   if(floor===0||i%3===0){box(.8,.13,3.9,'#b5bcb2',front-side*.4,y-.9,z-.4);rail(front-side*.8,y-.18,z-.4,3.9)}
   const ac=box(.55,.55,.95,'#e2dfd2',front-side*.4,y-1.17,z+2.3);for(let line=0;line<5;line++)box(.57,.028,.73,'#8f9b96',ac.position.x-side*.01,y-1.37+line*.085,z+2.3);
  }
  // Recessed arcade storefronts, tiled piers and striped fabric awnings.
  if(i%3===2)box(.08,2.65,6.7,new T.MeshStandardMaterial({map:shutter,roughness:.85}),front-side*.06,1.45,z);
  else {box(.09,2.7,6.7,'#394f46',front-side*.06,1.45,z);for(const y of [.6,1.4,2.2]){box(.6,.1,5.5,'#b99a70',front-side*.28,y,z);for(let k=-2;k<=2;k++){box(.32,.45,.5,['#dab876','#a6b88b','#a37957'][Math.abs(k)%3],front-side*.4,y+.28,z+k);}}box(.7,.4,1.3,'#e9d0a2',front-side*.4,.3,z+2.6);}
  for(const offset of [-3.65,3.65]){box(.3,3.5,.3,'#bcb8a9',side*5.2,1.75,z+offset);box(.42,.15,.42,'#8c9386',side*5.2,.2,z+offset)}
  box(1.4,.26,8,'#d7d1bd',side*5.6,3.48,z);
  const canopyColor=['#b94b3f','#4c826a','#bb9549','#597e9a'][i%4];
  for(let strip=0;strip<12;strip++){const a=box(2.35,.06,.61,strip%2?'#f0dfb8':canopyColor,side*5.1,3.15,z-3.35+strip*.61);a.rotation.z=side*.16;box(.06,.23,.61,strip%2?'#f0dfb8':canopyColor,side*3.94,2.86,z-3.35+strip*.61)}
  board(names[i%names.length],side*5.6,3.95,z,6.5,side,canopyColor);
  if(i%2===0){const lamp=ball(.24,'#cd5c43',side*4.9,2.5,z-2.8);lamp.scale.y=1.2;box(.07,.45,.07,'#735b43',side*4.9,2.98,z-2.8);box(.08,.22,.08,'#cd9855',side*4.9,2.1,z-2.8);}
  if(i%3===0){const b=board(i%2?'鮮魚現殺':'水果青菜',side*4.5,5.3,z+3.7,.75,side,'#a64038','#fff4da',true);b.rotation.y=0;hanging.push(b)}
  if(i%4===0){for(let t=0;t<3;t++){const cloth=box(.08,.65,.5,['#d39e6d','#e7ded0','#718ba2'][t],front-side*.9,7.4,z-1+t*.8);cloth.rotation.x=.1;hanging.push(cloth)}}
 }
 function produce(color,x,y,z,s=.16,shape='round'){const key=color+shape;let b=batches.get(key);if(!b)batches.set(key,b={color,shape,list:[]});b.list.push({x,y,z,s})}
 function crate(x,y,z,color='#927044'){box(1,.14,.8,color,x,y,z);for(const dx of [-.49,.49])box(.07,.35,.8,color,x+dx,y+.16,z);for(const dz of [-.37,.37])box(1,.35,.06,color,x,y+.16,z+dz);for(let k=-.3;k<.4;k+=.16)box(.9,.03,.02,'#b09460',x,y+.21+k*.3,z+k)}
 const stallLocations=[[-3.7,-8],[3.7,-8],[-3.65,-23],[3.7,-32],[-3.7,-40],[3.7,1]];
 stallLocations.forEach(([x,z],i)=>{
  const color=['#567d45','#ce8a3e','#718f95','#b0854f','#66875b','#b9714d'][i];
  box(1.7,.8,3.5,'#6a6b55',x,.5,z);box(1.85,.13,3.7,'#b6a37c',x,.98,z);walls.push({x,z,w:.94,d:1.85});
  for(let k=0;k<3;k++){crate(x,1.1,z-1.1+k*1.1);for(let a=0;a<4;a++)for(let b=0;b<3;b++)produce(i===0?'#76a958':i===1?'#df7c36':i===2?'#89a9ae':i===3?'#ded3a8':i===4?'#ce4f3e':'#8eb94d',x-.32+a*.21,1.42+random()*.08,z-1.4+k*1.1+b*.25,i===0?.2:.15,i===2?'fish':'round');}
  for(let k=0;k<2;k++)crate(x,.25,z+2.1+k*.87);
  const tag=board(i===0?'高麗菜 35':i===1?'當季水果':i===2?'今日現流':'新鮮直送',x-Math.sign(x)*.96,1.3,z,2,Math.sign(x),'#eee3b7','#363b2e');tag.scale.set(.75,.55,.75);
  box(.5,.05,.45,'#cad0c1',x,1.06,z-2);box(.25,.1,.2,'#778479',x,1.14,z-2);
 });
 function scooter(x,z,color,rotation){const p=new T.Group();p.position.set(x,0,z);p.rotation.y=rotation;root.add(p);
  for(const zz of [-.61,.61]){const tire=mesh(new T.TorusGeometry(.26,.085,7,16),'#303536',0,.29,zz,p);tire.rotation.y=Math.PI/2;const hub=mesh(new T.CylinderGeometry(.17,.17,.15,12),'#a8b3b4',0,.29,zz,p);hub.rotation.z=Math.PI/2}
  const chassis=ball(.43,color,0,.57,-.05,p);chassis.scale.set(.65,.75,1.6);const fairing=ball(.35,color,0,.77,.52,p);fairing.scale.set(.85,1.4,.55);
  const seat=ball(.32,'#343b3b',0,.9,-.2,p);seat.scale.set(.85,.25,1.5);box(.1,.36,.1,'#a6b4b4',0,1.15,.52,p);box(.68,.07,.08,'#323e3d',0,1.3,.52,p);ball(.13,'#f3e6b7',0,1.03,.7,p);box(.3,.17,.035,'#f0ede0',0,.4,-.84,p);
  for(const dx of [-.33,.33]){box(.025,.24,.025,'#b8c3c2',dx,1.42,.52,p);const mirror=ball(.08,'#b7cbcf',dx,1.57,.52,p);mirror.scale.set(1.3,.75,.3)}
  walls.push({x,z,w:.65,d:.9});
 }
 [[-4.5,4,'#647f8d',.6],[4.4,-17,'#bd6550',-.7],[4.35,-19,'#d4b584',-.35],[-4.3,-33,'#6d8473',.9],[4.4,-42,'#8a7789',-.4]].forEach(v=>scooter(...v));
 // Pots, hanging baskets, stools, delivery crates, drains and utility lines.
 for(let i=0;i<16;i++){const side=i%2?1:-1,z=10-Math.floor(i/2)*8.2,x=side*4.65;if(i%3===0){mesh(new T.CylinderGeometry(.27,.2,.5,12),'#a97454',x,.35,z);for(let j=0;j<5;j++){const leaf=ball(.27,['#59794b','#739350','#829c61'][j%3],x+(random()-.5)*.4,.75+random()*.35,z+(random()-.5)*.4);leaf.scale.y=1.5;}}
  box(.42,.015,.85,'#3d4a47',side*4.75,.058,z-2);for(let k=0;k<5;k++)box(.42,.01,.035,'#8d9690',side*4.75,.071,z-2.3+k*.14);
  if(i%4===0){box(.5,.06,.5,'#b24e3d',side*5.55,.47,z-1);for(const dx of [-.18,.18])for(const dz of [-.18,.18])box(.05,.44,.05,'#b24e3d',side*5.55+dx,.23,z-1+dz)}
 }
 const wires=[];for(const z of [-5,-25,-45]){for(let k=0;k<=20;k++)wires.push(-6+k*.6,9-Math.sin(k/20*Math.PI)*.8,z,-6+(k+1)*.6,9-Math.sin((k+1)/20*Math.PI)*.8,z)}const wireGeo=new T.BufferGeometry();wireGeo.setAttribute('position',new T.Float32BufferAttribute(wires,3));root.add(new T.LineSegments(wireGeo,new T.LineBasicMaterial({color:'#414c48'})));
 for(const z of [-13,-38]){const banner=sign('菜市漫遊 · 早安市場',0,5.8,z,7.4,root);banner.material.side=T.DoubleSide;hanging.push(banner);for(const x of [-4.5,4.5]){mesh(new T.CylinderGeometry(.08,.08,6,8),'#78867a',x,3,z)}}
 for(const [key,b]of batches){const geo=b.shape==='fish'?new T.SphereGeometry(1,10,6):new T.IcosahedronGeometry(1,1),m=new T.InstancedMesh(geo,material(b.color),b.list.length),dummy=new T.Object3D();b.list.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.scale.set(p.s*(b.shape==='fish'?1.8:1),p.s*(b.shape==='fish'?.4:1),p.s);dummy.rotation.set(random(),random(),random());dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix)});m.castShadow=true;root.add(m)}
 // Batch repeated geometry before adding animated characters.
 const staticMeshes=new Map();root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||hanging.includes(o)||o===streetMesh||o.material.isMeshBasicMaterial)return;const key=o.material.uuid+':'+o.geometry.type+':'+JSON.stringify(o.geometry.parameters);if(!staticMeshes.has(key))staticMeshes.set(key,[]);staticMeshes.get(key).push(o)});
 for(const list of staticMeshes.values()){if(list.length<2)continue;const m=new T.InstancedMesh(list[0].geometry,list[0].material,list.length);list.forEach((o,i)=>{m.setMatrixAt(i,o.matrixWorld);o.parent.remove(o);if(i>0)o.geometry.dispose()});m.castShadow=true;m.receiveShadow=true;root.add(m)}
 function person(id,x,z,walking,phase){const kit=(window.FigureGLB&&window.FigureGLB.has(id)?window.FigureGLB:window.FigureKit)?.create(T,id,{castShadow:true});if(!kit)return;root.add(kit.root);kit.root.position.set(x,.15,z);crowd.push({kit,x,z,walking,phase});}
 person('housewife',-1.8,-6,true,0);person('grandpa',1.7,-17,true,2.2);person('auntie',-1.5,-30,true,4);person('kid',1.4,-36,true,5.3);person('uncle',5.15,-8,false,0);person('housewife',-5.2,-23,false,2);person('grandma',-1.7,-44,true,3.1);
 // Close the view with a market entrance, trees and taller roofs beyond the lane.
 box(24,9,8,'#c8bda5',0,4.5,-61);box(11,4.2,.12,'#58746b',0,2.1,-56.9);sign('溪洲市場',0,5.8,-56.7,9,root);box(12,.4,2.5,'#a45b43',0,4.5,-56);
 for(const x of [-18,18])for(let i=0;i<4;i++){mesh(new T.CylinderGeometry(.2,.28,4,8),'#826e51',x,2,-12-i*15);const treetop=ball(2.8,'#72965c',x,5,-12-i*15);treetop.scale.y=1.25;}
 const venue={name:'溪洲公有零售市場',id:'market-xizhou',kind:'market',x:0,z:-53,approach:{x:0,z:10},location:{x:0,z:-60},roof:6,type:'市場街景 · 建築與攤位示意',items:['🥬|蔬菜攤（示意）','🐷|肉品攤（示意）','🐟|海鮮攤（示意）','🍎|水果攤（示意）','🐔|蛋禽攤（示意）','＋|建立新攤位']};
 return {curated:true,root,venues:[venue],labels:[],spawn:{x:0,z:10},bounds:{minX:-5.9,maxX:5.9,minZ:-54,maxZ:15},streetMesh,buildings:{material:material('#c8bda5')},footprints:[],segments:[],closest:p=>({x:0,z:p.z,d:Math.abs(p.x),s:{a:{x:0,z:15},b:{x:0,z:-54},kind:'residential'}}),blocked:(x,z)=>walls.some(w=>Math.abs(x-w.x)<w.w+.18&&Math.abs(z-w.z)<w.d+.18),
  update(dt){time+=Math.min(dt,.15);for(const p of crowd){const distance=p.walking?Math.sin(time*.14+p.phase)*5:0;p.kit.root.position.set(p.x,.15,p.z+distance);p.kit.root.rotation.y=p.walking?(Math.cos(time*.14+p.phase)>0?0:Math.PI):(p.x>0?-Math.PI/2:Math.PI/2);p.kit.update(dt,{speed:p.walking?.7:0});}hanging.forEach((m,i)=>m.rotation.z=Math.sin(time*.8+i)*.015);}
 };
};
