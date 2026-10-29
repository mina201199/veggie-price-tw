/* 歐巴, 波妞 and 小橘 for the wardrobe: thin adapters over CatKit (cat-kit.js), the fur-shaded kittens from the home page's cat guide. */
window.cityCatStyles=[
 {id:'blackcat',cat:true,icon:'🐾',name:'歐巴',subtitle:'金色大眼 × 捲捲尾巴',description:'圓滾滾的黑色毛球，金色大眼睛配四隻小短腿，陪你慢慢探訪市場。',bg:'#e4d9cf'},
 {id:'mochi',cat:true,icon:'🐈',name:'波妞',subtitle:'銀灰虎斑 × 蓬鬆白胸毛',description:'波妞有綠眼睛、粉鼻子和蓬蓬大尾巴，是慢慢逛街的銀白小夥伴。',bg:'#dfe7df'},
 {id:'ginger',cat:true,icon:'🧡',name:'小橘',subtitle:'橘色虎斑 × 奶油色白襪',description:'小橘是圓滾滾的橘色虎斑貓，黃綠色大眼睛、奶油色胸口和四隻白襪，尾巴尖也是白的。',bg:'#f3e2cc'}
];
// City characters stand about 2.4 tall; CatKit kittens are built at about 1.9.
window.CITY_CAT_SCALE=1.25;
window.createCityCat=function(T,s){
 const phone=typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches;
 const kit=window.CatKit.create(T,s.id,{shells:phone?12:16,castShadow:true});
 kit.root.scale.setScalar(window.CITY_CAT_SCALE);
 const root=new T.Group();root.add(kit.root);
 // The city's biped walk cycle writes to arms/legs every frame. CatKit animates its own rig through kit.update(),
 // so the wardrobe gets spare joints that are never added to the scene.
 return {root,kit,arms:[new T.Group(),new T.Group()],legs:[new T.Group(),new T.Group()]};
};
