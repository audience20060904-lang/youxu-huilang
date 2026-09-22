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
  /* 每升一级给多少（用户 2026-09-22：**升级获得的数值提升 50%**，6/1 → 9/1.5）。
     ⚠️ atk 是小数，`bstats()` 末尾统一 round 一次 —— 别在这儿先取整。 */
  perLevel: {maxHp:9, atk:1.5},
  levelHealPct: 0.08,
  /* **每升几级才给一次遗物四选一**（用户 2026-09-22 从 1 改成 2）。
     ⚠️ 升级本身照旧一级一算（面板、onLevelRelics 都按级走），只有「挑遗物」这一下按这个数攒。 */
  pickEvery: 2,

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
  /* 升级所需经验。用户 2026-09-22 先 ×2（「升级难度增加 100%」），
     同一天又 **+80%** —— 所以整条曲线现在是原始值的 **×3.6**（1→2 要 29，9→10 要 202）。
     ⚠️ 别去砍怪的 xp 来达到同样效果 —— 那会连带把金币和 Boss 的经验补偿也拖下水。 */
  xpNeed: function(lv){ return Math.ceil((8 + 6 * (lv - 1)) * 3.6); },
  /* 怪掉的金币统一乘这个（用户 2026-09-22：**金币爆率 −50%**）。
     Boss 掉的那一笔也吃，别单独开小灶。 */
  goldMult: 0.5,
  specialMax: 5,        // 特殊遗物最多带几件（用户 2026-09-22）；满了再拿要换掉一件
  spawnPad: 60,         // 在相机外这么远的一圈上刷怪
  shieldSeedScale: 1,   // 护盾类种子的统一缩放（留给调平衡）

  /* ===== 石箱（击杀掉落）=====
     ⚠️ **泉和商已经不在这儿了**（用户 2026-09-22 的塔防改版）：它们现在是
        玩家在**部署阶段**摆下去的**建筑**，永久存在（见 BF.deploy 和 BF_BUILDS）。
        **别把 spring / shop 加回这张表。** 箱子照旧从击杀里掉。 */
  site: {
    /* 箱：踩上去直接白给一件，不花钱不弹窗。每 every 波最多掉 max 个。
       ⚠️ **p 2026-09-22 减半**（用户：「宝箱出现概率减半」），0.020 → 0.010。
          每波保底那一个还在（pitySite），所以「一整波一个箱都没有」仍然不会发生。 */
    chest: {p:0.010, max:3, every:5},
    eliteRate: 0.25,                        // 精英倒下时额外掷一次
    max: 8,                                 // 场上最多几个
    r: 22                                   // 踩上去的判定半径
  },

  /* ===== 部署阶段（用户 2026-09-22 的塔防改版）=====
     开局一次，之后每 every 波一次。规则照云顶之弈：
     金币 → 升级（等级 = 人口 = 场上最多几座塔）/ 刷新商店 / 买塔，三张同名合成高一星。
     ⚠️ 泉、商、城墙**不占人口**（用户定的）。 */
  deploy: {
    every: 5,           // 每几波一次（开局那一次是第 1 轮）
    startGold: 60,      // 开局白给的一笔钱（用户：「玩家初始可以得到一笔钱」）
    incomeBase: 35,     // 每轮部署的固定收入
    incomePer: 15,      // 每多一轮再加这么多
    /* ⚠️ **利息已经取消了**（用户 2026-09-22）—— 云顶那套「攒钱生钱」在这儿只会让人
       第一轮什么都不买。别把 interestPer / interestMax 加回来。
       塔和升级的价格同一天 ×5 之后，**买塔的钱主要来自击杀**，固定收入只是个底。 */
    bench: 9,           // 备战区几格 —— 用户说的「九个卡槽」
    lvlMax: 9,          // 等级上限 = 人口上限 = 场上最多几座塔
    shopN: 5,           // 商店几个货位
    rerollCost: 6,
    /* ⚠️ 泉 / 商**各只有一个**（用户 2026-09-22 从 4 改的）：开局那次部署白给一张泉 + 一张商，
       之后 giveBuildCard() 查到已经有了就不再发。别改回攒一堆。 */
    buildMax: 1,
    placeR: 320,        // 只能摆在离自己这么远之内（部署阶段能缩放和平移，所以比原来大一圈）
                        // ⚠️ 这个数要跟「面板上方还看得见多大一块」对得上（390×667 上量过），
                        //    改面板高度就得回来改它，不然圈画出来了却摆不进视野。
    gap: 34             // 两座建筑最近隔多远 —— 用户：**不能重叠**
  },
    /* ⚠️ **城墙 2026-09-22 已经整块删了**（用户要求）。于是**所有建筑都没有血量**，
     怪根本不会去理它们，走位和塔的射程才是全部的防守。别把 BF.wall 加回来。 */
  springHeal: 0.25,        // 泉每波回多少（占最大生命）
  relicShopN: 5            // 游商建筑的货位（遗物「钥匙」再 +2）
};
/* 升到第 N 级要花多少（**下标 = 目标等级**，所以这张表必须有第 9 项）。
   1 级白送，一路升到 9 级一共 **2000 金**。
   ⚠️ **2026-09-22 用户把升级和塔的价格一起 ×5**，同时取消了利息 ——
      于是「买得起几座塔」直接由**杀了多少怪**决定，固定收入只是个底。
   ⚠️ 少写一项就会在升 9 级那一下把 P.gold 变成 NaN（踩过）—— 改上限记得跟着补。 */
var DLVL_COST = [0, 0, 40, 70, 110, 160, 230, 320, 450, 620];

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
          elite:true, noKnock:true, scale:1.4},

 /* ===== 11–19 波的新怪（用户 2026-09-22）=====
    ⚠️ 照旧**一张新图都没画**：全部复用 MOB_ART 里现成的那 11 张，
       靠**颜色 + 体型 + 行为**区分。加新怪时也照这个来。
    ⚠️ 这一批的设计口径是「**1–10 波考走位，11–19 波考取舍**」——
       每一只都逼玩家先决定**先打谁**，而不是无脑贴着怪群转圈：
       拒马给别人减伤、缝合者给别人回血、缚锁者封你的塔、裂壳虫越打越多。 */
 swarm:  {name:"蚀影群",   art:"ghost",   col:"#3F5E7E", hp:22, dmg:9,  spd:142, armor:0, xp:7,  r:9,  kind:"melee",
          phase:true, wob:14, scale:0.72},
 splitter:{name:"裂壳虫",  art:"slime",   col:"#7A6A3A", hp:70, dmg:11, spd:56,  armor:1, xp:14, r:17, kind:"melee",
          split:{id:"shard", n:2}},
 shard:  {name:"碎壳",     art:"slime",   col:"#A2925E", hp:22, dmg:8,  spd:92,  armor:0, xp:4,  r:10, kind:"melee",
          scale:0.6},
 mender: {name:"缝合者",   art:"prism",   col:"#3E7A5E", hp:56, dmg:6,  spd:66,  armor:1, xp:18, r:13, kind:"ranged",
          heal:{cd:2.6, r:210, pct:0.15, keep:300}},
 bulwark:{name:"拒马",     art:"statue",  col:"#59636F", hp:130,dmg:16, spd:30,  armor:6, xp:24, r:19, kind:"melee",
          guard:{r:150, cut:0.25}},
 warder: {name:"缚锁者",   art:"gate",    col:"#6B4A8A", hp:90, dmg:13, spd:58,  armor:2, xp:22, r:14, kind:"melee",
          silence:{cd:5, r:300, sec:3}},
 bomber: {name:"爆囊",     art:"dread",   col:"#A8502A", hp:48, dmg:9,  spd:88,  armor:0, xp:16, r:14, kind:"melee",
          boom:{at:76, warn:1.0, r:100, dmg:28}},
 siege:  {name:"攻城眼",   art:"clock",   col:"#7A5A8A", hp:110,dmg:11, spd:40,  armor:2, xp:26, r:16, kind:"ranged",
          shot:{cd:4.0, keep:320, speed:150, r:13, n:1, spread:0, warn:0.8}},
 gate2:  {name:"深廊守者", art:"gate",    col:"#C2510E", hp:280,dmg:24, spd:70,  armor:5, xp:90, r:22, kind:"melee",
          elite:true, noKnock:true, scale:1.6}
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
 {pool:{rat:10, slime:10, spider:12, bone:12, ghost:14, prism:12, statue:10, clock:10, warden2:10}, fix:{gate:2}},
 /* ⚠️ **下标 = 波数 − 1**，所以第 10 行（Boss 波）必须占个位 —— 它永远读不到，
    但少了它第 11 波往后全会错一格。别删。 */
 {pool:{rat:1}},                                                                      /* 10：Boss 波，占位 */
 /* ---- 11–19 波（用户 2026-09-22）。每一波只加一种新怪，跟 1–10 波同一个节奏。 ---- */
 {pool:{rat:8, slime:8, spider:10, bone:12, ghost:12, prism:12, statue:10, clock:10, warden2:10, dread:8,
        swarm:16}, fix:{gate:2}},
 {pool:{slime:8, spider:10, bone:10, ghost:12, prism:10, statue:10, clock:10, warden2:10, dread:8,
        swarm:14, splitter:14}, fix:{gate:2}},
 {pool:{spider:8, bone:10, ghost:12, prism:10, statue:8, clock:10, warden2:10, dread:8,
        swarm:12, splitter:12, mender:10}, fix:{gate:2}},
 {pool:{spider:8, bone:8, ghost:10, prism:10, statue:8, clock:8, warden2:10, dread:8,
        swarm:12, splitter:12, mender:8, bulwark:10}, fix:{gate:2}},
 {pool:{bone:8, ghost:10, prism:8, statue:8, clock:8, warden2:10, dread:8,
        swarm:12, splitter:12, mender:8, bulwark:10, warder:10}, fix:{gate:1, gate2:1}},
 {pool:{bone:8, ghost:10, prism:8, statue:8, clock:8, warden2:8, dread:8,
        swarm:10, splitter:10, mender:8, bulwark:10, warder:10, bomber:12}, fix:{gate:1, gate2:1}},
 {pool:{ghost:8, prism:8, statue:8, clock:8, warden2:8, dread:8,
        swarm:10, splitter:10, mender:8, bulwark:10, warder:10, bomber:12}, fix:{gate2:2}},
 {pool:{ghost:8, prism:6, statue:8, clock:6, warden2:8, dread:6,
        swarm:10, splitter:10, mender:8, bulwark:10, warder:10, bomber:12, siege:10}, fix:{gate2:2}},
 {pool:{ghost:8, statue:8, warden2:8, dread:6,
        swarm:10, splitter:12, mender:8, bulwark:12, warder:12, bomber:14, siege:12}, fix:{gate:2, gate2:2}}
];

/* ===== Boss（设计文档 4.3）=====
   数值写死、不吃波次倍率（跟地牢的章末 Boss fixed:true 一个规矩），但吃难度层倍率。 */
var BF_BOSS = {
 warden: {name:"石廊守卫", art:"warden", col:"#8A3223", hp:1400, dmg:18, spd:58, armor:4,
          xp:260, gold:400, r:30, noKnock:true, boss:true, scale:2.5,
          sweep: {cd:6.0, warn:0.8, arc:200, range:150, dmg:26},
          quake: {cd:9.0, warn:1.2, r:95,  dmg:34},
          call:  {at:[0.75, 0.50, 0.25], n:8, id:"rat", ring:150, warn:0.6},
          rage:  {at:0.30, spd:1.30, cd:0.70},
          adds:  {id:"dread", n:2, respawn:8}},
 /* ===== 第 20 波 Boss ·「锈庭主事」（用户 2026-09-22）=====
    立绘复用 MOB_ART.steward（它本来就是守卫那张的别名），换个锈色就认得出来。
    ⚠️ 技能**故意跟守卫一条都不重**：守卫是「扇形 + 一个圈」，考的是别贴脸；
       主事是「一片钉子 + 一条长鞭」，考的是**别站在原地、也别站成一条线**。 */
 steward:{name:"锈庭主事", art:"steward", col:"#7A4A2A", hp:3000, dmg:30, spd:62, armor:6,
          xp:560, gold:820, r:32, noKnock:true, boss:true, scale:2.6,
          nails: {cd:7.0, warn:1.1, n:5, r:62, spread:150, dmg:26},
          chain: {cd:8.5, warn:0.7, len:420, w:46, dmg:30, slow:{pct:0.5, sec:2.5}},
          call:  {at:[0.70, 0.40], n:6, id:"splitter", ring:170, warn:0.6},
          rage:  {at:0.30, spd:1.25, cd:0.70},
          adds:  {id:"bomber", n:2, respawn:7}}
};
/* Boss 出场顺序：第 10 波守卫、第 20 波主事。
   ⚠️ 第 30 / 40 波预定是「烬渊祭司」priest 和「墟心冕者」crown（立绘都是现成的），还没做 ——
      在那之前，第 30 波往后继续按**最后一只**加压（见待办）。 */
