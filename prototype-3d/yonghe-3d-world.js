/* OpenStreetMap street geometry; illustrative building heights and shop appearance. */
window.createYongheWorld=function(T,scene,box,sign,config={}){
 const streets=config.streets||window.YongheStreets,places=config.places||window.YonghePlaces,district=config.district||'永和';
 const lat0=config.origin?config.origin[0]:25.0134505,lng0=config.origin?config.origin[1]:121.5165574;
 const project=([lat,lng])=>({x:(lng-lng0)*111320*Math.cos(lat0*Math.PI/180),z:-(lat-lat0)*111320});
 const roads=streets.roads.map(r=>({...r,points:r.points.map(project)}));
 const corners=streets.bounds,b0=project([corners[0],corners[1]]),b1=project([corners[2],corners[3]]);
 const bounds={minX:b0.x,maxX:b1.x,minZ:b1.z,maxZ:b0.z};
 box(bounds.maxX-bounds.minX+100,.3,bounds.maxZ-bounds.minZ+100,'#b9cea0',(b0.x+b1.x)/2,-.25,(b0.z+b1.z)/2);
 const verts=[];const segments=[];
 for(const r of roads){const width=['primary','secondary','tertiary'].includes(r.kind)?12:['residential','unclassified'].includes(r.kind)?7:3;
  for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);if(l<.01)continue;const nx=-dz/l*width/2,nz=dx/l*width/2;const p=[[a.x+nx,.02,a.z+nz],[a.x-nx,.02,a.z-nz],[b.x+nx,.02,b.z+nz],[b.x-nx,.02,b.z-nz]];for(const k of [0,2,1,1,2,3])verts.push(...p[k]);segments.push({a,b,name:r.name,kind:r.kind,width});}
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.computeVertexNormals();const streetMesh=new T.Mesh(geo,new T.MeshStandardMaterial({color:'#c8ccc6',side:T.DoubleSide,roughness:1}));streetMesh.receiveShadow=true;scene.add(streetMesh);
 const buildingVertices=[],footprints=[];
 for(const b of streets.buildings){const points=b.points.map(project);if(points.some(p=>p.x<bounds.minX-100||p.x>bounds.maxX+100||p.z<bounds.minZ-100||p.z>bounds.maxZ+100))continue;footprints.push({points,height:Math.max(3,Math.min(15,(Number(b.levels)||3)*3)),minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))});const shape=new T.Shape();points.forEach((p,i)=>i?shape.lineTo(p.x,-p.z):shape.moveTo(p.x,-p.z));const g=new T.ExtrudeGeometry(shape,{depth:Math.max(3,Math.min(15,(Number(b.levels)||3)*3)),bevelEnabled:false,steps:1});g.rotateX(-Math.PI/2);const pos=g.getAttribute('position');for(let i=0;i<pos.count;i++)buildingVertices.push(pos.getX(i),pos.getY(i),pos.getZ(i));g.dispose()}
 const bg=new T.BufferGeometry();bg.setAttribute('position',new T.Float32BufferAttribute(buildingVertices,3));bg.computeVertexNormals();const buildings=new T.Mesh(bg,new T.MeshStandardMaterial({color:'#d4d6c8',roughness:.9}));buildings.receiveShadow=true;scene.add(buildings);
 function closest(p){let best=null;for(const s of segments){if(['footway','path','pedestrian','cycleway','corridor'].includes(s.kind))continue;const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,t=Math.max(0,Math.min(1,((p.x-s.a.x)*dx+(p.z-s.a.z)*dz)/(dx*dx+dz*dz)));const q={x:s.a.x+t*dx,z:s.a.z+t*dz},d=Math.hypot(q.x-p.x,q.z-p.z);if(!best||d<best.d)best={...q,d,s,t}}return best}
 const marketItems=['🥬|蔬菜攤（示意）','🐷|肉品攤（示意）','🐟|海鮮攤（示意）','🍎|水果攤（示意）','🐔|蛋禽攤（示意）','＋|建立新攤位'];const storeItems=['🥬|蔬菜區','🍎|水果區','🐷|肉品區','🐟|海鮮區','🐄|乳品區','🥚|雞蛋區'];
 const labels=[];const venues=places.venues.map(v=>{const p=project([v.lat,v.lng]),door=closest(p);const group=new T.Group();scene.add(group);group.position.set(p.x,0,p.z);const color=v.kind==='market'?'#b57552':'#548c82';box(8,3.8,6,'#f2e5cf',0,1.9,0,group);box(8.4,.45,6.4,color,0,4,0,group);box(6,2.2,.1,'#87a8a1',0,1.4,3.04,group);sign(v.name,0,3.35,3.12,8,group);const marker=sign(v.name,door.x,config.liveDistrict?3.4:5,door.z,config.liveDistrict?3.3:9);marker.material.side=T.DoubleSide;labels.push(marker);
  const s=door.s,length=Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z),delta=8/length;const t=door.t>.5?Math.max(0,door.t-delta):Math.min(1,door.t+delta);const approach={x:s.a.x+(s.b.x-s.a.x)*t,z:s.a.z+(s.b.z-s.a.z)*t};
  return {...v,x:door.x,z:door.z,location:p,approach,roof:6,type:(v.kind==='market'?'公有市場':'超市')+' · '+district+'真實位置',items:v.kind==='market'?marketItems:storeItems};
 });
 const source=document.createElement('a');source.href='https://www.openstreetmap.org/copyright';source.target='_blank';source.rel='noopener';source.textContent='街道 © OpenStreetMap ｜建築、室內示意';source.style.cssText='position:absolute;left:20px;top:331px;z-index:4;font-size:9px;color:#31533e;background:#ffffffe8;padding:3px 6px;border-radius:5px';document.getElementById('phone').appendChild(source);
 function blocked(x,z){return footprints.some(b=>{if(x<b.minX||x>b.maxX||z<b.minZ||z>b.maxZ)return false;let inside=false;for(let i=0,j=b.points.length-1;i<b.points.length;j=i++){const a=b.points[i],c=b.points[j];if((a.z>z)!==(c.z>z)&&x<(c.x-a.x)*(z-a.z)/(c.z-a.z)+a.x)inside=!inside}return inside})}
 const unproject=p=>({lat:lat0-p.z/111320,lng:lng0+p.x/(111320*Math.cos(lat0*Math.PI/180))});
 return {venues,labels,bounds,project,unproject,closest,blocked,district,liveDistrict:config.liveDistrict||false,roads,segments,streetMesh,buildings,footprints,spawn:venues[0].approach};
};
