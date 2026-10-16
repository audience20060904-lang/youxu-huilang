/* 手机地图显示缓存：游戏规则和点击仍使用原地图，只替换绘制。 */
var DungeonRaster=(function(){
  'use strict';
  const media=window.matchMedia?window.matchMedia('(max-width:600px), (pointer:coarse)'):null;
  const images=new Map(),sprites=new Map();let loading=null,last=null;
  const light=()=>!!(media&&media.matches);
  function url(svg,color){
    let text=svg.replace('<svg','<svg width="100" height="100" style="color:'+(color||'#57503f')+'"');
    if(!/xmlns=/.test(text))text=text.replace('<svg','<svg xmlns="http://www.w3.org/2000/svg"');
    return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(text);
  }
  function image(svg){
    if(images.has(svg))return images.get(svg);
    const asset={node:new Image(),ready:false,failed:false};images.set(svg,asset);
    asset.promise=new Promise(resolve=>{
      const timer=setTimeout(()=>{asset.failed=true;resolve();},8000);
      asset.node.onload=()=>{clearTimeout(timer);asset.ready=true;resolve();};asset.node.onerror=()=>{clearTimeout(timer);asset.failed=true;resolve();};asset.node.src=url(svg);
    });
    return asset;
  }
  function prepare(){
    if(!light())return Promise.resolve();
    if(!loading){
      const art=Object.values(MOB_ART).concat([COIN,CHEST,SPRING,ALTAR,SHOP,STAIR]);
      loading=Promise.all(Array.from(new Set(art)).map(svg=>image(svg).promise));
    }
    return loading;
  }
  function sprite(svg,cls){
    if(!light())return svg;
    const h=typeof HEROES!=='undefined'?HEROES.find(h=>cls&&cls.includes('hr-'+h.id)):null;
    const color=h?h.col:'#245e8c',key=color+svg;
    if(!sprites.has(key))sprites.set(key,'<img alt="" draggable="false" src="'+url(svg,color)+'">');
    return sprites.get(key);
  }
  function rock(ctx,x,y,s,n){
    ctx.fillStyle='#262823';ctx.fillRect(x,y,s,s);
    ctx.fillStyle=['#32352d','#30332c','#36382e'][n%3];ctx.beginPath();ctx.moveTo(x+s*.08,y+s*.12);ctx.lineTo(x+s*.76,y+s*.03);ctx.lineTo(x+s*.98,y+s*.65);ctx.lineTo(x+s*.69,y+s*.96);ctx.lineTo(x+s*.02,y+s*.77);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#171e1b';ctx.lineWidth=Math.max(.7,s*.025);ctx.stroke();
    ctx.strokeStyle='#62634d66';ctx.beginPath();ctx.moveTo(x+s*.15,y+s*.19);ctx.lineTo(x+s*.64,y+s*.1);ctx.lineTo(x+s*.79,y+s*.21);ctx.stroke();
  }
  function tile(ctx,c,x,y,s,biome){
    const cls=c.className,n=+c.dataset.detail||0;
    const wall=cls.includes(' wall'),floor=cls.includes(' floor');
    ctx.clearRect(x,y,s,s);
    if(!wall&&!floor){rock(ctx,x,y,s,n);return;}
    const floors=['#d9d1b9','#d9dec6','#dfccba','#d8d9dc','#d5cfe0'],walls=['#696b5c','#677360','#786357','#626779','#655c75'];
    ctx.fillStyle=(wall?walls:floors)[Math.max(0,Math.min(4,biome-1))];ctx.fillRect(x,y,s,s);
    if(wall){
      ctx.fillStyle='#171d1b66';ctx.beginPath();ctx.moveTo(x,y+s*.74);ctx.lineTo(x+s*.65,y+s*.63);ctx.lineTo(x+s,y+s*.85);ctx.lineTo(x+s,y+s);ctx.lineTo(x,y+s);ctx.fill();
      ctx.fillStyle='#c1b99933';ctx.beginPath();ctx.moveTo(x+s*.08,y+s*.09);ctx.lineTo(x+s*.48,y+s*.03);ctx.lineTo(x+s*.9,y+s*.18);ctx.lineTo(x+s*.74,y+s*.72);ctx.lineTo(x+s*.2,y+s*.64);ctx.fill();
      ctx.strokeStyle='#2b302c99';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+s*.18,y);ctx.lineTo(x+s*.38,y+s*.54);ctx.lineTo(x+s*.78,y+s);ctx.stroke();
      const face=c.dataset.face||'';
      if(face.includes('s')){ctx.fillStyle='#303a38';ctx.fillRect(x,y+s*.79,s,s*.21);ctx.fillStyle='#9b9c7844';ctx.fillRect(x,y+s*.76,s,1);}
      if(face.includes('n')){ctx.fillStyle='#b3ad8a';ctx.fillRect(x,y,s,Math.max(1,s*.04));}
      if(face.includes('e')){ctx.fillStyle='#414d47';ctx.fillRect(x+s-2,y,2,s);}
      if(face.includes('w')){ctx.fillStyle='#a19e80';ctx.fillRect(x,y,1,s);}
      if(n===4||n===13){ctx.fillStyle='#77987866';ctx.fillRect(x+s*.12,y+s*.1,s*.3,s*.16);}
      if(n===7||n===19){
        const glow=ctx.createRadialGradient(x+s*.5,y+s*.52,0,x+s*.5,y+s*.52,s*.48);glow.addColorStop(0,'#f7b44a88');glow.addColorStop(1,'#f7b44a00');ctx.fillStyle=glow;ctx.fillRect(x,y,s,s);
        ctx.fillStyle='#ffc966';ctx.beginPath();ctx.moveTo(x+s*.5,y+s*.35);ctx.lineTo(x+s*.57,y+s*.57);ctx.lineTo(x+s*.46,y+s*.61);ctx.lineTo(x+s*.43,y+s*.52);ctx.fill();
      }
    }else{
      ctx.strokeStyle='#6a6a5522';ctx.lineWidth=.7;ctx.strokeRect(x+.5,y+.5,s-1,s-1);
      ctx.strokeStyle='#fff4';ctx.beginPath();ctx.moveTo(x+1,y+1);ctx.lineTo(x+s-1,y+1);ctx.stroke();
      ctx.strokeStyle='#7a795733';ctx.beginPath();ctx.moveTo(x+s*.12,y+s*.7);ctx.lineTo(x+s*.42,y+s*.64);ctx.lineTo(x+s*.68,y+s*.7);ctx.stroke();
      if(n===5||n===16){ctx.fillStyle='#698b862b';ctx.beginPath();ctx.ellipse(x+s*.4,y+s*.68,s*.23,s*.075,-.2,0,Math.PI*2);ctx.fill();}
      if(n===17||n===21){ctx.fillStyle='#73835966';ctx.fillRect(x+s*.4,y+s*.5,2,2);ctx.fillRect(x+s*.6,y+s*.6,2,1);}
    }
    const art=c._sceneHtml;
    if(art&&art.startsWith('<svg')){
      const asset=image(art);if(asset.ready)ctx.drawImage(asset.node,x+s*.04,y+s*.04,s*.92,s*.92);
    }else if(art){ctx.fillStyle='#57503f';ctx.font=Math.round(s*.6)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(art,x+s*.5,y+s*.5);}
    if(cls.includes('tutmark')){ctx.strokeStyle='#dba446';ctx.lineWidth=2;ctx.strokeRect(x+3,y+3,s-6,s-6);}
  }
  function paint(map,cells,w,h,size,biome,goal,disabled){
    if(!map||!cells.length||!size)return;
    last=[map,cells,w,h,size,biome,goal,disabled];
    let state=map._raster;
    if(!light()||disabled){map.classList.remove('raster-map');if(state){state.canvas.hidden=true;state.goal.hidden=true;}return;}
    const pending=Array.from(new Set(cells.map(c=>c._sceneHtml).filter(s=>s&&s.startsWith('<svg')))).map(image);
    if(pending.some(a=>a.failed)){map.classList.remove('raster-map');if(state){state.canvas.hidden=true;state.goal.hidden=true;}return;}
    if(pending.some(a=>!a.ready)){Promise.all(pending.map(a=>a.promise)).then(()=>{if(last&&last[0]===map)paint(...last);});return;}
    if(!state||!state.canvas.isConnected){
      const canvas=document.createElement('canvas'),mark=document.createElement('i');let ctx;
      try{ctx=canvas.getContext('2d',{alpha:false});}catch(error){ctx=null;}
      if(!ctx){map.classList.remove('raster-map');return;}
      canvas.className='map-raster';canvas.setAttribute('aria-hidden','true');mark.className='raster-goal';mark.setAttribute('aria-hidden','true');map.appendChild(canvas);map.appendChild(mark);
      state=map._raster={canvas:canvas,goal:mark,ctx:ctx,keys:[],frame:null};
    }
    const cw=w*size,ch=h*size,scale=Math.min(1.25,Math.sqrt(3000000/(cw*ch)));
    if(state.width!==cw||state.height!==ch||state.biome!==biome){
      state.canvas.width=Math.ceil(cw*scale);state.canvas.height=Math.ceil(ch*scale);state.canvas.style.width=cw+'px';state.canvas.style.height=ch+'px';state.ctx.setTransform(scale,0,0,scale,0,0);
      state.width=cw;state.height=ch;state.biome=biome;state.keys=[];
    }
    state.canvas.hidden=false;state.goal.hidden=!goal;
    if(goal){state.goal.style.width=state.goal.style.height=size+'px';state.goal.style.transform='translate('+(goal.x*size)+'px,'+(goal.y*size)+'px)';}
    map.classList.add('raster-map');state.cells=cells;state.w=w;state.size=size;
    if(state.frame!==null)return;
    state.frame=requestAnimationFrame(()=>{
      state.frame=null;if(!state.canvas.isConnected)return;
      const ctx=state.ctx,s=state.size;
      state.cells.forEach((c,i)=>{
        const key=c.className.replace(/\bgoal\b/g,'')+'|'+c._sceneHtml+'|'+c.dataset.face+'|'+c.dataset.detail;
        if(state.keys[i]===key)return;
        tile(ctx,c,(i%state.w)*s,Math.floor(i/state.w)*s,s,state.biome);state.keys[i]=key;
      });
    });
  }
  if(media&&media.addEventListener)media.addEventListener('change',()=>{if(last)paint(...last);});
  return {prepare:prepare,paint:paint,sprite:sprite,light:light};
})();
