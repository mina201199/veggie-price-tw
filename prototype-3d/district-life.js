/* Street life decorates the real road network; shop appearance remains illustrative. */
window.createDistrictLife=function(T,scene,city,sign){
 const root=new T.Group();scene.add(root);const palette=['#b8624c','#578675','#b79450','#658b9b'],crowd=[],colliders=[];let anchor=null,elapsed=0;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='#c9c3b4';ctx.fillRect(0,0,128,128);for(let x=0;x<128;x+=16)for(let y=0;y<128;y+=16){ctx.fillStyle=(x+y)%32?'#c9c3b4':'#c1baaa';ctx.fillRect(x+1,y+1,14,14)}const tile=new T.CanvasTexture(canvas);tile.colorSpace=T.SRGBColorSpace;
 const materials=new Map(),geometries={box:new T.BoxGeometry(1,1,1),ball:new T.SphereGeometry(1,10,7)};let bins=new Map();
 function shape(type,color,x,y,z,w,h,d,angle=0){const key=type+color;if(!bins.has(key))bins.set(key,{type,color,list:[]});bins.get(key).list.push({x,y,z,w,h,d,angle})}
 const cube=(w,h,d,c,x,y,z,a=0)=>shape('box',c,x,y,z,w,h,d,a);
 const sphere=(r,c,x,y,z)=>shape('ball',c,x,y,z,r,r,r);
 function mat(c){if(!materials.has(c))materials.set(c,new T.MeshStandardMaterial({color:c,roughness:.88,...(c==='#d3cab7'?{map:tile}:{})}));return materials.get(c)}
 function clear(){crowd.splice(0).forEach(p=>p.kit.dispose());root.children.slice().forEach(o=>{root.remove(o);if(o.isInstancedMesh)o.dispose();else if(o.isMesh){o.geometry.dispose();if(o.material.map)o.material.map.dispose();o.material.dispose()}});colliders.length=0;bins=new Map()}
 const originalBlocked=city.blocked;city.blocked=(x,z)=>{const n=city.network.nearest({x,z});const inRoad=n&&n.d<Math.max(1,(n.s.width||7)/2-.5);return (!inRoad&&originalBlocked(x,z))||colliders.some(c=>{const dx=x-c.x,dz=z-c.z;return Math.abs(dx*c.ux+dz*c.uz)<c.w&&Math.abs(dx*c.uz-dz*c.ux)<c.d})};
 const activity=(x,z)=>Math.max(...city.venues.map(v=>Math.max(0,1-Math.hypot(x-v.x,z-v.z)/190)));
 function build(p){clear();anchor={x:p.x,z:p.z};let facades=0;
  for(const f of city.footprints){if(f.maxX<p.x-145||f.minX>p.x+145||f.maxZ<p.z-145||f.minZ>p.z+145)continue;let best;
   for(let i=1;i<f.points.length;i++){const a=f.points[i-1],b=f.points[i],len=Math.hypot(b.x-a.x,b.z-a.z);if(len<5||len>90)continue;const x=(a.x+b.x)/2,z=(a.z+b.z)/2,n=city.network.nearest({x,z});if(!n||n.d<(n.s.width||7)/2-.5||n.d>(n.s.width||7)/2+12)continue;if(!best||n.d<best.n.d)best={a,b,len,x,z,n}}
   if(!best||facades++>110)continue;const {a,b,len,x,z,n}=best,ux=(b.x-a.x)/len,uz=(b.z-a.z)/len,nx=(n.x-x)/n.d,nz=(n.z-z)/n.d,w=Math.min(len-.3,14),angle=Math.atan2(ux,uz)+Math.PI/2,h=f.height||9,life=activity(x,z),color=palette[facades%4];
   const off=(along,out,y)=>({x:x+ux*along+nx*out,y,z:z+uz*along+nz*out});
   function part(ww,hh,dd,c,along,y,out){const q=off(along,out,y);cube(ww,hh,dd,c,q.x,q.y,q.z,angle)}
   part(w,h,.09,'#d3cab7',0,h/2,.04);
   for(let floor=0;floor<Math.min(5,Math.floor((h-3)/2.8));floor++)for(let k=-w/2+1;k<w/2;k+=2.4){part(1.65,1.5,.15,'#e0ddd0',k,4.7+floor*2.8,.12);part(1.4,1.28,.17,'#526f7a',k,4.7+floor*2.8,.19);part(.04,1.3,.2,'#d8ded4',k,4.7+floor*2.8,.26);part(1.8,.12,.35,'#e5ddc9',k,3.9+floor*2.8,.3);if(floor===0){part(.75,.48,.6,'#dcd9cb',k,3.55,.43);for(let j=0;j<4;j++)part(.6,.035,.61,'#85928d',k,3.38+j*.09,.46)}}
   part(w,2.7,.15,facades%3?'#3e544c':'#8a9690',0,1.45,.13);if(facades%3)for(let k=-w/2+.5;k<w/2;k+=.6)for(const yy of [.6,1.3,2])part(.4,.4,.35,k%2?'#d5b67d':'#9aae7c',k,yy,.38);
   const out=Math.min(1.5,Math.max(.3,n.d-(n.s.width||7)/2));part(w,.2,out,'#c7c0ad',0,.1,out/2);
   if(life>.2){for(let k=0;k<12;k++)part(w/12,.07,1.6,k%2?'#f1dfb9':color,-w/2+(k+.5)*w/12,3.12,.6);part(w,.22,.08,color,0,2.96,1.38);for(const k of [-w/2+.2,w/2-.2])part(.17,3.2,.17,'#b9b6a7',k,1.6,.9);
    const q=off(0,.48,3.65),board=sign(['阿珠青菜','巷口早餐','福氣水果','古早味小吃','阿嬤雜貨'][facades%5],q.x,q.y,q.z,Math.min(5.5,w),root);board.rotation.y=Math.atan2(nx,nz);
   }
   const pot=off(w/2-.65,.6,.3);cube(.42,.45,.42,'#ab7856',pot.x,pot.y,pot.z);for(let k=0;k<3;k++)sphere(.3,'#789557',pot.x+(k-1)*.18,.85,pot.z);
  }
  // Shop modules fill gaps in facade coverage without moving any road centreline.
  let modules=0;
  for(const s of [...city.segments].sort((a,b)=>Math.hypot((a.a.x+a.b.x)/2-p.x,(a.a.z+a.b.z)/2-p.z)-Math.hypot((b.a.x+b.b.x)/2-p.x,(b.a.z+b.b.z)/2-p.z))){const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,l=Math.hypot(dx,dz),width=s.width||7,mx=(s.a.x+s.b.x)/2,mz=(s.a.z+s.b.z)/2;if(l<7||width<6||width>9||Math.hypot(mx-p.x,mz-p.z)>105||activity(mx,mz)<.28)continue;const ux=dx/l,uz=dz/l,nx=uz,nz=-ux,angle=Math.atan2(ux,uz);
   for(let t=Math.min(4,l/2);t<l-2;t+=7.5)for(const side of [-1,1]){if(modules>70)break;const rx=s.a.x+ux*t,rz=s.a.z+uz*t;let distance=width/2+1.4;
    for(let d=.75;d<12;d+=.2)if(originalBlocked(rx+nx*d*side,rz+nz*d*side)){distance=d-.25;break}
    if(distance<1.9)continue;const x=rx+nx*distance*side,z=rz+nz*distance*side,n=city.network.nearest({x,z});if(n&&n.s!==s&&n.d<1.3)continue;
    let crossesRoad=false;for(let q=-3.6;q<=3.6;q+=.6){const road=city.network.nearest({x:x+ux*q,z:z+uz*q});if(road&&road.d<1.8){crossesRoad=true;break}}if(crossesRoad)continue;
    const color=palette[modules++%4];colliders.push({x,z,ux,uz,w:3.4,d:.19});
    cube(.15,10.5,7,'#d3cab7',x,5.25,z,angle);cube(.18,2.7,6.7,'#40574b',x-nx*.12*side,1.45,z-nz*.12*side,angle);
    for(const y of [4.6,7.4,9.5])for(const k of [-2.2,.1,2.3]){const xx=x+ux*k-nx*.15*side,zz=z+uz*k-nz*.15*side;cube(.18,1.6,1.6,'#e0ddd0',xx,y,zz,angle);cube(.22,1.35,1.4,'#52747f',xx-nx*.06*side,y,zz-nz*.06*side,angle);cube(.27,.05,1.4,'#c6d0c8',xx-nx*.13*side,y,zz-nz*.13*side,angle);cube(.24,1.35,.04,'#c6d0c8',xx-nx*.13*side,y,zz-nz*.13*side,angle);cube(.65,.45,.85,'#e2dccb',xx-nx*.3*side,y-1,zz-nz*.3*side,angle);}
    for(let k=0;k<10;k++){const q=-3.15+k*.7;cube(1.8,.07,.68,k%2?'#efdeb6':color,x+ux*q-nx*.65*side,3.08,z+uz*q-nz*.65*side,angle);cube(.06,.23,.68,k%2?'#efdeb6':color,x+ux*q-nx*1.55*side,2.96,z+uz*q-nz*1.55*side,angle)}
    for(const k of [-3.3,3.3])cube(.18,3.2,.18,'#bab7a5',x+ux*k-nx*.9*side,1.6,z+uz*k-nz*.9*side);
    const board=sign(['阿珠青菜','福氣水果','巷口早餐','古早味小吃','阿嬤雜貨'][modules%5],x-nx*.5*side,3.8,z-nz*.5*side,5.6,root);board.rotation.y=Math.atan2(-nx*side,-nz*side);
   }
  }
  // Carts and scooters sit along road edges, leaving the centre and junctions open.
  let stalls=0,scooters=0;const eligible=[];
  for(const s of [...city.segments].sort((a,b)=>Math.hypot((a.a.x+a.b.x)/2-p.x,(a.a.z+a.b.z)/2-p.z)-Math.hypot((b.a.x+b.b.x)/2-p.x,(b.a.z+b.b.z)/2-p.z))){const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,l=Math.hypot(dx,dz),mx=(s.a.x+s.b.x)/2,mz=(s.a.z+s.b.z)/2,width=s.width||7;if(Math.hypot(mx-p.x,mz-p.z)>125||l<12||width<6||['primary','secondary','trunk','motorway'].includes(s.kind))continue;const ux=dx/l,uz=dz/l,nx=uz,nz=-ux,angle=Math.atan2(ux,uz),life=activity(mx,mz);if(life>.35)eligible.push(s);
   for(let t=5;t<l-5;t+=life>.35?10:26){const side=Math.floor(t/10)%2?1:-1,offset=width/2-.75,x=s.a.x+ux*t+nx*offset*side,z=s.a.z+uz*t+nz*offset*side;if(Math.hypot(x-p.x,z-p.z)>130)continue;
    if(life>.35&&stalls<24){const c=palette[stalls%4];cube(.95,.8,2.3,'#81745a',x,.55,z,angle);cube(1.1,.12,2.5,'#b8a47b',x,1,z,angle);cube(1.4,.08,2.8,c,x,2.8,z,angle);for(const off of [-1,1])cube(.05,2.8,.05,'#798479',x+ux*off,.0+1.4,z+uz*off);for(let k=-1;k<=1;k++)for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)sphere(.16,stalls%3===0?'#7fab55':stalls%3===1?'#d79044':'#c85d48',x+nx*a*.24+ux*(k*.68+b*.2),1.25,z+nz*a*.24+uz*(k*.68+b*.2));
     const frontx=x-nx*side*.6,frontz=z-nz*side*.6;const tag=sign(stalls%3===0?'今日青菜':stalls%3===1?'當季水果':'新鮮直送',frontx,1.1,frontz,1.8,root);tag.rotation.y=Math.atan2(-nx*side,-nz*side);colliders.push({x,z,ux,uz,w:1.3,d:.7});stalls++;
    }else if(scooters<22){const c=palette[scooters++%4];cube(.5,.4,1,c,x,.6,z,angle+.35);cube(.42,.12,.65,'#303a39',x,.87,z,angle+.35);for(const off of [-.55,.55])sphere(.22,'#303837',x+ux*off,.25,z+uz*off);cube(.08,.65,.08,'#bac5c1',x+ux*.5,.91,z+uz*.5);cube(.6,.07,.1,'#33413e',x+ux*.5,1.2,z+uz*.5,angle);}
   }
  }
  const dummy=new T.Object3D();for(const b of bins.values()){const m=new T.InstancedMesh(geometries[b.type],mat(b.color),b.list.length);b.list.forEach((q,i)=>{dummy.position.set(q.x,q.y,q.z);dummy.rotation.set(0,q.angle,0);dummy.scale.set(q.w,q.h,q.d);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix)});m.castShadow=true;m.receiveShadow=true;root.add(m)}
  eligible.sort((a,b)=>Math.hypot((a.a.x+a.b.x)/2-p.x,(a.a.z+a.b.z)/2-p.z)-Math.hypot((b.a.x+b.b.x)/2-p.x,(b.a.z+b.b.z)/2-p.z));
  for(let i=0;i<Math.min(6,eligible.length);i++){const s=eligible[i],id=['housewife','grandpa','auntie','kid','uncle','grandma'][i],kit=(window.FigureGLB?.has(id)?window.FigureGLB:window.FigureKit)?.create(T,id,{castShadow:true});if(!kit)continue;root.add(kit.root);crowd.push({kit,s,phase:i*.75});}
 }
 return {activity,update(dt,p,inside){root.visible=!inside;if(inside)return;if(!anchor||Math.hypot(p.x-anchor.x,p.z-anchor.z)>55)build(p);elapsed+=dt;for(const c of crowd){const s=c.s,dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,l=Math.hypot(dx,dz),t=.5+Math.sin(elapsed*.1+c.phase)*.33,side=c.phase%2<1?1:-1;const x=s.a.x+dx*t+dz/l*1.2*side,z=s.a.z+dz*t-dx/l*1.2*side;c.kit.root.position.set(x,0,z);c.kit.root.rotation.y=Math.atan2(dx,dz)+(Math.cos(elapsed*.1+c.phase)<0?Math.PI:0);c.kit.update(dt,{speed:.7});}}};
};
