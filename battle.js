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
  xpNeed: function(lv){
    var n = Math.ceil((8 + 6 * (lv - 1)) * 3.6);
    /* ⚠️ **40 级往上再 ×3**（用户 2026-09-22）—— 深波数的经验本来就滚雪球，
       不刹一下的话 60 级之后一波能升七八级。别去砍怪的 xp 来代替它。 */
    return lv >= 40 ? n * 3 : n;
  },
  /* **超过这一级就不再发遗物四选一**（用户 2026-09-22）——
     15 个遗物位早就满了，再弹只是打断节奏。升级本身照旧给面板。 */
  pickLvlMax: 80,
  /* 怪掉的金币统一乘这个（用户 2026-09-22：**金币爆率 −50%**）。
     Boss 掉的那一笔也吃，别单独开小灶。 */
  goldMult: 0.5,
  /* ===== 第 40 波是终点（用户 2026-09-22）=====
     打完第 40 波的「墟心冕者」这一趟就算通了；再往下**不再有新怪**，
     改成 1–40 波的怪**混着出**（lateWaveDef()），数值靠 lateRamp 一直往上堆。
     ⚠️ 难度层 2~5 的解锁条件就是「上一层走过第 tierClear 波」。 */
  lateFrom: 40,         // 第几波之后开始混出
  lateEvery: 10,        // 每几波加一档
  lateRamp: 0.10,       // 每档给怪的血量和伤害各 +10%（乘上去）
  tierClear: 40,        // 通过前一层的第几波才解锁下一层
  specialMax: 5,        // 特殊遗物最多带几件（用户 2026-09-22）；满了再拿要换掉一件
  spawnPad: 60,         // 在相机外这么远的一圈上刷怪
  shieldSeedScale: 1,   // 护盾类种子的统一缩放（留给调平衡）
  /* 护盾封顶 = 生命上限 × 这个数（用户 2026-09-22：「护盾不能超过血量上限的两倍」）。
     ⚠️ 收口在 addShield() 里，**所有给盾的路都从那儿过**；别在别处再写一遍。 */
  shieldMaxX: 2,

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
   1 级白送，一路升到 9 级一共 **3990 金**。
   ⚠️ **4~9 级那一段 2026-09-22 又翻了一倍**（用户要求）：升到 9 级从 2000 变成 3990，
      所以「爬人口」和「凑三星」现在是真正的取舍，别偷偷调回去。
   ⚠️ **2026-09-22 用户把升级和塔的价格一起 ×5**，同时取消了利息 ——
      于是「买得起几座塔」直接由**杀了多少怪**决定，固定收入只是个底。
   ⚠️ 少写一项就会在升 9 级那一下把 P.gold 变成 NaN（踩过）—— 改上限记得跟着补。 */
var DLVL_COST = [0, 0, 40, 70, 220, 320, 460, 640, 900, 1240];

/* 波次三旋钮（设计文档第三节）。Boss 波不走这套。 */
/* 第 40 波之后的额外压迫（用户 2026-09-22：「后面关卡是 1–40 的怪物混出，不断增加数值」）。
   ⚠️ **只乘血量和伤害**，别去乘移速和密度 —— 那两样一涨就把走位玩法关掉了
      （跟地牢 ENDLESS_RAMP 那条注释是同一件事）。 */
function lateRamp(w){
  if(w <= BF.lateFrom) return 1;
  return Math.pow(1 + BF.lateRamp, Math.floor((w - BF.lateFrom - 1) / BF.lateEvery) + 1);
}
function waveRate(w){ return 0.75 + 0.22 * (w - 1); }
function waveCap(w){  return Math.min(70, 22 + 4 * w); }
function hpMul(w){    return (1 + 0.20 * (w - 1)) * lateRamp(w); }
function dmgMul(w){   return (1 + 0.09 * (w - 1)) * lateRamp(w); }
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
          elite:true, noKnock:true, scale:1.6},

 /* ===== 21–29 波（用户 2026-09-22「继续做到 40」）=====
    主题：**拆营地**。11–19 波逼你决定先打谁，这一段逼你**别守死一个点** ——
    噬盾者吸干护盾流、相位兽让你的大招打空、母巢不停产崽、穿刺手隔着屏幕点你。 */
 leech:  {name:"噬盾者",   art:"dread",   col:"#4A6E8A", hp:90, dmg:12, spd:74,  armor:1, xp:28, r:14, kind:"melee",
          leech:{r:200, pct:0.08}},
 phaser: {name:"相位兽",   art:"ghost",   col:"#8A5AA8", hp:80, dmg:14, spd:96,  armor:0, xp:30, r:13, kind:"melee",
          phase:true, wob:18, immune:{every:5, dur:1.4}},
 hive:   {name:"母巢",     art:"slime",   col:"#5A7A4A", hp:220,dmg:10, spd:26,  armor:3, xp:45, r:21, kind:"melee",
          hatch:{cd:4, n:2, id:"spawnling", max:10}},
 spawnling:{name:"巢虫",   art:"rat",     col:"#7A8A5A", hp:16, dmg:7,  spd:120, armor:0, xp:3,  r:8,  kind:"melee",
          scale:0.7},
 sniper: {name:"穿刺手",   art:"prism",   col:"#A83F5A", hp:95, dmg:16, spd:52,  armor:1, xp:32, r:13, kind:"ranged",
          shot:{cd:3.6, keep:400, speed:460, r:8, n:1, spread:0, warn:1.0, lock:true}},
 gate3:  {name:"烬渊守者", art:"gate",    col:"#6B4A8A", hp:420,dmg:30, spd:72,  armor:6, xp:140,r:24, kind:"melee",
          elite:true, noKnock:true, scale:1.8},

 /* ===== 31–39 波 =====
    主题：**破构筑**。碾压者免疫一切控制、不朽者要杀两遍、唤雷者不让你站着、
    掘垒者拖慢你的塔、蚀空死了还占着地。 */
 juggernaut:{name:"碾压者",art:"statue",  col:"#6A5A4A", hp:380,dmg:34, spd:46,  armor:8, xp:70, r:24, kind:"melee",
          noKnock:true, noSlow:true, scale:1.35},
 revenant:{name:"不朽者", art:"bone",     col:"#8A7A9A", hp:150,dmg:22, spd:86,  armor:3, xp:55, r:15, kind:"melee",
          revive:{pct:0.5}},
 stormcaller:{name:"唤雷者",art:"clock",  col:"#3A5A8A", hp:120,dmg:14, spd:46,  armor:2, xp:50, r:15, kind:"ranged",
          storm:{cd:4.5, keep:340, warn:1.2, r:85, dmg:16}},   /* 实测 24 在第 34 波是一发 95，太狠 */
 sapper: {name:"掘垒者",   art:"spider",  col:"#7A6A4A", hp:130,dmg:18, spd:92,  armor:2, xp:48, r:13, kind:"melee",
          sap:{r:200, mult:2}},
 voidling:{name:"蚀空",    art:"ghost",   col:"#4A3A6A", hp:110,dmg:16, spd:104, armor:0, xp:45, r:13, kind:"melee",
          phase:true, leave:{r:90, life:3, dmg:9}},           /* 实测 14/4s 在第 38 波站满就是 183，砍到 9/3s */
 gate4:  {name:"墟心守者", art:"gate",    col:"#4A3A8C", hp:620,dmg:42, spd:74,  armor:8, xp:220,r:26, kind:"melee",
          elite:true, noKnock:true, noSlow:true, scale:2.0}
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
        swarm:10, splitter:12, mender:8, bulwark:12, warder:12, bomber:14, siege:12}, fix:{gate:2, gate2:2}},
 {pool:{rat:1}},                                                                      /* 20：Boss 波，占位 */
 /* ---- 21–29 波：拆营地 ---- */
 {pool:{ghost:6, statue:8, warden2:8, swarm:10, splitter:10, mender:8, bulwark:10, warder:12, bomber:12, siege:10,
        leech:14}, fix:{gate2:1, gate3:1}},
 {pool:{ghost:6, statue:8, warden2:8, swarm:10, splitter:10, mender:8, bulwark:10, warder:12, bomber:12, siege:10,
        leech:12, phaser:14}, fix:{gate2:1, gate3:1}},
 {pool:{statue:8, warden2:8, swarm:10, splitter:10, mender:8, bulwark:10, warder:12, bomber:12, siege:10,
        leech:12, phaser:12}, fix:{gate2:1, gate3:1}},
 {pool:{statue:8, warden2:8, swarm:8, splitter:10, mender:8, bulwark:10, warder:12, bomber:12, siege:10,
        leech:12, phaser:12, hive:10}, fix:{gate2:1, gate3:1}},
 {pool:{statue:8, warden2:8, swarm:8, splitter:10, mender:8, bulwark:10, warder:12, bomber:12, siege:10,
        leech:12, phaser:12, hive:10}, fix:{gate3:2}},
 {pool:{statue:8, warden2:6, swarm:8, splitter:8, mender:8, bulwark:10, warder:12, bomber:12, siege:8,
        leech:12, phaser:12, hive:10, sniper:12}, fix:{gate3:2}},
 {pool:{statue:8, warden2:6, swarm:8, splitter:8, mender:8, bulwark:10, warder:12, bomber:12, siege:8,
        leech:12, phaser:12, hive:10, sniper:12}, fix:{gate3:2}},
 {pool:{statue:6, swarm:8, splitter:8, mender:8, bulwark:12, warder:12, bomber:12, siege:8,
        leech:12, phaser:14, hive:12, sniper:12}, fix:{gate2:2, gate3:2}},
 {pool:{statue:6, swarm:8, splitter:8, mender:8, bulwark:12, warder:14, bomber:14, siege:8,
        leech:14, phaser:14, hive:12, sniper:14}, fix:{gate2:2, gate3:2}},
 {pool:{rat:1}},                                                                      /* 30：Boss 波，占位 */
 /* ---- 31–39 波：破构筑 ---- */
 {pool:{swarm:8, splitter:8, mender:8, bulwark:10, warder:12, bomber:12, siege:8,
        leech:12, phaser:12, hive:10, sniper:12, juggernaut:14}, fix:{gate3:1, gate4:1}},
 {pool:{swarm:8, splitter:8, mender:8, bulwark:10, warder:12, bomber:12, siege:8,
        leech:10, phaser:12, hive:10, sniper:12, juggernaut:12, revenant:14}, fix:{gate3:1, gate4:1}},
 {pool:{swarm:8, splitter:8, mender:8, bulwark:10, warder:12, bomber:12, siege:8,
        leech:10, phaser:12, hive:10, sniper:12, juggernaut:12, revenant:12}, fix:{gate3:1, gate4:1}},
 {pool:{swarm:8, splitter:8, mender:8, bulwark:10, warder:12, bomber:12,
        leech:10, phaser:12, hive:10, sniper:12, juggernaut:12, revenant:12, stormcaller:12}, fix:{gate3:1, gate4:1}},
 {pool:{swarm:8, splitter:8, mender:8, bulwark:10, warder:12, bomber:12,
        leech:10, phaser:12, hive:10, sniper:12, juggernaut:12, revenant:12, stormcaller:12}, fix:{gate4:2}},
 {pool:{swarm:8, splitter:8, mender:6, bulwark:10, warder:12, bomber:12,
        leech:10, phaser:12, hive:10, sniper:12, juggernaut:12, revenant:12, stormcaller:12, sapper:12}, fix:{gate4:2}},
 {pool:{swarm:8, splitter:8, mender:6, bulwark:10, warder:12, bomber:12,
        leech:10, phaser:12, hive:10, sniper:12, juggernaut:12, revenant:12, stormcaller:12, sapper:12}, fix:{gate4:2}},
 {pool:{swarm:8, splitter:8, mender:6, bulwark:10, warder:12, bomber:12,
        leech:10, phaser:12, hive:10, sniper:12, juggernaut:12, revenant:12, stormcaller:12, sapper:12,
        voidling:14}, fix:{gate4:2}},
 /* 第 39 波是这张表的最后一行 —— **第 41 波往后一直吃它**，只是按三旋钮继续加压。 */
 {pool:{swarm:8, splitter:8, mender:6, bulwark:12, warder:14, bomber:14,
        leech:12, phaser:14, hive:12, sniper:14, juggernaut:14, revenant:14, stormcaller:14, sapper:14,
        voidling:14}, fix:{gate3:2, gate4:2}}
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
          adds:  {id:"bomber", n:2, respawn:7}},
 /* ===== 第 30 波 Boss ·「烬渊祭司」（用户 2026-09-22「继续做到 40」）=====
    立绘 MOB_ART.priest 是现成的（地牢第三章那只）。
    ⚠️ 技能跟前两只都不重：守卫是扇形、主事是钉子和长鞭，**祭司是「领域」** ——
       一个甜甜圈（贴脸和跑远都安全，中间那一圈才危险）+ 三片会留在地上的火场。 */
 priest: {name:"烬渊祭司", art:"priest", col:"#C2510E", hp:6800, dmg:48, spd:64, armor:8,
          xp:1100, gold:1600, r:34, noKnock:true, boss:true, scale:2.8,
          ring:  {cd:8.0, warn:1.1, inner:95, outer:250, dmg:52},
          pyre:  {cd:11.0, warn:0.6, n:3, r:95, life:6.0, dmg:16, spread:200},
          call:  {at:[0.70, 0.40], n:2, id:"hive", ring:190, warn:0.6},
          rage:  {at:0.30, spd:1.25, cd:0.70},
          adds:  {id:"sniper", n:2, respawn:8}},
 /* ===== 第 40 波 Boss ·「墟心冕者」=====
    ⚠️ 它是目前的终点，三个技能各逼一种反应：
       崩心要你**跑很远**、冕刃要你**别站在直线上**、位移让你**甩不掉它**。 */
 crown:  {name:"墟心冕者", art:"crown", col:"#4A3A8C", hp:13000, dmg:72, spd:68, armor:10,
          xp:2200, gold:3200, r:36, noKnock:true, boss:true, scale:3.0,
          nova:  {cd:12.0, warn:2.0, r:380, dmg:95},
          shards:{cd:6.5, warn:0.6, n:10, speed:220, r:9, dmg:34},
          warp:  {cd:9.0, warn:0.5, dist:70},
          call:  {at:[0.75, 0.50, 0.25], n:4, id:"revenant", ring:200, warn:0.6},
          rage:  {at:0.30, spd:1.22, cd:0.70},
          adds:  {id:"juggernaut", n:1, respawn:10}}
};
/* Boss 出场顺序：10 守卫 · 20 主事 · 30 祭司 · 40 冕者。
   ⚠️ **第 50 波往后继续按冕者加压**（每多一轮 hp/xp/金 ×1.9、伤害 ×1.35）——
      再往上要新 Boss 的话，`BF_BOSS` 抄一条 + 这张表排个位就行，立绘走 buildArt() 自动生成。 */
var BF_BOSS_ORDER = ["warden", "steward", "priest", "crown"];
/* Boss 技能表。加新技能要同时动三处：这张表、bossAim()、bossFire()（外加 draw() 里的预警）。 */
var BOSS_SKILLS = ["sweep", "quake", "nails", "chain", "ring", "pyre", "nova", "shards", "warp"];
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
 {id:"sp_skull",   n:"裂颅",  pw:"暴击时以被砍中的怪为心炸开：范围 100，130% 伤害（一刀最多炸 3 次）",
  lore:"头盖骨是最好的引信。"},
 {id:"sp_magnet",  n:"磁石",  pw:"拾取范围 ×4；每捡一枚金币，下一刀伤害 +3%（挥刀后清零）",
  lore:"钱贴着他走，刀也是。"},
 {id:"sp_feast",   n:"盛宴",  pw:"拿到之后每次击杀回复 1% 最大生命，并且最大生命 +1（最多 +400）",
  lore:"他是靠这条廊子里的死人长大的。"},

 /* ===== 第二批 12 件（用户 2026-09-23：「加多一批特殊效果的遗物」）=====
    照旧那条口径：**一件都不许是「伤害 +N%」**，每件要么开一套新机制
    （持续伤害 / 打回弹丸 / 分身 / 天降 / 瞬移 / 跟塔联动），要么改「一刀能打到多少」。
    ⚠️ 前 18 件已经把「张角 / 刀程 / 攻速 / 补刀 / 爆炸 / 连锁 / 冲击波 / 绕转 / 践踏 /
       光环 / 处决 / 牵引 / 减速」占满了，所以这一批走的全是**没人用过的口子**。 */
 {id:"sp_ember",   n:"余烬",  pw:"命中的敌人燃烧 3 秒，每秒受到 20% 攻击的伤害",
  lore:"刀口上带着上一场火的温度。"},
 {id:"sp_deflect", n:"格挡",  pw:"挥刀会把刀锋里的敌方弹丸打回去，每颗造成 120% 攻击的伤害",
  lore:"飞过来的，原样还回去。"},
 {id:"sp_rain",    n:"刀雨",  pw:"每 1.2 秒，随机一个敌人头顶落下一道刀光（150% 伤害，范围 60）",
  lore:"天上也有人在挥刀。"},
 {id:"sp_clone",   n:"残影",  pw:"身后跟着一个影子，跟你同时挥刀（50% 伤害）",
  lore:"他回头看过一次，就再也没敢回第二次。"},
 {id:"sp_spike",   n:"逆刺",  pw:"受到伤害时，对身边 160 范围内所有敌人造成最大生命 8% 的伤害",
  lore:"挨一下，还一片。"},
 {id:"sp_ice",     n:"冰裂",  pw:"对被减速的敌人伤害翻倍；击杀它们时原地炸开（范围 90）",
  lore:"冻住的东西，碎起来最痛快。"},
 {id:"sp_quake",   n:"裂地",  pw:"每挥 4 刀，以自己为心裂开一圈（范围 210，120% 伤害）",
  lore:"第四刀落地的时候，地也跟着裂。"},
 {id:"sp_flurry",  n:"狂刃",  pw:"连续命中 12 次后，下一刀刀程和张角翻倍，且必定暴击",
  lore:"攒够了，就一刀全收。"},
 {id:"sp_blink",   n:"虚影步", pw:"每 4 秒：被贴身时瞬移开，原地留下一次爆炸（范围 110，200% 伤害）",
  lore:"抓住他的那只手，只抓到一团烟。"},
 {id:"sp_reso",    n:"共鸣",  pw:"你每挥一刀，离你最近的那座塔立刻也开一次火",
  lore:"石头也听得懂刀声。"},
 {id:"sp_leech",   n:"饮刃",  pw:"每次命中回复 0.4% 最大生命（每刀最多 6 次）",
  lore:"它比你更怕饿。"},
 {id:"sp_tide",    n:"怒潮",  pw:"每进一波、之后每 6 秒，放出一圈横扫全场的刀气（200% 伤害）",
  lore:"开场那一下，是替这一波所有人打的。"}
];
var SPECIAL_PICK = 3;      // Boss 掉落时几选一
var SP_SECOND_MS = 0.15;   // 二段补刀的延时（秒）
var SP_ORBIT_R = 72;       // 悬刃的绕转半径
/* 第二批用到的几个数（改平衡先动这里）*/
var SP_BURN_SEC = 3;       // 余烬：烧几秒
var SP_BURN_PCT = 0.20;    // 余烬：每秒掉「攻击 × 这个数」
var SP_RAIN_CD  = 1.2;     // 刀雨：几秒一道（2026-09-23 从 2 秒收紧：原来折合 0.65 倍攻击/秒，全表倒数第二）
var SP_CLONE_D  = 64;      // 残影：跟在身后多远
var SP_QUAKE_N  = 4;       // 裂地：每几刀一次（2026-09-23：5 刀 90% → 4 刀 120%）
var SP_QUAKE_PCT = 1.2;
var SP_FLURRY_N = 12;      // 狂刃：连续命中几次
var SP_BLINK_CD = 4;       // 虚影步：冷却（2026-09-23：6 秒 150% → 4 秒 200%）
var SP_BLINK_PCT = 2.0;
var SP_LEECH_N  = 6;       // 饮刃：每刀最多回几次
var SP_TIDE_CD  = 6;       // 怒潮：进波放一圈，之后每几秒再放一圈（2026-09-23：原来一波只放一次，折合 0.07 倍攻击/秒）
var SP_SKULL_MAX = 3;      // 裂颅：一刀最多炸几次
var GREET_PCT = 100;       // 见面礼（战场改写）：每只敌人挨的第一刀 +100%

