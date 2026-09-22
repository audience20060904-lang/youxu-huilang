/* 幽墟回廊 · 战场模式
   ==================================================================
   跟背单词无关的幸存者模式。设计文档是 `战场模式.md`，**改了数值回去同步那一份**。
   ⚠️ 这个文件跟 game.js 完全独立，只共用 util.js / art.js / content.js（RELICS 那几张表）。
   ⚠️ 遗物一律在 bstats() / 伤害四层桶里**现算**，`P` 上只许存「发生过几次」这种事实
      —— 跟地牢那条硬规矩一样，卖掉遗物加成必须当场失效。 */
"use strict";

/* ===== 数值配置（设计文档第二、三节）===== */
var BF = {
  /* 玩家起手面板 */
  base: {maxHp:100, atk:12, aspd:1.25, range:78, arc:120, spd:155,
         armor:0, crit:10, critMult:2.0, pickup:75, knock:14},
  perLevel: {maxHp:6, atk:1},
  levelHealPct: 0.08,

  waveSec: 30,          // 每波多少秒
  bossEvery: 10,        // 每几波一个 Boss
  pickN: 4,             // 升级几选一
  rerollN: 1,           // 每次升级能「换一批」几次（遗物「集齐」再 +1）
  relicMax: 15,
  cutMax: 75,           // 常驻减伤封顶 %
  touchCd: 0.65,        // 同一只怪的接触伤害冷却（秒）
  comboStep: 5,
  comboPct: 2,
  /* onKill 那一类（回血/护盾）统一乘这个 —— 一波的怪比一层多 2~6 倍，
     不折算的话「杀怪回血」会直接无敌。见设计文档 6.1。 */
  killScale: 0.45,
  wagerInner: 0.45,     // 刀程内侧这一段算「贴身」（= 地牢的冒险）
  hauntMax: 5,          // 同时最多标记几只仇敌（= 心魔）
  bigR: 15,             // 碰撞半径 ≥ 这个数算「大体型」（= 地牢的长单词）
  /* 升级所需经验（用户 2026-09-22：**升级难度增加 100%**，整条曲线 ×2）。
     ⚠️ 别去砍怪的 xp 来达到同样效果 —— 那会连带把金币和 Boss 的经验补偿也拖下水。 */
  xpNeed: function(lv){ return (8 + 6 * (lv - 1)) * 2; },
  /* 怪掉的金币统一乘这个（用户 2026-09-22：**金币爆率 −50%**）。
     Boss 掉的那一笔也吃，别单独开小灶。 */
  goldMult: 0.5,
  specialMax: 5,        // 特殊遗物最多带几件（用户 2026-09-22）；满了再拿要换掉一件
  spawnPad: 60,         // 在相机外这么远的一圈上刷怪
  shieldSeedScale: 1,   // 护盾类种子的统一缩放（留给调平衡）

  /* ===== 击杀掉落的互动点（用户 2026-09-22）=====
     「整备点」那套每 5 波强制暂停的弹层已经整块删掉了，别加回来 ——
     商 / 泉 / 箱现在全部从击杀里掉，什么时候能补给变成运气和击杀效率的回报。
     ⚠️ p 是**每击杀一只**的概率，一波杀 30~50 只 → 合起来一波期望 ~1 个。
     ⚠️ 精英和 Boss 另算（eliteRate / Boss 必掉），走的是同一个 dropSite()。 */
  site: {
    /* 泉：踩上去直接回 25% 最大生命，免费、不弹窗。
       ⚠️ **喝一次就没了**（用户 2026-09-22 定的，撤掉了在这之前那版「泉不消失 + 10 秒冷却」）。 */
    spring: {p:0.020, heal:0.25},
    /* 箱：踩上去直接白给一件，不花钱不弹窗。
       ⚠️ **每 every 波最多掉 max 个**（用户 2026-09-22）—— 不封的话深波遗物白拿到手软。 */
    chest:  {p:0.014, max:3, every:5},
    /* 商：5 个货位，能刷新一次。
       ⚠️ **只在场上留 life 波**（用户 2026-09-22：摊子会收），过期自动消失。
       ⚠️ **每出现一个，下一个的概率就除以 decay**（用户 2026-09-22 报「商的爆率太高」），
          最多除到 decayMax —— 留个地板，否则深波金币彻底没处花。 */
    shop:   {p:0.011, n:5, reroll:1, life:5, decay:2, decayMax:8},
    eliteRate: 0.25,                        // 精英倒下时额外掷一次（三种等概率）
    max: 8,                                 // 场上最多几个（泉不消失，所以从 6 抬到 8）
    r: 22,                                  // 踩上去的判定半径
    /* ⚠️ **每波保底一个**：一整波一个都没掉的话，进下一波时在玩家边上补一个。
       实测早期一波只杀 20 只（4.5% × 20 = 0.9 个），不兜底的话前几波经常一个商都见不到，
       而整备点已经删了 —— 金币就彻底没处花了。权重偏向商，因为它是唯一的花钱口。 */
    pity: {spring:6, chest:3, shop:1}
  },
  shopReroll: 1
};

/* 波次三旋钮（设计文档第三节）。Boss 波不走这套。 */
function waveRate(w){ return 0.75 + 0.22 * (w - 1); }
function waveCap(w){  return Math.min(70, 22 + 4 * w); }
function hpMul(w){    return 1 + 0.20 * (w - 1); }
function dmgMul(w){   return 1 + 0.09 * (w - 1); }
function spdMul(w){   return Math.min(1.35, 1 + 0.015 * (w - 1)); }
function xpMul(w){    return 1 + 0.12 * (w - 1); }

/* ===== 怪物基础数值（设计文档 4.1）=====
   art 是 MOB_ART 的键 —— **一张新图都没画**。
   kind: melee 近战 / ranged 远程 / elite 精英
   r 碰撞半径；big 由 r >= BF.bigR 自动判定 */
var BF_FOES = {
 rat:    {name:"廊道灰鼠",  art:"rat",     col:"#7A6E5C", hp:12, dmg:5,  spd:96,  armor:0, xp:2,  r:11, kind:"melee"},
 slime:  {name:"食橱泥怪",  art:"slime",   col:"#6E8A4A", hp:34, dmg:8,  spd:52,  armor:0, xp:5,  r:15, kind:"melee"},
 spider: {name:"洞穴长足蛛",art:"spider",  col:"#6B5B7A", hp:20, dmg:7,  spd:72,  armor:0, xp:4,  r:12, kind:"melee",
          dash:{every:3.2, dur:0.55, mult:2.6, warn:0.25, rest:0.4}},
 bone:   {name:"残骨兵",    art:"bone",    col:"#9A9079", hp:30, dmg:9,  spd:82,  armor:2, xp:6,  r:13, kind:"melee"},
 ghost:  {name:"低语幽魂",  art:"ghost",   col:"#6E86A8", hp:18, dmg:11, spd:112, armor:0, xp:6,  r:12, kind:"melee",
          phase:true, wob:22},
 prism:  {name:"碎色棱",    art:"prism",   col:"#A8608C", hp:26, dmg:6,  spd:62,  armor:1, xp:8,  r:12, kind:"ranged",
          shot:{cd:2.2, keep:260, speed:190, r:6, n:1, spread:0, warn:0.45}},
 statue: {name:"守门石像",  art:"statue",  col:"#8A8378", hp:70, dmg:14, spd:34,  armor:4, xp:12, r:17, kind:"melee"},
 clock:  {name:"锈钟怪",    art:"clock",   col:"#B07A33", hp:44, dmg:9,  spd:50,  armor:1, xp:10, r:14, kind:"ranged",
          shot:{cd:3.0, keep:300, speed:125, r:11, n:1, spread:0, warn:0.6, slow:{pct:0.35, sec:2}}},
 warden2:{name:"回廊游影",  art:"warden2", col:"#5A5468", hp:32, dmg:12, spd:100, armor:0, xp:10, r:13, kind:"melee",
          blink:{every:5, warn:0.35, min:90, max:140}},
 dread:  {name:"吞惧者",    art:"dread",   col:"#8A4A4A", hp:40, dmg:7,  spd:54,  armor:1, xp:12, r:15, kind:"ranged",
          shot:{cd:3.5, keep:240, speed:165, r:7, n:3, spread:20, warn:0.55}},
 gate:   {name:"层间守者",  art:"gate",    col:"#A93729", hp:150,dmg:16, spd:66,  armor:3, xp:45, r:20, kind:"melee",
          elite:true, noKnock:true, scale:1.4}
};

/* ===== 每一波（设计文档 4.2）=====
   pool 是权重表；fix 是这一波固定额外刷的。
   第 11 波往后没有单独的表，走 BF_WAVES 最后一条 + 公式继续加压（文档「待办」里记着）。*/
var BF_WAVES = [
 {pool:{rat:100}},
 {pool:{rat:70, slime:30}},
 {pool:{rat:55, slime:25, spider:20}},
 {pool:{rat:40, slime:22, spider:22, bone:16}},
 {pool:{rat:30, slime:20, spider:20, bone:20, ghost:10}, fix:{gate:1}},
 {pool:{rat:22, slime:16, spider:18, bone:18, ghost:14, prism:12}, fix:{gate:1}},
 {pool:{rat:16, slime:14, spider:16, bone:16, ghost:14, prism:14, statue:10}, fix:{gate:1}},
 {pool:{rat:12, slime:12, spider:14, bone:14, ghost:14, prism:14, statue:10, clock:10}, fix:{gate:1}},
 {pool:{rat:10, slime:10, spider:12, bone:12, ghost:14, prism:12, statue:10, clock:10, warden2:10}, fix:{gate:2}}
];

/* ===== Boss（设计文档 4.3）=====
   数值写死、不吃波次倍率（跟地牢的章末 Boss fixed:true 一个规矩），但吃难度层倍率。
   第 20/30/40 波预定换成 steward / priest / crown，现在先用同一只按 rep 加压。 */
var BF_BOSS = {
 warden: {name:"石廊守卫", art:"warden", col:"#8A3223", hp:1400, dmg:18, spd:58, armor:4,
          xp:260, gold:400, r:30, noKnock:true, boss:true, scale:2.5,
          sweep: {cd:6.0, warn:0.8, arc:200, range:150, dmg:26},
          quake: {cd:9.0, warn:1.2, r:95,  dmg:34},
          call:  {at:[0.75, 0.50, 0.25], n:8, id:"rat", ring:150, warn:0.6},
          rage:  {at:0.30, spd:1.30, cd:0.70},
          adds:  {id:"dread", n:2, respawn:8}}
};
function bossFor(w){
  var d = {}, k;
  for(k in BF_BOSS.warden) d[k] = BF_BOSS.warden[k];
  var rep = Math.floor(w / BF.bossEvery);          // 第 10 波 rep=1
  if(rep > 1){ var m = 1 + 0.9 * (rep - 1);
    d.hp = Math.round(d.hp * m); d.dmg = Math.round(d.dmg * (1 + 0.35 * (rep - 1)));
    d.xp = Math.round(d.xp * m); d.gold = Math.round(d.gold * m); }
  return d;
}

/* ===== 特殊遗物（Boss 掉落，用户 2026-09-22）=====
   打倒每 10 波一只的 Boss 之后，从这个池子里**三选一**。
   ⚠️ **不占那 15 个遗物位**，也不能分解、不能当合成材料 —— 纯增益，没有取舍。
   ⚠️ **它们跟那 209 件是两套东西**：id 全部带 `sp_` 前缀，存在 `P.special` 上，
      判定走 `hasSp()` 不走 `has()`。别混进 RELICS。

   设计口径（用户原话：「现在的遗物数值都太保守了，要有割草的爽感」）：
   **一件都不许是「伤害 +N%」那种**。每一件都得改变「一刀能打到多少东西」——
   张角、刀程、攻速、补刀、爆炸、连锁、冲击波、绕转刀、践踏、光环。
   一趟拿得到的件数 = 波数 ÷ 10，所以第 30 波才 3 件 —— 单件必须够猛。 */
var BF_SPECIAL = [
 {id:"sp_whirl",   n:"回旋",  pw:"刀挥出一整圈（张角 360°）",
  lore:"他学会了不再看敌人在哪边。"},
 {id:"sp_reach",   n:"长臂",  pw:"刀程 +60%，击退翻倍",
  lore:"手臂长的人，不需要走那么近。"},
 {id:"sp_haste",   n:"疾风",  pw:"攻速 +60%",
  lore:"风过处，连回声都跟不上。"},
 {id:"sp_second",  n:"二段",  pw:"每一刀之后补一刀（70% 伤害）",
  lore:"第一刀是问，第二刀是答。"},
 {id:"sp_burst",   n:"爆裂",  pw:"击杀时原地炸开：范围 80，伤害 = 那只怪最大生命的 60%，能连锁",
  lore:"死得越壮，炸得越响。"},
 {id:"sp_chain",   n:"雷链",  pw:"每次命中，闪电跳到最近 3 个敌人，各受 40% 伤害",
  lore:"它只认最近的那个，一个接一个。"},
 {id:"sp_wave",    n:"破空",  pw:"每一刀射出一道穿透冲击波（70% 伤害）",
  lore:"刀停在半空，风继续往前走。"},
 {id:"sp_orbit",   n:"悬刃",  pw:"两把刀绕着你转，碰到的敌人每 0.4 秒受 60% 伤害",
  lore:"它们不听指挥，只是一直转。"},
 {id:"sp_trample", n:"践踏",  pw:"移动时每 0.3 秒对身边的敌人造成 35% 伤害",
  lore:"路是踩出来的，尸体也是。"},
 {id:"sp_thorn",   n:"荆棘",  pw:"每秒对身边 130 范围内所有敌人造成 50% 伤害",
  lore:"站着不动，也在杀人。"},
 {id:"sp_exec",    n:"处决",  pw:"敌人生命低于 25% 时，命中直接击杀（Boss 除外）",
  lore:"最后那一下，他从来懒得补。"},
 {id:"sp_vortex",  n:"漩涡",  pw:"每 3 秒把周围的敌人拽到身边",
  lore:"不必去找，让它们自己过来。"},
 {id:"sp_frost",   n:"霜环",  pw:"身边 220 范围内的敌人移速 −40%",
  lore:"越靠近他，越像在水里跑。"},
 {id:"sp_horde",   n:"人海",  pw:"身边每有一个敌人，伤害 +3%（不封顶）",
  lore:"围上来的越多，他笑得越开。"},
 {id:"sp_rampage", n:"狂暴",  pw:"每次击杀攻速 +5%，持续 4 秒，最多叠 15 层",
  lore:"停下来就凉了，所以别停。"},
 {id:"sp_skull",   n:"裂颅",  pw:"暴击时以那只怪为心炸开：范围 100，130% 伤害",
  lore:"头盖骨是最好的引信。"},
 {id:"sp_magnet",  n:"磁石",  pw:"拾取范围 ×4；每捡一枚金币，下一刀伤害 +3%（挥刀后清零）",
  lore:"钱贴着他走，刀也是。"},
 {id:"sp_feast",   n:"盛宴",  pw:"每次击杀回复 1% 最大生命，并且最大生命 +1（最多 +400）",
  lore:"他是靠这条廊子里的死人长大的。"}
];
var SPECIAL_PICK = 3;      // Boss 掉落时几选一
var SP_SECOND_MS = 0.15;   // 二段补刀的延时（秒）
var SP_ORBIT_R = 72;       // 悬刃的绕转半径

/* ===== 难度层（设计文档第八节）=====
   ⚠️ 只动怪，不动玩家。⚠️ 别让 spd 跟着涨 —— 那会把走位玩法关掉。
   2~5 层的数据就在表里，去掉 locked 就开放。 */
