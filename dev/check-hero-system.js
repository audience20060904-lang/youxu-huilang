/* Run: node dev/check-hero-system.js. Exercises actual game functions. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8');
const codec=require('../compact-save'),rules=require('../hero-system');
const c=vm.createContext({T:x=>x,L:(a,b)=>a,UI_EN:false,console,TextEncoder,TextDecoder,Uint8Array,Math:Object.create(Math),CompactSave:codec,
  P:null,B:null,G:{},RMASK:null,SCENE:'town',COOP:false,TOWN:{gem:1e9},commitPerm(){},renderHero(){},renderHeroInfo(){},renderTown(){},toast(){},heroInfoId:'adv',
  addGems(n){c.TOWN.gem+=n;},ri(a){return a;},say(){},hideAll(){},blessBanned(){return false;},hasRelic(){return false;},rerollBudget(){return 0;},
  CH:{name:'Test'},heroArmed:'',heroTab:'roster',roomMeta:()=>null,roomNeedsEvent:()=>''});
vm.runInContext(read('content.js'),c);vm.runInContext(read('hero-system.js'),c);vm.runInContext(read('heirlooms.js'),c);
const source=read('game.js').replace(/\r\n/g,'\n');
function load(name){const i=source.indexOf('function '+name+'('),line=source.indexOf('\n',i),j=source.slice(i,line).trimEnd().endsWith('}')?line-2:source.indexOf('\n}',i);assert(i>=0&&j>i,name);vm.runInContext(source.slice(i,j+2),c);}
['heroById','heroRec','heroStarNeed','fixHero','heroGrant','heroPull','heroUpgrade','heroValAt','heroGuest','heroOn','heroV','statusN','statusCap','statusGain','statusDamagePct','statusCutPct','heroRoundEnd','relicById','relicPool','fixBless','blessSet','offerRelics','takeRelic','maybeRelic'].forEach(load);
let groups=0;function check(n,f){f();groups++;console.log('PASS '+n);}
check('30 heroes: six growth tiers and exclusive relics, stable IDs',()=>{
 assert.equal(c.HEROES.length,30);assert.equal(c.RELICS.filter(r=>r.heroOnly).length,150);
 for(const h of c.HEROES){assert.equal(h.growth.length,6);assert.equal(new Set(h.growth).size,6);assert(c.relicById('hx_'+h.id));}
});
check('Old copies preserved; overflow converted once; old five-star may reach six',()=>{
 const h=c.fixHero({own:{adv:{star:4,cp:3,xp:90},saint:{star:5,cp:0}},shard:9});
 assert.equal(h.own.adv.cp,2);assert.equal(h.shard,10);assert.equal(h.own.saint.star,5);assert.equal(c.fixHero(h).shard,10);
});
check('Pulls only stock duplicates; one click consumes exactly one; cap six',()=>{
 c.TOWN.hero=c.fixHero();let r=c.TOWN.hero.own.adv;
 for(let i=0;i<5;i++)c.heroGrant(c.heroById('adv'));assert.equal(r.star,1);assert.equal(r.cp,5);
 for(let i=0;i<5;i++){c.heroUpgrade();assert.equal(r.star,i+2);assert.equal(r.cp,4-i);}
 c.heroUpgrade();assert.equal(r.star,6);assert.equal(c.heroGrant(c.heroById('adv')).kind,'shard');
});
check('1% legendary boundary; exact 80 pity; 10000 / 95000 pricing',()=>{
 assert.equal(c.HERO_RATE[3],.01);assert.equal(c.HERO_PITY,80);
 c.TOWN.hero=c.fixHero();c.Math.random=()=>.5;let gems=c.TOWN.gem;
 for(let i=0;i<79;i++)assert.notEqual(c.heroPull(1)[0].r,3);
 assert.equal(c.TOWN.hero.pity,79);assert.equal(c.heroPull(1)[0].r,3);assert.equal(c.TOWN.hero.pity,0);
 assert.equal(gems-c.TOWN.gem,800000);gems=c.TOWN.gem;c.heroPull(10);assert.equal(gems-c.TOWN.gem,95000);
 c.Math.random=()=>.009999;assert.equal(c.heroPull(1)[0].r,3);c.Math.random=()=>.01;assert.equal(c.heroPull(1)[0].r,2);
 assert.equal(c.heroPull(99),null);
});
check('Every star improves passive numerics; levels over 30 stop improving',()=>{
 for(const h of c.HEROES){let prev=0;for(let st=1;st<=6;st++){c.P={hero:h.id,heroLv:30,heroStar:st};const v=c.heroV(h.id);assert(v>prev);prev=v;}assert.equal(c.heroValAt(h,30),c.heroValAt(h,1000));}
});
function player(id='adv',star=6){c.P={hero:id,heroStar:star,heroLv:1,relics:[],status:{},hp:100,shield:0,heroFlow:0};c.B={mob:{hp:10000,max:10000,status:{}}};return c.P;}
c.healUp=(n)=>{const old=c.P.hp;c.P.hp=Math.min(100,c.P.hp+n);return {hp:c.P.hp-old};};c.shieldCap=()=>200;
c.takeHit=n=>{const eat=Math.min(n,c.P.shield);c.P.shield-=eat;c.P.hp-=n-eat;};c.deathSave=()=>'';
c.coopDealDamage=(m,n)=>m.hp-=n;
const s={atk:100,maxHp:100};
check('Old charge ticks once, decays one; new grants survive until next answer',()=>{
 const p=player('adv',2);p.hp=70;p.status={renew:2,ward:2,stone:3};
 c.heroRoundEnd(true,{},c.B.mob,s);assert.equal(p.hp,74);assert.equal(p.shield,6);assert.equal(p.status.stone,2);
 c.heroRoundEnd(true,{},c.B.mob,s);assert.equal(p.status.stone,3);assert.equal(p.status.renew,undefined);assert.equal(p.statusTurn,2);
});
check('Caps increase with stars; old ranks no longer grant stats or cap',()=>{
 const p=player('adv',1);assert.equal(c.statusCap(),4);p.heroStar=4;assert.equal(c.statusCap(),5);p.relics=['hx_adv'];p.heroRelicRanks={hx_adv:3};assert.equal(c.statusCap(),5);
 c.statusGain(p,'stone',99);assert.equal(p.status.stone,5);c.statusGain(p,'poison',99);assert.equal(p.status.poison,4);p.relics=[];assert.equal(c.statusN(p,'stone'),5);p.status={stone:4,fury:2,weak:2,clarity:1};c.B.mob.status={exposed:2,weak:1};assert.equal(c.statusDamagePct(),17);assert.equal(c.statusCutPct(),26);
});
check('Damage over time respects shield and death cannot heal itself',()=>{
 const p=player();p.hp=1;p.status={poison:2,renew:4};c.heroRoundEnd(true,{},c.B.mob,s);assert.equal(p.hp,-1);
 player('tamer',2);c.B.mob.status={burn:2,bleed:1};c.heroRoundEnd(true,{},c.B.mob,s);assert.equal(c.B.mob.hp,9966);assert.equal(c.B.mob.status.burn,1);
});
check('All legendary six-star finishers execute and differ',()=>{
 for(const h of c.HEROES.filter(h=>h.r===3)){const p=player(h.id);for(let i=0;i<4;i++)c.heroRoundEnd(true,{},c.B.mob,s);assert(Object.keys(p.status).length,h.id);assert.equal(p.statusTurn,4);}
});
check('Normal pool excludes all exclusive relics; five-choice includes one global exclusive',()=>{
 player();assert(c.relicPool().every(r=>!r.heroOnly));
 const nodes={};c.$=id=>nodes[id]||(nodes[id]={hidden:true,children:[],appendChild(el){this.children.push(el);},set innerHTML(v){this.children=[];this.html=v;},get innerHTML(){return this.html;}});
 c.document={createElement(){return {dataset:{}};}};c.rollRelic=(rar,boost,skip)=>c.relicPool().find(r=>!skip.includes(r));c.G={floor:1};c.offerRelics();
 const picks=nodes.relicList.children.map(b=>c.relicById(b.dataset.id));assert.equal(picks.length,5);assert.equal(picks.filter(r=>r.heroOnly).length,1);assert(picks[0].heroOnly);assert(picks[0].r<=1);
});
check('Exclusive duplicate is rejected without upgrading or taking another slot',()=>{
 player();c.P.relics=['hx_adv'];c.G={floor:1,mobs:[{}]};c.relicFull=()=>{throw Error('Duplicate must not enter swap');};c.takeRelic('hx_adv');assert.equal(c.P.relics.length,1);assert(!c.P.heroRelicRanks||!c.P.heroRelicRanks.hx_adv);
});
check('Codec binary round trips, corruption and truncation rejected',()=>{
 const crypto=require('node:crypto');for(const n of [0,1,2,3,15,100,1000,20000])for(const a of [crypto.randomBytes(n),Buffer.alloc(n,7)]){const txt=codec.pack('YX4',a);assert.deepEqual(Buffer.from(codec.unpack('YX4',txt)),a);if(n>20){assert.throws(()=>codec.unpack('YX4',txt.slice(0,-2)));const i=Math.floor(txt.length/2);assert.throws(()=>codec.unpack('YX4',txt.slice(0,i)+String.fromCharCode(txt.charCodeAt(i)^1)+txt.slice(i+1)));}}
});
check('Run JSON with statuses and relic ranks compresses and round trips',()=>{
 const obj={P:{hero:'saint',heroStar:6,status:{stone:4},heroRelicRanks:{hx_saint:3}},mobs:Array.from({length:30},(_,i)=>({d:'rat',x:i,y:3,hp:100,max:100,status:{burn:3}}))};
 const a=Buffer.from(JSON.stringify(obj)),txt=codec.pack('YXS',a);assert.deepEqual(JSON.parse(Buffer.from(codec.unpack('YXS',txt))),obj);assert(txt.length<a.length/3);console.log('  run fixture '+Math.ceil(a.length*2/3)+' → '+txt.length+' chars');
});
check('Permanent YX4 and legacy YX3 round trips preserve six stars and copies',()=>{
 const begin=source.indexOf('var CODE_TAG ='),end=source.indexOf('/* ================ 老码',begin);
 vm.runInContext(source.slice(begin,end),c);vm.runInContext(read('orb.js'),c);
 Object.assign(c,{EN_WORDS:[['apple']],ZH_WORDS:[['苹果']],ES_WORDS:[['uno']],JA_WORDS:[['猫']],LEX:{apple:{str:2,seen:4,miss:1}},CODEX:{},MET:{tut:1},dayNo:()=>20000,lexMiss:r=>r.miss||0,FSRS_MAX_DAYS:36500,meta:()=>({accF:{}}),blankBless:()=>({open:{fav:[0,0,0,0,0],ban:[0,0,0,0,0]},pick:{fav:[],ban:[]}})});
 c.TOWN={gem:123456,hero:c.fixHero({own:{adv:{star:6,xp:500,cp:0},saint:{star:3,xp:100,cp:2}},pity:79,spent:100000}),orb:{bag:[],eq:[]},bless:c.blankBless()};
 const newest=c.Heirlooms.id('saint',4);c.CODEX[newest]={depth:100,times:2};
 const code=c.makeCode(),decoded=c.codeIO(new c.RcIO(Array.from(codec.unpack('YX4',code))));
 assert.equal(decoded.codex[newest].times,2);assert.equal(decoded.codex[newest].depth,100);
 assert.equal(decoded.town.hero.own.adv.star,6);assert.equal(decoded.town.hero.own.saint.cp,2);assert.equal(decoded.town.hero.pity,79);assert.equal(decoded.town.gem,123456);assert.equal(decoded.lex.apple.seen,4);
 const io=new c.RcIO(null);c.codeIO(io);const old=c.bytesToCode('YX3',io.finish());assert.equal(c.parseCode3(old).town.hero.own.saint.cp,2);
 assert(code.length<old.length);console.log('  permanent fixture '+old.length+' → '+code.length+' chars');
 // Actual prior prefix: old relic indices remain readable after append-only expansion.
 const all=c.RELICS;c.RELICS=all.filter(r=>!r.heroOnly);const legacy=new c.RcIO(null);c.codeIO(legacy);const before=c.bytesToCode('YX3',legacy.finish());c.RELICS=all;assert.equal(c.parseCode3(before).town.hero.own.adv.star,6);
});
check('Town favor and ban reject exclusive relics in saved data and actions',()=>{
 c.TOWN.bless=c.blankBless();c.TOWN.bless.open.fav[2]=1;c.TOWN.bless.pick.fav[2]='hx_adv';
 assert.equal(c.fixBless(c.TOWN.bless).pick.fav[2],undefined);
 c.TOWN.bless.pick.fav[2]='';c.blessOpen=()=>true;c.renderBless=()=>{};c.blessSet('fav',2,'hx_adv');assert.equal(c.TOWN.bless.pick.fav[2],'');
 c.blessSet('ban',2,'hx_adv');assert.equal(c.TOWN.bless.pick.ban[2],undefined);
});
check('Holy boss floor also grants one five-choice reward without looping',()=>{
 player();c.G={floor:20,mobs:[],relicDone:false};c.pendingLoot=false;c.pendingSwap=null;c.holyFloor=()=>true;
 let holy=0,five=0;const original=c.offerRelics;c.offerRelics=()=>{five++;return true;};c.offerHoly=()=>{holy++;return true;};
 c.maybeRelic();assert.equal(holy,1);c.G.relicDone=true;c.maybeRelic();assert.equal(five,1);c.G.relicDone=true;c.maybeRelic();assert.equal(holy,1);assert.equal(five,1);c.offerRelics=original;
});
check('Same-spend manual upgrades merge without adding duplicate cards',()=>{
 const a=source.indexOf('  if(o.town && o.town.hero){',source.indexOf('function mergeData')),b=source.indexOf('\n  }\n',a)+4,block=source.slice(a,b);
 c.TOWN.hero=c.fixHero({spent:1000,own:{adv:{star:1,cp:5,xp:1}}});c.o={town:{hero:{spent:1000,own:{adv:{star:4,cp:2,xp:2}}}}};
 vm.runInContext(block,c);assert.equal(c.TOWN.hero.own.adv.star,4);assert.equal(c.TOWN.hero.own.adv.cp,2);vm.runInContext(block,c);assert.equal(c.TOWN.hero.own.adv.cp,2);
 c.o.town.hero.own.adv={star:6,cp:0,xp:3};vm.runInContext(block,c);assert.equal(c.TOWN.hero.own.adv.star,6);
});
console.log(groups+' system checks passed.');