/* ===== 塔（用户 2026-09-22 的塔防改版）=====
   品质照旧是 普通/稀有/史诗/传奇/神圣（r 0~4），**没有羁绊** ——
   配合全靠「光环塔只增益范围内的**别的**塔」和「控场塔把怪送到输出塔嘴边」，
   所以**摆在哪儿**才是这套系统真正的玩法。用户点名的那一对就是
   引灵幡（没有伤害，把怪拽过来）+ 重炮台（伤害极高、启动极慢、范围小，单独摆必定打空）。

   ⚠️ **星级不再给数值**（用户 2026-09-22）：升星换来的是**效果**（多打一次 / 穿透 / 弹射 /
      范围扩大 / 定身 / 处决 / 光环覆盖全场…），**三星一律是质变**。
      每座塔的 `s2` / `s3` 就是那两条效果，`t` 是卡面上的文案，其余字段是 starEff() 认的效果键：
        rangeX 射程 ×  ·  shots 一次打几次  ·  pierce 穿透  ·  bounce 弹射几次
        splash 命中炸开的范围  ·  chain 连锁几个  ·  stormChain 雷击后再连锁
        markN / markPct / markBoom 标记那一套  ·  slowHit 命中减速  ·  stun 定身几秒
        exec 处决线（生命低于这个比例直接死，Boss 免疫）  ·  beamN / beamRamp 光束
        vortHurt 漩涡持续伤害  ·  freeze 光环定身  ·  auraAll 光环覆盖全场  ·  auraAdd 光环多给一项
        healShield / healAll / healCleanse / healSave / healOver 回血塔那一套
        goldAuto / goldDbl / mintPerTower / vaultReroll / vaultCard 经济塔那一套
      ⚠️ **三星是累积的**（s3 的效果加在 s2 上），别写成「三星替换二星」。
   ⚠️ **塔的伤害跟玩家挂钩**（用户定的）：一律 `towerPower() × dmg`，
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
  s2:{t:"一次射两箭", shots:2},
  s3:{t:"箭矢穿透，一条线上的敌人全中", pierce:true},
  lore:"最老实的一座，从不问打的是谁。"},
 {id:"tw_spike", n:"尖刺台", r:0, shape:"spike", range:78, cd:0.5, dmg:0.28, kind:"aoe",
  pw:"每 0.5 秒对范围内所有敌人造成伤害。射程很短。",
  s2:{t:"范围扩大 60%", rangeX:1.6},
  s3:{t:"每次攻击把范围内的敌人定身 0.4 秒", stun:0.4},
  lore:"它只管脚底下那一圈。"},
 {id:"tw_sling", n:"投石机", r:0, shape:"lob",   range:190, cd:1.8, dmg:0.85, kind:"lob", splash:48, speed:230,
  pw:"每 1.8 秒抛一发石弹，落点炸开 48 范围。石弹飞得慢，敌人会跑开。",
  s2:{t:"一次抛两发", shots:2},
  s3:{t:"落点炸开 120 范围，并让踩到的敌人移速 −35% 持续 1.2 秒", splash:120, slowHit:{pct:0.35, sec:1.2}},
  lore:"它瞄的是敌人刚才站的地方。"},
 {id:"tw_lantern",n:"霜灯",  r:0, shape:"flame", range:120, cd:0, kind:"aura", aura:{slow:0.20},
  pw:"没有伤害。范围内的敌人移速 −20%。",
  s2:{t:"减速覆盖全场，不再看距离", auraAll:true},
  s3:{t:"每 5 秒把场上的敌人冻住 0.7 秒", freeze:{sec:0.7, every:5}},
  lore:"灯不烫手，可是走过它的人都慢下来。"},
 {id:"tw_drum",  n:"战鼓",   r:0, shape:"drum",  range:140, cd:0, kind:"aura", aura:{aspd:0.20},
  pw:"没有伤害。范围内其它塔攻速 +20%。",
  s2:{t:"范围内其它塔伤害也 +15%", auraAdd:{dmg:0.15}},
  s3:{t:"鼓声覆盖全场，所有塔都吃", auraAll:true},
  lore:"鼓点不杀人，杀人的是跟上鼓点的那些。"},
 /* 回血 / 经济这两条线是 2026-09-22 用户点名加的 —— 它们不打人，靠「你能站多久」和「你买得起几座」赢。 */
 {id:"tw_well",  n:"涌泉台", r:0, shape:"well",  range:150, cd:8.0, kind:"heal", healPct:0.025,
  pw:"没有伤害。每 8 秒，你站在范围内就回 2.5% 最大生命。",
  s2:{t:"回复时还给 8 点护盾", healShield:8},
  s3:{t:"回复不再看距离；每次回复解除你的减速，并在 3 秒内受到的伤害 −20%",
      healAll:true, healCleanse:{sec:3, cut:20}},
  lore:"水是凉的，站一会儿就不疼了。"},
 {id:"tw_coin",  n:"拾荒幡", r:0, shape:"coin",  range:170, cd:0, kind:"gold", goldPct:0.35,
  pw:"没有伤害。范围内的敌人倒下时多掉 35% 金币。",
  s2:{t:"范围内掉的金币直接入账，不用去捡", goldAuto:true},
  s3:{t:"范围内的敌人倒下时有 25% 概率再掉一份", goldDbl:0.25},
  lore:"它不杀人，它只是站在人倒下的地方。"},

 /* 第三批（用户 2026-09-22「再新增一批塔楼」）：扇形齐射、地雷、狙击、削甲、给人加成的旗、穿透弩、停摆钟。 */
 {id:"tw_fan",   n:"散花台", r:0, shape:"fan",   range:130, cd:1.3, dmg:0.30, kind:"burst",
  burstN:3, spread:26, speed:360,
  pw:"每 1.3 秒扇形射出 3 枚碎石，各自结算。射程不远。",
  s2:{t:"一次射出 5 枚", burstN:5},
  s3:{t:"碎石穿透，一条线上的敌人全中", pierce:true},
  lore:"它从不瞄，它只是把手里的都撒出去。"},
 {id:"tw_tack",  n:"铁蒺藜", r:0, shape:"tack",  range:130, cd:3.0, dmg:0.90, kind:"mine",
  splash:55, mineMax:3, mineLife:25,
  pw:"每 3 秒在附近埋一枚地刺，敌人踩到炸开 55 范围。最多同时埋 3 枚。",
  s2:{t:"最多同时埋 6 枚", mineMax:6},
  s3:{t:"炸开 80 范围，并把炸到的敌人定身 0.5 秒", splash:80, stun:0.5},
  lore:"埋下去就不管了，反正总有人踩。"},

 /* ---- 稀有 ---- */
 {id:"tw_frost", n:"冰晶塔", r:1, shape:"crystal", range:165, cd:1.4, dmg:0.55, kind:"shot", speed:380,
  slow:{pct:0.40, sec:1.5},
  pw:"每 1.4 秒射一发，命中的敌人移速 −40% 持续 1.5 秒。",
  s2:{t:"冰弹在敌人之间再弹 2 次", bounce:2},
  s3:{t:"命中炸开 60 范围，并把敌人定身 0.6 秒", splash:60, stun:0.6},
  lore:"被它打中的东西，连倒下都慢半拍。"},
 {id:"tw_lure",  n:"引灵幡", r:1, shape:"banner", range:220, cd:2.5, dmg:0, kind:"pull", pull:90,
  pw:"没有伤害。每 2.5 秒把范围内的敌人拽向自己 90。",
  s2:{t:"作用范围扩大 50%", rangeX:1.5},
  s3:{t:"拽过来之后把敌人定身 0.8 秒", stun:0.8},
  lore:"它什么也不做，只是招手。"},
 {id:"tw_arc",   n:"电弧塔", r:1, shape:"arc",    range:135, cd:1.2, dmg:0.42, kind:"chain", chain:3,
  pw:"每 1.2 秒放一次电，闪电在最近的 3 个敌人之间跳。",
  s2:{t:"闪电改成跳 6 个", chain:6},
  s3:{t:"每一跳都炸开 40 范围", splash:40},
  lore:"它认最近的那个，一个接一个。"},
 {id:"tw_mirror",n:"窥影镜", r:1, shape:"eye",    range:200, cd:1.8, dmg:0, kind:"mark",
  markN:3, markSec:4, markPct:25,
  pw:"没有伤害。每 1.8 秒标记范围内 3 个敌人 4 秒，被标记的受到的伤害 +25%。",
  s2:{t:"一次标记 8 个", markN:8},
  s3:{t:"被标记的敌人倒下时炸开 90 范围（它最大生命的 40%）", markBoom:true},
  lore:"照过一次，就再也藏不住了。"},
 {id:"tw_mint",  n:"铸币台", r:1, shape:"mint",  range:0, cd:10.0, kind:"mint", mint:6,
  pw:"没有伤害。每 10 秒产出「6 + 波数」金，掉在自己脚下。",
  s2:{t:"产出的金币直接入账，不用去捡", goldAuto:true},
  s3:{t:"场上每有一座塔就多产 2 金", mintPerTower:2},
  lore:"它一刻不停地数着这一趟还剩多少。"},

 {id:"tw_sniper",n:"长瞄塔", r:1, shape:"scope", range:340, cd:2.4, dmg:1.50, kind:"shot",
  speed:620, aimStrong:true,
  pw:"每 2.4 秒挑射程内**血最多**的那只射一发。射程极远。",
  s2:{t:"一次连射两发", shots:2},
  s3:{t:"命中后生命低于 12% 的敌人直接死", exec:0.12},
  lore:"它盯的从来不是最近的那个。"},

 /* ---- 史诗 ---- */
 {id:"tw_cannon",n:"重炮台", r:2, shape:"cannon", range:210, cd:2.8, dmg:2.60, kind:"lob",
  splash:60, speed:200, warn:0.8,
  pw:"每 2.8 秒开一炮：抬手 0.8 秒后才打出去，落点炸开 60 范围。伤害极高，但很容易打空。",
  s2:{t:"抬手之后连开两炮", shots:2},
  s3:{t:"炸开 120 范围，并把炸到的敌人定身 0.6 秒", splash:120, stun:0.6},
  lore:"它从不追人，它等人自己站过来。"},
 {id:"tw_beam",  n:"灼光塔", r:2, shape:"beam",   range:175, cd:0.25, dmg:0.20, kind:"beam",
  pw:"一道光束咬住一个敌人，每 0.25 秒灼一次。目标死了才换人。",
  s2:{t:"同时咬住两个敌人", beamN:2},
  s3:{t:"咬住同一个目标越久越烫：每次 +15%，最多 +150%，换人清零", beamRamp:true},
  lore:"它不眨眼，所以你也别动。"},
 {id:"tw_bramble",n:"荆棘园",r:2, shape:"bramble",range:105, cd:1.0, dmg:0.50, kind:"aoe",
  aura:{slow:0.25},
  pw:"每秒对范围内所有敌人造成伤害，并且范围内的敌人移速 −25%。",
  s2:{t:"范围扩大 70%", rangeX:1.7},
  s3:{t:"范围内生命低于 15% 的敌人直接死", exec:0.15},
  lore:"进去容易，出来就得留下点什么。"},
 {id:"tw_horn",  n:"号角旗", r:2, shape:"horn",   range:130, cd:0, kind:"aura", aura:{dmg:0.30},
  pw:"没有伤害。范围内其它塔伤害 +30%。",
  s2:{t:"范围内其它塔射程也 +20%", auraAdd:{rangeUp:0.20}},
  s3:{t:"号角覆盖全场，所有塔都吃", auraAll:true},
  lore:"号角一响，谁都比平时狠一点。"},
 {id:"tw_chapel",n:"祷堂",   r:2, shape:"chapel", range:175, cd:6.0, kind:"heal", healPct:0.04,
  pw:"没有伤害。每 6 秒，你站在范围内就回 4% 最大生命。",
  s2:{t:"回复时还给 15 点护盾", healShield:15},
  s3:{t:"每波一次：你掉到 35% 生命以下时立刻回 25% 最大生命", healSave:true},
  lore:"没有神像，只有一张空着的长凳。"},
 {id:"tw_vault", n:"金库",   r:2, shape:"vault",  range:0, cd:0, kind:"vault", vault:60,
  pw:"没有伤害。每次部署时额外收入 60 金。",
  s2:{t:"收入再 +60 金，并白送 3 次商店刷新", vaultBonus:60, vaultReroll:3},
  s3:{t:"白送两张塔牌，并按波数再给「6 × 波数」金", vaultCard:2, vaultWave:6},
  lore:"钥匙早就丢了，可它每五波还是自己开一次。"},

 {id:"tw_rend",  n:"裂甲桩", r:2, shape:"wedge", range:160, cd:1.6, dmg:0.50, kind:"shot",
  speed:400, shred:2,
  pw:"每 1.6 秒射一发，命中永久削掉那只 2 点护甲（可叠加）。",
  s2:{t:"改成一次削 5 点", shred:5},
  s3:{t:"命中炸开 80 范围，圈里的一起削甲", splash:80},
  lore:"它不急，它一片一片地撬。"},
 {id:"tw_banner",n:"督战旗", r:2, shape:"flag",  range:150, cd:0, kind:"aura",
  aura:{playerAspd:0.25, playerRange:0.15},
  pw:"没有伤害。**你**站在范围内时：攻速 +25%、刀程 +15%。",
  s2:{t:"你在范围内时受到的伤害再 −10%", auraAdd:{playerCut:10}},
  s3:{t:"旗影覆盖全场，走到哪儿都算", auraAll:true},
  lore:"旗不替人挥刀，只是让人挥得快些。"},

 /* ---- 传奇 ---- */
 {id:"tw_storm", n:"雷云柱", r:3, shape:"storm",  range:240, cd:2.0, dmg:2.00, kind:"storm", splash:80,
  pw:"每 2.0 秒在射程内敌人最密的那一团上降下雷击，炸开 80 范围。",
  s2:{t:"一次连劈三道", shots:3},
  s3:{t:"每道雷落下后在 4 个敌人之间连锁", stormChain:4},
  lore:"它专挑人多的地方劈。"},
 {id:"tw_gravity",n:"塌陷核心",r:3,shape:"vortex", range:260, cd:4.0, dmg:1.20, kind:"vortex", dur:1.5,
  pw:"每 4 秒开一个持续 1.5 秒的漩涡，把范围内的敌人一直拽向中心，结束时炸一下。",
  s2:{t:"漩涡持续期间每 0.5 秒就伤害一次", vortHurt:true},
  s3:{t:"结束时范围内生命低于 20% 的敌人直接死", exec:0.20},
  lore:"地面自己凹了下去。"},
 {id:"tw_forge", n:"熔炉",   r:3, shape:"forge",  range:150, cd:0, kind:"aura", aura:{aspd:0.35, dmg:0.20},
  pw:"没有伤害。范围内其它塔攻速 +35%、伤害 +20%。",
  s2:{t:"范围内其它塔攻击间隔再 −15%", auraAdd:{cdCut:0.15}},
  s3:{t:"炉火覆盖全场，所有塔都吃", auraAll:true},
  lore:"它把别人烧得发红，自己一动不动。"},
 {id:"tw_grove", n:"生息树", r:3, shape:"grove",  range:200, cd:4.0, kind:"heal", healPct:0.03,
  pw:"没有伤害。每 4 秒，你站在范围内就回 3% 最大生命。",
  s2:{t:"回复时还给 12 点护盾", healShield:12},
  s3:{t:"回复覆盖全场，溢出的部分转成护盾", healAll:true, healOver:true},
  lore:"树底下永远是湿的。"},

 {id:"tw_rail",  n:"贯石弩", r:3, shape:"rail",  range:300, cd:2.6, dmg:1.90, kind:"shot",
  speed:760, pierce:true,
  pw:"每 2.6 秒射出一发穿透弹，打穿一条线上的所有敌人。",
  s2:{t:"一次连射两发", shots:2},
  s3:{t:"打中的每一只都炸开 60 范围", splash:60},
  lore:"一条直线，后面的事它不管。"},

 /* ---- 神圣 ---- */
 {id:"tw_judge", n:"裁决之环",r:4,shape:"ring",   range:190, cd:1.0, dmg:0.70, kind:"aoe", ccX:2,
  pw:"每秒对范围内所有敌人造成伤害；对被减速或被标记的敌人伤害翻倍。",
  s2:{t:"范围扩大 50%", rangeX:1.5},
  s3:{t:"范围内生命低于 25% 的敌人直接死", exec:0.25},
  lore:"它不审问，它只是划下一道线。"},
 {id:"tw_obelisk",n:"归墟碑",r:4, shape:"obelisk",range:200, cd:0, kind:"aura",
  aura:{cdCut:0.25, rangeUp:0.25, playerCut:20},
  pw:"没有伤害。范围内其它塔攻击间隔 −25%、射程 +25%；你站在范围内时受到的伤害 −20%。",
  s2:{t:"范围内其它塔伤害 +25%", auraAdd:{dmg:0.25}},
  s3:{t:"碑影覆盖全场，减伤再 −10%", auraAll:true, auraAdd:{playerCut:10}},
  lore:"碑上没有字，站在它影子里的人却都记得回家的路。"},
 {id:"tw_clock", n:"停摆钟", r:4, shape:"clock", range:180, cd:0, kind:"aura",
  aura:{slow:0.15}, freeze:{sec:1.5, every:8},
  pw:"没有伤害。范围内的敌人移速 −15%，每 8 秒把范围内的敌人定身 1.5 秒。",
  s2:{t:"改成每 5 秒定身一次", freeze:{sec:1.5, every:5}},
  s3:{t:"钟声覆盖全场，不再看距离", auraAll:true},
  lore:"指针早就不走了，可走过它的人也是。"}
];
var TW_MAP = {};
(function(){ for(var i = 0; i < BF_TOWERS.length; i++) TW_MAP[BF_TOWERS[i].id] = BF_TOWERS[i]; })();

/* 买价（按品质）。卖出退 `买价 × 张数`（1★ 1 张 / 2★ 3 张 / 3★ 9 张），跟云顶一个口径。
   ⚠️ **2026-09-22 整排 ×5**（用户要求），跟 DLVL_COST 是一起的。
   ⚠️ **同一天又按品质各乘了一道**（用户：稀有 ×2 / 史诗 ×3 / 传奇 ×4 / 神圣 ×5）——
      普通 20 没动，于是「开局铺普通塔」仍然便宜，高品质变成需要攒的东西。
   ⚠️ **刷新还是 6 金没动** —— 所以现在是「牌便宜、人贵」，多刷几次找想要的那张是划算的。
      嫌刷新太便宜就抬 BF.deploy.rerollCost，别去动这张表。 */
var TW_COST   = [20, 80, 210, 480, 1000];
/* 牌库里每种塔各有几张（云顶那套「大家抢同一个池子」）。卖掉会还回池子里。 */
var TW_COPIES = [22, 18, 14, 10, 6];
/* ⚠️ **星级不再给任何数值加成**（用户 2026-09-22：「塔升星不会有基础数值提升，变成效果」）——
   这两张表整排留成 1，只是为了不动一片调用点。**别把 1.8 / 3.2 那一套加回来**，
   升星的全部价值在每座塔自己的 s2 / s3 上。 */
var STAR_DMG  = [1, 1, 1];
var STAR_AURA = [1, 1, 1];

/* 一座塔当前星级带来的效果（s2 和 s3 **累积**）。
   ⚠️ 每帧在 refreshTowerStats() 里现算一次并挂在 t.se 上 —— 跟「属性全部现算」同一个规矩。 */
function starEff(b){
  var d = b.def, o = {}, k;
  if(b.star >= 2 && d.s2) for(k in d.s2) if(k !== "t") o[k] = d.s2[k];
  if(b.star >= 3 && d.s3) for(k in d.s3){
    if(k === "t") continue;
    if(k === "rangeX" && o.rangeX) o.rangeX *= d.s3[k];
    else if(k === "shots" && o.shots) o.shots = Math.max(o.shots, d.s3[k]);
    else if(k === "auraAdd" && o.auraAdd){
      var m = {}, q;
      for(q in o.auraAdd) m[q] = o.auraAdd[q];
      for(q in d.s3[k]) m[q] = (m[q] || 0) + d.s3[k][q];
      o.auraAdd = m;
    } else o[k] = d.s3[k];
  }
  return o;
}
/* 这座塔的光环（底表 + 升星多给的那一项），没有光环就返回 null */
function auraOf(b){
  var a = b.def.aura, se = b.se || starEff(b), k, o;
  if(!a && !se.auraAdd) return null;
  o = {};
  if(a) for(k in a) o[k] = a[k];
  if(se.auraAdd) for(k in se.auraAdd) o[k] = (o[k] || 0) + se.auraAdd[k];
  return o;
}
/* 光环够不够得着（三星的「覆盖全场」就是这儿返回 Infinity）*/
function auraRange(b){
  var se = b.se || starEff(b);
  return se.auraAll ? Infinity : b.def.range;
}
/* 卡面上那两行升星说明（部署面板、商店、结算都用它）*/
function starLines(d, star){
  var h = "";
  if(d.s2) h += '<em class="' + (star >= 2 ? "on" : "") + '">★★ ' + d.s2.t + '</em>';
  if(d.s3) h += '<em class="' + (star >= 3 ? "on" : "") + '">★★★ ' + d.s3.t + '</em>';
  return h;
}
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
   ⚠️ **解锁条件 2026-09-22 改成「打通前一层的第 BF.tierClear(40) 波」**（用户要求）——
      原来那句「局外养成解锁」和 locked 标记已经删了，别加回来。
      记录在存档 youxu.bf.v1 的 `tb`（每层各自的最深波数）上，走 tierOpen()。 */