var BF_TIERS = [
 {id:1, name:"一层", hp:1.00, dmg:1.00, rate:1.00, cap:1.00, desc:"现在唯一开放的难度"},
 {id:2, name:"二层", hp:1.30, dmg:1.15, rate:1.20, cap:1.15, desc:"怪更硬、更密", locked:true},
 {id:3, name:"三层", hp:1.70, dmg:1.30, rate:1.45, cap:1.30, desc:"清不干净了", locked:true},
 {id:4, name:"四层", hp:2.20, dmg:1.50, rate:1.75, cap:1.45, desc:"没有遗物撑不过十波", locked:true},
 {id:5, name:"五层", hp:2.90, dmg:1.75, rate:2.10, cap:1.60, desc:"为局外养成准备的", locked:true}
];
var TIER = BF_TIERS[0];

/* ⚠️ 战场文案替换表（BFW / BFW_RE / bfWord）**已经搬到 content.js 末尾** ——
   主城的图鉴要多一页「战场遗物」，而 index.html 不加载 battle.js。别搬回来。 */

/* ================================================================
   状态
   P 这一趟（遗物、等级、金币…）  G 这一波（每波清零的计数）  E 场上的实体
   ⚠️ P 上只许存「发生过几次 / 攒了多少」这种事实，换算成属性那一步必须在 bstats() 里。
   ================================================================ */
var P = null, G = null, E = null, CAM = {x:0, y:0}, PAUSED = true, OVER = false;
var RMAP = {};                                   // id -> relic def
(function(){ for(var i = 0; i < RELICS.length; i++) RMAP[RELICS[i].id] = RELICS[i]; })();
var REDUCE_MOTION = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

function has(id){ return P && P.rset[id] === 1; }
/* 特殊遗物（Boss 掉的）跟那 209 件是**两套**，别混：判定走 hasSp，不走 has。 */
function hasSp(id){ return P && P.sset[id] === 1; }
function spDef(id){ for(var i = 0; i < BF_SPECIAL.length; i++) if(BF_SPECIAL[i].id === id) return BF_SPECIAL[i]; return null; }
function reindex(){ P.rset = {}; for(var i = 0; i < P.relics.length; i++) P.rset[P.relics[i]] = 1; }
function nRar(r){ var n = 0; for(var i = 0; i < P.relics.length; i++) if(RMAP[P.relics[i]].r === r) n++; return n; }

function newRun(){
  P = {hp:0, lvl:1, xp:0, gold:0, relics:[], rset:{}, special:[], sset:{}, combo:0, maxCombo:0, shield:0,
       kills:0, spent:0, bought:0, time:0, wave:1,
       killStreak:0, revived:0, shieldBroken:0, recoil:0, charge:0, chew:0, rend:0,
       bossSeen:0, rampartOn:false, noHitWaves:0, warmthLeft:0, bladeLeft:0, riseLeft:0,
       primeLeft:0, aegisN:0, hauntKills:0, kinds:{}, everBought:false,
       rageN:0, rageT:0, orbA:0, orbCd:0, vortexCd:0, thornCd:0, trampCd:0,
       shopN:0, chestN:0, chestCycle:0, bagAlerted:false};
  reindex();
  newWave(1, true);                       // ⚠️ G 必须先建好 —— bstats() 要读 G 上的几个计数
  E = {foes:[], shots:[], drops:[], sites:[], pwaves:[], fx:[], boss:null};
  E.me = {x:0, y:0, dir:0, swingCd:0, moving:0, moveT:0, slowT:0, slowPct:0, second:0, aim:0};
  CAM.x = 0; CAM.y = 0;
  P.hp = bstats().maxHp;
  OVER = false; pendPicks = 0;
}

/* 每波清零的那一堆（跟地牢 nextFloor() 是一回事） */
function newWave(w, quiet){
  var prevHurt = G ? G.hurt : true;
  G = {w:w, t:0, spawnAcc:0, echoUsed:false, reciteFree:0, holdUsed:0, corrodeArmor:0,
       openLeft:5, glassCut:0, aspdCut:0, dice:0, borrowUsed:false, braceUsed:false,
       burlapUsed:false, warmthUsed:false, nerveN:0, reboundUsed:false,
       tickN:0, longN:0, exorN:0, calmsN:0, stepArmor:0, fastRun:0, instantReady:false,
       wholeUsed:false, needleN:0, ropeN:0, capN:0, critShN:0, songN:0, bladeN:0,
       glyphArmor:0, healed:0, lastPct:0, greetN:0, shatterN:0, shatterFree:0, whim:0,
       swings:0, wrongN:0, hurt:false, kindsSeen:{}, catSeen:{}, hauntN:0, bossAdds:0,
       fixDone:false, digDone:false, dmgTaken:0, undyingUsed:false, magnetN:0,
       cautionN:0, broke:false, addsT:0, bossDown:false, spawnAcc:0};
  P.wave = w;
  if(quiet) return;
  /* 「稳步」：上一波没受过伤 */
  if(has("pace") && !prevHurt) healUp(bstats().maxHp * 0.55);
  onWaveRelics(w);
}

/* ================================================================
   面板：bstats()
   ⚠️ **全部现算**，一点加成都不许攒进 P —— 卖掉遗物必须当场失效。
   ⚠️ 顺序写死（跟 game.js 的 stats() 同一套）：
      加血件 → 铁躯 ×1.5 → 献身 ÷2 → 血量/连杀条件件 → 重装 (甲+1)×4 →
      硬茧 (甲+4)×1.2 → 破晓甲 → 叠甲 ×2 → 蚀甲 → 最低 1 → defGear 快照
   ================================================================ */
function bstats(){
  var b = BF.base, lv = P.lvl - 1, g = P.gold, sh = P.shield, cb = P.combo, w = P.wave;
  var s = {maxHp: b.maxHp + BF.perLevel.maxHp * lv, atk: b.atk + BF.perLevel.atk * lv,
           armor: b.armor, crit: b.crit, critMult: b.critMult, spd: b.spd, aspd: b.aspd,
           range: b.range, arc: b.arc, pickup: b.pickup, knock: b.knock,
           cut: 0, goldPct: 0, xpPct: 0, comboStep: BF.comboStep, defGear: 0};

  /* --- ① 加法：最大生命 --- */
  if(has("heart"))       s.maxHp += 6;
  if(has("grind"))       s.maxHp -= 5;
  if(has("vigor"))       s.maxHp += 17;
  if(has("gird"))        s.maxHp -= 2;
  if(has("ward"))        s.maxHp += 7;
  if(has("pad"))         s.maxHp += 8;
  if(has("paperweight")) s.maxHp += 6;
  if(has("engrave"))     s.maxHp += Math.min(30, 3 * lv);
  if(has("titan"))       s.maxHp = Math.round(s.maxHp * 1.5);      // 铁躯
  if(has("offer"))       s.maxHp = Math.round(s.maxHp / 2);        // 献身
  s.maxHp = Math.max(1, Math.round(s.maxHp));
  var hpPct = s.maxHp > 0 ? P.hp / s.maxHp : 1;

  /* --- ② 加法：攻击 --- */
  if(has("whet"))  s.atk += 3;
  if(has("grind")) s.atk += 5;
  if(has("nick"))  s.atk += 1;
  if(has("vigor")) s.atk -= 4;
  if(has("brand")) s.atk += Math.min(20, lv);
  if(has("paperweight")) s.atk += Math.min(8, Math.floor(s.maxHp / 40));
  if(has("moltengold")) s.atk += 2 * Math.min(12, Math.floor(g / 100));
  if(has("triplecut") && P.killStreak >= 3) s.atk += 10;

  /* --- ③ 加法：暴击 --- */
  if(has("keen"))      s.crit += 5;
  if(has("nick"))      s.crit += 4;
  if(has("rustplate")) s.crit -= 6;
  if(has("spark"))     s.crit += 20;
  if(has("maul"))      s.crit += 10;
  if(has("carve"))     s.crit += 15;
  if(has("recite"))    s.crit += 30;
  if(has("caution"))   s.crit += 2;
  if(has("stroke"))    s.crit += 8;                                 // 战场改写
  if(has("tempo") && cb >= 5)  s.crit += 25;
  if(has("charge"))    s.crit += 5 * P.charge;
  if(has("dice"))      s.crit += G.dice;
  if(has("weight"))    s.crit += 3 + Math.min(8, 2 * Math.floor(g / 200));
  if(has("moltengold")) s.crit += 2 * Math.min(12, Math.floor(g / 100));
  if(has("mirroredge")) s.crit += Math.min(20, 4 * Math.floor(sh / 15));
  if(has("vim") && hpPct >= 1)     s.crit += 30;
  if(has("slaughter") && P.killStreak >= 5) s.crit += 50;
  if(has("edge"))  s.critMult += 0.5;
  if(has("clean")) s.critMult += 0.4;                               // 战场改写
  if(has("maul"))  s.critMult += 1.0;
  if(has("crush")) s.critMult += 3.5;

  /* --- ④ 加法：护甲 --- */
  if(has("iron"))      s.armor += 1;
  if(has("plate"))     s.armor += 2;
  if(has("gird"))      s.armor += 1;
  if(has("twoply"))    s.armor += 4;
  if(has("rustplate")) s.armor += 2;
  if(has("bastion"))   s.armor += 4;
  if(has("armpad"))    s.armor += 1;
  if(has("underarmor"))s.armor += 2;
  if(has("armblade"))  s.armor += 2;
  if(has("ironvow"))   s.armor += 3;
  if(has("rampart"))   s.armor += 10;
  if(has("chainmail")) s.armor += 1 + Math.min(3, Math.floor(cb / 6));
  if(has("bloodplate"))s.armor += Math.min(6, Math.floor(s.maxHp / 40));
  if(has("twin"))      s.armor += Math.min(8, Math.floor(sh / 15));
  if(has("shieldking"))s.armor += Math.min(4, Math.floor(sh / 30));
  if(has("veteran"))   s.armor += Math.min(10, 2 * Math.floor(P.shieldBroken / 5));
  if(has("spry"))      s.armor += Math.min(7, Math.max(0, relicCap() - P.relics.length));
  if(has("stand") && hpPct < 0.50) s.armor += 5;
  if(has("whole") && hpPct >= 1)   s.armor += 8;
  if(has("slaughter") && P.killStreak >= 5) s.armor += 6;
  s.armor += G.stepArmor + G.glyphArmor + G.corrodeArmor;
  if(has("dawn") && G.swings < 20) s.armor += 5;
  /* 乘法几件，位置写死 */
  if(has("heavy"))  s.armor = (s.armor + 1) * 4;
  if(has("callus")) s.armor = Math.floor((s.armor + 3) * 1.2);
  if(has("stack")){ s.armor += 5; if(P.noHitWaves >= 2) s.armor *= 2; }
  s.armor = Math.max(0, Math.round(s.armor));

  /* --- ⑤ 常驻减伤（cutStatic 的唯一口径，封在 BF.cutMax）--- */
  var c = 0;
  if(has("soft"))  c += 7;
  if(has("hide"))  c += 3;
  if(has("shed"))  c += 10;
  if(has("still")) c += 20;
  if(has("quell")) c += 20;
  if(has("bile"))  c += 5;
  if(has("janus")) c += 8;
  if(has("linked"))c += 5 + Math.min(25, 5 * Math.floor(cb / 4));
  if(has("goldplate")) c += 5 + Math.min(16, 4 * Math.floor(g / 300));
  if(has("evervow")) c += 6;
  if(has("tough"))  c += Math.min(15, w - 1);
  if(has("deep") && w >= 30) c += 15;
  if(has("nemesis"))c += Math.min(45, 5 * P.bossSeen);
  if(has("ascetic") && !P.everBought) c += Math.min(25, 5 * (w - 1));
  if(has("familiar")) c += Math.min(15, 5 * Object.keys(G.kindsSeen).length);
  if(has("grit"))   c += Math.min(15, 5 * G.wrongN);
  if(has("shieldheart") && sh >= 50) c += 18;
  if(has("scale") && hpPct < 0.50) c += 15;
  if(has("ease")  && hpPct > 0.80) c += 12;
  if(has("ironvow")) c += 2 * Math.min(5, Math.floor(s.armor / 3));
  if(has("confluence")) c += 2 * confTiers(s);
  s.cutStatic = c;
  s.cut = c;

  /* --- ⑥ 别的 --- */
  if(has("greed")) s.goldPct += 20;
  if(has("rust"))  s.goldPct += 10;
  if(has("study")) s.xpPct  += 10;
  if(has("spark")) s.comboStep = 2;
  if(has("wellread")) s.range = Math.round(s.range * 1.10);         // 战场改写
  if(has("steady") && hpPct < 0.25) s.spd = Math.round(s.spd * 1.25);
  s.aspd = Math.max(0.35, s.aspd * (1 - G.aspdCut / 100));          // 沙漏的代价

  /* --- ⑦ 特殊遗物（Boss 掉的）：只改「一刀能打到多少」，不给伤害百分比 --- */
  if(hasSp("sp_whirl"))  s.arc = 360;
  if(hasSp("sp_reach")){ s.range = Math.round(s.range * 1.6); s.knock *= 2; }
  if(hasSp("sp_haste"))  s.aspd *= 1.6;
  if(hasSp("sp_magnet")) s.pickup *= 4;
  if(hasSp("sp_feast"))  s.maxHp += Math.min(400, P.kills);
  if(hasSp("sp_rampage") && P.rageT > 0) s.aspd *= 1 + 0.05 * P.rageN;

  s.atk = Math.max(1, Math.round(s.atk));
  s.maxHp = Math.max(1, Math.round(s.maxHp));
  s.defGear = s.armor;                                              // 铁壁读的是这个
  return s;
}

/* 「万流归宗」的三条线各几档（护盾每 50 / 护甲每 5 / 连击每 10，各最多 3 档） */
function confTiers(s){
  return Math.min(3, Math.floor(P.shield / 50)) +
         Math.min(3, Math.floor(s.armor / 5)) +
         Math.min(3, Math.floor(P.combo / 10));
}
function relicCap(){ return BF.relicMax + (has("pack") ? 3 : 0); }
/* 遗物刚好装满时自动把遗物页弹出来（用户 2026-09-22）——
   下一件就要做取舍了，先让玩家看一眼手里有什么、顺手合成掉几件。
   ⚠️ 只在**从没满到满**的那一下弹一次（P.bagAlerted），掉到满以下才复位；
      而且挂在 step() 里（暂停时不跑），所以不会打断别的弹层。 */
function maybeFullBag(){
  if(P.relics.length >= relicCap()){
    if(!P.bagAlerted && !anyVeil() && !OVER){
      P.bagAlerted = true;
      fuseMode = false; fuseSel = []; sellArmed = null;
      openBag();
    }
  } else P.bagAlerted = false;
}
function comboPct(s){ return Math.floor(P.combo / s.comboStep) * BF.comboPct; }

/* 概率类效果的唯一口子（幸运 +25% 相对、再摇没中再掷一次）—— 别再直接写 Math.random() < p */
function luck(p){
  if(has("fortune")) p *= 1.25;
  if(Math.random() < p) return true;
  if(has("reshake") && Math.random() < 0.20) return Math.random() < p;
  return false;
}

/* ================================================================
   打人这一侧
   伤害 =（atk + base + extra）×（1 + pct/100）+ flat，再 ×暴击倍率，最后 −护甲，最低 1
   ⚠️ 全局只有「×(1+pct)」和「×暴击倍率」两个乘区，别再加第三个。
   ================================================================ */
var swingDepth = 0;

/* 刀朝哪儿：**优先朝最近的敌人**，附近没人才用移动方向。
   ⚠️ 别改回「只朝移动方向」—— 实测那样绕圈跑 100 秒只砍到 2 只，
      怪永远在你背后，自动挥刀等于没有。幸存者类都是自动瞄准的。 */
function aimDir(s){
  var me = E.me, best = null, bd = 1e9, i, f, d;
  var reach = s.range * 2.4;
  for(i = 0; i < E.foes.length; i++){
    f = E.foes[i]; if(f.dead) continue;
    d = Math.hypot(f.x - me.x, f.y - me.y) - f.r;
    if(d < bd && d <= reach){ bd = d; best = f; }
  }
  return best ? Math.atan2(best.y - me.y, best.x - me.x) : me.dir;
}

