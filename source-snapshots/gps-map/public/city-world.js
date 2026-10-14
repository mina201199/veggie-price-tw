/* Geographic road and building geometry. Facades, heights without tags and entrances are illustrative. */
window.createCityWorld=function(T,data,origin){
 'use strict';
 const G=window.MarketGPS,root=new T.Group();root.name='geographic-city';
 const project=p=>G.project({lat:p[0],lng:p[1]},origin),radius=1000,segments=[],footprints=[],labels=[],ownedMaterials=new Map();
 const mat=color=>{if(!ownedMaterials.has(color))ownedMaterials.set(color,new T.MeshStandardMaterial({color,roughness:.9}));return ownedMaterials.get(color)};
 function box(w,h,d,color,x,y,z,parent=root){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
 function sign(text,x,y,z,width=8,parent=root){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#fff8e9';ctx.fillRect(0,0,512,128);ctx.fillStyle='#31513a';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 38px sans-serif';const name=String(text).slice(0,28);ctx.fillText(name,256,64,485);const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;const m=new T.Mesh(new T.PlaneGeometry(width,width/4),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));m.position.set(x,y,z);parent.add(m);return m}
 const ground=new T.Mesh(new T.PlaneGeometry(radius*2.4,radius*2.4),mat('#bdcfae'));ground.rotation.x=-Math.PI/2;ground.position.y=-.05;ground.receiveShadow=true;root.add(ground);
 const roadVertices=[],walkVertices=[];
 function ribbon(a,b,width,y,vertices){const dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);if(l<.01)return;const nx=-dz/l*width/2,nz=dx/l*width/2,p=[[a.x+nx,y,a.z+nz],[a.x-nx,y,a.z-nz],[b.x+nx,y,b.z+nz],[b.x-nx,y,b.z-nz]];for(const k of [0,2,1,1,2,3])vertices.push(...p[k])}
 for(const road of data.roads){const points=road.points.map(project),width=['motorway','trunk','primary'].includes(road.kind)?12:['secondary','tertiary'].includes(road.kind)?9:['footway','path','pedestrian','cycleway','steps'].includes(road.kind)?3:6;
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(Math.min(Math.hypot(a.x,a.z),Math.hypot(b.x,b.z))>radius)continue;if(Math.hypot(a.x-b.x,a.z-b.z)<.1)continue;segments.push({a,b,width,kind:road.kind,name:road.name});ribbon(a,b,width+.9,.01,walkVertices);ribbon(a,b,width,.025,roadVertices)}
 }
 function combined(vertices,color,name){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();const m=new T.Mesh(geometry,mat(color));m.name=name;m.receiveShadow=true;root.add(m);return m}
 combined(walkVertices,'#dde0cc','city-sidewalks');combined(roadVertices,'#8f9d96','city-roads');
 function closest(p){let best=null;for(const s of segments){if(['motorway','motorway_link','trunk','trunk_link','construction'].includes(s.kind))continue;const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,l=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((p.x-s.a.x)*dx+(p.z-s.a.z)*dz)/l)),x=s.a.x+dx*t,z=s.a.z+dz*t,d=Math.hypot(x-p.x,z-p.z);if(!best||d<best.distance)best={x,z,distance:d,s,t}}return best}
 function inside(p,points){let hit=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)hit=!hit}return hit}
 const nearbyVenues=data.venues.map(v=>({...v,location:project([v.lat,v.lng])})).filter(v=>Math.hypot(v.location.x,v.location.z)<radius);
 const buildingVertices=[],buildingColors=[];
 for(const building of data.buildings){const points=building.points.map(project);if(!points.length||Math.min(...points.map(p=>Math.hypot(p.x,p.z)))>radius)continue;
  const height=Math.max(3,Math.min(24,Number(building.height)||Math.max(1,Number(building.levels)||3)*3)),bounds={minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))};
  footprints.push({...bounds,points,height});const venue=nearbyVenues.find(v=>v.location.x>=bounds.minX&&v.location.x<=bounds.maxX&&v.location.z>=bounds.minZ&&v.location.z<=bounds.maxZ&&inside(v.location,points));
  const colors=['#d6d3be','#c8d4c3','#d8d9cc','#d4c8b7'],color=new T.Color(venue?(venue.kind==='market'?'#c9946b':'#87b0a1'):colors[footprints.length%colors.length]);
  const shape=new T.Shape();points.forEach((p,i)=>i?shape.lineTo(p.x,-p.z):shape.moveTo(p.x,-p.z));const geometry=new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,steps:1});geometry.rotateX(-Math.PI/2);const p=geometry.getAttribute('position');
  for(let i=0;i<p.count;i++){buildingVertices.push(p.getX(i),p.getY(i),p.getZ(i));buildingColors.push(color.r,color.g,color.b)}geometry.dispose();
 }
 const buildingMesh=combined(buildingVertices,'#ffffff','city-buildings');buildingMesh.geometry.setAttribute('color',new T.Float32BufferAttribute(buildingColors,3));buildingMesh.material.vertexColors=true;buildingMesh.material.needsUpdate=true;buildingMesh.castShadow=true;
 // OSM footprint coverage is sparse in parts of Dayuan. Inferred townhouses near
 // real shops are explicitly illustrative and never create invented named POIs.
 const houseVertices=[],houseColors=[],windowVertices=[];let houseCount=0;
 function appendBox(vertices,w,h,d,x,y,z,angle,color,colors){let g=new T.BoxGeometry(w,h,d).toNonIndexed();g.rotateY(angle);g.translate(x,y,z);const p=g.getAttribute('position'),c=color?new T.Color(color):null;for(let i=0;i<p.count;i++){vertices.push(p.getX(i),p.getY(i),p.getZ(i));if(colors)colors.push(c.r,c.g,c.b)}g.dispose()}
 const streetsByDistance=[...segments].sort((a,b)=>Math.min(Math.hypot(a.a.x,a.a.z),Math.hypot(a.b.x,a.b.z))-Math.min(Math.hypot(b.a.x,b.a.z),Math.hypot(b.b.x,b.b.z)));
 for(const s of streetsByDistance){if(houseCount>=220)break;if(['motorway','motorway_link','trunk','trunk_link','construction','steps','footway','path','cycleway'].includes(s.kind))continue;
  const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,length=Math.hypot(dx,dz);if(length<14)continue;const ux=dx/length,uz=dz/length,nx=-uz,nz=ux,angle=-Math.atan2(uz,ux);
  for(let along=8;along<length-5&&houseCount<220;along+=14)for(const side of [-1,1]){
   const q={x:s.a.x+ux*along+nx*side*(s.width/2+4.4),z:s.a.z+uz*along+nz*side*(s.width/2+4.4)};
   if(Math.hypot(q.x,q.z)>550||!nearbyVenues.some(v=>Math.hypot(v.location.x-q.x,v.location.z-q.z)<280)||nearbyVenues.some(v=>Math.hypot(v.location.x-q.x,v.location.z-q.z)<20))continue;
   if(footprints.some(b=>q.x+4>b.minX&&q.x-4<b.maxX&&q.z+4>b.minZ&&q.z-4<b.maxZ))continue;const otherRoad=closest(q);if(otherRoad&&otherRoad.distance<otherRoad.s.width/2+2)continue;
   const height=9+(houseCount%3)*2.8,points=[];for(const [a,b]of [[-3,-2.5],[3,-2.5],[3,2.5],[-3,2.5]])points.push({x:q.x+ux*a+nx*b,z:q.z+uz*a+nz*b});footprints.push({points,minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z)),height,illustrative:true});
   appendBox(houseVertices,6,height,5,q.x,height/2,q.z,angle,['#dfcbaa','#c6d5c0','#d6c5b6'][houseCount%3],houseColors);appendBox(houseVertices,6.4,.25,5.3,q.x,height+.12,q.z,angle,'#abb6a0',houseColors);
   for(let y=1.7;y<height-.4;y+=2.4)for(const a of [-1.8,0,1.8])appendBox(windowVertices,1.1,.95,.08,q.x+ux*a-nx*side*2.53,y,q.z+uz*a-nz*side*2.53,angle);
   houseCount++;
  }
 }
 const houses=combined(houseVertices,'#ffffff','city-illustrative-houses');houses.geometry.setAttribute('color',new T.Float32BufferAttribute(houseColors,3));houses.material.vertexColors=true;houses.material.needsUpdate=true;houses.castShadow=true;houses.userData.illustrative=true;combined(windowVertices,'#7baba6','city-illustrative-windows');
 // Restore the authored market-street vocabulary on geographic footprints:
 // tiled walls, framed windows, projecting balconies, AC grilles and arcade shops.
 // Merge detail boxes by function; limit nearby facades for mobile GPU budgets.
 const details=new Map(),tilePanels=[];let facadeCount=0;
 const tileCanvas=document.createElement('canvas');tileCanvas.width=tileCanvas.height=256;const tileCtx=tileCanvas.getContext('2d');tileCtx.fillStyle='#bdb5a3';tileCtx.fillRect(0,0,256,256);
 for(let y=0;y<256;y+=32)for(let x=0;x<256;x+=32){tileCtx.fillStyle=['#c9c1ae','#d3caba','#c2beac'][(x/32+y/32)%3];tileCtx.fillRect(x+1,y+1,30,30)}
 const tileMap=new T.CanvasTexture(tileCanvas);tileMap.colorSpace=T.SRGBColorSpace;
 function frontage(cx,cz,ux,uz,nx,nz,width,height,index){
  const angle=-Math.atan2(uz,ux),w=Math.min(width-.3,24),canopy=['#b94b3f','#4c826a','#bb9549','#597e9a'][index%4];
  function detail(kind,bw,bh,bd,color,x,y,z){if(!details.has(kind))details.set(kind,{vertices:[],colors:[]});const bin=details.get(kind);appendBox(bin.vertices,bw,bh,bd,cx+ux*x+nx*z,y,cz+uz*x+nz*z,angle,color,bin.colors)}
  tilePanels.push({x:cx+nx*.04,z:cz+nz*.04,y:height/2,w,h:height,angle});
  for(let y=4.8;y<height-.7;y+=2.8){
   const count=Math.max(1,Math.floor(w/2.3)),step=w/count;
   for(let k=0;k<count;k++){const x=-w/2+step*(k+.5);
    detail('windows',1.65,1.65,.12,'#e0ddd0',x,y,.12);detail('windows',1.4,1.4,.15,'#486976',x,y,.2);
    detail('windows',.045,1.42,.18,'#ced2c9',x,y,.27);detail('windows',1.4,.045,.18,'#ced2c9',x,y,.27);detail('windows',1.9,.13,.3,'#e9e1cc',x,y-.87,.2);
   }
   const balconyWidth=Math.min(w-.3,3.9);detail('balconies',balconyWidth,.13,.9,'#b5bcb2',0,y-.9,.5);
   detail('balconies',balconyWidth,.06,.06,'#667273',0,y-.18,.95);
   for(let x=-balconyWidth/2;x<=balconyWidth/2;x+=.33)detail('balconies',.05,.65,.05,'#667273',x,y-.5,.95);
   const acX=w/2-.6;detail('airconditioners',.95,.55,.55,'#e2dfd2',acX,y-1.17,.4);
   for(let k=0;k<5;k++)detail('airconditioners',.73,.028,.04,'#8f9b96',acX,y-1.37+k*.085,.7);
  }
  detail('storefronts',w,2.7,.12,'#394f46',0,1.45,.15);
  for(let x=-w/2+.3;x<w/2;x+=2.2)detail('storefronts',.08,2.7,.16,'#c6c7b5',x,1.45,.25);
  for(const x of [-w/2,w/2])detail('storefronts',.3,3.4,.3,'#bcb8a9',x,1.7,1.25);
  detail('storefronts',w+.3,.26,1.5,'#d7d1bd',0,3.48,.65);
  // No invented venue names or retail prices: these are decorative storefronts.
  detail('storefronts',w,.65,.15,canopy,0,3.95,.25);
  const strips=Math.ceil(w/.6),stripWidth=w/strips;
  for(let k=0;k<strips;k++){const x=-w/2+stripWidth*(k+.5),c=k%2?'#f0dfb8':canopy;detail('awnings',stripWidth,.07,1.6,c,x,3.15,.8);detail('awnings',stripWidth,.25,.07,c,x,3.01,1.6)}
 }
 const orderedFootprints=[...footprints].sort((a,b)=>Math.hypot((a.minX+a.maxX)/2,(a.minZ+a.maxZ)/2)-Math.hypot((b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2));
 for(const b of orderedFootprints){if(facadeCount>=160)break;if(Math.hypot((b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2)>300)continue;
  for(let i=1;i<=b.points.length&&facadeCount<160;i++){const a=b.points[i-1],c=b.points[i%b.points.length],dx=c.x-a.x,dz=c.z-a.z,len=Math.hypot(dx,dz);if(len<4)continue;const ux=dx/len,uz=dz/len,count=Math.ceil(len/24),width=len/count;
   for(let part=0;part<count&&facadeCount<160;part++){const along=width*(part+.5),x=a.x+ux*along,z=a.z+uz*along;if(Math.hypot(x,z)>240)continue;const q=closest({x,z});if(!q||q.distance>25)continue;
    const side=((q.x-x)*-uz+(q.z-z)*ux)>=0?1:-1,nx=-uz*side,nz=ux*side;if(inside({x:x+nx*.3,z:z+nz*.3},b.points))continue;
    frontage(x,z,ux,uz,nx,nz,width,b.height,facadeCount);facadeCount++;
   }
  }
 }
 root.userData.detailedFacades=facadeCount;
 for(const [kind,bin]of details){const m=combined(bin.vertices,'#ffffff','city-facade-'+kind);m.geometry.setAttribute('color',new T.Float32BufferAttribute(bin.colors,3));m.material.vertexColors=true;m.material.needsUpdate=true;m.castShadow=true}
 const tileWalls=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({map:tileMap,roughness:.95}),tilePanels.length),dummy=new T.Object3D();tileWalls.name='city-facade-tiles';tilePanels.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.scale.set(p.w,p.h,.08);dummy.rotation.y=p.angle;dummy.updateMatrix();tileWalls.setMatrixAt(i,dummy.matrix)});tileWalls.receiveShadow=true;root.add(tileWalls);
 const venues=nearbyVenues.map(v=>{
  const door=closest(v.location),entrance=door?{x:door.x,z:door.z}:{...v.location},group=new T.Group();group.userData.kind=v.kind;group.userData.venueId=v.id;group.position.set(entrance.x,0,entrance.z);root.add(group);
  const color=v.kind==='market'?'#bb7953':'#43876c',yaw=door?Math.atan2(door.s.b.x-door.s.a.x,door.s.b.z-door.s.a.z)+Math.PI/2:0;const facade=new T.Group();facade.rotation.y=yaw;
  const setback=door?door.s.width/2+2:5;facade.position.set(-Math.sin(yaw)*setback,0,-Math.cos(yaw)*setback);group.add(facade);
  // A colored facade and entrance on the nearest road identify the source POI, not a surveyed doorway.
  box(10,8.4,4,'#d7c8ab',0,4.2,-4,facade);box(10.5,.25,4.6,'#d9d3c4',0,8.55,-4,facade);box(7.8,2.7,.08,'#394f46',0,1.45,-1.95,facade);box(2.5,2.6,.12,color,0,1.35,-1.85,facade);sign(v.name,0,3.8,-1.78,9,facade);
  for(const y of [4.95,7.2]){for(const x of [-3,0,3]){box(1.9,1.65,.12,'#e0ddd0',x,y,-1.9,facade);box(1.65,1.4,.15,'#486976',x,y,-1.8,facade);box(.06,1.4,.18,'#ced2c9',x,y,-1.68,facade);box(2.1,.13,.4,'#e9e1cc',x,y-.87,-1.7,facade)}box(4,.13,.8,'#b5bcb2',0,y-.9,-1.45,facade);box(4,.06,.06,'#667273',0,y-.18,-1.05,facade);for(let x=-2;x<=2;x+=.33)box(.05,.65,.05,'#667273',x,y-.5,-1.05,facade);box(.95,.55,.55,'#e2dfd2',3.5,y-1.17,-1.65,facade)}
  for(const x of [-3.8,3.8]){box(.8,.7,.6,'#927044',x,.4,-1.25,facade);box(.65,.5,.5,'#76a958',x,.94,-1.25,facade)}
  for(const x of [-4.4,4.4])box(.16,3.2,.16,color,x,1.6,-1.4,facade);
  if(v.kind==='market'){for(let i=0;i<8;i++)box(1.3,.12,1.9,i%2?'#f7e5bd':color,-4.55+i*1.3,3,-1,facade)}else{box(10,.15,1.8,color,0,3,-1,facade);sign('生鮮 · 食材',0,2.4,-1.79,5,facade)}
  const marker=new T.Mesh(new T.RingGeometry(2.8,3.1,40),new T.MeshBasicMaterial({color:v.kind==='market'?'#e8bd68':'#84c4b1',side:T.DoubleSide}));marker.rotation.x=-Math.PI/2;marker.position.y=.055;group.add(marker);
  const label=sign(v.name,entrance.x-Math.sin(yaw)*(setback+4),10,entrance.z-Math.cos(yaw)*(setback+4),6);labels.push(label);
  return {...v,entrance,x:entrance.x,z:entrance.z,root:group,doorEstimated:true};
 });
 const seenNames=new Set();for(const s of segments){if(!s.name||s.name==='巷弄'||seenNames.has(s.name)||Math.hypot(s.a.x,s.a.z)>400)continue;seenNames.add(s.name);if(seenNames.size>20)break;const m=sign(s.name,(s.a.x+s.b.x)/2,.09,(s.a.z+s.b.z)/2,Math.min(7,Math.max(4,s.name.length)));m.rotation.x=-Math.PI/2;m.rotation.z=-Math.atan2(s.b.x-s.a.x,s.b.z-s.a.z)}
 return {root,venues,segments,footprints,labels,origin,data,closest,
  blocked(p){return footprints.some(b=>p.x>=b.minX&&p.x<=b.maxX&&p.z>=b.minZ&&p.z<=b.maxZ&&inside(p,b.points))},
  onRoad(p){const q=closest(p);return !!q&&q.distance<=q.s.width/2+.5},
  dispose(){root.removeFromParent();const geometries=new Set(),materials=new Set(),textures=new Set();root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(m);if(m.map)textures.add(m.map)}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose()}
 };
};