var BF_BOSS_ORDER = ["warden", "steward"];
/* Boss 技能表。加新技能要同时动三处：这张表、bossAim()、bossFire()（外加 draw() 里的预警）。 */
var BOSS_SKILLS = ["sweep", "quake", "nails", "chain"];
function bossFor(w){
  var n = Math.floor(w / BF.bossEvery);            // 第 10 波 n=1
  var key = BF_BOSS_ORDER[Math.min(n, BF_BOSS_ORDER.length) - 1];
  var src = BF_BOSS[key], d = {}, k;
  for(k in src) d[k] = src[k];
  d.key = key;
  var extra = n - BF_BOSS_ORDER.length;            // 超出这张表的轮次继续加压
  if(extra > 0){ var m = 1 + 0.9 * extra;
    d.hp = Math.round(d.hp * m); d.dmg = Math.round(d.dmg * (1 + 0.35 * extra));
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

/* ===== 塔（用户 2026-09-22 的塔防改版）=====
   品质照旧是 普通/稀有/史诗/传奇/神圣（r 0~4），**没有羁绊** ——
   配合全靠「光环塔只增益范围内的**别的**塔」和「控场塔把怪送到输出塔嘴边」，
   所以**摆在哪儿**才是这套系统真正的玩法。用户点名的那一对就是
   引灵幡（没有伤害，把怪拽过来）+ 重炮台（伤害极高、启动极慢、范围小，单独摆必定打空）。

   ⚠️ **塔的伤害跟玩家挂钩**（用户定的）：一律 `towerPower() × dmg × 星级倍率`，
      `towerPower()` 是玩家最近几刀的**实际出手伤害**（平滑过的），
      所以玩家身上每一件加伤害的遗物都会同时喂给全部的塔。**别改成写死的数值。**
   ⚠️ 塔**没有血量**（用户原话），怪打不掉它，只有城墙能被打掉。

   字段：r 品质 / range 射程 / cd 攻击间隔（秒）/ dmg 伤害倍率 / kind 行为
   kind: shot 单体直射 · lob 抛射（有飞行时间，目标会跑）· aoe 范围持续
         chain 连锁 · beam 锁定光束 · pull 牵引 · mark 标记 · vortex 漩涡
         storm 雷击（打最密的一团）· aura 纯光环（没有伤害）
   aura 里的每一项只作用在**范围内的其它塔**身上（slow / playerCut 例外，作用于怪和玩家）：
         aspd 攻速 +N · dmg 伤害 +N · cdCut 间隔 −N · rangeUp 射程 +N
         slow 范围内的怪减速 N · playerCut 玩家在范围内时受到的伤害 −N% */
var BF_TOWERS = [
 /* ---- 普通 ---- */
 {id:"tw_bolt",  n:"箭塔",   r:0, shape:"spire", range:150, cd:1.0, dmg:0.60, kind:"shot", speed:420,
  pw:"每 1.0 秒朝射程内最近的敌人射一箭。",
  lore:"最老实的一座，从不问打的是谁。"},
 {id:"tw_spike", n:"尖刺台", r:0, shape:"spike", range:78, cd:0.5, dmg:0.28, kind:"aoe",
  pw:"每 0.5 秒对范围内所有敌人造成伤害。射程很短。",
  lore:"它只管脚底下那一圈。"},
 {id:"tw_sling", n:"投石机", r:0, shape:"lob",   range:190, cd:1.8, dmg:0.85, kind:"lob", splash:48, speed:230,
  pw:"每 1.8 秒抛一发石弹，落点炸开 48 范围。石弹飞得慢，敌人会跑开。",
  lore:"它瞄的是敌人刚才站的地方。"},
 {id:"tw_lantern",n:"霜灯",  r:0, shape:"flame", range:120, cd:0, kind:"aura", aura:{slow:0.20},
  pw:"没有伤害。范围内的敌人移速 −20%。",
  lore:"灯不烫手，可是走过它的人都慢下来。"},
 {id:"tw_drum",  n:"战鼓",   r:0, shape:"drum",  range:140, cd:0, kind:"aura", aura:{aspd:0.20},
  pw:"没有伤害。范围内其它塔攻速 +20%。",
  lore:"鼓点不杀人，杀人的是跟上鼓点的那些。"},

 /* ---- 稀有 ---- */
 {id:"tw_frost", n:"冰晶塔", r:1, shape:"crystal", range:165, cd:1.4, dmg:0.55, kind:"shot", speed:380,
  slow:{pct:0.40, sec:1.5},
  pw:"每 1.4 秒射一发，命中的敌人移速 −40% 持续 1.5 秒。",
  lore:"被它打中的东西，连倒下都慢半拍。"},
 {id:"tw_lure",  n:"引灵幡", r:1, shape:"banner", range:220, cd:2.5, dmg:0, kind:"pull", pull:90,
  pw:"没有伤害。每 2.5 秒把范围内的敌人拽向自己 90。",
  lore:"它什么也不做，只是招手。"},
 {id:"tw_arc",   n:"电弧塔", r:1, shape:"arc",    range:135, cd:1.2, dmg:0.42, kind:"chain", chain:3,
  pw:"每 1.2 秒放一次电，闪电在最近的 3 个敌人之间跳。",
  lore:"它认最近的那个，一个接一个。"},
 {id:"tw_mirror",n:"窥影镜", r:1, shape:"eye",    range:200, cd:1.8, dmg:0, kind:"mark",
  markN:3, markSec:4, markPct:25,
  pw:"没有伤害。每 1.8 秒标记范围内 3 个敌人 4 秒，被标记的受到的伤害 +25%。",
  lore:"照过一次，就再也藏不住了。"},

 /* ---- 史诗 ---- */
 {id:"tw_cannon",n:"重炮台", r:2, shape:"cannon", range:210, cd:2.8, dmg:2.60, kind:"lob",
  splash:60, speed:200, warn:0.8,
  pw:"每 2.8 秒开一炮：抬手 0.8 秒后才打出去，落点炸开 60 范围。伤害极高，但很容易打空。",
  lore:"它从不追人，它等人自己站过来。"},
 {id:"tw_beam",  n:"灼光塔", r:2, shape:"beam",   range:175, cd:0.25, dmg:0.20, kind:"beam",
  pw:"一道光束咬住一个敌人，每 0.25 秒灼一次。目标死了才换人。",
  lore:"它不眨眼，所以你也别动。"},
 {id:"tw_bramble",n:"荆棘园",r:2, shape:"bramble",range:105, cd:1.0, dmg:0.50, kind:"aoe",
  aura:{slow:0.25},
  pw:"每秒对范围内所有敌人造成伤害，并且范围内的敌人移速 −25%。",
  lore:"进去容易，出来就得留下点什么。"},
 {id:"tw_horn",  n:"号角旗", r:2, shape:"horn",   range:130, cd:0, kind:"aura", aura:{dmg:0.30},
  pw:"没有伤害。范围内其它塔伤害 +30%。",
  lore:"号角一响，谁都比平时狠一点。"},

 /* ---- 传奇 ---- */
 {id:"tw_storm", n:"雷云柱", r:3, shape:"storm",  range:240, cd:2.0, dmg:2.00, kind:"storm", splash:80,
  pw:"每 2.0 秒在射程内敌人最密的那一团上降下雷击，炸开 80 范围。",
  lore:"它专挑人多的地方劈。"},
 {id:"tw_gravity",n:"塌陷核心",r:3,shape:"vortex", range:260, cd:4.0, dmg:1.20, kind:"vortex", dur:1.5,
  pw:"每 4 秒开一个持续 1.5 秒的漩涡，把范围内的敌人一直拽向中心，结束时炸一下。",
  lore:"地面自己凹了下去。"},
 {id:"tw_forge", n:"熔炉",   r:3, shape:"forge",  range:150, cd:0, kind:"aura", aura:{aspd:0.35, dmg:0.20},
  pw:"没有伤害。范围内其它塔攻速 +35%、伤害 +20%。",
  lore:"它把别人烧得发红，自己一动不动。"},

 /* ---- 神圣 ---- */
 {id:"tw_judge", n:"裁决之环",r:4,shape:"ring",   range:190, cd:1.0, dmg:0.70, kind:"aoe", ccX:2,
  pw:"每秒对范围内所有敌人造成伤害；对被减速或被标记的敌人伤害翻倍。",
  lore:"它不审问，它只是划下一道线。"},
 {id:"tw_obelisk",n:"归墟碑",r:4, shape:"obelisk",range:200, cd:0, kind:"aura",
  aura:{cdCut:0.25, rangeUp:0.25, playerCut:20},
  pw:"没有伤害。范围内其它塔攻击间隔 −25%、射程 +25%；你站在范围内时受到的伤害 −20%。",
  lore:"碑上没有字，站在它影子里的人却都记得回家的路。"}
];
var TW_MAP = {};
(function(){ for(var i = 0; i < BF_TOWERS.length; i++) TW_MAP[BF_TOWERS[i].id] = BF_TOWERS[i]; })();

/* 买价（按品质）。卖出退 `买价 × 张数`（1★ 1 张 / 2★ 3 张 / 3★ 9 张），跟云顶一个口径。
   ⚠️ **2026-09-22 整排 ×5**（用户要求），跟 DLVL_COST 是一起的。
   ⚠️ **刷新还是 6 金没动** —— 所以现在是「牌便宜、人贵」，多刷几次找想要的那张是划算的。
      嫌刷新太便宜就抬 BF.deploy.rerollCost，别去动这张表。 */
var TW_COST   = [20, 40, 70, 120, 200];
/* 牌库里每种塔各有几张（云顶那套「大家抢同一个池子」）。卖掉会还回池子里。 */
var TW_COPIES = [22, 18, 14, 10, 6];
/* 星级倍率：伤害 ×，光环 × */
var STAR_DMG  = [1, 1.8, 3.2];
var STAR_AURA = [1, 1.5, 2.0];
/* 各等级抽到各品质的权重（下标 = 部署等级 1~9），照云顶的形状 */
var TW_ODDS = [
 null,
 [100,  0,  0,  0,  0],
 [100,  0,  0,  0,  0],
 [ 75, 25,  0,  0,  0],
 [ 55, 30, 15,  0,  0],
 [ 45, 33, 20,  2,  0],
 [ 30, 40, 25,  5,  0],
 [ 19, 30, 35, 15,  1],
 [ 18, 25, 32, 22,  3],
 [ 10, 20, 25, 35, 10]
];

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
       chestN:0, chestCycle:0, bagAlerted:false,
       /* ---- 塔防（用户 2026-09-22）---- */
       dlvl:1,                            // 部署等级 = 人口 = 场上最多几座塔
       bench:[],                          // 备战区，BF.deploy.bench 格（用户说的「九个卡槽」）
       pool:{},                           // 牌库：每种塔还剩几张（云顶那套共享池）
       round:0,                           // 已经进行过几轮部署
       /* 距离下一次「挑遗物」还差几级（见 BF.pickEvery）。
          ⚠️ 从 1 起步，所以**第一件遗物在 2 级拿到**，之后 4/6/8…；
             从 0 起步的话第一件要等到 3 级，开局太空了。 */
       lvlSince:1,
       power:0};                          // 玩家最近几刀的实际出手伤害 —— 塔的伤害读它
  initPool();
  reindex();
  newWave(1, true);                       // ⚠️ G 必须先建好 —— bstats() 要读 G 上的几个计数
  E = {foes:[], shots:[], drops:[], sites:[], pwaves:[], fx:[], boss:null,
       builds:[], tshots:[]};             // builds 是塔/墙/泉/商，tshots 是塔打出去的弹
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
  /* 泉每一波回一次（用户 2026-09-22）—— 它不再消失，只是每波能喝一口 */
  if(E) for(var bi = 0; bi < E.builds.length; bi++)
    if(E.builds[bi].k === "spring") E.builds[bi].used = false;
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
  if(has("boom"))  s.critMult += 1.2;                                // 战场改写

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
  if(!hits.length){
    /* 空刀也记一笔出手伤害（只算等级和连击）——「玩家一刀不砍、全靠塔」的打法里，
       不补这一句的话 towerPower() 会永远停在初始值。 */
    var idle = s.atk * (1 + comboPct(s) / 100);
    P.power = P.power ? P.power * 0.9 + idle * 0.1 : idle;
    return;
  }

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
  /* ⚠️ 塔的伤害跟玩家挂钩（用户 2026-09-22）：把**没吃暴击的那一下**平滑记下来，
     towerPower() 读它。平滑是为了别让连击和暴击把塔的伤害抖成锯齿。 */
  P.power = P.power ? P.power * 0.7 + raw * 0.3 : raw;
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
  if(has("boom") && crit) P.combo += 1;                              // 战场改写
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
  var cut = s.cutStatic + buildCut();      // 归墟碑：你站在它范围里时受到的伤害 −20%
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
    /* ⚠️ **每 BF.pickEvery 级才给一次四选一**（用户 2026-09-22）——
       零头攒在 P.lvlSince 上，跨升级继续攒，别改成「偶数级才给」（一次升两级会漏）。 */
    P.lvlSince += up;
    var got = Math.floor(P.lvlSince / BF.pickEvery);
    if(got > 0){
      P.lvlSince -= got * BF.pickEvery;
      pendPicks += got;
      openPick();
    }
  }
}

/* ================================================================
   怪：受伤 / 倒下
   ================================================================ */
/* 「拒马」的光环：身边的怪受到的伤害 −N%。
   ⚠️ **所有打怪的路都必须过它**（hurtFoe / splash / aoe / zap / towerHurt / 冲击波），
      漏一条拒马就等于没摆。
   ⚠️ 它**不保护自己** —— 不然它就是块纯肉，玩家少了「先点掉它」这个解法。 */