function swing(mult){
  var s = bstats(), me = E.me;
  var aim = aimDir(s); me.aim = aim;
  mult = mult || 1;
  var halfArc = s.arc * Math.PI / 360, inner = s.range * BF.wagerInner;
  var hits = [], wager = false, i, f, dx, dy, d, a, big = 0, weak = false, hauntHit = false;

  for(i = 0; i < E.foes.length; i++){
    f = E.foes[i]; if(f.dead) continue;
    dx = f.x - me.x; dy = f.y - me.y; d = Math.hypot(dx, dy);
    if(d > s.range + f.r) continue;
    a = Math.atan2(dy, dx) - aim;
    while(a >  Math.PI) a -= Math.PI * 2;
    while(a < -Math.PI) a += Math.PI * 2;
    if(Math.abs(a) > halfArc) continue;
    hits.push(f);
    if(d <= inner + f.r) wager = true;
    if(f.r >= BF.bigR) big++;
    if(f.elite || f.boss) weak = true;
    if(f.haunt) hauntHit = true;
  }
  G.swings++;
  fxSwing(me.x, me.y, aim, s.range, s.arc);
  /* 破空：每一刀射出一道穿透冲击波 —— 空刀也射，不然跑图时它就白瞎了 */
  if(hasSp("sp_wave") && mult === 1)
    E.pwaves.push({x:me.x, y:me.y, vx:Math.cos(aim) * 420, vy:Math.sin(aim) * 420,
                   r:24, life:1.1, hit:{}, mult:0.7});
  if(hasSp("sp_second") && mult === 1) me.second = SP_SECOND_MS;
  if(!hits.length){ return; }

  var moving = me.moving > 0.05;
  if(has("synes")) weak = true;

  /* ---- 四层桶 ---- */
  var base = 0, pct = comboPct(s), flat = 0, extra = 0, noArmor = false, forceCrit = false;
  var hp1 = P.hp / s.maxHp, cb = P.combo, g = P.gold, w = P.wave;

  if(weak) base += 2;
  if(wager){ pct += 100; if(has("nerve")) pct += 30; if(has("gambler")) flat += 10; }
  if(has("quick"))   pct += Math.min(40, 4 * Math.floor(cb / 5));
  if(has("snow"))    extra += 25 * Math.floor(cb / 5);
  if(has("inertia") && cb >= 5) pct += 40;
  if(has("scent") && weak)  pct += 20;
  if(has("synes"))   pct += 30;
  if(has("flaw")){   pct += 30; noArmor = true; }
  if(has("ember") && hp1 < 0.33) pct += 95;
  if(has("hoard"))   pct += 2 * Math.floor(g / 100);
  if(has("spend"))   pct += Math.min(40, 2 * Math.floor(P.spent / 300));
  if(has("delve"))   pct += Math.min(20, 0.5 * (w - 1));
  if(has("slay")){   pct += 30; if(weak) pct += 100; }
  if(has("opening") && G.openLeft > 0){ pct += 100; G.openLeft--; }
  if(has("greet")   && G.greetN < 6){   pct += 130; G.greetN++; }
  if(has("bastion")) pct += 3 * s.defGear;
  if(has("recoil"))  pct += 50 * Math.min(3, P.recoil);
  if(has("knock") && isBossWave(w)) pct += 50;
  if(has("stockpile")) pct += Math.min(30, 5 * P.bought);
  if(has("feeddemon")) pct += Math.min(40, 5 * G.hauntN);
  if(has("fearless") && hauntHit) pct += 80;
  if(has("full") && hp1 > 0.80) pct += 10;
  if(has("prime")){ if(hp1 >= 1) pct += 85; if(P.primeLeft > 0) pct += 40; }
  if(has("whole") && hp1 >= 1) pct += 80;
  if(has("bamboo"))  pct += Math.min(32, 4 * P.killStreak);
  if(has("swift") && moving) pct += 12;
  if(has("poise"))   pct += Math.min(60, 10 * Math.floor(me.moveT || 0));
  if(has("longword") && big) pct += 15;
  if(has("keenrise") && P.riseLeft > 0) pct += 120;
  if(has("spellblade") && P.bladeLeft > 0) pct += 80;
  if(has("shedge"))  pct += Math.min(12, 3 * Math.floor(P.shield / 20));
  if(has("towel"))   pct += Math.min(12, 2 * Math.floor(G.healed / Math.max(1, s.maxHp * 0.1)));
  if(has("janus")){  pct += 15 + 6 * Math.floor(s.cutStatic / 10); }
  if(has("confluence")) pct += 6 * confTiers(s);
  if(has("ironvow"))  pct += 5 * Math.min(5, Math.floor(s.armor / 3));
  if(has("shieldking")) pct += 5 * Math.min(4, Math.floor(P.shield / 30));
  if(has("empty"))    pct += 7 * Math.max(0, BF.relicMax - P.relics.length);
  if(has("whim"))     pct += G.whim;
  if(has("instant") && G.instantReady){ pct += 150; G.instantReady = false; G.fastRun = 0; }
  if(hasSp("sp_horde"))  pct += 3 * nearFoes(200);
  if(hasSp("sp_magnet")){ pct += 3 * G.magnetN; G.magnetN = 0; }
  if(has("rend")){ extra += 20; if(P.rend < 100){ P.rend++; P.hp = Math.max(1, P.hp - 1); } }
  if(has("volume"))   extra += 4 * big;
  if(has("keenfull") && hp1 > 0.50) extra += 30;
  if(has("snap") && moving) extra += 20;
  if(has("surge") && luck(0.25)) extra += 25;
  if(has("mirror"))   flat += Math.min(200, Math.floor(P.shield / 5));
  if(has("bloodmaul"))flat += Math.min(15, 3 * Math.floor(G.healed / 10));
  if(has("flash") && cb > 0 && cb % 5 === 0) forceCrit = true;
  if(has("instant") && moving) forceCrit = true;

  /* ---- 暴击 ---- */
  var cr = s.crit, cm = s.critMult;
  if(cr > 100) cm += 0.1 * Math.floor((cr - 100) / 5);
  var crit = forceCrit || (Math.random() * 100 < cr);
  if(crit && has("crush")) noArmor = true;

  var raw = (s.atk + base + extra) * (1 + pct / 100) + flat;
  if(crit) raw *= cm;
  raw = Math.max(1, Math.round(raw * mult));

  /* ---- 落到每一只身上 ---- */
  for(i = 0; i < hits.length; i++){
    f = hits[i]; if(f.dead) continue;
    /* 处决：残血直接抹掉（Boss 除外）*/
    if(hasSp("sp_exec") && !f.boss && f.hp / f.maxHp < 0.25){
      fxText("处决", "#8A6A10"); killFoe(f); continue;
    }
    var d2 = Math.max(1, raw - (noArmor ? 0 : f.armor));
    hurtFoe(f, d2, s, crit);
    /* 雷链：跳到最近的 3 个 */
    if(hasSp("sp_chain")) zap(f, Math.max(1, Math.round(raw * 0.4)), 3);
    /* 裂颅：暴击时以那只怪为心炸开 */
    if(crit && hasSp("sp_skull")) aoe(f.x, f.y, 100, Math.round(raw * 1.3), "#B45B12");
  }

  /* ---- 连击 ---- */
  P.combo += 1;
  if(has("offbeat") && moving) P.combo += 1;
  if(has("chase") && weak){ P.combo += 2; healUp(s.maxHp * 0.10); }
  if(P.combo > P.maxCombo) P.maxCombo = P.combo;
  G.lastPct = pct;

  /* ---- 挥刀触发（= 地牢的「答对」）---- */
  onSwingRelics(s, {crit:crit, moving:moving, wager:wager, big:big, weak:weak});

  /* 回响之厅：立刻再挥一刀（防无限递归） */
  if(has("hall") && swingDepth < 3 && luck(0.50)){ swingDepth++; swing(); swingDepth--; }
}

function onSwingRelics(s, c){
  if(has("drain") && luck(0.10)) healUp(4);
  if(has("pulse")) healUp(s.maxHp * 0.01);
  if(has("midas") && luck(0.25)) addGold(10);
  if(has("phoenix") && P.hp / s.maxHp < 0.15) healUp(s.maxHp * 0.05);
  if(has("allin") && c.wager && luck(0.10)) healUp(s.maxHp * 0.10);
  if(has("restring") && luck(0.20)){ P.combo = Math.max(P.combo, P.maxCombo); healUp(5); }
  if(has("chew") && P.chew){ P.chew = 0; healUp(s.maxHp * 0.04); }
  if(has("counter") && P.combo > 0 && P.combo % 10 === 0) healUp(10);
  if(has("aegis")){ P.aegisN++; if(P.aegisN % 10 === 0) addShield(10, 300); }
  if(has("corrode")) G.corrodeArmor = Math.min(5, G.corrodeArmor + 1);
  if(has("dice") && luck(0.50)) G.dice += 25;
  if(has("charge")) P.charge = c.crit ? 0 : P.charge + 1;
  if(has("oldrope") && P.combo % 8 === 0 && G.ropeN < 6){ G.ropeN++; addShield(2); }
  if(has("longsong") && P.combo % 10 === 0 && G.songN < 4){ G.songN++; addShield(15); healUp(s.maxHp * 0.03); }
  if(has("secondhand") && c.moving && G.tickN < 4){ G.tickN++; addShield(7); }
  if(has("ponder") && c.big && G.longN < 3){ G.longN++; addShield(10); }
  if(c.crit){
    if(has("vamp")) healUp(5);
    if(has("needle") && G.needleN < 4){ G.needleN++; addShield(3); }
    if(has("cap") && G.capN < 4){ G.capN++; healUp(s.maxHp * 0.03); }
    if(has("critshield") && G.critShN < 8){ G.critShN++; addShield(6); }
    if(has("glyph")) G.glyphArmor = Math.min(6, G.glyphArmor + 2);
    if(has("spellblade") && G.bladeN < 4){ G.bladeN++; P.bladeLeft = 5; }
  }
  if(has("whim")){ var r = ri(0, 2);
    if(r === 0) G.whim += 8; else if(r === 1) healUp(s.maxHp * 0.05); else addGold(60); }
  if(has("instant") && c.moving){ G.fastRun++; if(G.fastRun >= 5) G.instantReady = true; }
  else if(has("instant")) G.fastRun = 0;
  if(P.riseLeft > 0)  P.riseLeft--;
  if(P.bladeLeft > 0) P.bladeLeft--;
  if(P.primeLeft > 0) P.primeLeft--;
}

/* ================================================================
   挨打这一侧
   takeHit() 是「真的要掉血」的唯一入口（护盾就扣在这儿）
   mitigate() 是减伤链的唯一入口，顺序写死
   ================================================================ */
function mitigate(dmg, s, o){
  o = o || {};
  var cut = s.cutStatic;
  if(has("twice") && o.repeat)  cut += 25;
  if(has("psyche") && o.haunt)  cut += 15;
  if(has("calm")   && !o.ranged)cut += 7;
  if(has("buffer") && o.ranged) cut += 55;
  if(has("chain"))              cut += 10;
  if(has("grudge") && o.hitByMe)cut += 10;
  if(has("burlap") && !G.burlapUsed){ G.burlapUsed = true; cut += 25; }
  if(has("quell")  && o.boss)   cut += 50;
  if(has("rampart") && P.rampartOn) cut += 50;
  cut = Math.min(BF.cutMax, cut);
  var out = Math.floor(dmg * (100 - cut) / 100);            // ⚠️ 先乘后除，别写成 ×(1−cut/100)

  if(has("hold") && G.holdUsed < 2){ G.holdUsed++; out = Math.floor(out / 2); }
  if(has("warmth") && P.warmthLeft > 0){ P.warmthLeft--; out = Math.floor(out / 2); }
  var capPct = 0;
  if(has("blunt")) capPct = 16;
  if(has("womb"))  capPct = capPct ? Math.min(capPct, 12) : 12;
  if(capPct) out = Math.min(out, Math.ceil(s.maxHp * capPct / 100));
  if(has("endure") && out > s.maxHp * 0.10) out = Math.floor(out * 0.80);
  if(has("brace") && !G.braceUsed && P.hp > s.maxHp * 0.5 && P.hp - out <= s.maxHp * 0.5){
    G.braceUsed = true; out = Math.floor(out * 0.45); }
  out = Math.max(0, out - s.armor);
  if(has("slip") && luck(0.20)) out = 0;
  return Math.max(out > 0 ? 1 : 0, out);
}

/* 每一条「怪打你」的路都必须接到这儿，否则护盾会被绕过去 */
function takeHit(dmg, foe, o){
  if(OVER) return;
  o = o || {};
  var s = bstats();
  /* ---- 连击处理（优先级：铁胆 ＞ 断链 ＞ 惯性 ＞ 长链 ＞ 清零，归位兜一次）---- */
  var free = false, cb = P.combo;
  if(has("nerve") && o.wager && G.nerveN < 2){ G.nerveN++; }
  else if(has("unchain") && cb >= P.wave){ P.combo = cb - P.wave; free = true; }
  else if(has("inertia") && cb >= 5) P.combo = 5;
  else if(has("chain")) P.combo = Math.floor(cb / 2);
  else {
    if(has("rebound") && !G.reboundUsed && cb >= 10){
      G.reboundUsed = true; P.combo = Math.floor(cb / 2); healUp(s.maxHp * 0.20);
    } else P.combo = 0;
  }
  G.wrongN++; G.hurt = true;

  /* ---- 免伤（排在减伤链之前，别白吃屏息/错身的次数）---- */
  if(!free && has("echo") && !G.echoUsed){ G.echoUsed = true; healUp(s.maxHp * 0.05); free = true; }
  if(!free && has("recite") && G.reciteFree < 1){ G.reciteFree++; free = true; }
  if(!free && has("caution") && o.ranged && G.cautionN < 2){ G.cautionN++; free = true; }
  if(!free && has("fearless") && o.haunt) free = true;
  if(!free && has("glass") && o.ranged){ G.aspdCut += 3; free = true; }
  if(!free && has("shatter") && G.shatterFree > 0){ G.shatterFree--; free = true; }

  if(has("thorns")) splash(foe, 30);
  if(has("build")) addShield(2);

  if(free){ fxText("免伤", "#47702F"); return; }

  var raw = dmg;
  if(o.wager) raw = Math.round(raw * (has("cushion") ? 1.8 : 2));
  var out = mitigate(raw, s, o);
  if(out <= 0){ fxText("0", "#47702F"); return; }

  /* ---- 护盾先吃 ---- */
  var hadShield = P.shield > 0;
  if(P.shield > 0){
    var eat = Math.min(P.shield, out);
    P.shield -= eat; out -= eat;
    if(hadShield && P.shield <= 0) onShieldBroken();
  }
  if(out <= 0){ fxText("盾", "#6E86A8"); return; }

  P.hp -= out; G.dmgTaken += out;
  P.killStreak = 0; P.noHitWaves = 0;
  if(has("recoil")) P.recoil = Math.min(3, P.recoil + 1);
  if(has("chew")) P.chew = 1;
  if(has("prime")) P.primeLeft = 3;
  fxText("-" + out, "#A93729");
  if(foe && !foe.haunt && G.hauntN < BF.hauntMax * (has("bind") ? 2 : 1)){
    foe.haunt = true; G.hauntN++;
  }
  if(has("warmth") && !G.warmthUsed && P.hp <= s.maxHp * 0.5){ G.warmthUsed = true; P.warmthLeft = 5; }
  if(has("rampart")){ if(P.hp <= s.maxHp * 0.10) P.rampartOn = true;
                      if(P.hp >= s.maxHp * 0.50) P.rampartOn = false; }
  if(has("whole") && !G.wholeUsed && P.hp < s.maxHp * 0.5){
    G.wholeUsed = true; P.hp = Math.round(s.maxHp * 0.8); }
  if(P.hp <= 0) deathSave(s);
}

function onShieldBroken(){
  P.shieldBroken++; G.broke = true;
  if(has("borrow") && !G.borrowUsed){ G.borrowUsed = true; addShield(20); }
  if(has("shatter") && G.shatterN < 6){ G.shatterN++; G.shatterFree++; }
}

