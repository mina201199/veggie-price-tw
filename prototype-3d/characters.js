/* 換角色: the twelve market folk (FigureKit, figure-cast.js) and the three cats 歐巴、波妞、小橘 (CatKit, cats.js).
   Code-built models only; the choice is remembered on this device. */
window.createCuteWardrobe=function(T,{host,body,onOpen,onClose}){
const FK=window.FigureKit;
// Wardrobe card copy for each figure: icon, subtitle, a line about them, and the preview backdrop.
const FOLK={
 grandma:['🛒','紫色漁夫帽 × 格紋菜籃車','推著菜籃車慢慢逛，每一攤的價錢她都記得清清楚楚。','#ece0f0'],
 chief:['📣','紅背心 × 麥克風','拿著麥克風巡里，哪一攤今天特價，他最先知道。','#f3dcd8'],
 mechanic:['🔧','連身工作服 × 活動扳手','機車行修到一半，趁空檔來市場買便當配菜。','#dbe3ea'],
 grandpa:['🦯','米色襯衫 × 木頭拐杖','拄著拐杖散步到市場，一邊挑菜一邊跟老闆聊天。','#ebe3d6'],
 courier:['🛵','青綠安全帽 × 外送保溫箱','送完一單，順手查一下今天的菜價。','#f5ead0'],
 auntie:['🧺','捲捲燙髮 × 透明遮陽帽','提著綠色菜籃，最會比價也最會殺價。','#f6dfd6'],
 uncle:['🍵','白色汗衫 × 保溫水壺','穿著藍白拖晃到市場，水壺裡裝著熱茶。','#dfe4ef'],
 housewife:['🧹','格紋圍裙 × 雞毛撢子','打掃完家裡，拿著花布提袋出門補貨。','#e3eee4'],
 griller:['🍢','深藍頭巾 × 烤肉夾','夜市烤肉攤老闆，白天先來挑最新鮮的肉。','#f3e0d2'],
 kid:['🎒','黃色小帽 × 小熊背包','放學跟家人一起來買菜，最喜歡水果攤。','#f6efcf'],
 taike:['🥤','西瓜頭 × 彩色刺青','短腿圓肚、粗金項鍊配窄版刷破牛仔褲，穿夾腳拖來買飲料。','#e5e1dc'],
 cook:['🍳','碎花頭巾 × 鍋鏟','自助餐阿姨一早來批菜，今天的青菜要炒三大盤。','#e2efe6']
};
const styles=[...Object.keys(FK.cast).map(id=>{const [icon,subtitle,description,bg]=FOLK[id]||['🙂',FK.cast[id].role,'',"#efe6dc"];return {id,icon,name:FK.cast[id].name,subtitle,description,bg}}),...window.cityCatStyles];
const DEFAULT='grandma',cache=new Map(),previewKits=new Map();
let selected=null,open=false,previewFrame=0,previewGroup,previewRenderer,previewScene,previewCamera,previewKit=null,previewLast=0,angle=.22,walking=false;
function build(s){
 if(s.cat){const c=window.createCityCat(T,s);c.cat=true;return c}
 const fig=FK.create(T,s.id,{castShadow:true});fig.root.traverse(o=>{if(o.isMesh)o.castShadow=true});
 return {root:fig.root,kit:fig};
}
function apply(id){
 const s=styles.find(v=>v.id===id)||styles.find(v=>v.id===DEFAULT);
 if(selected&&cache.has(selected))body.remove(cache.get(selected).root);
 selected=s.id;
 if(!cache.has(s.id))cache.set(s.id,build(s));
 body.add(cache.get(s.id).root);body.position.y=0;
 try{localStorage.setItem('veggie-avatar-v1',s.id)}catch(_){}
 panel.querySelector('#wearAvatar').textContent=s.cat?'帶這隻去逛街 →':'帶這位去逛街 →';
 trigger.textContent=s.icon+' 換角色';
 cards.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.id===s.id?'true':'false'));
 title.textContent=s.name;subtitle.textContent=s.subtitle;description.textContent=s.description;stage.style.background=s.bg;
 refreshPreview();
}
const trigger=document.createElement('button');trigger.id='avatarTrigger';trigger.textContent='🛒 換角色';host.appendChild(trigger);
const panel=document.createElement('section');panel.id='wardrobe';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','avatarTitle');
panel.innerHTML='<div class="wardrobe-head"><div><small>市場人物 · 原創 3D 角色</small><h2>今天想當哪一位？</h2></div><button id="closeWardrobe" aria-label="關閉角色選單">✕</button></div><div id="avatarStage" aria-label="目前角色的立體預覽"></div><div class="preview-actions"><button id="avatarTurn">↻ 看背面</button><button id="avatarWalk" aria-pressed="false">試走幾步</button></div><h3 id="avatarTitle"></h3><p id="avatarSubtitle"></p><p id="avatarDescription"></p><div id="avatarCards" aria-label="角色選擇"></div><button id="wearAvatar">帶這位去逛街 →</button><small class="wardrobe-foot">所有角色都能免費換；只記住這台裝置的選擇。</small>';
host.appendChild(panel);
const stage=panel.querySelector('#avatarStage'),cards=panel.querySelector('#avatarCards'),title=panel.querySelector('#avatarTitle'),subtitle=panel.querySelector('#avatarSubtitle'),description=panel.querySelector('#avatarDescription');
styles.forEach(s=>{const b=document.createElement('button');b.dataset.id=s.id;b.setAttribute('aria-pressed','false');b.innerHTML='<span>'+s.icon+'</span><b>'+s.name+'</b><small>'+s.subtitle+'</small>';b.onclick=()=>apply(s.id);cards.appendChild(b)});
function setupPreview(){if(previewRenderer)return;previewRenderer=new T.WebGLRenderer({antialias:true,alpha:true});previewRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));previewRenderer.outputColorSpace=T.SRGBColorSpace;previewRenderer.toneMapping=T.ACESFilmicToneMapping;previewRenderer.toneMappingExposure=1;stage.appendChild(previewRenderer.domElement);previewScene=new T.Scene();previewScene.add(new T.HemisphereLight(0xfff7e8,0x9caa98,2.5));const light=new T.DirectionalLight(0xfff4db,3);light.position.set(-3,5,6);previewScene.add(light);previewCamera=new T.PerspectiveCamera(34,1,.1,30);const disk=new T.Mesh(new T.CylinderGeometry(.95,1,.12,48),new T.MeshStandardMaterial({color:'#fff4df'}));disk.position.y=.06;previewScene.add(disk);new ResizeObserver(()=>{if(open){sizePreview();renderPreview()}}).observe(stage)}
function sizePreview(){const r=stage.getBoundingClientRect();if(r.width&&r.height){previewRenderer.setSize(r.width,r.height);previewCamera.aspect=r.width/r.height;previewCamera.updateProjectionMatrix()}}
// The preview gets its own copy of the character, so it can turn and walk without touching the one in the city.
function refreshPreview(){if(!open)return;setupPreview();const s=styles.find(v=>v.id===selected);if(previewGroup)previewScene.remove(previewGroup);previewGroup=new T.Group();previewGroup.position.y=.12;
 if(!previewKits.has(s.id))previewKits.set(s.id,s.cat?window.createCityCat(T,s).kit:FK.create(T,s.id));previewKit=previewKits.get(s.id);
 if(s.cat)previewKit.setState('stand');previewGroup.add(previewKit.root);previewScene.add(previewGroup);
 const h=s.cat?2:previewKit.height();previewCamera.position.set(0,h*.62+.35,h*1.75+.9);previewCamera.lookAt(0,h*.5,0);sizePreview();renderPreview()}
