/* Original stylized geometry, not a reconstruction of the reference image. */
window.cityDollStyles = [
 {id:'cream',doll:true,icon:'🎀',name:'奶油露露',subtitle:'波浪長髮 × 奶油裙裝',description:'香草金長髮、粉色小外套，帶著珍珠小包去買今天的晚餐。',bg:'#eee0d6',hair:'#b99366',highlight:'#dbc19b',coat:'#e0b6b0',cloth:'#f5ead9',skin:'#f2c8b3',iris:'#79533a',hairstyle:'long'},
 {id:'peach',doll:true,icon:'🍑',name:'蜜桃朵朵',subtitle:'雙馬尾 × 莓粉洋裝',description:'綁上兩個小蝴蝶結，穿著蓬蓬洋裝，把市場當成週末散步的目的地。',bg:'#f0dce1',hair:'#795344',highlight:'#a77e66',coat:'#ecc7be',cloth:'#ce879f',skin:'#f3c9b8',iris:'#684530',hairstyle:'twin'},
 {id:'cocoa',doll:true,icon:'☕',name:'可可米米',subtitle:'俐落短髮 × 焦糖吊帶褲',description:'可可色短髮和奶白上衣，舒服的吊帶褲最適合逛遍每一個攤位。',bg:'#e8dfcf',hair:'#49372f',highlight:'#785848',coat:'#eee4d2',cloth:'#ac8260',skin:'#dfb396',iris:'#544a38',hairstyle:'bob'},
 {id:'mint',doll:true,icon:'🌿',name:'薄荷悠悠',subtitle:'雙丸子頭 × 鼠尾草綠',description:'圓圓丸子頭、薄荷綠裙裝，側背小包裡裝著今天的採買清單。',bg:'#dfe8df',hair:'#665041',highlight:'#967659',coat:'#cedfcf',cloth:'#87a895',skin:'#f0c5ab',iris:'#657552',hairstyle:'bun'}
];
window.createCityDoll=function(T,s){
 const root=new T.Group(),arms=[],legs=[],materials=new Map();
 function material(c){if(!materials.has(c))materials.set(c,new T.MeshStandardMaterial({color:c,roughness:.65}));return materials.get(c)}
 function mesh(g,c,x,y,z,parent=root){const o=new T.Mesh(g,material(c));o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
 function ball(c,x,y,z,sx,sy,sz,parent=root){const o=mesh(new T.SphereGeometry(1,24,16),c,x,y,z,parent);o.scale.set(sx,sy,sz);return o}
 function cone(c,x,y,z,top,bottom,height,parent=root){return mesh(new T.CylinderGeometry(top,bottom,height,24),c,x,y,z,parent)}
 function strand(points,r,c,parent=root){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));return mesh(new T.TubeGeometry(curve,18,r,7,false),c,0,0,0,parent)}
 function bow(x,y,z){ball(s.cloth,x-.095,y,z,.12,.075,.055).rotation.z=-.4;ball(s.cloth,x+.095,y,z,.12,.075,.055).rotation.z=.4;ball('#f7ddbf',x,y,z+.04,.038,.04,.03)}
 // Tapered body and a softly rounded face, rather than the original mascot hood.
 cone(s.skin,0,2.05,0,.105,.12,.25);
 ball(s.coat,0,1.72,0,.31,.4,.2);
 cone(s.cloth,0,1.36,0,.255,.31,.35);
 if(s.hairstyle!=='bob'){
  cone(s.cloth,0,1.15,0,.28,.45,.44);
  for(let i=0;i<14;i++){const angle=i*Math.PI*2/14;strand([[Math.sin(angle)*.285,1.35,Math.cos(angle)*.285],[Math.sin(angle)*.35,1.13,Math.cos(angle)*.35],[Math.sin(angle)*.435,.945,Math.cos(angle)*.435]],.012,s.coat);}
 }else{
  ball(s.cloth,0,1.6,.173,.21,.23,.045);
  for(const x of [-.17,.17]){strand([[x,1.96,.075],[x,1.84,.18],[x,1.53,.2]],.035,s.cloth);ball('#dec594',x,1.65,.228,.024,.025,.018);}
 }
 for(const side of [-1,1]){
  const arm=new T.Group();arm.position.set(side*.32,1.93,0);root.add(arm);arms.push(arm);
  ball(s.coat,side*.055,-.19,0,.115,.25,.12,arm);
  cone(s.coat,side*.08,-.39,0,.102,.09,.12,arm);
  ball(s.skin,side*.08,-.5,.015,.083,.11,.075,arm);
  const leg=new T.Group();leg.position.set(side*.155,1.12,0);root.add(leg);legs.push(leg);
  ball(s.hairstyle==='bob'?s.cloth:s.skin,0,-.36,0,s.hairstyle==='bob'?.13:.09,.4,.105,leg);
  cone('#faf0df',0,-.82,0,.095,.1,.19,leg);
  ball('#fff5e9',0,-.98,.075,.135,.125,.235,leg);
  ball('#d9cbbd',0,-1.053,.08,.136,.042,.23,leg);
  for(let j=0;j<3;j++)strand([[-.065,-.91+j*.023,.14],[0,-.9+j*.023,.16],[.065,-.91+j*.023,.14]],.009,s.coat,leg);
 }
 // A single continuous face surface; no separate mouth/chin bulge.
 const face=mesh(new T.SphereGeometry(1,48,32),s.skin,0,2.51,.025);face.scale.set(.465,.535,.375);
 for(const side of [-1,1]){
  ball(s.skin,side*.448,2.44,.015,.075,.125,.073);
  ball('#edcf94',side*.451,2.33,.065,.034,.042,.027);
  const x=side*.181;
  ball('#6a4437',x,2.57,.353,.128,.163,.032);
  ball('#fff6ed',x,2.56,.376,.115,.139,.026);
  ball(s.iris,x,2.55,.399,.079,.11,.025);
  ball('#2c2726',x,2.554,.419,.042,.077,.013);
  ball('#ffffff',x-.022,2.599,.434,.027,.032,.012);
  ball('#fff2da',x+.03,2.518,.431,.011,.013,.009);
  strand([[x-.1,2.661,.389],[x,2.707,.37],[x+.1,2.66,.389]],.013,s.hair);
  strand([[x-.08,2.789,.31],[x,2.809,.33],[x+.07,2.779,.32]],.012,s.hair);
  ball('#e5a498',side*.291,2.373,.328,.08,.039,.012);
 }
 ball(s.skin,0,2.422,.401,.044,.057,.048);
 const smile=[[-.065,2.291],[0,2.275],[.065,2.3]].map(([x,y])=>[x,y,.025+.375*Math.sqrt(1-(x/.465)**2-((y-2.51)/.535)**2)+.003]);
 strand(smile,.009,'#b86969');
 // Back hair cap and top crown keep the face open from the front.
 mesh(new T.SphereGeometry(.49,28,18,Math.PI,Math.PI),s.hair,0,2.56,-.025).scale.set(1,1.12,.85);
 mesh(new T.SphereGeometry(.49,28,12,0,Math.PI*2,0,.96),s.hair,0,2.56,-.025).scale.set(1,1.12,.9);
 for(const side of [-1,1]){
  for(let j=0;j<3;j++){
   strand([[side*(.015+j*.042),3.063-j*.018,.025],[side*.24,2.976-j*.035,.29],[side*(.37+j*.025),2.75-j*.06,.29],[side*(.43+j*.02),2.52-j*.07,.09]],.065,s.hair);
   strand([[side*(.035+j*.04),3.094-j*.018,.05],[side*.24,3.004-j*.035,.30],[side*(.38+j*.025),2.78-j*.06,.3]],.009,s.highlight);
  }
 }
 if(s.hairstyle==='long'){
  for(let j=0;j<9;j++){const angle=.05+j*Math.PI/8;const x=Math.cos(angle)*.39,z=-Math.sin(angle)*.3;
   strand([[x,2.78,z],[x*1.17,2.36,z-.03],[x*1.26,1.98,z-.02],[x*1.42,1.67,z+.03],[x*1.28,1.45,z+.055]],.085,s.hair);
   strand([[x,2.78,z-.075],[x*1.17,2.36,z-.105],[x*1.26,1.98,z-.095],[x*1.42,1.67,z-.045]],.011,s.highlight);
  }
  bow(.37,2.8,.22);
 }else if(s.hairstyle==='twin'){
  for(const side of [-1,1]){for(let j=0;j<3;j++)strand([[side*.4,2.67,-.14],[side*(.58+j*.05),2.37,-.12],[side*(.59+j*.04),2.04,-.04],[side*(.52+j*.04),1.82,.03]],.087,j===1?s.highlight:s.hair);bow(side*.48,2.65,.02);}
 }else if(s.hairstyle==='bob'){
  for(let j=0;j<9;j++){const angle=j*Math.PI/8;const x=Math.cos(angle)*.41,z=-Math.sin(angle)*.32;strand([[x,2.72,z],[x*1.1,2.43,z-.015],[x*1.04,2.17,z+.025]],.083,s.hair);}
  strand([[-.37,2.71,.29],[-.42,2.65,.25]],.025,'#ddc488');
 }else{
  for(const side of [-1,1]){ball(s.hair,side*.43,2.96,-.09,.225,.23,.2);strand([[side*.51,2.83,.05],[side*.6,3.02,.01],[side*.43,3.13,.04],[side*.29,2.99,.04]],.018,s.highlight);bow(side*.45,2.8,.06);}
 }
 if(s.hairstyle!=='bob'){
  for(const side of [-1,1])ball(s.coat,side*.23,1.73,.115,.11,.29,.14);
  for(let y=1.52;y<1.95;y+=.13)ball('#ead1a6',.115,y,.252,.021,.023,.016);
 }
 // Cross-body strap and a small rounded shopping bag.
 strand([[-.27,1.96,.17],[0,1.62,.245],[.32,1.24,.21]],.021,'#b29573');
 ball('#f0dfc3',.34,1.2,.18,.18,.17,.095);
 ball('#dec38e',.34,1.22,.273,.028,.026,.01);
 return {root,arms,legs};
};