/* 「打完发现血 ≤ 0」的唯一入口 */
function deathSave(s){
  if(has("undying") && !G.undyingUsed){ G.undyingUsed = true; P.hp = Math.round(s.maxHp * 0.25);
    fxText("薪火", "#E3B23C"); return; }
  if(has("revive") && P.revived < 3){ P.revived++; P.hp = Math.round(s.maxHp * 0.50);
    fxText("回魂", "#E3B23C"); return; }
  endRun();
}

/* 回血的唯一入口（泉涌把溢出转成护盾） */
function healUp(n, force){
  if(n <= 0 || OVER) return 0;
  var s = bstats(), room = s.maxHp - P.hp, real = Math.min(room, Math.round(n));
  var over = Math.round(n) - real;
  P.hp += real; G.healed += real;
  if(over > 0 && (force || has("well"))) addShield(Math.floor(over / 2));
  return real;
}
function addShield(n, cap){
  if(n <= 0) return;
  P.shield += Math.round(n);
  if(cap && P.shield > cap) P.shield = cap;
}
function addGold(n){
  var s = bstats();
  P.gold += Math.max(0, Math.round(n * (1 + s.goldPct / 100)));
}

/* ================================================================
   进一波 / 升级 时触发的遗物
   ================================================================ */
function onWaveRelics(w){
  var s = bstats();
  if(has("lamp"))    healUp(s.maxHp * 0.08);
  if(has("well"))    healUp(s.maxHp * 0.20);
  if(has("towel"))   healUp(s.maxHp * 0.05);
  if(has("bloodmaul")) healUp(s.maxHp * 0.10);
  if(has("water"))   healUp(s.maxHp * 0.15, true);
  if(has("finale"))  healUp(s.maxHp * 0.30);
  if(has("underarmor")) healUp(s.maxHp * Math.min(0.18, 0.02 * s.armor));
  if(has("clasp"))   healUp(s.maxHp * Math.min(0.06, 0.02 * Math.floor(P.gold / 200)));
  if(has("foresight")) healUp(s.maxHp * 0.03 * Math.floor(P.gold / 100));
  if(has("thick"))   addShield(7);
  if(has("mirror"))  addShield(30);
  if(has("borrow"))  addShield(20);
  if(has("cherish")){ addShield(10); if(!P.brokeLast) healUp(s.maxHp * 0.15); }
  if(has("shatter")) addShield(10);
  if(has("veteran")) addShield(15);
  if(has("shedge"))  addShield(8);
  if(has("twin"))    addShield(25);
  if(has("shieldking")) addShield(30);
  if(has("mirroredge")) addShield(15);
  if(has("shieldheart")) addShield(15);
  if(has("evervow")) addShield(20);
  if(has("atone"))   addShield(12);                            // 战场改写
  if(has("armpad"))  addShield(Math.min(20, 4 * s.armor));
  if(has("vow"))     P.shield = Math.max(P.shield, Math.round(s.maxHp * 0.20));  // 取大值，别按回去
  if(has("track") && P.wrong2 !== undefined && P.wrong1 < P.wrong2) addShield(110);
  if(has("gatewait") && isBossWave(w)){ addShield(120); healUp(s.maxHp * 0.25); }
  if(has("purse"))   P.gold += 30;
  if(has("welfare")) addGold(w * 2);
  if(has("dig"))     dropCoinPile(3);
  if(!G.hurt) P.noHitWaves++;
}

function onLevelRelics(){
  var s = bstats();
  if(has("sprout")) healUp(s.maxHp * 0.04);
  if(has("satori")) addShield(8);
  if(has("keenrise")) P.riseLeft = 5;
  if(has("ascend")){ G.stepArmor = Math.min(12, G.stepArmor + 3); healUp(s.maxHp * 0.05); }
}

function xpNeed(){
  var n = BF.xpNeed(P.lvl);
  if(has("adept")) n = Math.ceil(n * 0.8);
  return n;
}
function gainXp(n){
  var s = bstats();
  P.xp += Math.max(1, Math.round(n * (1 + s.xpPct / 100)));
  var up = 0;
  while(P.xp >= xpNeed()){ P.xp -= xpNeed(); P.lvl++; up++; }
  if(up){
    var s2 = bstats();
    P.hp = Math.min(s2.maxHp, P.hp + Math.round(s2.maxHp * BF.levelHealPct));
    for(var i = 0; i < up; i++) onLevelRelics();
    pendPicks += up;
    openPick();
  }
}

/* ================================================================
   怪：受伤 / 倒下
   ================================================================ */
function hurtFoe(f, d, s, crit){
  f.hp -= d;
  f.flash = 0.12;
  if(!f.noKnock){
    var a = Math.atan2(f.y - E.me.y, f.x - E.me.x);
    f.kx = Math.cos(a) * s.knock; f.ky = Math.sin(a) * s.knock;
  }
  f.hitByMe = (f.hitByMe || 0) + 1;
  fxNum(f.x, f.y - f.r - 4, d, crit);
  if(f.hp <= 0) killFoe(f);
}
function splash(near, d){
  var f = near && !near.dead ? near : nearestFoe();
  if(f){ f.hp -= d; if(f.hp <= 0) killFoe(f); }
}
/* 身边 r 之内有几只（人海、霜环都要用）*/
function nearFoes(r){
  var n = 0, me = E.me;
  for(var i = 0; i < E.foes.length; i++){ var f = E.foes[i];
    if(!f.dead && Math.hypot(f.x - me.x, f.y - me.y) <= r) n++; }
  return n;
}
/* 范围伤害的唯一口子（爆裂、裂颅、荆棘、践踏、冲击波都走它）。
   ⚠️ **必须带递归深度**：爆裂是能连锁的，一片怪挨着炸会一路递归下去。 */
var aoeDepth = 0;
function aoe(x, y, r, dmg, col){
  if(dmg <= 0 || aoeDepth > 6) return;
  aoeDepth++;
  if(col) fxRing(x, y, r, col);
  var list = E.foes.slice();                 // 打的过程里会有新怪被召唤出来，先拍个快照
  for(var i = 0; i < list.length; i++){
    var f = list[i]; if(f.dead) continue;
    if(Math.hypot(f.x - x, f.y - y) > r + f.r) continue;
    f.hp -= dmg; f.flash = 0.12;
    fxNum(f.x, f.y - f.r - 4, dmg, false);
    if(f.hp <= 0) killFoe(f);
  }
  aoeDepth--;
}
/* 雷链：从 from 起，一路跳到最近的 n 个（不重复） */
function zap(from, dmg, n){
  var seen = {}, cur = from, i, j;
  seen[E.foes.indexOf(from)] = 1;
  for(i = 0; i < n; i++){
    var best = -1, bd = 260;
    for(j = 0; j < E.foes.length; j++){
      var f = E.foes[j];
      if(f.dead || seen[j]) continue;
      var d = Math.hypot(f.x - cur.x, f.y - cur.y);
      if(d < bd){ bd = d; best = j; }
    }
    if(best < 0) return;
    var t = E.foes[best]; seen[best] = 1;
    fxBolt(cur.x, cur.y, t.x, t.y);
    t.hp -= dmg; t.flash = 0.12;
    fxNum(t.x, t.y - t.r - 4, dmg, false);
    cur = t;
    if(t.hp <= 0) killFoe(t);
  }
}

function nearestFoe(){
  var best = null, bd = 1e9, i, f, d;
  for(i = 0; i < E.foes.length; i++){ f = E.foes[i]; if(f.dead) continue;
    d = Math.hypot(f.x - E.me.x, f.y - E.me.y); if(d < bd){ bd = d; best = f; } }
  return best;
}
function killFoe(f){
  if(f.dead) return;
  f.dead = true;
  var s = bstats(), k = BF.killScale;
  P.kills++; P.killStreak++;
  P.kinds[f.id] = (P.kinds[f.id] || 0) + 1;
  if(f.haunt){ G.hauntN--; P.hauntKills++;
    if(has("exorcise") && G.exorN < 3){ G.exorN++; healUp(s.maxHp * 0.02); }
    if(has("calmsoul") && G.calmsN < 3){ G.calmsN++; addShield(5); } }
  if(has("salve") && luck(0.40)) healUp(4 * k);
  if(has("reap"))     healUp(2 * k);
  if(has("breath"))   healUp(s.maxHp * 0.02 * k);
  if(has("mend"))     healUp(s.maxHp * 0.04 * k);
  if(has("reapfull")) healUp(s.maxHp * 0.025 * k);
  if(has("lesson") && !G.kindsSeen[f.id]) addGold(10);
  if(has("tome") && (P.kinds[f.id] || 0) >= 20) addGold(8);
  G.kindsSeen[f.id] = 1;
  if(hasSp("sp_rampage")){ P.rageN = Math.min(15, P.rageN + 1); P.rageT = 4; }
  if(hasSp("sp_feast")) healUp(s.maxHp * 0.01);
  if(hasSp("sp_burst")) aoe(f.x, f.y, 80, Math.max(1, Math.round(f.maxHp * 0.6)), "#C2510E");
  gainXp(f.xp);
  dropGold(f.x, f.y, f.gold);
  fxPop(f.x, f.y, f.col);
  maybeSite(f);
  if(f.boss) onBossDown(f);
}

/* ================================================================
   实体：生成 / AI / 弹丸 / 掉落
   ================================================================ */
function isBossWave(w){ return w % BF.bossEvery === 0; }

function makeFoe(id, w, x, y){
  var d = BF_FOES[id], sc = d.scale || 1;
  return {id:id, def:d, name:d.name, col:d.col, art:d.art, x:x, y:y,
    hp: Math.max(1, Math.round(d.hp * hpMul(w) * TIER.hp)),
    maxHp: Math.max(1, Math.round(d.hp * hpMul(w) * TIER.hp)),
    dmg: Math.max(1, Math.round(d.dmg * dmgMul(w) * TIER.dmg)),
    spd: d.spd * spdMul(w), armor: d.armor,
    xp: Math.max(1, Math.round(d.xp * xpMul(w))),
    gold: Math.max(1, Math.round((ri(1, 3) + Math.floor(w / 2)) * BF.goldMult)),
    r: d.r * sc, sc: sc, elite: !!d.elite, noKnock: !!d.noKnock, phase: !!d.phase,
    kx:0, ky:0, t: Math.random() * 10, touch:0, flash:0, haunt:false, dead:false,
    shotCd: d.shot ? d.shot.cd * (0.4 + Math.random() * 0.6) : 0, castT:0,
    dashT:0, dashCd: d.dash ? d.dash.every * Math.random() : 0,
    blinkCd: d.blink ? d.blink.every * Math.random() : 0, blinkWarn:0};
}
function makeBoss(w){
  var d = bossFor(w);
  var f = {id:"boss", def:d, name:d.name, col:d.col, art:d.art,
    x: E.me.x, y: E.me.y - 200,
    hp: Math.round(d.hp * TIER.hp), maxHp: Math.round(d.hp * TIER.hp),
    dmg: Math.round(d.dmg * TIER.dmg), spd:d.spd, armor:d.armor,
    xp:d.xp, gold:Math.round(d.gold * BF.goldMult), r:d.r, sc:d.scale, elite:true, boss:true, noKnock:true,
    kx:0, ky:0, t:0, touch:0, flash:0, dead:false,
    sweepCd:d.sweep.cd * 0.6, quakeCd:d.quake.cd * 0.8, cast:null, castT:0,
    called:0, rage:false};
  return f;
}

function spawnRing(){
  var a = Math.random() * Math.PI * 2;
  var R = Math.hypot(cw, ch) / 2 + BF.spawnPad;
  return {x: E.me.x + Math.cos(a) * R, y: E.me.y + Math.sin(a) * R};
}
function pickFromPool(pool){
  var tot = 0, k;
  for(k in pool) tot += pool[k];
  var r = Math.random() * tot;
  for(k in pool){ r -= pool[k]; if(r <= 0) return k; }
  return "rat";
}
function waveDef(w){ return BF_WAVES[Math.min(w, BF_WAVES.length) - 1]; }

function spawnTick(dt){
  var w = P.wave;
  if(isBossWave(w)) return spawnBossAdds(dt);
  var wd = waveDef(w);
  /* 这一波固定刷的（精英） */
  if(!G.fixDone){ G.fixDone = true;
    if(wd.fix) for(var k in wd.fix) for(var i = 0; i < wd.fix[k]; i++){
      var p = spawnRing(); E.foes.push(makeFoe(k, w, p.x, p.y)); } }
  var alive = liveFoes();
  if(alive >= waveCap(w) * TIER.cap) return;
  G.spawnAcc += dt * waveRate(w) * TIER.rate;
  while(G.spawnAcc >= 1 && liveFoes() < waveCap(w) * TIER.cap){
    G.spawnAcc -= 1;
    var q = spawnRing();
    E.foes.push(makeFoe(pickFromPool(wd.pool), w, q.x, q.y));
  }
}
function spawnBossAdds(dt){
  var d = bossFor(P.wave);
  if(!E.boss || E.boss.dead) return;
  var n = 0;
  for(var i = 0; i < E.foes.length; i++) if(!E.foes[i].dead && E.foes[i].id === d.adds.id) n++;
  G.addsT = (G.addsT || 0) - dt;
  if(n < d.adds.n && G.addsT <= 0){
    G.addsT = d.adds.respawn;
    var p = spawnRing(); E.foes.push(makeFoe(d.adds.id, P.wave, p.x, p.y));
  }
}
function liveFoes(){ var n = 0; for(var i = 0; i < E.foes.length; i++) if(!E.foes[i].dead) n++; return n; }

/* ---- 掉落 ---- */
function dropGold(x, y, n){ if(n > 0) E.drops.push({x:x, y:y, n:n, t:0}); }
function dropCoinPile(k){
  for(var i = 0; i < k; i++){
    var a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 220;
    var n = Math.max(1, Math.round((ri(2, 6) + P.wave) * 2 * BF.goldMult));
    if(has("alms") && luck(0.30)) n *= 2;
    E.drops.push({x: E.me.x + Math.cos(a) * d, y: E.me.y + Math.sin(a) * d, n:n, t:0});
  }
}

/* ---- 弹丸 ---- */
function shoot(f, s){
  var d = f.def.shot, n = d.n, i;
  var a0 = Math.atan2(E.me.y - f.y, E.me.x - f.x);
  for(i = 0; i < n; i++){
    var off = n > 1 ? (i - (n - 1) / 2) * d.spread * Math.PI / 180 : 0;
    E.shots.push({x:f.x, y:f.y, vx:Math.cos(a0 + off) * d.speed, vy:Math.sin(a0 + off) * d.speed,
                  r:d.r, dmg:f.dmg, col:f.col, life:4, slow:d.slow || null});
  }
}

/* ================================================================
   每帧
   ================================================================ */
