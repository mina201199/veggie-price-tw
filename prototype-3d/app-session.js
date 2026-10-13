(function(g){
 const views=['prices','world','map','notes'];
 function create(venueIds,initial='prices'){const state={view:views.includes(initial)?initial:'prices',venueId:venueIds[0]||null,player:null};return {state,switchView(view){if(views.includes(view))state.view=view;return state},selectVenue(id){if(venueIds.includes(id))state.venueId=id;return state},setPlayer(player){if(player&&Number.isFinite(player.lat)&&Number.isFinite(player.lng))state.player={...player};return state}}}
 if(typeof module==='object')module.exports={create};else g.MarketSession={create};
})(typeof window==='undefined'?globalThis:window);
