/* 幽墟回廊 · 宝珠（局外养成，用户 2026-09-23）
   ================================================================
   用宝石买、在主城的「背包」里鉴定 / 强化 / 装备，**只在战场生效**。
   这个文件只放**配置表 + 纯函数**，主城（index / coop）和战场（battle.html）都加载它：
     - 买 / 鉴定 / 强化 / 装备的界面在 game.js 的「宝珠」一节；
     - 战场在**开局那一下**调 orbBuild() 算一次，快照进 P.orb（跟着战场的每波存档走）。
   数据挂在 TOWN.orb 上（youxu.town.v1，跟宝石同一个键，**没有开新的 localStorage 键**）：
     {seq, spent, bag:[宝珠], eq:[6 个 uid，0 = 空], shop:[{b, sold} × 3]}
     宝珠 = {u:uid, c:颜色 id（"" = 还没鉴定）, b:基础词缀 id（"" = 没有）,
             lv:强化了几次, pt:累计强化点数, a:[{k:词条 id, v:数值, d:翻倍过没}]}
   ⚠️ 三张表（ORB_COLORS / ORB_BASE / ORB_AFFIX）**只许往末尾追加**：
      存档码按下标存，顺序一动老码就对不上（跟 WORDS 同一条规矩）。
   ⚠️ 全部细节在 `战场模式.md` 的「十三 宝珠」，改了数值回去同步。
   ================================================================ */

var ORB_PRICE     = 1000;   // 商店里一颗多少宝石
var ORB_REROLL    = 2000;   // 刷新商店多少宝石
var ORB_SHOP_N    = 3;      // 商店几个货位
var ORB_SLOTS     = 6;      // 最多装备几颗
var ORB_BASE_RATE = 0.5;    // 商店里生成时带基础词缀的概率
var ORB_IDENT_COST = 0;     // 鉴定要多少宝石（用户没定价，先免费）
/* 强化：一共 9 次，第 N 次的价钱（用户定的） */
var ORB_ENH_COST  = [100, 500, 1000, 2000, 5000, 5000, 5000, 5000, 5000];
var ORB_PT_MIN = 7, ORB_PT_MAX = 12;   // 每次强化的点数
var ORB_PT_STEP   = 10;     // 点数每攒满 10 抽一条词条
var ORB_AFFIX_MAX = 8;      // 词条上限
var ORB_DOUBLE_AT = 100;    // 点数到 100 时随机翻倍一条
var ORB_MELT      = 100;    // 分解一颗统一给多少宝石（用户 2026-09-23：不看颜色、不看强化到几级）

/* 八种颜色。w 是鉴定出这种颜色的权重（合计 100）——**彩色 2%**（用户 2026-09-23），其余七色各 14%。 */
var ORB_COLORS = [
  {id:"red",     n:"红", c:"#B8322A", w:14},
  {id:"yellow",  n:"黄", c:"#C99A1E", w:14},
  {id:"green",   n:"绿", c:"#3F7A35", w:14},
  {id:"blue",    n:"蓝", c:"#2A62AD", w:14},
  {id:"purple",  n:"紫", c:"#6F3D98", w:14},
  {id:"white",   n:"白", c:"#E8E2D4", w:14},
  {id:"black",   n:"黑", c:"#2A2620", w:14},
  {id:"rainbow", n:"彩", c:"",        w:2}
];
/* 同色 2 / 3 / 6 颗的效果（**累积**：凑到 6 颗时 2 和 3 的也都在）。
   用户定的口径：**2 的效果一定是最强的**，3 和 6 是开局的小礼 / 顺手的便利。
   彩色只有 2：视为每种颜色各 +1 —— 所以 2 彩 + 4 杂色能同时点亮四个颜色的 2。 */
var ORB_SETS = {
  red:     {2:"伤害 +25%",           3:"暴击率 +8%",               6:"暴击伤害 +50%"},
  yellow:  {2:"捡到金币时 30% 概率翻倍", 3:"开局多 100 金",           6:"部署时，上一轮没捡的金币当场到账"},
  green:   {2:"生命上限 +25%",       3:"每波开场回复 10% 最大生命", 6:"开局白送一座随机回血塔"},
  blue:    {2:"塔的伤害 +25%",       3:"每次部署白送 1 次刷新",     6:"开局白送两座随机稀有塔"},
  purple:  {2:"经验获取 +25%",       3:"升级挑遗物时多一次「换一批」", 6:"开局获得一件随机史诗遗物"},
  white:   {2:"人口上限 +1",         3:"开局多 50 金",             6:"开局白送两座随机普通塔"},
  black:   {2:"遗物栏位 +2",         3:"开局获得一件随机普通遗物",   6:"开局获得两件随机稀有遗物"},
  rainbow: {2:"视为每种颜色各 +1"}
};
var ORB_TIERS = [2, 3, 6];