function updateFoes(dt){
  var me = E.me, i, j, f, o, dx, dy, d, sp;
  for(i = 0; i < E.foes.length; i++){
    f = E.foes[i]; if(f.dead) continue;
    f.t += dt; if(f.flash > 0) f.flash -= dt;
    dx = me.x - f.x; dy = me.y - f.y; d = Math.hypot(dx, dy) || 1;
    sp = f.spd;
    if(hasSp("sp_frost") && d <= 220) sp *= 0.6;          // 霜环
    var def = f.def, tx = dx / d, ty = dy / d;

    if(f.boss){ updateBoss(f, dt, d, tx, ty); }
    else {
      /* 冲刺 */
      if(def.dash){
        f.dashCd -= dt;
        if(f.dashT > 0){ f.dashT -= dt; sp *= def.dash.mult; }
        else if(f.dashCd <= -def.dash.rest && f.dashCd <= 0 && d < 420){
          f.dashT = def.dash.dur; f.dashCd = def.dash.every; }
      }
      /* 瞬移 */
      if(def.blink){
        f.blinkCd -= dt;
        if(f.blinkWarn > 0){ f.blinkWarn -= dt; sp = 0;
          if(f.blinkWarn <= 0){
            var a = Math.random() * Math.PI * 2, rr = def.blink.min + Math.random() * (def.blink.max - def.blink.min);
            f.x = me.x + Math.cos(a) * rr; f.y = me.y + Math.sin(a) * rr; } }
        else if(f.blinkCd <= 0 && d > 60){ f.blinkCd = def.blink.every; f.blinkWarn = def.blink.warn;
          f.ghostX = f.x; f.ghostY = f.y; }
      }
      /* 远程：保持距离 + 开火。
         ⚠️ **开火前有 warn 秒的前摇，前摇期间站着不动**（用户 2026-09-22）——
            身上会画一圈收拢的预警环，玩家看得见才躲得开。 */
      if(def.shot){
        if(f.castT > 0){
          f.castT -= dt; sp = 0; tx = 0; ty = 0;       // 抬手时钉在原地
          if(f.castT <= 0){ shoot(f); f.shotCd = def.shot.cd; }
        } else {
          f.shotCd -= dt;
          if(d < def.shot.keep * 0.8){ tx = -tx; ty = -ty; }
          else if(d < def.shot.keep * 1.1){ tx = 0; ty = 0; }
          if(f.shotCd <= 0 && d < def.shot.keep * 1.6) f.castT = def.shot.warn || 0.45;
        }
      }
      /* 幽魂的飘移 */
      if(def.wob){ var w2 = Math.sin(f.t * 2.4) * 0.5;
        var nx = -ty, ny = tx; tx += nx * w2; ty += ny * w2; }
      f.x += tx * sp * dt; f.y += ty * sp * dt;
    }
    /* 击退 */
    if(f.kx || f.ky){ f.x += f.kx; f.y += f.ky; f.kx *= 0.55; f.ky *= 0.55;
      if(Math.abs(f.kx) < 0.4){ f.kx = 0; f.ky = 0; } }

    /* 互相排开（幽魂不参与） */
    if(!f.phase){
      for(j = i + 1; j < E.foes.length; j++){
        o = E.foes[j]; if(o.dead || o.phase) continue;
        var ox = o.x - f.x, oy = o.y - f.y, od = Math.hypot(ox, oy), mn = f.r + o.r;
        if(od > 0 && od < mn){ var push = (mn - od) / 2 / od;
          f.x -= ox * push; f.y -= oy * push; o.x += ox * push; o.y += oy * push; }
      }
    }
    /* 接触伤害 */
    f.touch -= dt;
    if(!f.def.shot || f.boss){
      if(Math.hypot(me.x - f.x, me.y - f.y) < f.r + 12 && f.touch <= 0){
        f.touch = BF.touchCd;
        takeHit(f.dmg, f, {haunt:f.haunt, hitByMe:(f.hitByMe || 0) >= 1, boss:!!f.boss,
                           repeat:!!G.catSeen[f.id], wager:false});
        G.catSeen[f.id] = 1;
      }
    }
  }
  /* 清掉尸体 */
  if(E.foes.length > 260) E.foes = E.foes.filter(function(x){ return !x.dead; });
}

function updateBoss(f, dt, d, tx, ty){
  var def = f.def;
  if(!f.rage && f.hp <= f.maxHp * def.rage.at){ f.rage = true; }
  var cdx = f.rage ? def.rage.cd : 1, spx = f.rage ? def.rage.spd : 1;
  /* 召唤 */
  var frac = f.hp / f.maxHp;
  while(f.called < def.call.at.length && frac <= def.call.at[f.called]){
    f.called++;
    for(var i = 0; i < def.call.n; i++){
      var a = i / def.call.n * Math.PI * 2;
      E.foes.push(makeFoe(def.call.id, P.wave, f.x + Math.cos(a) * def.call.ring,
                                               f.y + Math.sin(a) * def.call.ring));
    }
    fxRing(f.x, f.y, def.call.ring, f.col);
  }
  if(f.cast){
    f.castT -= dt;
    if(f.castT <= 0){
      if(f.cast === "sweep"){
        var a2 = Math.atan2(E.me.y - f.y, E.me.x - f.x);
        var dd = Math.hypot(E.me.x - f.x, E.me.y - f.y);
        var da = Math.atan2(E.me.y - f.y, E.me.x - f.x) - a2;
        if(dd < def.sweep.range) takeHit(Math.round(def.sweep.dmg * TIER.dmg), f, {boss:true});
        fxArc(f.x, f.y, a2, def.sweep.range, def.sweep.arc, f.col);
      } else if(f.cast === "quake"){
        if(Math.hypot(E.me.x - f.qx, E.me.y - f.qy) < def.quake.r)
          takeHit(Math.round(def.quake.dmg * TIER.dmg), f, {boss:true});
        fxRing(f.qx, f.qy, def.quake.r, "#A93729");
      }
      f.cast = null;
    }
    return;                                   // 施法时不动
  }
  f.sweepCd -= dt; f.quakeCd -= dt;
  if(f.sweepCd <= 0 && d < def.sweep.range){
    f.sweepCd = def.sweep.cd * cdx; f.cast = "sweep"; f.castT = def.sweep.warn;
    f.castDir = Math.atan2(E.me.y - f.y, E.me.x - f.x); return; }
  if(f.quakeCd <= 0){
    f.quakeCd = def.quake.cd * cdx; f.cast = "quake"; f.castT = def.quake.warn;
    f.qx = E.me.x; f.qy = E.me.y; return; }
  f.x += tx * f.spd * spx * dt; f.y += ty * f.spd * spx * dt;
}

function updateShots(dt){
  var me = E.me;
  for(var i = E.shots.length - 1; i >= 0; i--){
    var s = E.shots[i];
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    if(s.life <= 0){ E.shots.splice(i, 1); continue; }
    if(Math.hypot(me.x - s.x, me.y - s.y) < s.r + 11){
      takeHit(s.dmg, null, {ranged:true});
      if(s.slow){ me.slowT = s.slow.sec; me.slowPct = s.slow.pct; }
      E.shots.splice(i, 1);
    }
  }
}
function updateDrops(dt){
  var s = bstats(), me = E.me;
  for(var i = E.drops.length - 1; i >= 0; i--){
    var d = E.drops[i]; d.t += dt;
    var dx = me.x - d.x, dy = me.y - d.y, dd = Math.hypot(dx, dy);
    if(dd < s.pickup){ d.x += dx / dd * 320 * dt; d.y += dy / dd * 320 * dt; }
    if(dd < 16){ addGold(d.n); E.drops.splice(i, 1); if(hasSp("sp_magnet")) G.magnetN++; }
  }
}

/* ================================================================
   美术：把 art.js 的 SVG 转成 Image
   ⚠️ MOB_ART / HERO 的主体是 currentColor，这里换成每只怪自己的颜色。
   ⚠️ data URI 必须带 xmlns 和 width/height，不然有的浏览器画不出来。
   ================================================================ */
var IMG = {};
function mkImg(svg, col){
  var s = svg.replace(/currentColor/g, col)
             .replace(/^<svg /, '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" ');
  var im = new Image(); im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
  return im;
}
function buildArt(){
  for(var k in BF_FOES) if(MOB_ART[BF_FOES[k].art]) IMG[k] = mkImg(MOB_ART[BF_FOES[k].art], BF_FOES[k].col);
  IMG.boss = mkImg(MOB_ART[BF_BOSS.warden.art], BF_BOSS.warden.col);
  IMG.bossRage = mkImg(MOB_ART[BF_BOSS.warden.art], "#D8412F");
  IMG.hero = mkImg(HERO, "#245E8C");
  /* 击杀掉落的互动点：art.js 里现成的三张图，一张新的都没画 */
  IMG.spring = mkImg(SPRING, "#266F7B");
  IMG.shop   = mkImg(SHOP,   "#9C6A10");
  IMG.chest  = mkImg(CHEST,  "#8A6A3A");
}

/* ================================================================
   画面
   ================================================================ */