function renderPreview(){if(!previewGroup)return;previewGroup.rotation.y=angle;previewRenderer.render(previewScene,previewCamera)}
function animate(now){if(!open)return;const dt=Math.min(.05,(now-(previewLast||now))/1000);previewLast=now;const s=styles.find(v=>v.id===selected);if(previewKit)previewKit.update(dt,s.cat?{speed:walking?1.3:0,look:previewCamera.position}:{speed:walking?3:0});renderPreview();previewFrame=requestAnimationFrame(animate)}
function show(){if(open)return;open=true;onOpen();panel.hidden=false;angle=.22;walking=false;previewLast=0;panel.querySelector('#avatarWalk').setAttribute('aria-pressed','false');panel.querySelector('#avatarTurn').textContent='↻ 看背面';refreshPreview();previewFrame=requestAnimationFrame(animate);panel.querySelector('#closeWardrobe').focus()}
function hide(){if(!open)return;open=false;cancelAnimationFrame(previewFrame);panel.hidden=true;onClose();trigger.focus()}
trigger.onclick=show;panel.querySelector('#closeWardrobe').onclick=hide;panel.querySelector('#wearAvatar').onclick=hide;
panel.querySelector('#avatarTurn').onclick=e=>{angle=angle<1?Math.PI+.22:.22;e.currentTarget.textContent=angle<1?'↻ 看背面':'↻ 看正面';renderPreview()};
panel.querySelector('#avatarWalk').onclick=e=>{walking=!walking;e.currentTarget.setAttribute('aria-pressed',String(walking))};
panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();hide()}if(e.key==='Tab'){const buttons=[...panel.querySelectorAll('button')];if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1).focus()}else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0].focus()}}});
// An avatar saved before this roster (the explorer, the costumes, the dolls) falls back to the default.
let saved=DEFAULT;try{saved=localStorage.getItem('veggie-avatar-v1')||saved}catch(_){}apply(saved);
return {show,hide,active:()=>cache.get(selected)};
};
