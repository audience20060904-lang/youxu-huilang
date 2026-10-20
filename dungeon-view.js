/* Read-only scene descriptions. Neither renderer owns gameplay state or collision. */
var DungeonView=(function(){
  'use strict';
  const palettes=[null,
    {floor:'#d8d2bf',wall:'#707466',top:'#a0a18a',side:'#424d40',rock:'#292b27'},
    {floor:'#d2d8c0',wall:'#61745d',top:'#92a184',side:'#354b3e',rock:'#252d26'},
    {floor:'#ddc9b6',wall:'#7b6658',top:'#ae9075',side:'#4f3932',rock:'#302824'},
    {floor:'#cfd4d6',wall:'#616d7a',top:'#919da6',side:'#354452',rock:'#252932'},
    {floor:'#d6cee0',wall:'#71657f',top:'#a195b3',side:'#443b55',rock:'#2b2631'}];
  const mobColor=(id,boss)=>({priest:'#C2510E',crown:'#4A3A8C',scribe:'#1F6B63'}[id]||(boss?'#8C2418':'#A93729'));
  const itemColors={gold:'#E3B23C',chest:'#7A520C',feat:'#266F7B',altar:'#6F3D98',gild:'#C49932',shop:'#9C6A10',stair:'#47702F',route:'#99896a'};
  function terrain(map,seen){
    const h=map.length,w=map[0].length,out=new Uint8Array(w*h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      if(seen&&seen[y]&&!seen[y][x]){out[y*w+x]=3;continue;}
      if(map[y][x]){out[y*w+x]=1;continue;}
      let edge=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(map[y+dy]&&map[y+dy][x+dx])edge=true;
      out[y*w+x]=edge?2:0;
    }
    return out;
  }
  function snapshot(s){
    const entities=[];let unsupported=false;const cleared=s.mobs.length===0,add=(id,x,y,key,extra)=>entities.push(Object.assign({id,x,y,key},extra));
    if(cleared&&s.stair)add('stair',s.stair.x,s.stair.y,'item:stair');
    for(const t of s.things){const key=t.kind==='route'?'door:'+s.room:'item:'+t.kind;if(s.assets[key])add('thing:'+t.x+','+t.y,t.x,t.y,key);}
    for(const m of s.mobs){if(s.active&&!s.active(m))continue;const id=m.def&&m.def.id;if(s.assets['mob:'+id])add('mob:'+m.x+','+m.y,m.x,m.y,'mob:'+id,{boss:!!m.boss});else unsupported=true;}
    if(s.mate&&Number.isFinite(s.mate.x)&&Number.isFinite(s.mate.y)&&s.mate.x>=0&&s.mate.y>=0&&s.mate.x<s.map[0].length&&s.mate.y<s.map.length)add('mate',s.mate.x+.2,s.mate.y+.2,'mate',{alpha:.7,scale:.6});
    return {world:s.map,width:s.map[0].length,height:s.map.length,terrain:terrain(s.map,s.seen),entities,chapter:Math.max(1,Math.min(5,s.chapter||1)),hero:'hero:'+s.hero,trail:'trail:'+s.hero,pet:!!s.pet,unsupported};
  }
  function assets(s){
    const out={},add=(id,svg,color)=>{if(svg)out[id]={id,svg,color:color||'#ffffff'};};
    for(const h of s.heroes){add('hero:'+h.id,s.heroArt(h.id),h.col);add('trail:'+h.id,s.heroArt(h.id),'#d6b365');}
    for(const id in s.monsters)add('mob:'+id,s.monsters[id],mobColor(id,s.bossIds.includes(id)));
    for(const id in s.items)add('item:'+id,s.items[id],itemColors[id]);
    for(const id in s.doors)add('door:'+id,s.doors[id]);
    add('pet',s.pet);add('mate',s.mate,'#245E8C');return out;
  }
  function hit(px,py,camera,cell,w,h){
    const x=Math.floor((px-camera.x)/cell),y=Math.floor((py-camera.y)/cell);
    return x>=0&&y>=0&&x<w&&y<h?{x,y}:null;
  }
  function chunks(camera,cell,vw,vh,w,h,span){
    span=span||8;const cols=Math.ceil(w/span),rows=Math.ceil(h/span),out=[];
    const x0=Math.max(0,Math.floor(-camera.x/(cell*span))),y0=Math.max(0,Math.floor(-camera.y/(cell*span)));
    const x1=Math.min(cols-1,Math.floor((vw-camera.x)/(cell*span))),y1=Math.min(rows-1,Math.floor((vh-camera.y)/(cell*span)));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)out.push(y*cols+x);return out;
  }
  function resolution(w,h,dpr){return Math.min(1.5,Math.max(1,dpr||1),Math.sqrt(900000/Math.max(1,w*h)));}
  return {palettes,mobColor,itemColors,terrain,snapshot,assets,hit,chunks,resolution};
})();
if(typeof module!=='undefined')module.exports=DungeonView;
