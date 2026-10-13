window.createRoadNetwork=function(segments){
 const usable=segments.filter(s=>!['motorway','motorway_link','trunk','trunk_link','construction'].includes(s.kind));
 const nodes=[],index=new Map(),edges=[];const key=p=>p.x.toFixed(2)+','+p.z.toFixed(2);
 function node(p){const k=key(p);if(!index.has(k)){index.set(k,nodes.length);nodes.push(p);edges.push([])}return index.get(k)}
 usable.forEach(s=>{s.i=node(s.a);s.j=node(s.b);const d=Math.hypot(s.a.x-s.b.x,s.a.z-s.b.z);edges[s.i].push([s.j,d]);edges[s.j].push([s.i,d]);});
 const grid=new Map(),cell=64;
 usable.forEach(s=>{for(let x=Math.floor(Math.min(s.a.x,s.b.x)/cell);x<=Math.floor(Math.max(s.a.x,s.b.x)/cell);x++)for(let z=Math.floor(Math.min(s.a.z,s.b.z)/cell);z<=Math.floor(Math.max(s.a.z,s.b.z)/cell);z++){const k=x+','+z;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(s)}});
 function nearest(p){const candidates=new Set(),gx=Math.floor(p.x/cell),gz=Math.floor(p.z/cell);for(let x=gx-1;x<=gx+1;x++)for(let z=gz-1;z<=gz+1;z++)for(const s of grid.get(x+','+z)||[])candidates.add(s);
  function search(list){let best;for(const s of list){const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,l=dx*dx+dz*dz;if(!l)continue;const t=Math.max(0,Math.min(1,((p.x-s.a.x)*dx+(p.z-s.a.z)*dz)/l)),x=s.a.x+dx*t,z=s.a.z+dz*t,d=Math.hypot(p.x-x,p.z-z);if(!best||d<best.d)best={s,t,x,z,d,length:Math.sqrt(l)}}return best}
  const best=search(candidates);return best&&best.d<cell?best:search(usable);
 }
 function route(from,to){const a=nearest(from),b=nearest(to);if(!a||!b)return null;if(a.s===b.s)return [[b.x,b.z]];
  const dist=new Float64Array(nodes.length).fill(Infinity),previous=new Int32Array(nodes.length).fill(-1),done=new Uint8Array(nodes.length);dist[a.s.i]=a.t*a.length;dist[a.s.j]=(1-a.t)*a.length;
  for(let step=0;step<nodes.length;step++){let n=-1,best=Infinity;for(let i=0;i<nodes.length;i++)if(!done[i]&&dist[i]<best){best=dist[i];n=i}if(n<0)break;done[n]=1;for(const [j,d]of edges[n])if(dist[n]+d<dist[j]){dist[j]=dist[n]+d;previous[j]=n;}}
  let end=dist[b.s.i]+b.t*b.length<dist[b.s.j]+(1-b.t)*b.length?b.s.i:b.s.j;if(!Number.isFinite(dist[end]))return null;const path=[];for(let n=end;n>=0;n=previous[n])path.unshift([nodes[n].x,nodes[n].z]);path.unshift([a.x,a.z]);path.push([b.x,b.z]);return path.filter((p,i)=>i===0||Math.hypot(p[0]-path[i-1][0],p[1]-path[i-1][1])>.1);
 }
 return {route,nearest,onRoad:(x,z)=>{const n=nearest({x,z});return !!n&&n.d<=(n.s.width||7)/2+1.8}};
};
