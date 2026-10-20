/* Dungeon-only builds and cumulative Endless modifiers. Pure rules; no timers or map rendering. */
var DungeonRules=(function(){
  'use strict';
  const en=typeof UI_EN!=='undefined'&&UI_EN,choose=(zh,eng)=>en?eng:zh;
  const flows={rift:choose('破盾反击','Shield riposte'),bleed:choose('裂伤引爆','Bleed detonation'),pack:choose('召唤协同','Summon coordination'),wheel:choose('祝福轮转','Blessing rotation')};
  const data=[
    ['db_rivet',2,'裂盾铆钉','Rift rivet','rift','def',2,{seed:.08,riposte:.8},'开战时获得最大生命 {seed}% 的护盾；每场战斗首次护盾被击破时蓄存反击，下次答对且敌人存活时，造成攻击力 {riposte}% 的独立伤害。','On battle entry gain {seed}% max HP as shield. The first shield break per battle stores a riposte: the next right answer against a living foe deals {riposte}% ATK as independent damage.','铆钉裂开后，旧盾仍记得最后一次撞击。'],
    ['db_reforge',3,'回铸铁环','Reforging ring','rift','hp',10,{shield:.12,stone:2,limit:2},'每场战斗前 {limit} 次护盾被击破时，获得 {stone} 层磐岩誓印，并蓄存重铸；下次答对时消耗重铸，获得最大生命 {shield}% 的护盾。','The first {limit} shield breaks per battle grant {stone} Stone stacks and store Reforge. The next right answer consumes it to gain {shield}% max HP as shield.','盾面可以碎，握盾的手不会松开。'],
    ['db_anvil',4,'逆铸圣砧','Reverse-forged anvil','rift','def',3,{seed:.15,riposte:1,count:2},'开战时护盾至少补至最大生命的 {seed}%；每场战斗首次护盾被击破时，蓄存 {count} 次反击；之后每次答对且敌人存活时，消耗 1 次并造成攻击力 {riposte}% 的独立伤害。','On battle entry fill shield to at least {seed}% max HP. The first shield break stores {count} ripostes; each subsequent right answer against a living foe consumes one to deal {riposte}% ATK as independent damage.','每一道裂口，都是下一次锻打的起点。'],
    ['db_needle',2,'血痕刻针','Blood-script needle','bleed','atk',3,{bleed:2},'答对后，对存活的当前敌人施加 {bleed} 层裂伤。','After a right answer apply {bleed} Bleed to the current living foe.','针尖记下伤口，也记下追击的方向。'],
    ['db_fuse',3,'绯红引信','Crimson fuse','bleed','crit',5,{bleed:2,every:2,burst:1.5,at:4},'每答对 {every} 题，对当前敌人施加 {bleed} 层裂伤；答对结算时，裂伤达到 {at} 层则消耗 {at} 层，造成攻击力 {burst}% 的独立引爆伤害。','Every {every} right answers apply {bleed} Bleed. At right-answer settlement, consume {at} Bleed when available to detonate for {burst}% ATK as independent damage.','一根引信，连着所有尚未愈合的伤。'],
    ['db_tide',4,'赤潮圣约','Crimson tide covenant','bleed','hp',20,{burst:1.2,at:4,spread:2,targets:3},'答对结算时，裂伤达到 {at} 层则消耗 {at} 层，造成攻击力 {burst}% 的独立引爆伤害，并向本层最多 {targets} 个其他存活敌人传播 {spread} 层裂伤；与绯红引信共用一次引爆，两件伤害相加。','At right-answer settlement consume {at} Bleed to detonate for {burst}% ATK and spread {spread} Bleed to up to {targets} other living foes. Shares one detonation with Crimson Fuse; their damage adds.','赤潮退去时，岸边留下同一道红线。'],
    ['db_whistle',2,'兽语铜哨','Beast-tongue whistle','pack','atk',3,{marks:1,hit:.35},'答对出手前施加 {marks} 枚协同标记，最多 3 枚；召唤物命中存活敌人时消耗 1 枚，额外造成攻击力 {hit}% 的独立伤害。','Before a right-answer attack apply {marks} Coordination mark (cap 3). A summon hitting a living foe consumes one to deal an extra {hit}% ATK as independent damage.','哨声很轻，却能穿过最嘈杂的战场。'],
    ['db_hunt',3,'群猎契环','Pack-hunt ring','pack','atk',5,{marks:2,every:2,drain:1,shield:.1,at:3},'每答对 {every} 题，在出手前施加 {marks} 枚协同标记，最多 3 枚；召唤物命中消耗 1 枚并获得 {drain} 层汲能；本局每累计消耗 {at} 枚，获得最大生命 {shield}% 的护盾。','Every {every} right answers apply {marks} Coordination marks before attacking (cap 3). Summon hits consume one and grant {drain} Siphon. Every {at} marks consumed this run grant {shield}% max HP as shield.','契环上没有主人的名字，只有伙伴的爪印。'],
    ['db_banner',4,'万兽战旗','Banner of beasts','pack','hp',20,{marks:3,every:3,hit:.9,exposed:1},'开战时施加 {marks} 枚协同标记，最多 3 枚；消耗标记时对敌人施加 {exposed} 层破绽；本局每累计 {every} 次召唤物命中，追加 1 次攻击力 {hit}% 的灵兽攻击，每题最多 1 次，灵兽追击不再次计数。','On entry apply {marks} Coordination marks (cap 3). Consuming a mark applies {exposed} Exposed. Every {every} summon hits this run call a spirit beast for {hit}% ATK, at most once per question; this follow-up does not count again.','旗帜升起时，远处的脚步声逐一回应。'],
    ['db_compass',2,'巡礼罗盘','Pilgrim compass','wheel','hp',8,{every:2,layers:2},'每答对 {every} 题，依次轮转获得磐岩誓印、烈意、回春灵息、灵盾中的一种，各 {layers} 层。','Every {every} right answers rotate through Stone, Fervor, Renewal and Aegis, granting {layers} stacks of one blessing.','指针从不指向终点，只指向下一次出发。'],
    ['db_prism',3,'四象棱镜','Fourfold prism','wheel','crit',7,{guard:1,heal:.06,at:4},'记录战斗中实际获得的不同祝福，每题最多记录 1 种；累计 {at} 种后清空记录，储存 {guard} 次格挡并回复最大生命的 {heal}%；格挡最多储存 2 次。','Record different blessings actually gained in battle, at most one kind per question. After {at} kinds clear the record, store {guard} guard and heal {heal}% max HP; guard cap 2.','四束光穿过同一块水晶，终于照见来路。'],
    ['db_orbit',4,'周天圣盘','Celestial orbit','wheel','hp',20,{every:3,layers:2,at:4,hit:1.8,extend:1},'每答对 {every} 题，依次轮转获得磐岩誓印、烈意、回春灵息、灵盾中的一种，各 {layers} 层；记录不同祝福，每题最多 1 种，累计 {at} 种后清空记录，造成攻击力 {hit}% 的独立伤害，并使自身当前每种祝福增加 {extend} 层；与四象棱镜共用记录。','Every {every} right answers rotate one of Stone, Fervor, Renewal and Aegis for {layers} stacks. Record one new blessing kind per question; after {at} kinds clear the record, deal {hit}% ATK as independent damage and add {extend} stack to every current blessing. Shares its record with Fourfold Prism.','天穹转过一周，掌心的刻度又亮了一格。']
  ];
  const percent=new Set(['seed','riposte','shield','burst','hit','heal']);
  const items=data.map(([id,r,n,eng,flow,stat,amount,cfg,zh,english,lore])=>{
    const body=(en?english:zh).replace(/\{(\w+)\}/g,(_,k)=>percent.has(k)?Math.round(cfg[k]*100):cfg[k]);
    const statName={atk:choose('攻击力','ATK'),hp:choose('最大生命','Max HP'),def:choose('护甲','Armor'),crit:choose('暴击率','Critical chance')}[stat];
    return {id,r,n:choose(n,eng),flow,nobf:true,stat,amount,cfg,pw:statName+' +'+amount+(stat==='crit'?'%':'')+'；'+body,lore:choose(lore,'A keepsake of those who ventured into the corridor.')};
  });
  const byId=Object.fromEntries(items.map(r=>[r.id,r]));
  const affixes=[
    ['vital','厚生','Vitality','最大生命 +12% / 层','Max HP +12% per stack'],
    ['might','凶猛','Might','攻击力 +8% / 层','ATK +8% per stack'],
    ['plate','铁骨','Iron bones','护甲 +2 / 层','Armor +2 per stack'],
    ['bounty','珍藏','Hoard','击杀金币 +15% / 层','Kill gold +15% per stack'],
    ['weak','压制','Suppression','答错后施加衰弱，每层词条 +1 层，最多 3 层','Wrong answers apply 1 Weakness per modifier stack, max 3'],
    ['exposed','猎隙','Hunter','答错后施加破绽，每层词条 +1 层，最多 3 层','Wrong answers apply 1 Exposed per modifier stack, max 3'],
    ['poison','毒息','Venom breath','答错后施加侵毒，每层词条 +1 层，最多 3 层','Wrong answers apply 1 Venom per modifier stack, max 3'],
    ['burn','灰烬','Ash','答错后施加灼蚀，每层词条 +1 层，最多 3 层','Wrong answers apply 1 Scorch per modifier stack, max 3'],
    ['dread','威压','Dread','开战时施加衰弱，每层词条 +1 层，最多 3 层；同一敌人不重复施加','On first entry apply 1 Weakness per modifier stack, max 3; no re-entry farming'],
    ['famine','枯竭','Famine','战斗中回复生命量 −10% / 层，最多 −50%','Healing received in battle −10% per stack, max −50%'],
    ['purge','净蚀','Purge','每答 3 题移除敌人每种负面状态 1 层 / 词条层数，最多 3 层','Every 3 submitted answers remove 1 stack of every foe debuff per modifier stack, max 3'],
    ['wither','凋零','Wither','每答 3 题，使玩家每种现有祝福额外减少 1 层 / 词条层数，最多 3 层','Every 3 submitted answers remove 1 extra stack of every current player blessing per modifier stack, max 3'],
    ['reprisal','反扑','Reprisal','每答对 3 题反击；基础伤害为敌人攻击力的 12% / 层，最多 36%，且不超过玩家最大生命的 8%；仍可减伤、格挡和闪避','Every 3 right answers retaliate for 12% foe ATK per stack (max 36%), capped at 8% player max HP before armor/mitigation/guard/dodge'],
    ['dispel','夺辉','Dispel','答错后移除玩家层数最多的一种祝福 1 层 / 词条层数，最多 3 层','After a wrong answer remove 1 stack of the player blessing with most stacks per modifier stack, max 3'],
    ['carapace','岩壳','Carapace','每层词条：最大生命 +8%，护甲 +1','Per stack: max HP +8%, armor +1',{stats:{hp:.08,armor:1}}],
    ['berserk','狂化','Berserk','每层词条：攻击力 +10%，最大生命 −6%；生命减幅最多 30%','Per stack: ATK +10%, max HP −6%; HP penalty capped at 30%',{stats:{atk:.1,hpDown:.06,hpCap:.3}}],
    ['bulwark','重躯','Bulwark','每层词条：最大生命 +15%，攻击力 −4%；攻击减幅最多 20%','Per stack: max HP +15%, ATK −4%; ATK penalty capped at 20%',{stats:{hp:.15,atkDown:.04,atkCap:.2}}],
    ['razor','刃骨','Razor bones','每层词条：攻击力 +5%，护甲 +1','Per stack: ATK +5%, armor +1',{stats:{atk:.05,armor:1}}],
    ['scholar','藏识','Stored wisdom','击杀经验 +12% / 层词条','Kill XP +12% per modifier stack',{reward:{xp:.12}}],
    ['riches','金脉','Gold vein','每层词条：最大生命 +6%，击杀金币 +10%','Per stack: max HP +6%, kill gold +10%',{stats:{hp:.06},reward:{gold:.1}}],
    ['tempered','淬甲','Tempered armor','每层词条：护甲 +3，最大生命 −4%；生命减幅最多 20%','Per stack: armor +3, max HP −4%; HP penalty capped at 20%',{stats:{armor:3,hpDown:.04,hpCap:.2}}],
    ['hulking','巨躯','Hulking','每层词条：最大生命 +20%，护甲 −1；护甲最低为 0','Per stack: max HP +20%, armor −1; armor cannot fall below 0',{stats:{hp:.2,armor:-1}}],
    ['ambush','破阵','Ambush','首次开战施加破绽 1 层 / 词条层数，最多 3 层；同一敌人不重复触发','On first entry apply 1 Exposed per stack, max 3; once per foe',{on:'battle',action:'status',key:'exposed'}],
    ['miasma','瘴幕','Miasma','首次开战施加侵毒 1 层 / 词条层数，最多 3 层；同一敌人不重复触发','On first entry apply 1 Venom per stack, max 3; once per foe',{on:'battle',action:'status',key:'poison'}],
    ['cinder','烬幕','Cinder veil','首次开战施加灼蚀 1 层 / 词条层数，最多 3 层；同一敌人不重复触发','On first entry apply 1 Scorch per stack, max 3; once per foe',{on:'battle',action:'status',key:'burn'}],
    ['bloodmark','血印','Blood mark','首次开战施加裂伤 1 层 / 词条层数，最多 3 层；同一敌人不重复触发','On first entry apply 1 Bleed per stack, max 3; once per foe',{on:'battle',action:'status',key:'bleed'}],
    ['lacerate','撕裂','Lacerate','答错后施加裂伤 1 层 / 词条层数，最多 3 层','Wrong answers apply 1 Bleed per stack, max 3',{on:'wrong',action:'status',key:'bleed'}],
    ['emberclock','焚时','Ember clock','每答 4 题施加灼蚀 1 层 / 词条层数，最多 3 层','Every 4 submitted answers apply 1 Scorch per stack, max 3',{on:'round',every:4,action:'status',key:'burn'}],
    ['toxicclock','瘴涌','Venom surge','每答 4 题施加侵毒 1 层 / 词条层数，最多 3 层','Every 4 submitted answers apply 1 Venom per stack, max 3',{on:'round',every:4,action:'status',key:'poison'}],
    ['bloodclock','血潮','Blood tide','每答 4 题施加裂伤 1 层 / 词条层数，最多 3 层','Every 4 submitted answers apply 1 Bleed per stack, max 3',{on:'round',every:4,action:'status',key:'bleed'}],
    ['frailclock','疲潮','Fatigue tide','每答 4 题施加衰弱 1 层 / 词条层数，最多 3 层','Every 4 submitted answers apply 1 Weakness per stack, max 3',{on:'round',every:4,action:'status',key:'weak'}],
    ['riftclock','隙潮','Rift tide','每答 4 题施加破绽 1 层 / 词条层数，最多 3 层','Every 4 submitted answers apply 1 Exposed per stack, max 3',{on:'round',every:4,action:'status',key:'exposed'}],
    ['hexstep','逆咒','Reverse hex','每答对 4 题，依次向玩家施加衰弱、破绽、灼蚀中的一种，1 层 / 词条层数，最多 3 层','Every 4 right answers cycle Weakness, Exposed and Scorch on the player, 1 per stack, max 3',{on:'right',every:4,action:'status',sequence:['weak','exposed','burn']}],
    ['silence','浊识','Clouded mind','每答 3 题移除玩家澄明 1 层 / 词条层数，最多 3 层','Every 3 submitted answers remove 1 Clarity per stack, max 3',{on:'round',every:3,action:'strip',key:'clarity'}],
    ['snuff','蚀盾','Aegis blight','每答 3 题移除玩家灵盾祝福 1 层 / 词条层数，最多 3 层','Every 3 submitted answers remove 1 Aegis blessing per stack, max 3',{on:'round',every:3,action:'strip',key:'ward'}],
    ['daunt','折意','Daunt','每答 3 题移除玩家烈意 1 层 / 词条层数，最多 3 层','Every 3 submitted answers remove 1 Fervor per stack, max 3',{on:'round',every:3,action:'strip',key:'fury'}],
    ['crush','碎誓','Broken oath','每答 3 题移除玩家磐岩誓印 1 层 / 词条层数，最多 3 层','Every 3 submitted answers remove 1 Stone oath per stack, max 3',{on:'round',every:3,action:'strip',key:'stone'}],
    ['sap','断汲','Severed siphon','答错后移除玩家汲能 1 层 / 词条层数，最多 3 层','Wrong answers remove 1 Siphon per stack, max 3',{on:'wrong',action:'strip',key:'drain'}],
    ['hexmirror','咒镜','Hex mirror','每答 4 题，将敌人当前层数最多的一种负面状态复制给玩家，复制 1 层 / 词条层数，最多 3 层且不超过敌人现有层数；敌方层数不减少','Every 4 answers copy the foe\'s strongest debuff to the player, 1 per stack, max 3 and no more than its current stacks; foe keeps its stacks',{on:'round',every:4,action:'mirror'}],
    ['tithe','索金','Tithe','答错后失去当前金币的 1% / 层词条，最多 5%，向上取整；不计为主动消费','Wrong answers lose 1% current gold per stack, max 5%, rounded up; not counted as spending',{on:'wrong',action:'gold',ratio:.01,cap:.05}],
    ['austerity','贫藏','Austerity','击杀金币 −8% / 层词条，最多 −40%；与词条的金币加成相加结算','Kill gold −8% per stack, max −40%; additive with modifier gold bonuses',{reward:{goldDown:.08,goldCap:.4}}],
    ['tuition','蚀识','Fading wisdom','击杀经验 −8% / 层词条，最多 −40%；与词条的经验加成相加结算','Kill XP −8% per stack, max −40%; additive with modifier XP bonuses',{reward:{xpDown:.08,xpCap:.4}}],
    ['rally','夺势','Seized momentum','首次开战移除玩家层数最多的一种祝福 1 层 / 词条层数，最多 3 层；同一敌人不重复触发','On first entry remove 1 stack of the player\'s strongest blessing per modifier stack, max 3; once per foe',{on:'battle',action:'stripMax'}],
    ['memory','蜕痕','Shed scars','答错后移除敌人层数最多的一种负面状态 1 层 / 词条层数，最多 3 层','Wrong answers remove 1 stack of the foe\'s strongest debuff per modifier stack, max 3',{on:'wrong',action:'cleanseMax'}],
    ['sealed','封辉','Sealed light','每答对 4 题移除玩家层数最多的一种祝福 1 层 / 词条层数，最多 3 层','Every 4 right answers remove 1 stack of the player\'s strongest blessing per modifier stack, max 3',{on:'right',every:4,action:'stripMax'}],
    ['martyr','裂盾咒','Shield-break curse','作答结算时，若护盾自上次作答以来被击破，施加裂伤 1 层 / 词条层数，最多 3 层；每题最多触发一次','At answer settlement, if shield broke since the last answer, apply 1 Bleed per stack, max 3; once per question',{on:'shieldbreak',action:'status',key:'bleed'}],
    ['wilt','断息','Withered breath','答错后移除玩家回春灵息 1 层 / 词条层数，最多 3 层','Wrong answers remove 1 Renewal per stack, max 3',{on:'wrong',action:'strip',key:'renew'}],
    ['entropy','五衰','Fivefold decay','每答 3 题，依次向玩家施加衰弱、破绽、侵毒、灼蚀、裂伤中的一种，1 层 / 词条层数，最多 3 层','Every 3 answers cycle Weakness, Exposed, Venom, Scorch and Bleed on the player, 1 per stack, max 3',{on:'round',every:3,action:'status',sequence:['weak','exposed','poison','burn','bleed']}],
    ['echo','回震','Counter echo','每答错 2 题反击；基础伤害为敌人攻击力的 8% / 层词条，最多 24%，且不超过玩家最大生命的 6%；仍可减伤、格挡和闪避','Every 2 wrong answers retaliate for 8% foe ATK per stack, max 24%, capped at 6% player max HP before armor/mitigation/guard/dodge',{on:'wrong',every:2,action:'counter',ratio:.08,cap:.24,hpCap:.06}],
    ['devour','噬障','Barrier devourer','每答 3 题消耗玩家当前护盾的 10% / 层词条，最多 50%，向上取整；不扣生命，可触发破盾效果','Every 3 answers consume 10% current shield per stack, max 50%, rounded up; no HP loss, can trigger shield-break effects',{on:'round',every:3,action:'shieldDrain',ratio:.1,cap:.5}]
  ].map(([id,zh,eng,desc,english,rule])=>({id,n:choose(zh,eng),pw:choose(desc,english),rule}));
  const affixById=Object.fromEntries(affixes.map(a=>[a.id,a]));
  function normalize(run){
    const old=run.endlessMods;
    if(!old||typeof old!=='object'||!Array.isArray(old.picks))run.endlessMods={picks:[]};
    else run.endlessMods={picks:old.picks.filter(id=>!!affixById[id]).slice(0,10000)};
    return run.endlessMods;
  }
  function advance(run,floor,random){
    const state=normalize(run),count=Number.isFinite(floor)?Math.min(10000,Math.max(0,1+Math.floor((floor-50)/10))):0,rand=random||Math.random;
    while(state.picks.length<count)state.picks.push(affixes[Math.min(affixes.length-1,Math.max(0,Math.floor(rand()*affixes.length)))].id);
    return state;
  }
  function counts(state){const out={};for(const id of state&&state.picks||[])if(affixById[id])out[id]=(out[id]||0)+1;return out;}
  function scaleStats(s,state){
    const n=counts(state);let hp=1+.12*(n.vital||0),atk=1+.08*(n.might||0),armor=s.armor+2*(n.plate||0);
    for(const a of affixes){const r=a.rule&&a.rule.stats,k=n[a.id]||0;if(!r||!k)continue;hp+=(r.hp||0)*k-Math.min(r.hpCap||0,(r.hpDown||0)*k);atk+=(r.atk||0)*k-Math.min(r.atkCap||0,(r.atkDown||0)*k);armor+=(r.armor||0)*k;}
    return {hp:Math.max(1,Math.round(s.hp*hp)),dmg:Math.max(1,Math.round(s.dmg*atk)),armor:Math.max(0,armor),xp:s.xp};
  }
  function rewardMultiplier(kind,n){
    let value=1+(kind==='gold'?.15*(n.bounty||0):0);
    for(const a of affixes){const r=a.rule&&a.rule.reward,k=n[a.id]||0;if(r&&k)value+=(r[kind]||0)*k-Math.min(r[kind+'Cap']||0,(r[kind+'Down']||0)*k);}
    return Math.max(.1,value);
  }
  function endless(c,event){
    const p=c.p,m=c.mob,s=c.state,n=c.mods;if(!p||p.hp<=0||p.study||p.tut||!m||m.hp<=0)return;
    const broken=p.shieldBrokenCount||0;
    if(event==='battle')s.shieldBreakAt=broken;
    const newBreak=broken>(s.shieldBreakAt==null?broken:s.shieldBreakAt);
    for(const a of affixes){
      const r=a.rule,k=n[a.id]||0;if(!r||!r.on||!k)continue;
      let count=1,active=r.on===event;
      if(event==='round'){
        if(r.on==='right'){active=c.ok;count=s.right||0;}
        else if(r.on==='wrong'){active=!c.ok;count=s.wrong||0;}
        else if(r.on==='round')count=s.rounds||0;
        else if(r.on==='shieldbreak')active=newBreak;
      }
      if(!active||(r.every&&(!count||count%r.every)))continue;
      if(p.hp<=0||m.hp<=0)break;
      const layers=Math.min(3,k);
      if(r.action==='status'){
        let key=r.key;if(r.sequence){s.phases=s.phases||{};const phase=s.phases[a.id]||0;key=r.sequence[phase%r.sequence.length];s.phases[a.id]=phase+1;}
        c.act('status',layers,{key});
      }else if(r.action==='strip')c.act('strip',layers,{key:r.key});
      else if(['stripMax','cleanseMax','mirror'].includes(r.action))c.act(r.action,layers);
      else if(r.action==='gold')c.act('gold',Math.min(r.cap,r.ratio*k));
      else if(r.action==='counter')c.act('counter',Math.min(r.cap,r.ratio*k),{hpCap:r.hpCap,label:a.n});
      else if(r.action==='shieldDrain')c.act('shieldDrain',Math.min(r.cap,r.ratio*k));
    }
    if(event==='round')s.shieldBreakAt=broken; // A break caused by this settlement is observed by the next answer.
  }
  function bonus(p,stat,mask,has){return items.reduce((n,r)=>n+((has?has(r.id):(p.relics||[]).includes(r.id))&&r.stat===stat&&!(mask&&(mask==='all'||mask[r.id]))?r.amount:0),0);}
  function settle(c,event){
    const p=c.p,m=c.mob;if(!p||p.hp<=0||p.study||p.tut)return;
    const has=id=>c.has(id),v=(id,k)=>c.scale(id,byId[id].cfg[k]);
    const active=items.some(r=>has(r.id));if(!active)return;
    const s=p.builds||(p.builds={}),ms=m?(m.builds||(m.builds={})):{};
    const act=(key,n,extra)=>c.act(key,n,extra);
    if(event==='battle'&&!ms.entered){
      ms.entered=true;
      if(has('db_rivet'))act('shield',v('db_rivet','seed'));
      if(has('db_anvil'))act('shieldFloor',v('db_anvil','seed'));
      if(has('db_banner'))ms.marks=3;
    }
    if(event==='wardbreak'){
      const n=ms.breaks=(ms.breaks||0)+1;
      if(has('db_rivet')&&n===1){s.rivet=1;s.rivetAt=c.turn;}
      if(has('db_reforge')&&n<=byId.db_reforge.cfg.limit){s.reforge=1;s.reforgeAt=c.turn;act('stone',v('db_reforge','stone'));}
      if(has('db_anvil')&&n===1){s.anvil=byId.db_anvil.cfg.count;s.anvilAt=c.turn;}
    }
    if(event==='before'&&c.ok){
      s.right=(s.right||0)+1;
      if(m&&m.hp>0){let add=has('db_whistle')?v('db_whistle','marks'):0;if(has('db_hunt')&&s.right%byId.db_hunt.cfg.every===0)add+=v('db_hunt','marks');ms.marks=Math.min(3,(ms.marks||0)+add);}
    }
    if(event==='summon'&&m&&(m.hp>0||c.wasAlive)){
      const n=Math.max(1,Math.min(17,Math.floor(c.hits||1))),used=Math.min(n,ms.marks||0);ms.marks=(ms.marks||0)-used;
      if(used){
        if(has('db_whistle'))act('hit',used*v('db_whistle','hit'),{hero:'tamer',kind:'pet',count:used});
        if(has('db_hunt')){act('drain',used*v('db_hunt','drain'));s.hunt=(s.hunt||0)+used;while(s.hunt>=byId.db_hunt.cfg.at){s.hunt-=byId.db_hunt.cfg.at;act('shield',v('db_hunt','shield'));}}
        if(has('db_banner'))act('foe.exposed',used*v('db_banner','exposed'));
      }
      if(has('db_banner')){s.summons=(s.summons||0)+n;const ready=s.summons>=byId.db_banner.cfg.every;s.summons%=byId.db_banner.cfg.every;if(ready&&!c.battle.spiritUsed){c.battle.spiritUsed=true;act('hit',v('db_banner','hit'),{hero:'tamer',kind:'pet'});}}
    }
    if(event!=='after')return;
    if(c.ok){
      if(has('db_rivet')&&s.rivet&&s.rivetAt<c.turn&&m&&m.hp>0){s.rivet=0;act('hit',v('db_rivet','riposte'),{hero:'smith'});}
      if(has('db_anvil')&&s.anvil&&s.anvilAt<c.turn&&m&&m.hp>0){s.anvil--;act('hit',v('db_anvil','riposte'),{hero:'smith'});}
      if(has('db_reforge')&&s.reforge&&s.reforgeAt<c.turn){s.reforge=0;act('shield',v('db_reforge','shield'));}
      if(has('db_needle'))act('foe.bleed',v('db_needle','bleed'));
      if(has('db_fuse')&&s.right%byId.db_fuse.cfg.every===0)act('foe.bleed',v('db_fuse','bleed'));
      if((has('db_fuse')||has('db_tide'))&&m&&m.hp>0&&(m.status&&m.status.bleed||0)>=4){
        m.status.bleed-=4;if(!m.status.bleed)delete m.status.bleed;
        act('hit',(has('db_fuse')?v('db_fuse','burst'):0)+(has('db_tide')?v('db_tide','burst'):0));
        if(has('db_tide'))act('spreadBleed',v('db_tide','spread'),{targets:byId.db_tide.cfg.targets});
      }
      for(const id of ['db_compass','db_orbit'])if(has(id)&&s.right%byId[id].cfg.every===0){const key=id+'Phase',seq=['stone','fury','renew','ward'];act(seq[(s[key]||0)%4],v(id,'layers'));s[key]=(s[key]||0)+1;}
    }
    if(has('db_prism')||has('db_orbit')){
      s.blessings=Array.isArray(s.blessings)?s.blessings.filter(k=>HeroRules.effects[k]&&!HeroRules.negative.includes(k)):[];
      const next=(c.blessings||[]).find(k=>!s.blessings.includes(k));if(next)s.blessings.push(next);
      if(s.blessings.length>=4){s.blessings=[];if(has('db_prism')){act('guard',v('db_prism','guard'));act('heal',v('db_prism','heal'));}if(has('db_orbit')){act('hit',v('db_orbit','hit'));act('extend',v('db_orbit','extend'));}}
    }
  }
  return {items,byId,flows,affixes,affixById,normalize,advance,counts,scaleStats,rewardMultiplier,endless,bonus,settle};
})();
if(typeof RELICS!=='undefined'){
  // Append after the historical 434 indices; never shift existing save-code IDs.
  for(const r of DungeonRules.items)if(!RELICS.some(x=>x.id===r.id))RELICS.push(r);
  const overrides={
    regular:['游商标价 −15%；所有折扣结算后，售价不低于该遗物当前分解价 +1 金币。','Shop price −15%. After all discounts, the purchase price is at least the current dismantle value +1 gold.'],
    familiar:['同层从第 2 次遭遇同类别敌人起，答错受到的伤害 −5%；此后每次同类遭遇再 −5%，最多 −15%。','From the second same-category encounter this floor, wrong-answer damage −5%; each further encounter adds −5%, max −15%.'],
    rampart:['护甲 +10；生命不高于最大生命的 10% 时启用残壁，答错减伤 +50 个百分点，受总减伤上限限制；生命恢复至 50% 时解除。','Armor +10. At HP ≤10% activate Rampart: +50 percentage points of wrong-answer damage reduction, subject to the total cap; ends at HP ≥50%.'],
    womb:['单次伤害在冒险倍率之前，基础封顶为最大生命的 12%，向上取整；无尽 50 层后封顶线随深层压迫提高。','Before Risk, cap a hit at 12% max HP, rounded up; this threshold rises with deep Endless pressure after floor 50.'],
    blunt:['单次伤害在冒险倍率之前，基础封顶为最大生命的 16%，向上取整；无尽 50 层后封顶线随深层压迫提高。','Before Risk, cap a hit at 16% max HP, rounded up; this threshold rises with deep Endless pressure after floor 50.'],
    hoardbox:['每个普通地牢层至少生成 1 个宝箱；箱底遗物的抽取品质提高 1 档，最高传奇。','Each normal dungeon floor has at least one chest; its relic roll rises one rarity, up to Legendary.'],
    shrine:['第 10 层起，每个普通地牢层生成祭坛；祭坛和熔炉奖励改为最多 3 选 1，候选不足时按实际数量提供。','From floor 10, normal dungeon floors have an altar. Altar and forge rewards offer up to three choices, subject to available candidates.']
  };
  for(const r of RELICS){
    if(overrides[r.id])r.pw=overrides[r.id][typeof UI_EN!=='undefined'&&UI_EN?1:0];
    if(!(typeof UI_EN!=='undefined'&&UI_EN))r.pw=r.pw.replace(/生命上限/g,'最大生命').replace(/每进一层/g,'进入新楼层时').replace(/每场(?!战斗)/g,'每场战斗').replace(/(\d+) 次3 秒内答对/g,'$1 次在 3 秒内答对').replace(/[。；\s]+$/,'')+'。';
  }
}
if(typeof module!=='undefined')module.exports=DungeonRules;