function guarded(f, d){
  if(!G.guardN) return d;
  for(var i = 0; i < E.foes.length; i++){
    var o = E.foes[i];
    if(o.dead || o === f || !o.def.guard) continue;
    if(Math.hypot(o.x - f.x, o.y - f.y) <= o.def.guard.r)
      return Math.max(1, Math.round(d * (1 - o.def.guard.cut)));
  }
  return d;
}
function hurtFoe(f, d, s, crit){
  d = guarded(f, d);
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
  if(f){ f.hp -= guarded(f, d); if(f.hp <= 0) killFoe(f); }
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
    var dg = guarded(f, dmg);
    f.hp -= dg; f.flash = 0.12;
    fxNum(f.x, f.y - f.r - 4, dg, false);
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
    var dz = guarded(t, dmg);
    t.hp -= dz; t.flash = 0.12;
    fxNum(t.x, t.y - t.r - 4, dz, false);
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
  /* 「裂壳虫」倒下时裂成两只小的（小的自己没有 split，所以不会再裂）。
     ⚠️ 这里往 E.foes 里 push，而 aoe() 是对快照迭代的 —— 新裂出来的不会被同一发范围伤害二次命中。 */
  if(f.def.split){
    for(var q = 0; q < f.def.split.n; q++){
      var qa = q / f.def.split.n * 6.2832 + Math.random();
      E.foes.push(makeFoe(f.def.split.id, P.wave, f.x + Math.cos(qa) * 20, f.y + Math.sin(qa) * 20));
    }
    fxRing(f.x, f.y, 26, f.col);
  }
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
    blinkCd: d.blink ? d.blink.every * Math.random() : 0, blinkWarn:0,
    /* 11–19 波那一批的状态（用户 2026-09-22）*/
    silCd: d.silence ? d.silence.cd * Math.random() : 0,
    healCd: d.heal ? d.heal.cd * Math.random() : 0,
    fuse: 0,
    boomDmg: d.boom ? Math.max(1, Math.round(d.boom.dmg * dmgMul(w) * TIER.dmg)) : 0};
}
function makeBoss(w){
  var d = bossFor(w);
  var f = {id:"boss", def:d, name:d.name, col:d.col, art:d.art,
    x: E.me.x, y: E.me.y - 200,
    hp: Math.round(d.hp * TIER.hp), maxHp: Math.round(d.hp * TIER.hp),
    dmg: Math.round(d.dmg * TIER.dmg), spd:d.spd, armor:d.armor,
    xp:d.xp, gold:Math.round(d.gold * BF.goldMult), r:d.r, sc:d.scale, elite:true, boss:true, noKnock:true,
    kx:0, ky:0, t:0, touch:0, flash:0, dead:false,
    bkey:d.key || "warden", cast:null, castT:0, skCd:{}, nails:null,
    called:0, rage:false};
  /* 开局各技能的 CD 错开一点，别一进门三个一起抬手 */
  for(var i = 0; i < BOSS_SKILLS.length; i++){
    var k = BOSS_SKILLS[i];
    if(d[k]) f.skCd[k] = d[k].cd * (0.45 + Math.random() * 0.45);
  }
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
  /* guarded() 每次打怪都要调，这里先数一遍拒马，没有就整段跳过（省掉一层 O(怪数) 循环）*/
  G.guardN = 0;
  for(i = 0; i < E.foes.length; i++) if(!E.foes[i].dead && E.foes[i].def.guard) G.guardN++;
  for(i = 0; i < E.foes.length; i++){
    f = E.foes[i]; if(f.dead) continue;
    f.t += dt; if(f.flash > 0) f.flash -= dt;
    dx = me.x - f.x; dy = me.y - f.y; d = Math.hypot(dx, dy) || 1;
    sp = f.spd;
    if(hasSp("sp_frost") && d <= 220) sp *= 0.6;          // 霜环
    /* ---- 塔带来的三样状态（用户 2026-09-22 的塔防改版）---- */
    if(f.mark > 0) f.mark -= dt;                          // 窥影镜的标记
    if(f.slowT > 0){ f.slowT -= dt; sp *= (1 - f.slowPct); }   // 冰晶塔的减速弹
    var aura = towerSlowAt(f.x, f.y);                     // 霜灯 / 荆棘园的减速光环
    if(aura > 0) sp *= (1 - aura);
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
      /* 「缝合者」：不打人，保持距离，每 cd 秒给身边伤得最重的一只回血。
         ⚠️ 它是这一批里最该被优先点掉的一只 —— 留着它，拒马和精英就一直满血。 */
      if(def.heal){
        if(d < def.heal.keep * 0.8){ tx = -tx; ty = -ty; }
        else if(d < def.heal.keep * 1.1){ tx = 0; ty = 0; }
        f.healCd -= dt;
        if(f.healCd <= 0){
          f.healCd = def.heal.cd;
          var worst = null, wf = 0.999;
          for(j = 0; j < E.foes.length; j++){
            o = E.foes[j];
            if(o.dead || o === f) continue;
            if(Math.hypot(o.x - f.x, o.y - f.y) > def.heal.r) continue;
            var fr = o.hp / o.maxHp;
            if(fr < wf){ wf = fr; worst = o; }
          }
          if(worst){
            worst.hp = Math.min(worst.maxHp, worst.hp + Math.round(worst.maxHp * def.heal.pct));
            fxBolt(f.x, f.y, worst.x, worst.y); fxRing(worst.x, worst.y, 22, "#3E7A5E");
          }
        }
      }
      /* 「缚锁者」：每 cd 秒封掉射程内最近的一座塔 sec 秒 —— 塔防层的专属克制。
         ⚠️ 它封的是**塔**不是人，所以塔摆得散一点就不会被一锅端。 */
      if(def.silence){
        f.silCd -= dt;
        if(f.silCd <= 0){
          f.silCd = def.silence.cd;
          var bt = null, bd2 = def.silence.r;
          for(j = 0; j < E.builds.length; j++){
            var b2 = E.builds[j];
            if(b2.k !== "tower" || b2.silT > 0) continue;
            var d3 = Math.hypot(b2.x - f.x, b2.y - f.y);
            if(d3 < bd2){ bd2 = d3; bt = b2; }
          }
          if(bt){ bt.silT = def.silence.sec; fxBolt(f.x, f.y, bt.x, bt.y); fxRing(bt.x, bt.y, 26, "#6B4A8A"); }
        }
      }
      /* 「爆囊」：贴到 at 之内就点火，warn 秒后自爆，自己也没了。
         ⚠️ 引信期间它**站着不动**、身上画一圈收拢的预警 —— 走开就躲得掉（155 移速 1 秒跑 155 > 半径 100）。 */
      if(def.boom){
        if(f.fuse > 0){
          f.fuse -= dt; sp = 0; tx = 0; ty = 0;
          if(f.fuse <= 0){
            if(Math.hypot(me.x - f.x, me.y - f.y) < def.boom.r) takeHit(f.boomDmg, f, {});
            fxRing(f.x, f.y, def.boom.r, "#C2510E");
            killFoe(f);
            continue;
          }
        } else if(d < def.boom.at) f.fuse = def.boom.warn;
      }
      /* 幽魂的飘移 */
      if(def.wob){ var w2 = Math.sin(f.t * 2.4) * 0.5;
        var nx = -ty, ny = tx; tx += nx * w2; ty += ny * w2; }
      f.x += tx * sp * dt; f.y += ty * sp * dt;
    }
    /* 击退 */
    if(f.kx || f.ky){ f.x += f.kx; f.y += f.ky; f.kx *= 0.55; f.ky *= 0.55;
      if(Math.abs(f.kx) < 0.4){ f.kx = 0; f.ky = 0; } }

    /* ⚠️ 城墙 2026-09-22 删了，所以这里**没有任何建筑碰撞** —— 建筑不挡路、打不掉。 */

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
    if((!f.def.shot && !f.def.heal && !f.def.boom) || f.boss){
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

/* Boss 的技能是**数据驱动**的：def 上有哪个键就有哪个技能（BOSS_SKILLS 是那张表）。
   加新技能要同时动三处：BOSS_SKILLS、bossAim()、bossFire()，外加 draw() 里的地面预警。 */
function updateBoss(f, dt, d, tx, ty){
  var def = f.def, i;
  if(!f.rage && f.hp <= f.maxHp * def.rage.at){ f.rage = true; }
  var cdx = f.rage ? def.rage.cd : 1, spx = f.rage ? def.rage.spd : 1;
  /* 召唤：血量过线就放一批 */
  var frac = f.hp / f.maxHp;
  while(f.called < def.call.at.length && frac <= def.call.at[f.called]){
    f.called++;
    for(i = 0; i < def.call.n; i++){
      var a = i / def.call.n * Math.PI * 2;
      E.foes.push(makeFoe(def.call.id, P.wave, f.x + Math.cos(a) * def.call.ring,
                                               f.y + Math.sin(a) * def.call.ring));
    }
    fxRing(f.x, f.y, def.call.ring, f.col);
  }
  if(f.cast){
    f.castT -= dt;
    if(f.castT <= 0){ bossFire(f, def); f.cast = null; }
    return;                                   // 施法时不动
  }
  /* 谁的 CD 先到就放谁。⚠️ 横扫够不着就跳过，不然它会在远处空挥。 */
  for(i = 0; i < BOSS_SKILLS.length; i++){
    var k = BOSS_SKILLS[i];
    if(!def[k]) continue;
    f.skCd[k] -= dt;
    if(f.skCd[k] > 0) continue;
    if(k === "sweep" && d >= def.sweep.range) continue;
    f.skCd[k] = def[k].cd * cdx;
    f.cast = k; f.castT = def[k].warn;
    bossAim(f, def, k);
    return;
  }
  f.x += tx * f.spd * spx * dt; f.y += ty * f.spd * spx * dt;
}
/* 抬手那一下把落点/朝向**锁死**（地上画的预警就是按这个画的）。 */
function bossAim(f, def, k){
  var me = E.me, i;
  if(k === "sweep" || k === "chain") f.castDir = Math.atan2(me.y - f.y, me.x - f.x);
  else if(k === "quake"){ f.qx = me.x; f.qy = me.y; }
  else if(k === "nails"){
    f.nails = [{x:me.x, y:me.y}];                     // 第一颗钉在脚下：站着不动必吃
    for(i = 1; i < def.nails.n; i++){
      var a = Math.random() * Math.PI * 2, rr = 40 + Math.random() * def.nails.spread;
      f.nails.push({x: me.x + Math.cos(a) * rr, y: me.y + Math.sin(a) * rr});
    }
  }
}
function bossFire(f, def){
  var me = E.me, i;
  if(f.cast === "sweep"){
    /* ⚠️ 判定按**抬手时锁的方向**算，跟地上画的扇形一致。
       以前这儿只看距离不看角度 —— 画一个扇形却四面八方都打得到，已修。 */
    var dd = Math.hypot(me.x - f.x, me.y - f.y);
    var ad = Math.atan2(me.y - f.y, me.x - f.x) - f.castDir;
    while(ad >  Math.PI) ad -= Math.PI * 2;
    while(ad < -Math.PI) ad += Math.PI * 2;
    if(dd < def.sweep.range && Math.abs(ad) <= def.sweep.arc * Math.PI / 360)
      takeHit(Math.round(def.sweep.dmg * TIER.dmg), f, {boss:true});
    fxArc(f.x, f.y, f.castDir, def.sweep.range, def.sweep.arc, f.col);
  } else if(f.cast === "quake"){
    if(Math.hypot(me.x - f.qx, me.y - f.qy) < def.quake.r)
      takeHit(Math.round(def.quake.dmg * TIER.dmg), f, {boss:true});
    fxRing(f.qx, f.qy, def.quake.r, "#A93729");
  } else if(f.cast === "nails"){
    /* 锈钉雨：一片圈一起落，逼你往空档挪几步 */
    for(i = 0; i < f.nails.length; i++){
      var n = f.nails[i];
      if(Math.hypot(me.x - n.x, me.y - n.y) < def.nails.r)
        takeHit(Math.round(def.nails.dmg * TIER.dmg), f, {boss:true});
      fxRing(n.x, n.y, def.nails.r, "#8A6A10");
    }
    f.nails = null;
  } else if(f.cast === "chain"){
    /* 回廊链：一条从它伸出去的长带子，打中掉血 + 减速（站成一条线就吃满）*/
    var ax = Math.cos(f.castDir), ay = Math.sin(f.castDir);
    var px = me.x - f.x, py = me.y - f.y;
    var along = px * ax + py * ay, perp = Math.abs(px * -ay + py * ax);
    if(along > 0 && along < def.chain.len && perp < def.chain.w / 2){
      takeHit(Math.round(def.chain.dmg * TIER.dmg), f, {boss:true});
      me.slowT = def.chain.slow.sec; me.slowPct = def.chain.slow.pct;
    }
    fxArc(f.x, f.y, f.castDir, def.chain.len, 12, "#7A4A2A");
  }
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
   塔防：牌库 / 备战区 / 部署阶段 / 塔的运行时（用户 2026-09-22）
   ⚠️ 这一整节的唯一说明书是 `战场模式.md` 的「十二 塔防」，改了数值回去同步。
   ⚠️ 规矩跟别处一致：**塔的属性全部现算**（refreshTowerStats），
      P 上只存「手里有哪些牌、等级几、牌库还剩几张」这种事实。
   ================================================================ */
var TW_COL = ["#6B665C", "#2A62AD", "#6F3D98", "#B45B12", "#A8891C"];

/* ---- 牌库（云顶那套共享池：买走才扣，卖掉还回来）---- */
function initPool(){
  P.pool = {};
  for(var i = 0; i < BF_TOWERS.length; i++) P.pool[BF_TOWERS[i].id] = TW_COPIES[BF_TOWERS[i].r];
}
function poolLeft(id){ return P.pool[id] || 0; }
function poolTake(id){ if(poolLeft(id) <= 0) return false; P.pool[id]--; return true; }
function poolBack(id, n){ P.pool[id] = poolLeft(id) + n; }
/* 一张 N 星的牌是几张一星堆出来的（卖价和还池子都按它算，跟云顶一致）*/
function starCopies(star){ return star === 1 ? 1 : star === 2 ? 3 : 9; }
function twCost(tid){ return TW_COST[TW_MAP[tid].r]; }

/* ---- 备战区 / 人口 ---- */
function benchFree(){ return BF.deploy.bench - P.bench.length; }
function fieldTowers(){
  var n = 0;
  for(var i = 0; i < E.builds.length; i++) if(E.builds[i].k === "tower") n++;
  return n;
}
/* ⚠️ 人口只数塔 —— 泉 / 商 / 城墙**不占人口**（用户定的）。 */
function popLeft(){ return P.dlvl - fieldTowers(); }

function mkTower(tid, star, x, y){
  return {k:"tower", tid:tid, def:TW_MAP[tid], star:star, x:x, y:y,
          t:0, cd:0, warn:0, vortT:0, tgt:null, lockX:0, lockY:0, beamT:0, ef:null,
          silT:0};                       // 被「缚锁者」封住还剩几秒（见 updateTowers）
}

/* 三张同名同星 → 高一星，上限 3 星（云顶那套）。
   落点优先用「场上那三张里的第一张」的位置，所以合成不会把摆好的阵型打散。 */
function combineAll(){
  for(var loop = 0; loop < 40; loop++){
    var groups = {}, i, k;
    for(i = 0; i < P.bench.length; i++){
      var c = P.bench[i];
      if(c.k !== "tower" || c.star >= 3) continue;
      k = c.tid + "#" + c.star; (groups[k] = groups[k] || []).push({b:i});
    }
    for(i = 0; i < E.builds.length; i++){
      var b = E.builds[i];
      if(b.k !== "tower" || b.star >= 3) continue;
      k = b.tid + "#" + b.star; (groups[k] = groups[k] || []).push({f:i});
    }
    var hit = null, key = null;
    for(k in groups) if(groups[k].length >= 3){ hit = groups[k].slice(0, 3); key = k; break; }
    if(!hit) return;
    var tid = key.split("#")[0], star = +key.split("#")[1];
    var spot = null, bi = [], fi = [];
    for(i = 0; i < 3; i++){
      if(hit[i].b !== undefined) bi.push(hit[i].b);
      else { fi.push(hit[i].f); if(!spot) spot = {x:E.builds[hit[i].f].x, y:E.builds[hit[i].f].y}; }
    }
    bi.sort(function(a, b2){ return b2 - a; });
    fi.sort(function(a, b2){ return b2 - a; });
    for(i = 0; i < bi.length; i++) P.bench.splice(bi[i], 1);
    for(i = 0; i < fi.length; i++) E.builds.splice(fi[i], 1);
    if(spot) E.builds.push(mkTower(tid, star + 1, spot.x, spot.y));
    else P.bench.push({k:"tower", tid:tid, star:star + 1});
    fxText(TW_MAP[tid].n + " " + (star + 1) + "★", "#A8891C");
  }
}
/* 再买一张这个塔会不会当场合掉（备战区满了还能不能买）*/
function wouldCombine(tid){
  var n = 0, i;
  for(i = 0; i < P.bench.length; i++)
    if(P.bench[i].k === "tower" && P.bench[i].tid === tid && P.bench[i].star === 1) n++;
  for(i = 0; i < E.builds.length; i++)
    if(E.builds[i].k === "tower" && E.builds[i].tid === tid && E.builds[i].star === 1) n++;
  return n >= 2;
}

/* ---- 部署商店：按等级抽品质，再在那一档里抽还有货的塔 ---- */
var shopCards = [];
function drawCard(){
  var odds = TW_ODDS[Math.min(BF.deploy.lvlMax, Math.max(1, P.dlvl))], t = 0, i;
  for(i = 0; i < 5; i++) t += odds[i];
  var x = Math.random() * t, rar = 0;
  for(i = 0; i < 5; i++){ x -= odds[i]; if(x <= 0){ rar = i; break; } }
  var order = [rar], k;
  for(k = rar - 1; k >= 0; k--) order.push(k);         // 这一档抽空了就先往下找
  for(k = rar + 1; k <= 4; k++) order.push(k);
  for(k = 0; k < order.length; k++){
    var list = [];
    for(i = 0; i < BF_TOWERS.length; i++)
      if(BF_TOWERS[i].r === order[k] && poolLeft(BF_TOWERS[i].id) > 0) list.push(BF_TOWERS[i].id);
    if(list.length) return pick(list);
  }
  return null;
}
function rollShopCards(){
  shopCards = [];
  for(var i = 0; i < BF.deploy.shopN; i++) shopCards.push(drawCard());
}
function buyCard(i){
  var tid = shopCards[i];
  if(!tid) return;
  var c = twCost(tid);
  if(P.gold < c) return;
  if(benchFree() <= 0 && !wouldCombine(tid)) return;
  if(!poolTake(tid)) return;
  P.gold -= c; P.spent += c;
  shopCards[i] = null;
  P.bench.push({k:"tower", tid:tid, star:1});
  combineAll();
  renderDeploy(); renderTwShop();
}
function rerollShop(){
  var c = BF.deploy.rerollCost;
  if(P.gold < c) return;
  P.gold -= c; P.spent += c;
  rollShopCards(); renderDeploy(); renderTwShop();
}
function levelUp(){
  if(P.dlvl >= BF.deploy.lvlMax) return;
  var c = DLVL_COST[P.dlvl + 1];
  if(!c || P.gold < c) return;
  P.gold -= c; P.spent += c; P.dlvl++;
  renderDeploy(); renderTwShop();
}
function sellBench(i){
  var c = P.bench[i]; if(!c) return;
  P.bench.splice(i, 1);
  if(c.k === "tower"){
    var n = starCopies(c.star);
    P.gold += twCost(c.tid) * n;
    poolBack(c.tid, n);
  }
  selBench = -1; renderDeploy();
}

/* ---- 摆放 ---- */
var DEPLOY = false, selBench = -1, lastIncome = null;
/* ⚠️ 用户明确说了「**不能重叠**」，所以两座建筑至少隔 BF.deploy.gap。
   另外只能摆在自己身边 placeR 之内 —— 摆到看不见的地方等于没摆。 */
function canPlace(x, y, skip){
  if(Math.hypot(x - E.me.x, y - E.me.y) > BF.deploy.placeR) return false;
  for(var i = 0; i < E.builds.length; i++){
    if(E.builds[i] === skip) continue;                 // 拖着自己挪位置时别跟自己比
    if(Math.hypot(E.builds[i].x - x, E.builds[i].y - y) < BF.deploy.gap) return false;
  }
  return true;
}
function buildAt(x, y){
  var best = null, bd = 26;
  for(var i = 0; i < E.builds.length; i++){
    var d = Math.hypot(E.builds[i].x - x, E.builds[i].y - y);
    if(d < bd){ bd = d; best = E.builds[i]; }
  }
  return best;
}
function autoSpot(){
  for(var r = 60; r <= BF.deploy.placeR; r += 30)
    for(var a = 0; a < 12; a++){
      var x = E.me.x + Math.cos(a / 12 * 6.2832) * r, y = E.me.y + Math.sin(a / 12 * 6.2832) * r;
      if(canPlace(x, y)) return {x:x, y:y};
    }
  return null;
}
function placeCard(card, x, y){
  if(card.k === "tower"){
    if(popLeft() <= 0) return false;
    E.builds.push(mkTower(card.tid, card.star, x, y));
  } else if(card.k === "spring"){
    E.builds.push({k:"spring", x:x, y:y, t:0, used:false});
  } else {
    E.builds.push({k:"shop", x:x, y:y, t:0, cool:0, stock:card.stock || null});
  }
  return true;
}
function placeAt(x, y){
  if(selBench < 0) return;
  var c = P.bench[selBench];
  if(!c || !canPlace(x, y)) return;
  if(!placeCard(c, x, y)) return;
  P.bench.splice(selBench, 1); selBench = -1;
  renderDeploy();
}
/* 点一下场上的建筑 = 收回备战区 */
function pickUp(b){
  var i = E.builds.indexOf(b); if(i < 0) return;
  if(benchFree() <= 0) return;
  E.builds.splice(i, 1);
  if(b.k === "tower") P.bench.push({k:"tower", tid:b.tid, star:b.star});
  else if(b.k === "spring") P.bench.push({k:"spring"});
  else P.bench.push({k:"shop", stock:b.stock});      // 货架跟着牌走，免得收放一次就白刷新一批
  renderDeploy();
}
/* 白给一张建筑卡（每次部署一张泉 + 一张商，用户 2026-09-22）；
   备战区满了就直接替玩家摆在身边。
   ⚠️ **每种最多攒 BF.deploy.buildMax 个**（场上 + 备战区一起数）——
      轮数是无限的，不封的话二十轮之后营地里全是泉和商摊。
      多几个泉是有用的（每个每波都能喝一口），所以封在 4 而不是 1。 */
function countKind(kind){
  var n = 0, i;
  for(i = 0; i < P.bench.length; i++) if(P.bench[i].k === kind) n++;
  for(i = 0; i < E.builds.length; i++) if(E.builds[i].k === kind) n++;
  return n;
}
function giveBuildCard(kind){
  if(countKind(kind) >= BF.deploy.buildMax) return;
  if(benchFree() > 0){ P.bench.push({k:kind}); return; }
  var s = autoSpot();
  if(s) placeCard({k:kind}, s.x, s.y);
}
/* 部署时把整座营地平移到玩家脚下 —— 阵型不变，人跑多远都不会把塔丢在后面。
   ⚠️ 没有这一步的话第二次部署就得从零重建，前面买的塔全白费。 */
function relocateCamp(){
  if(!E.builds.length) return;
  var cx = 0, cy = 0, i;
  for(i = 0; i < E.builds.length; i++){ cx += E.builds[i].x; cy += E.builds[i].y; }
  cx /= E.builds.length; cy /= E.builds.length;
  var dx = E.me.x - cx, dy = E.me.y - cy;
  if(Math.hypot(dx, dy) < 1) return;
  for(i = 0; i < E.builds.length; i++){ E.builds[i].x += dx; E.builds[i].y += dy; }
}

/* ---- 部署阶段的开关 ---- */
function isDeployWave(w){ return (w - 1) % BF.deploy.every === 0; }
function openDeploy(){
  var d = BF.deploy, i;
  DEPLOY = true; PAUSED = true; P.round++;
  relocateCamp();
  if(P.round === 1) P.gold += d.startGold;                       // 开局那一笔钱
  var inc = d.incomeBase + d.incomePer * (P.round - 1);          // ⚠️ 没有利息了（用户 2026-09-22）
  P.gold += inc;
  lastIncome = {inc:inc, start: P.round === 1 ? d.startGold : 0};
  giveBuildCard("spring"); giveBuildCard("shop");                // 用户：每次部署白给一张泉 + 一张商
  for(i = 0; i < E.builds.length; i++)                           // 用户：商店每五波刷新
    if(E.builds[i].k === "shop"){ E.builds[i].stock = null; E.builds[i].cool = 0; }
  rollShopCards();
  selBench = -1; DRAG = null; ZOOM = 1; PAN.x = 0; PAN.y = 0;
  /* ⚠️ **进部署先把场上的弹幕全清掉**（用户 2026-09-22）——
     不清的话「开战」那一下会直接吃一脸停在半空的弹，而且那是上一波留下的，躲都没法躲。
     顺手把远程怪的抬手也打断，免得开战瞬间同时炸开一排。 */
  E.shots.length = 0; E.tshots.length = 0; E.pwaves.length = 0;
  for(i = 0; i < E.foes.length; i++){ E.foes[i].castT = 0; E.foes[i].shotCd = Math.max(E.foes[i].shotCd, 0.8); }
  $("deploy").hidden = false;
  renderDeploy();
}
/* 部署时镜头要往下推半个面板高，否则玩家正好被面板压住、营地只看得见上半圈。
   面板高度在 renderDeploy() 里量一次存这儿，别每帧去读 offsetHeight。 */
var camShift = 0;
/* ===== 部署阶段的镜头（用户 2026-09-22：「可以放大和缩小移动一定的镜头视野」）=====
   ⚠️ **只在部署阶段生效**，closeDeploy() 会把两样都复位 —— 打起来的时候镜头永远是
      居中、1 倍，那是这个模式的手感底线。
   ⚠️ 缩放是在 draw() 里用 canvas 的 transform 做的（以屏幕中心为定点），
      **sx() / sy() 一个字没改** —— 所有世界坐标的代码都不用管缩放这回事。
      反过来「屏幕点换成世界点」走 screenToWorld()，那儿要自己除一次 ZOOM。 */
var ZOOM = 1, ZOOM_MIN = 0.55, ZOOM_MAX = 1.5, ZOOM_STEP = 0.25;
var PAN = {x:0, y:0};
function clampPan(){
  var r = BF.deploy.placeR, d = Math.hypot(PAN.x, PAN.y);
  if(d > r){ PAN.x = PAN.x / d * r; PAN.y = PAN.y / d * r; }
}
function setZoom(z){
  ZOOM = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
  renderDeploy();
}
function screenToWorld(cx, cy){
  var rect = cv.getBoundingClientRect();
  return {x: CAM.x + (cx - rect.left - cw / 2) / ZOOM,
          y: CAM.y + (cy - rect.top  - ch / 2) / ZOOM};
}
function closeDeploy(){
  DEPLOY = false; selBench = -1; camShift = 0;
  DRAG = null; ZOOM = 1; PAN.x = 0; PAN.y = 0;
  $("deploy").hidden = true;
  PAUSED = anyVeil() || OVER;
  last = 0;
}

/* ---- 部署面板 ---- */
function twName(tid, star){
  return TW_MAP[tid].n + " " + (star >= 3 ? "★★★" : star === 2 ? "★★" : "★");
}
function renderDeploy(){
  if(!DEPLOY) return;
  var d = BF.deploy, i, h;
  $("dTitle").textContent = "部署 · 第 " + P.wave + " 波前";
  $("dGold").textContent  = P.gold + " 金";
  $("dPop").textContent   = "等级 " + P.dlvl + " · 人口 " + fieldTowers() + "/" + P.dlvl;

  /* 一排按钮。⚠️ 商店 2026-09-22 搬进了弹窗（用户要求）——
     面板矮了一半，上面看得见的营地就多了一半。 */
  var lvUp = P.dlvl >= d.lvlMax, lvc = DLVL_COST[P.dlvl + 1];
  $("btnDLvl").textContent = lvUp ? "已满级" : "升级 " + lvc + " 金";
  $("btnDLvl").disabled = lvUp || !lvc || P.gold < lvc;
  $("btnDShop").textContent = "商店";
  $("btnDSell").hidden = selBench < 0;
  if(selBench >= 0){
    var sc = P.bench[selBench];
    $("btnDSell").textContent = sc && sc.k === "tower"
      ? "出售 +" + (twCost(sc.tid) * starCopies(sc.star)) + " 金" : "丢掉";
  }

  /* 备战区 9 格 */
  h = "";
  for(i = 0; i < d.bench; i++){
    var c2 = P.bench[i];
    if(!c2){ h += '<div class="bs empty"></div>'; continue; }
    if(c2.k === "tower"){
      var td = TW_MAP[c2.tid];
      h += '<button class="bs r' + td.r + (i === selBench ? " sel" : "") + '" data-i="' + i + '">' +
           '<b>' + td.n + '</b><i>' + (c2.star >= 3 ? "★★★" : c2.star === 2 ? "★★" : "★") + '</i></button>';
    } else {
      h += '<button class="bs bld' + (i === selBench ? " sel" : "") + '" data-i="' + i + '">' +
           '<b>' + (c2.k === "spring" ? "泉" : "商") + '</b><i>不占人口</i></button>';
    }
  }
  $("dBench").innerHTML = h;

  /* 提示只写一行（这个游戏不需要太多提示）*/
  var hint;
  if(selBench >= 0){
    var sc2 = P.bench[selBench];
    hint = (sc2.k === "tower" ? TW_MAP[sc2.tid].pw
         : sc2.k === "spring" ? "泉：每一波能喝一口，回 25% 最大生命。不占人口。"
         : "游商：卖遗物，每五波换一批货。不占人口。") + "　拖到画面上放下。";
  } else if(lastIncome){
    hint = "收入 +" + lastIncome.inc + (lastIncome.start ? "　开局 +" + lastIncome.start : "") +
           "　·　拖动建筑挪位置，点一下收回备战区；空白处拖动看四周，两指（或滚轮）缩放。";
  } else hint = "拖动建筑挪位置，点一下收回备战区；空白处拖动看四周，两指（或滚轮）缩放。";
  $("dHint").textContent = hint;
  camShift = $("deploy").offsetHeight / 2;
}

/* ---- 塔的商店：一个弹窗（用户 2026-09-22 从面板里搬出来的）---- */
function openTwShop(){ selBench = -1; renderTwShop(); show("veilTwShop"); }
function renderTwShop(){
  var h = "", i;
  for(i = 0; i < shopCards.length; i++){
    var tid = shopCards[i];
    if(!tid){ h += '<div class="tw gone">已买走</div>'; continue; }
    var t = TW_MAP[tid], c = twCost(tid);
    var no = P.gold < c || (benchFree() <= 0 && !wouldCombine(tid));
    h += '<button class="tw r' + t.r + (no ? " dim" : "") + '" data-i="' + i + '">' +
         '<span class="tcost">' + c + ' 金</span>' +
         '<b>' + t.n + '</b><i>' + RAR_CN[t.r] + ' · 池中 ' + poolLeft(tid) + '</i>' +
         '<p>' + t.pw + '</p></button>';
  }
  $("twShopList").innerHTML = h;
  $("twShopSub").textContent = "金币 " + P.gold + " · 备战区 " + P.bench.length + " / " + BF.deploy.bench +
                               " · 等级 " + P.dlvl + " 决定抽到什么品质";
  $("btnTwRe").textContent = "刷新 " + BF.deploy.rerollCost + " 金";
  $("btnTwRe").disabled = P.gold < BF.deploy.rerollCost;
}

/* ================================================================
   塔的运行时
   ⚠️ 塔的伤害 = towerPower() × dmg × 星级倍率，towerPower() 是玩家**最近几刀的实际伤害**
      （在 swing() 里平滑记进 P.power）。用户定的：「塔的伤害和人物伤害挂钩」。
   ================================================================ */
function towerPower(){ return Math.max(1, Math.round(P.power || bstats().atk)); }

/* 光环只作用在范围内的**其它**塔身上，所以「摆在哪儿」才是这套系统的玩法。
   ⚠️ 光环不叠乘：aspd / dmg / cdCut / rangeUp 各自**相加**再用一次，跟别处「只有两个乘区」同一个规矩。
   ⚠️ 光环塔自己的射程**不吃别的光环**，否则会互相放大成死循环。 */
/* 遗物给**全体塔**的伤害加成。现在只有「祭余」——
   战场里合成本来就不要钱，它原来那条「合成花费 −50%」是完全空的（用户 2026-09-22 点名要修）。
   以后再加「强化塔」的遗物就往这儿并，别散在 fireTower 里。 */
function towerRelicPct(){ return has("spare") ? 0.10 : 0; }
function refreshTowerStats(){
  var i, j, t, o;
  for(i = 0; i < E.builds.length; i++){
    t = E.builds[i]; if(t.k !== "tower") continue;
    var d = t.def, sd = STAR_DMG[t.star - 1];
    var aspdUp = 0, dmgUp = towerRelicPct(), cdCut = 0, rangeUp = 0;
    for(j = 0; j < E.builds.length; j++){
      o = E.builds[j];
      if(o === t || o.k !== "tower" || !o.def.aura || o.silT > 0) continue;
      if(Math.hypot(o.x - t.x, o.y - t.y) > o.def.range) continue;
      var sa = STAR_AURA[o.star - 1], a = o.def.aura;
      if(a.aspd)    aspdUp  += a.aspd * sa;
      if(a.dmg)     dmgUp   += a.dmg * sa;
      if(a.cdCut)   cdCut   += a.cdCut * sa;
      if(a.rangeUp) rangeUp += a.rangeUp * sa;
    }
    t.ef = {
      range: d.range * (1 + rangeUp),
      cd: Math.max(0.08, d.cd / (1 + aspdUp) * (1 - Math.min(0.6, cdCut))),
      dmg: Math.round(towerPower() * (d.dmg || 0) * sd * (1 + dmgUp))
    };
  }
}
/* 怪身上的减速光环（霜灯 / 荆棘园）：取最强的那一个，不叠加 */
function towerSlowAt(x, y){
  var best = 0;
  for(var i = 0; i < E.builds.length; i++){
    var o = E.builds[i];
    if(o.k !== "tower" || !o.def.aura || !o.def.aura.slow || o.silT > 0) continue;
    if(Math.hypot(o.x - x, o.y - y) > o.def.range) continue;
    best = Math.max(best, o.def.aura.slow * STAR_AURA[o.star - 1]);
  }
  return Math.min(0.6, best);
}
/* 归墟碑给玩家的减伤（mitigate 里跟别的减伤一起吃 BF.cutMax 的封顶）*/
function buildCut(){
  if(!E || !E.builds) return 0;
  var c = 0;
  for(var i = 0; i < E.builds.length; i++){
    var o = E.builds[i];
    if(o.k !== "tower" || !o.def.aura || !o.def.aura.playerCut || o.silT > 0) continue;
    if(Math.hypot(o.x - E.me.x, o.y - E.me.y) > o.def.range) continue;
    c += o.def.aura.playerCut * STAR_AURA[o.star - 1];
  }
  return c;
}

/* 塔造成伤害的唯一口子（标记的加成、护甲都在这儿算）。
   ⚠️ 别绕过它直接改 f.hp —— 「窥影镜」的标记就白做了。 */
function towerHurt(f, d){
  if(f.dead || d <= 0) return;
  if(f.mark > 0) d = d * (1 + f.markPct / 100);
  d = guarded(f, d);
  var out = Math.max(1, Math.round(d) - f.armor);
  f.hp -= out; f.flash = 0.12;
  fxNum(f.x, f.y - f.r - 4, out, false);
  if(f.hp <= 0) killFoe(f);
}
function towerAoe(x, y, r, d, col, ccX){
  if(col) fxRing(x, y, r, col);
  var list = E.foes.slice();
  for(var i = 0; i < list.length; i++){
    var f = list[i];
    if(f.dead) continue;
    if(Math.hypot(f.x - x, f.y - y) > r + f.r) continue;
    towerHurt(f, ccX && (f.mark > 0 || f.slowT > 0) ? d * ccX : d);
  }
}
function towerZap(from, d, n){
  var seen = {}, cur = from, i, j;
  seen[E.foes.indexOf(from)] = 1;
  towerHurt(from, d);
  for(i = 1; i < n; i++){
    var best = -1, bd = 220;
    for(j = 0; j < E.foes.length; j++){
      var f = E.foes[j];
      if(f.dead || seen[j]) continue;
      var dd = Math.hypot(f.x - cur.x, f.y - cur.y);
      if(dd < bd){ bd = dd; best = j; }
    }
    if(best < 0) return;
    var tt = E.foes[best]; seen[best] = 1;
    fxBolt(cur.x, cur.y, tt.x, tt.y);
    towerHurt(tt, d); cur = tt;
  }
}
function towerTarget(t, range){
  var best = null, bd = 1e9;
  for(var i = 0; i < E.foes.length; i++){
    var f = E.foes[i]; if(f.dead) continue;
    var d = Math.hypot(f.x - t.x, f.y - t.y);
    if(d <= range + f.r && d < bd){ bd = d; best = f; }
  }
  return best;
}
/* 雷云柱：在射程里找「周围 splash 之内人最多」的那一团 */
function densestSpot(t, range, r){
  var best = null, bn = 0;
  for(var i = 0; i < E.foes.length; i++){
    var f = E.foes[i]; if(f.dead) continue;
    if(Math.hypot(f.x - t.x, f.y - t.y) > range) continue;
    var n = 0;
    for(var j = 0; j < E.foes.length; j++){
      var o = E.foes[j];
      if(!o.dead && Math.hypot(o.x - f.x, o.y - f.y) <= r) n++;
    }
    if(n > bn){ bn = n; best = f; }
  }
  return best;
}

function fireTower(t, ef){
  var d = t.def, col = TW_COL[d.r], i, f;
  if(d.kind === "shot"){
    f = t.tgt;
    if(!f || f.dead) return;
    var a = Math.atan2(f.y - t.y, f.x - t.x);
    E.tshots.push({kind:"bolt", x:t.x, y:t.y, vx:Math.cos(a) * d.speed, vy:Math.sin(a) * d.speed,
                   r:5, dmg:ef.dmg, col:col, slow:d.slow || null, life:1.6});
  } else if(d.kind === "lob"){
    var lx = d.warn ? t.lockX : (t.tgt ? t.tgt.x : t.x);
    var ly = d.warn ? t.lockY : (t.tgt ? t.tgt.y : t.y);
    var dist = Math.hypot(lx - t.x, ly - t.y);
    E.tshots.push({kind:"lob", x:t.x, y:t.y, x0:t.x, y0:t.y, tx:lx, ty:ly,
                   t:0, dur:Math.max(0.15, dist / d.speed), splash:d.splash, dmg:ef.dmg, col:col});
  } else if(d.kind === "aoe"){
    /* ⚠️ 不传颜色 = 不闪圈：范围塔一秒打一次，每次闪一个 190 的大圈会把画面糊死。
       它的覆盖范围改成在 drawBuilds() 里常驻画一圈很淡的。 */
    towerAoe(t.x, t.y, ef.range, ef.dmg, null, d.ccX);
  } else if(d.kind === "chain"){
    f = t.tgt; if(f && !f.dead){ fxBolt(t.x, t.y, f.x, f.y); towerZap(f, ef.dmg, d.chain); }
  } else if(d.kind === "beam"){
    f = t.tgt; if(f && !f.dead){ t.beamT = 0.2; towerHurt(f, ef.dmg); }
  } else if(d.kind === "pull"){
    fxRing(t.x, t.y, ef.range, col);
    for(i = 0; i < E.foes.length; i++){
      f = E.foes[i]; if(f.dead) continue;
      var dx = t.x - f.x, dy = t.y - f.y, dd = Math.hypot(dx, dy);
      if(dd > ef.range || dd < 14) continue;
      var pull = Math.min(d.pull, dd - 10);
      f.x += dx / dd * pull; f.y += dy / dd * pull;
    }
  } else if(d.kind === "mark"){
    var n = 0;                                   // 标记不闪圈，怪身上自带标记描边
    for(i = 0; i < E.foes.length && n < d.markN; i++){
      f = E.foes[i]; if(f.dead) continue;
      if(Math.hypot(f.x - t.x, f.y - t.y) > ef.range) continue;
      f.mark = d.markSec; f.markPct = d.markPct; n++;
    }
  } else if(d.kind === "storm"){
    f = densestSpot(t, ef.range, d.splash);
    if(f) towerAoe(f.x, f.y, d.splash, ef.dmg, col);
  } else if(d.kind === "vortex"){
    t.vortT = d.dur; fxRing(t.x, t.y, ef.range, col);
  }
}

function updateTowers(dt){
  refreshTowerStats();
  for(var i = 0; i < E.builds.length; i++){
    var t = E.builds[i];
    t.t = (t.t || 0) + dt;
    if(t.k !== "tower") continue;
    var d = t.def, ef = t.ef;
    if(t.beamT > 0) t.beamT -= dt;
    /* 「缚锁者」封住的塔这几秒完全停手（光环塔也一样失效）—— 见 BF_FOES.warder */
    if(t.silT > 0){ t.silT -= dt; t.warn = 0; t.vortT = 0; continue; }
    if(d.kind === "aura") continue;
    /* 塌陷核心：漩涡持续拽人，结束时炸一下 */
    if(t.vortT > 0){
      t.vortT -= dt;
      for(var j = 0; j < E.foes.length; j++){
        var f2 = E.foes[j]; if(f2.dead) continue;
        var dx = t.x - f2.x, dy = t.y - f2.y, dd = Math.hypot(dx, dy);
        if(dd > ef.range || dd < 12) continue;
        var p = Math.min(dd - 10, 260 * dt);
        f2.x += dx / dd * p; f2.y += dy / dd * p;
      }
      if(t.vortT <= 0) towerAoe(t.x, t.y, ef.range * 0.55, ef.dmg, TW_COL[d.r]);
      continue;
    }
    /* 重炮台的抬手：锁死落点之后目标照样会跑 —— 这就是它「很容易打空」的来源 */
    if(t.warn > 0){ t.warn -= dt; if(t.warn <= 0) fireTower(t, ef); continue; }
    t.cd -= dt;
    if(t.cd > 0) continue;
    if(d.kind === "beam" && t.tgt && !t.tgt.dead &&
       Math.hypot(t.tgt.x - t.x, t.tgt.y - t.y) <= ef.range + t.tgt.r){
      /* 光束咬住不放，目标死了或跑出射程才换人 */
    } else t.tgt = towerTarget(t, ef.range);
    var needTgt = d.kind !== "aoe" && d.kind !== "pull" && d.kind !== "mark" &&
                  d.kind !== "storm" && d.kind !== "vortex";
    if(needTgt && !t.tgt) continue;                 // 射程内没人就不空转 CD
    if(!needTgt && !towerTarget(t, ef.range)) continue;
    t.cd = ef.cd;
    if(d.warn){ t.warn = d.warn; t.lockX = t.tgt.x; t.lockY = t.tgt.y; }
    else fireTower(t, ef);
  }
}
function updateTShots(dt){
  for(var i = E.tshots.length - 1; i >= 0; i--){
    var s = E.tshots[i];
    if(s.kind === "lob"){
      s.t += dt;
      var k = Math.min(1, s.t / s.dur);
      s.x = s.x0 + (s.tx - s.x0) * k; s.y = s.y0 + (s.ty - s.y0) * k;
      if(k >= 1){ towerAoe(s.tx, s.ty, s.splash, s.dmg, s.col); E.tshots.splice(i, 1); }
      continue;
    }
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    if(s.life <= 0){ E.tshots.splice(i, 1); continue; }
    for(var j = 0; j < E.foes.length; j++){
      var f = E.foes[j];
      if(f.dead) continue;
      if(Math.hypot(f.x - s.x, f.y - s.y) > f.r + s.r) continue;
      towerHurt(f, s.dmg);
      if(s.slow){ f.slowT = s.slow.sec; f.slowPct = s.slow.pct; }
      E.tshots.splice(i, 1);
      break;
    }
  }
}
/* 泉（每波喝一口）和游商（永久，每五波换货）—— 石箱还在 E.sites 里，走 updateSites */
function updateBuilds(dt){
  var me = E.me;
  for(var i = 0; i < E.builds.length; i++){
    var b = E.builds[i];
    if(b.k !== "spring" && b.k !== "shop") continue;
    if(b.cool > 0) b.cool -= dt;
    if(Math.hypot(me.x - b.x, me.y - b.y) > BF.site.r){ b.inside = false; continue; }
    /* ⚠️ **进入判定圈的那一下才触发**（用户 2026-09-22 之后商摊变成了营地里的常驻建筑，
       站在上面打怪会把弹层刷屏）。走开再回来才会再弹，另外还有 SITE_COOL 秒冷却。 */
    if(b.inside || b.cool > 0) continue;
    b.inside = true;
    if(b.k === "spring"){
      if(b.used){ continue; }
      var s = bstats();
      if(P.hp >= s.maxHp){ b.inside = false; continue; }   // 满血就留着，掉了血踩回来还能喝
      var got = healUp(s.maxHp * BF.springHeal);
      b.used = true;                                // ⚠️ 不删它 —— 下一波自己回复（newWave 里清 used）
      fxText("+" + got, "#266F7B"); fxRing(b.x, b.y, 34, "#266F7B");
    } else { openShop(b); return; }
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
  /* 每只 Boss 各两张（常态 + 狂暴），按 f.bkey 取 —— 加 Boss 不用再动这儿 */
  for(var bk in BF_BOSS){
    IMG["b_" + bk] = mkImg(MOB_ART[BF_BOSS[bk].art], BF_BOSS[bk].col);
    IMG["b_" + bk + "_r"] = mkImg(MOB_ART[BF_BOSS[bk].art], "#D8412F");
  }
  IMG.hero = mkImg(HERO, "#245E8C");
  /* 击杀掉落的互动点：art.js 里现成的三张图，一张新的都没画 */
  IMG.spring = mkImg(SPRING, "#266F7B");
  IMG.shop   = mkImg(SHOP,   "#9C6A10");
  IMG.chest  = mkImg(CHEST,  "#8A6A3A");
}

/* ================================================================
   画面
   ================================================================ */
var cv, ctx2, cw = 360, ch = 640, dpr = 1, padX = 80, padY = 80;
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
  /* 部署时：镜头 = 人 + 半个面板 + 玩家自己平移的那一点，缩放以屏幕中心为定点。
     ⚠️ camShift 要除以 ZOOM —— 它是**屏幕**上的半个面板高，换算回世界就得除一次。 */
  if(DEPLOY){ CAM.x = me.x + PAN.x; CAM.y = me.y + camShift / ZOOM + PAN.y; }
  ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx2.clearRect(0, 0, cw, ch);
  ctx2.fillStyle = "#F1EBDD"; ctx2.fillRect(0, 0, cw, ch);
  ctx2.save();
  ctx2.translate(cw / 2, ch / 2); ctx2.scale(ZOOM, ZOOM); ctx2.translate(-cw / 2, -ch / 2);
  /* 缩小之后看得见的范围变大了，所以视野和剔除边界都要按 1/ZOOM 放开 */
  var vw = cw / ZOOM, vh = ch / ZOOM;
  padX = (vw - cw) / 2 + 80; padY = (vh - ch) / 2 + 80;
  /* 地板：56px 的格线 + 按坐标哈希撒的石纹。一个字节的地图数据都不存。 */
  var GS = 56, x0 = Math.floor((CAM.x - vw / 2) / GS) * GS, y0 = Math.floor((CAM.y - vh / 2) / GS) * GS;
  /* ⚠️ 线宽要除一次 ZOOM —— transform 会把它一起缩，缩到 0.55 就基本看不见了 */
  ctx2.strokeStyle = "#E4DDCE"; ctx2.lineWidth = 1 / ZOOM; ctx2.beginPath();
  for(var gx = x0; gx < CAM.x + vw / 2 + GS; gx += GS){ ctx2.moveTo(sx(gx), -padY); ctx2.lineTo(sx(gx), ch + padY); }
  for(var gy = y0; gy < CAM.y + vh / 2 + GS; gy += GS){ ctx2.moveTo(-padX, sy(gy)); ctx2.lineTo(cw + padX, sy(gy)); }
  ctx2.stroke();
  ctx2.fillStyle = "#DED6C4";
  for(gx = x0; gx < CAM.x + vw / 2 + GS; gx += GS)
    for(gy = y0; gy < CAM.y + vh / 2 + GS; gy += GS){
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
    } else if(b.cast === "quake"){
      ctx2.beginPath(); ctx2.arc(sx(b.qx), sy(b.qy), b.def.quake.r, 0, 6.2832);
      ctx2.fill(); ctx2.stroke();
    } else if(b.cast === "nails" && b.nails){
      for(var q = 0; q < b.nails.length; q++){
        ctx2.beginPath(); ctx2.arc(sx(b.nails[q].x), sy(b.nails[q].y), b.def.nails.r, 0, 6.2832);
        ctx2.fill(); ctx2.stroke();
      }
    } else if(b.cast === "chain"){
      var cw2 = b.def.chain.w, cl = b.def.chain.len;
      ctx2.save(); ctx2.translate(sx(b.x), sy(b.y)); ctx2.rotate(b.castDir);
      ctx2.beginPath(); ctx2.rect(0, -cw2 / 2, cl, cw2);
      ctx2.fill(); ctx2.stroke(); ctx2.restore();
    }
  }
  /* 建筑（塔 / 城墙 / 泉 / 商）画在怪底下 */
  drawBuilds();

  /* 石箱。脚下画一圈淡光圈，远远就能看见 */
  for(i = 0; i < E.sites.length; i++){
    var t = E.sites[i], tx2 = sx(t.x), ty2 = sy(t.y);
    if(tx2 < -padX || tx2 > cw + padX || ty2 < -padY || ty2 > ch + padY) continue;
    ctx2.strokeStyle = "#8A6A3A"; ctx2.globalAlpha = 0.30 + 0.16 * Math.sin(t.t * 2.6); ctx2.lineWidth = 2.5;
    ctx2.beginPath(); ctx2.arc(tx2, ty2, BF.site.r + 6, 0, 6.2832); ctx2.stroke();
    ctx2.globalAlpha = 1;
    var tim = IMG.chest;
    if(tim && tim.complete && tim.naturalWidth) ctx2.drawImage(tim, tx2 - 21, ty2 - 23, 42, 42);
  }

  /* 掉落 */
  ctx2.fillStyle = "#E3B23C"; ctx2.strokeStyle = "#8A5F0C"; ctx2.lineWidth = 1;
  for(i = 0; i < E.drops.length; i++){ var dp = E.drops[i];
    ctx2.beginPath(); ctx2.arc(sx(dp.x), sy(dp.y), 5, 0, 6.2832); ctx2.fill(); ctx2.stroke(); }

  /* 怪 */
  for(i = 0; i < E.foes.length; i++){
    var f = E.foes[i]; if(f.dead) continue;
    var px = sx(f.x), py = sy(f.y), sz = f.r * 2.4;
    if(px < -padX || px > cw + padX || py < -padY || py > ch + padY) continue;
    if(f.blinkWarn > 0 && f.ghostX !== undefined){
      ctx2.globalAlpha = 0.3; drawImg(f, sx(f.ghostX), sy(f.ghostY), sz); ctx2.globalAlpha = 1; }
    /* 远程怪的抬手预警：一圈往里收的环 + 身上一点高光 */
    if(f.castT > 0 && f.def.shot){
      var wt = f.castT / (f.def.shot.warn || 0.45);
      ctx2.strokeStyle = f.col; ctx2.globalAlpha = 0.9; ctx2.lineWidth = 2.5;
      ctx2.beginPath(); ctx2.arc(px, py, f.r + 6 + wt * 26, 0, 6.2832); ctx2.stroke();
      ctx2.globalAlpha = 1;
    }
    /* 拒马：身上一圈淡光标出它护住的范围 —— 不画的话玩家不知道为什么打不动 */
    if(f.def.guard){
      ctx2.strokeStyle = f.col; ctx2.globalAlpha = 0.22; ctx2.lineWidth = 2;
      ctx2.beginPath(); ctx2.arc(px, py, f.def.guard.r, 0, 6.2832); ctx2.stroke();
      ctx2.globalAlpha = 1;
    }
    /* 爆囊：引信期间一圈往里收的预警，收到实心那一下就炸 */
    if(f.fuse > 0 && f.def.boom){
      var ft = f.fuse / f.def.boom.warn;
      ctx2.strokeStyle = "#C2510E"; ctx2.lineWidth = 3;
      ctx2.beginPath(); ctx2.arc(px, py, f.def.boom.r * (0.25 + 0.75 * ft), 0, 6.2832); ctx2.stroke();
      ctx2.globalAlpha = 0.14; ctx2.fillStyle = "#C2510E";
      ctx2.beginPath(); ctx2.arc(px, py, f.def.boom.r, 0, 6.2832); ctx2.fill();
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

  /* 塔的弹丸：直射是小方块，抛射是带影子的圆 */
  for(i = 0; i < E.tshots.length; i++){
    var ts = E.tshots[i];
    ctx2.fillStyle = ts.col;
    if(ts.kind === "lob"){
      var kk = Math.min(1, ts.t / ts.dur), lift = Math.sin(kk * Math.PI) * 26;
      ctx2.globalAlpha = 0.18;
      ctx2.beginPath(); ctx2.arc(sx(ts.x), sy(ts.y), 5, 0, 6.2832); ctx2.fill();
      ctx2.globalAlpha = 1;
      ctx2.beginPath(); ctx2.arc(sx(ts.x), sy(ts.y) - lift, 6, 0, 6.2832); ctx2.fill();
    } else {
      ctx2.fillRect(sx(ts.x) - 3, sy(ts.y) - 3, 6, 6);
    }
  }
  /* 灼光塔的光束 */
  for(i = 0; i < E.builds.length; i++){
    var bt = E.builds[i];
    if(bt.k !== "tower" || !(bt.beamT > 0) || !bt.tgt || bt.tgt.dead) continue;
    ctx2.strokeStyle = TW_COL[bt.def.r]; ctx2.globalAlpha = 0.75; ctx2.lineWidth = 3;
    ctx2.beginPath(); ctx2.moveTo(sx(bt.x), sy(bt.y) - 10); ctx2.lineTo(sx(bt.tgt.x), sy(bt.tgt.y)); ctx2.stroke();
    ctx2.globalAlpha = 1;
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
  ctx2.restore();
}
/* 建筑：塔是「品质色的底 + 一个形状 + 星点」，一张新图都没加。
   ⚠️ 射程圈只在**部署阶段**画 —— 打起来时九个圈会把画面糊死。 */
function drawBuilds(){
  var i, b, px, py;
  /* 部署时：能摆的范围 + 每座塔的射程 */
  if(DEPLOY){
    ctx2.strokeStyle = "#245E8C"; ctx2.globalAlpha = 0.22; ctx2.lineWidth = 2;
    ctx2.setLineDash([8, 8]);
    ctx2.beginPath(); ctx2.arc(sx(E.me.x), sy(E.me.y), BF.deploy.placeR, 0, 6.2832); ctx2.stroke();
    ctx2.setLineDash([]);
    for(i = 0; i < E.builds.length; i++){
      b = E.builds[i]; if(b.k !== "tower") continue;
      var rr = b.ef ? b.ef.range : b.def.range;
      ctx2.strokeStyle = TW_COL[b.def.r]; ctx2.globalAlpha = b.def.aura ? 0.28 : 0.16;
      ctx2.beginPath(); ctx2.arc(sx(b.x), sy(b.y), rr, 0, 6.2832); ctx2.stroke();
    }
    ctx2.globalAlpha = 1;
    /* 拖动中的落点：绿圈能放、红圈放不下（挨太近或者出了摆放范围）*/
    if(DRAG && (DRAG.mode === "place" || DRAG.mode === "move")){
      var gx2 = DRAG.mode === "place" ? DRAG.x : DRAG.b.x;
      var gy2 = DRAG.mode === "place" ? DRAG.y : DRAG.b.y;
      ctx2.strokeStyle = DRAG.ok ? "#47702F" : "#A93729"; ctx2.lineWidth = 2.5;
      ctx2.globalAlpha = 0.85;
      ctx2.beginPath(); ctx2.arc(sx(gx2), sy(gy2), BF.deploy.gap / 2, 0, 6.2832); ctx2.stroke();
      if(DRAG.mode === "place"){
        ctx2.globalAlpha = 0.5;
        ctx2.beginPath(); ctx2.moveTo(sx(gx2) - 9, sy(gy2)); ctx2.lineTo(sx(gx2) + 9, sy(gy2));
        ctx2.moveTo(sx(gx2), sy(gy2) - 9); ctx2.lineTo(sx(gx2), sy(gy2) + 9); ctx2.stroke();
      }
      ctx2.globalAlpha = 1;
    }
  }
  /* 范围塔（尖刺台 / 荆棘园 / 裁决之环）的覆盖范围常驻一圈很淡的 ——
     它们一秒打一次，不画的话玩家根本不知道自己站没站在里面。 */
  if(!DEPLOY){
    ctx2.lineWidth = 1.5;
    for(i = 0; i < E.builds.length; i++){
      b = E.builds[i];
      if(b.k !== "tower" || b.def.kind !== "aoe") continue;
      ctx2.strokeStyle = TW_COL[b.def.r]; ctx2.globalAlpha = 0.13;
      ctx2.beginPath(); ctx2.arc(sx(b.x), sy(b.y), b.ef ? b.ef.range : b.def.range, 0, 6.2832);
      ctx2.stroke();
    }
    ctx2.globalAlpha = 1;
  }
  for(i = 0; i < E.builds.length; i++){
    b = E.builds[i]; px = sx(b.x); py = sy(b.y);
    if(px < -padX || px > cw + padX || py < -padY || py > ch + padY) continue;
    if(b.k === "spring" || b.k === "shop"){
      var tc = b.k === "spring" ? "#266F7B" : "#9C6A10";
      var dim = (b.k === "spring" && b.used) || b.cool > 0 ? 0.38 : 1;
      ctx2.strokeStyle = tc; ctx2.globalAlpha = (0.30 + 0.16 * Math.sin(b.t * 2.6)) * dim; ctx2.lineWidth = 2.5;
      ctx2.beginPath(); ctx2.arc(px, py, BF.site.r + 6, 0, 6.2832); ctx2.stroke();
      ctx2.globalAlpha = dim;
      var im = IMG[b.k];
      if(im && im.complete && im.naturalWidth) ctx2.drawImage(im, px - 21, py - 23, 42, 42);
      ctx2.globalAlpha = 1;
      continue;
    }
    drawTower(b, px, py);
  }
}
function drawTower(b, px, py){
  var col = TW_COL[b.def.r], s = 13;
  if(b.silT > 0){                       // 被封锁：整座画淡一档，外面套一圈紫环
    ctx2.strokeStyle = "#6B4A8A"; ctx2.lineWidth = 2.5;
    ctx2.beginPath(); ctx2.arc(px, py, s + 6, 0, 6.2832); ctx2.stroke();
    ctx2.globalAlpha = 0.42;
  }
  /* 底座 */
  ctx2.fillStyle = "rgba(46,42,35,.13)";
  ctx2.beginPath(); ctx2.ellipse(px, py + 9, s + 2, 5, 0, 0, 6.2832); ctx2.fill();
  ctx2.fillStyle = "#FCF8F0"; ctx2.strokeStyle = col; ctx2.lineWidth = 2.5;
  ctx2.beginPath(); ctx2.arc(px, py, s, 0, 6.2832); ctx2.fill(); ctx2.stroke();
  /* 形状：每种塔一个，认形不认字 */
  ctx2.fillStyle = col; ctx2.strokeStyle = col; ctx2.lineWidth = 2; ctx2.lineCap = "round";
  var k = b.def.shape;
  ctx2.beginPath();
  if(k === "spire"){ ctx2.moveTo(px, py - 8); ctx2.lineTo(px + 5, py + 6); ctx2.lineTo(px - 5, py + 6); ctx2.closePath(); ctx2.fill(); }
  else if(k === "spike"){ for(var a = 0; a < 6; a++){ var an = a / 6 * 6.2832;
      ctx2.moveTo(px + Math.cos(an) * 3, py + Math.sin(an) * 3);
      ctx2.lineTo(px + Math.cos(an) * 8, py + Math.sin(an) * 8); } ctx2.stroke(); }
  else if(k === "lob"){ ctx2.arc(px, py + 2, 5, 0, 6.2832); ctx2.fill();
      ctx2.beginPath(); ctx2.moveTo(px - 7, py + 6); ctx2.lineTo(px + 2, py - 7); ctx2.stroke(); }
  else if(k === "flame"){ ctx2.moveTo(px, py - 8); ctx2.quadraticCurveTo(px + 6, py + 1, px, py + 7);
      ctx2.quadraticCurveTo(px - 6, py + 1, px, py - 8); ctx2.fill(); }
  else if(k === "drum"){ ctx2.ellipse(px, py, 8, 5, 0, 0, 6.2832); ctx2.stroke();
      ctx2.beginPath(); ctx2.moveTo(px - 8, py); ctx2.lineTo(px + 8, py); ctx2.stroke(); }
  else if(k === "crystal"){ ctx2.moveTo(px, py - 8); ctx2.lineTo(px + 6, py); ctx2.lineTo(px, py + 8);
      ctx2.lineTo(px - 6, py); ctx2.closePath(); ctx2.fill(); }
  else if(k === "banner"){ ctx2.moveTo(px - 4, py + 8); ctx2.lineTo(px - 4, py - 8); ctx2.stroke();
      ctx2.beginPath(); ctx2.moveTo(px - 4, py - 8); ctx2.lineTo(px + 7, py - 4); ctx2.lineTo(px - 4, py); ctx2.closePath(); ctx2.fill(); }
  else if(k === "arc"){ ctx2.moveTo(px + 3, py - 8); ctx2.lineTo(px - 4, py); ctx2.lineTo(px + 2, py);
      ctx2.lineTo(px - 3, py + 8); ctx2.stroke(); }
  else if(k === "eye"){ ctx2.ellipse(px, py, 8, 5, 0, 0, 6.2832); ctx2.stroke();
      ctx2.beginPath(); ctx2.arc(px, py, 2.6, 0, 6.2832); ctx2.fill(); }
  else if(k === "cannon"){ ctx2.arc(px - 2, py + 3, 5, 0, 6.2832); ctx2.fill();
      ctx2.beginPath(); ctx2.lineWidth = 4; ctx2.moveTo(px - 2, py + 2); ctx2.lineTo(px + 7, py - 6); ctx2.stroke(); }
  else if(k === "beam"){ ctx2.arc(px, py, 4, 0, 6.2832); ctx2.fill();
      ctx2.beginPath(); ctx2.moveTo(px + 5, py); ctx2.lineTo(px + 9, py); ctx2.stroke(); }
  else if(k === "bramble"){ for(var q = 0; q < 3; q++){ var qa = q / 3 * 6.2832;
      ctx2.moveTo(px, py); ctx2.lineTo(px + Math.cos(qa) * 8, py + Math.sin(qa) * 8);
      ctx2.lineTo(px + Math.cos(qa + 0.5) * 5, py + Math.sin(qa + 0.5) * 5); } ctx2.stroke(); }
  else if(k === "horn"){ ctx2.moveTo(px - 7, py + 4); ctx2.quadraticCurveTo(px + 2, py + 2, px + 7, py - 6);
      ctx2.lineTo(px + 3, py - 7); ctx2.quadraticCurveTo(px - 2, py - 1, px - 7, py); ctx2.closePath(); ctx2.fill(); }
  else if(k === "storm"){ ctx2.moveTo(px - 8, py - 3); ctx2.quadraticCurveTo(px, py - 9, px + 8, py - 3); ctx2.stroke();
      ctx2.beginPath(); ctx2.moveTo(px + 2, py - 1); ctx2.lineTo(px - 3, py + 4); ctx2.lineTo(px + 1, py + 4);
      ctx2.lineTo(px - 2, py + 9); ctx2.stroke(); }
  else if(k === "vortex"){ for(var v = 0; v < 18; v++){ var va = v / 18 * 7, vr = 2 + v * 0.42;
      if(v === 0) ctx2.moveTo(px + Math.cos(va) * vr, py + Math.sin(va) * vr);
      else ctx2.lineTo(px + Math.cos(va) * vr, py + Math.sin(va) * vr); } ctx2.stroke(); }
  else if(k === "forge"){ ctx2.moveTo(px - 7, py + 6); ctx2.lineTo(px - 4, py - 5); ctx2.lineTo(px + 4, py - 5);
      ctx2.lineTo(px + 7, py + 6); ctx2.closePath(); ctx2.fill();
      ctx2.fillStyle = "#FCF8F0"; ctx2.beginPath(); ctx2.arc(px, py + 2, 2.4, 0, 6.2832); ctx2.fill(); }
  else if(k === "ring"){ ctx2.arc(px, py, 8, 0, 6.2832); ctx2.stroke();
      ctx2.beginPath(); ctx2.arc(px, py, 3.4, 0, 6.2832); ctx2.stroke(); }
  else { ctx2.moveTo(px, py - 9); ctx2.lineTo(px + 4, py + 7); ctx2.lineTo(px - 4, py + 7); ctx2.closePath(); ctx2.fill(); }
  /* 星点：几星就几个点 */
  ctx2.fillStyle = "#A8891C";
  for(var st = 0; st < b.star; st++){
    ctx2.beginPath();
    ctx2.arc(px + (st - (b.star - 1) / 2) * 6, py - s - 5, 2.2, 0, 6.2832); ctx2.fill();
  }
  ctx2.globalAlpha = 1;
}
function drawImg(f, px, py, sz){
  var im = f.boss ? IMG["b_" + (f.bkey || "warden") + (f.rage ? "_r" : "")] : IMG[f.id];
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
/* ================================================================
   部署阶段的手势（用户 2026-09-22：「塔可以拖动选择位置在放置时」）
   ⚠️ 监听挂在 **document** 上，不是画布 —— 这样「从备战区那一格按下去、一路拖到画面上松手」
      才收得到 move/up。挂在画布上的话拖出画布就断了。
   ⚠️ 三种手势用一个 DRAG 收口，别再各写一套：
      place 手上有牌 → 松手那一点摆下去；move 拖场上的建筑挪位置（原地点一下 = 收回备战区）；
      pan  空白处拖 = 平移镜头。两根手指 = 缩放（这时 DRAG 直接作废）。
   ================================================================ */
var DRAG = null, PTRS = {}, pinchD = 0, pinchZ = 1;
function ptrN(){ var n = 0, k; for(k in PTRS) n++; return n; }
function ptrDist(){
  var a = null, b = null, k;
  for(k in PTRS){ if(!a) a = PTRS[k]; else if(!b) b = PTRS[k]; }
  return (a && b) ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
}
/* 松手那一点是不是落在画面上（不是落在底下那块部署面板上）*/
function overStage(cy){
  var d = $("deploy");
  return d.hidden || cy < d.getBoundingClientRect().top;
}
function deployDown(e, fromBench){
  PTRS[e.pointerId] = {x:e.clientX, y:e.clientY};
  if(ptrN() >= 2){ DRAG = null; pinchD = ptrDist(); pinchZ = ZOOM; return; }
  var w = screenToWorld(e.clientX, e.clientY);
  if(selBench >= 0){
    DRAG = {mode:"place", x:w.x, y:w.y, ok:canPlace(w.x, w.y), fromBench:!!fromBench};
    return;
  }
  if(fromBench) return;
  var b = buildAt(w.x, w.y);
  if(b) DRAG = {mode:"move", b:b, ox:b.x - w.x, oy:b.y - w.y, bx:b.x, by:b.y, moved:false, ok:true};
  else  DRAG = {mode:"pan", sx0:e.clientX, sy0:e.clientY, px0:PAN.x, py0:PAN.y};
}
function deployMove(e){
  if(!DEPLOY) return;
  if(PTRS[e.pointerId]){ PTRS[e.pointerId].x = e.clientX; PTRS[e.pointerId].y = e.clientY; }
  if(ptrN() >= 2){
    var d = ptrDist();
    if(pinchD > 8 && d > 8) setZoom(pinchZ * d / pinchD);
    return;
  }
  if(!DRAG) return;
  var w = screenToWorld(e.clientX, e.clientY);
  if(DRAG.mode === "place"){
    DRAG.x = w.x; DRAG.y = w.y; DRAG.ok = canPlace(w.x, w.y) && overStage(e.clientY);
  } else if(DRAG.mode === "move"){
    if(Math.hypot(w.x + DRAG.ox - DRAG.bx, w.y + DRAG.oy - DRAG.by) > 6) DRAG.moved = true;
    DRAG.b.x = w.x + DRAG.ox; DRAG.b.y = w.y + DRAG.oy;
    DRAG.ok = canPlace(DRAG.b.x, DRAG.b.y, DRAG.b);
  } else {
    PAN.x = DRAG.px0 - (e.clientX - DRAG.sx0) / ZOOM;
    PAN.y = DRAG.py0 - (e.clientY - DRAG.sy0) / ZOOM;
    clampPan();
  }
}
function deployUp(e){
  delete PTRS[e.pointerId];
  if(ptrN() < 2) pinchD = 0;
  if(!DEPLOY || !DRAG) return;
  var d = DRAG; DRAG = null;
  if(d.mode === "place"){
    /* 松手落在面板上 = 不摆，牌还捏在手里（从备战区拖出来又拖回去时很自然）*/
    if(overStage(e.clientY)) placeAt(d.x, d.y);
  } else if(d.mode === "move"){
    if(!d.moved){ d.b.x = d.bx; d.b.y = d.by; pickUp(d.b); }        // 原地点一下 = 收回备战区
    else if(!canPlace(d.b.x, d.b.y, d.b)){ d.b.x = d.bx; d.b.y = d.by; }   // 摆不下就弹回原位
  }
  renderDeploy();
}
function bindInput(){
  var el = $("cv"), st = $("stick"), nub = $("stickNub");
  el.addEventListener("pointerdown", function(e){
    /* ⚠️ **必须 preventDefault**（用户 2026-09-22 报：弹窗关掉之后第一次按屏幕会弹出放大镜）。
       手机浏览器把 canvas 上的按下拖动当成"选文字"，于是弹出选择放大镜。
       光靠 CSS 的 user-select 挡不住，还得把这一下的默认行为吃掉。
       ⚠️ 别挪到 return 后面 —— 暂停时按下去也一样会弹放大镜。 */
    e.preventDefault();
    if(DEPLOY){ deployDown(e, false); return; }
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
  /* 部署阶段的拖动/缩放挂在 document 上（见 deployDown 的注释），
     跟摇杆那一套互不干扰 —— 它们各自先看 DEPLOY 再决定要不要接。 */
  document.addEventListener("pointermove", deployMove);
  document.addEventListener("pointerup", deployUp);
  document.addEventListener("pointercancel", deployUp);
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
  updateTowers(dt); updateTShots(dt); updateBuilds(dt);
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
      var d2 = guarded(f, Math.max(1, Math.round(s.atk * w.mult) - f.armor));
      f.hp -= d2; f.flash = 0.12;
      fxNum(f.x, f.y - f.r - 4, d2, false);
      if(f.hp <= 0) killFoe(f);
    }
  }
}

function nextWave(){
  var w = P.wave + 1;
  P.wrong2 = P.wrong1; P.wrong1 = G.wrongN; P.brokeLast = G.broke;   // 循迹 / 惜盾看的是上一波
  if(!G.siteN) pitySite();                                           // 这一波一个箱都没掉 → 补一个
  /* 箱的次数每 every 波重置一轮 */
  var cyc = Math.floor((w - 1) / BF.site.chest.every);
  if(cyc !== P.chestCycle){ P.chestCycle = cyc; P.chestN = 0; }
  newWave(w);
  if(isBossWave(w)) startBoss(w);
  /* 每 BF.deploy.every 波一次部署阶段（用户 2026-09-22）。
     ⚠️ 部署波（w%5===1）和 Boss 波（w%10===0）永远撞不上，不用兜。 */
  if(isDeployWave(w)) openDeploy();
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
  PAUSED = anyVeil() || OVER || DEPLOY;
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
/* ⚠️ **祝福系统（偏爱 / 封印）不作用于战场**（用户 2026-09-22 明确）——
   battle.js 从头到尾不读 `youxu.town.v1`，也没有 blessPick()，这里就是纯随机。
   以后别顺手把地牢的 blessPick() 搬过来。 */
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
  $("pickTitle").textContent = "升到 " + P.lvl + " 级 · 挑一件遗物" +
    (pendPicks > 1 ? "（还有 " + (pendPicks - 1) + " 次）" : "");
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
    if(oldId === null){ sellRelicGold(RMAP[nid]); }
    else {
      var i = P.relics.indexOf(oldId);
      if(i >= 0){ sellRelicGold(RMAP[oldId]); P.relics.splice(i, 1); }
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
/* 遗物换成金币的唯一口子 —— 「寄存」的护盾转化收口在这儿，别在别处再抄一份。 */
function sellRelicGold(r){
  addGold(sellPrice(r));
  if(has("deposit")) addShield(Math.round(sellPrice(r) * 0.10));
}
function sellRelic(id){
  if(sellArmed !== id){ sellArmed = id; openBag(); return; }
  sellArmed = null;
  withMaxHp(function(){
    var i = P.relics.indexOf(id);
    if(i >= 0){ sellRelicGold(RMAP[id]); P.relics.splice(i, 1); reindex(); }
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
   石箱（击杀掉落）
   ⚠️ **泉和商已经不在这儿了**（用户 2026-09-22 的塔防改版）——
      它们现在是玩家在部署阶段摆的**建筑**，永久存在，逻辑在 updateBuilds()。
      这一节只剩箱子。**别把 spring / shop 加回来。**
   ================================================================ */
function dropSite(kind, x, y){
  if(G) G.siteN = (G.siteN || 0) + 1;
  P.chestN++;
  E.sites.push({kind:kind, x:x, y:y, t:0, cool:0, bornWave:P.wave});
  while(E.sites.length > BF.site.max) E.sites.shift();
}
/* 这一轮（每 every 波一轮）还能不能掉箱 */
function chestLeft(){ return BF.site.chest.max - P.chestN; }
/* 每次击杀掷一次。⚠️ 这不是遗物效果，所以用 Math.random() 不走 luck()。 */
function maybeSite(f){
  if(chestLeft() <= 0) return;
  if(f.boss){ dropSite("chest", f.x - 40, f.y); dropSite("chest", f.x + 40, f.y); return; }
  if(f.elite){ if(Math.random() < BF.site.eliteRate) dropSite("chest", f.x, f.y); return; }
  if(Math.random() < BF.site.chest.p) dropSite("chest", f.x, f.y);
}
/* 每波保底一个箱：一整波一个都没掉的话，进下一波时在玩家边上补一个。
   ⚠️ 别把保底删了 —— 早期一波只杀 20 来只，不兜底经常整波空手。 */
function pitySite(){
  if(chestLeft() <= 0) return;
  var a = Math.random() * Math.PI * 2, d = 150 + Math.random() * 80;
  dropSite("chest", E.me.x + Math.cos(a) * d, E.me.y + Math.sin(a) * d);
}
function updateSites(dt){
  var me = E.me;
  for(var i = E.sites.length - 1; i >= 0; i--){
    var t = E.sites[i]; t.t += dt;
    if(Math.hypot(me.x - t.x, me.y - t.y) > BF.site.r) continue;
    var got = rollRelics(1, P.wave + 6)[0];
    E.sites.splice(i, 1);
    if(!got) continue;                        // 209 件全带齐了（理论上到不了）
    fxText(got.n, "#8A6A3A"); fxRing(t.x, t.y, 34, "#8A6A3A");
    grantRelic(got.id, null);                 // 带满了 grantRelic 自己会弹取舍窗
    return;
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
/* 「走了」：游商是**永久建筑**，关窗只给它 SITE_COOL 秒冷却 + 把人推开，
   别改成删掉 —— 钱不够的时候玩家应该能去刷一波再回来。 */
var SITE_COOL = 5;
function leaveSite(t){ t.cool = SITE_COOL; t.inside = false; stepOffSite(t); }

/* ---- 游商（现在是玩家摆下去的建筑，永久存在）----
   ⚠️ **每五波刷新一次货架**（openDeploy() 里把 stock 清成 null），
      而且**不能手动刷新**（用户 2026-09-22）—— btnShopRe 那套已经删干净了，别加回来。 */
var curShop = null;
function shopMarkup(r){ return (r.r >= 2 ? 1.3 * 1.8 : 1.3); }
function shopPrice(row){ return Math.ceil(row.price * (has("regular") ? 0.85 : 1)); }
function rollShopStock(){
  var n = BF.relicShopN + (has("key") ? 2 : 0);
  return rollRelics(n, P.wave + 4).map(function(r){
    return {id:r.id, price: Math.ceil(sellPrice(r) * shopMarkup(r)), sold:false};
  });
}
function openShop(t){
  curShop = t;
  if(!t.stock) t.stock = rollShopStock();
  renderShop(); show("veilShop");
}
function renderShop(){
  var t = curShop; if(!t) return;
  $("shopSub").textContent = "金币 " + P.gold + " · 每五波换一批货";
  var h = "", i;
  for(i = 0; i < t.stock.length; i++){
    var row = t.stock[i], r = RMAP[row.id];
    h += cardHtml(r, '<span class="cost">' + shopPrice(row) + ' 金</span>',
                  row.sold || P.gold < shopPrice(row) ? "dim" : "");
  }
  $("shopList").innerHTML = h || '<p class="sub">货架空了。</p>';
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
  if(DEPLOY) closeDeploy();
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
    st2("遗物", P.relics.length) + st2("特殊遗物", P.special.length) +
    st2("部署等级", P.dlvl) + st2("场上的塔", fieldTowers());
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
    $("veilStart").classList.remove("on"); last = 0;
    openDeploy();                          // 用户：**开始游戏时也进入一次部署阶段**
  });

  /* ---- 部署面板 ---- */
  /* ⚠️ 备战区走 **pointerdown** 不走 click：按下去就选中并开始拖，
     一路拖到画面上松手就摆下去（用户 2026-09-22 要的「拖动选择位置」）。
     松手还在面板上就只是选中，牌还捏在手里。 */
  $("dBench").addEventListener("pointerdown", function(e){
    var b = e.target.closest ? e.target.closest(".bs") : null;
    if(!b || b.dataset.i === undefined) return;
    var i = +b.dataset.i;
    e.preventDefault();                                   // 别让拖备战区变成选文字
    if(selBench === i){ selBench = -1; renderDeploy(); return; }
    selBench = i; renderDeploy();
    deployDown(e, true);
  });
  $("btnDShop").addEventListener("click", openTwShop);
  $("btnDLvl").addEventListener("click", levelUp);
  $("btnDSell").addEventListener("click", function(){ if(selBench >= 0) sellBench(selBench); });
  $("btnDeployGo").addEventListener("click", closeDeploy);

  /* ---- 塔的商店（弹窗）---- */
  /* ⚠️ 缩放的 ± 按钮 2026-09-22 删了（用户：「不用加减按钮」）——
     手机用两指捏合，桌面用滚轮。别把按钮加回来。 */
  $("cv").addEventListener("wheel", function(e){
    if(!DEPLOY) return;
    e.preventDefault();
    setZoom(ZOOM * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
  }, {passive:false});

  $("twShopList").addEventListener("click", function(e){
    var b = e.target.closest ? e.target.closest(".tw") : null;
    if(b && b.dataset.i !== undefined) buyCard(+b.dataset.i);
  });
  $("btnTwRe").addEventListener("click", rerollShop);
  $("btnTwClose").addEventListener("click", function(){ hide("veilTwShop"); renderDeploy(); });

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
  $("btnShopClose").addEventListener("click", function(){
    if(curShop) leaveSite(curShop);                          // 摊子留着，回头攒够钱还能来
    curShop = null; hide("veilShop");
  });

  $("btnAgain").addEventListener("click", function(){
    $("veilEnd").classList.remove("on"); OVER = false;
    newRun(); pendPicks = 0; pendSpecial = 0; last = 0;
    openDeploy();
  });

  show("veilStart");
  requestAnimationFrame(frame);
}
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