var BF_TIERS = [
 {id:1, name:"一层", hp:1.00, dmg:1.00, rate:1.00, cap:1.00, desc:"从这儿开始"},
 {id:2, name:"二层", hp:1.30, dmg:1.15, rate:1.20, cap:1.15, desc:"怪更硬、更密"},
 {id:3, name:"三层", hp:1.70, dmg:1.30, rate:1.45, cap:1.30, desc:"清不干净了"},
 {id:4, name:"四层", hp:2.20, dmg:1.50, rate:1.75, cap:1.45, desc:"没有遗物撑不过十波"},
 {id:5, name:"五层", hp:2.90, dmg:1.75, rate:2.10, cap:1.60, desc:"走到这儿的人不多"}
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
       /* 第二批特殊遗物（2026-09-23）。读处一律 || 0，老存档没有也不会炸。 */
       flurryN:0, flurryReady:false, rainCd:0, blinkCd:0,
       feastN:0, tideCd:0,                // 盛宴拿到之后杀了几只 / 怒潮的计时（2026-09-23）
       chestN:0, chestCycle:0, bagAlerted:false,
       /* ---- 塔防（用户 2026-09-22）---- */
       dlvl:1,                            // 部署等级 = 人口 = 场上最多几座塔
       bench:[],                          // 备战区，BF.deploy.bench 格（用户说的「九个卡槽」）
       pool:{},                           // 牌库：每种塔还剩几张（云顶那套共享池）
       round:0,                           // 已经进行过几轮部署
       bank:0,                            // 上一次部署吸走的金币，**下一轮部署才到账**（用户 2026-09-22）
       freeRe:0,                          // 金库二星攒下的免费刷新次数
       /* 距离下一次「挑遗物」还差几级（见 BF.pickEvery）。
          ⚠️ 从 1 起步，所以**第一件遗物在 2 级拿到**，之后 4/6/8…；
             从 0 起步的话第一件要等到 3 级，开局太空了。 */
       lvlSince:1,
       power:0};                          // 玩家最近几刀的实际出手伤害 —— 塔的伤害读它
  initPool();
  reindex();
  newWave(1, true);                       // ⚠️ G 必须先建好 —— bstats() 要读 G 上的几个计数
  E = {foes:[], shots:[], drops:[], sites:[], pwaves:[], fx:[], boss:null,
       builds:[], tshots:[], zones:[]};   // builds 是塔/泉/商，tshots 是塔的弹，zones 是地面危险区
  /* wardT / wardCut 是**涌泉台三星**给的那 3 秒减伤（buildCut 里跟归墟碑并在一起读）*/
  E.me = {x:0, y:0, dir:0, swingCd:0, moving:0, moveT:0, slowT:0, slowPct:0, second:0, aim:0,
          wardT:0, wardCut:0};
  CAM.x = 0; CAM.y = 0;
  P.hp = bstats().maxHp;
  OVER = false; pendPicks = 0;
}

