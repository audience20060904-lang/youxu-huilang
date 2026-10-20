/* node dev/check-heirlooms.js: actual catalog, drops, events, game settlement and compatibility. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=path.join(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8'),c=vm.createContext({console,T:x=>x,L:a=>a,UI_EN:false,Math,TextEncoder,TextDecoder});
for(const name of ['content.js','hero-system.js','heirlooms.js'])vm.runInContext(read(name),c);
const H=c.Heirlooms,plain=x=>JSON.parse(JSON.stringify(x));let groups=0;
function check(name,fn){fn();groups++;console.log('PASS '+name);}
function base(item,hero='adv'){
 const p={hero,hp:30,shield:12,gold:300,combo:10,status:{weak:1},relics:[item.id,'a','b','c']};
 return {event:'right',floor:1,p,mob:{hp:100,x:1,y:1,status:{poison:2}},stats:{atk:100,maxHp:100},word:'one',cat:'animal',pos:'noun',spell:true,fast:true,seconds:4,left:6,fresh:true,due:true,haunt:true,wager:true,rarity:id=>({a:0,b:1,c:2}[id]??item.r),act(){}};
}
check('150 unique named relics, five rarities per hero, each with a mechanic and no ranks',()=>{
 assert.equal(H.items.length,150);assert.equal(new Set(H.items.map(r=>r.id)).size,150);assert.equal(new Set(H.items.map(r=>r.n)).size,150);
 for(const hero of c.HEROES){const set=H.items.filter(r=>r.heroOnly===hero.id);assert.deepEqual(plain(set.map(r=>r.r)),[0,1,2,3,4]);for(const r of set){assert(r.actions.length);assert(r.lore.length>15);assert(!/所有角色|出典：|清层专属池|不可合成|升阶/.test(r.pw+r.lore));assert(r.nobf);}}
});
check('Old 30 relic IDs retain their exact serialized indices',()=>{
 const old=vm.createContext({T:x=>x,UI_EN:false});vm.runInContext(read('content.js'),old);
 const oldHero=cp.execFileSync('git',['show','aa4c6ec:hero-system.js'],{cwd:root,encoding:'utf8'});vm.runInContext(oldHero,old);
 const prefix=old.RELICS.map(r=>r.id);assert.deepEqual(plain(c.RELICS.slice(0,prefix.length).map(r=>r.id)),plain(prefix));
});
check('All five rarity boundaries: no holy through floor 50, 1% from 51, capped at 6%',()=>{
 for(const [floor,p] of [[1,0],[50,0],[51,.01],[59,.01],[60,.02],[90,.05],[100,.06],[1000,.06]])assert(Math.abs(H.sacredChance(floor)-p)<1e-9);
 for(const f of [1,10,20,30,40,50])assert.notEqual(H.roll(f,[],()=>0).r,4);
 for(const f of [51,60,100]){let i=0;const p=H.sacredChance(f);assert.equal(H.roll(f,[],()=>i++?0:p-1e-8).r,4);i=0;assert.notEqual(H.roll(f,[],()=>i++?0:p).r,4);}
});
check('Global pool includes every hero, excludes equipped items, and never promotes unopened rarities',()=>{
 const heroes=new Set();for(let i=0;i<30;i++){let call=0;const r=H.roll(1,[],()=>call++?i/30:0);heroes.add(r.heroOnly);assert.equal(r.r,0);}assert.equal(heroes.size,30);
 const owned=H.items.filter(r=>r.r===0).map(r=>r.id);assert.equal(H.roll(1,owned,()=>0).r,1);
 const low=H.items.filter(r=>r.r<2).map(r=>r.id);assert.equal(H.roll(1,low,()=>0),null);
 const all=H.items.map(r=>r.id);assert.equal(H.roll(100,all,()=>0),null);
});
check('Every one of the 150 mechanics activates identically for an unrelated wearer',()=>{
 for(const item of H.items){
  function simulate(hero){const ctx=base(item,hero),fired=[];ctx.act=(r,k,n)=>fired.push([k,n]);
   for(let i=0;i<40;i++){
    ctx.floor=i+1;ctx.mob.x=i;ctx.word=item.trigger==='repeat'?'one':'word'+i;ctx.cat='category'+i%5;ctx.pos=i%2?'verb':'noun';ctx.seconds=4+(i%2)*.5;
    if(item.trigger==='reversal'){ctx.event='wrong';H.settle(ctx);}
    ctx.event=['floor','battle','kill','blocked','wardbreak'].includes(item.trigger)?item.trigger:'right';H.settle(ctx);
   }
   return {fired,state:plain(ctx.p.heirState)};
  }
  const a=simulate(item.heroOnly),b=simulate(item.heroOnly==='adv'?'saint':'adv');assert.deepEqual(a,b,item.id);
  assert(a.fired.length||Object.values(a.state).some(s=>s.souls>0),item.id+' never fires');
 }
});
check('Masks disable individual relic stats and triggers, not a character-dependent bonus',()=>{
 const r=H.items.find(r=>r.heroOnly==='tamer'&&r.r===0),ctx=base(r);assert.equal(H.bonus(ctx.p,'atk'),r.amount);
 ctx.mask={[r.id]:true};let fired=0;ctx.act=()=>fired++;ctx.event='battle';H.settle(ctx);assert.equal(fired,0);assert.equal(H.bonus(ctx.p,'atk',ctx.mask),0);assert.equal(H.bonus(ctx.p,'atk','all'),0);
});
check('Counters survive JSON save/resume; duplicate equipment does not duplicate effects',()=>{
 const r=H.items.find(r=>r.heroOnly==='adv'&&r.r===0),ctx=base(r);ctx.p.relics=[r.id,r.id];let n=0;ctx.act=()=>n++;
 H.settle(ctx);H.settle(ctx);assert.equal(n,0);ctx.p=plain(ctx.p);H.normalize(ctx.p);H.settle(ctx);assert.equal(n,1);assert.equal(H.bonus(ctx.p,'atk'),r.amount);
});
check('Re-entering a monster and resuming the same floor cannot farm free shields/guards',()=>{
 const r=H.items.find(r=>r.heroOnly==='adv'&&r.r===4),ctx=base(r);ctx.event='battle';let count=0;ctx.act=()=>count++;H.settle(ctx);const once=count;H.settle(ctx);assert.equal(count,once);ctx.mob.x++;H.settle(ctx);assert.equal(count,once*2);
 const f=H.items.find(r=>r.heroOnly==='heir'&&r.r===3);ctx.p.relics=[f.id];ctx.event='floor';count=0;H.settle(ctx);const first=count;H.settle(ctx);assert.equal(count,first);ctx.floor++;H.settle(ctx);assert.equal(count,first*2);
});
check('Sacred time anchor rescues once per floor for any hero; old ranks are discarded',()=>{
 const r=H.items.find(r=>r.heroOnly==='rewinder'&&r.r===4),p={hero:'adv',hp:0,relics:[r.id],heroRelicRanks:{hx_adv:999}};
 H.normalize(p);assert(!('heroRelicRanks'in p));assert.equal(H.rescue(p,51).pct,.25);assert.equal(H.rescue(p,51),null);assert.equal(H.rescue(p,52).pct,.25);p.relics=[];assert.equal(H.rescue(p,53),null);
});
// Load the actual bridge, acquisition, guard and merge code.
const source=read('game.js').replace(/\r\n/g,'\n');
function load(name){const i=source.indexOf('function '+name+'('),j=source.indexOf('\n}',i);assert(i>=0&&j>i,name);vm.runInContext(source.slice(i,j+2),c);}
Object.assign(c,{window:{},RMASK:null,P:{},G:{floor:51,mobs:[]},B:null,stats:()=>({atk:100,maxHp:100}),shieldCap:()=>100,
 buildEvent(){},statusGain:(p,k,n)=>{if(!p)return;p.status=p.status||{};p.status[k]=Math.min(5,(p.status[k]||0)+n);},relicRar:id=>c.RELICS.find(r=>r.id===id)?.r||0,
 coopDealDamage:(m,n)=>m.hp-=n,floatNum(){},healUp:n=>c.P.hp=Math.min(100,c.P.hp+n),earnGold:n=>c.P.gold+=n,addSpent(){},T:x=>x});
load('heirEvent');
check('Actual bridge: pet attacks work on other heroes, cap opening hits and apply damage/status mechanics',()=>{
 const r=H.items.find(r=>r.heroOnly==='tamer'&&r.r===0);c.P={hp:100,hero:'adv',relics:[r.id],status:{}};const mob={hp:1,x:0,y:0,status:{}};c.G={floor:1,mobs:[mob]};c.heirEvent('battle',{mob});assert.equal(mob.hp,1);
 mob.x=1;mob.hp=100;c.heirEvent('battle',{mob});assert.equal(mob.hp,75);
});
check('Actual takeRelic accepts another family, duplicate clicks cannot upgrade, synthesis rejects exclusives',()=>{
 const ids={};Object.assign(c,{$:id=>ids[id]||(ids[id]={}),relicById:id=>c.RELICS.find(r=>r.id===id),withMaxHp:f=>f(),relicFull:()=>false,noteRelicFound(){},say(){},rc:r=>r.n,renderHud(){},render(){},maybeRelic(){}});
 load('takeRelic');const r=H.items.find(r=>r.heroOnly==='bard'&&r.r===1);c.P={hero:'adv',hp:100,relics:[]};c.G={};c.takeRelic(r.id);assert.deepEqual(plain(c.P.relics),[r.id]);c.takeRelic(r.id);assert.equal(c.P.relics.length,1);assert(!c.P.heroRelicRanks);
 load('fuseTake');c.fusePicks=[r.id];c.fuseVia=null;c.fuseHow='';c.fuseTake(r.id);assert.equal(c.P.relics.length,1);
});
check('Actual mitigation consumes exactly one stored guard before shields or dodge rolls',()=>{
 load('mitigate');let row=null;c.hurtRow=(k,v)=>row=[k,v];c.P={heirGuard:2};const out=c.mitigate(70,{def:0});assert.equal(out.dmg,0);assert.equal(out.dodged,false);assert.equal(c.P.heirGuard,1);assert.deepEqual(row,['@heirloom',-70]);
});
check('Actual floor-entry settlement grants heirloom resources to an unrelated hero before saving',()=>{
 const r=H.items.find(r=>r.heroOnly==='heir'&&r.r===3);c.P={hero:'adv',hp:100,relics:[r.id],status:{}};c.G={floor:2,mobs:[]};c.stats=()=>({atk:100,maxHp:100});
 let saved=0;Object.assign(c,{sayFloorIntro(){},clampShield(){},heroSnapFloor(){},commit(){saved=c.P.heirGuard;}});
 const start=source.indexOf('  sayFloorIntro();',source.indexOf('function nextFloor(')),end=source.indexOf('  const lk =',start);assert(start>0&&end>start);
 vm.runInContext(source.slice(start,end),c);assert.equal(c.P.heirGuard,1);assert.equal(saved,1);assert.equal(c.P.status.renew,2);
});
console.log(groups+' heirloom checks passed.');