/* 基础词缀：**机制类**，商店里生成时就定死（50% 有、50% 空），买之前看得见。
   带 self 的三条只管这颗宝珠自己的强化；其余的在战场里生效，**同名的不叠加**（带两颗也只算一次）。 */
var ORB_BASE = [
  {id:"temper", n:"淬心", t:"这颗宝珠每次强化额外 +1 点数", self:1},
  {id:"steady", n:"稳手", t:"这颗宝珠每次强化至少 9 点",   self:1},
  {id:"thrift", n:"省料", t:"这颗宝珠的强化费用 −20%",     self:1},
  {id:"ward",   n:"先机", t:"每波开始的 0.5 秒内无敌"},
  {id:"dash",   n:"疾起", t:"每波开始的 3 秒内移速 +30%"},
  {id:"aegis",  n:"护身", t:"每波开场获得 8% 最大生命的护盾"},
  {id:"gasp",   n:"回光", t:"本局一次：受到致命伤害时保留 1 点生命"},
  {id:"purse",  n:"私囊", t:"开局多 30 金"},
  {id:"hunter", n:"猎首", t:"Boss 波开场获得 20% 最大生命的护盾"}
];
/* 强化词条：**数值类**，数字故意保守（一颗满强化 8 条，六颗 48 条，全压一项也只是这个数 ×48）。
   v 在 [lo, hi] 里随机取整；翻倍过的那一条 ×2。 */
var ORB_AFFIX = [
  {id:"atk",     t:"攻击 +{v}",         lo:1, hi:3},
  {id:"atkPct",  t:"伤害 +{v}%",        lo:1, hi:3},
  {id:"hp",      t:"生命上限 +{v}",     lo:4, hi:10},
  {id:"hpPct",   t:"生命上限 +{v}%",    lo:1, hi:3},
  {id:"spd",     t:"移速 +{v}",         lo:2, hi:5},
  {id:"spdPct",  t:"移速 +{v}%",        lo:1, hi:2},
  {id:"aspd",    t:"攻速 +{v}%",        lo:1, hi:2},
  {id:"crit",    t:"暴击率 +{v}%",      lo:1, hi:2},
  {id:"critDmg", t:"暴击伤害 +{v}%",    lo:3, hi:8},
  {id:"range",   t:"刀程 +{v}",         lo:1, hi:3},
  {id:"armor",   t:"护甲 +{v}",         lo:1, hi:1},
  {id:"cut",     t:"受到的伤害 −{v}%",  lo:1, hi:2},
  {id:"xp",      t:"经验获取 +{v}%",    lo:2, hi:5},
  {id:"gold",    t:"金币获取 +{v}%",    lo:2, hi:5},
  {id:"pickup",  t:"拾取范围 +{v}",     lo:4, hi:10},
  {id:"tower",   t:"塔的伤害 +{v}%",    lo:1, hi:3}
];

var ORB_CMAP = {}, ORB_BMAP = {}, ORB_AMAP = {};
(function(){
  var i;
  for(i = 0; i < ORB_COLORS.length; i++) ORB_CMAP[ORB_COLORS[i].id] = ORB_COLORS[i];
  for(i = 0; i < ORB_BASE.length; i++)   ORB_BMAP[ORB_BASE[i].id]   = ORB_BASE[i];
  for(i = 0; i < ORB_AFFIX.length; i++)  ORB_AMAP[ORB_AFFIX[i].id]  = ORB_AFFIX[i];
})();

function orbRand(lo, hi){ return lo + Math.floor(Math.random() * (hi - lo + 1)); }

/* ---- 正规化：存档里读回来的一律过这儿（坏档、老档、删掉的词条都在这儿掉）---- */
function blankOrb(){ return {seq:0, spent:0, bag:[], eq:[0, 0, 0, 0, 0, 0], shop:null}; }
function fixOrbOne(o){
  if(!o || typeof o !== "object" || !(o.u > 0)) return null;
  var out = {u: Math.floor(o.u), c: ORB_CMAP[o.c] ? o.c : "", b: ORB_BMAP[o.b] ? o.b : "",
             lv: Math.max(0, Math.min(ORB_ENH_COST.length, Math.floor(o.lv || 0))),
             pt: Math.max(0, Math.floor(o.pt || 0)), a: []};
  var a = Array.isArray(o.a) ? o.a : [];
  for(var i = 0; i < a.length && out.a.length < ORB_AFFIX_MAX; i++){
    var x = a[i];
    if(x && ORB_AMAP[x.k]) out.a.push({k:x.k, v:Math.max(0, Math.floor(x.v || 0)), d:x.d ? 1 : 0});
  }
  return out;
}
function fixOrb(od){
  var out = blankOrb(), i, seen = {};
  if(!od || typeof od !== "object") return out;
  out.spent = Math.max(0, Math.floor(od.spent || 0));
  var bag = Array.isArray(od.bag) ? od.bag : [];
  for(i = 0; i < bag.length; i++){
    var o = fixOrbOne(bag[i]);
    if(!o || seen[o.u]) continue;
    seen[o.u] = 1; out.bag.push(o);
    out.seq = Math.max(out.seq, o.u);
  }
  out.seq = Math.max(out.seq, Math.floor(od.seq || 0));
  /* 装备栏：认得的、鉴定过的、不重复的才留 */
  var eq = Array.isArray(od.eq) ? od.eq : [], used = {};
  for(i = 0; i < ORB_SLOTS; i++){
    var u = Math.floor(eq[i] || 0), ob = u ? orbFind(out, u) : null;
    out.eq[i] = (ob && ob.c && !used[u]) ? u : 0;
    if(out.eq[i]) used[u] = 1;
  }
  if(Array.isArray(od.shop) && od.shop.length === ORB_SHOP_N){
    out.shop = od.shop.map(function(s){
      return {b: (s && ORB_BMAP[s.b]) ? s.b : "", sold: !!(s && s.sold)};
    });
  }
  return out;
}
function orbFind(od, u){
  for(var i = 0; i < od.bag.length; i++) if(od.bag[i].u === u) return od.bag[i];
  return null;
}

