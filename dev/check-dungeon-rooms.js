/* node dev/check-dungeon-rooms.js — real map, event, reward, save and coop adapters. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n'),plain=x=>JSON.parse(JSON.stringify(x));
// Share the existing combat fixture setup, without running its separate 32 test groups.
const setup=read('dev/check-dungeon-builds.js').split("check('Twelve appended")[0];
const {c,reset,definitions}=new Function('require','__dirname',setup+'\nreturn {c,reset,definitions};')(require,__dirname);
vm.runInContext(read('dungeon-rooms.js'),c);const R=c.DungeonRooms;let groups=0;
function check(name,fn){fn();groups++;console.log('PASS '+name);}
const nodes={};function el(id){return nodes[id]||(nodes[id]={id,hidden:true,innerHTML:'',textContent:'',children:[],dataset:{},style:{},listeners:{},classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(k,v){this[k]=v},addEventListener(k,f){this.listeners[k]=f},appendChild(x){this.children.push(x)},focus(){}});}
c.$=el;c.document={createElement:()=>({hidden:false,children:[],dataset:{},style:{},listeners:{},classList:{add(){},remove(){}},setAttribute(k,v){this[k]=v},addEventListener(k,f){this.listeners[k]=f},appendChild(x){this.children.push(x)}})};
Object.assign(c,{SCENE:'run',pendingLoot:null,pendingSwap:null,pendingRoom:null,comboShown:null,DungeonScene:{},resetHpFx(){},fov(){},buildGrid(){},commit(){},commitPerm(){},heroSnapFloor(){},tip(){},blessSet(){},coopMyName:'Test'});
function room(id,opt={}){reset(opt.relics||[],{chapter:opt.chapter||1,floor:opt.floor||2,level:opt.level||10,player:opt.player||{}});c.P.roomRun={seed:opt.seed==null?77:opt.seed,history:[],boons:{},materials:0};c.G.routeRoom=R.enter(c.P,c.G.floor,false,id);c.G.roomPersonal={};c.G.roomExtraRedraw=0;c.B=null;c.genRouteRoom();c.roomApplyEntry();return c.roomConfig();}
function clear(){c.G.mobs=[];}
function kill(m){m.hp=0;c.G.mobs.splice(c.G.mobs.indexOf(m),1);c.roomAfterKill(m);}
function choose(event,id){c.openRoomEvent(event);c.roomChooseEvent(id);}
check('All twenty proposed rooms have real configurations, readable bilingual previews and no shifted relic catalog',()=>{
 assert.equal(R.items.length,20);assert.equal(new Set(R.items.map(r=>r.id)).size,20);assert.equal(c.RELICS.length,446);
 const english=vm.createContext({UI_EN:true});vm.runInContext(read('dungeon-rooms.js'),english);
 for(const r of R.items){assert(r.danger&&r.reward&&r.n);assert(Number.isInteger(r.mobs)&&r.mobs>=0);assert(english.DungeonRooms.byId[r.id].danger);if(!r.mobs)assert(['camp','spring'].includes(r.id));}
});
check('Three distinct doors are deterministic, avoid the last two rooms, cover all twenty types and bypass bosses/study/tutorial',()=>{
 const seen=new Set();for(let seed=1;seed<=800;seed++){const p={roomRun:{seed,history:[]}};const a=R.offers(p,2,false);assert.equal(new Set(a).size,3);assert.deepEqual(plain(R.offers(p,2,false)),plain(a));a.forEach(id=>seen.add(id));p.roomRun.history=[{floor:1,id:a[0]},{floor:2,id:a[1]}];assert(R.offers(p,3,false).every(id=>!a.slice(0,2).includes(id)));}
 assert.equal(seen.size,20);assert.equal(R.offers({},10,true).length,0);assert.equal(R.offers({study:true},2,false).length,0);assert.equal(R.offers({tut:true},2,false).length,0);
});
check('Every generated room is connected, stays inside the existing map and has nonoverlapping reachable guards and resources',()=>{
 for(const r of R.items){room(r.id);const walk=new Set(),todo=[[c.P.x,c.P.y]];while(todo.length){const [x,y]=todo.pop(),key=x+','+y;if(walk.has(key)||!c.G.map[y]?.[x])continue;walk.add(key);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])todo.push([x+dx,y+dy]);}
  assert.equal(c.G.map.length,25);assert(c.G.map.every(row=>row.length===33));assert.equal(walk.size,c.G.map.flat().filter(Boolean).length,r.id);const occupied=new Set([c.P.x+','+c.P.y]);
  for(const obj of [...c.G.mobs,...c.G.things]){const key=obj.x+','+obj.y;assert(walk.has(key),r.id);assert(!occupied.has(key),r.id);occupied.add(key);}assert.equal(c.G.mobs.length,c.roomConfig().mobs);
 }
});
check('Boss floors use the original single-boss generator and do not inherit route loans or room effects',()=>{
 room('rift',{floor:9});c.G.floor=10;c.P.roomPlan={floor:10,selected:'camp'};c.roomPrepareFloor();assert.equal(c.G.routeRoom,null);c.genFloor();assert.equal(c.G.mobs.length,1);assert(c.G.mobs[0].boss);assert.equal(c.G.things.length,0);assert.equal(c.hasRelic('db_rivet'),false);
});
check('Room populations increase without multiplying elites or adding enemies to rest rooms',()=>{
 const expected={outpost:8,ambush:12,elite:4,nest:8,bounty:6,cursed:6,rift:6,bleed:6,pack:6,wheel:6,vault:6,market:4,workshop:4,shrine:4,camp:0,spring:0,library:6,memory:6,prison:4};
 for(const [id,n] of Object.entries(expected)){room(id);assert.equal(c.G.mobs.length,n,id);}
 room('elite');assert.equal(c.G.mobs.filter(m=>m.route.name?.startsWith('祠堂精英')).length,1);assert(c.G.mobs.slice(1).every(m=>!m.route.name));assert(c.CHAPTER.mobsPerFloor.min>=14&&c.CHAPTER.mobsPerFloor.max<=18);
});
check('Dense room placement leaves a clear spawn area, every free tile connected and every guard or feature approachable',()=>{
 const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
 for(const r of R.items)for(let seed=1;seed<=24;seed++){
  room(r.id,{seed});const before=plain({map:c.G.map,mobs:c.G.mobs,things:c.G.things}),occupied=[...c.G.mobs,...c.G.things],blocked=new Set(occupied.map(p=>p.x+','+p.y)),seen=new Set(),todo=[[c.P.x,c.P.y]];
  for(let i=0;i<todo.length;i++){const [x,y]=todo[i],k=x+','+y;if(seen.has(k)||blocked.has(k)||!c.G.map[y]?.[x])continue;seen.add(k);for(const [dx,dy] of dirs)todo.push([x+dx,y+dy]);}
  assert.equal(blocked.size,occupied.length,r.id+' '+seed);assert.equal(seen.size,c.G.map.flat().filter(Boolean).length-blocked.size,r.id+' '+seed);
  for(const p of occupied){assert(Math.abs(p.x-c.P.x)+Math.abs(p.y-c.P.y)>=3);assert(dirs.some(([dx,dy])=>seen.has((p.x+dx)+','+(p.y+dy))),r.id+' inaccessible object');}
  assert(c.G.things.every(p=>p.x!==c.G.stair.x||p.y!==c.G.stair.y));const n=c.G.mobs.length;room(r.id,{seed});assert.equal(c.G.mobs.length,n);assert.deepEqual(plain({map:c.G.map,mobs:c.G.mobs,things:c.G.things}),before);
 }
});
check('Flow rooms grant temporary working loans, preserve owned inventory and keep heirloom rarity/source rules intact',()=>{
 for(const id of ['rift','bleed','pack','wheel']){room(id);const own=plain(c.P.relics);for(const loan of c.roomConfig().loans){assert(c.hasRelic(loan));c.RMASK={[loan]:true};assert(!c.hasRelic(loan));c.RMASK=null;}assert.deepEqual(plain(c.P.relics),own);c.G.floor++;assert.equal(c.roomConfig(),null);for(const loan of R.byId[id].loans)assert(!c.hasRelic(loan));}
 room('rift');const shield=c.P.shield;c.roomApplyEntry();assert.equal(c.P.shield,shield);assert(R.biased(c.relicById('db_rivet'),'rift'));assert(!R.biased(c.Heirlooms.items[0],'rift'));
});
check('Ambush waves gate combat and map targets, advance after four kills and grant the clear bonus only once',()=>{
 room('ambush');assert.equal(c.G.mobs.filter(c.roomMobActive).length,4);const future=c.G.mobs[4],hp=future.hp;c.coopDealDamage(future,9999);assert.equal(future.hp,hp);assert.equal(c.mobAt(future.x,future.y),null);
 for(let i=0;i<3;i++){kill(c.G.mobs[0]);assert.equal(c.G.routeRoom.wave,1);}kill(c.G.mobs[0]);assert.equal(c.G.routeRoom.wave,2);assert.equal(c.roomNeedsEvent(),'wave');assert.equal(c.G.mobs.filter(c.roomMobActive).length,4);choose('wave','wave:go');assert.equal(c.G.roomPersonal.pendingWave,undefined);
 while(c.G.mobs.length)kill(c.G.mobs[0]);const gold=c.P.gold;c.roomAfterKill(null);assert.equal(c.P.gold,gold);assert(c.G.roomPersonal.clearClaimed);assert.equal(c.G.routeRoom.wave,3);
});
check('Nest core removes the shared attack boost once; bounty requires its target to be the first kill',()=>{
 room('nest');const core=c.G.mobs[0],child=c.G.mobs[1],base=child.route.baseDmg;assert.equal(child.dmg,Math.round(base*1.25));kill(core);assert.equal(child.dmg,base);c.roomWorldDead(core);assert.equal(child.dmg,base);
 for(const first of [true,false]){room('bounty');c.P.hp=1;const before=c.P.gold,target=c.G.mobs[0];kill(first?target:c.G.mobs[1]);if(!first)kill(target);assert.equal(c.P.gold-before,first?28:0);}
});
check('Camp and spring offer meaningful choices, cannot repeat their rewards, and risky drink applies once to a new foe',()=>{
 room('camp');c.P.hp=1;const max=c.stats().maxHp;choose('camp','camp:heal');assert.equal(c.P.hp,1+Math.round(max*.35));c.openRoomEvent('camp');assert(el('veilRoomEvent').hidden);const hp=c.P.hp;c.roomChooseEvent('camp:heal');assert.equal(c.P.hp,hp);
 room('spring');c.P.hp=1;choose('spring','spring:deep');assert(c.P.roomRun.deepDrink);const foe={hp:1000,max:1000,status:{}};c.B={mob:foe,q:null,fxHits:[]};c.roomBattle(foe);assert.equal(c.P.status.weak,2);assert.equal(c.P.status.exposed,1);delete c.P.status.weak;c.roomBattle(foe);assert.equal(c.P.status.weak,undefined);
});
check('Four steles allow only two distinct selections, and the forge restores shield only once',()=>{
 room('wheel');choose('wheel','wheel:stone');assert.equal(c.P.status.stone,4);c.roomChooseEvent('wheel:stone');assert.equal(c.G.roomPersonal.steles.length,1);c.roomChooseEvent('wheel:fury');assert.equal(c.P.status.fury,4);assert(c.G.roomPersonal.eventResolved);c.openRoomEvent('wheel');assert(el('veilRoomEvent').hidden);
 room('rift');c.P.shield=0;choose('forge','forge:ward');const shield=c.P.shield;choose('forge','forge:ward');assert.equal(c.P.shield,shield);assert(c.G.roomPersonal.forgeUsed);
});
check('Sanctuary validates life/gold/relic costs, caps each run boon at three and never accepts exclusives as sacrifice',()=>{
 room('shrine');clear();c.P.hp=1;assert(c.roomEventChoices('shrine').find(x=>x.id==='shrine:hp').disabled);c.P.hp=c.stats().maxHp;c.P.gold=0;assert(c.roomEventChoices('shrine').find(x=>x.id==='shrine:gold').disabled);
 c.P.gold=1000;const before=c.stats().maxHp;choose('shrine','shrine:gold');assert.equal(c.P.roomRun.boons.hp,1);assert(c.stats().maxHp>before);c.P.roomRun.boons.hp=3;assert(c.roomEventChoices('shrine').find(x=>x.id==='shrine:gold').disabled);
 c.P.relics=[c.Heirlooms.items[0].id];assert(!c.roomEventChoices('shrine').some(x=>x.id.startsWith('shrine:relic:')));
});
check('Workshop salvages at most two ordinary relics, spends materials once and applies a real reward redraw',()=>{
 const ids=c.RELICS.filter(r=>!r.heroOnly&&r.r===0).slice(0,3).map(r=>r.id);room('workshop',{relics:ids});clear();const gold=c.P.gold;choose('workshop','workshop:salvage:'+ids[0]);c.roomChooseEvent('workshop:salvage:'+ids[1]);assert.equal(c.P.roomRun.materials,2);assert.equal(c.P.gold,gold);assert(c.roomEventChoices('workshop').find(x=>x.id==='workshop:salvage:'+ids[2]).disabled);
 c.roomChooseEvent('workshop:redraw');assert.equal(c.P.roomRun.materials,0);assert.equal(c.rerollBudget(),1);c.roomChooseEvent('workshop:redraw');assert.equal(c.rerollBudget(),1);
});
check('Market discount respects dismantle floor and its requested-rarity premium can be claimed only once',()=>{
 const r=c.RELICS.find(r=>!r.heroOnly&&r.r===2);room('market',{relics:[r.id]});clear();const before=c.P.gold,expected=Math.ceil(c.sellPrice(r)*1.5);choose('market','market:sell:'+r.id);assert.equal(c.P.gold-before,expected);assert(c.G.roomPersonal.marketSold);c.roomChooseEvent('market:sell:'+r.id);assert.equal(c.P.gold-before,expected);
 c.pendingRoom={blackMarket:true};assert.equal(c.shopPrice({relic:r,price:1000}),Math.max(c.sellPrice(r)+1,800));assert(c.shopPrice({relic:r,price:1})>c.sellPrice(r));c.pendingRoom=null;
 const oldRender=c.renderShop,oldStock=c.rollShopStock;let rolls=0;c.renderShop=()=>{};c.rollShopStock=()=>{rolls++;return [{relic:r,price:1000}]};
 try{choose('market','market:browse');const stock=c.pendingRoom.stock;stock[0].sold=true;c.pendingRoom=null;choose('market','market:browse');assert.equal(c.pendingRoom.stock,stock);assert(c.pendingRoom.stock[0].sold);assert.equal(rolls,1);assert(c.G.things.every(t=>Number.isFinite(t.x)&&Number.isFinite(t.y)));}
 finally{c.renderShop=oldRender;c.rollShopStock=oldStock;c.pendingRoom=null;}
});
check('Soul companions count distinct foes, preserve individual summon hits and cannot farm repeated opening attacks',()=>{
 room('prison');clear();choose('prison','prison:claw');for(let i=0;i<3;i++){const foe={x:i,y:0,hp:10000,max:10000,status:{}};c.B={mob:foe,q:null,fxHits:[]};c.roomBattle(foe);const hp=foe.hp;c.roomBattle(foe);assert.equal(foe.hp,hp);assert(c.B.roomPet);assert.equal(c.P.roomRun.companion.left,2-i);c.B.q={};c.roomPetHit(foe,false);assert(foe.hp<hp);}
 const foe={hp:10000,max:10000,status:{}};c.B={mob:foe,q:null,fxHits:[]};c.roomBattle(foe);assert(!c.B.roomPet);
 room('pack');choose('pack','pack:free');assert(c.G.roomPersonal.petFreed);c.B={mob:c.G.mobs[0],q:null,fxHits:[]};c.roomBattle(c.B.mob);assert(c.B.roomPet);assert(c.hasPetCompanion());
 room('prison');clear();choose('prison','prison:claw');c.G.floor=10;c.roomPrepareFloor();const boss={hp:10000,max:10000,status:{}};c.B={mob:boss,q:{},fxHits:[]};c.roomBattle(boss);const hp=boss.hp;c.roomAnswer(true,boss,false);assert(boss.hp<hp);assert.equal(c.P.roomRun.companion.left,2);
});
check('Library prefers due words, memory prefers scoped mistakes, and neither selection rewrites learning records',()=>{
 const old={};for(const k of ['scopeByLevel','readyHaunts','lexDue','lexRecall'])old[k]=c[k];const words=Array.from({length:20},(_,i)=>({en:'word'+i,cn:'释义'+i,lv:1,cat:'nature',pos:'noun'}));
 Object.assign(c,{ALLW:words,BYCAT:{},WMAP:Object.fromEntries(words.map(w=>[w.en,w])),LearningCache:require('../learning-cache'),dayNo:()=>1,scopeByLevel:a=>a,readyHaunts:()=>[],lexDue:r=>!!r?.due,lexRecall:()=>.5});
 try{for(const type of ['library','memory']){room(type);c.LEX={word0:{due:true,wrong:2,str:1}};const before=JSON.stringify(c.LEX);c.Math.random=R.rng(123);let chosen=0;for(let i=0;i<200;i++)if(c.pickQuizWord('all').en==='word0')chosen++;assert(chosen>130,type+': '+chosen);assert.equal(JSON.stringify(c.LEX),before);}}
 finally{Object.assign(c,old);}
 room('memory');for(let i=0;i<10;i++)c.roomAnswer(true,null,true);assert.equal(c.G.roomPersonal.reviews,3);c.P.hp=1;clear();choose('memory','memory:claim');assert.equal(c.P.hp,1+Math.round(c.stats().maxHp*.15));
});
check('Cursed room modifier is floor-local, previewable and never enters permanent Endless history',()=>{
 room('cursed',{chapter:1});const id=c.G.routeRoom.curse;assert(id);assert.equal(c.endlessMods()[id],1);assert(!c.P.endlessMods);c.G.floor++;assert.deepEqual(plain(c.endlessMods()),{});
 room('cursed',{chapter:5,floor:60});c.P.endlessMods={picks:['might']};const before=plain(c.P.endlessMods);assert.equal(c.endlessMods().might>=1,true);assert.deepEqual(plain(c.P.endlessMods),before);
});
check('Mystery reveals a reproducible actual room and a concrete extra reward without reselecting on re-entry',()=>{
 const seen=new Set();for(let seed=1;seed<100;seed++){const p={roomRun:{seed,history:[]}},a=R.enter(p,2,false,'mystery');assert.deepEqual(plain(R.enter(p,2,false,'mystery')),plain(a));seen.add(a.actual);}assert.equal(seen.size,4);room('mystery');assert.equal(c.roomRewardMult('gold'),(c.roomConfig().gold||1)*1.25);
});
check('Room events precede the original five-choice reward without extra or missing heirloom slots',()=>{
 const old=c.maybeRelic,offer=c.offerRelics;vm.runInContext(definitions.maybeRelic,c);let offers=0;c.offerRelics=()=>{offers++;return true;};
 try{room('vault');clear();assert(c.maybeRelic());assert.equal(offers,0);assert.equal(c.G.roomEvent,'vault');c.roomChooseEvent('vault:gold');assert.equal(offers,1);assert(definitions.offerRelics.includes('Heirlooms.roll'));assert(definitions.offerRelics.includes('RELIC_OFFER_N'));}
 finally{c.maybeRelic=old;c.offerRelics=offer;}
});
check('Actual checkpoint and compact run code preserve room, private choices, waves, loan state and redraw credits',()=>{
 room('ambush');for(let i=0;i<4;i++)kill(c.G.mobs[0]);c.G.roomExtraRedraw=2;c.G.roomPersonal.forgeUsed=true;c.G.mobs[0].roomPlayer={entered:true,companion:'claw'};let saved;c.put=(k,v)=>saved=plain(v);c.RUN_KEY='run';c.RUN_V=4;c.writeRun();assert.equal(saved.routeRoom.wave,2);assert(saved.roomPersonal.forgeUsed);assert.equal(saved.roomExtraRedraw,2);assert.equal(saved.mobs[0].route.wave,2);assert(saved.mobs[0].roomPlayer.entered);
 const codec=require('../compact-save');c.CompactSave=codec;c.SCENE='run';c.partSnap=()=>({});const code=c.makeRunCode(),run=JSON.parse(Buffer.from(codec.unpack('YXS',code)).toString());assert.equal(run.routeRoom.wave,2);assert(run.roomPersonal.forgeUsed);assert.equal(run.g.roomExtraRedraw,2);
});
check('Host plan preview and world packet share only route state; peer validates it without rerolling or sharing personal resources',()=>{
 room('outpost');const sent=[];c.COOP=true;c.window.NET=true;c.NET={send:m=>sent.push(plain(m)),isHost:()=>true};c.coopSendMe();const plan=c.roomPlan();plan.selected=plan.ids[0];c.coopSendMe();const payload=sent.at(-1);assert.equal(payload.roomPlan.selected,plan.selected);
 c.G.roomPersonal.secret='private';const pack=plain(c.packWorld());assert(!('roomPersonal'in pack));assert(!pack.mobs.some(m=>'roomPlayer'in m));assert(pack.routeInfo.seed===c.P.roomRun.seed);
 c.NET.isHost=()=>false;delete c.P.roomPlan;c.roomAcceptPlan(payload.roomPlan);assert.equal(c.P.roomPlan.selected,plan.selected);const before=JSON.stringify(c.P.roomPlan);c.roomAcceptPlan({floor:99,ids:['camp','camp','camp'],seed:1});assert.equal(JSON.stringify(c.P.roomPlan),before);c.COOP=false;c.window.NET=undefined;
});
check('Existing server readiness separates room revisions, so different selections cannot combine into a floor transition',()=>{
 room('outpost');const plan=c.roomPlan();plan.selected=plan.ids[0];const first=c.roomReadyKey();plan.rev++;const second=c.roomReadyKey();assert.notEqual(first,second);
 const server=read('server.js'),i=server.indexOf('function onMessage('),j=server.indexOf('\n}',i)+2,events=[],a={},b={},state={peers:[a,b],ready:{}};a.room=b.room=state;
 const ctx=vm.createContext({broadcast:(r,msg)=>events.push(msg),sendText(){},sendTo(){}});vm.runInContext(server.slice(i,j),ctx);
 ctx.onMessage(b,{t:'ready',what:first,on:true});ctx.onMessage(a,{t:'ready',what:second,on:true});assert(!events.some(e=>e.on));ctx.onMessage(b,{t:'ready',what:second,on:true});assert.equal(events.filter(e=>e.on).length,1);assert.equal(events.find(e=>e.on).what,second);
});
check('Client ignores late approvals for a previous door version and cancels its old readiness when the host changes selection',()=>{
 room('outpost');clear();const sent=[];c.COOP=true;c.window.NET=true;c.NET={send:m=>sent.push(plain(m)),isHost:()=>true};const plan=c.roomPlan();plan.selected=plan.ids[0];const oldKey=c.roomReadyKey();const host=plain(plan);c.NET.isHost=()=>false;c.P.roomPlan=plain(host);c.P.floorReady=true;c.P.floorReadyKey=oldKey;
 host.selected=host.ids[1];host.rev++;c.roomAcceptPlan(host);assert(!c.P.floorReady);assert.equal(sent.at(-1).what,oldKey);
 let handler,entered=0;const previous=c.closeStair;c.closeStair=()=>entered++;c.NET.on=(type,fn)=>{handler=fn};const source=read('game.js'),start=source.indexOf('  NET.on("go", function(msg){'),end=source.indexOf('  NET.on("mate",',start);vm.runInContext(source.slice(start,end),c);
 el('veilStair').hidden=false;handler({what:oldKey,on:true});assert.equal(entered,0);c.P.floorReady=true;c.P.floorReadyKey=c.roomReadyKey();handler({what:c.P.floorReadyKey,on:true});assert.equal(entered,1);c.closeStair=previous;c.closeStair(false);assert(!c.P.floorReady);assert(sent.some(m=>m.t==='ready'&&m.on===false));c.COOP=false;c.window.NET=undefined;
});
check('Actual stair flow requires selecting one door, generates that room once, and saves entry before any event choice',()=>{
 room('outpost');clear();c.askStair();assert(el('btnStairGo').disabled);const floor=c.G.floor;c.closeStair(true);assert.equal(c.G.floor,floor);const plan=c.roomPlan();plan.selected=plan.ids[0];const chosen=plan.selected;
 let saved,count=0;const oldCommit=c.commit;c.commit=keep=>{assert(keep);count++;saved={floor:c.G.floor,room:plain(c.G.routeRoom),personal:plain(c.G.roomPersonal)}};
 try{c.closeStair(true);assert.equal(c.G.floor,floor+1);assert.equal(c.G.routeRoom.id,chosen);assert.equal(saved.room.id,chosen);assert.equal(count,1);assert.equal(c.P.roomPlan,undefined);assert(c.P.hp<=c.stats().maxHp);}
 finally{c.commit=oldCommit;}
 room('elite',{floor:9});c.G.roomExtraRedraw=1;c.G.floor=10;c.roomPrepareFloor();assert.equal(c.G.roomExtraRedraw,0);
});
check('Actual resume restores private event costs and staged mobs without replaying entry shield or companions',()=>{
 room('rift');c.G.roomPersonal.forgeUsed=true;c.G.roomExtraRedraw=2;c.G.mobs[0].roomPlayer={entered:true,companion:'claw',petOpened:true};let saved;c.put=(k,v)=>saved=plain(v);c.RUN_V=4;c.writeRun();const hp=c.P.hp,shield=c.P.shield,roomName=c.G.routeRoom.actual;
 c.resumeRun(plain(saved));assert.equal(c.G.routeRoom.actual,roomName);assert.equal(c.P.hp,hp);assert.equal(c.P.shield,shield);assert(c.G.roomPersonal.forgeUsed);assert.equal(c.G.roomExtraRedraw,2);assert(c.G.mobs[0].roomPlayer.petOpened);c.roomApplyEntry();assert.equal(c.P.shield,shield);
 room('outpost');const old=plain(saved);delete old.routeRoom;delete old.roomPersonal;delete old.P.roomRun;c.resumeRun(old);assert.equal(c.roomMeta(),null);assert(c.P.roomRun.seed>=0);
});
check('An old two-per-wave ambush resumes its existing enemies and advances without being repopulated',()=>{
 room('ambush');c.G.mobs=c.G.mobs.filter((m,i)=>i%4<2);assert.equal(c.G.mobs.length,6);let saved;c.put=(k,v)=>saved=plain(v);c.RUN_V=4;c.writeRun();c.resumeRun(saved);assert.equal(c.G.mobs.length,6);assert.equal(c.G.mobs.filter(c.roomMobActive).length,2);kill(c.G.mobs[0]);kill(c.G.mobs[0]);assert.equal(c.G.routeRoom.wave,2);assert.equal(c.G.mobs.length,4);
});
check('Both entrypoints expose three-choice and event controls; pathfinding, walking timing and fallback trails are unchanged',()=>{
 for(const f of ['index.html','coop.html']){const html=read(f);for(const id of ['roomRoutes','roomLabel','veilRoomEvent','roomEventTitle','roomEventChoices','btnRoomEventClose'])assert.equal(html.split('id="'+id+'"').length,2,f+' '+id);}
 const cp=require('node:child_process');for(const file of ['dungeon-scene.js'])assert.equal(read(file),cp.execFileSync('git',['show','HEAD:'+file],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n'));
 const base=cp.execFileSync('git',['show','HEAD:game.js'],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n');for(const name of ['stepWalk','goTo']){const i=base.indexOf('function '+name+'('),j=base.indexOf('\n}',i)+2;assert.equal(definitions[name],base.slice(i,j),name);}
 const fx=read('dungeon-fx.js'),oldFx=cp.execFileSync('git',['show','ea31fd8:dungeon-fx.js'],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n');assert.equal(fx.slice(fx.indexOf('    move:function('),fx.indexOf('  if(reduce){')).replace('      walkPulse(map);\n',''),oldFx.slice(oldFx.indexOf('    move:function('),oldFx.indexOf('  if(reduce){')));
});
console.log(groups+' dungeon room checks passed.');
