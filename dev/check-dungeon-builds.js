/* node dev/check-dungeon-builds.js — actual combat, persistence and build/Endless boundaries. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=path.join(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8').replace(/\r\n/g,'\n');
const c=vm.createContext({console,T:x=>x,L:a=>a,UI_EN:false,TextEncoder,TextDecoder,Math:Object.create(Math),window:{}}),plain=x=>JSON.parse(JSON.stringify(x));
for(const f of ['content.js','hero-system.js','heirlooms.js'])vm.runInContext(read(f),c,{filename:f});
const oldIds=plain(c.RELICS.map(r=>r.id));vm.runInContext(read('dungeon-rules.js'),c);
const R=c.DungeonRules,source=read('game.js'),definitions={};let groups=0;
function check(name,fn){fn();groups++;console.log('PASS '+name);}
for(const match of source.matchAll(/^function (\w+)\(/gm)){
 const start=match.index,eol=source.indexOf('\n',start),head=source.slice(start,eol);let end=/}\s*(?:\/\/.*)?$/.test(head)?eol:source.indexOf('\n}',eol)+2;
 while(true){try{new vm.Script(source.slice(start,end));break;}catch(e){const next=source.indexOf('\n}',end);if(next<0)throw e;end=next+2;}}
 definitions[match[1]]=source.slice(start,end);vm.runInContext(definitions[match[1]],c,{filename:'game.js:'+match[1]});
}
const nodes={};let visual=[],interval=null,now=10000;
function node(id){return nodes[id]||(nodes[id]={id,hidden:true,innerHTML:'',textContent:'',children:[],style:{},classList:{add(){},remove(){},toggle(){},contains(){return false}},appendChild(){}});}
Object.assign(c,{AMP_OFF:false,RMASK:null,COOP:false,FLOORS:c.CHAPTER.floors,W:c.CHAPTER.W,H:c.CHAPTER.H,RELIC_MAX:15,RELIC_IDX:null,HR:null,hitLost:0,
 ST_KEYS:['atk','maxHp','def','defGear','crit','hpAdd'],PART_KEYS:['atk','pct','flat','extra','cm','def','cut'],LEX:{},MET:{},CODEX:{},TOWN:{hero:{own:{}}},OPT:{},lastDmgRec:null,lastHurtRec:null,pendingRoom:null,
 $:node,document:{createElement:()=>node('new')},clearQTimer(){},setTimeout(){},setInterval:f=>{interval=f;return 1},clearInterval(){interval=null},qTimer:null,
 pick:a=>a[Math.floor(c.Math.random()*a.length)],ri:(a,b)=>a+Math.floor(c.Math.random()*(b-a+1)),chapterPos:()=>['noun'],blessBanned:()=>false,blessFavored:()=>false,blessPick:a=>a[Math.floor(c.Math.random()*a.length)],
 say(){},floatNum(){},hurtRow(){},hurtSplit(){},flaskDrink(){},renderHud(){},renderBattleBars(){},renderCombatFeedback(){},render(){},fxLevelUp(){},cancelWalk(){},autoOff(){},fxKill(){},lockInput(){},tutEvent(){},maybeRelic(){},fxRelic(){},markNewRelic(){},blessNoteGot(){},
 queueVisualHit(hero,kind,damage,count=1){visual.push({hero,kind,damage,count});return true},
 LANG_LEARN:'en',LEARN_JA:false,LEARN_CJK:false,lexKey:w=>w.en,lexMark:(r,ok)=>{r.str=ok?(r.str||0)+1:0;},lexDue:()=>true,lexMiss:r=>r.wrong||0,lexHow:()=> 'ok',wordFull:w=>w.en,noteMissToday(){},HAUNT_MAX:6,heroAskQ:null});
vm.runInContext(definitions.answer.slice(0,definitions.answer.indexOf('  LEX[lexKey(word)] = rec;')).replace('function answer(','function actualAnswer(')+'\nreturn {damage:visualHealth.hp-m.hp,hp:P.hp,shield:P.shield};\n}',c);
function reset(ids=[],opt={}){
 c.CH=c.CHAPTERS.find(x=>x.id===(opt.chapter||1));c.Math.random=()=>.99;c.RMASK=null;c.AMP_OFF=false;c.HR=null;c.hitLost=0;c.LEX={};c.MET={};c.lastDmgRec=null;c.lastHurtRec=null;visual=[];
 c.P=Object.assign({x:1,y:1,lvl:opt.level||1,xp:0,hp:100,gold:1000,kills:0,right:0,wrong:0,seenWords:[],used:{},combo:0,maxCombo:0,relics:ids.slice(),haunt:[],hauntAt:{},spent:0,shield:0,aegisN:0,recoil:0,revived:0,practice:false,diff:'A',down:false,accF:{},blessGot:[],holy:[],sanct:null,bossKills:0,holyWords:0,trial:0,eyeStack:0,melted:0,thunder:0,sellN:0,hero:'adv',heroLv:1,heroStar:1,status:{},heroFlow:0,heroSouls:0,heroXp:0,heirState:{},heirGuard:0},opt.player||{});
 c.G={floor:opt.floor||40,mobs:[],catSeen:{},healed:0,killsAt:0};
 c.B={mob:{x:1,y:1,hp:10000,max:10000,dmg:20,armor:0,status:{},def:{},cat:'nature',name:'Test foe'},wager:!!opt.wager,q:{type:'en2zh',word:{en:'chemistry',cn:'化学',cat:'nature',pos:'noun',lv:1},haunted:false},qAt:Date.now()-1000,fxHits:[]};
 c.G.mobs=[c.B.mob];const s=c.stats();c.P.hp=Math.min(c.P.hp,s.maxHp);return s;
}
function round(ok=true){c.B.locked=false;return c.actualAnswer(null,ok);}
function event(kind,extra={}){c.buildEvent(kind,Object.assign({mob:c.B.mob},extra));}
check('Twelve appended relics preserve all 434 historical save indices, four usable build families',()=>{
 assert.equal(oldIds.length,434);assert.equal(c.RELICS.length,446);assert.deepEqual(plain(c.RELICS.slice(0,434).map(r=>r.id)),oldIds);assert.equal(new Set(c.RELICS.map(r=>r.id)).size,446);
 for(const flow of Object.keys(R.flows)){const items=R.items.filter(r=>r.flow===flow);assert.deepEqual(plain(items.map(r=>r.r)),[2,3,4]);for(const r of items){assert(!r.heroOnly);assert(r.nobf);assert(!/undefined|NaN|次3 秒|升阶/.test(r.pw));assert(r.pw.endsWith('。'));}}
});
check('Shield break stores charges once per foe, waits for a later right answer, survives JSON and cannot farm re-entry',()=>{
 const s=reset(['db_rivet','db_reforge','db_anvil']);event('battle');const shield=c.P.shield;assert(shield>=Math.round(s.maxHp*.15));event('battle');assert.equal(c.P.shield,shield);
 c.landHit(shield,c.B.mob,false);assert.equal(c.P.builds.rivet,1);assert.equal(c.P.builds.anvil,2);assert.equal(c.P.status.stone,2);
 const hp=c.B.mob.hp;event('after',{ok:true});assert.equal(c.B.mob.hp,hp);c.P=plain(c.P);c.B.mob=plain(c.B.mob);c.G.mobs=[c.B.mob];
 round(false);assert.equal(c.P.builds.rivet,1);round();assert.equal(c.P.builds.rivet,0);assert.equal(c.P.builds.anvil,1);assert(c.P.shield>0);round();assert.equal(c.P.builds.anvil,0);
 c.P.shield=0;event('wardbreak');assert.equal(c.P.builds.rivet,0);assert.equal(c.P.builds.anvil,0);
});
check('Bleed detonates exactly four stacks once, combines both cores, spreads to at most three living other foes',()=>{
 const s=reset(['db_needle','db_fuse','db_tide']);c.P.builds={right:1};c.B.mob.status={bleed:2};c.G.mobs.push(...Array.from({length:5},()=>({hp:100,status:{}})));event('after',{ok:true});
 assert.equal(c.B.mob.status.bleed,undefined);assert.equal(c.B.mob.hp,10000-Math.round(s.atk*2.7));assert.equal(c.G.mobs.filter(m=>m!==c.B.mob&&m.status.bleed===2).length,3);
 reset(['db_fuse']);c.B.mob.status={bleed:3};c.P.builds={right:1};event('after',{ok:true});assert.equal(c.B.mob.hp,10000);assert.equal(c.B.mob.status.bleed,3);
});
check('Summons consume individual marks, maintain bounded counters and permit only one non-recursive spirit per question',()=>{
 reset(['db_whistle','db_hunt','db_banner']);event('battle');event('before',{ok:true});event('summon',{hits:12});
 assert.equal(c.B.mob.builds.marks,0);assert.equal(c.P.status.drain,3);assert(c.P.shield>0);assert.equal(visual.filter(v=>v.damage===Math.round(c.stats().atk*.9)).length,1);assert(c.P.builds.summons<3);
 const before=visual.length;event('summon',{hits:12});assert.equal(visual.length,before);assert(c.P.builds.summons<3);
 event('before',{ok:true});event('summon',{hits:3});assert.equal(visual.length,before+2);
 c.B.q=null;c.B.mob.hp=1;event('before',{ok:true});event('summon',{hits:17,wasAlive:true});assert.equal(c.B.mob.hp,1);
});
check('Actual necromancer and inherited pet hits trigger coordination while keeping their independent visual segments',()=>{
 reset(['db_whistle','db_banner'],{player:{hero:'necro',heroSouls:12}});event('battle');round();assert(visual.some(v=>v.kind==='soul'&&v.count===12));assert.equal(c.B.mob.builds.marks,0);assert(c.P.builds.summons<3);
 const pet=c.Heirlooms.items.find(r=>r.heroOnly==='tamer'&&r.r===0);reset([pet.id,'db_whistle','db_banner']);c.B.q=null;event('battle');c.heirEvent('battle',{mob:c.B.mob});assert(visual.some(v=>v.kind==='pet'));assert.equal(c.B.mob.builds.marks,2);
});
check('Blessing rotation records actual gains only once per question; four kinds grant both rewards and no zero-HP resurrection',()=>{
 reset(['db_prism','db_orbit']);const max=c.stats().maxHp;c.P.hp=Math.floor(max/2);
 for(const key of ['stone','fury','renew','ward']){event('before',{ok:false});c.statusGain(c.P,key,2);c.statusGain(c.P,'clarity',1);event('after',{ok:false});}
 assert.equal(c.P.builds.blessings.length,0);assert.equal(c.P.heirGuard,1);assert(c.P.hp>max/2);assert(c.B.mob.hp<10000);
 reset(['db_prism']);c.P.status={stone:4};event('before',{ok:false});c.statusGain(c.P,'stone',1);event('after',{ok:false});assert.equal(c.P.builds.blessings.length,0);
 c.P.hp=0;assert.equal(c.healUp(100).hp,0);assert.equal(c.P.hp,0);
});
check('Unrelated wearers receive identical base effects, with amplification and masks working through existing rules',()=>{
 for(const item of R.items){const values=[];for(const hero of ['adv','mage','saint']){reset([item.id],{player:{hero}});event('battle');values.push(plain({shield:c.P.shield,status:c.P.status,marks:c.B.mob.builds.marks}));}assert.deepEqual(values[0],values[1]);assert.deepEqual(values[1],values[2]);
  assert.equal(R.bonus(c.P,item.stat),item.amount);assert.equal(R.bonus(c.P,item.stat,'all'),0);assert.equal(R.bonus(c.P,item.stat,{[item.id]:true}),0);}
 reset(['thousandface']);const base=c.stats().atk;c.P.face={f:c.G.floor,ids:['db_hunt']};assert.equal(c.stats().atk,base+5);event('before',{ok:true});event('before',{ok:true});assert.equal(c.B.mob.builds.marks,2);
});
check('Endless milestones start at 50, stack every ten, never reroll on repeat/load, handle damaged or extreme inputs',()=>{
 const p={};let rolls=0;for(const [floor,count] of [[49,0],[50,1],[59,1],[60,2],[70,3],[100,6]]){R.advance(p,floor,()=>{rolls++;return 0});assert.equal(p.endlessMods.picks.length,count);}
 const saved=plain(p);R.advance(saved,100,()=>{throw Error('rerolled')});assert.deepEqual(plain(saved),plain(p));assert.equal(rolls,6);
 assert.equal(R.counts(p.endlessMods).vital,6);p.endlessMods.picks.push('unknown');R.normalize(p);assert.equal(p.endlessMods.picks.length,6);
 assert.equal(R.advance({},Infinity).picks.length,0);assert.equal(R.advance({},1e9,()=>0).picks.length,10000);
});
check('HP, attack and armor modifiers apply exactly once to normal monsters and bosses; normal/study/tutorial runs stay unchanged',()=>{
 reset([],{chapter:5,floor:60});c.P.endlessMods={picks:['vital','vital','might','plate']};const def=c.FOES[0],base=c.foeNums(def,60),m=c.makeFoe(def,0,0);assert.equal(m.hp,Math.round(base.hp*1.24));assert.equal(m.dmg,Math.round(base.dmg*1.08));assert.equal(m.armor,base.armor+2);
 const ref=c.refFoe(59,true),boss=c.makeBossFoe({ ...def,boss:true },0,0);assert.equal(boss.hp,Math.round(Math.round(ref.hp*c.BOSS_HP_X)*1.24));assert.equal(boss.dmg,Math.round(Math.round(ref.dmg*c.BOSS_DMG_X)*1.08));assert.equal(boss.armor,base.armor+2);
 for(const mode of ['normal','study','tut']){reset([],{chapter:mode==='normal'?1:5,floor:70,player:{[mode]:true,endlessMods:{picks:['might']}}});assert.deepEqual(plain(c.endlessMods()),{});}
});
check('Wrong answers apply capped debuffs and dispel; every third submitted answer purges and withers',()=>{
 const s=reset([],{chapter:5,floor:100});c.P.endlessMods={picks:['weak','weak','weak','weak','exposed','poison','burn','dispel','purge','wither']};c.P.status={stone:4,fury:2};c.B.mob.status={bleed:4,burn:4};
 for(let i=0;i<3;i++)c.endlessRound(false,c.B.mob,s);assert.equal(c.P.status.weak,4);assert.equal(c.P.status.poison,3);assert.equal(c.P.status.burn,3);assert.equal(c.P.status.stone,undefined);assert.equal(c.B.mob.status.bleed,3);assert.equal(c.B.mob.endless.rounds,3);
});
check('Dread cannot farm re-entry, famine caps at 50 percent and only reduces healing during live combat',()=>{
 const s=reset([],{chapter:5,floor:100});c.P.endlessMods={picks:['dread','dread',...Array(10).fill('famine')]};c.endlessBattle(c.B.mob);assert.equal(c.P.status.weak,2);delete c.P.status.weak;c.endlessBattle(c.B.mob);assert.equal(c.P.status.weak,undefined);
 c.P.hp=1;assert.equal(c.healUp(10,s).hp,5);c.B.mob.hp=0;assert.equal(c.healUp(10,s).hp,10);
});
check('Reprisal fires each third right answer, uses guards/mitigation and the final risk multiplier without advancing learning rounds',()=>{
 const s=reset([],{chapter:5,floor:100,wager:true,level:50});c.P.endlessMods={picks:['reprisal','reprisal','reprisal']};c.P.heirGuard=1;const hp=c.P.hp;
 for(let i=0;i<3;i++)c.endlessRound(true,c.B.mob,s);assert.equal(c.P.hp,hp);assert.equal(c.P.heirGuard,0);assert.equal(c.P.right,0);
 for(let i=0;i<3;i++)c.endlessRound(true,c.B.mob,s);assert(c.P.hp<hp);assert(hp-c.P.hp<=Math.ceil(s.maxHp*.08)*2);assert.equal(c.B.mob.endless.right,6);
 assert(!definitions.timeUp.includes('endlessRound'));assert(!definitions.timeUp.includes('buildEvent("after"'));
});
check('One-layer pre-answer afflictions trigger heirlooms despite end-of-round decay; dead targets cannot spend merchant gold',()=>{
 const relic=c.Heirlooms.items.find(r=>r.trigger==='afflicted');assert(relic);reset([relic.id],{player:{status:{weak:1}}});const fired=[],orig=c.Heirlooms.settle;
 c.Heirlooms.settle=ctx=>{const act=ctx.act;ctx.act=(...args)=>{fired.push(args);act(...args)};orig(ctx)};try{for(let i=0;i<relic.every;i++){c.P.status={weak:1};round();}}finally{c.Heirlooms.settle=orig}assert(fired.length);
 const merchant=c.Heirlooms.items.find(r=>r.actions.some(a=>a[0]==='spendgold'));reset([merchant.id]);c.B.mob.hp=0;const gold=c.P.gold;
 for(let i=0;i<merchant.every;i++)c.heirEvent('right',{mob:c.B.mob});assert.equal(c.P.gold,gold);
});
check('Shatter blocks the next wrong answer; overdue fatal damage stops attacks and prevents ordinary healing revival',()=>{
 reset(['shatter']);c.P.shield=1;c.landHit(1,c.B.mob,false);assert(c.B.shatterFree);const hp=c.P.hp;round(false);assert.equal(c.P.hp,hp);assert.equal(c.B.shatterFree,false);
 reset([],{player:{hp:1,owe:[30,30,30]}});const target=c.B.mob.hp;round();assert(c.P.hp<=0);assert.equal(c.B.mob.hp,target);assert.equal(c.P.right,0);assert.equal(c.healUp(100).hp,0);
});
check('Shop discounts cannot sell for profit and exhausted low rarity pools never promote to a zero-weight tier',()=>{
 reset(['regular']);for(const r of c.RELICS.filter(r=>!r.heroOnly))assert(c.shopPrice({relic:r,price:1})>c.sellPrice(r));
 const pool=c.relicPool,wt=c.rarityWeights;try{c.relicPool=()=>c.RELICS.filter(r=>r.r>=3&&!r.heroOnly);c.rarityWeights=()=>[0];assert.equal(c.rollRelic(1),null);}finally{c.relicPool=pool;c.rarityWeights=wt;}
});
check('Actual save and cooperative world packets retain modifier history and per-foe counters without rescaling twice',()=>{
 reset(R.items.map(r=>r.id),{chapter:5,floor:70});c.P.endlessMods={picks:['plate','vital','might']};event('battle');c.B.mob.def={id:c.FOES[0].id};c.B.mob.endless={entered:true,right:2};c.G.map=[[1]];c.G.seen=[[true]];c.G.stair={x:0,y:0};c.G.things=[];
 let saved;c.put=(k,v)=>saved=plain(v);c.RUN_KEY='run';c.RUN_V=1;c.writeRun();assert.deepEqual(saved.P.endlessMods.picks,['plate','vital','might']);assert(saved.mobs[0].builds.entered);assert.equal(saved.mobs[0].endless.right,2);
 const pack=plain(c.packWorld());assert.deepEqual(pack.endlessMods,saved.P.endlessMods);assert.equal(pack.mobs[0].hp,c.B.mob.hp);assert(definitions.applyCoopWorld.includes('P.endlessMods=pack.endlessMods'));assert(!definitions.applyCoopWorld.includes('advanceEndless'));
 const codec=require('../compact-save'),bytes=Buffer.from(JSON.stringify(saved));assert.deepEqual(Buffer.from(codec.unpack('YXS',codec.pack('YXS',bytes))),bytes);
});
check('Actual old deep-save migration scales once, preserves health percentage and immediately persists its random history',()=>{
 reset([],{chapter:5,floor:60});c.G.map=[[1]];c.G.seen=[[true]];c.G.stair={x:0,y:0};c.G.things=[];c.B.mob.def={id:c.FOES[0].id};c.B.mob.hp=50;c.B.mob.max=100;c.B.mob.dmg=10;
 const originals={};for(const k of ['setChapter','resetHpFx','fov','buildGrid','commit'])originals[k]=c[k];let saved,commits=0;c.put=(k,v)=>saved=plain(v);c.writeRun();const old=plain(saved);
 try{c.setChapter=id=>c.CH=c.CHAPTERS.find(ch=>ch.id===id);for(const k of ['resetHpFx','fov','buildGrid'])c[k]=()=>{};c.commit=keep=>{assert(keep);commits++;c.writeRun()};c.B=null;c.Math.random=()=>0;c.resumeRun(old);
  assert.equal(commits,1);assert.equal(c.P.endlessMods.picks.length,2);assert.equal(c.G.mobs[0].max,124);assert.equal(c.G.mobs[0].hp,62);
  const upgraded=plain(saved);c.Math.random=()=>{throw Error('rerolled migrated save')};c.resumeRun(upgraded);assert.equal(commits,1);assert.equal(c.G.mobs[0].max,124);assert.equal(c.G.mobs[0].hp,62);
 }finally{Object.assign(c,originals);}
});
check('Build reader overlays combat, pauses the same question clock and does not rewrite hidden information panels',()=>{
 reset(['db_rivet'],{chapter:5,floor:50});c.P.endlessMods={picks:['plate']};const before=c.P.right,oldAt=c.B.qAt;vm.runInContext('Date.now=()=>clockNow',c);c.clockNow=now;
 c.openDungeonRules();assert.equal(c.anyVeil().id,'veilDungeonRules');assert.equal(node('veilDungeonRules').hidden,false);assert.equal(c.B.rulesReadAt,now);c.clockNow+=5000;c.closeDungeonRules();assert.equal(c.B.qAt,oldAt+5000);assert.equal(c.B.rulesReadMs,5000);assert.equal(c.P.right,before);
 node('runRules').innerHTML='untouched';c.renderDungeonRules();assert.equal(node('runRules').innerHTML,'untouched');assert.equal(node('btnDungeonRules').hidden,false);
 vm.runInContext(definitions.startQTimer,c);c.timeUp=()=>{throw Error('timed out while reading')};c.B.locked=false;c.startQTimer();c.openDungeonRules();c.clockNow+=20000;interval();c.closeDungeonRules();interval();
});
check('Fifty named modifiers are reachable, keep all historical IDs and have real bilingual rules',()=>{
 assert.equal(R.affixes.length,50);assert.equal(new Set(R.affixes.map(a=>a.id)).size,50);assert.equal(new Set(R.affixes.map(a=>a.n)).size,50);
 const old=vm.createContext({UI_EN:false});vm.runInContext(cp.execFileSync('git',['show','80152c8:dungeon-rules.js'],{cwd:root,encoding:'utf8'}),old);assert.deepEqual(plain(R.affixes.slice(0,14).map(a=>a.id)),plain(old.DungeonRules.affixes.map(a=>a.id)));
 const english=vm.createContext({UI_EN:true});vm.runInContext(read('dungeon-rules.js'),english);
 for(let i=0;i<50;i++){const a=R.affixes[i];assert.equal(R.advance({},50,()=>(i+.25)/50).picks[0],a.id);assert(a.pw.length>5);assert(!/undefined|NaN/.test(a.pw));assert(english.DungeonRules.affixes[i].pw.length>5);if(i>=14)assert(a.rule&&(a.rule.stats||a.rule.reward||a.rule.action),a.id);}
 const saved={endlessMods:{picks:['might','dispel','vital']}};R.advance(saved,70,()=>{throw Error('old history rerolled')});assert.deepEqual(saved.endlessMods.picks,['might','dispel','vital']);assert.equal(R.advance({},540,()=>.999).picks.length,50);
});
check('Composite monster stats use additive bonuses, bounded penalties, nonnegative armor and unchanged XP',()=>{
 const base={hp:100,dmg:100,armor:10,xp:7},rows=[['carapace',108,100,11],['berserk',94,110,10],['bulwark',115,96,10],['razor',100,105,11],['riches',106,100,10],['tempered',96,100,13],['hulking',120,100,9]];
 for(const [id,hp,dmg,armor] of rows)assert.deepEqual(plain(R.scaleStats(base,{picks:[id]})),{hp,dmg,armor,xp:7},id);
 const extreme=R.scaleStats(base,{picks:[...Array(100).fill('berserk'),...Array(100).fill('tempered')]});assert.equal(extreme.hp,50);assert.equal(extreme.dmg,1100);
 assert.equal(R.scaleStats(base,{picks:Array(100).fill('hulking')}).armor,0);
 const all=R.scaleStats(base,{picks:R.affixes.flatMap(a=>Array(10).fill(a.id))});for(const v of Object.values(all))assert(Number.isFinite(v)&&v>=0);
});
check('Reward changes affect actual kill payouts once, preserve spelling multiplier and stay disabled outside Endless',()=>{
 vm.runInContext(definitions.closeBattleWin.slice(0,definitions.closeBattleWin.indexOf('  fov();')).replace('function closeBattleWin(','function actualKill(')+'\nreturn {xp:xp,gold:g};\n}',c);
 const gain=c.gainXp;c.gainXp=n=>n;
 try{for(const chapter of [1,5]){reset([],{chapter,floor:60,player:{endlessMods:{picks:['scholar','tuition','bounty','austerity','riches']}}});c.B.xpx=2;c.B.mob.hp=0;c.B.mob.xp=100;c.G.mobs.push({hp:1});const out=c.actualKill();assert.equal(out.xp,chapter===5?208:200);assert.equal(out.gold,chapter===5?76:65);}}
 finally{c.gainXp=gain;}
 assert.equal(Math.round(100*R.rewardMultiplier('xp',{tuition:100})),60);assert.equal(Math.round(100*R.rewardMultiplier('gold',{austerity:100})),60);
});
check('Four opening curses and opening dispel are capped and cannot retrigger after re-entry or JSON resume',()=>{
 reset([],{chapter:5,floor:100,player:{status:{stone:4,fury:2},endlessMods:{picks:['ambush','miasma','cinder','bloodmark','rally'].flatMap(id=>Array(4).fill(id))}}});c.endlessBattle(c.B.mob);
 for(const k of ['exposed','poison','burn','bleed'])assert.equal(c.P.status[k],3);assert.equal(c.P.status.stone,1);c.P.status={};c.B.mob=plain(c.B.mob);c.endlessBattle(c.B.mob);assert.deepEqual(plain(c.P.status),{});
});
check('Five periodic ailments trigger on the fourth submitted answer, with a cap of three per trigger',()=>{
 const s=reset([],{chapter:5,floor:100,player:{endlessMods:{picks:['emberclock','toxicclock','bloodclock','frailclock','riftclock'].flatMap(id=>Array(10).fill(id))}}});
 for(let i=0;i<3;i++)c.endlessRound(true,c.B.mob,s);assert.deepEqual(plain(c.P.status),{});c.endlessRound(true,c.B.mob,s);for(const k of c.HeroRules.negative)assert.equal(c.P.status[k],3);
 const hp=c.P.hp;c.B.mob.hp=0;c.endlessRound(false,c.B.mob,s);assert.equal(c.P.hp,hp);assert.equal(c.B.mob.endless.rounds,4);
});
check('Named blessing counters strip only their stated targets and never create negative stacks',()=>{
 const s=reset([],{chapter:5,floor:100,player:{status:{clarity:4,ward:4,fury:4,stone:4,renew:4,drain:4,edge:2},endlessMods:{picks:['silence','snuff','daunt','crush','sap','wilt'].flatMap(id=>Array(5).fill(id))}}});
 for(let i=0;i<3;i++)c.endlessRound(false,c.B.mob,s);for(const k of ['clarity','ward','fury','stone'])assert.equal(c.P.status[k],1);assert.equal(c.P.status.renew,undefined);assert.equal(c.P.status.drain,undefined);assert.equal(c.P.status.edge,2);
 reset([],{chapter:5,floor:100,player:{endlessMods:{picks:['lacerate']}}});c.endlessRound(false,c.B.mob,c.stats());assert.equal(c.P.status.bleed,1);
});
check('Right-answer and submitted-answer curse rotations persist phase and use different counters',()=>{
 for(const [id,period,sequence] of [['hexstep',4,['weak','exposed','burn','weak']],['entropy',3,['weak','exposed','poison','burn','bleed','weak']]]){
  const s=reset([],{chapter:5,floor:100,player:{endlessMods:{picks:[id]}}});let j=0;
  for(let i=1;i<=period*sequence.length;i++){c.P.status={};c.endlessRound(true,c.B.mob,s);if(i%period===0)assert.equal(c.P.status[sequence[j++]],1);else assert.deepEqual(plain(c.P.status),{});if(i===period)c.B.mob=plain(c.B.mob);}
  const phase=c.B.mob.endless.phases[id];c.P.status={};c.endlessRound(false,c.B.mob,s);if(id==='hexstep')assert.equal(c.B.mob.endless.phases[id],phase);
 }
});
check('Hex mirror copies at most the source stacks, while enemy cleansing and sealing choose one strongest status',()=>{
 const s=reset([],{chapter:5,floor:100,player:{endlessMods:{picks:Array(4).fill('hexmirror')}}});c.B.mob.status={poison:1,burn:2};for(let i=0;i<4;i++)c.endlessRound(true,c.B.mob,s);assert.equal(c.P.status.burn,2);assert.equal(c.B.mob.status.burn,2);
 c.P.endlessMods={picks:['memory','memory','sealed','sealed']};c.P.status={stone:4,fury:1};c.B.mob.status={bleed:4,burn:1};c.endlessRound(false,c.B.mob,s);assert.equal(c.B.mob.status.bleed,2);assert.equal(c.B.mob.status.burn,1);
 c.B.mob.endless.right=7;c.endlessRound(true,c.B.mob,s);assert.equal(c.P.status.stone,2);assert.equal(c.P.status.fury,1);
});
check('Gold loss has a five-percent cap, rounds up, never becomes spending and never runs on a dead target',()=>{
 const s=reset([],{chapter:5,floor:100,player:{gold:21,spent:7,endlessMods:{picks:Array(10).fill('tithe')}}});c.endlessRound(false,c.B.mob,s);assert.equal(c.P.gold,19);assert.equal(c.P.spent,7);
 c.P.gold=0;c.endlessRound(false,c.B.mob,s);assert.equal(c.P.gold,0);c.P.gold=21;c.B.mob.hp=0;c.endlessRound(false,c.B.mob,s);assert.equal(c.P.gold,21);
});
check('Wrong-answer retaliation observes its own cadence, damage cap, guards and final Risk stage',()=>{
 const s=reset([],{chapter:5,floor:100,level:50,wager:true,player:{heirGuard:1,endlessMods:{picks:Array(10).fill('echo')}}});c.B.mob.dmg=1000;const hp=c.P.hp;
 c.endlessRound(false,c.B.mob,s);assert.equal(c.P.hp,hp);assert.equal(c.P.heirGuard,1);c.endlessRound(false,c.B.mob,s);assert.equal(c.P.heirGuard,0);assert.equal(c.P.hp,hp);
 c.endlessRound(false,c.B.mob,s);c.endlessRound(false,c.B.mob,s);assert(c.P.hp<hp);assert(hp-c.P.hp<=Math.ceil(s.maxHp*.06)*2);assert.equal(c.B.mob.endless.wrong,4);assert.equal(c.B.mob.endless.right,undefined);
});
check('Shield drain never damages HP, triggers real shield breaks and defers its curse until the next answer',()=>{
 const s=reset(['db_rivet'],{chapter:5,floor:100,player:{endlessMods:{picks:['devour','devour','devour','devour','devour','martyr']}}});c.endlessBattle(c.B.mob);c.P.shield=1;const hp=c.P.hp;
 for(let i=0;i<3;i++)c.endlessRound(true,c.B.mob,s);assert.equal(c.P.hp,hp);assert.equal(c.P.shield,0);assert.equal(c.P.shieldBrokenCount,1);assert.equal(c.P.builds.rivet,1);assert.equal(c.P.status.bleed,undefined);
 c.B.mob=plain(c.B.mob);c.endlessRound(true,c.B.mob,s);assert.equal(c.P.status.bleed,1);delete c.P.status.bleed;c.endlessRound(true,c.B.mob,s);assert.equal(c.P.status.bleed,undefined);
});
check('All fifty modifiers execute in real mode with bounded status layers, resume counters and no mutation on read-only views',()=>{
 for(const a of R.affixes){const s=reset([],{chapter:5,floor:100,level:100,player:{shield:100,status:{stone:4,fury:4,ward:4,clarity:4,renew:4,drain:4},endlessMods:{picks:[a.id,a.id]}}});c.B.mob.status={bleed:4,burn:3};c.endlessBattle(c.B.mob);
  for(let i=0;i<8;i++){c.endlessRound(i%2===0,c.B.mob,s);if(i===3)c.B.mob=plain(c.B.mob);for(const n of Object.values(c.P.status))assert(Number.isFinite(n)&&n>0&&n<=4,a.id);assert(Number.isFinite(c.P.hp)&&Number.isFinite(c.P.gold)&&c.P.gold>=0,a.id);}
  const before=JSON.stringify({p:c.P,m:c.B.mob});c.runRulesHtml();c.endlessRewardMult('gold');assert.equal(JSON.stringify({p:c.P,m:c.B.mob}),before,a.id);
 }
});
check('All 446 relics execute actual correct/wrong choice/spelling settlement and finite stats across six floor brackets',()=>{
 let cases=0;for(const r of c.RELICS){for(const floor of [1,25,50,100,200,500]){reset([r.id],{chapter:floor>=50?5:1,floor,level:50});const s=c.stats();for(const n of Object.values(s))assert(Number.isFinite(n),r.id);cases++;}
  for(const type of ['en2zh','spell'])for(const ok of [true,false])for(const rng of [0,.99]){reset([r.id],{level:50,player:{combo:20,hp:30,shield:20,status:{weak:1}}});c.B.q.type=type;c.Math.random=()=>rng;const out=round(ok);assert(out&&Number.isFinite(out.damage)&&Number.isFinite(c.P.hp)&&Number.isFinite(c.P.shield),r.id);cases++;}}
 assert.equal(cases,6244);
});
check('Walking timing and fallback classic trails remain unchanged; both entrypoints preload rules before gameplay and expose a reader',()=>{
 const base=cp.execFileSync('git',['show','HEAD:game.js'],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n');for(const name of ['goTo','stepWalk']){const a=source.indexOf('function '+name+'('),b=base.indexOf('function '+name+'('),end=source.indexOf('\n}',a)+2;assert(a>=0&&b>=0);assert.equal(source.slice(a,end),base.slice(b,base.indexOf('\n}',b)+2),name);}
 for(const file of ['dungeon-scene.js'])assert.equal(read(file),cp.execFileSync('git',['show','HEAD:'+file],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n'));
 for(const file of ['index.html','coop.html']){const html=read(file),a=html.indexOf('id="battleArena"'),b=html.indexOf('class="battle-learning"');assert(html.indexOf('id="btnDungeonRules"')>a&&html.indexOf('id="btnDungeonRules"')<b);for(const id of ['veilDungeonRules','rulesTitle','rulesList','btnCloseDungeonRules'])assert(html.includes('id="'+id+'"'));}
 assert(read('preload.js').indexOf("['dungeon-rules.js'")<read('preload.js').indexOf("['game.js'"));
 const fx=read('dungeon-fx.js'),oldFx=cp.execFileSync('git',['show','ea31fd8:dungeon-fx.js'],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n');assert.equal(fx.slice(fx.indexOf('    move:function('),fx.indexOf('  if(reduce){')).replace('      walkPulse(map);\n',''),oldFx.slice(oldFx.indexOf('    move:function('),oldFx.indexOf('  if(reduce){')));
});
console.log(groups+' dungeon build checks passed.');
