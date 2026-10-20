/* Read-only adapters and renderer lifecycle tests with an instrumented Pixi driver.
   These verify scheduling/resource contracts, not real WebGL/Safari frame rate. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n'),V=require('../dungeon-view');let groups=0;
function check(name,fn){fn();groups++;console.log('PASS '+name);}
const base=vm.createContext({});for(const f of ['content.js','art.js','monster-art.js','dungeon-rooms.js','dungeon-decor.js'])vm.runInContext(read(f),base);
const assets=V.assets({heroes:base.HEROES,heroArt:id=>base.HERO_ART[id],monsters:base.MOB_ART,bossIds:Object.keys(base.MOB_ART).filter(id=>!base.FOES.some(f=>f.id===id)&&id!=='study'),items:{gold:base.COIN,chest:base.CHEST,feat:base.SPRING,altar:base.ALTAR,gild:base.ALTAR,shop:base.SHOP,stair:base.STAIR},doors:Object.fromEntries(base.DungeonRooms.items.map(r=>[r.id,base.DungeonRooms.icon(r.id)])),scenery:base.DungeonDecor.assets(),pet:base.HERO,mate:base.HERO});
// Scene module owns the six current item drawings and companion art.
base.document={getElementById:()=>null};vm.runInContext(read('dungeon-scene.js'),base);
for(const id of ['gold','chest','feat','altar','gild','shop','stair']){const key={gold:'COIN',chest:'CHEST',feat:'SPRING',altar:'ALTAR',gild:'ALTAR',shop:'SHOP',stair:'STAIR'}[id];assets['item:'+id]={id:'item:'+id,svg:base[key],color:V.itemColors[id]};}
assets.pet={id:'pet',svg:base.DungeonScene.pet,color:'#ffffff'};
const shapes=new vm.Script('('+read('dungeon-fx.js').match(/const shapes = (\{[\s\S]*?\n  \});/)[1]+')').runInNewContext();
const grid=Array.from({length:25},(_,y)=>Array.from({length:33},(_,x)=>x>2&&x<30&&y>2&&y<22?1:0));
function snapshot(map=grid,extra={}){return V.snapshot(Object.assign({map,seen:map.map(r=>r.map(()=>true)),mobs:[{x:7,y:7,def:{id:'rat'}},{x:8,y:8,def:{id:'slime'},wave:2}],things:[{x:6,y:6,kind:'gold'},{x:9,y:9,kind:'route'}],stair:{x:10,y:10},chapter:1,hero:'adv',pet:true,assets,room:'outpost',active:m=>m.wave!==2},extra));}
function setup(options={}){
 let time=0,serial=0,draws=0,init=0,uploads=0;const frames=new Map(),events={},winEvents={},decodes=[],renders=[];let imageCount=0,maxDecoders=0;
 class Node{
  constructor(){this.children=[];this.style={};this.attrs={};this.events={};this.x=this.y=0;this.width=this.height=0;this.visible=true;this.alpha=1;this.clientWidth=280;this.clientHeight=380;this.classes=new Set();this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),contains:x=>this.classes.has(x)};this.position={set:(x,y)=>{this.x=x;this.y=y}};this.scale={set:(x,y=x)=>{this.sx=x;this.sy=y}};this.anchor={set(){}};this.tileScale={set(){}};}
  appendChild(n){n.remove();n.parentNode=this;this.children.push(n);return n;}
  addChild(...nodes){nodes.forEach(n=>this.appendChild(n));return nodes[0];}
  addChildAt(n,i){this.appendChild(n);this.children.splice(this.children.indexOf(n),1);this.children.splice(i,0,n);return n;}
  removeChildren(){const nodes=this.children.slice();nodes.forEach(n=>n.remove());return nodes;}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}
  removeFromParent(){this.remove();}
  destroy(o){this.destroyed=true;this.remove();if(o?.children)this.removeChildren().forEach(n=>n.destroy(o));}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(k,f){this.events[k]=f;}
  getBoundingClientRect(){return {left:10,top:20,width:280,height:380};}
  getContext(){return {fillRect(){},save(){},restore(){},translate(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},arc(){},drawImage(){draws++;}};}
 }
 class Sprite extends Node{constructor(t){super();this.texture=t?.texture||t;this.width=t?.width||0;this.height=t?.height||0;}}
 class Texture{constructor(t){Object.assign(this,t);}destroy(){this.destroyed=true;}static from(source){uploads++;return new Texture({source});}}
 class Renderer{constructor(){this.background={alpha:1};}async init(o){init++;assert.equal(o.backgroundAlpha,0,'Shared battle context must support transparency');this.options=o;this.canvas=o.canvas;if(options.noGL)throw Error('WebGL unavailable');if(options.timeout)return new Promise(()=>{});}resize(w,h){this.canvas.width=Math.round(w*this.resolution);this.canvas.height=Math.round(h*this.resolution);}render(o){if(options.renderFail)throw Error('GPU failure');renders.push(o);this.last=o;}destroy(){this.destroyed=true;}}
 const document={hidden:false,createElement:()=>new Node(),addEventListener:(k,f)=>events[k]=f};
 const media={matches:false,addEventListener(k,f){this.changed=f}},window={devicePixelRatio:3,matchMedia:()=>media,addEventListener:(k,f)=>winEvents[k]=f};
 const ctx=vm.createContext({window,document,console,PIXI:{Container:Node,Sprite,TilingSprite:Sprite,Texture,WebGLRenderer:Renderer,Rectangle:class{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}}},DungeonView:V,DungeonDecor:base.DungeonDecor,performance:{now:()=>time},
  Image:class{set src(v){decodes.push(decodeURIComponent(v.split(',').slice(1).join(',')));imageCount++;maxDecoders=Math.max(maxDecoders,imageCount);Promise.resolve().then(()=>{imageCount--;if(options.imageFail)this.onerror();else this.onload();});}},
  requestAnimationFrame:f=>{frames.set(++serial,f);return serial;},cancelAnimationFrame:i=>frames.delete(i),setTimeout:(fn,ms)=>{if(options.timeout&&ms===12000){Promise.resolve().then(fn);return -1;}return setTimeout(fn,ms);},clearTimeout:id=>{if(id!==-1)clearTimeout(id);}});
 window.PIXI=ctx.PIXI;vm.runInContext(read('dungeon-gpu.js'),ctx);window.DungeonGPU=ctx.DungeonGPU;
 const gpu=ctx.DungeonGPU,host=new Node(),map=new Node();host.appendChild(map);gpu.registerFx(shapes);
 function tick(ms=16){time+=ms;const tasks=[...frames.values()];frames.clear();tasks.forEach(f=>f(time));}
 function drain(){for(let i=0;frames.size;i++){if(i>200)throw Error('Non-idle render loop');tick();}}
 function move(x,y=10,extra={}){return gpu.move(Object.assign({host,map,world:grid,cell:20,width:280,height:380,x,y,cameraX:-(x-6)*20,cameraY:-(y-9)*20,ms:144,goal:null,pet:true},extra));}
 const visuals=()=>{const mapRoot=renders.at(-1).container.children.find(n=>n.children.length===4);return {root:mapRoot,actor:mapRoot.children[3].children.find(n=>n.label==='hero'),pet:mapRoot.children[3].children.find(n=>n.label==='pet')};};
 return {ctx,gpu,host,map,media,document,events,winEvents,frames,move,tick,drain,Node,decodes,visuals,counts:()=>({draws,init,uploads,maxDecoders,renders:renders.length})};
}
(async()=>{
 check('Scene snapshot is read-only, respects staged enemies and only reveals stairs after a full clear',()=>{
  const s=snapshot(),before=JSON.stringify(grid);assert.equal(s.terrain.length,825);assert.equal(s.entities.filter(e=>e.id.startsWith('mob:')).length,1);assert(!s.entities.some(e=>e.id==='stair'));assert(s.entities.some(e=>e.key==='door:outpost'));assert.equal(JSON.stringify(grid),before);
  assert(snapshot(grid,{mobs:[]}).entities.some(e=>e.id==='stair'));assert(snapshot(grid,{mobs:[{def:{id:'unknown'}}]}).unsupported);
  const terrain=V.terrain([[0,0,0,0],[0,1,0,0],[0,0,0,0]]);assert.equal(terrain[0],2);assert.equal(terrain[3],0);assert.equal(terrain[5],1);
 });
 check('Hit testing handles fractional camera offsets, border/outside clicks and camera-centered coordinates',()=>{
  assert.deepEqual(V.hit(30,30,{x:-10,y:-10},20,33,25),{x:2,y:2});assert.deepEqual(V.hit(1,1,{x:-9.5,y:-10.2},20,33,25),{x:0,y:0});assert.equal(V.hit(-1,0,{x:0,y:0},20,33,25),null);assert.equal(V.hit(660,0,{x:0,y:0},20,33,25),null);
  assert(V.chunks({x:-100,y:-100},20,280,380,33,25).length<20);assert(280*380*V.resolution(280,380,3)**2<=900000);assert(2000*2000*V.resolution(2000,2000,3)**2<=900001);
 });
 const t=setup();assert(await t.gpu.prepare({assets}));
 check('One pinned local GPU library, one context and one atlas; source SVG namespaces decode correctly with bounded concurrency',()=>{
  const n=t.counts();assert.equal(n.init,1);assert.equal(n.uploads,1);assert(n.maxDecoders<=4);assert(t.decodes.length>90);for(const svg of t.decodes){const tag=svg.match(/<svg[^>]*>/)[0];assert.equal((tag.match(/xmlns=/g)||[]).length,1);assert.equal((tag.match(/width=/g)||[]).length,1);assert(!svg.includes('currentColor'));}
  const manifest=JSON.parse(read('dev/pixi-vendor.json'));assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'pixi.min.js'))).digest('hex'),manifest.sha256);assert(read('LICENSE-PIXI.txt').includes('MIT'));
 });
 assert(t.gpu.full(snapshot()));assert(t.move(10));t.drain();
 check('Each real GPU step enlarges and lifts only the hero, preserving the camera and pet positions, then restores its exact pose',()=>{
  const writes=t.gpu.status().terrainWrites;t.move(11);t.tick(72);const v=t.visuals();assert(Math.abs(v.actor.width-1.1)<1e-9);assert(Math.abs(v.actor.y-10.35)<1e-9);assert.equal(v.pet.y,10.77);assert.equal(v.root.x,-90);t.tick(72);assert.equal(v.actor.width,1);assert.equal(v.actor.y,10.5);t.drain();assert.equal(t.frames.size,0);assert.equal(t.gpu.status().terrainWrites,writes);
 });
 check('Interrupted steps use logical positions instead of lifted artwork; teleports, resize and reduced motion never keep a zoomed pose',()=>{
  t.move(10);t.tick(40);t.move(10,11);t.drain();let a=t.visuals().actor;assert.equal(a.x,10.5);assert.equal(a.y,11.5);assert.equal(a.width,1);
  t.move(20,20);t.drain();assert.equal(a.width,1);assert.equal(a.y,20.5);t.move(20,20,{cell:30});t.drain();assert.equal(a.width,1);t.move(20,20);t.drain();t.move(21,20);t.tick(40);assert(a.width>1);t.media.matches=true;t.media.changed();t.drain();assert.equal(a.width,1);assert.equal(a.y,20.5);t.media.matches=false;t.move(10);t.drain();
 });
 check('Viewport-sized GPU surface settles to idle; a thousand steps do not rebuild terrain, upload textures or resync entities',()=>{
  const before=t.gpu.status();assert.equal(t.frames.size,0);for(let i=0;i<1000;i++){t.move(10+i%2);t.tick(144);}t.drain();const after=t.gpu.status();assert.equal(after.worldBuilds,before.worldBuilds);assert.equal(after.terrainWrites,before.terrainWrites);assert.equal(after.entitySyncs,before.entitySyncs);assert.equal(after.textureUploads,before.textureUploads);assert.equal(after.sceneryBuilds,before.sceneryBuilds);assert(after.width*after.height<=900000);assert(after.liveEffects===0);assert(after.pool<=48);
 });
 check('Scene props share the actor depth layer and fade only when they would cover the nearby hero',()=>{
  const plan=base.DungeonDecor.layout(grid,'outpost',1),p=plan.props.find(q=>q.alpha<1);assert(p);t.move(p.x,p.y-1);t.drain();let root=t.visuals().root.children[3];assert(root.sortableChildren);let prop=root.children.find(s=>s.label==='scenery'&&Math.abs(s.x-(p.x+.5))<1e-9&&s.zIndex===p.y+1);assert(prop);assert.equal(prop.alpha,.35);assert.equal(t.visuals().actor.zIndex,p.y);t.move(p.x+2,p.y-1);t.drain();assert.equal(prop.alpha,p.alpha);t.move(10);t.drain();
 });
 check('Pickup/chest/door feedback is visual-only, bounded and returns to an idle renderer after its short burst',()=>{
  const before=JSON.stringify(grid),builds=t.gpu.status().sceneryBuilds;for(const kind of ['gold','chest','door','kill'])assert(t.gpu.interact(10,10,kind));assert(t.gpu.status().liveEffects<=48);t.drain();assert.equal(t.gpu.status().liveEffects,0);assert.equal(t.frames.size,0);assert.equal(t.gpu.status().sceneryBuilds,builds);assert.equal(JSON.stringify(grid),before);t.media.matches=true;assert.equal(t.gpu.interact(10,10,'gold'),false);t.media.matches=false;
 });
 check('Classic movement emits three bounded trails; stationary updates emit none and reduced motion clears animation',()=>{
  t.move(10);t.drain();t.move(11);assert.equal(t.gpu.status().liveEffects,3);t.move(11);assert.equal(t.gpu.status().liveEffects,3);for(let i=0;i<20;i++){t.move(10+i%2);assert(t.gpu.status().liveEffects<=12);}t.media.matches=true;t.media.changed();t.drain();assert.equal(t.gpu.status().liveEffects,0);assert.equal(t.frames.size,0);t.media.matches=false;
 });
 check('World events update entities without rebuilding floor topology; a new floor replaces retained scene nodes',()=>{
  const before=t.gpu.status();t.gpu.full(snapshot(grid,{things:[],mobs:[]}));assert.equal(t.gpu.status().worldBuilds,before.worldBuilds);assert.equal(t.gpu.status().entitySyncs,before.entitySyncs+1);const other=grid.map(r=>r.slice());t.gpu.full(snapshot(other));assert.equal(t.gpu.status().worldBuilds,before.worldBuilds+1);t.move(10,10,{world:other});t.drain();t.gpu.full(snapshot());t.move(10);t.drain();
 });
 check('Resize changes only viewport resolution and actor scale while retaining the map and atlas',()=>{
  const before=t.gpu.status();t.move(10,10,{width:1200,height:1400,cell:30});t.drain();const after=t.gpu.status();assert(after.width*after.height<=902000);assert.equal(after.worldBuilds,before.worldBuilds);assert.equal(after.textureUploads,before.textureUploads);t.move(10);t.drain();
 });
 const coldBasic=setup();assert.equal(await coldBasic.gpu.prepare({assets,disabled:true}),false);assert.equal(coldBasic.counts().init,0);coldBasic.gpu.setEnabled(true);assert(await coldBasic.gpu.prepare({assets}));
 check('Compatibility mode switches live without reloading a run; reenabling reuses the context and preloaded atlas',()=>{
  assert.equal(coldBasic.counts().init,1);
  const before=t.gpu.status();t.gpu.setEnabled(false);assert(!t.gpu.active());assert(!t.host.classes.has('gpu-map'));assert(!t.frames.size);t.gpu.setEnabled(true);assert(t.gpu.full(snapshot()));t.move(10);t.drain();assert.equal(t.counts().init,1);assert.equal(t.gpu.status().textureUploads,before.textureUploads);
 });
 check('GPU tile click uses rendered camera position and sends only coordinates to the existing game input handler',()=>{
  let hit;t.gpu.configure({tile:(x,y)=>hit={x,y},fallback(){}});t.move(10);t.drain();const canvas=t.host.children.find(n=>n.className==='dungeon-gpu');canvas.events.click({clientX:140,clientY:210});assert.deepEqual(hit,{x:10,y:10});
 });
 check('Map and battle share one context; separate summon projectiles retain every hit and return the canvas to the map',()=>{
  const space={host:new t.Node(),width:360,height:280},from={x:40,y:200,space},to={x:250,y:60,space};
  for(let i=0;i<15;i++)assert(t.gpu.projectile(from,to,'#ffffff',i%2?'claw':'spirit'));assert.equal(t.gpu.status().liveEffects,15);assert.equal(t.gpu.status().mode,'battle');assert.equal(t.counts().init,1);assert(t.gpu.sparks(to,'critical',4));t.drain();assert.equal(t.gpu.status().liveEffects,0);t.gpu.endBattle();t.drain();assert.equal(t.gpu.status().mode,'map');assert.equal(t.counts().init,1);
 });
 check('Hiding the app or reducing motion cancels rendering; resume needs only one frame and does not replay effects',()=>{
  t.move(11);assert(t.frames.size);t.gpu.setVisible(false);assert.equal(t.frames.size,0);assert.equal(t.gpu.status().liveEffects,0);t.gpu.setVisible(true);t.drain();t.move(10);t.document.hidden=true;t.events.visibilitychange();assert.equal(t.frames.size,0);t.document.hidden=false;t.events.visibilitychange();t.drain();assert.equal(t.frames.size,0);
 });
 check('Unsupported new artwork and tutorials can release the GPU map and return to the retained DOM renderer',()=>{
  assert.equal(t.gpu.full(snapshot(grid,{mobs:[{def:{id:'unknown'}}]})),false);assert(!t.host.classes.has('gpu-map'));assert(!t.host.children.some(n=>n.className==='dungeon-gpu'));t.gpu.full(snapshot());t.move(10);t.drain();t.gpu.clearMap();assert(!t.gpu.active());assert(!t.host.classes.has('gpu-map'));assert(!t.host.children.some(n=>n.className==='dungeon-gpu'));
  const space={host:new t.Node(),width:360,height:280};t.gpu.projectile({x:20,y:200,space},{x:200,y:30,space},'#ffffff','slash');t.drain();t.gpu.endBattle();assert(!space.host.children.some(n=>n.className==='dungeon-gpu'));assert(!t.frames.size);
 });
 const bad=setup({noGL:true}),badImage=setup({imageFail:true});assert.equal(await bad.gpu.prepare({assets}),false);assert.equal(await badImage.gpu.prepare({assets}),false);
 check('WebGL or image-decode failure leaves the DOM renderer available without hiding the game',()=>{assert(!bad.host.classes.has('gpu-map'));assert(!badImage.host.classes.has('gpu-map'));assert(!bad.gpu.active());assert(!badImage.gpu.active());});
 const timed=setup({timeout:true});assert.equal(await timed.gpu.prepare({assets}),false);check('A stalled GPU initialization has a bounded deadline and cannot hold the startup loader indefinitely',()=>{assert(timed.gpu.status().failed);assert(!timed.gpu.active());});
 const lost=setup();await lost.gpu.prepare({assets});lost.gpu.full(snapshot());lost.move(10);lost.drain();let fallbacks=0;lost.gpu.configure({tile(){},fallback:()=>fallbacks++});const canvas=lost.host.children.find(n=>n.className==='dungeon-gpu');canvas.events.webglcontextlost({preventDefault(){}});await Promise.resolve();
 check('Context loss switches off once, removes the canvas and restores the original map rather than retrying indefinitely',()=>{assert.equal(fallbacks,1);assert(lost.gpu.status().failed);assert(!lost.host.classes.has('gpu-map'));assert.equal(lost.frames.size,0);assert.equal(lost.gpu.full(snapshot()),false);});
 check('Actual game adapter bypasses per-cell HTML on GPU while retaining the real input lock, core rules and learning DOM',()=>{
  const game=read('game.js');for(const name of ['gpuMapAssets','gpuMapFull','mapTileClick'])assert(game.includes('function '+name+'('));assert(game.includes('if(!gpu)for(let y=0;y<H;y++)'));assert(game.includes('if(!old.gpu&&window.DungeonFX)'));for(const f of ['index.html','coop.html']){const html=read(f);assert(html.includes('id="optSceneMode"'));assert(html.includes('class="battle-learning"'));}
  assert(read('preload.js').includes("['pixi.min.js','载入绘图引擎',true]"));assert(read('.github/workflows/deploy.yml').includes('LICENSE-PIXI.txt'));
 });
 const vendor=vm.createContext({console,performance,setTimeout,clearTimeout,URL,TextEncoder,TextDecoder,navigator:{userAgent:'node-api-check'}});vm.runInContext(read('pixi.min.js'),vendor);
 check('Actual vendored Pixi scene and texture APIs accept the renderer adapter without loading a browser',()=>{
  const P=vendor.PIXI,parent=new P.Container(),source=new P.TextureSource({width:1024,height:1024}),texture=new P.Texture({source,frame:new P.Rectangle(2,2,64,64)}),sprite=new P.Sprite(texture),tile=new P.TilingSprite({texture,width:280,height:380});parent.addChild(sprite,tile);parent.sortableChildren=true;sprite.zIndex=10;tile.zIndex=5;parent.sortChildren();assert.equal(parent.children[0],tile);sprite.anchor.set(.5);sprite.position.set(3,4);sprite.width=sprite.height=1;tile.tileScale.set(.3);assert.equal(P.VERSION,'8.22.0');assert.equal(sprite.x,3);assert.equal(texture.width,64);assert.equal(typeof P.WebGLRenderer.prototype.init,'function');parent.destroy({children:true});
 });
 const adapter=setup();await adapter.gpu.prepare({assets});
 check('Real render and camera functions bypass all cell HTML and legacy actor work; real map input preserves pause and coop locks',()=>{
  const setupCode=read('dev/check-dungeon-builds.js').split("check('Twelve appended")[0],{c,reset,definitions}=new Function('require','__dirname',setupCode+'\nreturn {c,reset,definitions};')(require,__dirname);reset();vm.runInContext(definitions.render,c);c.mapRenderState=null;
  Object.assign(c,{DungeonGPU:adapter.gpu,DungeonView:V,gpuMapAssets:()=>assets,VIEW:{w:14,h:19},SCENE:'run',B:null,OPT:{},W:33,H:25,cells:[],hasPetCompanion:()=>true,$:id=>id==='map'?adapter.map:adapter.host,renderHud(){},renderMapTile(){throw Error('Unexpected cell HTML work');},heroArt(){throw Error('Unexpected actor SVG work');},DungeonScene:{camera(){throw Error('Unexpected legacy camera work');}}});adapter.map._cellSize=20;
  c.G={map:grid,seen:grid.map(r=>r.map(()=>true)),vis:[],mobs:[{def:{id:'rat'},x:7,y:7}],things:[],stair:{x:10,y:10},floor:2};c.P.x=c.P.y=10;c.render();adapter.drain();const writes=adapter.gpu.status().terrainWrites;
  for(let i=0;i<1000;i++){c.P.x=10+i%2;c.renderStep();adapter.tick(144);}adapter.drain();assert.equal(adapter.gpu.status().terrainWrites,writes);
  c.COOP=true;const syncs=adapter.gpu.status().entitySyncs;for(let i=0;i<100;i++){c.P.x=10+i%2;c.renderStep();adapter.tick(144);}adapter.drain();assert.equal(adapter.gpu.status().entitySyncs,syncs);c.COOP=false;
  let walked=0;c.goTo=()=>walked++;c.autoOff=()=>{};c.coopLocked=()=>false;c.G.paused=true;c.mapTileClick(12,10);assert.equal(walked,0);c.G.paused=false;c.coopLocked=()=>true;c.coopNoteLocked=()=>{};c.mapTileClick(12,10);assert.equal(walked,0);c.coopLocked=()=>false;c.mapTileClick(12,10);assert.equal(walked,1);
 });
 console.log(groups+' GPU architecture checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