var cv, ctx2, cw = 360, ch = 640, dpr = 1;
function resize(){
  cv = $("cv"); dpr = Math.min(2, window.devicePixelRatio || 1);
  cw = cv.clientWidth; ch = cv.clientHeight;
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  ctx2 = cv.getContext("2d"); ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function sx(x){ return x - CAM.x + cw / 2; }
function sy(y){ return y - CAM.y + ch / 2; }

function draw(){
  if(!ctx2) return;
  var me = E.me, i;
  ctx2.clearRect(0, 0, cw, ch);
  /* 地板：56px 的格线 + 按坐标哈希撒的石纹。一个字节的地图数据都不存。 */
  ctx2.fillStyle = "#F1EBDD"; ctx2.fillRect(0, 0, cw, ch);
  var GS = 56, x0 = Math.floor((CAM.x - cw / 2) / GS) * GS, y0 = Math.floor((CAM.y - ch / 2) / GS) * GS;
  ctx2.strokeStyle = "#E4DDCE"; ctx2.lineWidth = 1; ctx2.beginPath();
  for(var gx = x0; gx < CAM.x + cw / 2 + GS; gx += GS){ ctx2.moveTo(sx(gx), 0); ctx2.lineTo(sx(gx), ch); }
  for(var gy = y0; gy < CAM.y + ch / 2 + GS; gy += GS){ ctx2.moveTo(0, sy(gy)); ctx2.lineTo(cw, sy(gy)); }
  ctx2.stroke();
  ctx2.fillStyle = "#DED6C4";
  for(gx = x0; gx < CAM.x + cw / 2 + GS; gx += GS)
    for(gy = y0; gy < CAM.y + ch / 2 + GS; gy += GS){
      var h = ((gx * 73856093) ^ (gy * 19349663)) >>> 0;
      if(h % 7 === 0) ctx2.fillRect(sx(gx) + (h % 31), sy(gy) + (h % 23), 3, 3);
    }

  /* Boss 预警（画在地上） */
  for(i = 0; i < E.foes.length; i++){
    var b = E.foes[i]; if(b.dead || !b.boss || !b.cast) continue;
    ctx2.fillStyle = "rgba(169,55,41,.20)"; ctx2.strokeStyle = "rgba(169,55,41,.75)"; ctx2.lineWidth = 2;
    if(b.cast === "sweep"){
      var ha = b.def.sweep.arc * Math.PI / 360;
      ctx2.beginPath(); ctx2.moveTo(sx(b.x), sy(b.y));
      ctx2.arc(sx(b.x), sy(b.y), b.def.sweep.range, b.castDir - ha, b.castDir + ha);
      ctx2.closePath(); ctx2.fill(); ctx2.stroke();
    } else {
      ctx2.beginPath(); ctx2.arc(sx(b.qx), sy(b.qy), b.def.quake.r, 0, 6.2832);
      ctx2.fill(); ctx2.stroke();
    }
  }
  /* 互动点：泉 / 商 / 箱。脚下画一圈淡光圈，远远就能看见 */
  for(i = 0; i < E.sites.length; i++){
    var t = E.sites[i], tx2 = sx(t.x), ty2 = sy(t.y);
    if(tx2 < -60 || tx2 > cw + 60 || ty2 < -60 || ty2 > ch + 60) continue;
    var tc = t.kind === "spring" ? "#266F7B" : t.kind === "shop" ? "#9C6A10" : "#8A6A3A";
    var dim = t.cool > 0 ? 0.35 : 1;                 // 冷却中的画淡一点
    ctx2.strokeStyle = tc; ctx2.globalAlpha = (0.30 + 0.16 * Math.sin(t.t * 2.6)) * dim; ctx2.lineWidth = 2.5;
    ctx2.beginPath(); ctx2.arc(tx2, ty2, BF.site.r + 6, 0, 6.2832); ctx2.stroke();
    ctx2.globalAlpha = 1;
    var tim = IMG[t.kind];
    ctx2.globalAlpha = dim;
    if(tim && tim.complete && tim.naturalWidth) ctx2.drawImage(tim, tx2 - 21, ty2 - 23, 42, 42);
    ctx2.globalAlpha = 1;
  }

  /* 掉落 */
  ctx2.fillStyle = "#E3B23C"; ctx2.strokeStyle = "#8A5F0C"; ctx2.lineWidth = 1;
  for(i = 0; i < E.drops.length; i++){ var dp = E.drops[i];
    ctx2.beginPath(); ctx2.arc(sx(dp.x), sy(dp.y), 5, 0, 6.2832); ctx2.fill(); ctx2.stroke(); }

  /* 怪 */
  for(i = 0; i < E.foes.length; i++){
    var f = E.foes[i]; if(f.dead) continue;
    var px = sx(f.x), py = sy(f.y), sz = f.r * 2.4;
    if(px < -80 || px > cw + 80 || py < -80 || py > ch + 80) continue;
    if(f.blinkWarn > 0 && f.ghostX !== undefined){
      ctx2.globalAlpha = 0.3; drawImg(f, sx(f.ghostX), sy(f.ghostY), sz); ctx2.globalAlpha = 1; }
    /* 远程怪的抬手预警：一圈往里收的环 + 身上一点高光 */
    if(f.castT > 0 && f.def.shot){
      var wt = f.castT / (f.def.shot.warn || 0.45);
      ctx2.strokeStyle = f.col; ctx2.globalAlpha = 0.9; ctx2.lineWidth = 2.5;
      ctx2.beginPath(); ctx2.arc(px, py, f.r + 6 + wt * 26, 0, 6.2832); ctx2.stroke();
      ctx2.globalAlpha = 1;
    }
    if(f.haunt){ ctx2.strokeStyle = "#6E1F16"; ctx2.lineWidth = 2;
      ctx2.beginPath(); ctx2.arc(px, py, f.r + 3, 0, 6.2832); ctx2.stroke(); }
    if(f.elite && !f.boss){ ctx2.strokeStyle = "#E3B23C"; ctx2.lineWidth = 2;
      ctx2.beginPath(); ctx2.arc(px, py, f.r + 5, 0, 6.2832); ctx2.stroke(); }
    if(f.flash > 0){ ctx2.globalAlpha = 0.55; }
    drawImg(f, px, py, sz);
    ctx2.globalAlpha = 1;
    if(f.boss || f.elite || f.hp < f.maxHp) drawBar(px, py - f.r - 7, f.r * 2, f.hp / f.maxHp);
  }

  /* 破空的冲击波 */
  for(i = 0; i < E.pwaves.length; i++){ var pw = E.pwaves[i];
    ctx2.strokeStyle = "#245E8C"; ctx2.globalAlpha = Math.min(1, pw.life * 1.6); ctx2.lineWidth = 5;
    ctx2.beginPath(); ctx2.arc(sx(pw.x), sy(pw.y), pw.r, 0, 6.2832); ctx2.stroke();
    ctx2.globalAlpha = 1; }

  /* 悬刃：两把绕转的刀 */
  if(hasSp("sp_orbit")){
    ctx2.strokeStyle = "#8A6A10"; ctx2.lineWidth = 4; ctx2.lineCap = "round";
    for(i = 0; i < 2; i++){
      var oa = P.orbA + i * Math.PI;
      var ox = sx(me.x + Math.cos(oa) * SP_ORBIT_R), oy = sy(me.y + Math.sin(oa) * SP_ORBIT_R);
      ctx2.beginPath();
      ctx2.moveTo(ox - Math.cos(oa) * 11, oy - Math.sin(oa) * 11);
      ctx2.lineTo(ox + Math.cos(oa) * 11, oy + Math.sin(oa) * 11);
      ctx2.stroke();
    }
  }

  /* 弹丸 */
  for(i = 0; i < E.shots.length; i++){ var s2 = E.shots[i];
    ctx2.fillStyle = s2.col; ctx2.beginPath(); ctx2.arc(sx(s2.x), sy(s2.y), s2.r, 0, 6.2832); ctx2.fill();
    ctx2.strokeStyle = "rgba(46,42,35,.35)"; ctx2.lineWidth = 1; ctx2.stroke(); }

  /* Boss 跑出取景框时，在屏幕边上画一个指向它的三角 */
  if(E.boss && !E.boss.dead){
    var bx = sx(E.boss.x), by = sy(E.boss.y);
    if(bx < 10 || bx > cw - 10 || by < 10 || by > ch - 10){
      var ang = Math.atan2(E.boss.y - me.y, E.boss.x - me.x);
      var mx = cw / 2 + Math.cos(ang) * (Math.min(cw, ch) / 2 - 26);
      var my = ch / 2 + Math.sin(ang) * (Math.min(cw, ch) / 2 - 26);
      ctx2.save(); ctx2.translate(mx, my); ctx2.rotate(ang);
      ctx2.fillStyle = "#8A3223"; ctx2.beginPath();
      ctx2.moveTo(11, 0); ctx2.lineTo(-7, 7); ctx2.lineTo(-7, -7); ctx2.closePath(); ctx2.fill();
      ctx2.restore();
    }
  }

  /* 主角。有护盾时外面套一圈会呼吸的蓝罩子 —— 血条上那一小段太容易看漏（用户 2026-09-22）。 */
  if(P.shield > 0){
    var sm = bstats().maxHp, lv = Math.min(1, P.shield / Math.max(1, sm));
    ctx2.strokeStyle = "#6E86A8";
    ctx2.globalAlpha = 0.30 + 0.22 * lv + 0.10 * Math.sin(P.time * 4);
    ctx2.lineWidth = 2 + 3 * lv;
    ctx2.beginPath(); ctx2.arc(sx(me.x), sy(me.y), 21 + 4 * lv, 0, 6.2832); ctx2.stroke();
    ctx2.globalAlpha = 1;
  }
  var him = IMG.hero;
  if(him && him.complete) ctx2.drawImage(him, sx(me.x) - 15, sy(me.y) - 17, 30, 30);

  /* 特效 */
  drawFx();
}
function drawImg(f, px, py, sz){
  var im = f.boss ? (f.rage ? IMG.bossRage : IMG.boss) : IMG[f.id];
  if(im && im.complete && im.naturalWidth) ctx2.drawImage(im, px - sz / 2, py - sz / 2, sz, sz);
  else { ctx2.fillStyle = f.col; ctx2.beginPath(); ctx2.arc(px, py, f.r, 0, 6.2832); ctx2.fill(); }
}
function drawBar(x, y, w, p){
  w = Math.max(18, w);
  ctx2.fillStyle = "rgba(46,42,35,.25)"; ctx2.fillRect(x - w / 2, y, w, 3);
  ctx2.fillStyle = "#A93729"; ctx2.fillRect(x - w / 2, y, w * Math.max(0, p), 3);
}

/* ---- 特效（全部纯装饰，REDUCE_MOTION 开着就整段跳过）---- */
function fxSwing(x, y, dir, range, arc){
  if(REDUCE_MOTION) return;
  E.fx.push({k:"sw", x:x, y:y, dir:dir, range:range, arc:arc, t:0, life:0.18});
}
function fxNum(x, y, n, crit){
  if(REDUCE_MOTION) return;
  E.fx.push({k:"n", x:x + ri(-6, 6), y:y, s:"" + n, crit:crit, t:0, life:crit ? 0.75 : 0.55});
  if(crit) E.fx.push({k:"cr", x:x, y:y + 8, t:0, life:0.26});
}
function fxText(s, col){ if(!REDUCE_MOTION) E.fx.push({k:"t", s:s, col:col, t:0, life:0.7}); }
function fxPop(x, y, col){ if(!REDUCE_MOTION) E.fx.push({k:"p", x:x, y:y, col:col, t:0, life:0.3}); }
function fxRing(x, y, r, col){ if(!REDUCE_MOTION) E.fx.push({k:"r", x:x, y:y, r:r, col:col, t:0, life:0.4}); }
function fxBolt(x1, y1, x2, y2){
  if(!REDUCE_MOTION) E.fx.push({k:"b", x:x1, y:y1, x2:x2, y2:y2, t:0, life:0.16});
}
function fxArc(x, y, dir, range, arc, col){
  if(!REDUCE_MOTION) E.fx.push({k:"a", x:x, y:y, dir:dir, range:range, arc:arc, col:col, t:0, life:0.3}); }
function drawFx(){
  for(var i = E.fx.length - 1; i >= 0; i--){
    var f = E.fx[i], k = 1 - f.t / f.life;
    ctx2.globalAlpha = Math.max(0, k);
    if(f.k === "sw"){
      var ha = f.arc * Math.PI / 360;
      ctx2.strokeStyle = "#FCF8F0"; ctx2.lineWidth = 7; ctx2.lineCap = "round";
      ctx2.beginPath(); ctx2.arc(sx(f.x), sy(f.y), f.range * 0.82, f.dir - ha, f.dir + ha); ctx2.stroke();
      ctx2.strokeStyle = "rgba(46,42,35,.35)"; ctx2.lineWidth = 2; ctx2.stroke();
    } else if(f.k === "n"){
      /* 暴击的数字要一眼认出来（用户 2026-09-22 要求优化）：
         更大、金色、带深色描边，前 1/3 段还会放大回弹。 */
      ctx2.textAlign = "center";
      var ny = sy(f.y) - f.t * (f.crit ? 58 : 40);
      if(f.crit){
        var pop = 1 + 0.55 * Math.max(0, 1 - f.t / (f.life * 0.33));
        ctx2.save(); ctx2.translate(sx(f.x), ny); ctx2.scale(pop, pop);
        ctx2.font = "bold 20px system-ui";
        ctx2.lineWidth = 4; ctx2.strokeStyle = "#5A3A06"; ctx2.lineJoin = "round";
        ctx2.strokeText(f.s, 0, 0);
        ctx2.fillStyle = "#F0C23C"; ctx2.fillText(f.s, 0, 0);
        ctx2.restore();
      } else {
        ctx2.fillStyle = "#2E2A23"; ctx2.font = "13px system-ui";
        ctx2.fillText(f.s, sx(f.x), ny);
      }
    } else if(f.k === "cr"){
      /* 暴击命中的金色冲击圈 */
      ctx2.strokeStyle = "#F0C23C"; ctx2.lineWidth = 3 + 4 * k;
      ctx2.beginPath(); ctx2.arc(sx(f.x), sy(f.y), 10 + (1 - k) * 34, 0, 6.2832); ctx2.stroke();
    } else if(f.k === "t"){
      ctx2.fillStyle = f.col; ctx2.font = "bold 18px system-ui"; ctx2.textAlign = "center";
      ctx2.fillText(f.s, cw / 2, ch * 0.62 - f.t * 30);
    } else if(f.k === "p"){
      ctx2.fillStyle = f.col; ctx2.beginPath();
      ctx2.arc(sx(f.x), sy(f.y), 6 + f.t * 40, 0, 6.2832); ctx2.fill();
    } else if(f.k === "r"){
      ctx2.strokeStyle = f.col; ctx2.lineWidth = 4;
      ctx2.beginPath(); ctx2.arc(sx(f.x), sy(f.y), f.r * (0.6 + k * 0.5), 0, 6.2832); ctx2.stroke();
    } else if(f.k === "b"){
      ctx2.strokeStyle = "#7FA8D8"; ctx2.lineWidth = 3; ctx2.lineCap = "round";
      ctx2.beginPath(); ctx2.moveTo(sx(f.x), sy(f.y));
      var mx2 = (f.x + f.x2) / 2 + ri(-14, 14), my2 = (f.y + f.y2) / 2 + ri(-14, 14);
      ctx2.lineTo(sx(mx2), sy(my2)); ctx2.lineTo(sx(f.x2), sy(f.y2)); ctx2.stroke();
    } else if(f.k === "a"){
      var ha2 = f.arc * Math.PI / 360;
      ctx2.fillStyle = f.col; ctx2.beginPath(); ctx2.moveTo(sx(f.x), sy(f.y));
      ctx2.arc(sx(f.x), sy(f.y), f.range, f.dir - ha2, f.dir + ha2); ctx2.closePath(); ctx2.fill();
    }
    ctx2.globalAlpha = 1;
  }
  for(var j = E.fx.length - 1; j >= 0; j--) if(E.fx[j].t >= E.fx[j].life) E.fx.splice(j, 1);
}

/* ================================================================
   输入：虚拟摇杆（触屏）+ WASD / 方向键（桌面）
   ================================================================ */
var IN = {x:0, y:0, on:false, id:-1, ox:0, oy:0};
var KEY = {};
function inputVec(){
  if(IN.on) return {x:IN.x, y:IN.y};
  var x = (KEY.d || KEY.ArrowRight ? 1 : 0) - (KEY.a || KEY.ArrowLeft ? 1 : 0);
  var y = (KEY.s || KEY.ArrowDown ? 1 : 0) - (KEY.w || KEY.ArrowUp ? 1 : 0);
  var m = Math.hypot(x, y); if(m > 1){ x /= m; y /= m; }
  return {x:x, y:y};
}
function bindInput(){
  var el = $("cv"), st = $("stick"), nub = $("stickNub");
  el.addEventListener("pointerdown", function(e){
    /* ⚠️ **必须 preventDefault**（用户 2026-09-22 报：弹窗关掉之后第一次按屏幕会弹出放大镜）。
       手机浏览器把 canvas 上的按下拖动当成"选文字"，于是弹出选择放大镜。
       光靠 CSS 的 user-select 挡不住，还得把这一下的默认行为吃掉。
       ⚠️ 别挪到 return 后面 —— 暂停时按下去也一样会弹放大镜。 */
    e.preventDefault();
    if(PAUSED || OVER) return;
    IN.on = true; IN.id = e.pointerId; IN.ox = e.clientX; IN.oy = e.clientY; IN.x = 0; IN.y = 0;
    st.hidden = false; st.style.left = IN.ox + "px"; st.style.top = IN.oy + "px";
    nub.style.transform = "translate(0,0)";
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener("pointermove", function(e){
    if(!IN.on || e.pointerId !== IN.id) return;
    var dx = e.clientX - IN.ox, dy = e.clientY - IN.oy, d = Math.hypot(dx, dy);
    if(d < 12){ IN.x = 0; IN.y = 0; nub.style.transform = "translate(0,0)"; return; }
    var k = Math.min(1, (d - 12) / 28);
    IN.x = dx / d * k; IN.y = dy / d * k;
    var cl = Math.min(d, 40);
    nub.style.transform = "translate(" + (dx / d * cl) + "px," + (dy / d * cl) + "px)";
  });
  function up(e){ if(e.pointerId !== IN.id) return; IN.on = false; IN.x = 0; IN.y = 0; st.hidden = true; }
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  /* 放大镜的另外三条口子：选中、长按菜单、拖拽。
     ⚠️ 输入框（现在没有，以后可能加）要放行，别把打字也挡了。 */
  function isInput(t){ return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA"); }
  document.addEventListener("selectstart", function(e){ if(!isInput(e.target)) e.preventDefault(); });
  document.addEventListener("contextmenu", function(e){ if(!isInput(e.target)) e.preventDefault(); });
  document.addEventListener("dragstart", function(e){ e.preventDefault(); });
  addEventListener("keydown", function(e){ KEY[e.key] = 1; if(e.key === " ") e.preventDefault(); });
  addEventListener("keyup",   function(e){ KEY[e.key] = 0; });
}

/* ================================================================
   主循环
   ================================================================ */
var last = 0, rafOn = false;
function frame(ts){
  requestAnimationFrame(frame);
  var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
  if(!PAUSED && !OVER && P) step(dt);
  if(P) draw();
  if(P) renderHud();
}
function step(dt){
  var me = E.me, s = bstats();
  P.time += dt; G.t += dt;

  /* 移动 */
  var v = inputVec(), sp = s.spd;
  if(me.slowT > 0){ me.slowT -= dt; sp *= (1 - me.slowPct); }
  var mag = Math.hypot(v.x, v.y);
  me.moving = mag;
  if(mag > 0.05){
    me.x += v.x * sp * dt; me.y += v.y * sp * dt;
    me.dir = Math.atan2(v.y, v.x);
    me.moveT = (me.moveT || 0) + dt;
  } else me.moveT = 0;

  /* 挥刀 */
  me.swingCd -= dt;
  if(me.swingCd <= 0){ me.swingCd += 1 / s.aspd; swing(); }

  /* 二段：补的那一刀 */
  if(me.second > 0){ me.second -= dt; if(me.second <= 0) swing(0.7); }
  spawnTick(dt); updateFoes(dt); updateShots(dt); updateDrops(dt); updateSites(dt);
  updateSpecial(dt, s);
  for(var i = 0; i < E.fx.length; i++) E.fx[i].t += dt;
  CAM.x = me.x; CAM.y = me.y;                      // 相机永远居中，不夹边界

  maybeFullBag();
  if(G.bossDown){ G.bossDown = false; nextWave(); openSpecialPick(); return; }
  if(!isBossWave(P.wave) && G.t >= BF.waveSec) nextWave();
}
/* 特殊遗物里那几个「一直在跑」的：悬刃 / 践踏 / 荆棘 / 漩涡 / 狂暴的计时 */
function updateSpecial(dt, s){
  var me = E.me, i, f;
  if(P.rageT > 0){ P.rageT -= dt; if(P.rageT <= 0) P.rageN = 0; }

  /* 悬刃：两把刀绕着你转 */
  if(hasSp("sp_orbit")){
    P.orbA += dt * 2.6; P.orbCd -= dt;
    if(P.orbCd <= 0){
      P.orbCd = 0.4;
      for(var k = 0; k < 2; k++){
        var a = P.orbA + k * Math.PI;
        aoe(me.x + Math.cos(a) * SP_ORBIT_R, me.y + Math.sin(a) * SP_ORBIT_R, 26,
            Math.max(1, Math.round(s.atk * 0.6)));
      }
    }
  }
  /* 践踏：只在移动时 */
  if(hasSp("sp_trample") && me.moving > 0.05){
    P.trampCd -= dt;
    if(P.trampCd <= 0){ P.trampCd = 0.3; aoe(me.x, me.y, 45, Math.max(1, Math.round(s.atk * 0.35))); }
  }
  /* 荆棘：站着也在杀 */
  if(hasSp("sp_thorn")){
    P.thornCd -= dt;
    if(P.thornCd <= 0){ P.thornCd = 1; aoe(me.x, me.y, 130, Math.max(1, Math.round(s.atk * 0.5)), "#47702F"); }
  }
  /* 漩涡：把周围的拽过来 */
  if(hasSp("sp_vortex")){
    P.vortexCd -= dt;
    if(P.vortexCd <= 0){
      P.vortexCd = 3; fxRing(me.x, me.y, 400, "#266F7B");
      for(i = 0; i < E.foes.length; i++){
        f = E.foes[i]; if(f.dead) continue;
        var dx = me.x - f.x, dy = me.y - f.y, d = Math.hypot(dx, dy);
        if(d > 400 || d < 40) continue;
        var pull = Math.min(140, d - 30);
        f.x += dx / d * pull; f.y += dy / d * pull;
      }
    }
  }
  /* 冲击波（破空）：穿透，同一只只打一次 */
  for(i = E.pwaves.length - 1; i >= 0; i--){
    var w = E.pwaves[i];
    w.x += w.vx * dt; w.y += w.vy * dt; w.life -= dt;
    if(w.life <= 0){ E.pwaves.splice(i, 1); continue; }
    for(var j = 0; j < E.foes.length; j++){
      f = E.foes[j];
      if(f.dead || w.hit[j]) continue;
      if(Math.hypot(f.x - w.x, f.y - w.y) > w.r + f.r) continue;
      w.hit[j] = 1;
      var d2 = Math.max(1, Math.round(s.atk * w.mult) - f.armor);
      f.hp -= d2; f.flash = 0.12;
      fxNum(f.x, f.y - f.r - 4, d2, false);
      if(f.hp <= 0) killFoe(f);
    }
  }
}

function nextWave(){
  var w = P.wave + 1;
  P.wrong2 = P.wrong1; P.wrong1 = G.wrongN; P.brokeLast = G.broke;   // 循迹 / 惜盾看的是上一波
  if(!G.siteN) pitySite();                                           // 这一波一个互动点都没掉 → 补一个
  /* 商摊只留 life 波就收（用户 2026-09-22）。泉和箱不过期 —— 泉是补给点，箱是一次性的。 */
  for(var q = E.sites.length - 1; q >= 0; q--){
    var t = E.sites[q];
    if(t.kind === "shop" && w - t.bornWave >= BF.site.shop.life) E.sites.splice(q, 1);
  }
  /* 箱的次数每 every 波重置一轮 */
  var cyc = Math.floor((w - 1) / BF.site.chest.every);
  if(cyc !== P.chestCycle){ P.chestCycle = cyc; P.chestN = 0; }
  newWave(w);
  if(isBossWave(w)) startBoss(w);
}
function startBoss(w){
  E.foes.length = 0; E.shots.length = 0;
  E.boss = makeBoss(w); E.foes.push(E.boss); P.bossSeen++;
  fxText(E.boss.name, "#8A3223");
}
function onBossDown(b){
  E.boss = null; G.bossDown = true; pendSpecial++;
  for(var i = 0; i < E.foes.length; i++){ var f = E.foes[i]; if(!f.dead && f !== b) killFoe(f); }
  E.shots.length = 0;
}

/* ================================================================
   顶栏
   ================================================================ */
function renderHud(){
  var s = bstats();
  $("hWave").textContent = "第 " + P.wave + " 波" + (isBossWave(P.wave) ? " ·  BOSS" : "");
  $("hTime").textContent = isBossWave(P.wave) ? "杀光它" : Math.max(0, Math.ceil(BF.waveSec - G.t)) + "";
  $("hLvl").textContent  = "Lv " + P.lvl;
  $("hGold").textContent = P.gold;
  $("hKill").textContent = P.kills;
  $("xpFill").style.width = Math.min(100, P.xp / xpNeed() * 100) + "%";
  var hp = Math.max(0, P.hp);
  $("hpFill").style.width = (hp / s.maxHp * 100) + "%";
  $("shFill").style.width = Math.min(100, P.shield / s.maxHp * 100) + "%";
  /* 护盾涨了闪一下（用户 2026-09-22 要求优化显示）。跟地牢的 paintHp 一个套路：
     上一次的数记在元素自己的 data 上，不用去每个改护盾的地方挂钩子。 */
  var hb = $("hpFill").parentNode, was = +(hb.dataset.sh || 0), now = Math.round(P.shield);
  if(now > was && !REDUCE_MOTION){
    hb.classList.remove("shup"); void hb.offsetWidth; hb.classList.add("shup");
  }
  hb.dataset.sh = now;
  $("hpTxt").textContent = Math.ceil(hp) + " / " + s.maxHp + (P.shield > 0 ? "  +" + Math.round(P.shield) : "");
  /* 遗物快满了（还剩 1 格）就在「遗物」按钮上挂个红点 —— 再捡就要弹取舍窗了（用户 2026-09-22）*/
  $("btnBag").classList.toggle("warn", P.relics.length >= relicCap() - 1);
  var bb = $("bossBar");
  if(E.boss && !E.boss.dead){
    bb.hidden = false;
    $("bossFill").style.width = Math.max(0, E.boss.hp / E.boss.maxHp * 100) + "%";
    $("bossName").textContent = E.boss.name + (E.boss.rage ? " · 狂暴" : "");
  } else bb.hidden = true;
}

/* ================================================================
   弹层与遗物界面
   ================================================================ */
function anyVeil(){ return !!document.querySelector(".veil.on"); }
function show(id){ $(id).classList.add("on"); PAUSED = true; }
function hide(id){
  $(id).classList.remove("on");
  clearSel();                       // ⚠️ 弹层里全是字，关掉时残留的选区会把下一次触摸变成放大镜
  PAUSED = anyVeil() || OVER;
}
function clearSel(){
  try{ var s = window.getSelection && window.getSelection(); if(s && s.removeAllRanges) s.removeAllRanges(); }catch(e){}
}

function cardHtml(r, extra, cls){
  return '<button class="card r' + r.r + (cls ? " " + cls : "") + '" data-id="' + r.id + '">' +
         (extra || "") +
         '<div class="cr">' + RAR_CN[r.r] + '</div>' +
         '<div class="cn">' + r.n + '</div>' +
         '<div class="cp">' + bfWord(r) + '</div>' +
         '<div class="cl">' + r.lore + '</div></button>';
}
function fillCards(box, list, extraFn, clsFn){
  var h = "", i;
  for(i = 0; i < list.length; i++)
    h += cardHtml(list[i], extraFn ? extraFn(list[i]) : "", clsFn ? clsFn(list[i]) : "");
  $(box).innerHTML = h;
}
function onCards(box, fn){
  $(box).addEventListener("click", function(e){
    var b = e.target.closest ? e.target.closest(".card") : null;
    if(b && b.dataset.id) fn(b.dataset.id, b);
  });
}

/* 掉率表：跟地牢那张同一个形状，横坐标换成波数 */
function rarityWeights(w){
  if(w <= 4)  return [87.5, 12.5, 0, 0, 0];
  if(w <= 8)  return [75, 25, 0, 0, 0];
  if(w <= 12) return [60, 35, 5, 0, 0];
  if(w <= 16) return [50, 40, 10, 0, 0];
  return [35, 45, 15, 5, 0];                    // 神圣恒为 0，只能靠合成和商店
}
function relicPool(rar){
  var out = [], i, r;
  for(i = 0; i < RELICS.length; i++){ r = RELICS[i];
    if(has(r.id)) continue;
    if(rar !== undefined && r.r !== rar) continue;
    out.push(r); }
  return out;
}
function rollRar(w){
  var ws = rarityWeights(w), t = 0, i;
  for(i = 0; i < 5; i++) t += ws[i];
  var x = Math.random() * t;
  for(i = 0; i < 5; i++){ x -= ws[i]; if(x <= 0) break; }
  var want = Math.min(4, i);
  if(has("omen") && want < 3 && luck(0.15)) want++;      // 吉兆：抬不到神圣
  return want;
}
function rollRelics(n, w){
  var out = [], tries = 0;
  while(out.length < n && tries++ < 200){
    var rar = rollRar(w), pool = relicPool(rar);
    while(!pool.length && rar > 0){ rar--; pool = relicPool(rar); }
    if(!pool.length) break;
    var r = pick(pool);
    if(out.indexOf(r) < 0) out.push(r);
  }
  return out;
}

/* ---- 升级四选一 ---- */
var pendPicks = 0, pickOffer = [], rerollLeft = 0;
/* ⚠️ 「换一批」是**每次升级重新给**的基础功能（BF.rerollN，遗物「集齐」再 +1），
   不是以前那种「每波一次」—— 别改回去。 */
function openPick(){
  if(pendPicks <= 0){ hide("veilPick"); return; }
  rerollLeft = BF.rerollN + (has("fullset") ? 1 : 0);
  rollPick();
}
function rollPick(){
  pickOffer = rollRelics(BF.pickN, P.wave);
  if(!pickOffer.length){ pendPicks = 0; hide("veilPick"); return; }
  $("pickTitle").textContent = "升到 " + P.lvl + " 级" + (pendPicks > 1 ? "（还有 " + (pendPicks - 1) + " 次）" : "");
  fillCards("pickList", pickOffer);
  /* ⚠️ 用完是**变灰**不是藏起来（用户 2026-09-22）—— 按钮突然消失会让下面的「都不要」跳位置。 */
  $("btnRedraw").hidden = false;
  $("btnRedraw").disabled = rerollLeft <= 0;
  $("btnRedraw").textContent = rerollLeft <= 0 ? "已经换过了"
                             : rerollLeft > 1 ? "换一批（还剩 " + rerollLeft + " 次）" : "换一批";
  show("veilPick");
}
function takePick(id){
  pendPicks--;
  hide("veilPick");
  grantRelic(id, function(){ openPick(); });
}

/* ---- 给遗物（带满了弹取舍窗，换下来的当场分解成金币）---- */
var swapNewId = null, swapAfter = null;
function grantRelic(id, after){
  if(!id){ if(after) after(); return; }
  if(P.relics.length < relicCap()){
    withMaxHp(function(){ P.relics.push(id); reindex(); });
    if(after) after();
    return;
  }
  swapNewId = id; swapAfter = after;
  fillCards("swapNew", [RMAP[id]], function(r){ return '<span class="cost">卖 ' + sellPrice(r) + ' 金</span>'; });
  fillCards("swapOld", P.relics.map(function(x){ return RMAP[x]; }),
            function(r){ return '<span class="cost">+' + sellPrice(r) + ' 金</span>'; });
  show("veilSwap");
}
function doSwap(oldId){
  var nid = swapNewId, after = swapAfter;
  swapNewId = null; swapAfter = null;
  withMaxHp(function(){
    if(oldId === null){ addGold(sellPrice(RMAP[nid])); }
    else {
      var i = P.relics.indexOf(oldId);
      if(i >= 0){ addGold(sellPrice(RMAP[oldId])); P.relics.splice(i, 1); }
      P.relics.push(nid); reindex();
    }
    reindex();
  });
  hide("veilSwap");
  if(after) after();
}
function sellPrice(r){ return RAR_SELL[r.r]; }
/* 生命上限涨了要补当前血；掉了要把当前血压回去（至少留 1 点）。
   ⚠️ 所有动 P.relics 的地方都必须从这儿过。 */
function withMaxHp(fn){
  var before = bstats().maxHp;
  fn();
  var after = bstats().maxHp, d = after - before;
  if(d > 0) P.hp += d;
  P.hp = Math.max(1, Math.min(P.hp, after));
}

/* ---- 遗物页 ---- */
/* 「信息」是从遗物页里拆出来的（用户 2026-09-22），单独一个按钮 */
function openInfo(){
  var s = bstats();
  $("infoSub").textContent = "第 " + P.wave + " 波 · " + TIER.name + " · 击杀 " + P.kills +
    " · 遗物 " + P.relics.length + " / " + relicCap() + " · 特殊 " + P.special.length;
  $("infoStats").innerHTML =
    st2("攻击", s.atk) + st2("生命", Math.ceil(P.hp) + " / " + s.maxHp) +
    st2("护甲", s.armor) + st2("减伤", s.cutStatic + "%") +
    st2("暴击", s.crit + "% ×" + s.critMult.toFixed(1)) + st2("移速", Math.round(s.spd)) +
    st2("攻速", s.aspd.toFixed(2) + " 刀/秒") + st2("刀程", Math.round(s.range)) +
    st2("张角", Math.round(s.arc) + "°") + st2("拾取", Math.round(s.pickup)) +
    st2("连击", P.combo + "（+" + comboPct(s) + "%）") + st2("护盾", Math.round(P.shield));
  show("veilInfo");
}
function openBag(){
  $("bagTitle").textContent = "遗物 " + P.relics.length + " / " + relicCap();
  fillCards("bagList", P.relics.map(function(x){ return RMAP[x]; }),
            function(r){
              if(fuseMode) return "";
              return r.id === sellArmed
                ? '<span class="cost">再点一下 · 分解 +' + sellPrice(r) + '</span>'
                : '<span class="cost">分解 +' + sellPrice(r) + '</span>';
            },
            function(r){
              if(fuseSel.indexOf(r.id) >= 0) return "sel";
              if(!fuseMode && r.id === sellArmed) return "sel";
              return fuseMode && r.r >= 4 ? "dim" : "";
            });
  renderFuse();
  show("veilBag");
}
function st2(k, v){ return '<div><span>' + k + '</span><b>' + v + '</b></div>'; }

/* 分解是**两步确认**的（第一下只是亮起来，第二下才真卖）——
   遗物卡上本来就写着「分解 +N」，点了没反应更糟；一步到位又太容易误触。 */
var sellArmed = null;
function sellRelic(id){
  if(sellArmed !== id){ sellArmed = id; openBag(); return; }
  sellArmed = null;
  withMaxHp(function(){
    var i = P.relics.indexOf(id);
    if(i >= 0){ addGold(sellPrice(RMAP[id])); P.relics.splice(i, 1); reindex(); }
  });
  openBag();
}

/* ---- 特殊遗物：Boss 掉落的三选一 / 列表页 ---- */
var pendSpecial = 0, spOffer = [];
function spPool(){
  var out = [];
  for(var i = 0; i < BF_SPECIAL.length; i++) if(!hasSp(BF_SPECIAL[i].id)) out.push(BF_SPECIAL[i]);
  return out;
}
function spCardHtml(d){
  return '<button class="card sp" data-id="' + d.id + '">' +
         '<div class="cr">特殊</div><div class="cn">' + d.n + '</div>' +
         '<div class="cp">' + d.pw + '</div>' +
         '<div class="cl">' + d.lore + '</div></button>';
}
function openSpecialPick(){
  if(pendSpecial <= 0) return;
  var pool = spPool();
  if(!pool.length){ pendSpecial = 0; return; }            // 18 件全拿齐了
  spOffer = []; var t = 0;
  while(spOffer.length < Math.min(SPECIAL_PICK, pool.length) && t++ < 100){
    var d = pick(pool); if(spOffer.indexOf(d) < 0) spOffer.push(d);
  }
  $("spPickList").innerHTML = spOffer.map(spCardHtml).join("");
  show("veilSpPick");
}
var spSwapNew = null;
function takeSpecial(id){
  if(!spDef(id) || hasSp(id)) return;
  pendSpecial--;
  hide("veilSpPick");
  if(P.special.length < BF.specialMax){
    withMaxHp(function(){ P.special.push(id); P.sset[id] = 1; });
    if(pendSpecial > 0) openSpecialPick();                // 一口气打死两只 Boss 的极端情况
    return;
  }
  /* 满 5 件了：弹取舍窗换一件（跟遗物带满时是同一个套路）*/
  spSwapNew = id;
  $("spSwapNew").innerHTML = spCardHtml(spDef(id));
  $("spSwapOld").innerHTML = P.special.map(function(x){ return spCardHtml(spDef(x)); }).join("");
  show("veilSpSwap");
}
function doSpSwap(oldId){
  var nid = spSwapNew; spSwapNew = null;
  hide("veilSpSwap");
  if(nid && oldId){
    withMaxHp(function(){
      var i = P.special.indexOf(oldId);
      if(i >= 0){ P.special.splice(i, 1); delete P.sset[oldId]; }
      P.special.push(nid); P.sset[nid] = 1;
    });
  }
  if(pendSpecial > 0) openSpecialPick();
}
function openSp(){
  $("spTitle").textContent = "特殊遗物 " + P.special.length + " / " + BF.specialMax;
  $("spList").innerHTML = P.special.length
    ? P.special.map(function(id){ return spCardHtml(spDef(id)); }).join("")
    : '<p class="sub">还没有。每打倒一只 Boss（每 10 波）就能三选一拿一件。</p>';
  show("veilSp");
}

/* ---- 合成（面板在遗物页上，随时能开）---- */
var fuseMode = false, fuseSel = [];
function fuseN(){ return has("recipe") ? 2 : FUSE_N; }
/* ⚠️ **战场模式的合成不要金币**（用户 2026-09-22）——
   金币现在只有游商一个去处。别把 FUSE_COST 加回来。
   「配方」还在（少一件材料），「祭余」在战场里是另一条词条（见 BFW）。 */
function fuseCost(){ return 0; }
function renderFuse(){
  $("fuseSub").textContent = fuseMode
    ? "在下面挑同品质的 " + fuseN() + " 件（神圣不能当材料）· 已选 " + fuseSel.length
    : fuseN() + " 件同品质 → 换一件高一档的，从 " + FUSE_PICK + " 件里挑（不要金币）";
  $("btnFuseMode").textContent = fuseMode ? "退出选择" : "选择材料";
  var ready = fuseSel.length === fuseN();
  $("btnFuseGo").disabled = !ready;
  $("btnFuseGo").textContent = "合成";
  /* 选满了就把「合成」点亮（用户 2026-09-22）—— 不然要低头数选了几件才知道能不能点 */
  $("btnFuseGo").classList.toggle("hot", ready);
}
function fuseGo(){
  if(fuseSel.length !== fuseN()) return;
  var rar = RMAP[fuseSel[0]].r;
  withMaxHp(function(){
    for(var i = 0; i < fuseSel.length; i++){
      var k = P.relics.indexOf(fuseSel[i]); if(k >= 0) P.relics.splice(k, 1); }
    reindex();
  });
  fuseSel = []; fuseMode = false;
  var want = Math.min(4, rar + 1), pool = relicPool(want);
  while(!pool.length && want > 0){ want--; pool = relicPool(want); }
  if(!pool.length){ openBag(); return; }
  var picks = [], t = 0;
  while(picks.length < Math.min(FUSE_PICK, pool.length) && t++ < 100){
    var r = pick(pool); if(picks.indexOf(r) < 0) picks.push(r); }
  if(picks.length === 1){ grantRelic(picks[0].id, openBag); return; }
  $("gotTitle").textContent = "合成出了 " + RAR_CN[want] + " · 挑一件";
  fillCards("gotList", picks);
  show("veilGot");                                  // ⚠️ 材料已经砸了，这个窗没有关闭钮
}

/* ================================================================
   击杀掉落的互动点：泉 / 箱 / 商（用户 2026-09-22）
   ⚠️ 「每 5 波一次的整备点」已经整块删了，别加回来 —— 补给现在全部从击杀里掉。
   ⚠️ 泉**不弹窗**（踩上去直接回血，跟捡金币一样不打断节奏），商和箱弹窗（要选）。
   ================================================================ */
function siteCount(){ return E.sites.length; }
function dropSite(kind, x, y){
  if(G) G.siteN = (G.siteN || 0) + 1;
  if(kind === "shop")  P.shopN++;
  if(kind === "chest") P.chestN++;
  E.sites.push({kind:kind, x:x, y:y, t:0, cool:0, bornWave:P.wave,
                stock:null, rerollsLeft:BF.shopReroll});
  /* 超上限就删离玩家最远的那个 —— 地图是无限的，跑远了的那个本来也回不去。
     ⚠️ **优先淘汰泉**：泉不消失、还一直掉，不这么挑的话场上很快全是泉，
        把玩家想回头去的商摊和箱子挤没了（实测 5 波掉 7 个泉，名额直接占满）。 */
  while(E.sites.length > BF.site.max){
    var far = -1, fd = -1, i, d;
    for(i = 0; i < E.sites.length; i++){
      if(E.sites[i].kind !== "spring") continue;
      d = Math.hypot(E.sites[i].x - E.me.x, E.sites[i].y - E.me.y);
      if(d > fd){ fd = d; far = i; }
    }
    if(far < 0){                                  // 一个泉都没有，再按最远删
      for(i = 0; i < E.sites.length; i++){
        d = Math.hypot(E.sites[i].x - E.me.x, E.sites[i].y - E.me.y);
        if(d > fd){ fd = d; far = i; }
      }
    }
    E.sites.splice(far, 1);
  }
}
/* 每次击杀掷一次。⚠️ 这不是遗物效果，所以用 Math.random() 不走 luck()。 */
/* 商的实际概率：每出现过一个就除以 decay，最多除到 decayMax */
function shopRate(){
  var c = BF.site.shop;
  return c.p / Math.min(c.decayMax, Math.pow(c.decay, P.shopN));
}
/* 箱这一轮（每 every 波一轮）还能不能掉 */
function chestLeft(){ return BF.site.chest.max - P.chestN; }

function maybeSite(f){
  var c = BF.site, r = Math.random();
  if(f.boss){                                   // Boss 必掉：泉 + 商（不吃递减，它是奖励）
    dropSite("spring", f.x - 40, f.y); dropSite("shop", f.x + 40, f.y); return;
  }
  if(f.elite && Math.random() < c.eliteRate){
    var opts = ["spring"];
    if(chestLeft() > 0) opts.push("chest");
    opts.push("shop");
    dropSite(pick(opts), f.x, f.y); return;
  }
  if(r < c.spring.p){ dropSite("spring", f.x, f.y); return; }
  r -= c.spring.p;
  if(chestLeft() > 0){
    if(r < c.chest.p){ dropSite("chest", f.x, f.y); return; }
  }
  r -= c.chest.p;
  if(r < shopRate()) dropSite("shop", f.x, f.y);
}
/* 每波保底：按 BF.site.pity 的权重挑一种，落在玩家边上 150~230px 处 */
function pitySite(){
  var w = BF.site.pity, tot = 0, k;
  for(k in w){ if(k === "chest" && chestLeft() <= 0) continue; tot += w[k]; }
  var r = Math.random() * tot, kind = "spring";
  for(k in w){
    if(k === "chest" && chestLeft() <= 0) continue;
    r -= w[k]; if(r <= 0){ kind = k; break; }
  }
  var a = Math.random() * Math.PI * 2, d = 150 + Math.random() * 80;
  dropSite(kind, E.me.x + Math.cos(a) * d, E.me.y + Math.sin(a) * d);
}
function updateSites(dt){
  var me = E.me;
  for(var i = E.sites.length - 1; i >= 0; i--){
    var t = E.sites[i]; t.t += dt;
    if(t.cool > 0){ t.cool -= dt; continue; }
    if(Math.hypot(me.x - t.x, me.y - t.y) > BF.site.r) continue;
    if(t.kind === "spring"){                    // 泉：不弹窗，踩上去就喝
      var s = bstats();
      if(P.hp >= s.maxHp) continue;             // 满血就留着，回头再来
      var got = healUp(s.maxHp * BF.site.spring.heal);
      fxText("+" + got, "#266F7B"); fxRing(t.x, t.y, 34, "#266F7B");
      E.sites.splice(i, 1);                     // 喝一次就没了
    } else if(t.kind === "shop"){ openShop(t); return; }
    else {                                    // 箱：踩上去直接白给一件（不花钱、不弹窗）
      var got = rollRelics(1, P.wave + 6)[0];
      E.sites.splice(i, 1);
      if(!got) continue;                      // 209 件全带齐了（理论上到不了）
      fxText(got.n, "#8A6A3A"); fxRing(t.x, t.y, 34, "#8A6A3A");
      grantRelic(got.id, null);               // 带满了 grantRelic 自己会弹取舍窗
      return;
    }
  }
}
/* 把人从这个点上推开一格 —— 不推的话站在原地下一拍就会再弹一次
   （跟地牢「说了再待一会儿要退开阶梯」是同一个坑）。 */
function stepOffSite(t){
  var a = Math.atan2(E.me.y - t.y, E.me.x - t.x);
  if(!isFinite(a) || (E.me.x === t.x && E.me.y === t.y)) a = Math.random() * Math.PI * 2;
  E.me.x = t.x + Math.cos(a) * (BF.site.r + 16);
  E.me.y = t.y + Math.sin(a) * (BF.site.r + 16);
}
/* 「走了 / 不开了」：**不删这个点**，只给它 SITE_COOL 秒的冷却。
   ⚠️ 别改回「关窗就删」—— 钱不够的时候玩家应该能去刷一波再回来。
   冷却是为了防止在旁边绕圈时弹窗刷屏。 */
var SITE_COOL = 5;
function leaveSite(t){ t.cool = SITE_COOL; stepOffSite(t); }
/* 真的消耗掉了（箱子拿走了东西）才删 */
function closeSite(t){
  var i = E.sites.indexOf(t); if(i >= 0) E.sites.splice(i, 1);
  stepOffSite(t);
}

/* ---- 游商 ---- */
var curShop = null;
function shopMarkup(r){ return (r.r >= 2 ? 1.3 * 1.8 : 1.3); }
function shopPrice(row){ return Math.ceil(row.price * (has("regular") ? 0.85 : 1)); }
function rollShopStock(){
  var n = BF.site.shop.n + (has("key") ? 1 : 0);
  return rollRelics(n, P.wave + 4).map(function(r){
    return {id:r.id, price: Math.ceil(sellPrice(r) * shopMarkup(r)), sold:false};
  });
}
function openShop(t){
  curShop = t;
  if(!t.stock){ t.stock = rollShopStock(); t.rerollsLeft = BF.shopReroll + (has("key") ? 1 : 0); }
  renderShop(); show("veilShop");
}
function renderShop(){
  var t = curShop; if(!t) return;
  $("shopSub").textContent = "金币 " + P.gold;
  var h = "", i;
  for(i = 0; i < t.stock.length; i++){
    var row = t.stock[i], r = RMAP[row.id];
    h += cardHtml(r, '<span class="cost">' + shopPrice(row) + ' 金</span>',
                  row.sold || P.gold < shopPrice(row) ? "dim" : "");
  }
  $("shopList").innerHTML = h || '<p class="sub">货架空了。</p>';
  $("btnShopRe").textContent = "刷新货架" + (t.rerollsLeft > 0 ? "（还剩 " + t.rerollsLeft + " 次）" : "（没了）");
  $("btnShopRe").disabled = t.rerollsLeft <= 0;
}
function buyShop(id){
  var t = curShop; if(!t) return;
  var row = null, i;
  for(i = 0; i < t.stock.length; i++) if(t.stock[i].id === id && !t.stock[i].sold) row = t.stock[i];
  if(!row || P.gold < shopPrice(row)) return;
  P.gold -= shopPrice(row); P.spent += shopPrice(row); P.bought++; P.everBought = true;
  row.sold = true;
  grantRelic(id, renderShop);
}

/* ⚠️ 石箱原来是「花钱撬开 → 两件挑一件」的弹层，用户 2026-09-22 改成
   **踩上去直接白给一件、不要金币、不弹窗**（逻辑就在 updateSites 里那几行）。
   veilChest 那一整套已经删干净了，别加回来。 */

/* ================================================================
   存档与结算
   ⚠️ 这一轮**不发宝石、不碰续玩档** —— 宝石要等局外养成定了口径再接，
      现在两套代码写同一个 youxu.town.v1 是白白冒险。
   ================================================================ */
var BF_KEY = "youxu.bf.v1";
function bfMeta(){ return load(BF_KEY, {best:0, kills:0, runs:0}); }
function bfSave(m){ if(!save(BF_KEY, m) && window.showErr) showErr("存档写不进去"); }

function endRun(){
  if(OVER) return;
  OVER = true; PAUSED = true;
  var m = bfMeta();
  m.best = Math.max(m.best || 0, P.wave);
  m.kills = (m.kills || 0) + P.kills;
  m.runs = (m.runs || 0) + 1;
  bfSave(m);
  $("endTitle").textContent = "倒在第 " + P.wave + " 波";
  $("endStats").innerHTML =
    st2("到达波数", P.wave) + st2("历史最深", m.best) +
    st2("击杀", P.kills) + st2("等级", P.lvl) +
    st2("存活", Math.floor(P.time / 60) + " 分 " + Math.floor(P.time % 60) + " 秒") +
    st2("最大连击", P.maxCombo) +
    st2("遗物", P.relics.length) + st2("特殊遗物", P.special.length);
  $("endRelics").innerHTML =
    P.special.map(function(id){ return spCardHtml(spDef(id)); }).join("") +
    P.relics.map(function(x){ return cardHtml(RMAP[x]); }).join("");
  document.querySelectorAll(".veil.on").forEach(function(v){ v.classList.remove("on"); });
  show("veilEnd");
}

/* ================================================================
   开场：难度层
   ================================================================ */
function renderTiers(){
  var h = "", i, m = bfMeta();
  for(i = 0; i < BF_TIERS.length; i++){
    var t = BF_TIERS[i];
    h += '<button class="tier' + (t === TIER ? " on" : "") + '"' + (t.locked ? " disabled" : "") +
         ' data-i="' + i + '"><b>' + t.name + '</b>' +
         '<p>' + (t.locked ? "局外养成解锁" : t.desc) +
         '（怪血 ×' + t.hp.toFixed(2) + ' · 伤害 ×' + t.dmg.toFixed(2) +
         ' · 密度 ×' + t.rate.toFixed(2) + '）</p></button>';
  }
  $("tierList").innerHTML = h;
  $("veilStart").querySelector(".sub").textContent =
    "走位躲怪，刀会自己挥。每升一级从四件遗物里挑一件。轮数没有尽头。" +
    (m.best ? "　历史最深：第 " + m.best + " 波。" : "");
}

/* ================================================================
   启动
   ================================================================ */
function boot(){
  window.showErr = function(msg){ var b = $("errbar"); b.hidden = false; b.textContent = msg; };
  window.addEventListener("error", function(e){ showErr("出错了：" + (e.message || e)); });

  buildArt(); resize(); bindInput();
  addEventListener("resize", resize);

  renderTiers();
  $("tierList").addEventListener("click", function(e){
    var b = e.target.closest ? e.target.closest(".tier") : null;
    if(!b || b.disabled) return;
    TIER = BF_TIERS[+b.dataset.i]; renderTiers();
  });
  $("btnGo").addEventListener("click", function(){
    newRun(); pendPicks = 0; pendSpecial = 0;
    $("veilStart").classList.remove("on"); PAUSED = false; last = 0;
  });

  onCards("pickList", function(id){ takePick(id); });
  $("btnSkipPick").addEventListener("click", function(){ pendPicks--; hide("veilPick"); openPick(); });
  $("btnRedraw").addEventListener("click", function(){
    if(rerollLeft <= 0) return;
    rerollLeft--; rollPick();
  });

  onCards("swapNew", function(){ doSwap(null); });
  onCards("swapOld", function(id){ doSwap(id); });

  /* ---- 信息 / 特殊遗物 ---- */
  $("btnInfo").addEventListener("click", openInfo);
  $("btnInfoClose").addEventListener("click", function(){ hide("veilInfo"); });
  $("btnSp").addEventListener("click", openSp);
  $("btnSpClose").addEventListener("click", function(){ hide("veilSp"); });
  onCards("spPickList", function(id){ takeSpecial(id); });
  onCards("spSwapOld", function(id){ doSpSwap(id); });
  $("btnSpSwapSkip").addEventListener("click", function(){ doSpSwap(null); });

  /* ---- 遗物页（合成面板在这儿）---- */
  $("btnBag").addEventListener("click", function(){ fuseMode = false; fuseSel = []; sellArmed = null; openBag(); });
  $("btnBagClose").addEventListener("click", function(){ fuseMode = false; fuseSel = []; sellArmed = null; hide("veilBag"); });
  $("btnFuseMode").addEventListener("click", function(){ fuseMode = !fuseMode; fuseSel = []; sellArmed = null; openBag(); });
  $("btnFuseGo").addEventListener("click", fuseGo);
  onCards("bagList", function(id){
    if(!fuseMode){ sellRelic(id); return; }                 // 不在挑材料时，点卡片 = 分解（两步确认）
    var r = RMAP[id];
    if(r.r >= 4) return;                                    // 神圣不能当材料
    var k = fuseSel.indexOf(id);
    if(k >= 0) fuseSel.splice(k, 1);
    else {
      if(fuseSel.length && RMAP[fuseSel[0]].r !== r.r) fuseSel = [];
      if(fuseSel.length < fuseN()) fuseSel.push(id);
    }
    openBag();
  });
  onCards("gotList", function(id){ hide("veilGot"); grantRelic(id, openBag); });

  $("btnPause").addEventListener("click", function(){ show("veilPause"); });
  $("btnResume").addEventListener("click", function(){ hide("veilPause"); });
  $("btnQuit").addEventListener("click", function(){ hide("veilPause"); endRun(); });

  /* ---- 游商 ---- */
  onCards("shopList", buyShop);
  $("btnShopRe").addEventListener("click", function(){
    var t = curShop; if(!t || t.rerollsLeft <= 0) return;
    t.rerollsLeft--; t.stock = rollShopStock(); renderShop();
  });
  $("btnShopClose").addEventListener("click", function(){
    if(curShop) leaveSite(curShop);                          // 摊子留着，回头攒够钱还能来
    curShop = null; hide("veilShop");
  });

  $("btnAgain").addEventListener("click", function(){
    $("veilEnd").classList.remove("on"); OVER = false;
    newRun(); pendPicks = 0; pendSpecial = 0; PAUSED = false; last = 0;
  });

  show("veilStart");
  requestAnimationFrame(frame);
}
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
