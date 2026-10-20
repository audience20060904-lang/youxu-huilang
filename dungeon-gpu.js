/* One viewport-sized WebGL renderer; data in, pixels out. No P/G/B writes. */
var DungeonGPU=(function(){
  'use strict';
  let renderer,canvas,atlas,atlasTexture,stage,mapRoot,terrainRoot,entityRoot,trailRoot,actorRoot,battleRoot,backdrop;
  let ready=false,failed=false,preparing=null,sourceAssets={},fxShapes={},onFallback=null,onTile=null;
  let scene=null,mapHost=null,legacyMap=null,mode='map',visible=true,enabled=true,raf=0,cell=20,vw=1,vh=1;
  let clock=0,walkMs=144,actor=null,pet=null,goal=null,camera={x:0,y:0},target={x:0,y:0},start={x:0,y:0},moveAt=0;
  let actorFrom={x:0,y:0},actorTo={x:0,y:0},actorBase={x:0,y:0},lastTile=null,drawnChunks=new Set(),terrainChunks=[],spriteById=new Map();
  const textures=new Map(),pool=[],effects=[],occluders=[],metrics={frames:0,worldBuilds:0,entitySyncs:0,terrainWrites:0,textureUploads:0,sceneryBuilds:0};
  const reduce=window.matchMedia?window.matchMedia('(prefers-reduced-motion:reduce)'):null;
  const now=()=>performance.now(),quiet=()=>document.hidden||!visible;
  function status(){return {ready,failed,mode,enabled,frames:metrics.frames,worldBuilds:metrics.worldBuilds,entitySyncs:metrics.entitySyncs,terrainWrites:metrics.terrainWrites,textureUploads:metrics.textureUploads,sceneryBuilds:metrics.sceneryBuilds,liveEffects:effects.length,pool:pool.length,width:canvas?canvas.width:0,height:canvas?canvas.height:0};}
  function request(){if(!ready||!enabled||raf||quiet())return;raf=requestAnimationFrame(frame);}
  function stop(){if(raf)cancelAnimationFrame(raf);raf=0;}
  function dropEffects(kind){for(let i=effects.length-1;i>=0;i--)if(!kind||effects[i].kind===kind){release(effects[i].sprite);effects.splice(i,1);}}
  function release(s){s.removeFromParent();s.visible=false;if(pool.length<48)pool.push(s);else s.destroy();}
  function take(key,parent){const tex=textures.get(key);if(!tex)return null;const s=pool.pop()||new PIXI.Sprite(tex);s.texture=tex;s.anchor.set(.5);s.alpha=1;s.tint=0xffffff;s.rotation=0;s.zIndex=0;s.label='';s.visible=true;parent.addChild(s);return s;}
  function size(w,h){
    w=Math.max(1,Math.round(w));h=Math.max(1,Math.round(h));if(vw===w&&vh===h)return;
    vw=w;vh=h;renderer.resolution=DungeonView.resolution(w,h,window.devicePixelRatio);renderer.resize(w,h);canvas.style.width=w+'px';canvas.style.height=h+'px';
    if(backdrop){backdrop.width=w;backdrop.height=h;}drawnChunks.clear();
  }
  function fail(reason){
    if(failed)return;failed=true;ready=false;stop();dropEffects();if(mapHost)mapHost.classList.remove('gpu-map');if(canvas)canvas.remove();
    try{if(stage)stage.destroy({children:true});for(const s of pool)s.destroy();if(renderer)renderer.destroy();}catch(_){}
    try{for(const texture of textures.values())texture.destroy(false);if(atlasTexture)atlasTexture.destroy(true);}catch(_){}
    if(atlas)atlas.width=atlas.height=1;textures.clear();pool.length=0;occluders.length=0;spriteById.clear();terrainChunks=[];scene=null;stage=mapRoot=terrainRoot=entityRoot=trailRoot=actorRoot=battleRoot=backdrop=actor=pet=goal=null;sourceAssets={};
    if(onFallback)Promise.resolve().then(()=>onFallback(reason));
  }
  function svgImage(asset){return new Promise((resolve,reject)=>{
    let svg=asset.svg.replace(/currentColor/g,asset.color||'#ffffff');
    svg=svg.replace(/<svg\b[^>]*>/,tag=>tag.replace(/\s(?:xmlns|width|height)=(?:"[^"]*"|'[^']*')/g,'').replace('<svg','<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"'));
    const img=new Image(),timer=setTimeout(()=>{img.onload=img.onerror=null;reject(Error('SVG decode timeout'));},4000);
    img.onload=()=>{clearTimeout(timer);resolve(img);};img.onerror=()=>{clearTimeout(timer);reject(Error('SVG decode failed'));};
    img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  });}
  function paintTile(ctx,type,p,v){
    ctx.fillStyle=type==='floor'?p.floor:type==='wall'?p.wall:p.rock;ctx.fillRect(0,0,64,64);
    if(type==='floor'){
      ctx.fillStyle='#ffffff0c';ctx.beginPath();ctx.moveTo(3,4);ctx.lineTo(36+v*4,3);ctx.lineTo(58,16+v*5);ctx.lineTo(57,53);ctx.lineTo(22,59);ctx.lineTo(4,44);ctx.closePath();ctx.fill();
      ctx.fillStyle='#ffffff19';ctx.fillRect(1,1,62,2);ctx.fillStyle='#322e2320';ctx.fillRect(0,62,64,2);ctx.fillRect(62,0,2,64);
      ctx.strokeStyle='#514e432a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(9+v*7,15);ctx.lineTo(17+v*6,29);ctx.lineTo(14+v*6,38);ctx.stroke();
      ctx.fillStyle='#6a685229';ctx.fillRect(43-v*6,45,3,2);ctx.fillRect(24,51-v*5,2,2);
      ctx.strokeStyle='#f8f2d833';ctx.beginPath();ctx.moveTo(8,6);ctx.lineTo(34,5);ctx.stroke();
      if(v===2){ctx.strokeStyle='#6b705d44';ctx.beginPath();ctx.moveTo(61,18);ctx.lineTo(48,25);ctx.lineTo(52,39);ctx.moveTo(48,25);ctx.lineTo(38,27);ctx.stroke();}
    }else if(type==='wall'){
      ctx.fillStyle=p.top;ctx.fillRect(0,0,64,5);ctx.fillStyle=p.side;ctx.fillRect(0,53,64,11);ctx.fillRect(60,5,4,48);
      ctx.strokeStyle='#292d2a55';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,30);ctx.lineTo(64,30);ctx.moveTo(20+v*7,5);ctx.lineTo(20+v*7,29);ctx.moveTo(42-v*5,31);ctx.lineTo(42-v*5,52);ctx.stroke();
      ctx.fillStyle='#eef1d81c';ctx.fillRect(3,7,15+v*5,3);ctx.fillRect(3,33,34-v*5,2);ctx.fillStyle='#1f2c2333';ctx.fillRect(2,48,15,4);ctx.fillRect(48-v*7,25,10,3);
      ctx.strokeStyle='#c6cab32b';ctx.beginPath();ctx.moveTo(4,51);ctx.lineTo(36,51);ctx.stroke();
    }else{
      ctx.fillStyle='#ffffff08';ctx.beginPath();ctx.moveTo(0,8);ctx.lineTo(30,0);ctx.lineTo(61,19);ctx.lineTo(48,41);ctx.lineTo(11,35);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#11171566';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,39);ctx.lineTo(24,35);ctx.lineTo(41,64);ctx.moveTo(24,35);ctx.lineTo(31,0);ctx.stroke();
      ctx.strokeStyle='#8d99871a';ctx.beginPath();ctx.moveTo(3+v*4,12);ctx.lineTo(24,6+v*2);ctx.lineTo(46,17);ctx.moveTo(46,46);ctx.lineTo(60,38+v*3);ctx.stroke();
    }
  }
  async function prepare(options){
    if(options&&options.disabled){enabled=false;return false;}
    if(preparing)return preparing;let deadline;
    const work=(async()=>{
      if(!window.PIXI||typeof DungeonView==='undefined')return false;
      try{
        sourceAssets=options.assets;canvas=document.createElement('canvas');canvas.className='dungeon-gpu';canvas.setAttribute('aria-label','地牢地图');canvas.setAttribute('role','img');
        // Context alpha is immutable: create it transparent, then use an opaque map clear.
        renderer=new PIXI.WebGLRenderer();await renderer.init({canvas,width:1,height:1,resolution:1,backgroundAlpha:0,background:0x242321,antialias:false,autoDensity:true,powerPreference:'low-power',preserveDrawingBuffer:false});renderer.background.alpha=1;
        if(failed){try{renderer.destroy();}catch(_){}return false;}
        atlas=document.createElement('canvas');atlas.width=atlas.height=1024;const ctx=atlas.getContext('2d');if(!ctx)throw Error('No atlas canvas');
        const slots=[],entries=Object.values(sourceAssets);for(const id in fxShapes)entries.push({id:'fx:'+id,svg:'<svg viewBox="0 0 100 100">'+fxShapes[id]+'</svg>',color:'#ffffff'});
        const allocate=id=>{if(slots.length>=225)throw Error('Atlas capacity');const i=slots.length,x=(i%15)*68+2,y=Math.floor(i/15)*68+2;slots.push({id,x,y});return {x,y};};
        // Four SVG decoders at a time; a single atlas upload after all images are ready.
        for(let i=0;i<entries.length;i+=4){if(failed)return false;const batch=entries.slice(i,i+4),images=await Promise.all(batch.map(svgImage));if(failed)return false;batch.forEach((a,j)=>{const p=allocate(a.id);ctx.drawImage(images[j],p.x,p.y,64,64);});}
        for(let chapter=1;chapter<=5;chapter++)for(const type of ['floor','wall','rock'])for(let v=0;v<3;v++){
          const p=allocate('tile:'+chapter+':'+type+':'+v);ctx.save();ctx.translate(p.x,p.y);paintTile(ctx,type,DungeonView.palettes[chapter],v);ctx.restore();
          // Extrude tile edges inside the atlas padding to prevent hairline seams while the camera interpolates.
          ctx.drawImage(atlas,p.x,p.y,64,1,p.x,p.y-2,64,2);ctx.drawImage(atlas,p.x,p.y+63,64,1,p.x,p.y+64,64,2);
          ctx.drawImage(atlas,p.x,p.y,1,64,p.x-2,p.y,2,64);ctx.drawImage(atlas,p.x+63,p.y,1,64,p.x+64,p.y,2,64);
        }
        for(const id of ['spark','goal']){const p=allocate(id);ctx.save();ctx.translate(p.x,p.y);ctx.strokeStyle=ctx.fillStyle='#ffffff';ctx.lineWidth=3;
          if(id==='spark'){ctx.fillRect(22,22,20,20);}else{ctx.beginPath();ctx.arc(32,32,24,0,Math.PI*2);ctx.stroke();}ctx.restore();}
        for(const dir of ['n','e','s','w']){const p=allocate('shade:'+dir);for(let i=0;i<8;i++){ctx.fillStyle='rgba(22,32,24,'+(.2*(1-i/8))+')';if(dir==='n'||dir==='s')ctx.fillRect(p.x,p.y+(dir==='n'?i:63-i),64,1);else ctx.fillRect(p.x+(dir==='w'?i:63-i),p.y,1,64);}}
        if(failed)return false;atlasTexture=PIXI.Texture.from(atlas);metrics.textureUploads++;
        for(const p of slots)textures.set(p.id,new PIXI.Texture({source:atlasTexture.source,frame:new PIXI.Rectangle(p.x,p.y,64,64)}));
        stage=new PIXI.Container();mapRoot=new PIXI.Container();terrainRoot=new PIXI.Container();trailRoot=new PIXI.Container();entityRoot=new PIXI.Container();actorRoot=new PIXI.Container();battleRoot=new PIXI.Container();
        actorRoot.sortableChildren=true;mapRoot.addChild(terrainRoot,trailRoot,entityRoot,actorRoot);stage.addChild(mapRoot);
        const warm=new PIXI.Sprite(textures.values().next().value);stage.addChild(warm);renderer.render({container:stage});warm.destroy();ready=true;
        canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('context lost');});
        canvas.addEventListener('click',e=>{if(mode!=='map'||!scene||!onTile)return;const r=canvas.getBoundingClientRect();const p=DungeonView.hit((e.clientX-r.left)*vw/r.width,(e.clientY-r.top)*vh/r.height,camera,cell,scene.width,scene.height);if(p)onTile(p.x,p.y);});
        return true;
      }catch(e){fail(e.message);return false;}
    })();preparing=Promise.race([work,new Promise(resolve=>{deadline=setTimeout(()=>{fail('GPU preparation timeout');resolve(false);},12000);})]).finally(()=>clearTimeout(deadline));return preparing;
  }
  function clearMap(){
    dropEffects('map');for(const c of terrainRoot.removeChildren())c.destroy({children:true});for(const s of entityRoot.removeChildren())s.destroy();
    for(const s of actorRoot.removeChildren())s.destroy();terrainChunks=[];spriteById.clear();occluders.length=0;drawnChunks.clear();actor=pet=goal=null;lastTile=null;
  }
  function full(s){
    if(!ready||!enabled)return false;if(s.unsupported){clearMap();scene=null;if(mapHost)mapHost.classList.remove('gpu-map');canvas.remove();return false;}
    try{
      const fresh=!scene||scene.world!==s.world||scene.chapter!==s.chapter||scene.theme!==s.theme;
      if(fresh){clearMap();scene=s;metrics.worldBuilds++;const cols=Math.ceil(s.width/8);
        for(let y=0;y<s.height;y++)for(let x=0;x<s.width;x++){
          const t=s.terrain[y*s.width+x];if(!t)continue;const i=Math.floor(y/8)*cols+Math.floor(x/8);let chunk=terrainChunks[i];if(!chunk){chunk=new PIXI.Container();chunk.visible=false;terrainChunks[i]=chunk;terrainRoot.addChild(chunk);}
          const tex=t===3?'tile:'+s.chapter+':rock:0':'tile:'+s.chapter+':'+(t===1?'floor':'wall')+':'+((x*13+y*7)%3),tile=new PIXI.Sprite(textures.get(tex));tile.width=tile.height=1;tile.position.set(x,y);chunk.addChild(tile);metrics.terrainWrites++;
        }
        if(typeof DungeonDecor!=='undefined'){
          const layout=DungeonDecor.layout(s.world,s.theme,s.chapter);metrics.sceneryBuilds++;
          for(const d of layout.ground.concat(layout.shadows)){const i=Math.floor(d.y/8)*cols+Math.floor(d.x/8),chunk=terrainChunks[i];if(!chunk)continue;const sprite=take(d.key,chunk);if(!sprite)throw Error('Missing scenery '+d.key);sprite.position.set(d.x+.5,d.y+.5);sprite.width=d.width||1;sprite.height=d.height||1;sprite.alpha=d.alpha==null?1:d.alpha;}
          for(const d of layout.props){const sprite=take(d.key,actorRoot);if(!sprite)throw Error('Missing scenery '+d.key);sprite.label='scenery';sprite.position.set(d.x+.5,d.y+1-d.height/2);sprite.width=d.width;sprite.height=d.height;sprite.alpha=d.alpha;sprite.zIndex=d.y+1;occluders.push({sprite,x:d.x+.5,foot:d.y+1,alpha:d.alpha});}
        }
        actor=take(s.hero,actorRoot);pet=take('pet',actorRoot);goal=take('goal',actorRoot);if(!actor||!pet||!goal)throw Error('Missing actor texture');actor.label='hero';pet.label='pet';goal.label='goal';goal.zIndex=100000;goal.tint=0xb68b38;goal.width=goal.height=.8;
      }
      scene=s;actor.texture=textures.get(s.hero);pet.visible=s.pet;const keys=new Set();metrics.entitySyncs++;
      for(const e of s.entities){keys.add(e.id);let sprite=spriteById.get(e.id);if(!sprite){sprite=take(e.key,e.ground?entityRoot:actorRoot);if(!sprite)throw Error('Missing entity texture '+e.key);spriteById.set(e.id,sprite);}sprite.texture=textures.get(e.key);sprite.label='entity';sprite.zIndex=e.y+1;sprite.position.set(e.x+.5,e.y+.5);sprite.width=sprite.height=e.scale||1;sprite.alpha=e.alpha||1;}
      for(const [id,sprite] of spriteById)if(!keys.has(id)){spriteById.delete(id);release(sprite);}
      request();return true;
    }catch(e){fail(e.message);return false;}
  }
  function mount(host,map){
    if(mapHost&&mapHost!==host)mapHost.classList.remove('gpu-map');mapHost=host;legacyMap=map;
    if(mode!=='map')return;host.classList.add('gpu-map');if(canvas.parentNode!==host)host.appendChild(canvas);canvas.style.pointerEvents='auto';canvas.setAttribute('aria-hidden','false');
  }
  function sample(t){
    const p=walkMs?Math.max(0,Math.min(1,(t-moveAt)/walkMs)):1;
    camera.x=start.x+(target.x-start.x)*p;camera.y=start.y+(target.y-start.y)*p;
    if(actor){
      actorBase={x:actorFrom.x+(actorTo.x-actorFrom.x)*p,y:actorFrom.y+(actorTo.y-actorFrom.y)*p};
      const pulse=walkMs&&p>0&&p<1&&!(reduce&&reduce.matches)?Math.sin(Math.PI*p):0,scale=1+pulse*.1;
      actor.position.set(actorBase.x,actorBase.y-(scale-1)*.5-pulse*2/cell);actor.width=actor.height=scale;
      actor.zIndex=actorBase.y+.5;pet.position.set(actorBase.x-.58,actorBase.y+.27);pet.zIndex=actorBase.y+.62;pet.width=pet.height=.7;
      for(const d of occluders){const behind=actorBase.y+.5<d.foot&&d.foot-(actorBase.y+.5)<1.6&&Math.abs(actorBase.x-d.x)<.85;d.sprite.alpha=behind?.35:d.alpha;}
    }
    return p<1;
  }
  function trails(x,y){
    if(!lastTile||Math.abs(lastTile.x-x)+Math.abs(lastTile.y-y)!==1||reduce&&reduce.matches)return;
    for(let i=0;i<3;i++){const p=i/3,s=take(scene.trail,trailRoot);if(!s)continue;s.position.set(lastTile.x+.5+(x-lastTile.x)*p,lastTile.y+.5+(y-lastTile.y)*p);addEffect({sprite:s,kind:'map',type:'trail',born:now(),ms:420,alpha:.14+i*.09,base:.84});}
  }
  function move(o){
    if(!ready||!enabled||!scene||scene.world!==o.world)return false;
    try{
      mount(o.host,o.map);if(mode!=='map')return true;
      const t=now(),resize=cell!==o.cell||vw!==o.width||vh!==o.height,changed=!lastTile||lastTile.x!==o.x||lastTile.y!==o.y;
      sample(t);size(o.width,o.height);const snap=resize||!lastTile||Math.abs(lastTile.x-o.x)+Math.abs(lastTile.y-o.y)>3||!!(reduce&&reduce.matches);
      cell=o.cell;mapRoot.scale.set(cell);if(!backdrop||backdrop._chapter!==scene.chapter){if(backdrop){backdrop.removeFromParent();backdrop.destroy();}backdrop=new PIXI.TilingSprite({texture:textures.get('tile:'+scene.chapter+':rock:0'),width:vw,height:vh});backdrop._chapter=scene.chapter;stage.addChildAt(backdrop,0);}backdrop.tileScale.set(cell/64);
      if(changed||resize){if(!snap)trails(o.x,o.y);start={x:camera.x,y:camera.y};target={x:o.cameraX,y:o.cameraY};actorFrom={x:actorBase.x,y:actorBase.y};actorTo={x:o.x+.5,y:o.y+.5};moveAt=t;walkMs=snap?0:o.ms;lastTile={x:o.x,y:o.y};}
      goal.visible=!!o.goal;if(o.goal)goal.position.set(o.goal.x+.5,o.goal.y+.5);pet.visible=!!o.pet;
      sample(t);request();return true;
    }catch(e){fail(e.message);return false;}
  }
  function addEffect(e){
    const cap=e.type==='trail'?12:48;if(e.type==='trail'){const a=effects.filter(x=>x.type==='trail');if(a.length>=cap){const old=a[0];release(old.sprite);effects.splice(effects.indexOf(old),1);}}
    while(effects.length>=48){release(effects[0].sprite);effects.shift();}effects.push(e);request();
  }
  function effectsFrame(t){
    for(let i=effects.length-1;i>=0;i--){const e=effects[i],p=Math.max(0,(t-e.born)/e.ms),s=e.sprite;if(p>=1){release(s);effects.splice(i,1);continue;}
      if(e.type==='ring'){s.alpha=(1-p)*.65;s.width=s.height=e.base*(.6+p*1.5);}
      else if(e.type==='trail'){s.alpha=e.alpha*(1-p)*(1-p);s.width=s.height=e.base*(.92-.32*p);}
      else if(e.type==='bolt'){s.position.set(e.x+e.dx*p,e.y+e.dy*p);s.alpha=p<.12?p/.12:Math.min(1,(1-p)*7);s.width=s.height=e.base*(.65+.35*p);}
      else{s.position.set(e.x+e.dx*p,e.y+e.dy*p+e.gravity*p*p);s.alpha=1-p;s.width=s.height=e.base*(1-p*.55);s.rotation=e.turn*p;}
    }
  }
  function frame(t){
    raf=0;if(!ready||!enabled||quiet())return;clock=t;
    try{
      const moving=mode==='map'&&sample(t);effectsFrame(t);
      if(mode==='map'&&scene){mapRoot.position.set(camera.x,camera.y);const list=DungeonView.chunks(camera,cell,vw,vh,scene.width,scene.height),next=new Set(list);for(const i of drawnChunks)if(!next.has(i)&&terrainChunks[i])terrainChunks[i].visible=false;for(const i of next)if(terrainChunks[i])terrainChunks[i].visible=true;drawnChunks=next;}
      renderer.render({container:stage});metrics.frames++;if(moving||effects.length)request();
    }catch(e){fail(e.message);}
  }
  function battle(space){
    if(!ready||!enabled||!space||!space.host||quiet())return false;
    // WebGL uses premultiplied alpha: a transparent clear must have zero RGB too.
    if(mode!=='battle'){stop();dropEffects('map');mode='battle';mapRoot.visible=false;if(backdrop)backdrop.visible=false;stage.addChild(battleRoot);renderer.background.color=0x000000;renderer.background.alpha=0;}
    if(canvas.parentNode!==space.host)space.host.appendChild(canvas);canvas.style.pointerEvents='none';canvas.setAttribute('aria-hidden','true');size(space.width,space.height);return true;
  }
  function projectile(a,b,color,shape){
    if(reduce&&reduce.matches||!a||!b||!textures.has('fx:'+shape)||!battle(a.space))return false;
    const s=take('fx:'+shape,battleRoot);s.tint=color;s.rotation=shape==='slash'?Math.atan2(b.y-a.y,b.x-a.x)+Math.PI/4:0;
    addEffect({sprite:s,kind:'battle',type:'bolt',x:a.x,y:a.y,dx:b.x-a.x,dy:b.y-a.y,base:shape==='slash'?22:27,born:now(),ms:90});return true;
  }
  function sparks(at,type,n){
    if(reduce&&reduce.matches||!at||!battle(at.space))return false;
    const color={slain:0xe4c779,critical:0xffd87a,hurt:0xe39a86}[type]||0xc7d5c3;
    for(let i=0;i<Math.min(n,12);i++){const a=i*Math.PI*2/n+.3,s=take('spark',battleRoot);s.tint=color;s.position.set(at.x,at.y);addEffect({sprite:s,kind:'battle',type:'spark',x:at.x,y:at.y,dx:Math.cos(a)*32,dy:Math.sin(a)*27,gravity:10,base:5,born:now(),ms:350,turn:a});}return true;
  }
  function endBattle(){
    if(!ready||mode!=='battle')return;stop();dropEffects('battle');battleRoot.removeFromParent();mode='map';mapRoot.visible=true;if(backdrop)backdrop.visible=true;renderer.background.color=0x242321;renderer.background.alpha=1;
    if(mapHost&&scene){mapHost.appendChild(canvas);canvas.style.pointerEvents='auto';canvas.setAttribute('aria-hidden','false');size(mapHost.clientWidth,mapHost.clientHeight);drawnChunks.clear();request();}else canvas.remove();
  }
  function setVisible(value){visible=!!value;if(!visible){stop();dropEffects();}else request();}
  function project(x,y){
    if(!ready||!scene||!mapHost||mode!=='map'||!visible)return null;sample(now());const r=mapHost.getBoundingClientRect();return {left:r.left+1+camera.x+x*cell,top:r.top+1+camera.y+y*cell,width:cell,height:cell};
  }
  function clearBattle(){if(!ready)return;dropEffects('battle');if(mode==='battle')request();}
  function interact(x,y,kind){
    if(!ready||!enabled||!scene||mode!=='map'||quiet()||reduce&&reduce.matches||!Number.isFinite(x)||!Number.isFinite(y))return false;
    const color={gold:0xe8c36b,chest:0xd7b47e,kill:0xa7c7ac,door:0xcbb88b}[kind]||0xcbb88b;
    const ring=take('goal',trailRoot);ring.tint=color;ring.position.set(x+.5,y+.5);addEffect({sprite:ring,kind:'map',type:'ring',base:1,born:now(),ms:360});
    for(let i=0;i<6;i++){const angle=i*Math.PI/3,s=take('spark',trailRoot);s.tint=color;addEffect({sprite:s,kind:'map',type:'spark',x:x+.5,y:y+.5,dx:Math.cos(angle)*.65,dy:Math.sin(angle)*.45-.25,gravity:.3,base:.16,born:now(),ms:420,turn:angle});}
    return true;
  }
  function setEnabled(value){enabled=!!value;if(!enabled&&ready){endBattle();stop();clearMap();scene=null;if(mapHost)mapHost.classList.remove('gpu-map');canvas.remove();}}
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();dropEffects();}else request();});
  window.addEventListener('pagehide',()=>{stop();dropEffects();});
  if(reduce&&reduce.addEventListener)reduce.addEventListener('change',()=>{if(reduce.matches){dropEffects();walkMs=0;request();}});
  return {prepare,full,move,project,projectile,sparks,endBattle,clearBattle,interact,setVisible,setEnabled,status,
    registerFx:value=>{fxShapes=value;},configure:o=>{onFallback=o.fallback;onTile=o.tile;},active:()=>ready&&enabled&&!!scene,
    clearMap:()=>{if(ready){stop();clearMap();scene=null;if(mapHost)mapHost.classList.remove('gpu-map');canvas.remove();}},disable:()=>fail('compatibility mode')};
})();