/* 每波清零的那一堆（跟地牢 nextFloor() 是一回事） */
function newWave(w, quiet){
  var prevHurt = G ? G.hurt : true, prevBled = G ? G.bled : true;
  G = {w:w, t:0, spawnAcc:0, echoUsed:false, reciteFree:0, holdUsed:0, corrodeArmor:0,
       openLeft:5, glassCut:0, aspdCut:0, dice:0, borrowUsed:false, braceUsed:false,
       burlapUsed:false, warmthUsed:false, nerveN:0, reboundUsed:false,
       tickN:0, longN:0, exorN:0, calmsN:0, stepArmor:0, fastRun:0, instantReady:false,
       wholeUsed:false, needleN:0, ropeN:0, capN:0, critShN:0, songN:0, bladeN:0,
       glyphArmor:0, healed:0, lastPct:0, shatterN:0, shatterFree:0, whim:0,
       swings:0, wrongN:0, hurt:false, kindsSeen:{}, catSeen:{}, hauntN:0, bossAdds:0,
       fixDone:false, digDone:false, dmgTaken:0, undyingUsed:false, magnetN:0, chapelUsed:false,
       cautionN:0, broke:false, addsT:0, bossDown:false, spawnAcc:0,
       chaseN:0, fearN:0, bled:false};
  P.wave = w;
  /* ⚠️ 仇敌是**跨波**的（波是定时切的，场上的怪不清），所以计数要按场上现数一遍 ——
     以前直接清零，上一波标记的怪这一波死掉就把它减成负数，养魔跟着变成负的伤害加成。 */
  if(E) for(var hi = 0; hi < E.foes.length; hi++) if(!E.foes[hi].dead && E.foes[hi].haunt) G.hauntN++;
  /* 泉每一波回一次（用户 2026-09-22）—— 它不再消失，只是每波能喝一口 */
  if(E) for(var bi = 0; bi < E.builds.length; bi++)
    if(E.builds[bi].k === "spring") E.builds[bi].used = false;
  if(quiet) return;
  /* 「叠甲」：上一整波一点血都没掉才算一波（护盾吃掉的不算掉血）。
     ⚠️ 以前写在 onWaveRelics 里读 G.hurt —— 那时 G 已经是新一波的了，恒为 false，等于每波白加一次。 */
  if(!prevBled) P.noHitWaves++;
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
  /* 甲刃：护甲 → 暴击率（2026-09-23 补：以前只给了护甲 +2，后半句是空的） */
  if(has("armblade")) s.crit += Math.min(ABLADE_MAX, Math.floor(s.armor / ABLADE_PER) * ABLADE_STEP);

  /* --- ⑤ 常驻减伤（cutStatic 的唯一口径，封在 BF.cutMax）--- */
  var c = 0;
  if(has("soft"))  c += 7;
  if(has("hide"))  c += 3;
  if(has("shed"))  c += 14;                                          // 战场改写（撤退那半句在战场里不存在）
  if(has("still")) c += 20;
  if(has("quell")) c += 20;
  if(has("bile"))  c += 5;
  if(has("janus")) c += 8;
  if(has("linked"))c += 5 + Math.min(25, 5 * Math.floor(cb / 4));
  if(has("goldplate")) c += 5 + Math.min(16, 4 * Math.floor(g / 300));
  if(has("evervow")) c += 6;
  if(has("tough"))  c += Math.min(15, w - 1);
  if(has("deep") && w >= 30) c += 15;
  if(has("nemesis"))c += Math.min(40, 10 * P.bossSeen);             // 战场改写：一趟只见得到 4 只 Boss
  if(has("ascetic") && !P.everBought) c += Math.min(25, 5 * (w - 1));
  if(has("familiar")) c += Math.min(9, 3 * Object.keys(G.kindsSeen).length);  // 战场改写：开波几秒就满档
  if(has("grit"))   c += Math.min(15, 5 * G.wrongN);
  if(has("shieldheart") && sh >= 50) c += 18;
  if(has("scale") && hpPct < 0.50) c += 15;
  if(has("ease")  && hpPct > 0.80) c += 12;
  if(has("ironvow")) c += 2 * Math.min(5, Math.floor(s.armor / 3));
  if(has("confluence")) c += 2 * confTiers(s);
  s.cutStatic = c;
  s.cut = c;
  /* 恒甲：常驻减伤 → 护甲（2026-09-23 补：以前只有减伤和护盾，这半句是空的）。
     ⚠️ 排在减伤算完之后，所以铁誓那一档读到的护甲**不含**这一笔 —— 反过来就是死循环。 */
  if(has("evervow")) s.armor += Math.min(EVERVOW_MAX, Math.floor(c / EVERVOW_PER));

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
  if(hasSp("sp_feast"))  s.maxHp += Math.min(400, P.feastN || 0);   // 拿到之后才开始数，别读 P.kills
  if(hasSp("sp_rampage") && P.rageT > 0) s.aspd *= 1 + 0.05 * P.rageN;

  /* --- ⑧ 督战旗（塔的光环里唯一作用在**玩家**身上的一项，用户 2026-09-22 的新塔）---
     ⚠️ 它读 E.builds，**不许反过来调 refreshTowerStats()** —— 那边要调 bstats()，会死循环。
     ⚠️ 站进圈里才算，所以它跟「摆在哪儿」是一回事，跟别的光环一个规矩。 */
  var pa = playerAura();
  if(pa.aspd)  s.aspd *= (1 + pa.aspd);
  if(pa.range) s.range = Math.round(s.range * (1 + pa.range));

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
/* 刀气的飞行速度 —— **跟攻速走**（用户 2026-09-23）。
   基准攻速 BF.base.aspd 对应 SP_WAVE_SPD，攻速翻倍就飞两倍快，封在 2.4 倍
   （再快就只剩一道残影，看不出是从哪儿飞出去的）。 */
var SP_WAVE_SPD = 420;
function waveSpeed(s){
  return SP_WAVE_SPD * Math.min(2.4, Math.max(0.6, s.aspd / BF.base.aspd));
}
/* 这只怪算不算「被减速」（冰裂要用）：塔/弹丸打上的 slowT，或者站在霜环里。 */
function isSlowed(f){
  if(f.slowT > 0) return true;
  if(hasSp("sp_frost") && Math.hypot(f.x - E.me.x, f.y - E.me.y) <= 220) return true;
  return false;
}
/* 格挡：把刀锋扇形里的敌方弹丸打回去 */
function deflectShots(s, aim, range, halfArc){
  var me = E.me, dmg = Math.max(1, Math.round(s.atk * 1.2)), n = 0;
  for(var i = E.shots.length - 1; i >= 0; i--){
    var sh = E.shots[i];
    var dx = sh.x - me.x, dy = sh.y - me.y, d = Math.hypot(dx, dy);
    if(d > range + sh.r) continue;
    var a = Math.atan2(dy, dx) - aim;
    while(a >  Math.PI) a -= Math.PI * 2;
    while(a < -Math.PI) a += Math.PI * 2;
    if(Math.abs(a) > halfArc) continue;
    E.shots.splice(i, 1); n++;
    fxSpark(sh.x, sh.y, "#245E8C", 5);
    aoe(sh.x, sh.y, 52, dmg);
  }
  if(n) fxText("格挡 ×" + n, "#245E8C");
}
/* 共鸣：离你最近的那座会开火的塔立刻来一发。
   ⚠️ 只找**有目标、没被封停、真的会开火**的那几种 kind —— 光环/经济塔按它们自己的节奏走，
      硬塞一发会把金库的收入算重。 */
function resoFire(){
  var me = E.me, best = null, bd = 1e9;
  for(var i = 0; i < E.builds.length; i++){
    var t = E.builds[i];
    if(t.k !== "tower" || !t.ef || t.silT > 0 || !t.tgt || t.tgt.dead) continue;
    var d = t.def.kind;
    if(d !== "shot" && d !== "burst" && d !== "lob" && d !== "aoe" && d !== "chain") continue;
    var dd = Math.hypot(t.x - me.x, t.y - me.y);
    if(dd < bd){ bd = dd; best = t; }
  }
  if(best) fireTower(best, best.ef);
}

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
  /* 狂刃：攒满 12 次连续命中的那一刀，刀程和张角翻倍、必定暴击。
     ⚠️ 在这儿改的是**这一刀的局部变量**，不是 s —— 别写进 bstats()，那会变成常驻加成。 */
  var burst = (hasSp("sp_flurry") && P.flurryReady && mult === 1);
  var range = burst ? s.range * 2 : s.range;
  var arcDeg = burst ? Math.min(360, s.arc * 2) : s.arc;
  var halfArc = arcDeg * Math.PI / 360, inner = range * BF.wagerInner;
  var hits = [], wager = false, i, f, dx, dy, d, a, big = 0, weak = false, hauntHit = false;

  for(i = 0; i < E.foes.length; i++){
    f = E.foes[i]; if(f.dead) continue;
    dx = f.x - me.x; dy = f.y - me.y; d = Math.hypot(dx, dy);
    if(d > range + f.r) continue;
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
  fxSwing(me.x, me.y, aim, range, arcDeg, {crit:burst, n:hits.length, aspd:s.aspd});
  /* 破空：每一刀射出一道穿透冲击波 —— 空刀也射，不然跑图时它就白瞎了。
     ⚠️ **刀气的速度跟攻速走**（用户 2026-09-23：「攻速越快，刀气飞得越快」）：
        攻速翻倍它就飞两倍快，封在 2.4 倍免得快到看不见。 */
  if(hasSp("sp_wave") && mult === 1){
    var wv = waveSpeed(s);
    E.pwaves.push({x:me.x, y:me.y, vx:Math.cos(aim) * wv, vy:Math.sin(aim) * wv,
                   r:24, life:1.1, hit:{}, mult:0.7, dir:aim});
  }
  if(hasSp("sp_second") && mult === 1) me.second = SP_SECOND_MS;
  /* 格挡：把刀锋扇形里的敌方弹丸原样打回去 */
  if(hasSp("sp_deflect") && mult === 1) deflectShots(s, aim, range, halfArc);
  /* 裂地：每 SP_QUAKE_N 刀，脚下裂开一圈 */
  if(hasSp("sp_quake") && mult === 1 && G.swings % SP_QUAKE_N === 0){
    fxBoom(me.x, me.y, 210, "#8A6A3A");
    aoe(me.x, me.y, 210, Math.max(1, Math.round(s.atk * SP_QUAKE_PCT)));
  }
  /* 共鸣：离你最近的那座塔跟着开一次火 */
  if(hasSp("sp_reso") && mult === 1) resoFire();
  if(!hits.length){
    if(hasSp("sp_flurry") && !P.flurryReady) P.flurryN = 0;   // 空刀断掉「连续命中」
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
  if(has("scent") && weak)  pct += 60;                              // 战场改写（「多出弱点题」在战场里不存在）
  if(has("synes"))   pct += 30;
  if(has("flaw")){   pct += 30; noArmor = true; }
  if(has("ember") && hp1 < 0.33) pct += 95;
  if(has("hoard"))   pct += 2 * Math.floor(g / 100);
  if(has("spend"))   pct += Math.min(40, 2 * Math.floor(P.spent / 300));
  if(has("delve"))   pct += Math.min(20, 0.5 * (w - 1));
  if(has("slay")){   pct += 30; if(weak) pct += 100; }
  if(has("opening") && G.openLeft > 0){ pct += 100; G.openLeft--; }
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
  if(has("janus"))   pct += JANUS_PCT + Math.min(JANUS_C_TIERS, Math.floor(s.cutStatic / JANUS_C_PER)) * JANUS_C_STEP;
  if(has("bile"))    pct += Math.min(BILE_MAX, Math.floor(s.cutStatic / BILE_PER) * BILE_PCT);   // 2026-09-23 补
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
  var crit = forceCrit || burst || (Math.random() * 100 < cr);
  if(crit && has("crush")) noArmor = true;
  /* 刻字 / 默诵的「暴击时」那半句（2026-09-23 补：以前只给了暴击率）*/
  if(crit && has("carve"))  pct += 90;
  if(crit && has("recite")) extra += 35;

  var pre = (s.atk + base + extra) * (1 + pct / 100) + flat;
  /* ⚠️ 塔的伤害跟玩家挂钩（用户 2026-09-22）：把**没吃暴击的那一下**平滑记下来，
     towerPower() 读它。平滑是为了别让连击和暴击把塔的伤害抖成锯齿。 */
  P.power = P.power ? P.power * 0.7 + pre * 0.3 : pre;
  var raw = Math.max(1, Math.round((crit ? pre * cm : pre) * mult));
  /* 见面礼（战场改写）：**每只敌人第一次被你砍中**的那一下，② 层再 +GREET_PCT。
     跟别的百分比同一个桶，只是这一下单独算一遍 —— 乘区还是两个。 */
  var rawGreet = raw;
  if(has("greet")){
    var pg = (s.atk + base + extra) * (1 + (pct + GREET_PCT) / 100) + flat;
    rawGreet = Math.max(1, Math.round((crit ? pg * cm : pg) * mult));
  }

  /* ---- 落到每一只身上 ---- */
  var leechN = 0, skullN = 0;
  for(i = 0; i < hits.length; i++){
    f = hits[i]; if(f.dead) continue;
    /* 处决：残血直接抹掉（Boss 除外）*/
    if(hasSp("sp_exec") && !f.boss && f.hp / f.maxHp < 0.25){
      fxText("处决", "#8A6A10"); killFoe(f); continue;
    }
    var slowed = hasSp("sp_ice") && isSlowed(f);
    var rr = raw;
    if(has("greet") && !f.greeted){ f.greeted = true; rr = rawGreet; }
    var d2 = Math.max(1, rr - (noArmor ? 0 : f.armor));
    if(slowed) d2 *= 2;                                   // 冰裂：对被减速的翻倍
    hurtFoe(f, d2, s, crit);
    /* 余烬：点燃（刷新时长，伤害取高的那一次）*/
    if(hasSp("sp_ember")){
      f.burnT = SP_BURN_SEC;
      f.burnD = Math.max(f.burnD || 0, Math.max(1, Math.round(s.atk * SP_BURN_PCT)));
    }
    /* 饮刃：先数命中几次，出了循环再一次性回。
       ⚠️ **别在这儿逐次 healUp** —— 单次是 0.4% 最大生命，healUp 里的 Math.round
          会把每一笔都抹成 0，实测一刀回 0 点。攒起来一次结算才有效。 */
    if(hasSp("sp_leech") && leechN < SP_LEECH_N) leechN++;
    /* 冰裂：被减速的怪死在这一刀上 → 原地炸开 */
    if(slowed && f.dead) aoe(f.x, f.y, 90, Math.max(1, Math.round(f.maxHp * 0.6)), "#266F7B");
    /* 雷链：跳到最近的 3 个 */
    if(hasSp("sp_chain")) zap(f, Math.max(1, Math.round(raw * 0.4)), 3);
    /* 裂颅：暴击时以那只怪为心炸开 */
    /* ⚠️ 一刀最多炸 SP_SKULL_MAX 次：回旋 + 高暴击时一刀扫到十几只，每只都炸就是十几倍的范围伤害 */
    if(crit && hasSp("sp_skull") && skullN < SP_SKULL_MAX){ skullN++;
      aoe(f.x, f.y, 100, Math.round(raw * 1.3), "#B45B12"); }
  }
  if(leechN > 0) healUp(s.maxHp * 0.004 * leechN);        // 饮刃：攒完一次回
  /* 残影：身后那个影子跟着来一下（圆形，不再算一次扇形 —— 便宜且够用）*/
  if(hasSp("sp_clone") && mult === 1){
    var cx = me.x - Math.cos(aim) * SP_CLONE_D, cy = me.y - Math.sin(aim) * SP_CLONE_D;
    fxCone(cx, cy, aim, arcDeg, range * 0.7, "#5A5468");
    aoe(cx, cy, range * 0.62, Math.max(1, Math.round(raw * 0.5)));
  }
  /* 狂刃的计数：连续命中才涨，这一刀用掉就清 */
  if(hasSp("sp_flurry") && mult === 1){
    if(burst){ P.flurryReady = false; P.flurryN = 0; }
    else { P.flurryN = (P.flurryN || 0) + 1;
           if(P.flurryN >= SP_FLURRY_N){ P.flurryReady = true; P.flurryN = 0; } }
  }

  /* ---- 连击 ---- */
  P.combo += 1;
  if(has("offbeat") && moving) P.combo += 1;
  if(has("boom") && crit) P.combo += 1;                              // 战场改写
  if(has("chase") && weak){ P.combo += 2;
    if(G.chaseN < 3){ G.chaseN++; healUp(s.maxHp * 0.10); } }       // 战场改写：每波三次（带通感就是每刀都触发）
  if(P.combo > P.maxCombo) P.maxCombo = P.combo;
  G.lastPct = pct;
  /* 反震：攒的层数是「下一刀」的，打出去就清（2026-09-23 补：以前从不清零，挨满 3 下就是常驻 +150%）*/
  if(has("recoil")) P.recoil = 0;

  /* ---- 挥刀触发（= 地牢的「答对」）---- */
  onSwingRelics(s, {crit:crit, moving:moving, wager:wager, big:big, weak:weak});

  /* 回响之厅：立刻再挥一刀。⚠️ 补出来的那一刀**不会再触发它自己**（2026-09-23 从 3 层收到 1 层）——
     叠 3 层的期望是 ×1.875，而所有「挥刀时」的遗物（搏动、无常、点金…）都跟着翻倍。 */
  if(has("hall") && swingDepth < 1 && luck(0.50)){ swingDepth++; swing(); swingDepth--; }
}

function onSwingRelics(s, c){
  if(has("drain") && luck(0.10)) healUp(4);
  if(has("pulse")) healUp(s.maxHp * 0.01);
  if(has("midas") && luck(0.25)) addGold(5);                        // 战场改写：10 → 5（一波挥 37 刀）
  if(has("phoenix") && P.hp / s.maxHp < 0.15) healUp(s.maxHp * 0.05);
  if(has("allin") && c.wager && luck(0.10)) healUp(s.maxHp * 0.10);
  if(has("restring") && luck(0.20)){ P.combo = Math.max(P.combo, P.maxCombo); healUp(5); }
  if(has("chew") && P.chew){ P.chew = 0; healUp(s.maxHp * 0.04); }
  if(has("counter") && P.combo > 0 && P.combo % 10 === 0) healUp(10);
  if(has("aegis")){ P.aegisN++; if(P.aegisN % 10 === 0) addShield(10, 300); }
  if(has("corrode")) G.corrodeArmor = Math.min(5, G.corrodeArmor + 1);
  if(has("dice") && luck(0.50)) G.dice = Math.min(150, G.dice + 25);
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
    /* 战场改写：金币 60 → 15、伤害封 +80% —— 一波挥 37 刀，原数值一波白给七百多金 */
    if(r === 0) G.whim = Math.min(80, G.whim + 8); else if(r === 1) healUp(s.maxHp * 0.05); else addGold(15); }
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
  if(has("twice") && o.repeat)  cut += 12;                   // 战场改写：同种怪第二下起几乎每下都算
  if(has("psyche") && o.haunt)  cut += 15;
  if(has("calm")   && !o.ranged)cut += 7;
  if(has("buffer") && o.ranged) cut += 55;
  if(has("chain"))              cut += 10;
  if(has("grudge") && o.hitByMe)cut += 10;
  if(has("burlap") && !G.burlapUsed){ G.burlapUsed = true; cut += 25; }
  if(has("quell")  && o.boss)   cut += 50;
  if(has("knock") && isBossWave(P.wave)) cut += 20;          // 2026-09-23 补：以前只给了伤害那半句
  if(has("cushion") && o.touch) cut += 15;                   // 战场改写：贴身受伤不翻倍，所以换成接触伤害 −15%
  if(has("janus")) cut += Math.min(JANUS_P_TIERS, Math.floor((G.lastPct || 0) / JANUS_P_PER)) * JANUS_P_STEP;
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
  G.dice = 0;                                                // 赌骰：受伤清零（2026-09-23 补）
  if(has("nerve") && G.nerveN < 2){ G.nerveN++; }            // 战场改写：不看贴身
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
  if(!free && has("fearless") && o.haunt && G.fearN < 3){ G.fearN++; free = true; }   // 战场改写：每波三次
  if(!free && has("glass") && o.ranged){ G.aspdCut += 3; free = true; }
  if(!free && has("shatter") && G.shatterFree > 0){ G.shatterFree--; free = true; }

  if(has("thorns")) splash(foe, 30);
  if(has("build")) addShield(2);

  if(free){ fxText("免伤", "#47702F"); return; }

  var out = mitigate(dmg, s, o);
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
  /* 逆刺：挨一下，还一片 */
  if(hasSp("sp_spike")){
    fxBoom(E.me.x, E.me.y, 160, "#A93729");
    aoe(E.me.x, E.me.y, 160, Math.max(1, Math.round(s.maxHp * 0.08)));
  }
  P.killStreak = 0; P.noHitWaves = 0; G.bled = true;
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
    if(has("warmth")) P.warmthLeft = 5;                      // 余温：薪火触发后也算（2026-09-23 补）
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
/* 护盾的硬上限：**生命上限的两倍**（用户 2026-09-22）。
   ⚠️ 这是全局的一道闸，凝盾自己那个 AEGIS_MAX 仍然照吃（取两者里小的那个）——
      护盾不走减伤链也不进结算，堆到四五百就是「这一趟不会死了」。 */
function shieldCap(s){ return Math.max(1, Math.round((s || bstats()).maxHp * BF.shieldMaxX)); }
function addShield(n, cap){
  if(n <= 0) return;
  P.shield += Math.round(n);
  if(cap && P.shield > cap) P.shield = cap;
  var hard = shieldCap();
  if(P.shield > hard) P.shield = hard;
}
function addGold(n){
  var s = bstats();
  P.gold += Math.max(0, Math.round(n * (1 + s.goldPct / 100)));
}

/* ================================================================
   进一波 / 升级 时触发的遗物
   ================================================================ */
/* 怒潮：从自己身上扩出去一圈刀气，一路扫到 600。
   ⚠️ 复用 E.pwaves，靠 ring 标记走另一条更新分支（见 updateSpecial）。 */
function tideRing(s){
  E.pwaves.push({ring:true, x:E.me.x, y:E.me.y, r:24, grow:760, max:600,
                 life:1.2, hit:{}, mult:2.0, dmg:Math.max(1, Math.round(s.atk * 2))});
}
/* 集齐：普通、稀有、史诗各带着一件才算数（2026-09-23 补：以前只要带着它就给） */
function fullSet(){ return has("fullset") && nRar(0) > 0 && nRar(1) > 0 && nRar(2) > 0; }
function onWaveRelics(w){
  /* 怒潮：进波那一下先放一圈，计时从头走 */
  if(hasSp("sp_tide")){ tideRing(bstats()); P.tideCd = SP_TIDE_CD; }
  var s = bstats();
  if(has("lamp"))    healUp(s.maxHp * 0.08);
  if(has("well"))    healUp(s.maxHp * 0.20);
  if(has("towel"))   healUp(s.maxHp * 0.05);
  if(has("bloodmaul")) healUp(s.maxHp * 0.10);
  if(has("water"))   healUp(s.maxHp * 0.15, true);
  if(has("finale"))  healUp(s.maxHp * 0.30);
  if(has("underarmor")) healUp(s.maxHp * Math.min(0.18, 0.02 * s.armor));
  if(has("clasp"))   healUp(s.maxHp * Math.min(0.06, 0.02 * Math.floor(P.gold / 200)));
  if(has("foresight")) healUp(s.maxHp * Math.min(0.30, 0.03 * Math.floor(P.gold / 100)));   // 战场封 30%
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
    /* ⚠️ **超过 pickLvlMax 级就不再发遗物**（用户 2026-09-22）——
       零头一并清掉，免得 80 级之前攒的那半档在 81 级补弹一次。 */
    if(P.lvl > BF.pickLvlMax){ P.lvlSince = 0; return; }
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
/* ================================================================
   地面危险区（用户 2026-09-22「继续做到 40」）
   唤雷者的落雷、蚀空的尸块、祭司的火场**共用这一套**，别再各写一份。
   warn > 0 的那段只画预警不结算；结算之后每 ZONE_TICK 秒咬一口。
   ⚠️ 它也算「怪打你」，所以必须走 takeHit()，否则护盾会被绕过去。
   ================================================================ */
var ZONE_TICK = 0.6;
function addZone(x, y, r, warn, life, dmg, col){
  E.zones.push({x:x, y:y, r:r, warn:warn, life:life, dmg:dmg, col:col, cd:0, t:0});
}
function updateZones(dt){
  var me = E.me;
  for(var i = E.zones.length - 1; i >= 0; i--){
    var z = E.zones[i];
    z.t += dt;
    if(z.warn > 0){ z.warn -= dt; continue; }
    z.life -= dt; z.cd -= dt;
    if(z.life <= 0){ E.zones.splice(i, 1); continue; }
    if(z.cd <= 0 && Math.hypot(me.x - z.x, me.y - z.y) < z.r){
      z.cd = ZONE_TICK; takeHit(z.dmg, null, {});
    }
  }
}

/* 「拒马」的光环：身边的怪受到的伤害 −N%。
   ⚠️ **所有打怪的路都必须过它**（hurtFoe / splash / aoe / zap / towerHurt / 冲击波），
      漏一条拒马就等于没摆。
   ⚠️ 它**不保护自己** —— 不然它就是块纯肉，玩家少了「先点掉它」这个解法。 */
function guarded(f, d){
  if(f.immuneT > 0) return 0;               // 相位兽的无敌窗口：这一下完全不算
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
  if(d <= 0){ fxText("免疫", "#8A5AA8"); return; }
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
  if(f){ f.hp -= guarded(f, d); if(f.hp <= 0) killFoe(f); }   // 0 伤害就是没打动，不用特判
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
    if(dg <= 0) continue;
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
    if(dz <= 0){ cur = t; continue; }
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
  /* 「不朽者」：第一次倒下不算，原地回一半血再站起来。
     ⚠️ 必须排在 f.dead = true **之前** —— 这是它跟「裂壳虫」的根本区别。 */
  if(f.def.revive && !f.revived){
    f.revived = true;
    f.hp = Math.max(1, Math.round(f.maxHp * f.def.revive.pct));
    f.flash = 0.2; fxRing(f.x, f.y, f.r + 18, "#8A7A9A");
    return;
  }
  f.dead = true;
  /* 「蚀空」：死了还占着一块地（走 addZone，跟唤雷者和祭司的火场同一套）*/
  if(f.def.leave) addZone(f.x, f.y, f.def.leave.r, 0, f.def.leave.life, f.leaveDmg, "#4A3A6A");
  var s = bstats(), k = BF.killScale;
  P.kills++; P.killStreak++;
  P.kinds[f.id] = (P.kinds[f.id] || 0) + 1;
  if(f.haunt){ G.hauntN = Math.max(0, G.hauntN - 1); P.hauntKills++;
    if(has("bind")) healUp(s.maxHp * 0.02);                  // 缚魂：驱散回血（2026-09-23 补）
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
  if(hasSp("sp_feast")){ P.feastN = (P.feastN || 0) + 1; healUp(s.maxHp * 0.01); }
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
  /* 窥影镜三星：被标记的敌人倒下时自己炸开（伤害按它的最大生命算，跟塔的出手伤害无关）。
     ⚠️ 排在 dropGold 之前，炸死的那些照样各掉各的金币。 */
  if(f.markBoom && f.mark > 0){
    fxBoom(f.x, f.y, 90, "#6F3D98");
    towerAoe(f.x, f.y, 90, Math.max(1, Math.round(f.maxHp * 0.4)), null);
  }
  gainXp(f.xp);
  /* 拾荒幡：倒在它范围里就多掉一笔（三星还有概率再掉一份、二星直接入账）*/
  var ga = goldAuraAt(f.x, f.y), gn = f.gold;
  if(ga.pct > 0){
    gn += Math.max(1, Math.round(f.gold * ga.pct));
    if(ga.dbl && Math.random() < ga.dbl) gn += f.gold;
  }
  if(ga.auto){ addGold(gn); fxCoin(f.x, f.y - 8); }
  else dropGold(f.x, f.y, gn);
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
    boomDmg: d.boom ? Math.max(1, Math.round(d.boom.dmg * dmgMul(w) * TIER.dmg)) : 0,
    /* 21–39 波那一批的状态 */
    immuneT: 0, immCd: d.immune ? d.immune.every * Math.random() : 0,
    hatchCd: d.hatch ? d.hatch.cd * Math.random() : 0,
    stormCd: d.storm ? d.storm.cd * Math.random() : 0,
    back: false, aimDir: 0,
    stormDmg: d.storm ? Math.max(1, Math.round(d.storm.dmg * dmgMul(w) * TIER.dmg)) : 0,
    leaveDmg: d.leave ? Math.max(1, Math.round(d.leave.dmg * dmgMul(w) * TIER.dmg)) : 0};
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
/* 第 41 波往后：**1–40 波的怪混着出**（用户 2026-09-22：「40 波为游戏终点，
   后面关卡是 1–40 的怪物混出，不断增加数值」）。
   ⚠️ **没有新表** —— 池子是从 BF_WAVES 现算的：每只怪按「第几波才第一次登场」给权重
      （越晚登场的越重），所以深波数仍然以难怪为主，早期那些也一直混在里面。
   ⚠️ Boss 波那几行（pool 里只有一个 rat 的占位）要跳掉，别把它算进去。
   ⚠️ 数值那一头交给 lateRamp()，这儿只管**出什么怪**。 */
var LATE_DEF = null;
function lateWaveDef(){
  if(LATE_DEF) return LATE_DEF;
  var first = {}, fix = {}, i, k;
  for(i = 0; i < BF_WAVES.length; i++){
    if((i + 1) % BF.bossEvery === 0) continue;                 // Boss 波的占位行
    var wd = BF_WAVES[i];
    for(k in wd.pool) if(first[k] === undefined) first[k] = i + 1;
    if(wd.fix) for(k in wd.fix) fix[k] = 1;
  }
  var pool = {};
  for(k in first) pool[k] = 6 + Math.floor(first[k] / 10) * 4;  // 6 / 10 / 14 / 18
  LATE_DEF = {pool:pool, fix:fix};
  return LATE_DEF;
}
function waveDef(w){ return w <= BF_WAVES.length ? BF_WAVES[w - 1] : lateWaveDef(); }

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
  var a0 = d.lock ? f.aimDir : Math.atan2(E.me.y - f.y, E.me.x - f.x);
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
  /* guarded() / sapMul() 每帧要调很多次，这里先各数一遍，一个都没有就整段跳过 */
  G.guardN = 0; G.sapN = 0;
  for(i = 0; i < E.foes.length; i++){
    if(E.foes[i].dead) continue;
    if(E.foes[i].def.guard) G.guardN++;
    if(E.foes[i].def.sap) G.sapN++;
  }
  var st = bstats();                       // 噬盾者要用，一帧只算一次
  for(i = 0; i < E.foes.length; i++){
    f = E.foes[i]; if(f.dead) continue;
    f.t += dt; if(f.flash > 0) f.flash -= dt;
    /* 余烬：烧着的每秒掉一次。⚠️ 走 hurtFoe 会触发击退和伤害数字刷屏，
       所以这儿直接扣血 + 自己判死，跟 aoe() 里那一段是同一个写法。 */
    if(f.burnT > 0){
      f.burnT -= dt;
      f.burnAcc = (f.burnAcc || 0) + dt;
      if(f.burnAcc >= 1){
        f.burnAcc -= 1;
        f.hp -= f.burnD || 1;
        fxNum(f.x, f.y - f.r - 4, f.burnD || 1, false);
        if(f.hp <= 0){ killFoe(f); continue; }
      }
    }
    dx = me.x - f.x; dy = me.y - f.y; d = Math.hypot(dx, dy) || 1;
    sp = f.spd;
    if(hasSp("sp_frost") && d <= 220 && !f.def.noSlow) sp *= 0.6;   // 霜环
    /* ---- 塔带来的三样状态（用户 2026-09-22 的塔防改版）---- */
    if(f.mark > 0) f.mark -= dt;                          // 窥影镜的标记
    /* ⚠️ `noSlow` 的怪（碾压者 / 墟心守者）**免疫一切减速** —— 它们是专门来破「控场流」的，
       霜灯、冰晶塔、荆棘园、霜环对它们一概无效。别在这儿给它们开后门。 */
    if(!f.def.noSlow){
      if(f.slowT > 0){ f.slowT -= dt; sp *= (1 - f.slowPct); } // 冰晶塔的减速弹
      var aura = towerSlowAt(f.x, f.y);                        // 霜灯 / 荆棘园的减速光环
      if(aura > 0) sp *= (1 - aura);
      /* 定身（塔升星那一档给的：尖刺台 / 冰晶塔 / 引灵幡 / 重炮台 / 霜灯三星）——
         跟减速走同一个免疫开关，noSlow 的怪根本不会被挂上 stunT。 */
      if(f.stunT > 0){ f.stunT -= dt; sp = 0; }
    }
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
          if(f.shotCd <= 0 && d < def.shot.keep * 1.6){
            f.castT = def.shot.warn || 0.45;
            /* ⚠️ 「穿刺手」抬手那一下就把方向锁死（shot.lock），地上画的那条瞄准线就是它 ——
               弹速 460 躲不掉，能躲的是**在抬手的 1 秒里挪开**。别改成开火时再瞄。 */
            if(def.shot.lock) f.aimDir = Math.atan2(me.y - f.y, me.x - f.x);
          }
        }
      }
      /* 「相位兽」：每 every 秒无敌 dur 秒 —— 无敌期间身上一圈闪光。
         它破的是「攒一个大招一次性砸死」的打法，逼你分开出手。 */
      if(def.immune){
        if(f.immuneT > 0) f.immuneT -= dt;
        else { f.immCd -= dt; if(f.immCd <= 0){ f.immCd = def.immune.every; f.immuneT = def.immune.dur; } }
      }
      /* 「母巢」：每 cd 秒产 n 只巢虫，**场上同种封在 max 只** —— 不封会指数爆炸。 */
      if(def.hatch){
        f.hatchCd -= dt;
        if(f.hatchCd <= 0){
          f.hatchCd = def.hatch.cd;
          var live = 0;
          for(j = 0; j < E.foes.length; j++)
            if(!E.foes[j].dead && E.foes[j].id === def.hatch.id) live++;
          for(j = 0; j < def.hatch.n && live + j < def.hatch.max; j++){
            var ha = Math.random() * Math.PI * 2;
            E.foes.push(makeFoe(def.hatch.id, P.wave, f.x + Math.cos(ha) * (f.r + 14),
                                                      f.y + Math.sin(ha) * (f.r + 14)));
          }
          fxRing(f.x, f.y, f.r + 10, f.col);
        }
      }
      /* 「噬盾者」：站在你身边 r 之内就每秒吸走 pct 的最大生命值那么多**护盾**，自己回一半。
         ⚠️ 它只吃护盾不吃血 —— 这是专门来破「叠盾流」的，别改成扣血（那就跟别的近战没区别了）。 */
      if(def.leech && P.shield > 0 && d < def.leech.r){
        var take = Math.min(P.shield, def.leech.pct * st.maxHp * dt);
        P.shield -= take;
        f.hp = Math.min(f.maxHp, f.hp + take * 0.5);
      }
      /* 「唤雷者」：保持距离，每 cd 秒在你**当下的位置**标一个圈，warn 秒后劈下。
         走开就躲得掉 —— 它要的是「别站着不动」。 */
      if(def.storm){
        if(d < def.storm.keep * 0.8){ tx = -tx; ty = -ty; }
        else if(d < def.storm.keep * 1.1){ tx = 0; ty = 0; }
        f.stormCd -= dt;
        if(f.stormCd <= 0 && d < def.storm.keep * 1.6){
          f.stormCd = def.storm.cd;
          addZone(me.x, me.y, def.storm.r, def.storm.warn, 0.25, f.stormDmg, "#3A5A8A");
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
                           repeat:!!G.catSeen[f.id], touch:true});
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
  else if(k === "pyre"){                              // 火场：脚下一片 + 周围两片
    f.nails = [{x:me.x, y:me.y}];
    for(i = 1; i < def.pyre.n; i++){
      var pa = Math.random() * Math.PI * 2, pr = 60 + Math.random() * def.pyre.spread;
      f.nails.push({x: me.x + Math.cos(pa) * pr, y: me.y + Math.sin(pa) * pr});
    }
  }
  else if(k === "warp"){ f.qx = me.x; f.qy = me.y; }  // 位移：记下你现在站哪儿
  /* ring / nova / shards 都以自己为心，抬手时不用记任何东西 */
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
  } else if(f.cast === "ring"){
    /* 炎环：一个**甜甜圈** —— 贴着它站、或者跑到 outer 之外都安全，中间那一圈才吃伤害。
       它是祭司的身份技：逼你要么贴脸要么远遁，不许在「舒适距离」上磨。 */
    var rd = Math.hypot(me.x - f.x, me.y - f.y);
    if(rd >= def.ring.inner && rd <= def.ring.outer)
      takeHit(Math.round(def.ring.dmg * TIER.dmg), f, {boss:true});
    fxRing(f.x, f.y, def.ring.outer, "#C2510E");
    fxRing(f.x, f.y, def.ring.inner, "#C2510E");
  } else if(f.cast === "pyre"){
    /* 火场：三片留在地上的火，走 addZone（跟唤雷者、蚀空同一套）*/
    for(i = 0; i < f.nails.length; i++)
      addZone(f.nails[i].x, f.nails[i].y, def.pyre.r, 0, def.pyre.life,
              Math.round(def.pyre.dmg * TIER.dmg), "#C2510E");
    f.nails = null;
  } else if(f.cast === "nova"){
    /* 崩心：半径 380 的一整圈，抬手 2 秒 —— 唯一的解法是**往外跑**。 */
    if(Math.hypot(me.x - f.x, me.y - f.y) < def.nova.r)
      takeHit(Math.round(def.nova.dmg * TIER.dmg), f, {boss:true});
    fxRing(f.x, f.y, def.nova.r, "#4A3A8C");
  } else if(f.cast === "shards"){
    /* 冕刃：一圈均匀射出去的弹，走 E.shots（跟远程怪同一套弹丸）*/
    for(i = 0; i < def.shards.n; i++){
      var sa = i / def.shards.n * Math.PI * 2 + Math.random() * 0.2;
      E.shots.push({x:f.x, y:f.y, vx:Math.cos(sa) * def.shards.speed, vy:Math.sin(sa) * def.shards.speed,
                    r:def.shards.r, dmg:Math.round(def.shards.dmg * TIER.dmg), col:f.col, life:4, slow:null});
    }
  } else if(f.cast === "warp"){
    /* 位移：跳到你刚才站的地方旁边 —— 甩不掉它，只能打。 */
    var wa = Math.random() * Math.PI * 2;
    fxRing(f.x, f.y, f.r + 14, f.col);
    f.x = f.qx + Math.cos(wa) * def.warp.dist;
    f.y = f.qy + Math.sin(wa) * def.warp.dist;
    fxRing(f.x, f.y, f.r + 14, f.col);
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
  /* 金库二星攒下的免费刷新先用掉（用户 2026-09-22 的经济塔）*/
  if(P.freeRe > 0){ P.freeRe--; rollShopCards(); renderDeploy(); renderTwShop(); return; }
  var c = BF.deploy.rerollCost;
  if(P.gold < c) return;
  P.gold -= c; P.spent += c;
  rollShopCards(); renderDeploy(); renderTwShop();
}
/* 白送一张牌（金库三星）：照样走牌库，备战区满了就作罢 */
function giveFreeCard(){
  if(benchFree() <= 0) return;
  var tid = drawCard();
  if(!tid || !poolTake(tid)) return;
  P.bench.push({k:"tower", tid:tid, star:1});
  combineAll();
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
/* `resume = true` 表示这是**读档回到部署阶段**：钱、货架、白送的卡都已经在存档里了，
   这一半（P.round++ / 收入 / 回收 / 摇货架）**一次都不许再走**，否则读一次档多发一轮。 */
function openDeploy(resume){
  var d = BF.deploy, i;
  DEPLOY = true; PAUSED = true;
  relocateCamp();
  if(resume){ openDeployUI(); return; }
  P.round++;
  if(P.round === 1) P.gold += d.startGold;                       // 开局那一笔钱
  var inc = d.incomeBase + d.incomePer * (P.round - 1);          // ⚠️ 没有利息了（用户 2026-09-22）
  P.gold += inc;
  /* ===== 场上的金币自动回收，**下一轮才到账**（用户 2026-09-22）=====
     ⚠️ 顺序写死：**先把上一轮吸走的发下来，再吸这一轮的** —— 反过来就是当场到账了。
     ⚠️ 到账走 addGold()（吃「拾金」那一类的加成），入库存的是原值。 */
  var claim = P.bank || 0, vac = 0, di;
  if(claim > 0){ addGold(claim); P.bank = 0; }
  for(di = 0; di < E.drops.length; di++) vac += E.drops[di].n;
  E.drops.length = 0;
  P.bank = vac;
  /* ---- 金库（经济塔）：每次部署额外一笔；二星白送一次刷新、三星白送一张牌 ---- */
  var vg = 0, vre = 0, vcard = 0, vi, vb, vse;
  for(vi = 0; vi < E.builds.length; vi++){
    vb = E.builds[vi];
    if(vb.k !== "tower" || vb.def.kind !== "vault") continue;
    vse = starEff(vb);
    vg += vb.def.vault;
    /* 二星：再给一笔固定的；三星：再按波数给一笔（越往后越值钱）。
       刷新次数和白送的牌数都是**数量**，不是开关 —— 用户 2026-09-22 要求把二三星做厚。 */
    if(vse.vaultBonus) vg += vse.vaultBonus;
    if(vse.vaultWave)  vg += vse.vaultWave * P.wave;
    vre   += vse.vaultReroll || 0;
    vcard += vse.vaultCard || 0;
  }
  if(vg > 0) addGold(vg);
  P.freeRe = (P.freeRe || 0) + vre;
  lastIncome = {inc:inc, start: P.round === 1 ? d.startGold : 0, claim:claim, vac:vac, vault:vg};
  giveBuildCard("spring"); giveBuildCard("shop");                // 用户：每次部署白给一张泉 + 一张商
  for(i = 0; i < E.builds.length; i++)                           // 用户：商店每五波刷新
    if(E.builds[i].k === "shop"){ E.builds[i].stock = null; E.builds[i].cool = 0; }
  rollShopCards();
  for(vi = 0; vi < vcard; vi++) giveFreeCard();      // ⚠️ 要排在 rollShopCards 之后（它会动牌库）
  openDeployUI();
  /* ⚠️ **存在发完钱、摇完货架之后**（用户 2026-09-22 的「每一波一次存档」）——
     存在之前的话，读一次档就是重摇一次货架，等于免费刷新。 */
  saveWave(true);
}
function openDeployUI(){
  var i;
  selBench = -1; DRAG = null; ZOOM = 1; PAN.x = 0; PAN.y = 0;
  /* ⚠️ **进部署先把场上的弹幕全清掉**（用户 2026-09-22）——
     不清的话「开战」那一下会直接吃一脸停在半空的弹，而且那是上一波留下的，躲都没法躲。
     顺手把远程怪的抬手也打断，免得开战瞬间同时炸开一排。 */
  E.shots.length = 0; E.tshots.length = 0; E.pwaves.length = 0; E.zones.length = 0;
  for(i = 0; i < E.foes.length; i++){ E.foes[i].castT = 0; E.foes[i].shotCd = Math.max(E.foes[i].shotCd, 0.8); }
  /* ⚠️ **自己塔的抬手／漩涡／光束也一起打断**（用户 2026-09-22：「清空弹幕包括自己塔的」）——
     不清的话重炮台会在部署途中把那一发落在早就没人的地方，开战第一秒就是空炮。 */
  for(i = 0; i < E.builds.length; i++){
    var tb = E.builds[i]; if(tb.k !== "tower") continue;
    tb.warn = 0; tb.vortT = 0; tb.beamT = 0; tb.tgt = null; tb.cd = 0; tb.rep = 0; tb.repT = 0;
  }
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
  saveWave(false);                       // 摆完塔开战：把这一轮买的塔和花掉的钱落盘
  DRAG = null; ZOOM = 1; PAN.x = 0; PAN.y = 0;
  $("deploy").hidden = true;
  PAUSED = anyVeil() || OVER;
  last = 0;
}

/* ---- 部署面板 ---- */
/* 提示行里那两条升星说明（纯文本，面板的 dHint 是 textContent）*/
function starText(d, star){
  var h = "";
  if(d.s2) h += "　★★ " + d.s2.t + (star >= 2 ? "（已点亮）" : "");
  if(d.s3) h += "　★★★ " + d.s3.t + (star >= 3 ? "（已点亮）" : "");
  return h;
}
function twName(tid, star){
  return TW_MAP[tid].n + " " + (star >= 3 ? "★★★" : star === 2 ? "★★" : "★");
}
function renderDeploy(){
  if(!DEPLOY) return;
  var d = BF.deploy, i, h;
  $("dTitle").textContent = "部署 · 第 " + P.wave + " 波前";
  $("dGold").textContent  = P.gold + " 金" + (P.bank > 0 ? "（待领 " + P.bank + "）" : "");
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
    hint = (sc2.k === "tower" ? TW_MAP[sc2.tid].pw + starText(TW_MAP[sc2.tid], sc2.star)
         : sc2.k === "spring" ? "泉：每一波能喝一口，回 25% 最大生命。不占人口。"
         : "游商：卖遗物，每五波换一批货。不占人口。") + "　拖到画面上放下。";
  } else if(lastIncome){
    hint = "收入 +" + lastIncome.inc + (lastIncome.start ? "　开局 +" + lastIncome.start : "") +
           (lastIncome.vault ? "　金库 +" + lastIncome.vault : "") +
           (lastIncome.claim ? "　上轮回收到账 +" + lastIncome.claim : "") +
           (lastIncome.vac ? "　场上回收 " + lastIncome.vac + "（下一轮到账）" : "") +
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
         '<p>' + t.pw + '</p>' + starLines(t, 1) + '</button>';
  }
  $("twShopList").innerHTML = h;
  $("twShopSub").textContent = "金币 " + P.gold + " · 备战区 " + P.bench.length + " / " + BF.deploy.bench +
                               " · 等级 " + P.dlvl + " 决定抽到什么品质";
  $("btnTwRe").textContent = P.freeRe > 0 ? "刷新 · 免费 ×" + P.freeRe
                                          : "刷新 " + BF.deploy.rerollCost + " 金";
  $("btnTwRe").disabled = P.freeRe <= 0 && P.gold < BF.deploy.rerollCost;
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
  /* ⚠️ 先把每座塔的升星效果都算出来 —— 下面那一圈要读**别人**的 t.se（光环覆盖全场就在里面）。 */
  for(i = 0; i < E.builds.length; i++){
    t = E.builds[i]; if(t.k === "tower") t.se = starEff(t);
  }
  for(i = 0; i < E.builds.length; i++){
    t = E.builds[i]; if(t.k !== "tower") continue;
    var d = t.def, se = t.se;
    var aspdUp = 0, dmgUp = towerRelicPct(), cdCut = 0, rangeUp = 0;
    for(j = 0; j < E.builds.length; j++){
      o = E.builds[j];
      if(o === t || o.k !== "tower" || o.silT > 0) continue;
      var a = auraOf(o);
      if(!a) continue;
      if(Math.hypot(o.x - t.x, o.y - t.y) > auraRange(o)) continue;
      if(a.aspd)    aspdUp  += a.aspd;
      if(a.dmg)     dmgUp   += a.dmg;
      if(a.cdCut)   cdCut   += a.cdCut;
      if(a.rangeUp) rangeUp += a.rangeUp;
    }
    t.ef = {
      range: d.range * (1 + rangeUp) * (se.rangeX || 1),
      cd: Math.max(0.08, d.cd / (1 + aspdUp) * (1 - Math.min(0.6, cdCut)) * sapMul(t.x, t.y)),
      dmg: Math.round(towerPower() * (d.dmg || 0) * (1 + dmgUp)),
      /* ---- 升星换来的效果（见 starEff）---- */
      shots:  se.shots || 1,
      splash: se.splash || d.splash || 0,
      bounce: se.bounce || 0,
      /* ⚠️ 穿透 / 扇形枚数 / 地雷上限 / 削甲**底表上也能写**（贯石弩、散花台、铁蒺藜、裂甲桩），
         所以这四项都是「升星优先、底表兜底」。 */
      pierce: !!(se.pierce || d.pierce),
      burstN: se.burstN || d.burstN || 1,
      mineMax: se.mineMax || d.mineMax || 0,
      shred:  se.shred || d.shred || 0,
      chain:  se.chain || d.chain || 0,
      markN:  se.markN || d.markN || 0,
      markPct: se.markPct || d.markPct || 0,
      markBoom: !!se.markBoom,
      exec:   se.exec || 0,
      stun:   se.stun || 0,
      slowHit: se.slowHit || d.slow || null,
      ccX:    se.ccX || d.ccX || 0,
      beamN:  se.beamN || 1
    };
  }
}
/* 「掘垒者」活着的时候，身边 r 内的塔攻击间隔 ×mult（取最狠的那一个，不叠乘）。
   ⚠️ 它跟「缚锁者」是两回事：缚锁是**短暂封停**，掘垒是**一直拖慢到它死**。
      所以它是个明确的「先点掉」目标 —— 别把两者合并成一个机制。 */
function sapMul(x, y){
  if(!G.sapN) return 1;
  var m = 1;
  for(var i = 0; i < E.foes.length; i++){
    var o = E.foes[i];
    if(o.dead || !o.def.sap) continue;
    if(Math.hypot(o.x - x, o.y - y) <= o.def.sap.r) m = Math.max(m, o.def.sap.mult);
  }
  return m;
}
/* 怪身上的减速光环（霜灯 / 荆棘园）：取最强的那一个，不叠加 */
function towerSlowAt(x, y){
  var best = 0;
  for(var i = 0; i < E.builds.length; i++){
    var o = E.builds[i];
    if(o.k !== "tower" || o.silT > 0) continue;
    var a = auraOf(o);
    if(!a || !a.slow) continue;
    if(Math.hypot(o.x - x, o.y - y) > auraRange(o)) continue;
    best = Math.max(best, a.slow);
  }
  return Math.min(0.6, best);
}
/* 督战旗那一类作用在**玩家**身上的光环（攻速 / 刀程）。
   ⚠️ 跟 buildCut() 是一对：只看「你站没站在圈里」，三星的 auraAll 例外。
   ⚠️ 这里不许调 bstats()（bstats 要调它）。 */
function playerAura(){
  var o = {aspd:0, range:0};
  if(!E || !E.builds) return o;
  for(var i = 0; i < E.builds.length; i++){
    var b = E.builds[i];
    if(b.k !== "tower" || b.silT > 0) continue;
    var a = auraOf(b);
    if(!a || (!a.playerAspd && !a.playerRange)) continue;
    if(Math.hypot(b.x - E.me.x, b.y - E.me.y) > auraRange(b)) continue;
    o.aspd  += a.playerAspd || 0;
    o.range += a.playerRange || 0;
  }
  return o;
}
/* 归墟碑给玩家的减伤（mitigate 里跟别的减伤一起吃 BF.cutMax 的封顶）*/
function buildCut(){
  if(!E || !E.builds) return 0;
  var c = 0;
  for(var i = 0; i < E.builds.length; i++){
    var o = E.builds[i];
    if(o.k !== "tower" || o.silT > 0) continue;
    var a = auraOf(o);
    if(!a || !a.playerCut) continue;
    if(Math.hypot(o.x - E.me.x, o.y - E.me.y) > auraRange(o)) continue;
    c += a.playerCut;
  }
  /* 涌泉台三星那 3 秒的减伤（healCleanse）—— 它是塔给的，所以跟归墟碑并在一个口子里 */
  if(E.me.wardT > 0) c += E.me.wardCut || 0;
  return c;
}

/* 塔造成伤害的唯一口子（标记的加成、护甲都在这儿算）。
   ⚠️ 别绕过它直接改 f.hp —— 「窥影镜」的标记就白做了。 */
/* ⚠️ `ef` 是这一发的**升星效果**（定身 / 减速 / 处决都在里面），可以不传。
   别绕过这个函数直接改 f.hp —— 标记、护甲、处决就全白做了。 */
function towerHurt(f, d, ef){
  if(f.dead || d <= 0) return;
  if(f.mark > 0) d = d * (1 + f.markPct / 100);
  d = guarded(f, d);
  if(d <= 0) return;
  var out = Math.max(1, Math.round(d) - f.armor);
  f.hp -= out; f.flash = 0.12;
  fxNum(f.x, f.y - f.r - 4, out, false);
  if(ef && f.hp > 0){
    /* ⚠️ `noSlow` 的怪（碾压者 / 墟心守者）**免疫一切减速和定身** —— 它们就是来破控场流的 */
    if(ef.slowHit && !f.def.noSlow){
      f.slowT = Math.max(f.slowT || 0, ef.slowHit.sec); f.slowPct = ef.slowHit.pct;
    }
    if(ef.stun && !f.def.noSlow) f.stunT = Math.max(f.stunT || 0, ef.stun);
    /* 裂甲桩：**永久**削掉这只身上的护甲（最低 0），可叠加 —— 一层一层撬的手感就靠它 */
    if(ef.shred && f.armor > 0){ f.armor = Math.max(0, f.armor - ef.shred); fxSpark(f.x, f.y, "#6F3D98", 4); }
    /* 处决：三星那一档的质变。**Boss 免疫**，不然 40 波的冕者会被一圈荆棘直接抹掉。 */
    if(ef.exec && !f.boss && f.hp <= f.maxHp * ef.exec){ f.hp = 0; fxPop(f.x, f.y, "#A8891C"); }
  }
  if(f.hp <= 0) killFoe(f);
}
/* ⚠️ **必须带递归深度**（跟玩家那边的 aoe() 同一个道理）：窥影镜三星的「倒下就炸」
   和三星处决能一路连锁下去，不封会把一整波炸成爆栈。 */
var twAoeDepth = 0;
function towerAoe(x, y, r, d, col, ccX, ef){
  if(d <= 0 || twAoeDepth > 6) return;
  twAoeDepth++;
  if(col) fxRing(x, y, r, col);
  var list = E.foes.slice();
  for(var i = 0; i < list.length; i++){
    var f = list[i];
    if(f.dead) continue;
    if(Math.hypot(f.x - x, f.y - y) > r + f.r) continue;
    towerHurt(f, ccX && (f.mark > 0 || f.slowT > 0) ? d * ccX : d, ef);
  }
  twAoeDepth--;
}
function towerZap(from, d, n, ef){
  var seen = {}, cur = from, i, j;
  seen[E.foes.indexOf(from)] = 1;
  towerHurt(from, d, ef);
  if(ef && ef.splash) towerAoe(from.x, from.y, ef.splash, d, null, 0, ef);   // 电弧塔三星：每一跳都炸
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
    fxSpark(tt.x, tt.y, "#7FA8D8", 3);
    towerHurt(tt, d, ef);
    if(ef && ef.splash) towerAoe(tt.x, tt.y, ef.splash, d, null, 0, ef);
    cur = tt;
  }
}
/* 默认挑**最近**的；长瞄塔（aimStrong）挑射程内**血最多**的 —— 它是专门用来点精英和 Boss 的。 */
function towerTarget(t, range){
  var best = null, bd = 1e9, strong = !!t.def.aimStrong, bh = -1;
  for(var i = 0; i < E.foes.length; i++){
    var f = E.foes[i]; if(f.dead) continue;
    var d = Math.hypot(f.x - t.x, f.y - t.y);
    if(d > range + f.r) continue;
    if(strong){ if(f.hp > bh){ bh = f.hp; best = f; } }
    else if(d < bd){ bd = d; best = f; }
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
  var d = t.def, col = TW_COL[d.r], se = t.se || {}, i, f;
  if(d.kind === "shot"){
    f = t.tgt;
    if(!f || f.dead) return;
    var a = Math.atan2(f.y - t.y, f.x - t.x);
    /* 曳光：从塔口朝目标划一条短线 —— 直射塔以前只有一个小方块在飞，看不出谁在开火 */
    fxLine(t.x, t.y - 6, t.x + Math.cos(a) * Math.min(56, ef.range), t.y - 6 + Math.sin(a) * Math.min(56, ef.range),
           col, d.pierce ? 3 : 2);
    E.tshots.push({kind:"bolt", x:t.x, y:t.y, vx:Math.cos(a) * d.speed, vy:Math.sin(a) * d.speed,
                   r:5, dmg:ef.dmg, col:col, ef:ef, life:1.6,
                   /* 升星：穿透 / 弹射 / 命中炸开 —— 三样都在 updateTShots 里结算 */
                   pierce:ef.pierce, bounce:ef.bounce, splash:ef.splash, hit:[]});
  } else if(d.kind === "burst"){
    /* 散花台：一次甩出一把，每一枚各自结算（跟「一次打两下」不是一回事，那个是 shots）*/
    f = t.tgt;
    if(!f || f.dead) return;
    var a0 = Math.atan2(f.y - t.y, f.x - t.x), n0 = ef.burstN;
    fxCone(t.x, t.y, a0, d.spread * (n0 - 1) + 16, Math.min(ef.range, 70), col);
    for(i = 0; i < n0; i++){
      var off = (i - (n0 - 1) / 2) * d.spread * Math.PI / 180;
      E.tshots.push({kind:"bolt", x:t.x, y:t.y, vx:Math.cos(a0 + off) * d.speed, vy:Math.sin(a0 + off) * d.speed,
                     r:4, dmg:ef.dmg, col:col, ef:ef, life:ef.range / d.speed + 0.1,
                     pierce:ef.pierce, bounce:ef.bounce, splash:ef.splash, hit:[]});
    }
  } else if(d.kind === "mine"){
    /* 铁蒺藜：埋下去就不管了，踩到才炸（上限在 updateTowers 里数）*/
    var ma = Math.random() * 6.2832, mr = 26 + Math.random() * (ef.range - 26);
    E.tshots.push({kind:"mine", x:t.x + Math.cos(ma) * mr, y:t.y + Math.sin(ma) * mr,
                   src:t, r:16, arm:0.4, life:d.mineLife, splash:ef.splash, dmg:ef.dmg, col:col, ef:ef});
  } else if(d.kind === "lob"){
    var lx = d.warn ? t.lockX : (t.tgt ? t.tgt.x : t.x);
    var ly = d.warn ? t.lockY : (t.tgt ? t.tgt.y : t.y);
    var dist = Math.hypot(lx - t.x, ly - t.y);
    E.tshots.push({kind:"lob", x:t.x, y:t.y, x0:t.x, y0:t.y, tx:lx, ty:ly, ef:ef,
                   t:0, dur:Math.max(0.15, dist / d.speed), splash:ef.splash, dmg:ef.dmg, col:col});
  } else if(d.kind === "aoe"){
    /* ⚠️ 不闪整圈：范围塔一秒打一次，每次闪一个大圈会把画面糊死。
       改成一道**扫掠的扇形**（每次角度接着上次转），覆盖范围照旧在 drawBuilds() 里常驻画一圈淡的。 */
    t.sweepA = (t.sweepA || 0) + 1.9;
    fxCone(t.x, t.y, t.sweepA, 70, ef.range, col);
    towerAoe(t.x, t.y, ef.range, ef.dmg, null, ef.ccX, ef);
  } else if(d.kind === "chain"){
    f = t.tgt; if(f && !f.dead){ fxBolt(t.x, t.y, f.x, f.y); towerZap(f, ef.dmg, ef.chain, ef); }
  } else if(d.kind === "beam"){
    /* 灼光塔：二星同时咬住 beamN 个；三星咬得越久越烫（换人清零）*/
    var mult = 1;
    if(se.beamRamp){ t.rampN = Math.min(10, (t.rampN || 0) + 1); mult = 1 + 0.15 * t.rampN; }
    f = t.tgt;
    if(f && !f.dead){ t.beamT = 0.2; towerHurt(f, Math.round(ef.dmg * mult), ef); }
    if(ef.beamN > 1){
      var n2 = 1;
      for(i = 0; i < E.foes.length && n2 < ef.beamN; i++){
        var o2 = E.foes[i];
        if(o2.dead || o2 === f) continue;
        if(Math.hypot(o2.x - t.x, o2.y - t.y) > ef.range + o2.r) continue;
        towerHurt(o2, Math.round(ef.dmg * mult), ef); n2++;
      }
    }
  } else if(d.kind === "pull"){
    fxPull(t.x, t.y, ef.range, col);
    for(i = 0; i < E.foes.length; i++){
      f = E.foes[i]; if(f.dead) continue;
      var dx = t.x - f.x, dy = t.y - f.y, dd = Math.hypot(dx, dy);
      if(dd > ef.range || dd < 14) continue;
      var pull = Math.min(d.pull, dd - 10);
      f.x += dx / dd * pull; f.y += dy / dd * pull;
      /* 三星：拽过来顺手定身 */
      if(ef.stun && !f.def.noSlow) f.stunT = Math.max(f.stunT || 0, ef.stun);
    }
  } else if(d.kind === "mark"){
    var n = 0;                                   // 标记不闪圈，怪身上自带标记描边
    for(i = 0; i < E.foes.length && n < ef.markN; i++){
      f = E.foes[i]; if(f.dead) continue;
      if(Math.hypot(f.x - t.x, f.y - t.y) > ef.range) continue;
      f.mark = d.markSec; f.markPct = ef.markPct; f.markBoom = ef.markBoom ? 1 : 0; n++;
      fxBracket(f.x, f.y, f.r + 5, col);
    }
  } else if(d.kind === "storm"){
    f = densestSpot(t, ef.range, d.splash);
    if(f){
      fxPillar(f.x, f.y, col); fxBoom(f.x, f.y, d.splash, col);
      towerAoe(f.x, f.y, d.splash, ef.dmg, null, 0, ef);
      if(se.stormChain) towerZap(f, ef.dmg, se.stormChain, ef);     // 三星：雷落下后再连锁
    }
  } else if(d.kind === "vortex"){
    t.vortT = d.dur; t.vortHit = 0; fxSwirl(t.x, t.y, ef.range, col);
  } else if(d.kind === "heal"){
    /* ---- 回血塔（用户 2026-09-22 点名要的一条线）----
       ⚠️ 回血一律走 healUp()，别直接改 P.hp —— 「泉涌」那条溢出转护盾就在里面。 */
    var st0 = bstats();
    var got = healUp(st0.maxHp * d.healPct, !!se.healOver);
    if(se.healShield) addShield(se.healShield);
    if(se.healCleanse){
      E.me.slowT = 0;
      E.me.wardT = se.healCleanse.sec; E.me.wardCut = se.healCleanse.cut;
    }
    if(got > 0) fxText("+" + got, "#266F7B");
    fxPlus(t.x, t.y - 10, "#266F7B"); fxPlus(E.me.x, E.me.y - 14, "#266F7B");
  } else if(d.kind === "mint"){
    /* ---- 经济塔：自己产币 ---- */
    var raw = d.mint + P.wave;
    if(se.mintPerTower) raw += se.mintPerTower * fieldTowers();
    var amt = Math.max(1, Math.round(raw * BF.goldMult));
    if(se.goldAuto){ addGold(amt); fxText("+" + amt + " 金", "#9C6A10"); }
    else dropGold(t.x, t.y, amt);
    fxCoin(t.x, t.y - 10);
  }
}

/* 拾荒幡（kind:"gold"）：敌人倒在谁的范围里，就按谁的词条加钱。
   ⚠️ **取最强的那一个，不叠加**（跟霜灯的减速光环同一个规矩），
      但「直接入账」和「再掉一份」是开关，够得着就算。 */
function goldAuraAt(x, y){
  var o = {pct:0, auto:false, dbl:0};
  if(!E || !E.builds) return o;
  for(var i = 0; i < E.builds.length; i++){
    var b = E.builds[i];
    if(b.k !== "tower" || b.def.kind !== "gold" || b.silT > 0) continue;
    if(Math.hypot(b.x - x, b.y - y) > b.def.range) continue;
    var se = b.se || starEff(b);
    o.pct = Math.max(o.pct, b.def.goldPct);
    if(se.goldAuto) o.auto = true;
    if(se.goldDbl) o.dbl = Math.max(o.dbl, se.goldDbl);
  }
  return o;
}

function updateTowers(dt){
  refreshTowerStats();
  var me = E.me, st = null;
  if(me.wardT > 0) me.wardT -= dt;                 // 涌泉台三星那 3 秒减伤
  for(var i = 0; i < E.builds.length; i++){
    var t = E.builds[i];
    t.t = (t.t || 0) + dt;
    if(t.k !== "tower") continue;
    var d = t.def, ef = t.ef, se = t.se || {};
    if(t.beamT > 0) t.beamT -= dt;
    /* 「缚锁者」封住的塔这几秒完全停手（光环塔也一样失效）—— 见 BF_FOES.warder */
    if(t.silT > 0){ t.silT -= dt; t.warn = 0; t.vortT = 0; t.rep = 0; continue; }
    /* 纯被动：光环 / 拾荒幡 / 金库。霜灯三星的「冻一下」是光环塔里唯一会动的东西。 */
    if(d.kind === "aura" || d.kind === "gold" || d.kind === "vault"){
      /* ⚠️ 定身**底表上也能写**（停摆钟自带，霜灯是三星才有）—— 升星那一份优先。 */
      var fz = se.freeze || d.freeze;
      if(fz){
        t.frz = (t.frz || 0) - dt;
        if(t.frz <= 0){
          t.frz = fz.every;
          var rr = se.auraAll ? Infinity : ef.range;
          if(rr < Infinity) fxDash(t.x, t.y, rr, TW_COL[d.r]);
          for(var q = 0; q < E.foes.length; q++){
            var fq = E.foes[q];
            if(fq.dead || fq.def.noSlow) continue;
            if(Math.hypot(fq.x - t.x, fq.y - t.y) > rr) continue;
            fq.stunT = Math.max(fq.stunT || 0, fz.sec);
            fxSpark(fq.x, fq.y, "#2A62AD", 3);
          }
        }
      }
      continue;
    }
    /* 「多打一次」那一档：第一发照常打，剩下的每 0.12 秒补一发 */
    if(t.rep > 0){
      t.repT -= dt;
      if(t.repT <= 0){ t.repT = 0.12; t.rep--; fireTower(t, ef); }
    }
    /* 祷堂三星：每波一次，血掉到 35% 以下立刻拉回来（跟塔的 CD 无关，所以排在最前面）*/
    if(se.healSave && !G.chapelUsed){
      if(!st) st = bstats();
      if(P.hp > 0 && P.hp < st.maxHp * 0.35){
        G.chapelUsed = true; healUp(st.maxHp * 0.25);
        fxText("祷堂", "#E3B23C"); fxRing(t.x, t.y, 40, "#E3B23C");
      }
    }
    /* 塌陷核心：漩涡持续拽人，结束时炸一下（二星期间每 0.5 秒还伤一次）*/
    if(t.vortT > 0){
      t.vortT -= dt;
      for(var j = 0; j < E.foes.length; j++){
        var f2 = E.foes[j]; if(f2.dead) continue;
        var dx = t.x - f2.x, dy = t.y - f2.y, dd = Math.hypot(dx, dy);
        if(dd > ef.range || dd < 12) continue;
        var p = Math.min(dd - 10, 260 * dt);
        f2.x += dx / dd * p; f2.y += dy / dd * p;
      }
      if(se.vortHurt){
        t.vortHit = (t.vortHit || 0) - dt;
        if(t.vortHit <= 0){ t.vortHit = 0.5; towerAoe(t.x, t.y, ef.range, Math.round(ef.dmg * 0.5), null, 0, ef); }
      }
      if(t.vortT <= 0){
        fxBoom(t.x, t.y, ef.range * 0.55, TW_COL[d.r]);
        towerAoe(t.x, t.y, ef.range * 0.55, ef.dmg, null, 0, ef);
      }
      continue;
    }
    /* 重炮台的抬手：锁死落点之后目标照样会跑 —— 这就是它「很容易打空」的来源 */
    if(t.warn > 0){
      t.warn -= dt;
      if(t.warn <= 0){ fireTower(t, ef); t.rep = ef.shots - 1; t.repT = 0.12; }
      continue;
    }
    t.cd -= dt;
    if(t.cd > 0) continue;
    /* 铁蒺藜：自己埋的雷到上限就歇着（数的是场上还剩几枚）*/
    if(d.kind === "mine"){
      var mn = 0;
      for(var mi = 0; mi < E.tshots.length; mi++)
        if(E.tshots[mi].kind === "mine" && E.tshots[mi].src === t) mn++;
      if(mn >= ef.mineMax){ t.cd = 0.5; continue; }
      t.cd = ef.cd; fireTower(t, ef);
      t.rep = ef.shots - 1; t.repT = 0.12;
      continue;
    }
    /* 回血塔 / 铸币台不需要敌人 —— 它们只看自己的 CD（回血塔还要你站在圈里）*/
    if(d.kind === "heal" || d.kind === "mint"){
      if(d.kind === "heal" && !se.healAll && Math.hypot(me.x - t.x, me.y - t.y) > ef.range){
        t.cd = 0.2; continue;                      // 人不在圈里就不空烧 CD
      }
      if(d.kind === "heal"){
        if(!st) st = bstats();
        if(P.hp >= st.maxHp && !se.healShield && !se.healOver){ t.cd = 0.2; continue; }
      }
      t.cd = ef.cd; fireTower(t, ef);
      t.rep = ef.shots - 1; t.repT = 0.12;
      continue;
    }
    if(d.kind === "beam" && t.tgt && !t.tgt.dead &&
       Math.hypot(t.tgt.x - t.x, t.tgt.y - t.y) <= ef.range + t.tgt.r){
      /* 光束咬住不放，目标死了或跑出射程才换人 */
    } else {
      var old = t.tgt;
      t.tgt = towerTarget(t, ef.range);
      if(d.kind === "beam" && t.tgt !== old) t.rampN = 0;       // 换人，三星的灼烧层数清零
    }
    var needTgt = d.kind !== "aoe" && d.kind !== "pull" && d.kind !== "mark" &&
                  d.kind !== "storm" && d.kind !== "vortex";                 // burst / shot / lob / chain / beam 都要目标
    if(needTgt && !t.tgt) continue;                 // 射程内没人就不空转 CD
    if(!needTgt && !towerTarget(t, ef.range)) continue;
    t.cd = ef.cd;
    if(d.warn){ t.warn = d.warn; t.lockX = t.tgt.x; t.lockY = t.tgt.y; }
    else { fireTower(t, ef); t.rep = ef.shots - 1; t.repT = 0.12; }
  }
}
function updateTShots(dt){
  for(var i = E.tshots.length - 1; i >= 0; i--){
    var s = E.tshots[i];
    if(s.kind === "mine"){
      /* 埋着不动，踩上去才炸（arm 是刚埋下去那一小段引信，免得贴脸自爆）*/
      s.life -= dt; if(s.arm > 0) s.arm -= dt;
      if(s.life <= 0){ E.tshots.splice(i, 1); continue; }
      if(s.arm > 0) continue;
      for(var mj = 0; mj < E.foes.length; mj++){
        var mf = E.foes[mj];
        if(mf.dead) continue;
        if(Math.hypot(mf.x - s.x, mf.y - s.y) > mf.r + s.r) continue;
        fxBoom(s.x, s.y, s.splash, s.col);
        towerAoe(s.x, s.y, s.splash, s.dmg, null, 0, s.ef);
        E.tshots.splice(i, 1);
        break;
      }
      continue;
    }
    if(s.kind === "lob"){
      s.t += dt;
      var k = Math.min(1, s.t / s.dur);
      s.x = s.x0 + (s.tx - s.x0) * k; s.y = s.y0 + (s.ty - s.y0) * k;
      if(k >= 1){
        fxBoom(s.tx, s.ty, s.splash, s.col);
        towerAoe(s.tx, s.ty, s.splash, s.dmg, null, 0, s.ef);
        E.tshots.splice(i, 1);
      }
      continue;
    }
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    if(s.life <= 0){ E.tshots.splice(i, 1); continue; }
    for(var j = 0; j < E.foes.length; j++){
      var f = E.foes[j];
      if(f.dead) continue;
      /* 穿透的那一发对同一只只算一次 —— 记的是**怪本身**，不是下标
         （E.foes 满 260 会被 filter 一次，下标会整个错位）。 */
      if(s.hit && s.hit.indexOf(f) >= 0) continue;
      if(Math.hypot(f.x - s.x, f.y - s.y) > f.r + s.r) continue;
      towerHurt(f, s.dmg, s.ef);
      fxSpark(s.x, s.y, s.col, 3);
      if(s.splash){ fxBoom(s.x, s.y, s.splash, s.col); towerAoe(s.x, s.y, s.splash, s.dmg, null, 0, s.ef); }
      if(s.pierce){ s.hit.push(f); continue; }              // 穿过去，接着飞
      if(s.bounce > 0){                                     // 弹射：拐向下一个没打过的
        s.hit.push(f); s.bounce--;
        var best = null, bd = 240;
        for(var q = 0; q < E.foes.length; q++){
          var o = E.foes[q];
          if(o.dead || s.hit.indexOf(o) >= 0) continue;
          var dd = Math.hypot(o.x - s.x, o.y - s.y);
          if(dd < bd){ bd = dd; best = o; }
        }
        if(best){
          var sp = Math.hypot(s.vx, s.vy), an = Math.atan2(best.y - s.y, best.x - s.x);
          s.vx = Math.cos(an) * sp; s.vy = Math.sin(an) * sp; s.life = Math.max(s.life, 0.8);
          break;
        }
      }
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

  /* ===== 部署阶段把「打起来的那一层」整个藏掉（用户 2026-09-22）=====
     怪、Boss 预警、地面危险区、各种弹幕和打击特效在部署时一概不画 ——
     摆塔的时候屏幕上只剩地板、营地和你自己，看得清阵型。
     ⚠️ 这是**只改画面**：怪还在场上、状态一点没变（部署时 PAUSED，它们本来也不动）。
     ⚠️ 别顺手把 E.foes 清了 —— 开战那一下场上该是什么样就得是什么样。 */
  var fight = !DEPLOY;

  /* Boss 预警（画在地上） */
  if(fight) for(i = 0; i < E.foes.length; i++){
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
    } else if(b.cast === "pyre" && b.nails){
      for(var q2 = 0; q2 < b.nails.length; q2++){
        ctx2.beginPath(); ctx2.arc(sx(b.nails[q2].x), sy(b.nails[q2].y), b.def.pyre.r, 0, 6.2832);
        ctx2.fill(); ctx2.stroke();
      }
    } else if(b.cast === "ring"){
      /* 甜甜圈：用 evenodd 把中间那块挖空，一眼看得出「贴脸安全」 */
      ctx2.beginPath();
      ctx2.arc(sx(b.x), sy(b.y), b.def.ring.outer, 0, 6.2832);
      ctx2.arc(sx(b.x), sy(b.y), b.def.ring.inner, 0, 6.2832, true);
      ctx2.fill("evenodd"); ctx2.stroke();
    } else if(b.cast === "nova"){
      ctx2.beginPath(); ctx2.arc(sx(b.x), sy(b.y), b.def.nova.r, 0, 6.2832);
      ctx2.fill(); ctx2.stroke();
    }
  }
  /* 地面危险区（唤雷者的落雷 / 蚀空的尸块 / 祭司的火场）—— 画在最底下，贴着地板 */
  if(fight) for(i = 0; i < E.zones.length; i++){
    var z = E.zones[i], zx = sx(z.x), zy = sy(z.y);
    if(zx < -padX || zx > cw + padX || zy < -padY || zy > ch + padY) continue;
    ctx2.strokeStyle = z.col; ctx2.fillStyle = z.col;
    if(z.warn > 0){                       // 预警：虚线 + 一圈往里收的实线
      ctx2.globalAlpha = 0.16;
      ctx2.beginPath(); ctx2.arc(zx, zy, z.r, 0, 6.2832); ctx2.fill();
      ctx2.globalAlpha = 0.9; ctx2.lineWidth = 2.5; ctx2.setLineDash([7, 7]);
      ctx2.beginPath(); ctx2.arc(zx, zy, z.r, 0, 6.2832); ctx2.stroke();
      ctx2.setLineDash([]);
    } else {                              // 已经落下：实心一圈，快消失时淡掉
      ctx2.globalAlpha = 0.20 * Math.min(1, z.life);
      ctx2.beginPath(); ctx2.arc(zx, zy, z.r, 0, 6.2832); ctx2.fill();
      ctx2.globalAlpha = 0.55 * Math.min(1, z.life); ctx2.lineWidth = 2;
      ctx2.beginPath(); ctx2.arc(zx, zy, z.r, 0, 6.2832); ctx2.stroke();
    }
    ctx2.globalAlpha = 1;
  }

  /* 建筑（塔 / 泉 / 商）画在怪底下 */
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
  if(fight) for(i = 0; i < E.foes.length; i++){
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
    /* 相位兽的无敌：整只画淡 + 一圈发亮的环，一眼看出「现在打它没用」 */
    if(f.immuneT > 0){
      ctx2.strokeStyle = "#8A5AA8"; ctx2.lineWidth = 3; ctx2.globalAlpha = 0.9;
      ctx2.beginPath(); ctx2.arc(px, py, f.r + 6, 0, 6.2832); ctx2.stroke();
      ctx2.globalAlpha = 1;
    }
    /* 掘垒者：身上一圈淡光标出它拖慢的塔范围 */
    if(f.def.sap){
      ctx2.strokeStyle = f.col; ctx2.globalAlpha = 0.20; ctx2.lineWidth = 2;
      ctx2.beginPath(); ctx2.arc(px, py, f.def.sap.r, 0, 6.2832); ctx2.stroke();
      ctx2.globalAlpha = 1;
    }
    /* 噬盾者：正在吸你的盾时连一条线过去 */
    if(f.def.leech && P.shield > 0 && Math.hypot(me.x - f.x, me.y - f.y) < f.def.leech.r){
      ctx2.strokeStyle = "#4A6E8A"; ctx2.globalAlpha = 0.5; ctx2.lineWidth = 2;
      ctx2.beginPath(); ctx2.moveTo(px, py); ctx2.lineTo(sx(me.x), sy(me.y)); ctx2.stroke();
      ctx2.globalAlpha = 1;
    }
    /* 不朽者复活过一次之后打一个叉，告诉玩家这只不会再站起来 */
    if(f.revived){
      ctx2.strokeStyle = "#8A7A9A"; ctx2.lineWidth = 2; ctx2.globalAlpha = 0.85;
      ctx2.beginPath();
      ctx2.moveTo(px - 5, py - f.r - 8); ctx2.lineTo(px + 5, py - f.r - 2);
      ctx2.moveTo(px + 5, py - f.r - 8); ctx2.lineTo(px - 5, py - f.r - 2);
      ctx2.stroke(); ctx2.globalAlpha = 1;
    }
    /* 穿刺手抬手时地上那条瞄准线 —— 弹速 460 躲不掉，能躲的是这 1 秒 */
    if(f.castT > 0 && f.def.shot && f.def.shot.lock){
      ctx2.strokeStyle = f.col; ctx2.globalAlpha = 0.75; ctx2.lineWidth = 2;
      ctx2.setLineDash([9, 6]);
      ctx2.beginPath(); ctx2.moveTo(px, py);
      ctx2.lineTo(px + Math.cos(f.aimDir) * 900, py + Math.sin(f.aimDir) * 900);
      ctx2.stroke(); ctx2.setLineDash([]); ctx2.globalAlpha = 1;
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
    if(f.burnT > 0){                                  // 余烬：烧着的那一圈橙
      ctx2.strokeStyle = "#C2510E"; ctx2.globalAlpha = 0.5 + 0.3 * Math.sin(f.t * 14);
      ctx2.lineWidth = 2;
      ctx2.beginPath(); ctx2.arc(px, py, f.r + 2, 0, 6.2832); ctx2.stroke();
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

  /* 刀气：飞出去的那一道画成**朝着飞行方向的一段弧**（不再是整圆，看得出朝哪儿走），
     怒潮那种原地扩散的圈仍然画整圈。 */
  if(fight) for(i = 0; i < E.pwaves.length; i++){ var pw = E.pwaves[i];
    ctx2.globalAlpha = Math.min(1, pw.life * 1.6);
    ctx2.lineCap = "round";
    if(pw.ring){
      ctx2.strokeStyle = "#245E8C"; ctx2.lineWidth = 6;
      ctx2.beginPath(); ctx2.arc(sx(pw.x), sy(pw.y), pw.r, 0, 6.2832); ctx2.stroke();
    } else {
      var pd = pw.dir !== undefined ? pw.dir : Math.atan2(pw.vy, pw.vx);
      ctx2.strokeStyle = "#245E8C"; ctx2.lineWidth = 6;
      ctx2.beginPath(); ctx2.arc(sx(pw.x), sy(pw.y), pw.r, pd - 1.1, pd + 1.1); ctx2.stroke();
      ctx2.strokeStyle = "rgba(36,94,140,.4)"; ctx2.lineWidth = 3;
      ctx2.beginPath(); ctx2.arc(sx(pw.x) - Math.cos(pd) * 12, sy(pw.y) - Math.sin(pd) * 12,
                                 pw.r * 0.8, pd - 0.9, pd + 0.9); ctx2.stroke();
    }
    ctx2.globalAlpha = 1; }

  /* 残影：身后那个影子（半透明的主角）*/
  if(hasSp("sp_clone")){
    var chim = IMG.hero, ca = me.aim || me.dir;
    var ccx = sx(me.x - Math.cos(ca) * SP_CLONE_D), ccy = sy(me.y - Math.sin(ca) * SP_CLONE_D);
    if(chim && chim.complete){
      ctx2.globalAlpha = 0.38; ctx2.drawImage(chim, ccx - 15, ccy - 17, 30, 30); ctx2.globalAlpha = 1;
    }
  }

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
  if(fight) for(i = 0; i < E.tshots.length; i++){
    var ts = E.tshots[i];
    ctx2.fillStyle = ts.col;
    if(ts.kind === "mine"){
      /* 埋在地上的刺：引信没走完时淡一点，看得出「还没生效」 */
      ctx2.globalAlpha = ts.arm > 0 ? 0.45 : 0.9;
      ctx2.strokeStyle = ts.col; ctx2.lineWidth = 2;
      ctx2.beginPath();
      for(var mk2 = 0; mk2 < 4; mk2++){
        var ma2 = mk2 / 4 * 6.2832 + 0.4;
        ctx2.moveTo(sx(ts.x), sy(ts.y));
        ctx2.lineTo(sx(ts.x) + Math.cos(ma2) * 7, sy(ts.y) + Math.sin(ma2) * 7);
      }
      ctx2.stroke();
      ctx2.beginPath(); ctx2.arc(sx(ts.x), sy(ts.y), 2.5, 0, 6.2832); ctx2.fill();
      ctx2.globalAlpha = 1;
      continue;
    }
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
  if(fight) for(i = 0; i < E.builds.length; i++){
    var bt = E.builds[i];
    if(bt.k !== "tower" || !(bt.beamT > 0) || !bt.tgt || bt.tgt.dead) continue;
    ctx2.strokeStyle = TW_COL[bt.def.r]; ctx2.globalAlpha = 0.75; ctx2.lineWidth = 3;
    ctx2.beginPath(); ctx2.moveTo(sx(bt.x), sy(bt.y) - 10); ctx2.lineTo(sx(bt.tgt.x), sy(bt.tgt.y)); ctx2.stroke();
    ctx2.globalAlpha = 1;
  }

  /* 弹丸 */
  if(fight) for(i = 0; i < E.shots.length; i++){ var s2 = E.shots[i];
    ctx2.fillStyle = s2.col; ctx2.beginPath(); ctx2.arc(sx(s2.x), sy(s2.y), s2.r, 0, 6.2832); ctx2.fill();
    ctx2.strokeStyle = "rgba(46,42,35,.35)"; ctx2.lineWidth = 1; ctx2.stroke(); }

  /* Boss 跑出取景框时，在屏幕边上画一个指向它的三角 */
  if(fight && E.boss && !E.boss.dead){
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

  /* 特效。⚠️ 部署阶段整段跳过（用户 2026-09-22 要「临时屏蔽所有怪物和特效」）——
     E.fx 本身不清，开战那一下还剩下的会接着演完，反正都是 0.2~0.6 秒的东西。 */
  if(fight) drawFx();
  /* ⚠️ 不画的时候也得把过期的特效清掉 —— 清理本来是挂在 drawFx() 末尾的，
     跳过它的话 E.fx 会一直涨（部署阶段是暂停的，涨不起来，但别把这条删了）。 */
  else for(var fj = E.fx.length - 1; fj >= 0; fj--) if(E.fx[fj].t >= E.fx[fj].life) E.fx.splice(fj, 1);
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
      /* 回血塔和拾荒幡也画 —— 它们的整套价值就是「你（或者怪）站没站在圈里」 */
      if(b.k !== "tower") continue;
      if(b.def.kind !== "aoe" && b.def.kind !== "heal" && b.def.kind !== "gold") continue;
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
  /* ---- 回血 / 经济那两条线（用户 2026-09-22）：照旧是 canvas 画的，一张新图都没加 ---- */
  else if(k === "well"){ ctx2.moveTo(px, py - 8); ctx2.quadraticCurveTo(px + 6, py + 1, px, py + 7);
      ctx2.quadraticCurveTo(px - 6, py + 1, px, py - 8); ctx2.fill();
      ctx2.fillStyle = "#FCF8F0"; ctx2.beginPath(); ctx2.arc(px - 1.6, py + 2, 1.8, 0, 6.2832); ctx2.fill(); }
  else if(k === "coin"){ ctx2.arc(px, py, 7, 0, 6.2832); ctx2.stroke();
      ctx2.beginPath(); ctx2.moveTo(px, py - 4); ctx2.lineTo(px, py + 4); ctx2.stroke(); }
  else if(k === "mint"){ ctx2.ellipse(px, py + 5, 7, 2.6, 0, 0, 6.2832); ctx2.stroke();
      ctx2.beginPath(); ctx2.ellipse(px, py + 0.5, 7, 2.6, 0, 0, 6.2832); ctx2.stroke();
      ctx2.beginPath(); ctx2.ellipse(px, py - 4, 7, 2.6, 0, 0, 6.2832); ctx2.stroke(); }
  else if(k === "chapel"){ ctx2.moveTo(px - 7, py + 7); ctx2.lineTo(px - 7, py - 1);
      ctx2.quadraticCurveTo(px, py - 11, px + 7, py - 1); ctx2.lineTo(px + 7, py + 7); ctx2.closePath(); ctx2.stroke();
      ctx2.beginPath(); ctx2.moveTo(px, py - 3); ctx2.lineTo(px, py + 5);
      ctx2.moveTo(px - 3, py + 1); ctx2.lineTo(px + 3, py + 1); ctx2.stroke(); }
  else if(k === "vault"){ ctx2.rect(px - 8, py - 5, 16, 11); ctx2.stroke();
      ctx2.beginPath(); ctx2.arc(px, py + 0.5, 3, 0, 6.2832); ctx2.stroke(); }
  else if(k === "fan"){ for(var fa = 0; fa < 3; fa++){ var fan = -0.5 + fa * 0.5;
      ctx2.moveTo(px - 2, py + 7);
      ctx2.lineTo(px - 2 + Math.cos(fan - 1.57) * 13, py + 7 + Math.sin(fan - 1.57) * 13); } ctx2.stroke(); }
  else if(k === "tack"){ for(var ta = 0; ta < 4; ta++){ var tan = ta / 4 * 6.2832 + 0.4;
      ctx2.moveTo(px, py); ctx2.lineTo(px + Math.cos(tan) * 9, py + Math.sin(tan) * 9); } ctx2.stroke();
      ctx2.beginPath(); ctx2.arc(px, py, 2.4, 0, 6.2832); ctx2.fill(); }
  else if(k === "scope"){ ctx2.arc(px, py, 7, 0, 6.2832); ctx2.stroke();
      ctx2.beginPath(); ctx2.moveTo(px - 9, py); ctx2.lineTo(px + 9, py);
      ctx2.moveTo(px, py - 9); ctx2.lineTo(px, py + 9); ctx2.stroke(); }
  else if(k === "wedge"){ ctx2.moveTo(px - 6, py - 7); ctx2.lineTo(px + 2, py - 7);
      ctx2.lineTo(px + 2, py + 8); ctx2.closePath(); ctx2.fill();
      ctx2.beginPath(); ctx2.moveTo(px + 5, py - 6); ctx2.lineTo(px + 5, py + 6); ctx2.stroke(); }
  else if(k === "flag"){ ctx2.moveTo(px - 5, py + 8); ctx2.lineTo(px - 5, py - 8); ctx2.stroke();
      ctx2.beginPath(); ctx2.moveTo(px - 5, py - 8); ctx2.lineTo(px + 8, py - 5);
      ctx2.lineTo(px + 4, py - 1); ctx2.lineTo(px + 8, py + 3); ctx2.lineTo(px - 5, py + 1);
      ctx2.closePath(); ctx2.fill(); }
  else if(k === "rail"){ ctx2.moveTo(px - 9, py + 5); ctx2.lineTo(px + 9, py - 5); ctx2.stroke();
      ctx2.beginPath(); ctx2.moveTo(px - 4, py - 4); ctx2.lineTo(px + 4, py + 4); ctx2.stroke(); }
  else if(k === "clock"){ ctx2.arc(px, py, 8, 0, 6.2832); ctx2.stroke();
      ctx2.beginPath(); ctx2.moveTo(px, py); ctx2.lineTo(px, py - 5);
      ctx2.moveTo(px, py); ctx2.lineTo(px + 4, py + 2); ctx2.stroke(); }
  else if(k === "grove"){ ctx2.moveTo(px - 1.6, py + 8); ctx2.lineTo(px - 1.6, py + 1);
      ctx2.lineTo(px + 1.6, py + 1); ctx2.lineTo(px + 1.6, py + 8); ctx2.closePath(); ctx2.fill();
      ctx2.beginPath(); ctx2.arc(px, py - 3, 6.5, 0, 6.2832); ctx2.stroke(); }
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
/* 挥刀特效（用户 2026-09-23 要求优化）。
   ⚠️ 它是**扫过去**的，不是整条弧一起亮 —— 原来那版只是「画一段弧再淡掉」，
      看不出挥的方向，快攻速下还会糊成一团。现在按 t 把刀锋从一端扫到另一端，
      后面拖一小段尾巴，尾巴越靠后越细越淡。
   ⚠️ **持续时间跟攻速走**：攻速 2 刀/秒时上一道还没消失下一道就来了，会叠成一片白。
   ⚠️ 照旧只用线和弧（见 12.10 的规矩），不加渐变、不加粒子系统。 */
function fxSwing(x, y, dir, range, arc, o){
  if(REDUCE_MOTION) return;
  o = o || {};
  var life = Math.max(0.09, Math.min(0.2, 0.62 / Math.max(0.4, o.aspd || 1.25)));
  E.fx.push({k:"sw", x:x, y:y, dir:dir, range:range, arc:arc, t:0, life:life,
             crit:!!o.crit, n:o.n || 0});
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
/* ===== 塔的打击特效（用户 2026-09-22：「只有圆圈波很单调」）=====
   ⚠️ 一律**只用线、点、扇形和一次性的实心圆**，别往里加渐变、粒子系统、多段动画 ——
      用户原话「不要太复杂华丽的」，而且一波几十只怪，每一发都画复杂图形会直接掉帧。
   ⚠️ 全部走 E.fx，`REDUCE_MOTION` 开着就整段跳过；它们是纯装饰，一个字的逻辑都不许写在这儿。 */
function fxLine(x1, y1, x2, y2, col, w){          // 直射的曳光
  if(REDUCE_MOTION) return;
  E.fx.push({k:"ln", x:x1, y:y1, x2:x2, y2:y2, col:col, w:w || 2, t:0, life:0.16});
}
function fxSpark(x, y, col, n){                    // 命中处甩几根短线
  if(REDUCE_MOTION) return;
  E.fx.push({k:"sk", x:x, y:y, col:col, n:n || 4, a:Math.random() * 6.28, t:0, life:0.24});
}
function fxBoom(x, y, r, col){                     // 炸开：一圈实心往外推
  if(REDUCE_MOTION) return;
  E.fx.push({k:"bm", x:x, y:y, r:r, col:col, t:0, life:0.28});
}
function fxDash(x, y, r, col){                     // 虚线圈（光环触发那一下，比实心圈轻得多）
  if(REDUCE_MOTION) return;
  E.fx.push({k:"ds", x:x, y:y, r:r, col:col, t:0, life:0.4});
}
function fxPlus(x, y, col){                        // 回血的十字，往上飘
  if(REDUCE_MOTION) return;
  E.fx.push({k:"pl", x:x, y:y, col:col, t:0, life:0.6});
}
function fxCoin(x, y){                             // 进账的小金币
  if(REDUCE_MOTION) return;
  E.fx.push({k:"co", x:x, y:y, col:"#E3B23C", t:0, life:0.5});
}
function fxPillar(x, y, col){                      // 雷击：从画面上方劈下来的折线
  if(REDUCE_MOTION) return;
  E.fx.push({k:"pi", x:x, y:y, col:col, t:0, life:0.26});
}
function fxSwirl(x, y, r, col){                    // 漩涡：一段螺线
  if(REDUCE_MOTION) return;
  E.fx.push({k:"sr", x:x, y:y, r:r, col:col, a:Math.random() * 6.28, t:0, life:0.45});
}
function fxPull(x, y, r, col){                     // 牵引：一圈朝里收的短线
  if(REDUCE_MOTION) return;
  E.fx.push({k:"pu", x:x, y:y, r:r, col:col, t:0, life:0.35});
}
function fxBracket(x, y, r, col){                  // 标记：四个角的小折角
  if(REDUCE_MOTION) return;
  E.fx.push({k:"bk", x:x, y:y, r:r, col:col, t:0, life:0.5});
}
function fxCone(x, y, dir, arc, range, col){ fxArc(x, y, dir, range, arc, col); }
function fxArc(x, y, dir, range, arc, col){
  if(!REDUCE_MOTION) E.fx.push({k:"a", x:x, y:y, dir:dir, range:range, arc:arc, col:col, t:0, life:0.3}); }
function drawFx(){
  for(var i = E.fx.length - 1; i >= 0; i--){
    var f = E.fx[i], k = 1 - f.t / f.life;
    ctx2.globalAlpha = Math.max(0, k);
    if(f.k === "sw"){
      /* 刀锋从 dir-ha 扫到 dir+ha，后面拖 40% 弧长的尾巴。
         命中越多刀身越粗；狂刃那一刀（crit）转成金色并再粗一档。 */
      var ha = f.arc * Math.PI / 360, span = ha * 2;
      var p = Math.min(1, f.t / f.life);
      var head = f.dir - ha + span * p;
      var tail = Math.max(f.dir - ha, head - span * 0.4);
      var wid = 6 + Math.min(5, (f.n || 0)) + (f.crit ? 4 : 0);
      var cx0 = sx(f.x), cy0 = sy(f.y);
      ctx2.lineCap = "round";
      /* 外圈那一道淡的（刀气的余势）*/
      ctx2.strokeStyle = f.crit ? "rgba(240,194,60,.45)" : "rgba(252,248,240,.45)";
      ctx2.lineWidth = wid * 0.55;
      ctx2.beginPath(); ctx2.arc(cx0, cy0, f.range * 0.96, tail, head); ctx2.stroke();
      /* 刀身 */
      ctx2.strokeStyle = f.crit ? "#F0C23C" : "#FCF8F0";
      ctx2.lineWidth = wid;
      ctx2.beginPath(); ctx2.arc(cx0, cy0, f.range * 0.82, tail, head); ctx2.stroke();
      ctx2.strokeStyle = "rgba(46,42,35,.30)"; ctx2.lineWidth = 1.5; ctx2.stroke();
      /* 刀尖上那一点白 */
      ctx2.fillStyle = f.crit ? "#FFF3CB" : "#FFFFFF";
      ctx2.beginPath();
      ctx2.arc(cx0 + Math.cos(head) * f.range * 0.82, cy0 + Math.sin(head) * f.range * 0.82,
               wid * 0.42, 0, 6.2832);
      ctx2.fill();
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
      /* ⚠️ 半径夹一下：一帧里跑了很多步（或者掉帧）时 k 会掉到 −1 以下，
         算出来的半径是个极小的负数，canvas 的 arc 会当场抛 IndexSizeError。 */
      ctx2.beginPath(); ctx2.arc(sx(f.x), sy(f.y), Math.max(0, f.r * (0.6 + k * 0.5)), 0, 6.2832); ctx2.stroke();
    } else if(f.k === "b"){
      ctx2.strokeStyle = "#7FA8D8"; ctx2.lineWidth = 3; ctx2.lineCap = "round";
      ctx2.beginPath(); ctx2.moveTo(sx(f.x), sy(f.y));
      var mx2 = (f.x + f.x2) / 2 + ri(-14, 14), my2 = (f.y + f.y2) / 2 + ri(-14, 14);
      ctx2.lineTo(sx(mx2), sy(my2)); ctx2.lineTo(sx(f.x2), sy(f.y2)); ctx2.stroke();
    } else if(f.k === "a"){
      var ha2 = f.arc * Math.PI / 360;
      ctx2.fillStyle = f.col; ctx2.beginPath(); ctx2.moveTo(sx(f.x), sy(f.y));
      ctx2.arc(sx(f.x), sy(f.y), f.range, f.dir - ha2, f.dir + ha2); ctx2.closePath(); ctx2.fill();
    } else if(f.k === "ln"){                       // 曳光
      ctx2.strokeStyle = f.col; ctx2.lineWidth = f.w; ctx2.lineCap = "round";
      ctx2.beginPath(); ctx2.moveTo(sx(f.x), sy(f.y)); ctx2.lineTo(sx(f.x2), sy(f.y2)); ctx2.stroke();
    } else if(f.k === "sk"){                       // 命中的火星
      ctx2.strokeStyle = f.col; ctx2.lineWidth = 2; ctx2.lineCap = "round";
      ctx2.beginPath();
      for(var sk = 0; sk < f.n; sk++){
        var sa = f.a + sk / f.n * 6.2832, r0 = 4 + (1 - k) * 8, r1 = r0 + 6;
        ctx2.moveTo(sx(f.x) + Math.cos(sa) * r0, sy(f.y) + Math.sin(sa) * r0);
        ctx2.lineTo(sx(f.x) + Math.cos(sa) * r1, sy(f.y) + Math.sin(sa) * r1);
      }
      ctx2.stroke();
    } else if(f.k === "bm"){                       // 炸开
      var br = f.r * (0.45 + 0.55 * (1 - k));
      ctx2.fillStyle = f.col; ctx2.globalAlpha = Math.max(0, k) * 0.35;
      ctx2.beginPath(); ctx2.arc(sx(f.x), sy(f.y), br, 0, 6.2832); ctx2.fill();
      ctx2.globalAlpha = Math.max(0, k); ctx2.strokeStyle = f.col; ctx2.lineWidth = 2.5;
      ctx2.beginPath(); ctx2.arc(sx(f.x), sy(f.y), br, 0, 6.2832); ctx2.stroke();
    } else if(f.k === "ds"){                       // 虚线圈
      ctx2.strokeStyle = f.col; ctx2.lineWidth = 2; ctx2.setLineDash([6, 8]);
      ctx2.beginPath(); ctx2.arc(sx(f.x), sy(f.y), f.r, 0, 6.2832); ctx2.stroke();
      ctx2.setLineDash([]);
    } else if(f.k === "pl"){                       // 回血的十字
      var py2 = sy(f.y) - f.t * 34;
      ctx2.strokeStyle = f.col; ctx2.lineWidth = 3; ctx2.lineCap = "round";
      ctx2.beginPath();
      ctx2.moveTo(sx(f.x) - 5, py2); ctx2.lineTo(sx(f.x) + 5, py2);
      ctx2.moveTo(sx(f.x), py2 - 5); ctx2.lineTo(sx(f.x), py2 + 5);
      ctx2.stroke();
    } else if(f.k === "co"){                       // 金币
      var cy2 = sy(f.y) - f.t * 40;
      ctx2.fillStyle = f.col; ctx2.strokeStyle = "#8A5F0C"; ctx2.lineWidth = 1;
      ctx2.beginPath(); ctx2.ellipse(sx(f.x), cy2, 3.5, 5, 0, 0, 6.2832); ctx2.fill(); ctx2.stroke();
    } else if(f.k === "pi"){                       // 雷柱
      ctx2.strokeStyle = f.col; ctx2.lineWidth = 3; ctx2.lineCap = "round";
      ctx2.beginPath();
      var pxx = sx(f.x), pyy = sy(f.y);
      ctx2.moveTo(pxx, pyy - 150);
      ctx2.lineTo(pxx - 7, pyy - 95); ctx2.lineTo(pxx + 6, pyy - 52);
      ctx2.lineTo(pxx - 4, pyy - 20); ctx2.lineTo(pxx, pyy);
      ctx2.stroke();
    } else if(f.k === "sr"){                       // 漩涡的螺线
      ctx2.strokeStyle = f.col; ctx2.lineWidth = 2;
      ctx2.beginPath();
      for(var sv = 0; sv <= 26; sv++){
        var sa2 = f.a + sv * 0.36 + f.t * 6, rr2 = f.r * (1 - sv / 26) * (0.5 + 0.5 * k);
        var vx = sx(f.x) + Math.cos(sa2) * rr2, vy = sy(f.y) + Math.sin(sa2) * rr2;
        if(sv === 0) ctx2.moveTo(vx, vy); else ctx2.lineTo(vx, vy);
      }
      ctx2.stroke();
    } else if(f.k === "pu"){                       // 牵引：朝里收的短线
      ctx2.strokeStyle = f.col; ctx2.lineWidth = 2.5; ctx2.lineCap = "round";
      ctx2.beginPath();
      for(var pu = 0; pu < 8; pu++){
        var pa2 = pu / 8 * 6.2832, ro = f.r * (0.55 + 0.45 * k);
        ctx2.moveTo(sx(f.x) + Math.cos(pa2) * ro, sy(f.y) + Math.sin(pa2) * ro);
        ctx2.lineTo(sx(f.x) + Math.cos(pa2) * (ro - 16), sy(f.y) + Math.sin(pa2) * (ro - 16));
      }
      ctx2.stroke();
    } else if(f.k === "bk"){                       // 标记的四个折角
      ctx2.strokeStyle = f.col; ctx2.lineWidth = 2;
      var bq = f.r + 4 - (1 - k) * 4;
      ctx2.beginPath();
      for(var bi = 0; bi < 4; bi++){
        var dxb = bi < 2 ? -1 : 1, dyb = bi % 2 === 0 ? -1 : 1;
        var cx2 = sx(f.x) + dxb * bq, cy3 = sy(f.y) + dyb * bq;
        ctx2.moveTo(cx2 - dxb * 5, cy3); ctx2.lineTo(cx2, cy3); ctx2.lineTo(cx2, cy3 - dyb * 5);
      }
      ctx2.stroke();
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
  updateTowers(dt); updateTShots(dt); updateBuilds(dt); updateZones(dt);
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
  /* 刀雨：每 SP_RAIN_CD 秒，随机挑一只，头顶落一道 */
  if(hasSp("sp_rain")){
    P.rainCd = (P.rainCd || 0) - dt;
    if(P.rainCd <= 0){
      P.rainCd = SP_RAIN_CD;
      var live = [];
      for(i = 0; i < E.foes.length; i++) if(!E.foes[i].dead) live.push(E.foes[i]);
      if(live.length){
        var tg = pick(live);
        fxPillar(tg.x, tg.y, "#FCF8F0");
        aoe(tg.x, tg.y, 60, Math.max(1, Math.round(s.atk * 1.5)), "#FCF8F0");
      }
    }
  }
  /* 虚影步：被贴身就闪开，原地留一发 */
  if(hasSp("sp_blink")){
    P.blinkCd = (P.blinkCd || 0) - dt;
    if(P.blinkCd <= 0 && nearFoes(44) > 0){
      P.blinkCd = SP_BLINK_CD;
      var ox = me.x, oy = me.y;
      var away = me.moving > 0.05 ? me.dir : Math.random() * Math.PI * 2;
      me.x += Math.cos(away) * 200; me.y += Math.sin(away) * 200;
      fxBoom(ox, oy, 110, "#5A5468");
      aoe(ox, oy, 110, Math.max(1, Math.round(s.atk * SP_BLINK_PCT)));
      fxRing(me.x, me.y, 30, "#5A5468");
    }
  }
  if(P.rageT > 0){ P.rageT -= dt; if(P.rageT <= 0) P.rageN = 0; }
  /* 怒潮：进波那一圈之外，每 SP_TIDE_CD 秒再放一圈 */
  if(hasSp("sp_tide")){
    P.tideCd = (P.tideCd || 0) - dt;
    if(P.tideCd <= 0){ P.tideCd = SP_TIDE_CD; tideRing(s); }
  }

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
    if(w.ring){                                    // 怒潮：原地扩散的圈
      w.r += w.grow * dt; w.life -= dt;
      if(w.r >= w.max || w.life <= 0){ E.pwaves.splice(i, 1); continue; }
      for(var rj = 0; rj < E.foes.length; rj++){
        f = E.foes[rj];
        if(f.dead || w.hit[rj]) continue;
        var rd = Math.hypot(f.x - w.x, f.y - w.y);
        if(rd > w.r + f.r || rd < w.r - 46) continue;   // 只打圈经过的那一环
        w.hit[rj] = 1;
        var rdm = Math.max(1, w.dmg - f.armor);
        f.hp -= rdm; f.flash = 0.12;
        fxNum(f.x, f.y - f.r - 4, rdm, false);
        if(f.hp <= 0) killFoe(f);
      }
      continue;
    }
    w.x += w.vx * dt; w.y += w.vy * dt; w.life -= dt;
    if(w.life <= 0){ E.pwaves.splice(i, 1); continue; }
    for(var j = 0; j < E.foes.length; j++){
      f = E.foes[j];
      if(f.dead || w.hit[j]) continue;
      if(Math.hypot(f.x - w.x, f.y - w.y) > w.r + f.r) continue;
      w.hit[j] = 1;
      var d2 = guarded(f, Math.max(1, Math.round(s.atk * w.mult) - f.armor));
      if(d2 <= 0) continue;
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
  if(w === BF.lateFrom + 1) fxText("通关 · 往后是混战", "#E3B23C");
  /* ⚠️ **每一波存一次档**（用户 2026-09-22）：存的是「刚进这一波」的样子。
     部署波下面那句 openDeploy() 还会**再存一次**（发完钱、摇完货架之后），后面那一次说了算。 */
  saveWave(false);
  if(isBossWave(w)) startBoss(w);
  /* 每 BF.deploy.every 波一次部署阶段（用户 2026-09-22）。
     ⚠️ 部署波（w%5===1）和 Boss 波（w%10===0）永远撞不上，不用兜。 */
  if(isDeployWave(w)) openDeploy();
}
function startBoss(w){
  E.foes.length = 0; E.shots.length = 0; G.hauntN = 0;     // 场上的仇敌跟着一起清掉了
  E.boss = makeBoss(w); E.foes.push(E.boss); P.bossSeen++;
  fxText(E.boss.name, "#8A3223");
}
function onBossDown(b){
  E.boss = null; G.bossDown = true; pendSpecial++;
  for(var i = 0; i < E.foes.length; i++){
    var f = E.foes[i]; if(f.dead || f === b) continue;
    /* ⚠️ 清屏要**强制**清掉：「不朽者」的复活会把 killFoe 挡回去，
       不置这一下的话冕者（它召的就是不朽者）死了还留一地站着的，经验也不发。 */
    f.revived = true;
    killFoe(f);
  }
  E.shots.length = 0; E.zones.length = 0;      // 地上的火场 / 尸块跟着一起收
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

/* 身上的遗物**一律按品质从「普通」排到「神圣」**（用户 2026-09-22）。
   ⚠️ 同品质内保持 RELICS 里的原顺序（稳定排序，靠下标兜） —— 跟地牢图鉴同一个做法。
   ⚠️ 这是**显示用的**，P.relics 本身的顺序一个字没动（遗物页的下标、取舍窗都还按它算）。 */
var RIDX = {};
(function(){ for(var i = 0; i < RELICS.length; i++) RIDX[RELICS[i].id] = i; })();
function relicsByRar(){
  return P.relics.map(function(x){ return RMAP[x]; }).sort(function(a, b){
    return a.r - b.r || RIDX[a.id] - RIDX[b.id];
  });
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
  rerollLeft = BF.rerollN + (fullSet() ? 1 : 0);
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
  fillCards("swapOld", relicsByRar(),
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
  fillCards("bagList", relicsByRar(),
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
/* ⚠️ `tb` 是**每个难度层各自的最深波数**（用户 2026-09-22 的解锁条件要用它）——
   老存档没有这个字段，读处一律 `|| {}` / `|| 0` 兜底。 */
function bfMeta(){ return load(BF_KEY, {best:0, kills:0, runs:0, tb:{}}); }
function bfSave(m){ if(!save(BF_KEY, m) && window.showErr) showErr("存档写不进去"); }

/* ================================================================
   每一波存一次档（用户 2026-09-22：「战场每一波进行一次存档」）
   ⚠️ **没有开新的 localStorage 键** —— 整份塞在 youxu.bf.v1 的 `run` 字段里，
      所以 game.js 那边的 snapshot / overwriteAll / mergeData 自动带上它（mergeData 里单写了一条）。
   ⚠️ 存的是「**刚进这一波**的样子」（跟地牢续玩档同一个口径）：
      这一波打的怪、捡的金币、升的级都不算数，读档退回本波开头。
   ⚠️ **场上的怪一只都不存** —— 波是定时刷的，读档重刷一遍就行。
   ⚠️ 存档点只有两个：`nextWave()`（进新一波）和 `closeDeploy()`（摆完塔开战）。
      别再往别处加，尤其别每帧存。
   ================================================================ */
var BFRUN_V = 1;
function bfBuildRow(b){
  return {k:b.k, tid:b.tid, star:b.star, x:Math.round(b.x), y:Math.round(b.y),
          used:!!b.used, stock:b.stock || null};
}
function saveWave(needDeploy){
  if(!P || OVER) return;
  var m = bfMeta(), i;
  /* 记录顺手一起写：这样「打到很深但没死就关了页面」也不会白打一趟 */
  m.best = Math.max(m.best || 0, P.wave);
  m.tb = m.tb || {};
  m.tb[TIER.id] = Math.max(m.tb[TIER.id] || 0, P.wave);
  var bs = [];
  for(i = 0; i < E.builds.length; i++) bs.push(bfBuildRow(E.builds[i]));
  m.run = {v:BFRUN_V, tier:TIER.id, wave:P.wave, nd:!!needDeploy,
           p:P, me:{x:Math.round(E.me.x), y:Math.round(E.me.y)}, builds:bs,
           shop: needDeploy ? shopCards.slice() : null};
  bfSave(m);
}
function savedRun(){
  var m = bfMeta(), r = m.run;
  return (r && r.v === BFRUN_V && r.p && r.wave) ? r : null;
}
function clearSavedRun(){
  var m = bfMeta();
  if(m.run){ m.run = null; bfSave(m); }
}
/* 读档：先用 newRun() 把骨架搭好，再把存下来的那一份换进去。
   ⚠️ 塔一律用 mkTower() 重建 —— 存档里只有「哪座塔、几星、在哪儿」，
      def 和一堆运行时字段（cd / warn / tgt…）都得是新的。 */
function resumeSaved(r){
  var i, t = BF_TIERS[0];
  for(i = 0; i < BF_TIERS.length; i++) if(BF_TIERS[i].id === r.tier) t = BF_TIERS[i];
  TIER = t;
  newRun();
  P = r.p;
  /* 老档兜底：删掉的遗物 / 塔不认，新加的塔给它补上牌库（跟地牢 resumeRun 一个规矩）*/
  P.relics = (P.relics || []).filter(function(id){ return !!RMAP[id]; });
  P.special = (P.special || []).filter(function(id){ return !!spDef(id); });
  P.bench = (P.bench || []).filter(function(c){ return c.k !== "tower" || !!TW_MAP[c.tid]; });
  reindex();
  P.sset = {};
  for(i = 0; i < P.special.length; i++) P.sset[P.special[i]] = 1;
  if(!P.pool) P.pool = {};
  for(i = 0; i < BF_TOWERS.length; i++)
    if(P.pool[BF_TOWERS[i].id] === undefined) P.pool[BF_TOWERS[i].id] = TW_COPIES[BF_TOWERS[i].r];
  E.me.x = r.me.x; E.me.y = r.me.y; CAM.x = E.me.x; CAM.y = E.me.y;
  E.builds = [];
  for(i = 0; i < (r.builds || []).length; i++){
    var b = r.builds[i];
    if(b.k === "tower"){
      if(!TW_MAP[b.tid]) continue;
      E.builds.push(mkTower(b.tid, b.star, b.x, b.y));
    } else if(b.k === "spring") E.builds.push({k:"spring", x:b.x, y:b.y, t:0, used:!!b.used});
    else if(b.k === "shop")     E.builds.push({k:"shop", x:b.x, y:b.y, t:0, cool:0, stock:b.stock || null});
  }
  newWave(r.wave, true);                 // quiet：进波的遗物上次已经发过了，别重发
  P.wave = r.wave;
  P.hp = Math.max(1, Math.min(P.hp || 1, bstats().maxHp));
  OVER = false; pendPicks = 0; pendSpecial = 0;
  if(isBossWave(r.wave)) startBoss(r.wave);
  /* 存在部署阶段里的档：货架原样摆回去，**不再发一遍钱**（openDeploy 的 resume 分支）*/
  if(r.nd){ shopCards = (r.shop || []).slice(); openDeploy(true); }
  else { PAUSED = false; last = 0; }
}

function endRun(){
  if(OVER) return;
  OVER = true; PAUSED = true;
  if(DEPLOY) closeDeploy();
  var m = bfMeta();
  m.best = Math.max(m.best || 0, P.wave);
  m.tb = m.tb || {};
  m.tb[TIER.id] = Math.max(m.tb[TIER.id] || 0, P.wave);       // 这一层自己的最深波数（解锁下一层用）
  m.run = null;                                               // 倒下了，这一趟的档就没了
  m.kills = (m.kills || 0) + P.kills;
  m.runs = (m.runs || 0) + 1;
  bfSave(m);
  $("endTitle").textContent = P.wave > BF.lateFrom
    ? "第 " + P.wave + " 波 · 已通关" : "倒在第 " + P.wave + " 波";
  $("endStats").innerHTML =
    st2("到达波数", P.wave) + st2("历史最深", m.best) +
    st2("击杀", P.kills) + st2("等级", P.lvl) +
    st2("存活", Math.floor(P.time / 60) + " 分 " + Math.floor(P.time % 60) + " 秒") +
    st2("最大连击", P.maxCombo) +
    st2("遗物", P.relics.length) + st2("特殊遗物", P.special.length) +
    st2("部署等级", P.dlvl) + st2("场上的塔", fieldTowers());
  $("endRelics").innerHTML =
    P.special.map(function(id){ return spCardHtml(spDef(id)); }).join("") +
    relicsByRar().map(function(r){ return cardHtml(r); }).join("");
  document.querySelectorAll(".veil.on").forEach(function(v){ v.classList.remove("on"); });
  show("veilEnd");
}

/* ================================================================
   开场：难度层
   ================================================================ */
/* 第 i 层开没开：第一层永远开着，之后要**上一层走过第 BF.tierClear 波**
   （用户 2026-09-22 定的，原来是「局外养成解锁」）。
   ⚠️ 判的是 `> tierClear` 不是 `>=` —— 死在第 40 波上不算「通过 40 波」。 */
function tierOpen(i, m){
  if(i === 0) return true;
  var prev = BF_TIERS[i - 1];
  return ((m.tb && m.tb[prev.id]) || 0) > BF.tierClear;
}
function renderTiers(){
  var h = "", i, m = bfMeta();
  for(i = 0; i < BF_TIERS.length; i++){
    var t = BF_TIERS[i], open = tierOpen(i, m);
    h += '<button class="tier' + (t === TIER ? " on" : "") + '"' + (open ? "" : " disabled") +
         ' data-i="' + i + '"><b>' + t.name + '</b>' +
         '<p>' + (open ? t.desc : "通过" + BF_TIERS[i - 1].name + "第 " + BF.tierClear + " 波解锁") +
         '（怪血 ×' + t.hp.toFixed(2) + ' · 伤害 ×' + t.dmg.toFixed(2) +
         ' · 密度 ×' + t.rate.toFixed(2) + '）</p></button>';
  }
  $("tierList").innerHTML = h;
  /* 有没有没走完的那一趟（每一波存一次档）—— 有就露出「继续」*/
  var sr = savedRun(), rb = $("btnResume");
  if(rb){
    rb.hidden = !sr;
    if(sr) rb.textContent = "继续 · 第 " + sr.wave + " 波";
  }
  $("veilStart").querySelector(".sub").textContent =
    "走位躲怪，刀会自己挥。每升两级从四件遗物里挑一件。第 " + BF.lateFrom +
    " 波是终点，往后是 1–" + BF.lateFrom + " 波的怪混着出。" +
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
    clearSavedRun();                       // 重开一趟：把上一趟没走完的档丢掉
    newRun(); pendPicks = 0; pendSpecial = 0;
    $("veilStart").classList.remove("on"); last = 0;
    openDeploy();                          // 用户：**开始游戏时也进入一次部署阶段**（它自己会存一次档）
  });
  $("btnResume").addEventListener("click", function(){
    var r = savedRun();
    if(!r) return;
    $("veilStart").classList.remove("on"); last = 0;
    resumeSaved(r);
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
