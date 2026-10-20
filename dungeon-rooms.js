/* Route choices and compact room layouts. No timers, network requests or movement rendering. */
var DungeonRooms=(function(){
  'use strict';
  const en=typeof UI_EN!=='undefined'&&UI_EN,L=(a,b)=>en?b:a;
  const rows=[
    ['outpost','废弃哨所','Abandoned outpost','battle','稳健','Steady','八名普通守卫，适合稳定推进。','Eight ordinary guards and a steady route.','击杀金币 +10%。','Kill gold +10%.',{mobs:8,gold:1.1,layout:'court'}],
    ['ambush','伏击长廊','Ambush corridor','battle','三波','Three waves','十二名敌人分三波出现，每波四名；波间可以整备。','Twelve foes arrive in three waves of four, with a preparation break.','完成三波获得额外金币。','Finish all three waves for extra gold.',{mobs:12,waveSize:4,gold:1.15,layout:'hall'}],
    ['elite','精英祠堂','Elite shrine','risk','挑战','Challenge','一名精英与三名普通护卫；精英生命 ×3.5，攻击 ×1.25，护甲 +2。','One elite and three ordinary guards; the elite has HP ×3.5, ATK ×1.25, armor +2.','经验 ×3，金币 ×3；清层免费重抽 +1。','XP ×3, gold ×3; one free floor-reward redraw.',{mobs:4,gold:3,xp:3,layout:'court'}],
    ['nest','寄生虫巢','Parasite nest','battle','巢核','Nest core','巢核存活时，其他敌人攻击 +25%；优先击败巢核可解除。','While the core lives, other foes gain 25% ATK. Destroy it to remove the bonus.','击杀金币 +25%。','Kill gold +25%.',{mobs:8,gold:1.25,layout:'cross'}],
    ['bounty','悬赏刑场','Bounty grounds','battle','悬赏','Bounty','六名敌人中标出悬赏目标；优先击败它完成悬赏。','A marked target stands among six foes. Defeat it first.','悬赏额外金币与 10% 最大生命回复。','Bounty grants extra gold and heals 10% max HP.',{mobs:6,layout:'court'}],
    ['cursed','诅咒囚室','Cursed cell','risk','诅咒','Curse','本层附带一个预先展示的临时词条。','A previewed modifier applies only on this floor.','击杀金币 +30%，经验 +15%。','Kill gold +30%, XP +15%.',{mobs:6,gold:1.3,xp:1.15,layout:'cross'}],
    ['rift','裂盾锻所','Shield forge','battle','破盾','Shield break','本层借用裂盾铆钉；锻台可补充一次护盾。','Borrow Rift Rivet this floor; the forge can restore shield once.','清层普通栏更偏向护盾与反击遗物。','Ordinary floor offers favor shield and riposte relics.',{mobs:6,loans:['db_rivet'],flow:'rift',layout:'court',feature:'forge'}],
    ['bleed','猩红回廊','Crimson corridor','battle','裂伤','Bleed','本层借用刻针与引信；击杀会传播 2 层裂伤。','Borrow Needle and Fuse; kills spread 2 Bleed to other foes.','清层普通栏更偏向裂伤与持续伤害遗物。','Ordinary floor offers favor Bleed and damage over time.',{mobs:6,loans:['db_needle','db_fuse'],flow:'bleed',layout:'hall'}],
    ['pack','兽灵巢穴','Beast-spirit den','battle','召唤','Summons','释放兽灵可获得本层伙伴；借用兽语铜哨。','Free a spirit companion for this floor; borrow Beast-tongue Whistle.','清层普通栏更偏向召唤协同遗物。','Ordinary floor offers favor summon coordination.',{mobs:6,loans:['db_whistle'],flow:'pack',layout:'cross',entry:'pack'}],
    ['wheel','四象圣殿','Fourfold temple','battle','祝福','Blessings','本层借用罗盘与棱镜；四座碑文最多激活两座。','Borrow Compass and Prism; activate up to two different steles.','清层普通栏更偏向祝福轮转遗物。','Ordinary floor offers favor blessing rotation.',{mobs:6,loans:['db_compass','db_prism'],flow:'wheel',layout:'cross',entry:'wheel'}],
    ['vault','遗落金库','Lost vault','risk','金库','Vault','击败六名守卫，之后只能开启一个宝箱。','Defeat six guards, then choose one chest.','选择金币、经验或生命与护盾补给。','Choose gold, XP, or HP and shield supplies.',{mobs:6,layout:'pillars',event:'vault'}],
    ['market','黑市驿站','Black market','event','交易','Trade','击败四名守卫后开放黑市。','Defeat four guards to open the black market.','货架额外八折；出售指定品质遗物获得溢价。','Extra 20% shop discount; a premium for the requested rarity.',{mobs:4,layout:'court',event:'market'}],
    ['workshop','拾荒工坊','Scavenger workshop','event','拆解','Salvage','击败守卫后，最多拆解两件通用遗物换工坊材料。','After the guards, salvage up to two ordinary relics for materials.','材料可换重抽、回复或金币；材料本局保留。','Trade materials for redraws, healing or gold; materials last this run.',{mobs:4,layout:'pillars',event:'workshop'}],
    ['shrine','褪色神龛','Faded sanctuary','risk','献祭','Sacrifice','击败守卫后，选择献出生命、金币或一件通用遗物。','After the guards, offer HP, gold or an ordinary relic.','获得本局攻击、生命或护甲祝福，各最多 3 次。','Gain a run-long ATK, HP or armor boon; each caps at 3.',{mobs:4,layout:'cross',event:'shrine'}],
    ['camp','余烬营地','Ember camp','event','休憩','Rest','没有敌人；只能选择一种整备。','No foes; choose one preparation.','回复、净化，或下一场战斗护盾。','Heal, cleanse, or prepare shield for the next battle.',{mobs:0,layout:'court',event:'camp',weight:.25}],
    ['spring','静默泉眼','Silent spring','event','泉眼','Spring','没有敌人；普通饮用或冒险深饮。','No foes; take an ordinary drink or a risky deep drink.','深饮回复更多，但下一场附带衰弱和破绽。','A deep drink heals more but weakens and exposes you next battle.',{mobs:0,layout:'cross',event:'spring',weight:.35}],
    ['library','封印书库','Sealed library','battle','复习','Review','迎战守书者，到期复习词出现率提高。','Fight library guards with more due review words.','击杀经验 +35%；清层选择接下来两场的学识祝福。','Kill XP +35%; choose a blessing for the next two battles.',{mobs:6,xp:1.35,layout:'pillars',event:'library'}],
    ['memory','记忆残室','Memory chamber','battle','错题','Mistakes','优先复习当前范围内的错题，沿用原学习判定。','Favor previous mistakes within the current word scope.','清层时每次有效复习额外回复 5% 最大生命，最多 3 次。','On clear, each successful review heals 5% max HP, up to 3.',{mobs:6,layout:'court',event:'memory'}],
    ['prison','囚魂牢房','Soul prison','event','伙伴','Companion','击败看守后解救一个灵魂。','Defeat the jailers and free a soul.','选择攻击或护盾伙伴，持续接下来 3 场不同敌人的战斗。','Choose an attacking or shielding companion for the next 3 different foes.',{mobs:4,layout:'hall',event:'prison'}],
    ['mystery','未知暗门','Unknown door','event','未知','Unknown','进入后揭晓金库、黑市、神龛或囚魂牢房。','Reveals a vault, market, sanctuary or soul prison on entry.','本层击杀金币额外 +25%。','An extra 25% kill gold on this floor.',{mobs:4,layout:'court',weight:.7}]
  ];
  const items=rows.map(([id,n,english,group,tag,enTag,danger,enDanger,reward,enReward,cfg])=>Object.assign({id,n:L(n,english),group,tag:L(tag,enTag),danger:L(danger,enDanger),reward:L(reward,enReward)},cfg));
  const byId=Object.fromEntries(items.map(x=>[x.id,x]));
  const curses=['weak','burn','exposed','famine','purge','wither','reprisal','devour'];
  function hash(value){let n=2166136261;for(const ch of String(value)){n^=ch.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
  function rng(seed){let n=seed>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
  function normalize(p,seed){
    let r=p.roomRun;if(!r||typeof r!=='object'||Array.isArray(r))r=p.roomRun={};
    if(!Number.isFinite(r.seed))r.seed=hash(seed==null?[p.hero,p.lvl,p.gold,p.x,p.y].join(':'):seed);
    r.seed=r.seed>>>0;if(!Array.isArray(r.history))r.history=[];r.history=r.history.filter(x=>x&&byId[x.id]&&Number.isFinite(x.floor)).slice(-12);
    if(!r.boons||typeof r.boons!=='object')r.boons={};for(const k of ['atk','hp','def'])r.boons[k]=Math.min(3,Math.max(0,Math.floor(r.boons[k]||0)));
    r.materials=Math.min(99,Math.max(0,Math.floor(r.materials||0)));return r;
  }
  function offers(p,floor,boss){
    if(boss||p.study||p.tut)return [];
    const run=normalize(p),random=rng(hash(run.seed+':offers:'+floor)),recent=run.history.slice(-2).map(x=>x.id);
    return ['battle','risk','event'].map(group=>{
      let pool=items.filter(x=>x.group===group&&!recent.includes(x.id));if(!pool.length)pool=items.filter(x=>x.group===group);
      const sum=pool.reduce((n,x)=>n+(x.weight||1),0);let roll=random()*sum;
      return (pool.find(x=>(roll-=(x.weight||1))<0)||pool[pool.length-1]).id;
    });
  }
  function enter(p,floor,boss,selected){
    const run=normalize(p);if(boss||p.study||p.tut)return null;
    const chosen=byId[selected]?selected:'outpost',random=rng(hash(run.seed+':room:'+floor+':'+chosen));
    const actual=chosen==='mystery'?['vault','market','shrine','prison'][Math.floor(random()*4)]:chosen;
    const out={id:chosen,actual,floor,wave:1,curse:actual==='cursed'?curses[Math.floor(random()*curses.length)]:null,state:{killed:[]}};
    run.history=run.history.filter(x=>x.floor!==floor);run.history.push({floor,id:chosen});run.history=run.history.slice(-12);return out;
  }
  function valid(meta,floor){return !!(meta&&meta.floor===floor&&byId[meta.id]&&byId[meta.actual]);}
  function shape(kind,W,H){
    const map=Array.from({length:H},()=>Array(W).fill(0)),w=kind==='hall'?7:13,h=kind==='hall'?17:11,x0=Math.floor((W-w)/2),y0=Math.floor((H-h)/2);
    for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++){
      if(kind==='cross'&&Math.abs(x-(x0+(w>>1)))>2&&Math.abs(y-(y0+(h>>1)))>2)continue;
      if(kind==='pillars'&&[x0+3,x0+w-4].includes(x)&&[y0+3,y0+h-4].includes(y))continue;
      map[y][x]=1;
    }
    const walk=[];for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++)if(map[y][x])walk.push({x,y});
    const start=walk.reduce((a,b)=>b.y>a.y||(b.y===a.y&&b.x<a.x)?b:a),center={x:x0+(w>>1),y:y0+(h>>1)};
    return {map,walk,start,center,rooms:[{x:x0,y:y0,w,h}]};
  }
  function active(m,meta){return !meta||!m.route||!m.route.wave||m.route.wave<=(meta.wave||1);}
  // Allocate only at floor entry; occupied cells must not split the remaining walkable area.
  function allocator(shape,random){
    const map=shape.map,start=shape.start,key=p=>p.x+','+p.y,blocked=new Set(),cells=shape.walk.filter(p=>Math.abs(p.x-start.x)+Math.abs(p.y-start.y)>=3),dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    function safe(){
      const todo=[start],seen=new Set([key(start)]);for(let i=0;i<todo.length;i++){const p=todo[i];for(const [dx,dy] of dirs){const q={x:p.x+dx,y:p.y+dy},k=key(q);if(map[q.y]&&map[q.y][q.x]&&!blocked.has(k)&&!seen.has(k)){seen.add(k);todo.push(q);}}}
      return seen.size===shape.walk.length-blocked.size&&shape.walk.every(p=>!blocked.has(key(p))||dirs.some(([dx,dy])=>seen.has((p.x+dx)+','+(p.y+dy))));
    }
    return function take(preferred){
      let index=preferred?cells.findIndex(p=>p.x===preferred.x&&p.y===preferred.y):-1;
      while(cells.length){if(index<0)index=Math.floor(random()*cells.length);const p=cells.splice(index,1)[0],k=key(p);if(!preferred&&p.x===shape.center.x&&p.y===shape.center.y){index=-1;continue;}blocked.add(k);if(safe())return p;blocked.delete(k);index=-1;}
      return null;
    };
  }
  function biased(r,flow){
    if(!flow||r.heroOnly)return false;if(r.flow===flow)return true;
    const ids={rift:['shatter','borrow','mirror','veteran','shieldheart','ward','citywall'],bleed:['thorns','vamp','reap','rend','grudge'],pack:[],wheel:['ward','well','mend','echo']};return (ids[flow]||[]).includes(r.id);
  }
  function icon(id){const c={rift:'#7497a3',bleed:'#a65f60',pack:'#9d8b63',wheel:'#9881aa',camp:'#b18c4c',spring:'#699e9a',elite:'#a0745d',cursed:'#83708f'}[id]||'#99896a';return '<svg viewBox="0 0 48 56" aria-hidden="true"><path d="M5 53V23a19 19 0 0 1 38 0v30Z" fill="#4b4940" stroke="'+c+'" stroke-width="3"/><path d="M12 51V24a12 12 0 0 1 24 0v27Z" fill="'+c+'" opacity=".4"/><path d="M23 14v36M11 28h26M5 52h38" stroke="'+c+'"/><circle cx="30" cy="35" r="2" fill="#e9d7a2"/></svg>';}
  return {items,byId,hash,rng,normalize,offers,enter,valid,shape,active,allocator,biased,icon};
})();
if(typeof module!=='undefined')module.exports=DungeonRooms;