/* ---- 文案 ----
   英文界面（i18n-en.js 的 i18nApplyOrb 把表里的中文换掉了）只剩这几个拼接用的字要分语言。*/
function orbEn(){ return typeof UI_EN !== "undefined" && UI_EN; }
function orbSep(){ return orbEn() ? ": " : "："; }
function orbColorName(o){ return o.c ? ORB_CMAP[o.c].n + (orbEn() ? " orb" : "珠") : (orbEn() ? "Unidentified" : "未鉴定"); }
function orbAffixText(x){
  var d = ORB_AMAP[x.k];
  return d ? d.t.replace("{v}", String(x.d ? x.v * 2 : x.v)) + (x.d ? " ×2" : "") : "";
}
function orbBaseText(id){ var b = ORB_BMAP[id]; return b ? b.n + orbSep() + b.t : ""; }

/* ---- 数一数装备着的颜色，算出点亮了哪些效果 + 词条合计 ----
   返回 {cnt:{颜色:有效颗数}, on:{"red2":1, …}, add:{atk:3, …}, base:{ward:1, …}}。
   ⚠️ 没鉴定的不算（fixOrb 已经把它们挡在装备栏外面了，这里再兜一层）。
   ⚠️ 彩色要 2 颗才点亮；点亮之后**每种颜色各 +1**（彩色自己不 +1）。 */
function orbBuild(od){
  var out = {cnt:{}, on:{}, add:{}, base:{}}, raw = {}, i, j;
  if(!od) return out;
  for(i = 0; i < ORB_SLOTS; i++){
    var o = od.eq[i] ? orbFind(od, od.eq[i]) : null;
    if(!o || !o.c) continue;
    raw[o.c] = (raw[o.c] || 0) + 1;
    if(o.b) out.base[o.b] = 1;
    for(j = 0; j < o.a.length; j++){
      var x = o.a[j];
      out.add[x.k] = (out.add[x.k] || 0) + (x.d ? x.v * 2 : x.v);
    }
  }
  var bow = (raw.rainbow || 0) >= 2;
  for(i = 0; i < ORB_COLORS.length; i++){
    var id = ORB_COLORS[i].id, n = raw[id] || 0;
    if(id === "rainbow"){ out.cnt[id] = n; if(bow) out.on.rainbow2 = 1; continue; }
    if(bow) n++;
    out.cnt[id] = n;
    for(j = 0; j < ORB_TIERS.length; j++){
      var t = ORB_TIERS[j];
      if(n >= t && ORB_SETS[id][t]) out.on[id + t] = 1;
    }
  }
  return out;
}
/* 点亮了的效果，按颜色排成一串文案（主城「人物」页和战场「信息」页共用） */
function orbOnLines(b){
  var out = [];
  for(var i = 0; i < ORB_COLORS.length; i++){
    var id = ORB_COLORS[i].id;
    for(var j = 0; j < ORB_TIERS.length; j++){
      var t = ORB_TIERS[j];
      if(b.on[id + t]) out.push({c:id, t:t, s:ORB_SETS[id][t]});
    }
  }
  return out;
}
function orbAddLines(b){
  var out = [];
  for(var i = 0; i < ORB_AFFIX.length; i++){
    var k = ORB_AFFIX[i].id;
    if(b.add[k]) out.push(ORB_AFFIX[i].t.replace("{v}", String(b.add[k])));
  }
  return out;
}
function orbBaseLines(b){
  var out = [];
  for(var i = 0; i < ORB_BASE.length; i++){
    var k = ORB_BASE[i].id;
    if(b.base[k] && !ORB_BASE[i].self) out.push(ORB_BASE[i].n + orbSep() + ORB_BASE[i].t);   // self 的只管强化，不进战场
  }
  return out;
}
