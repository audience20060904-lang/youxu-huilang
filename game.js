/* 幽墟回廊 · 核心逻辑
   依赖加载顺序：util.js → words-a1.js → content.js → art.js → game.js
   本文件只管规则和渲染，数值和文案在 content.js / words-a1.js */
(function(){
"use strict";

const W = CHAPTER.W, H = CHAPTER.H, FLOORS = CHAPTER.floors;
/* **这一章一共几层** —— 第五章「无尽」是 Infinity（`endless:true`，见 content.js 的 CHAPTERS）。
   ⚠️ 别再直接读 FLOORS：它是「普通章的 50 层」，无尽章读它会在第 50 层莫名其妙地通关。
   Infinity 进 Math.min 就是「不封顶」，`G.floor > floorMax()` / `=== floorMax()` 永远不成立，
   所以下面那些「最后一层」「章末 Boss」「通关」的分支在无尽章里自动全部走不到。 */
function floorMax(ch){ return ((ch || CH) && (ch || CH).endless) ? Infinity : FLOORS; }
function isEndless(){ return !!(CH && CH.endless); }
/* ===== 深渊（用户 2026-09-22）=====
   **前四章走过第 50 层的章末 Boss 之后，下面还有一层**：第 51 层，里面是血量无限的
   「无终之影」（数值和形状全在 content.js 的 ABYSS 那一段）。它不会倒下，所以这一层
   **永远不会清空、不会有阶梯、也没有下一层** —— 这一趟只能以「玩家倒下」收场
   （或者主动放弃；通关那一笔在踏进深渊的那一下就记下了，见 nextFloor 的 P.cleared）。
   ⚠️ **无尽章没有深渊**（它本来就没有底）：abyssFloor() 在那一章返回 Infinity，
   跟 floorMax() 一个路子 —— 进 Math.min 就是不封顶，`=== abyssFloor()` 永远不成立。
   ⚠️ **章末 Boss 那一层仍然是 floorMax()（50）**，深渊是通关**之后**的加时，不是通关的条件。 */
function abyssFloor(ch){ return ((ch || CH) && (ch || CH).endless) ? Infinity : FLOORS + 1; }
function isAbyssFloor(f, ch){ return f === abyssFloor(ch); }
function inAbyss(){ return !!(G && isAbyssFloor(G.floor)); }
/* 「没有庇护」的地方（用户 2026-09-25）：无尽章第 ENDLESS_FROM(50) 层往下 + 深渊（前四章第 51 层）。
   这里**练习模式整个不算**：+50 护甲不给、攻击减半也不减（stats() 最后那一步判）。
   遗物的「受到的伤害 −N%」照常生效（用户明确说的），别在 mitigate() 里动它。*/
function noShelterAt(f){ return !!(CH && ((CH.endless && f > ENDLESS_FROM) || isAbyssFloor(f))); }
function noShelter(){ return !!(G && noShelterAt(G.floor)); }
/* 无终之影第 n 层的血量和攻击：血量翻倍，攻击跟着血量走（10%，最少 1）——两条线是同一条。 */
function abyssHp(layer){ return ABYSS_HP0 * Math.pow(ABYSS_X, Math.max(0, layer - 1)); }
function abyssDmg(layer){ return Math.max(1, Math.round(abyssHp(layer) * ABYSS_DMG_PCT)); }

/* ================= 联机（第一期 · 骨架）=================
   COOP 只在 coop.html 里为真（它在 game.js 之前设了 window.__COOP）。
   index.html 一个字没变，COOP 在那边恒为 false —— 所有下面带 if(COOP) 的分支单人版都走不到。
   详细设计和踩过的坑见仓库根目录的 联机方案.md，改联机相关的东西记得回去同步那份文档。*/
const COOP = !!window.__COOP;
var coopMoveWant = false;      // 本地「已经点了寻路」的意愿，真正开始走要等服务器的 go
var coopMateBusy = false;      // 队友是不是在忙（战斗/弹层）—— 房主等它变 false 才敢算下一步
var coopPendingFloor = false;  // 非房主：正等着房主广播这一层的世界包
var coopMateTimer = null;      // 非房主：断点续走的小轮询（等 G.paused 解开再继续 walkPath）
var coopMateX = null, coopMateY = null;   // 队友最后上报的位置，只给渲染队友棋子用
var coopStatusTimer = null;               // 定时把自己的 hp/连击/遗物数广播出去（队友状态条）
var coopMateInfo = null;       // 队友最后一次上报的状态（渲染 #mateRow 用）
var coopMyName = "";           // 自己填的名字，广播给队友状态条用
var coopProposedRoute = null;  // 房主提的那条路线 id（两边都存一份，只是提议，没确认不会真的进）
var coopEverConnected = false; // 连过一次房间没有 —— 用来区分"从没组过队"和"组过队又断线了"
function coopIsHost(){ return !COOP || (window.NET && NET.isHost()); }
/* 移动锁的解除条件（用户 2026-09 改窄了）：**只看怪清没清完，不再管地上金币**——
   金币两人各自生成/各自捡（见下面 autoPath 那条注释），拿它当解锁条件的话，
   一个人手快先捡完，另一个人还没捡到就已经解锁了，反而说不清。
   locked 为真时：手动移动整个禁用、寻路只找怪；变假的那一刻由 coopUnlockMove() 统一收尾。*/
function coopLocked(){ return COOP && !!G && !!G.mobs && G.mobs.length > 0; }
var coopLockNoteAt = 0;    // 节流：手动动一下就提示一句「怪没清完」，别一直按着方向键刷屏
function coopNoteLocked(){
  const now = Date.now();
  if(now - coopLockNoteAt < 1500) return;
  coopLockNoteAt = now;
  say(T("这一层的怪还没清完 —— 两人先一起点「寻路」走。"), "sys");
}
const LEX_KEY = "youxu.a1lex.v1", CODEX_KEY = "youxu.codex.v1", META_KEY = "youxu.meta2.v1";
/* 战场模式的记录键（battle.js 拥有它，只有 battle.js 写）。
   game.js 里只出现在 snapshot() / overwriteAll() / mergeData() 三处 ——
   它不是地牢的进度，所以 commit() / commitPerm() 故意不碰它。 */
const BF_KEY = "youxu.bf.v1";

/* 所有落盘都过这一道。util 的 save 写不进去会返回 false（无痕模式、本地存储被禁、配额满），
   以前是静默丢档 —— 玩家一路玩一路以为在存，关掉才发现什么都没有。现在第一次失败就顶到
   页面顶部那条报错横幅上，并指路去下载存档文件。 */
var saveWarned = false;
function put(k, v){
  if(save(k, v)) return true;
  if(!saveWarned){
    saveWarned = true;
    if(window.showErr) window.showErr(
      T("存档写不进去 —— 浏览器多半开了无痕模式，或者禁掉了本地存储。这一趟关掉页面就没了，换个普通窗口再来。"));
  }
  return false;
}

/* 三份永久数据都常驻内存，游戏过程中只改内存；落盘统一交给 commit()。
   —— 存档点只有三个：进入关卡 / 下一层 / 回到主城。 */
let LEX = load(LEX_KEY, {});
let CODEX = load(CODEX_KEY, {});
/* accF：**按层累计的答题记录**（用户 2026-09 的「历史平均正确率（该层）」）——
   形如 {"23":{r:340,w:80}}，跨存档累计，结算时拿来跟本局正确率对比。
   它是 MET 里的一个字段，跟着四个永久键一起落盘，不用新开 localStorage 键。*/
let MET = load(META_KEY, {best:0, runs:0, clears:0, t:0, accF:{}});
if(!MET.accF || typeof MET.accF !== "object") MET.accF = {};   // 老档没有这个字段
/* 今日学习（用户 2026-09-25，信息页「词汇记录」头一行）：MET.day = {d:"本地日期", r:答对, w:答错, ws:{词键:1}}。
   跨天就整份换新（todayRec()）；跟着 MET 落盘 / 进存档文件，**不进存档码**（它只管今天）。*/
function dayKey(){ const t = new Date(); return t.getFullYear() + "-" + (t.getMonth() + 1) + "-" + t.getDate(); }
function todayRec(){
  const d = dayKey();
  if(!MET.day || MET.day.d !== d || !MET.day.ws) MET.day = {d:d, r:0, w:0, ws:{}};
  return MET.day;
}
let P = null, G = null, B = null, cells = [], pendingLoot = null, pendingRoom = null, chestQ = null, reopenShop = null;
let lastAct = 0, lockUntil = 0;
var OPT_KEY = "youxu.opt.v1";
var OPT = load(OPT_KEY, {speak:true, auto:true, lock:false});   // lock = 锁定冒险
function saveOpt(){ put(OPT_KEY, OPT); }

/* ================= 章节 =================
   CH 是**当前这一章**（content.js 的 CHAPTERS 里的一条）。四章共用地图尺寸和主角数值
   （那些在 CHAPTER 里），各章不同的只有：名字、词难度 wordLv、宝石倍率 gemMult、
   怪物加成 foeBonus、章末 Boss。**换章只能走 setChapter()**。 */
function chapterById(id){
  for(let i=0;i<CHAPTERS.length;i++) if(CHAPTERS[i].id === id) return CHAPTERS[i];
  return null;
}
/* 显示用的章号：学中文时多了一章「书冢」（id 6）排在无尽前面，所以显示的第几章看 no（content.js 末尾那段），
   没有 no 就是 id。存档、查表一律用 id —— 这个只给「第 N 章」那几行字用。*/
function chNo(c){ c = c || CH; return (c && (c.no || c.id)) || 1; }
/* 这条路 / 这一章是不是当前学习语言的（learn 字段；不写 = 所有语言都有）*/
function forLearn(x){ return !x || !x.learn || x.learn === LANG_LEARN; }
function setChapter(id){
  const c = chapterById(id);
  if(c) CH = c;
  $("hChap").textContent = CH.name;   // 顶栏那块在主城里固定写「主城 · 灰岩镇」，不用管
  return CH;
}

/* ===== 学中文时的几个小口子（2026-09-23，见 i18n.js / words-zh.js）=====
   词对象的 en 永远是「要学的那个词」、cn 是母语释义；学中文时多一个 py（拼音）。
   这几个函数在学英语时都退化成原来的样子（没有 py）。*/
function pyTag(w){ return w && w.py ? "<span class=\"py\">" + w.py + "</span>" : ""; }
/* 学西班牙语（2026-09-23）：名词带冠词 w.ar（el / la / el/la / los / las）。
   题面在词前面挂一个小小的冠词；拼写题 / 宝箱没有拼音可给，就把「la …」当提示（性别本来就是要背的）。*/
function arTag(w){ return w && w.ar ? "<span class=\"ar\">" + w.ar + "</span> " : ""; }
function hintTag(w){
  /* 学日语：拼的是**读音**（假名），所以提示给的是写法（漢字）；写法本来就是假名的词没有提示 */
  if(LEARN_JA) return w && w.py ? "<span class=\"py\">" + w.en + "</span>" : "";
  return pyTag(w) || (w && w.ar ? "<span class=\"py\">" + w.ar + " …</span>" : "");
}
/* 拼写题要拼出来的那一串：学日语拼**假名读音**（w.py；本来就是假名的词 py 是空的，就拼它自己），
   别的语言都是词本身。拼写题 / 宝箱 / 笔顺 / 判对错一律过它，别再直接读 word.en */
function spellOf(w){ return LEARN_JA ? (w.py || w.en) : w.en; }
function wordFull(w){ return w ? (w.ar ? w.ar + " " : "") + w.en : ""; }
function wordShow(w){ return w && w.py ? w.en + " (" + w.py + ")" : wordFull(w); }
/* 熟练度表 LEX 的键：英语 / 中文就是词本身；**西语是 "es:词"**（pan / pie / once / red 这些跟英语拼写一样，
   不加前缀两门语言的熟练度就串了）。凡是 LEX[...] 一律过 lexKey()，按键反查词一律过 lexWord()。*/
function lexKey(w){ return w.k || w.en; }
function lexWord(k){
  if(LANG_LEARN === "es") return k.slice(0, 3) === "es:" ? WMAP[k.slice(3)] : null;
  if(LEARN_JA) return k.slice(0, 3) === "ja:" ? WMAP[k.slice(3)] : null;
  return WMAP[k];
}
/* 比对用：去掉重音符号、转小写（图鉴搜西语时不用打 á é ñ 也搜得到；汉字不受影响）*/
function foldMarks(s){ return String(s).normalize("NFD").replace(/[\u0300-\u036f']/g, "").toLowerCase(); }
/* 词长：英语是字母数；中文按**拼音字母**数（长句 / 累牍 / 长考那三件遗物用，汉字最多 4 个，按字数算它们就废了）*/
function wordLen(w){
  /* 日语：按**罗马字母数**估 —— 一个假名大约两个字母，小写的ゃゅょ・長音ー不算一拍（ん也按两个算，差不多）*/
  if(LEARN_JA){
    const k = spellOf(w).replace(/[ゃゅょぁぃぅぇぉャュョァィゥェォー]/g, "");
    return k.length * 2;
  }
  if(!w.py) return w.en.length;
  return w.py.normalize("NFD").replace(/[^a-z]/gi, "").length;
}
/* 拼字题的干扰键：英语给字母（原来那一套），中文从同一档的别的词里挑字 */
/* 西语拼写题的干扰键：先给这个词里带重音 / ñ 的字母配一个「没带的」（á → a、ñ → n —— 重音本来就是要背的），
   不够再从常见字母里随手补 */
function esDecoys(word, n){
  const out = [], base = {"á":"a", "é":"e", "í":"i", "ó":"o", "ú":"u", "ü":"u", "ñ":"n"};
  word.en.split("").forEach(function(c){ if(base[c] && out.indexOf(base[c]) < 0) out.push(base[c]); });
  out.sort(function(){ return Math.random() - .5; });
  out.length = Math.min(out.length, n);
  const extra = "aeiosrnlcdtmu".split("");
  while(out.length < n) out.push(pick(extra));
  return out;
}
/* 日语拼写题的干扰键：先给这个词里的假名配一个「长得像 / 念得像」的（濁点・半濁点、小っ小ゃ、シツソン），
   不够再从同一档别的词的读音里挑假名 */
const JA_LOOK = [
  "かが","きぎ","くぐ","けげ","こご","さざ","しじ","すず","せぜ","そぞ","ただ","ちぢ","つづっ","てで","とど",
  "はばぱ","ひびぴ","ふぶぷ","へべぺ","ほぼぽ","やゃ","ゆゅ","よょ","あぁ","いぃ","うぅ","えぇ","おぉを","わゎ",
  "ぬめ","ねれわ","るろ","さち","きさ","いり","はほ","まも","しつ",
  "カガ","キギ","クグ","ケゲ","コゴ","サザ","シジツ","スズ","セゼ","ソゾン","タダ","チヂ","ツヅッシ","テデ","トド",
  "ハバパ","ヒビピ","フブプ","ヘベペ","ホボポ","ヤャ","ユュ","ヨョ","アァ","イィ","ウゥ","エェ","オォ","ンソ","ノメ","ワウ","ルレ","クワ"];
function jaDecoys(word, n){
  const own = spellOf(word).split(""), out = [];
  own.forEach(function(c){
    JA_LOOK.forEach(function(g){
      if(g.indexOf(c) < 0) return;
      g.split("").forEach(function(d){ if(d !== c && own.indexOf(d) < 0 && out.indexOf(d) < 0) out.push(d); });
    });
  });
  out.sort(function(){ return Math.random() - .5; });
  out.length = Math.min(out.length, Math.ceil(n / 2));
  const pool = scopeToLevel(ALLW, word.lv || 1);
  for(let guard = 0; out.length < n && guard < 200; guard++){
    const t = spellOf(pick(pool)), c = t.charAt(Math.floor(Math.random() * t.length));
    if(c && c !== "ー" && own.indexOf(c) < 0 && out.indexOf(c) < 0) out.push(c);
  }
  return out;
}
function decoyChars(word, n){
  const own = word.en.split(""), out = [];
  const pool = scopeToLevel(ALLW, word.lv || 1);
  for(let guard = 0; out.length < n && guard < 200; guard++){
    const w = pick(pool), c = w.en.charAt(Math.floor(Math.random() * w.en.length));
    if(c && own.indexOf(c) < 0 && out.indexOf(c) < 0) out.push(c);
  }
  return out;
}

function gate(rep){
  const now = Date.now();
  if(now < lockUntil) return false;
  if(now - lastAct < (rep ? 200 : 95)) return false;
  lastAct = now; return true;
}
function lockInput(ms){ lockUntil = Math.max(lockUntil, Date.now() + ms); }

/* ================= 局 ================= */
function newRun(){
  P = { x:0, y:0, lvl:1, xp:0, hp:CHAPTER.playerBase.hp, gold:0, kills:0,
        right:0, wrong:0, seenWords:[], used:{}, combo:0, maxCombo:0,
        relics:[], haunt:[], hauntAt:{}, undying:false,
        // 2026-09 第二批遗物用的四个累加字段（都跟着 P 进续玩档，老档一律 || 0 兜底）
        spent:0, chew:false, charge:0,
        // 护盾（第四批）：先扣盾再扣血。shield 是当前盾，aegisN 是凝盾数到第几题了
        shield:0, aegisN:0, recoil:0, revived:false,
        // 练习模式：进洞之前在洞窟弹层里勾的，整趟有效（stats() 里读）
        practice: !!practiceOn,
        // 难度等级：选完路线弹窗里定的，整趟有效（同样只在 stats() 里读）
        diff: diffId(),
        // 联机第二期：倒地（血掉光不出局，队友清完层原地复活），见 联机方案.md
        down:false,
        // 这一趟按层记的答题数，结算时并进 MET.accF
        accF:{},
        // 祝福·偏爱本局已经拿到过哪几件（拿到一次那一件就不再加权）
        blessGot:[],
        /* 深渊（用户 2026-09-22）：cleared = 走过章末 Boss 那一层了（通关照记），
           abyss = 在深渊里打穿了无终之影几层（结算按层给宝石）。两个都跟着续玩档。*/
        cleared:false, abyss:0,
        /* 金坛（无尽章，2026-09-25）：gild 是投出来的属性加成 {atk,hp,def,crit,pct,cut}，
           gildN 是这一趟投过几次（价格和档位都按它算）。本局有效，跟着续玩档。*/
        gild:{}, gildN:0,
        /* 新手教程（2026-09-23）：这一趟是教程关 —— 只有一层、不写续玩档、不结算（见「新手教程」一节）*/
        tut: !!tutPending };
  tutPending = false;
  G = { floor:0, paused:false, over:false };
  newRelics = [];
  comboShown = null;          // 连击动效的基准，新的一趟从头算（不然第一场会白播一次「掉了」）
  resetHpFx();                // 血条动效同理，新的一趟别一进门就播一下
  autoOff();
  // 不用先删旧档：下面 nextFloor() 会 commit 一次，直接盖掉（存档点之一：进入关卡）
  $("log").innerHTML = "";
  hideAll();
  if(!P.tut){
    say(T("石门在身后合上。走廊里只有火把的回声。"), "sys");
    say(T("这一层有几只东西待在原地不动 —— 找到它们，念对那个词。"), "sys");
  }
  if(P.practice) say(T("<b>练习模式</b>：护甲 +50，攻击减半。"), "sys");
  if(P.diff !== DIFF_DEFAULT){
    const dd = diffById(P.diff);
    if(dd) say("<b>" + dd.name + T("</b>：") + dd.desc + T("。"), "sys");
  }
  nextFloor();
}
/* 升一级要多少经验。「速成」在这儿减 20% —— HUD 的经验条和 gainXp 都走它，一处改两处生效。*/
function xpNeed(l){
  let n = 5 + l * 3;
  // 1~20 级的这一段 ×1.5（用户 2026-09）—— 前期升级太快，怪很快就打成纸糊的
  if(l <= CHAPTER.xpEarlyTo) n = Math.ceil(n * CHAPTER.xpEarlyMult);
  return hasRelic("adept") ? Math.max(1, Math.ceil(n * 0.8)) : n;   // 速成
}
/* 属性只有两个来源：等级 + 遗物。装备系统已删。
   幸运也一并去掉了 —— 它只影响过掉宝品质，现在没宝可掉。*/
function stats(){
  const pb = CHAPTER.playerBase, pl = CHAPTER.perLevel;
  const s = {atk: pb.atk + (P.lvl-1) * pl.atk, def:0, crit:pb.crit,
             maxHp: pb.hp + (P.lvl-1) * pl.hp};
  /* 金坛（无尽章 50 层往下的 Boss 房，2026-09-25）：投金币换的加成跟等级同一档，是**底子** ——
     它不是遗物，本局一直有效；放在最前面，后面铁躯 / 重装那些乘法件照样放大它。*/
  s.atk += gildGet("atk"); s.maxHp += gildGet("hp"); s.def += gildGet("def"); s.crit += gildGet("crit");
  // 普通品质：纯数值，全部在这儿结清
  if(hasRelic("whet"))  s.atk += 3;
  if(hasRelic("grind")){ s.atk += 5; s.maxHp -= 5; }          // 砺石：带负面权衡的合成燃料
  if(hasRelic("nick")){ s.atk += 1; s.crit += 4; }
  if(hasRelic("iron"))  s.def += 1;
  if(hasRelic("plate")) s.def += 2;
  if(hasRelic("gird")){ s.def += 1; s.maxHp -= 2; }
  if(hasRelic("heart")) s.maxHp += 6;
  if(hasRelic("ward"))  s.maxHp += 7;
  if(hasRelic("vigor")){ s.maxHp += 17; s.atk -= 4; }         // 血囊：同上
  if(hasRelic("pad"))   s.maxHp += 8;                        // 棉衬
  if(hasRelic("keen"))  s.crit += 5;
  if(hasRelic("overcrit"))  s.crit += OVERCRIT_CRIT;         // 溢锋（第十一批）：溢出那一半在 answer() 的 critMult
  if(hasRelic("bloodmoon")) s.crit += MOON_CRIT;             // 血月（第十一批）：回血那一半在 answer()
  /* 薄刃 2026-09-21 从「暴击率 +8%」改成「暴击伤害 +50%」——
     暴击率那一档普通品质已经有锐眼和刻痕了，这一件挪去填暴击伤害。加成在 answer() 的 critMult。*/
  if(hasRelic("rustplate")){ s.def += 2; s.crit -= 6; }      // 生锈重甲：带负面权衡的合成燃料
  if(hasRelic("twoply")) s.def += TWOPLY_ARMOR;              // 双层甲
  /* ===== 第九批「跨流派组合」的底数（2026-09-21）=====
     每件都自带一个数，另一半挂在别的流派上 —— **底数别删**，删了就又是「独立价值 0」的寄生件。*/
  if(hasRelic("armpad"))     s.def += ARMPAD_ARMOR;      // 甲垫：护甲→每层护盾（结算在 nextFloor）
  if(hasRelic("underarmor")) s.def += UNDERARM_ARMOR;    // 甲下：护甲→每层回血（同上）
  if(hasRelic("armblade"))   s.def += ABLADE_ARMOR;      // 甲刃：护甲→暴击率（在 defGear 之后加）
  if(hasRelic("ironvow"))    s.def += IRONVOW_ARMOR;     // 铁誓：护甲→伤害%＋减伤
  if(hasRelic("confluence")) s.def += CONF_ARMOR;        // 万流归宗：三条线各数几档
  if(hasRelic("chainmail")){                             // 链甲：连击→护甲
    s.def += CHAINMAIL_ARMOR + Math.min(CHAINMAIL_MAX, Math.floor((P.combo || 0) / CHAINMAIL_AT));
  }
  if(hasRelic("paperweight")) s.maxHp += PAPER_HP;       // 镇纸：生命上限→攻击（在下面算完上限再加）
  if(hasRelic("weight")){                                // 秤砣：金币→暴击率
    s.crit += WEIGHT_CRIT + Math.min(WEIGHT_MAX, Math.floor((P.gold || 0) / WEIGHT_PER) * WEIGHT_STEP);
  }
  if(hasRelic("moltengold")){                            // 熔金：金币→攻击＋暴击
    const t = Math.min(MOLTEN_TIERS, Math.floor((P.gold || 0) / MOLTEN_PER));
    s.atk += t * MOLTEN_ATK; s.crit += t * MOLTEN_CRIT;
  }
  if(hasRelic("mirroredge")){                            // 镜锋：护盾→暴击率
    s.crit += Math.min(MEDGE_MAX, Math.floor((P.shield || 0) / MEDGE_PER) * MEDGE_STEP);
  }
  /* 2026-09-21：这三件原来「独立价值恒为 0」（自己不产护甲/护盾，全靠别的件喂），
     这一批各补了一个自带底数。⚠️ 底数要放在重装/硬茧的乘法**之前**。*/
  if(hasRelic("bastion")) s.def += BASTION_ARMOR;            // 铁壁：自带底数
  if(hasRelic("stack"))   s.def += STACK_ARMOR;              // 叠甲：自带底数
  if(hasRelic("rampart")) s.def += RAMPART_ARMOR;            // 残壁：自带底数
  /* 轻装上阵：**每空一个遗物格** +3 护甲（用户 2026-09 改的，原来是「全程没换过」）。
     跟「空手」一样按 RELIC_MAX 算，不跟「行囊」和深层多出来的格子走 ——
     不然带上行囊就白得 9 点护甲，两件叠成滚雪球。*/
  if(hasRelic("spry")) s.def += Math.min(SPRY_MAX, Math.max(0, RELIC_MAX - P.relics.length) * SPRY_ARMOR);
  /* 久经：护盾这一趟每被打穿 VETERAN_AT 次 +VETERAN_ARMOR 护甲，本局累计封在 VETERAN_MAX。
     ⚠️ 现算（不写回 P 上）—— 卖掉/换掉这件，加的护甲立刻跟着没。*/
  if(hasRelic("veteran")){
    s.def += Math.min(VETERAN_MAX, Math.floor((P.shieldBrokenCount || 0) / VETERAN_AT) * VETERAN_ARMOR);
  }
  /* 成长线：烙印/铭心按**当前等级现算**（用户 2026-09）——
     ⚠️ 以前是升一级就把加成攒进 P.bonusAtk / P.bonusHp，卖掉遗物那笔加成还赖着不走，
     成了全游戏唯一的永久面板加成。现在拆掉就立刻失效，跟别的遗物一个规矩。*/
  /* 烙印/铭心 2026-09-21 加了封顶：原来跟等级线性长、没有上限，
     基准层（56 级）就是「攻击 +56 / 生命上限 +168」，把面板整个翻一倍，无尽章还会继续长。*/
  if(hasRelic("brand"))   s.atk   += Math.min(BRAND_MAX, P.lvl);          // 烙印
  if(hasRelic("engrave")) s.maxHp += Math.min(ENGRAVE_MAX, P.lvl * 3);    // 铭心
  /* 第十一批（2026-09-25）：年轮 / 厚土也按等级现算，但**不封顶** —— 每 5 级 / 每 2 级才 +1，
     占面板的比例基本不变（第 31 层和无尽第 200 层都是两成上下），不会像不封顶的烙印那样把面板翻倍。*/
  if(hasRelic("rings")) s.atk   += Math.floor(P.lvl / RINGS_PER);        // 年轮
  if(hasRelic("loam"))  s.maxHp += Math.floor(P.lvl / LOAM_EVERY);       // 厚土
  // 铁躯：最大生命 ×1.8 —— 放在所有加血遗物之后、献身之前（两件一起就是 ×0.9）
  if(hasRelic("titan")) s.maxHp = Math.max(1, Math.round(s.maxHp * TITAN_MULT));
  if(hasRelic("colossus")) s.maxHp = Math.max(1, Math.round(s.maxHp * COLOSSUS_MULT));   // 巨骨：跟铁躯连乘（第十一批）
  /* 献身：最大生命减半 —— **必须放在所有加血遗物之后**，下面的背水也按减半后的上限判 */
  if(hasRelic("offer")) s.maxHp = Math.max(1, Math.ceil(s.maxHp / 2));
  if(hasRelic("stand") && P.hp < s.maxHp / 2) s.def += STAND_ARMOR;   // 背水
  /* ===== 第十批：高血线 + 连杀线（2026-09-21）=====
     ⚠️ 全部排在这儿 —— 生命上限已经定死（铁躯/献身/铭心都算完了），而护甲还没进重装/硬茧的乘法。
     ⚠️ 高血那几件跟残焰／背水／逆鳞／不死鸟正好相反，两套构筑互斥，这是有意的。*/
  if(hasRelic("vim") && P.hp >= s.maxHp) s.crit += VIM_CRIT;                       // 盛气：满血
  if(hasRelic("whole") && P.hp >= s.maxHp){ s.def += WHOLE_ARMOR; }                // 圆满：满血（伤害那半在 answer）
  if(hasRelic("triplecut") && (P.killStreak || 0) >= TRIPLE_AT) s.atk += TRIPLE_ATK;   // 连斩
  if(hasRelic("slaughter") && (P.killStreak || 0) >= SLAUGH_AT){                   // 屠戮
    s.crit += SLAUGH_CRIT; s.def += SLAUGH_ARMOR;
  }
  /* 第九批：这四件按**别的资源**换护甲，必须排在生命上限定下来之后、重装/硬茧的乘法之前。
     ⚠️ 「恒甲」读 cutStatic()，那个函数**不许回头调 stats()**，否则死循环（见它的注释）。*/
  if(hasRelic("bloodplate")) s.def += Math.min(BPLATE_MAX, Math.floor(s.maxHp / BPLATE_PER));  // 血甲：生命→护甲
  if(hasRelic("glyph") && G) s.def += (G.glyphArmor || 0);                                     // 咒文：这一层拼对攒的
  if(hasRelic("ascend") && G) s.def += (G.stepArmor || 0);                                     // 拾级：这一层升级攒的（每层清零）
  if(hasRelic("twin")) s.def += Math.min(TWIN_MAX, Math.floor((P.shield || 0) / TWIN_PER));    // 双生：护盾→护甲
  if(hasRelic("shieldking")){                                                                   // 盾王：护盾→护甲（＋伤害%）
    s.def += Math.min(SKING_TIERS, Math.floor((P.shield || 0) / SKING_PER));
  }
  if(hasRelic("evervow")) s.def += Math.min(EVERVOW_MAX, Math.floor(cutStatic() / EVERVOW_PER)); // 恒甲：减伤→护甲
  /* 第十一批：两件「会长的底数」—— 护甲的乘法件（重装 / 硬茧 / 叠甲）早就够了，缺的是跟着长的底数。
     放在乘法之前，会被 ×4 ×1.2 放大。*/
  if(hasRelic("silt"))   s.def += SILT_ARMOR + Math.floor((G ? G.floor : 0) / SILT_EVERY);  // 沉积：按层数
  if(hasRelic("layers")) s.def += Math.floor(P.lvl / LAYERS_EVERY);                       // 千层：按等级（×1.25 在下面）
  // 重装：护甲 ×3（平减的护甲在深层等于没有，乘一下才跟得上。练习模式那 +50 不在里面）
  if(hasRelic("heavy")) s.def = (s.def + HEAVY_ARMOR) * HEAVY_MULT;   // 重装：自带底数 + 乘法
  // 硬茧：护甲 +20%（乘法档，跟重装/叠甲排在一起；取整放到最后由 defGear 那一步兜）
  if(hasRelic("callus")) s.def = Math.round((s.def + CALLUS_ARMOR) * CALLUS_MULT);  // 硬茧：同上
  if(hasRelic("layers")) s.def = Math.round(s.def * LAYERS_MULT);                       // 千层：护甲 ×1.25（跟硬茧同一档）
  // 破晓甲：这一层前 DAWN_ASKED 题（G.floorAsked 在 answer() 里累，nextFloor() 里清零）额外给护甲
  if(hasRelic("dawn") && G && (G.floorAsked || 0) < DAWN_ASKED) s.def += DAWN_ARMOR;
  // 叠甲：连续两层都没掉过血（P.noHitStreak 在 nextFloor() 里按上一层的 G.tookDamage 累），护甲 ×2
  if(hasRelic("stack") && (P.noHitStreak || 0) >= 2) s.def *= 2;   // 叠甲的乘法（底数在上面）
  /* 蚀甲：每次挨打（takeHit()）护甲 −1，每答对一题（answer() 的 ok 分支）+1，
     G.corrodeArmor 记的是"现在攒了几点额外护甲"（2026-09-21 修：原来记的是"被磨掉几点"、
     封在 0，所以「每答对 +1」永远只能还回原值，这件史诗从头到尾只有负面）。
     ⚠️ 2026-09 用户把它从「本场」改成**每层**——所以挂在 G 上、`nextFloor()` 里清零，
     一场打完不再自动复原（续玩档存的是刚进这一层的样子，天然是 0）。
     ⚠️ 放在 defGear 快照**之前**——护甲被磨掉的时候，铁壁靠护甲换的伤害也该跟着掉，
     不然"甲都快被磨没了"却还在吃满额的铁壁伤害，逻辑对不上。*/
  if(hasRelic("corrode") && G) s.def += (G.corrodeArmor || 0);
  /* 「铁壁」只认**装备和等级来的**护甲，所以在练习模式那 +50 之前先记一笔。
     ⚠️ 不这么分开的话，练习模式 +50 护甲 = 铁壁 +150% 伤害，
     「纯背词的简单模式」反而成了全游戏输出最高的玩法。*/
  /* 砺石（生命 −5）和血囊（攻击 −4）可能在 1 级把面板压穿，这里兜一下底。*/
  // 镇纸：生命上限→攻击。放在这儿 —— 铁躯/献身/铭心全算完了，按**最终**上限折算
  if(hasRelic("paperweight")) s.atk += Math.min(PAPER_MAX, Math.floor(s.maxHp / PAPER_PER));
  if(hasRelic("bloodtemper")) s.atk += Math.floor(s.maxHp * TEMPER_PCT);   // 淬血（第十一批）：同理按最终上限，不封顶
  /* 无锋（神圣，第十一批）：所有攻击都加完了再 ×1.6，暴击在 answer() 里整个关掉 ——
     拿暴击乘区换一个攻击乘区，伤害公式里还是两个乘区；面板上显示的就是乘完的攻击。
     放在练习 / 难度那一刀之前（那一刀是「这一趟」的设定，不是遗物）。*/
  if(hasRelic("noedge")) s.atk = Math.round(s.atk * NOEDGE_MULT);
  s.atk = Math.max(1, s.atk);
  s.maxHp = Math.max(1, s.maxHp);
  s.defGear = s.def;
  /* 甲刃：护甲→暴击率。跟「铁壁」一个道理，读的是 defGear（装备和等级来的护甲）——
     放在练习模式那 +50 之前，不然「纯背词的简单模式」白得 +18% 暴击。*/
  if(hasRelic("armblade")){
    s.crit += Math.min(ABLADE_MAX, Math.floor((s.defGear || 0) / ABLADE_PER) * ABLADE_STEP);
  }
  /* 练习模式（用户 2026-09）+ 难度等级（用户 2026-09-21）：两样都是进洞之前定的，
     跟着 P 进续玩档。练习是 +50 护甲（挨打那条链最低仍掉 1 点）、攻击减半；
     难度只动攻击（A ×1 / B ×1.25 / C ×1.5 / D ×2）。
     ⚠️ 放在最后：所有遗物和等级都算完了再压这一刀。
     ⚠️ **两个倍率先乘起来、只取整一次** —— 分两步各 round 的话
     D 级（×2）+ 练习（×0.5）会因为中间那次取整漂掉一两点，而用户要的是
     「练习 + D 级正好抵消，等于白拿 50 护甲」，必须严格等于原攻击。*/
  const practice = P.practice && !noShelter();     // 无尽 50 层往下 / 深渊：练习模式整个不算（见 noShelterAt）
  const dmul = diffMult(P.diff) * (practice ? CHAPTER.practiceAtkMult : 1);
  if(practice) s.def += CHAPTER.practiceDef;
  if(dmul !== 1) s.atk = Math.max(1, Math.round(s.atk * dmul));
  /* 守财现在是百分比伤害，不在这儿加攻击了 —— 见 answer() 的百分比层 */
  return s;
}
/* ================= 生成 ================= */
function nextFloor(){
  cancelWalk();
  autoOff();       // 下一层要重新手动开寻路（用户 2026-09），别自己接着冲
  const from = G.floor;
  G.floor = from + 1;
  /* 汗巾／血锤要按「**这一层**回了多少血」给加成 —— 清零放在最前面，
     这样连油灯那一笔进层回血也算进这一层（G.healed 在 healUp() 里累）。*/
  G.healed = 0;
  P.undying = false;
  G.relicDone = false;     // 这一层清完再给一次遗物
  if(P.relics){                                    // 进层结算的普通遗物
    if(hasRelic("lamp")){                                              // 油灯：回最大生命的 5%
      const lm = stats().maxHp;
      healUp(Math.max(1, Math.ceil(lm * CHAPTER.lampPct)));            // 走 healUp，泉涌才收得到溢出
    }
    if(hasRelic("purse")) P.gold += 30;                                // 钱袋
  }
  G.echoUsed = false;      // 「回声」每层一次
  G.reciteFree = 0;        // 「默诵」每层 RECITE_FREE 次
  G.holdUsed = 0;          // 「屏息」每层 HOLD_FREE 次
  G.rerollUsed = 0;        // 遗物候选重掷，每层几次看 rerollBudget()（老档存的 true/false 也能比，JS 会自动转 1/0）
  G.corrodeArmor = 0;      // 「蚀甲」现在攒的是**加**出来的护甲（2026-09-21 修：原来只扣不加），每层重置
  G.openUsed = false;      // 「开场」每层一次
  G.fleeFree = false;      // 「脱壳」每层第一次撤退不掉血
  G.glassCut = 0;          // 「沙漏」这一层被超时削掉了几秒读条
  G.dice = 0;              // 「赌骰」攒了几层暴击率，每层清零（答错也清，见 answer()）
  G.borrowUsed = false;    // 「借甲」每层一次
  G.braceUsed = false;     // 「缓坠」每层第一次跌破半血才触发（原来是整趟一次，太弱了）
  G.burlapUsed = false;    // 「粗布」每层第一次答错（2026-09-21 从「每场一次」改的）
  G.warmthUsed = false;    // 「余温」每层第一次跌破半血触发一次（2026-09-21 加的自带触发源）
  G.openLeft = OPENING_N;  // 「开场」每层前几次答对吃加成（2026-09-21 从「第一次」改成「前 3 次」）
  G.nerveN = 0;            // 「铁胆」这一层保住过几次连击，每层 NERVE_N 次（2026-09-21 加的上限）
  G.reboundUsed = false;   // 「归位」每层一次（2026-09-21 加的上限）
  /* 第十批（2026-09-21）每层的次数上限和本层攒的东西 */
  G.tickN = 0;             // 秒针：这一层速答给过几次护盾
  G.longN = 0;             // 长考：这一层长词给过几次护盾
  G.exorN = 0;             // 驱邪：这一层心魔词回过几次血
  G.calmsN = 0;            // 镇魂：这一层心魔词给过几次护盾
  G.stepArmor = 0;         // 拾级：这一层升级攒的护甲（每层清零）
  G.fastRun = 0;           // 刹那：连着几次速答
  G.instantReady = false;  // 刹那：攒满了，下一刀吃加成
  G.wholeUsed = false;     // 圆满：每层一次的那次拉回
  /* 第十一批（2026-09-25）每层的次数和小数存钱罐 */
  G.deflectN = 0;          // 卸力：这一层减半过几次
  G.gaspUsed = false;      // 一息：每层一次
  G.bwallGot = 0;          // 刃壁：这一层已经转了多少护盾（封在上限的 BWALL_MAX）
  G.bwallBank = 0;         // 刃壁 / 渴刃·血月 / 血河：按小数攒、攒满 1 点给 1 点
  G.sipBank = 0;
  G.riverBank = 0;
  G.catSeen = {};          // 「面熟」这一层各类别的怪遇到过几只，startBattle() 里累
  G.floorAsked = 0;        // 「破晓甲」这一层已经答过几题（不分对错），answer() 里累
  /* 第九批「跨流派组合」每层的次数上限和本层攒的东西（2026-09-21）*/
  G.needleN = 0;           // 粗针：这一层拼对给过几次护盾
  G.ropeN = 0;             // 旧绳：这一层连击给过几次护盾
  G.capN = 0;              // 学徒帽：这一层拼对回过几次血
  G.critShN = 0;           // 暴盾：这一层暴击给过几次护盾
  G.songN = 0;             // 长歌：这一层触发过几次
  G.bladeN = 0;            // 拼刃：这一层开过几扇窗
  G.glyphArmor = 0;        // 咒文：这一层拼对攒的护甲（每层清零）
  G.lastPct = 0;           // 双面：上一刀打出去多少伤害加成
  /* 叠甲：**上一层**干不干净（G.tookDamage 在 takeHit() 里置真）决定这一层还算不算连续 ——
     必须在重置 G.tookDamage 之前先把上一层的成绩并进 P.noHitStreak。
     ⚠️ 第一层（from === 0）没有"上一层"，跳过，免得凭空记一次干净。*/
  if(from > 0){
    if(!G.tookDamage) P.noHitStreak = (P.noHitStreak || 0) + 1;
    else P.noHitStreak = 0;
  }
  G.tookDamage = false;
  /* 循迹：**上一层**打错的题数（G.floorWrong）比再上一层少，这一层开局给护盾 ——
     同理要在清零之前先比较、再把这一层的底数存起来留给下一层比。*/
  if(hasRelic("track")){
    const wrongNow = G.floorWrong || 0;
    if(from > 0 && typeof G.prevFloorWrong === "number" && wrongNow < G.prevFloorWrong){
      P.shield = (P.shield || 0) + TRACK_SHIELD;
      say(T("循迹 —— 这一层打错得比上一层少，多了 <b>") + TRACK_SHIELD + T("</b> 点护盾。"), "good");
    }
    if(from > 0) G.prevFloorWrong = wrongNow;
  }
  G.floorWrong = 0;
  /* 稳步：**上一层**完全没碰互动房间（G.usedRoom 在 onEnter() 里置真）就攒一层连续计数，
     攒够 PACE_STREAK 层就在这一层开局回血，然后从头再攒。
     ⚠️ 2026-09 用户把 PACE_STREAK 改成 1 —— 上一层没用过泉/坛/箱/商，这一层开局就回。*/
  if(hasRelic("pace") && from > 0){
    if(!G.usedRoom) P.roomFreeStreak = (P.roomFreeStreak || 0) + 1;
    else P.roomFreeStreak = 0;
    if(P.roomFreeStreak >= PACE_STREAK){
      P.roomFreeStreak = 0;
      const back = Math.max(1, Math.ceil(stats().maxHp * PACE_PCT));
      healUp(back);
      say(T("稳步 —— 上一层没沾泉／坛／箱／商，回了 <b>") + back + T("</b> 点生命。"), "good");
    }
  }
  G.usedRoom = false;
  /* 惜盾：**上一层**结束时护盾还留着（没见底），这一层开局额外给一批。
     放在盾誓/厚盾**之前**算——用的是上一层带过来的护盾余量，跟这一层刚补的盾誓/厚盾无关。*/
  if(hasRelic("cherish") && from > 0 && (P.shield || 0) > 0){
    const bonus = Math.max(1, Math.ceil(stats().maxHp * CHERISH_PCT));
    P.shield = (P.shield || 0) + bonus;
    say(T("惜盾 —— 护盾没破，多给你 <b>") + bonus + T("</b> 点。"), "good");
  }
  /* 盾誓：每进一层把护盾**补到**上限的 SHIELD_FLOOR_PCT —— 取大值而不是直接赋值，
     免得把「凝盾」辛苦攒下的一大堆盾按回去。*/
  if(hasRelic("vow")){
    const want = Math.max(1, Math.ceil(stats().maxHp * SHIELD_FLOOR_PCT));
    if((P.shield || 0) < want){ P.shield = want; say(T("盾誓在身前合拢 —— 护盾 <b>") + want + T("</b>。"), "good"); }
  }
  if(hasRelic("citywall")){                                                // 城垣（第十一批）：同样取大值
    const want = Math.max(1, Math.ceil(stats().maxHp * CITY_FLOOR));
    if((P.shield || 0) < want){ P.shield = want; say(T("城垣补齐了 —— 护盾 <b>") + want + T("</b>。"), "good"); }
  }
  if(hasRelic("thick")) P.shield = (P.shield || 0) + THICK_SHIELD;   // 厚盾：每层白得一点
  /* 2026-09-21：这五件原来「独立价值恒为 0」——它们要么按护甲算（自己不产护甲），
     要么等着「护盾被打穿」（自己不产护盾），单带时永远触发不了。这一批各补了一条
     **每进一层自带的护盾**当种子。⚠️ 别把种子删掉，删了它们就又回到白板。*/
  if(hasRelic("mirror"))  P.shield = (P.shield || 0) + MIRROR_SHIELD;   // 镜盾
  if(hasRelic("cherish")) P.shield = (P.shield || 0) + CHERISH_SHIELD;  // 惜盾
  if(hasRelic("shatter")) P.shield = (P.shield || 0) + SHATTER_SHIELD;  // 破盾余威
  if(hasRelic("borrow"))  P.shield = (P.shield || 0) + BORROW_SHIELD;   // 借甲
  if(hasRelic("veteran")) P.shield = (P.shield || 0) + VETERAN_SHIELD;  // 久经
  /* 候门（第十批）：**只在进 Boss 层的那一下**给。数字看着大是因为十层才吃一次
     （Boss 层是全游戏容错最低的地方，章末 Boss 只能挨三下出头）。*/
  if(hasRelic("gatewait") && isBossFloor(G.floor)){
    P.shield = (P.shield || 0) + GATE_SHIELD;
    const gh = healUp(Math.max(1, Math.ceil(stats().maxHp * GATE_HEAL)));
    say(T("候门 —— 门后有东西在等你，护盾 <b>") + GATE_SHIELD + "</b>" +
        (gh.hp ? T("，回 <b>") + gh.hp + T("</b> 点生命") : "") + T("。"), "good");
  }
  /* ===== 第九批「跨流派组合」的每层种子（2026-09-21）=====
     ⚠️ **种子别删** —— 这七件的另一半挂在护盾上，没有种子它们在不带护盾流时就是白板
     （跟附录 B2 那 11 件是同一个坑）。*/
  if(hasRelic("shedge"))      P.shield = (P.shield || 0) + SHEDGE_SEED;    // 盾锋
  if(hasRelic("mirroredge"))  P.shield = (P.shield || 0) + MEDGE_SEED;     // 镜锋
  if(hasRelic("shieldheart")) P.shield = (P.shield || 0) + SHEART_SEED;    // 盾心
  if(hasRelic("twin"))        P.shield = (P.shield || 0) + TWIN_SEED;      // 双生
  if(hasRelic("shieldking"))  P.shield = (P.shield || 0) + SKING_SEED;     // 盾王
  if(hasRelic("evervow"))     P.shield = (P.shield || 0) + EVERVOW_SEED;   // 恒甲
  if(hasRelic("confluence"))  P.shield = (P.shield || 0) + CONF_SEED;      // 万流归宗
  // 甲垫：按**护甲**换这一层的护盾（读 defGear，练习模式那 +50 不算数）
  if(hasRelic("armpad")){
    const gain = Math.min(ARMPAD_MAX, Math.max(0, stats().defGear || 0) * ARMPAD_PER);
    if(gain > 0) P.shield = (P.shield || 0) + gain;
  }
  /* 进层回血的三件：放在护盾后面 —— 它们回的血会记进 G.healed，
     「汗巾」「血锤」这一层的加成就是从这几笔起算的。*/
  if(hasRelic("clasp")){                                                   // 铜扣：金币→回血
    const pc = Math.min(CLASP_MAX, Math.floor((P.gold || 0) / CLASP_PER) * CLASP_PCT);
    if(pc > 0) healUp(Math.max(1, Math.ceil(stats().maxHp * pc)));
  }
  if(hasRelic("underarmor")){                                              // 甲下：护甲→回血
    const s9 = stats();
    const pc = Math.min(UNDERARM_MAX, Math.max(0, s9.defGear || 0) * UNDERARM_PCT);
    if(pc > 0) healUp(Math.max(1, Math.ceil(s9.maxHp * pc)), s9);
  }
  if(hasRelic("towel"))     healUp(Math.max(1, Math.ceil(stats().maxHp * TOWEL_SEED)));   // 汗巾的种子
  if(hasRelic("bloodmaul")) healUp(Math.max(1, Math.ceil(stats().maxHp * BMAUL_SEED)));   // 血锤的种子
  /* 泉涌：自带一笔每层回血当「溢出的来源」——它原来只吃别的件漏出来的溢出，单带几乎没用。*/
  if(hasRelic("well")) healUp(Math.max(1, Math.ceil(stats().maxHp * WELL_HEAL_PCT)));
  /* 未雨绸缪（用户 2026-09 提到史诗）：进层时**身上每 foresightPer 金币**回 1% 最大生命，
     不封顶 —— 存着不花的人走得越远回得越多。*/
  if(hasRelic("foresight")){
    const tier = Math.floor((P.gold || 0) / CHAPTER.foresightPer);
    if(tier > 0) healUp(Math.max(1, Math.ceil(stats().maxHp * CHAPTER.foresightPct * tier)));
  }
  /* 走过章末 Boss 那一层 = **这一章通关**（宝石里的「通关」和统计都照记，见 endRun 的 cleared），
     但这一趟不在这儿结束 —— 下面还有一层深渊，里面是打不完的「无终之影」。
     ⚠️ 深渊没有下一层（那只东西不会倒下，阶梯也就永远不会出现），所以 chapterClear()
     这一句现在只是兜底，正常走不到；无尽章更是这两行都走不到。 */
  if(G.floor > floorMax()){
    if(!P.cleared){
      P.cleared = true;
      say(T("章末的门在身后合上 —— <b>第") + chNo() + T("章通关</b>。这一趟的通关已经记下了。"), "crit");
    }
    if(!isAbyssFloor(G.floor)){ chapterClear(); return; }
  }
  if(P.practice && noShelter() && !noShelterAt(from) && !P.tut){
    say(T("从这里往下，<b>练习模式</b>不再生效：没有 +50 护甲，攻击也不再减半。"), "hurt");
  }
  // 联机 · 非房主：地图由房主生成广播，这里只等 world 消息（见 NET.on("world", ...)）。
  // G 上面那些每层清零的字段已经在上面设好了，world 到了之后 applyCoopWorld() 接着往下走
  // （包括最后的 commit —— 这儿 G.map 还是上一层的，先不存档，免得存进去一份错配的层）。
  if(COOP && !coopIsHost()){ coopPendingFloor = true; say(T("等待房主生成这一层的地图…"), "sys"); return; }
  genFloor();
  coopPrepMobs();     // 联机第二期：给每只怪挂上 cid + 两条血条的字段（单人版里是空函数）
  if(COOP) coopBroadcastWorld();
  if(hasRelic("water")) drinkAll();     // 「水」：泉是 genFloor 摆的，所以只能放在它后面
  fov();
  buildGrid();
  render();
  lockInput(320);
  if(P.tut){ tutBegin(); commitPerm(); return; }   // 教程关不写续玩档：半路关掉页面，下次重新走一遍
  sayFloorIntro();
  commit(true);          // 存档点之二：下一层
  const lk = $("btnLockWager"); if(lk) lk.classList.remove("tipmark");   // 「锁定冒险」那一闪只留一层
  if(G.floor === 1) tip("path");                   // 第一趟的提示：寻路
}
/* ===== 联机 · 世界包（第一期）=====
   房主 genFloor() 跑完之后，把这一层「布局共享」的那部分（地图/怪的初始状态/物件/楼梯/出生点）
   打包广播；非房主收到后原样铺场。**不带 P**（各自的角色状态是自己的），
   也不带 seen（地牢一直全亮，applyCoopWorld 里现叫一次 fov() 就够）。
   格式跟 writeRun() 的打包方式是同一路子（packRow 就是那边定义的）。*/
function packWorld(){
  return {
    ch: CH.id,
    map: G.map.map(function(r){ return packRow(r, function(v){ return v ? 1 : 0; }); }).join("|"),
    stair: G.stair, rooms: G.rooms || null,
    px: P.x, py: P.y,
    mobs: G.mobs.map(function(m){
      return {d:m.def.id, x:m.x, y:m.y, hp:m.hp, max:m.max, dmg:m.dmg, armor:m.armor, xp:m.xp, lt:m.loot || 0};
    }),
    things: G.things
  };
}
function coopBroadcastWorld(){
  if(!COOP || !window.NET) return;
  NET.send({t:"world", floor: G.floor, pack: packWorld()});
}
/* 非房主收到世界包：照着铺场，剩下的（fov/建格子/渲染/日志/存档）
   跟 nextFloor() 原来那条尾巴一样，只是不用再跑一遍 genFloor()。*/
function applyCoopWorld(msg){
  const pack = msg.pack;
  if(!pack) return;
  if(!P || !G || G.over || SCENE !== "run"){
    // 队友重连 / 刚打开页面就赶上房主正在进行的一趟：这里现建一份新的 P/G（照抄 newRun() 那一份）
    setChapter(pack.ch);
    P = { x:0, y:0, lvl:1, xp:0, hp:CHAPTER.playerBase.hp, gold:0, kills:0,
          right:0, wrong:0, seenWords:[], used:{}, combo:0, maxCombo:0,
          relics:[], haunt:[], hauntAt:{}, undying:false,
          spent:0, chew:false, charge:0,
          shield:0, aegisN:0, recoil:0, revived:false, down:false,
          practice: !!practiceOn, diff: diffId(), accF:{} };
    G = { floor:0, paused:false, over:false };
    comboShown = null; resetHpFx(); autoOff();
    SCENE = "run"; showScene();
    $("log").innerHTML = "";
    hideAll();
    say(T("石门在身后合上。走廊里只有火把的回声。"), "sys");
  }
  setChapter(pack.ch);
  G.floor = msg.floor;
  G.map = pack.map.split("|").map(function(row){ return row.split("").map(function(c){ return c === "1" ? 1 : 0; }); });
  G.seen = []; G.vis = [];
  for(let y=0;y<H;y++){ G.seen.push(new Array(W).fill(false)); G.vis.push(new Array(W).fill(false)); }
  G.stair = pack.stair; G.rooms = pack.rooms || null; G.things = pack.things || []; G.mobs = [];
  (pack.mobs || []).forEach(function(m){
    const def = foeDef(m.d);
    if(!def) return;
    const boss = !!def.boss;
    G.mobs.push({x:m.x, y:m.y, def:def, g:def.g, name:def.name, art:def.art,
                 cat:def.cat, boss:boss, weak: boss ? pick(chapterPos()) : def.cat, weakPos:boss,
                 hp:m.hp, max:m.max, dmg:m.dmg, armor:m.armor, xp:m.xp, loot:m.lt || 0, seen:false});
  });
  coopPrepMobs();     // 联机第二期：非房主这边也要给每只怪挂上 cid + 两条血条的字段
  P.x = pack.px; P.y = pack.py;
  coopPendingFloor = false;
  if(hasRelic("water")) drinkAll();
  fov();
  buildGrid();
  render();
  lockInput(320);
  sayFloorIntro();
  commit(true);
}
/* ===== 房间图 =====
   地图切成 SLOT_C × SLOT_R 个槽位，每个槽位 SLOT_W × SLOT_H 格（4×4 个 8×6 的槽，加一圈边墙 = 33×25）。
   随机挑两个槽位 A、B，用曼哈顿最短路径（随机决定先横后竖还是先竖后横）把它们串成一条**链**，
   链上经过的槽位就是要开的房间：不足 4 间就从已选槽位的四邻里随机挑空槽补，超过 6 间就重选 A、B。
   **只有网格上相邻的两间房才连通**，走廊是两间房边缘之间的一小段 —— 不会再有横穿半张地图的中心连线。
   没被选中的槽位就是实心墙，render() 里连画都不画，玩家看不出地图其实大了一圈。 */
var SLOT_W = 8, SLOT_H = 6, SLOT_C = 4, SLOT_R = 4, ROOM_MIN = 4, ROOM_MAX = 6;
function slotChain(){
  for(let a=0;a<400;a++){
    const s = {c:ri(0,SLOT_C-1), r:ri(0,SLOT_R-1)}, e = {c:ri(0,SLOT_C-1), r:ri(0,SLOT_R-1)};
    if(1 + Math.abs(s.c-e.c) + Math.abs(s.r-e.r) > ROOM_MAX) continue;   // 链太长，重选两点
    const chain = [{c:s.c, r:s.r}];
    let c = s.c, r = s.r;
    const goC = function(){ while(c !== e.c){ c += e.c > c ? 1 : -1; chain.push({c:c, r:r}); } };
    const goR = function(){ while(r !== e.r){ r += e.r > r ? 1 : -1; chain.push({c:c, r:r}); } };
    if(Math.random() < .5){ goC(); goR(); } else { goR(); goC(); }
    if(chain.length >= 2) return chain;                                  // 两点撞一块了，重选
  }
  return [{c:0,r:0},{c:1,r:0}];      // 兜底，正常走不到
}
/* 每 BOSS_EVERY 层就是一层 Boss 房（第 10/20/30/40/50 层）。顶栏那层写成 `10*`，血色。
   **深渊那一层（第 51 层）也算一层 Boss 房**：它同样是「一间屋子 + 一只东西」，
   所以 genFloor 的分岔、顶栏的血色、「候门」「叩关」那两件按 Boss 层给的遗物全都照走。 */
function isBossFloor(f){ return f > 0 && (f % BOSS_EVERY === 0 || isAbyssFloor(f)); }
/* 进一层之后那两行日志（nextFloor 和联机的 applyCoopWorld 共用同一份文案）。*/
function sayFloorIntro(){
  const last = G.floor === floorMax();
  const bossRoom = isBossFloor(G.floor);
  const abyss = inAbyss();
  say("—— " + CH.name + T(" 第 ") + G.floor + T(" 层") + (abyss ? T(" · 深渊") : bossRoom ? " · BOSS" : "") + " ——", "crit");
  say(abyss ? T("门在身后合上，这一层没有阶梯。<b>无终之影</b>站在屋子中间 —— 它的血没有底，打穿一层还有一层。想把这一趟的宝石带走，撤退之后「放弃」就行。")
     : last ? T("空气冷得发硬。这一层尽头有东西在等。")
     : bossRoom ? (T("门在身后落下。一间屋子，一只 ") + G.mobs[0].name + T("。"))
     : (T("这一层有 ") + G.mobs.length + T(" 只敌人。清干净才能下去。")), (last || bossRoom || abyss) ? "hurt" : "sys");
}
/* ===== Boss 房 =====
   下了楼梯只有**一间屋子**，屋里**只有一只 Boss** —— 没有别的怪，也没有金币/泉/箱/坛/商。
   人在屋子一头，Boss 在另一头。阶梯照旧在它倒下的地方裂开（closeBattleWin 那一套不动）。
   ⚠️ 房间图那一套（slotChain / links / take）整段跳过，这里是手写的一间屋。 */
function genBossRoom(){
  const map = [], seen = [], vis = [];
  for(let y=0;y<H;y++){
    map.push(new Array(W).fill(0));
    seen.push(new Array(W).fill(false));
    vis.push(new Array(W).fill(false));
  }
  /* 屋子按取景框（9×13）挑的：**一进来就该看见那只东西**，不是进来再满屋子找。
     人在门这一侧，Boss 在屋子正中，隔三格 —— 取景框里两个都在。*/
  const w = Math.min(9, W - 4), h = Math.min(7, H - 4);
  const x0 = Math.floor((W - w) / 2), y0 = Math.floor((H - h) / 2);
  for(let j=y0;j<y0+h;j++) for(let i=x0;i<x0+w;i++) map[j][i] = 1;
  G.map = map; G.seen = seen; G.vis = vis; G.mobs = []; G.things = [];
  G.rooms = [{x:x0, y:y0, w:w, h:h}];
  const my = y0 + (h >> 1);
  P.x = x0 + 1; P.y = my;
  const bx = x0 + (w >> 1), by = my;
  G.stair = {x:bx, y:by};          // 清空前只是个占位，Boss 倒下的地方才是真阶梯
  // 深渊（第 51 层）里是血量无限的「无终之影」，它自己一套数值（makeAbyssFoe，不吃下面那几个倍率）
  if(isAbyssFloor(G.floor)){ G.mobs.push(makeAbyssFoe(ABYSS, bx, by)); return; }
  // 无尽章没有章末 Boss（CH.boss 是 null），每一间 Boss 房里都是跟着层数长的「层间守者」
  const def = (G.floor === floorMax() && CH.boss) ? CH.boss : GATEKEEPER;
  G.mobs.push(makeBossFoe(def, bx, by));
}
function genFloor(){
  if(P.tut){ genTutorialFloor(); return; }
  if(isBossFloor(G.floor)){ genBossRoom(); return; }
  const map = [], seen = [], vis = [];
  for(let y=0;y<H;y++){
    map.push(new Array(W).fill(0));
    seen.push(new Array(W).fill(false));
    vis.push(new Array(W).fill(false));
  }
  /* 槽位：链 + 补出来的邻居。links 记下哪两间要开走廊（只连相邻的） */
  const chain = slotChain(), slots = chain.slice(), links = [], used = {};
  const skey = function(c,r){ return r*SLOT_C + c; };
  slots.forEach(function(s){ used[skey(s.c,s.r)] = true; });
  for(let i=1;i<chain.length;i++) links.push([i-1, i]);
  const D4 = [[1,0],[-1,0],[0,1],[0,-1]];
  for(let a=0; slots.length < ROOM_MIN && a < 200; a++){
    const from = ri(0, slots.length-1), s = slots[from], opts = [];
    for(let i=0;i<4;i++){
      const c = s.c + D4[i][0], r = s.r + D4[i][1];
      if(c<0 || r<0 || c>=SLOT_C || r>=SLOT_R || used[skey(c,r)]) continue;
      opts.push({c:c, r:r});
    }
    if(!opts.length) continue;
    const n = pick(opts);
    used[skey(n.c,n.r)] = true;
    slots.push(n);
    links.push([from, slots.length-1]);
  }
  /* 每个槽位里摆一间房，尺寸照旧，在槽位内随机偏移；再夹一下保证留住外面那圈边墙 */
  const rooms = slots.map(function(s){
    const w = ri(4,7), h = ri(3,5), x0 = s.c * SLOT_W, y0 = s.r * SLOT_H;
    const x = ri(Math.max(1, x0), Math.min(x0 + SLOT_W - w, W - 1 - w));
    const y = ri(Math.max(1, y0), Math.min(y0 + SLOT_H - h, H - 1 - h));
    return {x:x, y:y, w:w, h:h, cx:x+(w>>1), cy:y+(h>>1), c:s.c, r:s.r};
  });
  rooms.forEach(function(r){
    for(let j=r.y;j<r.y+r.h;j++) for(let i=r.x;i<r.x+r.w;i++) map[j][i] = 1;
  });
  function carveH(y, x1, x2){ for(let x=Math.min(x1,x2); x<=Math.max(x1,x2); x++) map[y][x] = 1; }
  function carveV(x, y1, y2){ for(let y=Math.min(y1,y2); y<=Math.max(y1,y2); y++) map[y][x] = 1; }
  /* 两间相邻房之间的短通道：投影对得上就是直的一条，错开了就在中间的空档里拐一下（Z 形）。
     两头都锚在房间边缘上，整条通道只待在这两个槽位里，碰不到第三间房。*/
  links.forEach(function(lk){
    const a = rooms[lk[0]], b = rooms[lk[1]];
    if(a.r === b.r){                                   // 左右相邻
      const L = a.x < b.x ? a : b, R = a.x < b.x ? b : a;
      const xa = L.x + L.w - 1, xb = R.x;
      const lo = Math.max(L.y, R.y), hi = Math.min(L.y+L.h-1, R.y+R.h-1);
      if(lo <= hi){ carveH(ri(lo, hi), xa, xb); return; }
      const ya = ri(L.y, L.y+L.h-1), yb = ri(R.y, R.y+R.h-1);
      const xm = xb - xa >= 2 ? ri(xa+1, xb-1) : xb;
      carveH(ya, xa, xm); carveV(xm, ya, yb); carveH(yb, xm, xb);
    } else {                                           // 上下相邻
      const U = a.y < b.y ? a : b, D = a.y < b.y ? b : a;
      const ya = U.y + U.h - 1, yb = D.y;
      const lo = Math.max(U.x, D.x), hi = Math.min(U.x+U.w-1, D.x+D.w-1);
      if(lo <= hi){ carveV(ri(lo, hi), ya, yb); return; }
      const xa = ri(U.x, U.x+U.w-1), xb = ri(D.x, D.x+D.w-1);
      const ym = yb - ya >= 2 ? ri(ya+1, yb-1) : yb;
      carveV(xa, ya, ym); carveH(ym, xa, xb); carveV(xb, ym, yb);
    }
  });

  G.map = map; G.seen = seen; G.vis = vis; G.mobs = []; G.things = [];
  // 房间的矩形留一份在 G 上：自动寻路要「先扫完当前这间屋子」（跟着续玩档存，老档没有就退回全图最近）
  G.rooms = rooms.map(function(r){ return {x:r.x, y:r.y, w:r.w, h:r.h}; });
  // 人在链的一端，阶梯的占位在另一端（清空后阶梯会改写到最后一只怪倒下的地方）
  P.x = rooms[0].cx; P.y = rooms[0].cy;
  const tail = rooms[chain.length - 1];
  G.stair = {x:tail.cx, y:tail.cy};

  /* ===== 能放东西的格子 =====
     怪、泉、箱、坛、商、金币都从这里取位置。规矩：**别堵路**。
     走廊只有一格宽，任何东西站上去都把路卡死；房间的门口那一格同理。
     房间内部随便放 —— 绕得开。
     分三档，前一档取空了才用后一档（极端小地图的兜底，正常一层用不到）：
       spots = 房间内部、且不挨着走廊   doors = 房间的门口那一圈   rest = 走廊 */
  const inRoom = [];
  for(let y=0;y<H;y++) inRoom.push(new Array(W).fill(false));
  rooms.forEach(function(r){
    for(let j=r.y;j<r.y+r.h;j++) for(let i=r.x;i<r.x+r.w;i++) inRoom[j][i] = true;
  });
  function floorAt(x, y){ return x>=0 && y>=0 && x<W && y<H && map[y][x] === 1; }
  function isCorridor(x, y){ return floorAt(x, y) && !inRoom[y][x]; }
  function nextToCorridor(x, y){
    return isCorridor(x-1,y) || isCorridor(x+1,y) || isCorridor(x,y-1) || isCorridor(x,y+1);
  }

  const spots = [], doors = [], rest = [];
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    if(map[y][x] !== 1) continue;
    if(x === P.x && y === P.y) continue;
    if(x === G.stair.x && y === G.stair.y) continue;
    if(Math.abs(x-P.x) + Math.abs(y-P.y) <= 4) continue;      // 开局脚边不放东西
    if(!inRoom[y][x]) rest.push({x:x, y:y});
    else if(nextToCorridor(x, y)) doors.push({x:x, y:y});
    else spots.push({x:x, y:y});
  }
  /* 连通性守卫：怪和物件全都当成墙。一层现在站着十来只怪，光挑「房间内部」已经不够 ——
     四只怪在 4 宽的屋里排成一行就把屋子切两半了。每放一个先试着把它当墙做一次 flood fill，
     剩下的地板必须仍然从脚下连成一片，不成就换个位置。（改生成逻辑后的回归也是这一条。）*/
  const blocked = [];
  for(let y=0;y<H;y++) blocked.push(new Array(W).fill(false));
  function freeLeft(){
    let n = 0;
    for(let y=0;y<H;y++) for(let x=0;x<W;x++) if(map[y][x] === 1 && !blocked[y][x]) n++;
    return n;
  }
  function reachFrom(sx, sy){
    const hit = [];
    for(let y=0;y<H;y++) hit.push(new Array(W).fill(false));
    const q = [{x:sx, y:sy}];
    hit[sy][sx] = true;
    let n = 1, head = 0;
    while(head < q.length){
      const c = q[head++];
      for(let i=0;i<4;i++){
        const nx = c.x + D4[i][0], ny = c.y + D4[i][1];
        if(nx<0 || ny<0 || nx>=W || ny>=H) continue;
        if(map[ny][nx] !== 1 || blocked[ny][nx] || hit[ny][nx]) continue;
        hit[ny][nx] = true; n++; q.push({x:nx, y:ny});
      }
    }
    return n;
  }
  function take(){
    const tiers = [spots, doors, rest];
    for(let t=0;t<tiers.length;t++){
      const src = tiers[t];
      while(src.length){
        const sp = src.splice(Math.floor(Math.random()*src.length),1)[0];
        blocked[sp.y][sp.x] = true;
        if(reachFrom(P.x, P.y) === freeLeft()) return sp;
        blocked[sp.y][sp.x] = false;      // 这一格会把路切断，丢掉换一个
      }
    }
    return null;
  }

  /* Boss（章末）和守层者都搬进 Boss 房了（isBossFloor 那一层单独生成），
     所以到这儿的一定是普通层，怪数不用再给它们让位。 */
  const pool = FOES.filter(function(f){ return f.from <= G.floor; });
  const mp = CHAPTER.mobsPerFloor;
  const n = (typeof mp === "number" ? mp : ri(mp.min, mp.max));
  for(let i=0;i<n;i++){
    const sp = take(); if(!sp) break;
    G.mobs.push(makeFoe(pick(pool), sp.x, sp.y));
  }
  // 金币堆 7~10 堆，「掘金」再多 3 堆
  for(let i=0, k=ri(7,10) + (hasRelic("dig") ? 3 : 0); i<k; i++){
    const sp = take(); if(!sp) break;
    // 用户 2026-09：地上的金币减少 60%（CHAPTER.goldMult），最少留 1 枚
    let amt = Math.max(1, Math.round((ri(2,6) + G.floor) * CHAPTER.goldMult));
    if(hasRelic("alms") && luck(ALMS_RATE)) amt *= 2;    // 施粥：这一堆直接翻倍
    G.things.push({x:sp.x, y:sp.y, kind:"gold", amt: amt});
  }
  const springs = G.floor >= 3 ? 2 : 1;
  for(let i=0;i<springs;i++){
    if(Math.random() > (i === 0 ? 0.85 : 0.45)) continue;
    const sp = take(); if(sp) G.things.push({x:sp.x, y:sp.y, kind:"feat", what:"泉"});
  }
  // 三种房间，各自独立掷骰；都不是必出，免得每层长一个样
  if(Math.random() < 0.45){ const sp = take(); if(sp) G.things.push({x:sp.x, y:sp.y, kind:"chest"}); }
  // 祭坛 ALTAR_FROM 层之后才出（用户 2026-09）；有一成概率长成「熔炉」，在 openAltar 里定
  if(G.floor >= ALTAR_FROM && Math.random() < 0.30){ const sp = take(); if(sp) G.things.push({x:sp.x, y:sp.y, kind:"altar"}); }
  if(G.floor >= 2 && Math.random() < 0.35){ const sp = take(); if(sp) G.things.push({x:sp.x, y:sp.y, kind:"shop"}); }
}
/* 这一层落在哪一段（content.js 的 FOE_BANDS）。只有会成长的怪吃这个倍率 */
function foeBand(floor){
  for(let i=0;i<FOE_BANDS.length;i++) if(floor <= FOE_BANDS[i].to) return FOE_BANDS[i];
  return {hp:1, dmg:1};
}
/* 无尽章的**深渊压迫**（用户 2026-09）：第 ENDLESS_FROM 层往下每 ENDLESS_EVERY 层
   再给怪的**伤害**加一档 ENDLESS_RAMP。别的章恒为 1，等于这一条不存在。
   ⚠️ **只压伤害，不压血量**（算过才这么定的）：两样都压时第 200 层一只怪要砍 50 刀 ——
   那不是难，那是熬。只压伤害的话普通怪稳定在 4~5 刀，难的是「错不起」。
   详细算式和实测表写在 content.js 的 ENDLESS_RAMP 那一段。*/
function endlessRamp(floor){
  if(!isEndless() || floor <= ENDLESS_FROM) return 1;
  return 1 + Math.floor((floor - ENDLESS_FROM) / ENDLESS_EVERY) * ENDLESS_RAMP;
}
/* 石胎 / 钝痛的封顶线在无尽深处跟着「一半」的深渊压迫往上抬（用户 2026-09-25 选的方案 B）：
   第 50 层 ×1（12%）、第 200 层 ×1.75（21%）、第 300 层 ×2.25（27%）。别的章恒为 1。*/
function capRamp(){
  return G ? 1 + (endlessRamp(G.floor) - 1) * CAP_RAMP_SHARE : 1;
}
/* 这一刀真的打进怪血条的量（吸血那几件按它算）：普通怪按剩下的血封顶，深渊那只血是一层层的，打多少算多少 */
function landedOn(m, n){
  if(!(n > 0)) return 0;
  if(m.def && m.def.abyss) return n;
  return Math.max(0, Math.min(n, m.hp));
}
/* 一只怪在第 floor 层的数值：基础 + 层数成长 + 章节 foeBonus，**最后**再乘一次分段倍率。
   抽出来是因为 Boss 房要「参照上一层的小怪」现算一遍（refFoe）。 */
function foeNums(def, floor){
  const gw = CHAPTER.grow;
  // def.fixed = 章末 Boss，数值写死不随层数长、也不吃分段倍率；别的（含守层者）都要长
  const step = def.fixed ? 0 : Math.max(0, floor - 1);
  const fb = (def.fixed ? null : CH.foeBonus) || {hp:0, dmg:0, armor:0, xp:0};
  const band = def.fixed ? {hp:1, dmg:1} : foeBand(floor);
  // 无尽章第 50 层往下的深渊压迫（别的章恒为 1）。**只乘在伤害上**，血量不动 —— 见 endlessRamp
  const deep = def.fixed ? 1 : endlessRamp(floor);
  /* 怪物全局倍率（content.js 的 FOE_MULT，用户 2026-09-21）——**所有怪都吃，章末 Boss 也吃**。
     放在最后一步乘，取整、最低 1，跟 FOE_BANDS / endlessRamp 一个待遇。
     armor / xp 那两档默认是 1（为什么见 content.js 那段注释）。*/
  return {
    hp:  Math.max(1, Math.round((def.hp  + step * gw.hpPerFloor + fb.hp) * band.hp * FOE_MULT.hp)),
    dmg: Math.max(1, Math.round((def.dmg + Math.floor(step / gw.dmgEvery) + fb.dmg) * band.dmg * deep * FOE_MULT.dmg)),
    armor: Math.round((def.armor + fb.armor) * FOE_MULT.armor),
    xp: Math.round((def.xp + Math.floor(step / gw.xpEvery) + fb.xp) * FOE_MULT.xp)
  };
}
/* 第 floor 层「一只普通小怪」的平均数值 —— Boss 房就是照着上一层的这个数放大的 */
function refFoe(floor){
  const f = Math.max(1, floor);
  let list = FOES.filter(function(d){ return d.from <= f; });
  if(!list.length) list = [FOES[0]];
  let hp = 0, dmg = 0, xp = 0;
  list.forEach(function(d){ const n = foeNums(d, f); hp += n.hp; dmg += n.dmg; xp += n.xp; });
  return {hp: hp / list.length, dmg: dmg / list.length, xp: xp / list.length};
}
function makeFoe(def, x, y){
  // 成长曲线在 CHAPTER.grow 里，全是整数加法（分段倍率在 foeNums 末尾乘一次）。
  // 守层者也要涨（不然第 40 层的门跟第 10 层一样弱），只有章末 Boss 固定。
  // step 按**绝对层数**算，不是“距离首次出现几层”。
  // 否则第 38 层登场的怪在第 40 层只长了 2 层，一出场就是纸糊。
  // def.from 只决定**什么时候出现**，def.hp 决定它在同层怪里的相对硬度。
  const n = foeNums(def, G.floor);
  // 弱点：**普通怪按类别**（就是它自己那一类），**Boss 按词性**随机（用户 2026-09 改的，
  // 逼你换着词性背）。weakPos 标明这一只的 weak 是词性还是类别 —— showWeak / answer 都看它。
  // ⚠️ 只能从**这一章真的有词**的词性/类别里挑 —— 挑到没词的等于白给一个弱点
  const boss = !!def.boss;
  const weak = boss ? pick(chapterPos()) : def.cat;
  return { x:x, y:y, def:def, g:def.g, name:def.name, art:def.art, cat:def.cat, boss:boss,
           weak:weak, weakPos:boss,
           hp:n.hp, max:n.hp, dmg:n.dmg, armor:n.armor, xp:n.xp, loot:0, seen:false };
}
/* Boss 房里那一只：**参照上一层的小怪**，血量 ×BOSS_HP_X、伤害 ×BOSS_DMG_X。
   一整层就它一只，所以经验和金币要顶掉一层十来只的量（见 content.js 的注释）。
   章末 Boss（fixed）只借这间屋子的布局，数值还是它自己那一套。 */
function makeBossFoe(def, x, y){
  const m = makeFoe(def, x, y);
  if(!def.fixed){
    const ref = refFoe(G.floor - 1);
    m.hp = m.max = Math.max(1, Math.round(ref.hp * BOSS_HP_X));
    m.dmg = Math.max(1, Math.round(ref.dmg * BOSS_DMG_X));
    m.xp = Math.max(1, Math.round(ref.xp * BOSS_XP_X));
  }
  m.loot = Math.round((ri(2,5) + G.floor) * BOSS_GOLD_X);
  return m;
}
/* 深渊那一只：**血量无限**，按「层」算 —— 第 1 层 1 点，每往下一层 ×ABYSS_X，
   攻击 = 这一层血量的 ABYSS_DMG_PCT。立绘借**这一章章末 Boss 的**（它是那一章的影子），
   所以这一批一张新图都没加。
   ⚠️ 它不吃 Boss 房那几个倍率（BOSS_HP_X 之类），也不吃层数成长 —— 血和攻击只看层数。
   ⚠️ 经验和金币都是 0：它不会倒下，closeBattleWin() 这辈子也走不到。 */
function makeAbyssFoe(def, x, y){
  const m = makeFoe(def, x, y);
  m.art = (CH.boss && CH.boss.art) || def.art;
  m.layer = 1;
  m.max = m.hp = abyssHp(1);
  m.dmg = abyssDmg(1);
  m.armor = 0; m.xp = 0; m.loot = 0;
  return m;
}
/* 打在无终之影身上的每一刀：**打光当前这一层，剩下的原样穿到下一层**
   （用户要的「一次打很多层」）。血量是翻倍的，所以再大的一刀也只能穿有限层，这个循环一定会停。
   ⚠️ 打穿的层数记在 **P.abyss** 上（跟着续玩档），结算时按层给宝石（SCORE.perAbyss）。
   ⚠️ 血条永远不会归零 —— 所以 answer() 里那条「m.hp <= 0 就结束战斗」的分支在深渊里走不到。*/
function abyssAbsorb(m, n){
  let left = n, broke = 0;
  while(left >= m.hp){
    left -= m.hp;
    broke++;
    m.layer = (m.layer || 1) + 1;
    m.max = m.hp = abyssHp(m.layer);
    m.dmg = abyssDmg(m.layer);
  }
  m.hp -= left;
  if(broke){
    P.abyss = (P.abyss || 0) + broke;
    say(T("无终之影碎了 <b>") + broke + T("</b> 层（累计 ") + P.abyss + T(" 层）—— 底下那层 <b>") +
        m.max + T("</b> 血，一口 <b>") + m.dmg + T("</b> 点。"), "crit");
  }
  return broke;
}

/* ================= 日志 ================= */
function say(t, cls){
  const box = $("log"), p = document.createElement("p");
  if(cls) p.className = cls;
  p.innerHTML = t;
  box.appendChild(p);
  while(box.children.length > 60) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
}

/* ================= 视野 ================= */
/* **地牢里没有光源这回事**（用户 2026-09）：取景框里的一切都是亮的 ——
   墙、地板、怪、物件，走到哪看到哪，不再有「黑下去的雾」和「走出视野淡一档」。
   看得见多少由**镜头**决定（CHAPTER.view / viewMax，9×13 起步），不由半径决定。
   所以 G.vis / G.seen 现在恒为 true：两张表留着是因为
   render()、findPath()、续玩档都按它们写的，抹掉要动一片地方，没必要。
   ⚠️ 别再把「半径 R + 视线遮挡（los）」那一套加回来，是用户明确不要的。 */
function fov(){
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ G.vis[y][x] = true; G.seen[y][x] = true; }
  G.mobs.forEach(function(m){ m.seen = true; });
}

/* ================= 渲染 ================= */
/* **墙只画贴着地板的那一圈**（用户 2026-09：「墙体只要一格」）——
   地图是「16 个槽位里挑 4~6 个放房间」生成的，槽位之间是成片的实心墙；
   地牢全亮之后那一大片糊在一起很难看。所以这里只画**八邻里有地板的墙格**，
   再往里的实心墙画成 `.c.void`（跟取景框同色的底，看不见），
   每间房、每条走廊就都只剩一格厚的墙。
   ⚠️ 这只是**画法**，G.map 一点没动：寻路、生成、续玩档看的还是原来那张图。
   ⚠️ 八邻（带斜角）不能改成四邻 —— 房间的四个角会漏出一个缺口。 */
function wallEdge(x, y){
  for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){
    const nx = x + dx, ny = y + dy;
    if(nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    if(G.map[ny][nx] === 1) return true;
  }
  return false;
}

function buildGrid(){
  const m = $("map");
  m.innerHTML = "";
  m.style.gridTemplateColumns = "repeat(" + W + ", var(--cell))";
  cells = [];
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const c = document.createElement("div");
    c.className = "c"; c.dataset.x = x; c.dataset.y = y;
    m.appendChild(c); cells.push(c);
  }
  sizeMap();
}
/* 取景窗实际显示多少格。CHAPTER.view 是**基准**（也是下限），
   真机上补到多少由 sizeMap() 按屏幕算，上限是 CHAPTER.viewMax。*/
var VIEW = { w: CHAPTER.view.w, h: CHAPTER.view.h };

function sizeMap(){
  const st = document.querySelector(".stage");
  const view = $("viewAdv");
  if(!st || !view || !view.clientWidth) return;   // 视图藏着的时候量不到，直接跳过
  const BW = CHAPTER.view.w, BH = CHAPTER.view.h;          // 基准视野
  const MW = (CHAPTER.viewMax && CHAPTER.viewMax.w) || BW; // 补格子的上限
  const MH = (CHAPTER.viewMax && CHAPTER.viewMax.h) || BH;

  /* 横向：stage 现在是固定尺寸的，再量它自己就循环依赖了，所以量父容器。
     窄屏下 stage 有负 margin（出血到整宽），减负数等于加宽。*/
  const ms = getComputedStyle(st);
  const ml = parseFloat(ms.marginLeft) || 0, mr = parseFloat(ms.marginRight) || 0;
  const availW = view.clientWidth - ml - mr - 2;

  /* 纵向预算：冒险页总高 − 同级可见部件 − 间隙 − 日志最低高。
     状态行和血条现在是压在地图上的浮层（.mapui），不是 viewAdv 的同级部件，
     所以它们不再吃这份预算 —— 这是「地图变大」的主要来源。*/
  let used = 0, shown = 0;
  Array.prototype.forEach.call(view.children, function(el){
    if(el.offsetHeight === 0 && el !== st) return;   // 藏起来的不占位，也不占 gap
    shown++;
    if(el !== st && el.id !== "log") used += el.offsetHeight;
  });
  /* LOG_MIN 必须和 style.css 里 .log 的 min-height 一致 ——
     JS 算小了 CSS 却撑着，stage 就会被 flex 挤扁（rect 高度对不上 style 高度）。*/
  const gaps = Math.max(0, shown - 1) * 10, LOG_MIN = 62;
  const availH = view.clientHeight - used - gaps - LOG_MIN;

  /* 格子多大**只看基准视野**，跟以前一条规矩：视野调小 = 格子变大。*/
  const cell = Math.max(14, Math.min(46, Math.min(
    Math.floor((availW - 2) / BW), Math.floor((availH - 2) / BH))));

  /* 格子定死之后，剩下的边角再补几行几列 —— 补格子**不会让格子变小**，
     只是把原本空着的地方填上。手机是高瘦屏、9:13 的窗更瘦，空的永远是左右两条。
     只加不减（不低于基准），且不超过 viewMax 和整张地图。*/
  VIEW.w = Math.max(BW, Math.min(MW, W, Math.floor((availW - 2) / cell)));
  VIEW.h = Math.max(BH, Math.min(MH, H, Math.floor((availH - 2) / cell)));

  $("map").style.setProperty("--cell", cell + "px");
  st.style.width  = (VIEW.w * cell + 2) + "px";     // +2 是边框（全局 border-box）
  st.style.height = (VIEW.h * cell + 2) + "px";
  camera();
}
/* 镜头：把玩家尽量放在取景窗中间，贴边时停住（不露白） */
function camera(){
  if(!P || !G || !G.map) return;
  const m = $("map");
  const cell = parseFloat(getComputedStyle(m).getPropertyValue("--cell")) || 20;
  const VW = VIEW.w, VH = VIEW.h;
  /* 人永远在取景窗正中：**不夹边界**。
     以前这里把 cx/cy 夹在 [0, 地图-视野] 里，走到地图上下/左右边缘时镜头就顶住不动了，
     人会跑到画面边上。现在宁可让取景窗露出地图外的空白，也要保证视角始终居中。 */
  const cx = P.x - ((VW - 1) >> 1), cy = P.y - ((VH - 1) >> 1);
  m.style.transform = "translate(" + (-cx * cell) + "px," + (-cy * cell) + "px)";
}
function mobAt(x,y){
  for(let i=0;i<G.mobs.length;i++) if(G.mobs[i].x===x && G.mobs[i].y===y) return G.mobs[i];
  return null;
}
function thingAt(x,y){
  for(let i=0;i<G.things.length;i++) if(G.things[i].x===x && G.things[i].y===y) return G.things[i];
  return null;
}
function render(){
  const cleared = G.mobs.length === 0;
  const tutAt = (P && P.tut) ? tutTarget() : null;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const c = cells[y*W + x];
    const isGoal = G.goal && G.goal.x === x && G.goal.y === y;
    if(!G.seen[y][x]){ c.textContent = ""; c.className = "c dark"; continue; }
    const visible = G.vis[y][x];
    const isWall = G.map[y][x] === 0;
    // 离地板两格以上的实心墙不画，露出取景框的底（见上面 wallEdge）
    if(isWall && !wallEdge(x, y)){ c.textContent = ""; c.className = "c void"; continue; }
    const base = isWall ? "wall" : "floor";
    let glyph = "";              // 地图上已经没有字符了；留着是给没配图的怪兜底
    let content = isWall ? "" : "dot";   // 空地板上那个点是 CSS 画的（.c.dot::before），不占内容
    let art = null;              // 这一格画 SVG 时，放要画的那张
    /* 阶梯只在这一层清空之后才画。清空前地图上根本没有 ▼ ——
       它会在最后一只怪倒下的那一格出现（见 closeBattleWin）。
       G.stair 在清空前只是个占位，别让它以「上锁的楼梯」露脸。 */
    if(!isWall && cleared && x === G.stair.x && y === G.stair.y){
      content = "stair"; art = STAIR;
    }
    const th = thingAt(x,y);
    if(th){
      if(th.kind === "gold"){ content = "gold"; art = COIN; }
      else if(th.kind === "feat"){ content = "feat"; art = SPRING; }
      else if(th.kind === "altar"){ content = "altar"; art = ALTAR; }
      else if(th.kind === "gild"){ content = "altar gild"; art = ALTAR; }   // 金坛：同一张图，染成金色
      else if(th.kind === "chest"){ content = "chest"; art = CHEST; }
      else if(th.kind === "shop"){ content = "shop"; art = SHOP; }
    }
    const mo = mobAt(x,y);
    if(mo && (visible || mo.seen)){
      // 再挂一个 m-<id>，给需要单独上色的怪用（现在只有三四章的两个 Boss，
      // 别的怪没写规则就照旧吃 .c.mob / .c.mob.boss 那两条）
      const mid = mo.def && mo.def.id;
      content = "mob" + (mo.boss ? " boss" : "") + (mid ? " m-" + mid : "");
      // 没画图的怪退回原来那个汉字，加新怪忘了配图也不会开天窗
      art = MOB_ART[mid] || null;
      glyph = art ? "" : mo.g;
    }
    if(x === P.x && y === P.y){
      c.innerHTML = HERO;
      c.className = "c floor you walkable" + (isGoal ? " goal" : "");
      continue;
    }
    // 地图上的东西全是画出来的。glyph 只在某只怪没配图时才派上用场
    if(art) c.innerHTML = art; else c.textContent = glyph;
    c.className = "c " + base + " " + content + (visible ? "" : " mem") +
                  (isWall ? "" : " walkable") + (isGoal ? " goal" : "");
    if(tutAt && tutAt.x === x && tutAt.y === y) c.classList.add("tutmark");   // 新手教程：这一步要点的那一格
  }
  // 联机：队友棋子（逻辑不占格子，纯视觉叠一层在队友最后上报的位置上，见 coopMateX/Y）
  if(COOP && coopMateX != null && coopMateY != null &&
     coopMateX >= 0 && coopMateY >= 0 && coopMateX < W && coopMateY < H){
    const mc = cells[coopMateY * W + coopMateX];
    if(mc){
      const mark = document.createElement("div");
      mark.className = "matepawn";
      mark.innerHTML = HERO;
      mc.appendChild(mark);
    }
  }
  camera();
  renderHud();
}
function renderHud(){
  const s = stats();
  if(P.hp > s.maxHp) P.hp = s.maxHp;
  if(SCENE !== "run"){          // 主城里没有层数、没有怪，只刷属性/背包那几块
    renderSheets(s);
    return;
  }
  // Boss 房那一层在顶栏写成 `10*`，并且是血色的（用户 2026-09）
  const bossFloor = isBossFloor(G.floor);
  // 无尽章和深渊的分母都是「∞」：都没有「最后一层」（见 floorMax / abyssFloor）
  $("hFloor").textContent = G.floor + (bossFloor ? "*" : "") + "/" + ((isEndless() || inAbyss()) ? "∞" : FLOORS);
  $("hFloor").classList.toggle("bossfloor", bossFloor);
  $("hLevel").textContent = P.lvl;
  $("hGold").textContent = P.gold;
  const left = G.mobs.length;
  $("hLeft").textContent = left === 0 ? T("已清") : left;
  $("hLeft").parentNode.className = "hi " + (left === 0 ? "done" : "left");
  paintHp($("hpBar"), $("hpFill"), $("hpTxt"), P.hp, s.maxHp, $("hpShield"));
  const need = xpNeed(P.lvl);
  $("xpFill").style.width = Math.min(100, P.xp / need * 100) + "%";

  renderSheets(s);
}
/* 联机：队友状态条（血/连击/遗物数），数据来自 coopMateInfo（NET.on("mate",...) 里更新的）。
   index.html 里没有 #mateRow，$() 拿到 null 就直接跳过 —— 单人版调不到这个函数。*/
function renderMate(){
  const row = $("mateRow");
  if(!row) return;
  if(!COOP || !coopMateInfo){ row.hidden = true; return; }
  row.hidden = false;
  $("mateName").textContent = coopMateInfo.name || T("队友");
  $("mateHp").textContent = coopMateInfo.down ? T("倒地")
    : (coopMateInfo.hp != null) ? (coopMateInfo.hp + "/" + coopMateInfo.maxHp) : "—";
  $("mateCombo").textContent = "×" + (coopMateInfo.combo || 0);
  $("mateRelics").textContent = coopMateInfo.relics || 0;
}
/* 联机：定时把自己的状态广播出去，给队友状态条 + 房主的「队友忙不忙」判断用。
   500ms 一次，够用，也不至于把连接刷满。*/
function coopSendMe(){
  if(!COOP || !window.NET || SCENE !== "run" || !P || !G) return;
  const s = stats();
  NET.send({t:"me", name: coopMyName || T("队友"), hp: Math.max(0, P.hp), maxHp: s.maxHp,
            combo: P.combo || 0, relics: (P.relics || []).length,
            busy: !!G.paused, clear: G.mobs ? G.mobs.length === 0 : true,
            down: !!P.down,
            x: P.x, y: P.y});
}
/* 联机：踩到泉/坛/箱/商时通知队友一声（纯通知，不改队友自己的世界 —— 消耗是各自独立的，
   见联机方案.md「布局共享，消耗独立」）。日志显示在 NET.on("used", ...) 里。*/
function coopNoteUsed(what){
  if(!COOP || !window.NET) return;
  NET.send({t:"used", what: what, x: P.x, y: P.y});
}
/* 稳步看的就是这个：这一层碰没碰过泉/坛/箱/商（不管用没用，走到格子上弹了窗就算"碰过"）。
   nextFloor() 里按上一层的这个值累计连续干净了几层，再清零给下一层用。*/
function noteRoomUsed(){ G.usedRoom = true; }
function coopStartTicker(){
  if(coopStatusTimer) return;
  coopStatusTimer = setInterval(coopSendMe, 500);
}
function st(k,v){ return "<span class=\"s\">" + k + "<b>" + v + "</b></span>"; }
/* 血条：低于 35% 变深红，低于 15% 再加搏动。地牢和战斗界面共用一套 */
/* 回血/掉血的动效基准存在血条自己的 data-hp 上（两条血条各记各的）。
   换一趟、读档、回主城都要清一次，不然进门就会白播一下。*/
function resetHpFx(){
  ["hpBar", "bHpBar"].forEach(function(id){
    const el = $(id);
    if(el){ delete el.dataset.hp; el.classList.remove("hurt", "heal"); }
  });
}
function paintHp(bar, fill, txt, hp, max, sh){
  const v = Math.max(0, hp), r = max > 0 ? v / max : 0;
  const shield = Math.max(0, (P && P.shield) || 0);
  fill.style.width = (r * 100) + "%";
  // 护盾：条子上压一段冷色 + 文字后面缀一个数。没有盾就什么都不显示
  if(sh) sh.style.width = (shield > 0 && max > 0 ? Math.min(100, shield / max * 100) : 0) + "%";
  txt.innerHTML = v + " / " + max +
    (shield > 0 ? T(" <span class=\"shn\">盾 ") + shield + "</span>" : "");
  if(bar){
    /* ⚠️ className 是整块重写的，动效那个类必须**写在它后面**再挂上去 */
    const prev = bar.dataset.hp === undefined ? null : +bar.dataset.hp;
    bar.className = "hpbar" + (r <= 0.15 ? " low crit" : r <= 0.35 ? " low" : "");
    bar.dataset.hp = v;
    if(prev !== null && prev !== v && !REDUCE_MOTION){
      const cls = v > prev ? "heal" : "hurt";
      void bar.offsetWidth;                      // 强制回流，连着掉两下也能再播一遍
      bar.classList.add(cls);
      setTimeout(function(){ bar.classList.remove(cls); }, HP_FX_MS);
    }
  }
}
/* 联机第二期：战斗窗里队友那条血条（半透明，纯显示）用这个，**不走 paintHp()**——
   paintHp() 里的护盾数字读的是全局的 P.shield（我自己的盾），直接拿去画队友那条会把
   我自己的盾数顶在队友的血量上。这个函数只画血量，没有护盾、没有掉血/回血的闪光动效。*/
function paintMateHp(fill, txt, hp, max){
  const v = Math.max(0, hp), m = Math.max(1, max || 1);
  fill.style.width = (Math.max(0, v / m) * 100) + "%";
  txt.textContent = v + " / " + max;
}
function renderSheets(s){
  /* 「属性」（用户 2026-09-25 要补全）：伤害公式里每一桶都摆出来。
     数字全走 answer() / mitigate() 用的同一套函数（pctSteady / flatSteady / extraSteady / critSteady / cutState），
     只算**常驻**的那部分 —— 拼对、打中弱点、冒险、答得快这种「这一刀才有」的不算。
     减伤按「答错挨一口」算（绝大多数挨打都是它），封在 MIT_CUT_MAX。 */
  const pct = pctSteady(s), cc = critSteady(s, pct);
  const noCrit = hasRelic("noedge");
  const pm = function(v, u){ return (v < 0 ? "−" + (-v) : "+" + v) + (u || ""); };
  $("stats").innerHTML =
    st(T("攻击"), s.atk) + st(T("伤害加成"), pm(pct, "%")) +
    st(T("额外伤害"), pm(extraSteady(s))) + st(T("点伤"), pm(flatSteady())) +
    st(T("暴击率"), noCrit ? "—" : hasRelic("fate") ? "100%" : Math.round(cc.rate) + "%") +
    st(T("暴击伤害"), noCrit ? "—" : "×" + (Math.round(cc.mult * 100) / 100)) +
    st(T("生命"), Math.max(0, P.hp) + " / " + s.maxHp) + st(T("护甲"), s.def) +
    st(T("护盾"), P.shield || 0) + st(T("受到的伤害"), "−" + Math.min(MIT_CUT_MAX, cutState(s, true)) + "%") +
    st(T("连击"), P.combo || 0) + st(T("拼写题"), Math.round(spellChance() * 100) + "%");
  // 老存档里可能还留着已经删掉的词（比如整类删掉的虚词），统计时过一遍 WMAP
  const keys = Object.keys(LEX).filter(function(k){ return !!lexWord(k); });
  let mastered = 0;
  keys.forEach(function(k){ if((LEX[k].str || 0) >= 3) mastered++; });
  /* 四项各占一格：掌握过的 / 遇见过的 / 词库一共多少 / **累计学词**。
     累计学词 = 熟练度表里所有词被问过的总次数（LEX[k].seen 之和），
     跨存档一直累加，是这块面板从「本章词汇」改叫「词汇记录」之后加的那一项（用户 2026-09）。*/
  let studied = 0;
  keys.forEach(function(k){ studied += (LEX[k].seen || 0); });
  /* 今日：已学 = 今天答过的不同的词（只数正在学的这门语言），正确率 = 今天全部答题 */
  const today = todayRec(), tn = today.r + today.w;
  let todayWords = 0;
  for(const k in today.ws) if(lexWord(k)) todayWords++;
  $("vocab").innerHTML = st(T("今日已学"), todayWords + T(" 词")) +
                         st(T("今日正确率"), tn ? Math.round(today.r / tn * 100) + "%" : "—") +
                         st(T("已掌握"), mastered) + st(T("已遇见"), keys.length) +
                         st(T("总数"), WORDS.length) + st(T("累计学词"), studied + T(" 次"));
  /* 「本局战绩」只在洞里才有意义 —— 没进冒险整块藏起来（用户 2026-09）*/
  const inRun = (SCENE === "run" && G && !G.over);
  $("panelRun").hidden = !inRun;
  $("panelStats").hidden = !inRun;      // 「属性」也一样：镇上没有这一趟，面板上全是 1 级的底子，没意义（用户 2026-09-25）
  const acc = (P.right + P.wrong) ? Math.round(P.right / (P.right + P.wrong) * 100) + "%" : "—";
  $("runStats").innerHTML = st(T("答对"), P.right) + st(T("答错"), P.wrong) +
    st(T("正确率"), acc) + st(T("击杀"), P.kills) +
    st(T("等级"), "Lv." + P.lvl) + st(T("经验"), P.xp + " / " + xpNeed(P.lvl));
  renderRelics();
  renderMate();
}

/* ================= 移动与寻路 ================= */
let walkPath = null, walkTimer = null;

function cancelWalk(){
  walkPath = null;
  if(G) G.goal = null;
  if(walkTimer){ clearTimeout(walkTimer); walkTimer = null; }
}
/* 自动寻路会绕开的东西：泉 / 坛 / 箱 / 商 / **楼梯** —— 踩上去就弹窗，是「互动」不是「路过」。
   金币不算，路过顺手捡了正好。点它们本身当然还是走得过去（终点不受这条限制）。
   ⚠️ 楼梯不在 G.things 里（它是 G.stair），所以单开一条分支；而且只有**清空之后**它才存在，
   清空之前那一格只是个看不见的占位，踩上去什么都不会发生，没必要绕。*/
function isStop(x, y){
  if(G.stair && G.mobs.length === 0 && x === G.stair.x && y === G.stair.y) return true;
  const th = thingAt(x, y);
  return !!(th && th.kind !== "gold");
}
/* loose = true 时不绕，用来兜底：万一互动物件真把唯一的路堵死了，还能走过去
   blind = true 时不管有没有探索过 —— 给取景框上那个「寻路」按钮用的，它会把人领进没走过的走廊 */
function findPath(tx, ty, loose, blind){
  if(tx === P.x && ty === P.y) return null;
  if((!blind && !G.seen[ty][tx]) || G.map[ty][tx] === 0) return null;
  const key = function(x,y){ return y*W + x; };
  const prev = {}, done = {};
  done[key(P.x,P.y)] = true;
  const q = [{x:P.x, y:P.y}];
  let head = 0, found = false;
  const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
  while(head < q.length){
    const c = q[head++];
    if(c.x === tx && c.y === ty){ found = true; break; }
    for(let i=0;i<4;i++){
      const nx = c.x + DIRS[i][0], ny = c.y + DIRS[i][1];
      if(nx<0 || ny<0 || nx>=W || ny>=H) continue;
      if((!blind && !G.seen[ny][nx]) || G.map[ny][nx] === 0) continue;
      const k = key(nx,ny);
      if(done[k]) continue;
      if(!(nx === tx && ny === ty)){
        if(mobAt(nx,ny)) continue;                              // 怪物挡路
        if(!loose && isStop(nx,ny)) continue;                   // 泉/坛/箱/商：绕开，别顺路踩进去
      }
      done[k] = true;
      prev[k] = c;
      q.push({x:nx, y:ny});
    }
  }
  if(!found && !done[key(tx,ty)]) return null;
  const path = [];
  let cx = tx, cy = ty, guard = 0;
  while(!(cx === P.x && cy === P.y)){
    path.unshift({x:cx, y:cy});
    const p = prev[key(cx,cy)];
    if(!p || guard++ > W*H) return null;
    cx = p.x; cy = p.y;
  }
  return path.length ? path : null;
}
/* 返回「有没有找到路」—— 自动寻路靠这个判断要不要继续（**别改成看 walkPath**：
   目标就在脚边时 stepWalk 会同步开战并把 walkPath 清掉，看它等于白走一趟就停）。*/
function goTo(tx, ty, blind){
  if(G.paused || G.over) return false;
  // 先按「绕开互动物件」找一条；真绕不过去（被堵死）再退回不绕的老办法
  const path = findPath(tx, ty, false, blind) || findPath(tx, ty, true, blind);
  if(!path){
    if(G.seen[ty][tx] && G.map[ty][tx] === 1) say(T("那边过不去 —— 有东西挡着路。"), "sys");
    return false;
  }
  cancelWalk();
  walkPath = path;
  // 联机 · 清怪没完时房主的路要广播给队友、两人走同一条（见 net 的 "path" 处理）；
  // 怪清完之后每人自己决定去哪找自己的金币，不该再把这条路塞给队友（coopLocked() 已经是 false）
  if(COOP && coopIsHost() && coopLocked() && window.NET) NET.send({t:"path", steps: path.map(function(p){ return {x:p.x, y:p.y}; })});
  G.goal = {x:tx, y:ty};
  render();
  stepWalk();
  return true;
}
/* ===== 取景框左下角的「寻路」 =====
   一层现在有十来只怪、七八堆金币，地图也大了一圈，来回找剩下那一只很烦。
   优先级：**还有怪 → 最近的怪；没怪了 → 最近的金币；金币也没了 → 楼梯**。
   泉/箱/坛/商一概不去 —— 它们是玩家自己决定要不要进的（跟自动寻路绕开它们是同一条规矩）。
   找「最近」按真实脚程算（BFS 的步数），不是直线距离；而且**不管探没探索过**，
   不然刚进一层雾还没开，按了等于没按。*/
function nearestBy(list){
  let best = null, bl = Infinity;
  for(let i=0;i<list.length;i++){
    const t = list[i];
    const p = findPath(t.x, t.y, false, true) || findPath(t.x, t.y, true, true);
    if(p && p.length < bl){ bl = p.length; best = t; }
  }
  return best;
}
/* 脚下这一格属于哪间屋子（G.rooms 是 genFloor 存下来的矩形；老续玩档没有就返回 null）*/
function roomOf(x, y){
  const rs = G && G.rooms;
  if(!rs) return null;
  for(let i=0;i<rs.length;i++){
    const r = rs[i];
    if(x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r;
  }
  return null;
}
function inRoom(r, t){ return !!r && t.x >= r.x && t.x < r.x + r.w && t.y >= r.y && t.y < r.y + r.h; }
/* 目标是**怪和金币一起比，谁近去谁**（用户 2026-09 改的，以前是「先把怪清完再捡钱」）——
   顺路的一堆金币不该等你横穿半张地图回来捡。
   ⚠️ **先把当前这间屋子扫干净**（用户 2026-09）：脚下这间屋里还有怪或金币，就只在屋里挑最近的；
   屋里空了才去下一间（还是按脚程挑全图最近的）。老续玩档没存 G.rooms，自然退回原来的全图最近。
   两样都没有了才去楼梯；泉/箱/坛/商一概不去，要不要进那些是玩家自己决定的。 */
function autoPath(){
  if(!P || !G || !G.map || G.paused || G.over || SCENE !== "run") return false;
  /* 联机 · 怪没清完时寻路只认怪，别被顺路的金币岔开走岔路（联机方案.md：移动锁只锁怪）——
     金币各自生成各自捡，共享路线要是也去够金币，两人捡到的份数很可能对不上。
     怪清完（或者压根不是联机）就跟原来一样，怪和金币一起比谁近。*/
  const goals = coopLocked() ? G.mobs.slice()
    : G.mobs.concat(G.things.filter(function(th){ return th.kind === "gold"; }));
  const here = roomOf(P.x, P.y);
  let t = null;
  if(here){
    const mine = goals.filter(function(g){ return inRoom(here, g); });
    if(mine.length) t = nearestBy(mine);
  }
  if(!t) t = nearestBy(goals);
  if(!t && G.mobs.length === 0 && G.stair) t = G.stair;
  if(!t || (t.x === P.x && t.y === P.y)) return false;
  return goTo(t.x, t.y, true);
}
/* 「寻路」是**开关**，不是点一下走一段（用户 2026-09 要求）：
   开着就一路走下去 —— 怪和金币按脚程就近挑，清完层走到楼梯边停住。
   ⚠️ **下一层要重新手动开**（用户 2026-09）：`nextFloor()` 里 `autoOff()`，
   新一层的怪在哪都还不知道，别让它自己就冲出去了。
   实现上就是一个 160ms 的轮询：弹层开着（战斗 / 三选一 / 下楼确认 / 商店）就等着，
   还在走就不打扰，停下来了就挑下一个目标。**没目标可去时自己关掉**。
   ⚠️ 下楼照旧要确认 —— 走到楼梯上会弹 `askStair()`，它不会替玩家按「下去」；
   玩家自己按了下去，新的一层它会接着走。
   玩家一动手（方向键 / 点地图 / 放弃）就自动关，手动操作永远优先。 */
var autoOn = false, autoTimer = null;
function autoWake(ms){
  if(autoTimer) clearTimeout(autoTimer);
  autoTimer = setTimeout(autoTick, ms || 160);
}
function autoTick(){
  autoTimer = null;
  if(!autoOn) return;
  if(!P || !G || !G.map || G.over || SCENE !== "run"){ autoOff(); return; }
  /* 联机：怪没清完（coopLocked()）才是"共享路线"那一套——只有房主真的算路，
     队友不自己跑，全靠 "path" 消息（见 coopMateResume）。怪一清完，锁就解了，
     谁按了寻路就自己算自己的路，两人各按各的节奏，不用再等对方（联机方案.md）。*/
  if(coopLocked() && !coopIsHost()) return;
  // 联机 · 还锁着的时候：队友还在忙（战斗/弹层）就先别算下一步，免得把他落在原地
  if(coopLocked() && coopMateBusy){ autoWake(300); return; }
  if(G.paused){ autoWake(400); return; }                  // 弹层开着，等它关
  if(walkPath && walkPath.length){ autoWake(160); return; }   // 还在走，别插手
  if(!autoPath()){
    if(coopLocked() && window.NET){ coopMoveWant = false; NET.send({t:"ready", what:"move", on:false}); }
    autoOff();
    return;                   // 没地方可去了，自己关掉
  }
  autoWake(200);
}
function autoOff(){
  if(autoTimer){ clearTimeout(autoTimer); autoTimer = null; }
  if(!autoOn) return;
  autoOn = false;
  const b = $("btnPathfind");
  if(b){ b.classList.remove("on"); b.setAttribute("aria-pressed", "false"); }
}
function autoToggle(){
  if(autoOn){ autoOff(); cancelWalk(); render(); return; }
  if(!P || !G || !G.map || G.over || SCENE !== "run") return;
  autoOn = true;
  const b = $("btnPathfind");
  if(b){ b.classList.add("on"); b.setAttribute("aria-pressed", "true"); }
  autoTick();
}
function stepWalk(){
  walkTimer = null;
  // 联机第二期：倒地的人原地不动（怪也不再打他）——路已经广播给队友了，这边只是不亲自走
  if(COOP && P && P.down){ cancelWalk(); return; }
  if(!walkPath || !walkPath.length || G.paused || G.over){ cancelWalk(); render(); return; }
  const n = walkPath.shift();
  const m = mobAt(n.x, n.y);
  if(m){ cancelWalk(); render(); startBattle(m); return; }
  if(G.map[n.y][n.x] === 0){ cancelWalk(); render(); return; }
  P.x = n.x; P.y = n.y;
  const floorBefore = G.floor;
  onEnter();
  if(G.over){ cancelWalk(); return; }
  if(G.paused || G.floor !== floorBefore){ cancelWalk(); if(!G.paused){ fov(); render(); } return; }
  fov();
  if(!walkPath.length){ cancelWalk(); }
  render();
  if(walkPath && walkPath.length) walkTimer = setTimeout(stepWalk, CHAPTER.stepMs);
}
function tryMove(dx, dy, rep){
  if(G.paused || G.over) return;
  if(COOP && P && P.down) return;    // 倒地的人不能自己动，等队友清完层原地复活
  if(coopLocked()){ coopNoteLocked(); return; }    // 怪没清完，双方都不能自己动（联机方案.md）
  if(!gate(!!rep)) return;
  autoOff();        // 手动走一步 = 关掉自动寻路，手动操作永远优先
  cancelWalk();
  const nx = P.x + dx, ny = P.y + dy;
  if(nx<0 || ny<0 || nx>=W || ny>=H) return;
  if(G.map[ny][nx] === 0) return;
  const m = mobAt(nx, ny);
  if(m){ startBattle(m); return; }
  P.x = nx; P.y = ny;
  const floorBefore = G.floor;
  onEnter();
  if(!G.paused && !G.over && G.floor === floorBefore){ fov(); render(); }
}
function onEnter(){
  const th = thingAt(P.x, P.y);
  if(th){
    if(th.kind === "gold"){
      let amt = th.amt;
      if(hasRelic("greed")) amt = Math.round(amt * 1.2);                    // 拾荒者 +20%
      if(hasRelic("rust")) amt = Math.round(amt * 1.1);                     // 铜锈 +10%
      P.gold += amt;
      say(T("你拾起 <b>") + amt + T("</b> 金币。"), "sys");
      if(P.tut) tutEvent("gold");
      G.things.splice(G.things.indexOf(th),1);
      fxGold(P.x, P.y);                     // 碎屑飞向顶上的「金」
    } else if(th.kind === "feat"){ noteRoomUsed(); coopNoteUsed(T("泉")); openSpring(th); return; }
    else if(th.kind === "altar"){ noteRoomUsed(); coopNoteUsed(T("坛")); openAltar(th); return; }
    else if(th.kind === "gild"){ openGild(th); return; }
    else if(th.kind === "chest"){ noteRoomUsed(); coopNoteUsed(T("箱")); openChest(th); return; }
    else if(th.kind === "shop"){ noteRoomUsed(); coopNoteUsed(T("商")); openShop(th); return; }
  }
  // 清空之后阶梯才存在，踩上去才问。清空前那一格看着就是普通地面，别弹莫名其妙的提示。
  if(G.mobs.length === 0 && P.x === G.stair.x && P.y === G.stair.y){
    fov(); render();
    askStair();
  }
}
/* 踩上阶梯不再直接掉下去 —— 先问一句。
   选「再待一会儿」就留在阶梯上，想走的时候**再点一下脚下那格 ▼** 就是这个窗。 */
function askStair(){
  if(!G || G.over || G.mobs.length > 0) return;
  if(P.tut){ tutFinish(false); return; }          // 教程关：踩上阶梯就是走完了
  G.paused = true;
  const last = G.floor === floorMax();
  const to = G.floor + 1;
  $("stairEyebrow").textContent = CH.name + T(" 第 ") + G.floor + T(" 层 · 已清空");
  $("stairTitle").textContent = last ? T("最后一道石门") : T("阶梯通向第 ") + to + T(" 层");
  /* 第 50 层这一下现在通向**深渊**（用户 2026-09-22）：下去就算通关（宝石照给），
     但下面那只东西打不完，只能走到倒下 —— 这句必须写清楚，不然玩家会以为自己亏了一次通关。*/
  $("stairNote").innerHTML = last
    ? T("下去就算<b>通关</b>，宝石照给。<br>再往下是<b>深渊</b>：里面那只东西血量没有底，打穿一层还有一层，没有阶梯也没有下一层 —— 走到倒下为止。")
    : (isBossFloor(to) ? T("下面是一间屋子，里面<b>只有一只 BOSS</b>。") : "") +
      T("下去之后<b>这一层不会再回来</b>。进下一层时会存一次档。");
  hideAll();
  $("veilStair").hidden = false;
  $("btnStairGo").disabled = false;
  $("btnStairGo").textContent = T("下去 ▼");
  $("btnStairGo").focus();
}
/* 「再待一会儿」之后自己从阶梯上退开一格（用户 2026-09）——
   站在阶梯上再走一步就又弹一次窗，很烦。**先往下退，下面是墙就往上**，
   上下都不行才左右兜一下；四个方向都走不了（阶梯在死胡同尽头）就留在原地。
   ⚠️ 只落到**空地板**上：有怪会开打、有泉/坛/箱/商会弹窗 —— 刚说了「再待一会儿」，
   不该顺手把人推进另一个弹层里。金币也跳过，省得白捡一笔说不清。*/
function stepOffStair(){ return stepAside(); }
/* 从脚下这一格退开一步，落到四邻里第一块**空地板**上（阶梯、游商共用）。
   游商（用户 2026-09-25）：关掉商店之后人不再站在商人头上，同样的规矩退开一格。
   清空之后的阶梯那一格也跳过 —— 从商人身上退到阶梯上等于又被问一次「下不下去」。*/
function stepAside(){
  const dirs = [[0,1], [0,-1], [-1,0], [1,0]];   // 下 → 上 → 左 → 右
  for(let i=0;i<dirs.length;i++){
    const nx = P.x + dirs[i][0], ny = P.y + dirs[i][1];
    if(nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    if(!G.map[ny][nx]) continue;                 // 墙
    if(mobAt(nx, ny)) continue;
    if(thingAt(nx, ny)) continue;
    if(G.mobs.length === 0 && G.stair && nx === G.stair.x && ny === G.stair.y) continue;
    P.x = nx; P.y = ny;
    fov();
    return true;
  }
  return false;
}
function closeStair(go){
  $("veilStair").hidden = true;
  G.paused = false;
  if(go){ nextFloor(); return; }
  /* 退开一格之后要是自动寻路还开着，它下一拍又会把人领回阶梯上、再弹一次窗。
     玩家刚说了「再待一会儿」，这儿顺手关掉它。*/
  autoOff();
  const moved = stepOffStair();
  say(moved ? T("你从阶梯上退开一步。想走的时候，再点一下那个 ▼。")
            : T("你在阶梯口停住了。想走的时候，再点一下脚下那格。"), "sys");
  lockInput(200);
  render();
}

/* ================= 战斗 ================= */
function startBattle(m){
  /* 连击（P.combo）不在这儿清零 —— 它跟着人走，打完一只接着下一只还算数。
     只有答错、倒下、回主城才断。赌骰攒的暴击率挂在 G.dice 上，每层清零。 */
  B = {mob:m, q:null, locked:false, asked:0,
       wager:false, optCount:4,
       wrongTimes:0, shatterUsed:false, shatterFree:false, deflectUsed:false};
  /* 城垣（第十一批）：每场开始护盾至少补到上限的 CITY_FIGHT（取大值，手里更多就不动）*/
  if(hasRelic("citywall")){
    const w = Math.max(1, Math.ceil(stats().maxHp * CITY_FIGHT));
    if((P.shield || 0) < w) P.shield = w;
  }
  /* 面熟：这一层同一类别的怪，每次真的撞上（不是路过）就记一次，nextFloor() 里清零。
     老对手：这一趟同名 Boss/层间守者第几次遇到，P 上跟着续玩档，不清零（整趟累计）。*/
  if(m.cat){
    if(!G.catSeen) G.catSeen = {};
    G.catSeen[m.cat] = (G.catSeen[m.cat] || 0) + 1;
  }
  if(m.boss && m.def){
    if(!P.bossSeen) P.bossSeen = {};
    P.bossSeen[m.def.id] = (P.bossSeen[m.def.id] || 0) + 1;
  }
  clearQTimer();          // 上一场要是被别的路子掐断了，读条可能还挂着
  G.paused = true;
  $("foeArt").className = "portrait" + (m.boss ? " boss" : "");
  $("foeArt").innerHTML = ART[m.art];
  $("meArt").innerHTML = HERO;
  $("foeName").textContent = m.name;
  $("foeTag").textContent = (m.def && m.def.abyss) ? T("深渊 · 血量无限，打穿一层还有一层")
                          : m.boss ? T("章节首领 · 全部词类") : (T("遭遇 · ") + CAT_CN[m.cat] + T("类词"));
  showWeak(m);
  $("btnFlee").hidden = COOP;    // 联机里没有撤退（联机方案.md）
  $("veilBattle").hidden = false;
  say(T("你撞上了 ") + m.name + T("。"), "hurt");
  if(P.combo > 0) say(T("上一场的连击 <b>×") + P.combo + T("</b> 还留着 —— 别断。"), "crit");
  renderBattleBars();
  if(P.tut) tutEvent("battle");
  nextQuestion();
  if(!P.tut) tip("risk", "veilBattle");
}
/* Boss 的弱点是**词性**（POS_CN），普通怪的弱点是**类别**（CAT_CN）—— 看 m.weakPos */
function showWeak(m){
  const el = $("foeWeak");
  const cn = m.weak && (m.weakPos ? POS_CN[m.weak] : CAT_CN[m.weak]);
  if(!cn){ el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = T("弱点 · <b>") + cn + T("</b>类词伤害更高");
}
function renderBattleBars(){
  const m = B.mob, s = stats();
  const abyss = !!(m.def && m.def.abyss);
  /* 无终之影的血条画的是**当前这一层**（血量无限，画不出总条），第几层写在名字后面。*/
  if(abyss) $("foeName").textContent = m.name + T(" · 第 ") + (m.layer || 1) + T(" 层");
  $("foeFill").style.width = Math.max(0, m.hp / m.max * 100) + "%";
  $("foeTxt").textContent = Math.max(0, m.hp) + " / " + m.max;
  /* 联机第二期：怪有两条独立满血，这条画在怪血条下面，显示队友那边剩多少（半透明 50%，
     纯显示，权威值来自服务器的 hp 广播）。index.html 没有 #foeMateBar，$() 拿到 null
     就跳过 —— 单人版一步都跑不到这儿。*/
  const mateBar = $("foeMateBar");
  if(mateBar){
    if(COOP && m.hpMate != null && !abyss){
      mateBar.hidden = false;
      const mv = Math.max(0, m.hpMate);
      $("foeMateFill").style.width = (m.max > 0 ? mv / m.max * 100 : 0) + "%";
      $("foeMateTxt").textContent = T("队友 ") + mv + " / " + m.max;
    } else mateBar.hidden = true;
  }
  paintHp($("bHpBar"), $("bHpFill"), $("bHpTxt"), P.hp, s.maxHp, $("bHpShield"));
  /* 联机：自己血条上方再画一条队友的（半透明 50%），数据来自队友最后一次上报的
     心跳（coopMateInfo，跟顶栏那条「队友状态条」#mateRow 是同一份数据，见 NET.on("mate")）。
     index.html 没有 #bMateHpBar，$() 拿到 null 就跳过。*/
  const mateHpBar = $("bMateHpBar");
  if(mateHpBar){
    if(COOP && coopMateInfo && typeof coopMateInfo.hp === "number"){
      mateHpBar.hidden = false;
      paintMateHp($("bMateHpFill"), $("bMateHpTxt"),
        coopMateInfo.down ? 0 : coopMateInfo.hp, coopMateInfo.maxHp || coopMateInfo.hp || 1);
    } else mateHpBar.hidden = true;
  }
  renderCombo();
}
/* ---- 连击：每 comboStep 次 +comboPct%，可叠加不封顶（火星把 step 减 1）---- */
/* 断链的门槛和代价（2026-09-21 用户改）：**都是「当前层数」** ——
   连击 ≥ 这个数才挡得下一次答错，挡完连击就减掉这么多。
   ⚠️ 原来的固定门槛 `UNCHAIN_AT`/`UNCHAIN_CUT`(各 10) 已经删了，别找。
   ⚠️ 主城里没有 G，兜一个 1（那时候也用不到）。*/
function unchainAt(){ return Math.max(1, (G && G.floor) || 1); }
function comboStep(){ return Math.max(1, CHAPTER.comboStep - (hasRelic("spark") ? SPARK_STEP : 0)); }
/* 现在这一串连击给多少百分比。**它进 answer() 的 pct 桶，不是独立乘区。** */
function comboPct(combo){
  const c = combo == null ? ((P && P.combo) || 0) : combo;
  return Math.floor(c / comboStep()) * CHAPTER.comboPct;
}
/* 连击那一条（用户 2026-09 从战斗窗底下挪到**怪物血条下面**）。
   玩家一眼要看见三件事：连了几次、现在加了百分之几、再对几个进下一档。
   ⚠️ 三段都常驻（数字变、行数不变），答题前后窗高才不会跳。
   ⚠️ 涨了就放大回弹（.up），掉了就缩一下、淡一下（.down）——
      纯装饰，系统开了「减少动态效果」就整段跳过。
   comboShown 记着上一次画出来的数，靠它判断是涨是掉；
   开新一趟时要清成 null（newRun 里），否则新局第一场会白播一次「掉了」。*/
let comboShown = null;
function renderCombo(){
  const c = $("combo");
  if(!c) return;
  const n = (P && P.combo) || 0, step = comboStep(), pct = comboPct(n);
  const need = step - (n % step);
  c.className = "combo" + (pct ? "" : " none");
  c.innerHTML =
    T("<span class=\"cmb-n\">连击 <b>×") + n + "</b></span>" +
    "<span class=\"cmb-p" + (pct ? "" : " off") + T("\">伤害 +") + pct + "%</span>" +
    T("<span class=\"cmb-next\">再对 ") + need + T(" 个 +") + CHAPTER.comboPct + "%</span>";
  const was = comboShown;
  comboShown = n;
  if(was === null || was === n || REDUCE_MOTION) return;
  void c.offsetWidth;                       // 强制回流，连着涨两次也能再播一遍
  const cls = n > was ? "up" : "down";
  c.classList.add(cls);
  setTimeout(function(){ c.classList.remove(cls); }, 460);
}
/* **前四章都是一章一个难度**（第一章 A1、第二章 A2、第三章 B1、第四章 B2）——
   用户定的「每章词不要重复」。以前是一章里从 A1 混到 B1，那样两章必然重叠。
   难度写在 content.js 的 CHAPTERS[].wordLv 上。
   ⚠️ **第五章「无尽」的 wordLv 是数组 [3,4,5]**（用户 2026-09）：B1 / B2 / B2–C1 三档一起出。
   所以取词这一路全部改成了**按一组难度**算 —— 单个数字会被包成一个一元数组，
   前四章的行为一个字没变。想读「当前这一章有哪几档词」只能走 chapterLvs()。*/
function chapterLvs(ch){
  const v = (ch || CH) && (ch || CH).wordLv;
  if(Array.isArray(v)) return v.length ? v.slice() : [1];
  return [v || 1];
}
/* 这一章**真的有词**的词性（Boss 弱点只在这里面挑，用户 2026-09 从「按类别」改过来的）。
   每个难度的每个词性都补到了 ≥6（词库文件顶上的规矩），所以正常不会退回全表。*/
function chapterPos(){
  const lvs = chapterLvs(), out = [];
  Object.keys(BYPOS).forEach(function(p){
    if(BYPOS[p].filter(function(w){ return lvs.indexOf(w.lv || 1) >= 0; }).length >= 6) out.push(p);
  });
  return out.length ? out : Object.keys(BYPOS);
}
/* 把词池收到**某一个难度**上。干扰项走的是这一条（跟题目那个词同难度，见 nextQuestion）。
   筛得太窄就逐级回退，**永远不返回空数组** —— 出不出题直接关系到能不能打。*/
function scopeToLevel(pool, want){
  let out = pool.filter(function(w){ return (w.lv || 1) === want; });
  if(out.length >= 6) return out;
  out = ALLW.filter(function(w){ return (w.lv || 1) === want; });
  return out.length >= 6 ? out : pool;
}
/* 把词池收到**这一章的那几档难度**上（无尽章是三档，别的章就一档）。*/
function scopeToLevels(pool, want){
  const set = {};
  want.forEach(function(l){ set[l] = true; });
  let out = pool.filter(function(w){ return set[w.lv || 1]; });
  if(out.length >= 6) return out;
  out = ALLW.filter(function(w){ return set[w.lv || 1]; });
  return out.length >= 6 ? out : pool;
}
function scopeByLevel(pool){
  return scopeToLevels(pool, chapterLvs());
}
/* **一趟之内答对过的词不再出第二次**（用户 2026-09）——「除了答错的」：
   答对就记进 `P.used`，答错（或先对后错）就从里面拿掉，于是错过的词照样会再来找你。
   心魔那条分支是故意不过滤的：它本来就是「这趟答错过的词」。
   ⚠️ 一章的词是问得完的（A1/A2 各 500 上下，B1/B2 各 3000）—— 挑空了就**清空 P.used 开新一轮**
      （弱点类挑空了先退回全池）。*/
function unused(pool){
  const out = [];
  for(let i=0;i<pool.length;i++) if(!P.used || !P.used[pool[i].en]) out.push(pool[i]);
  return out;
}
function pickQuizWord(cat){
  // 心魔：这一趟答错过的词，**熬过 HAUNT_DELAY 次答题之后**才有 35% 被拽出来重考
  const ready = readyHaunts();
  const hauntRate = hasRelic("bind") ? 0.7 : 0.35;      // 缚魂：心魔出现率翻倍
  if(ready.length && Math.random() < hauntRate){
    const en = pick(ready), w = WMAP[en];
    if(w && !(B && B.q && B.q.word.en === en)) return w;
  }
  if(!P.used) P.used = {};
  /* 用户 2026-09：**默认不再往怪的弱点类偏**（原来是 70%），词照全池抽。
     「嗅迹」是唯一的例外 —— 拿到它才把弱点类的出现率拉到 90%。*/
  const catRate = hasRelic("scent") ? 0.9 : 0;         // 嗅迹：多出弱点类的词
  const all = scopeByLevel(ALLW);
  let pool = (cat !== "all" && Math.random() < catRate && BYCAT[cat]) ? BYCAT[cat] : ALLW;
  pool = unused(scopeByLevel(pool));
  if(!pool.length) pool = unused(all);                  // 这一类问完了，退回全池
  if(!pool.length){ P.used = {}; pool = all; }          // 整章都问过一轮了，从头再来
  /* **没学过的新词权重 80%**（用户 2026-09）：LEX 里没有记录 = 这个存档从没遇到过。
     掷中就只在生词里挑；这一章的生词问完了（fresh 空）自然落回下面那个熟练度加权袋。*/
  const fresh = pool.filter(function(w){ return !LEX[lexKey(w)]; });
  if(fresh.length && Math.random() < NEW_WORD_RATE) pool = fresh;
  const bag = [];
  pool.forEach(function(w){
    const r = LEX[lexKey(w)], s = r ? (r.str || 0) : 0;
    let wt = s >= 3 ? 1 : s === 2 ? 2 : s === 1 ? 3 : 4;
    if(r && r.wrong) wt += 3;
    for(let i=0;i<wt;i++) bag.push(w);
  });
  let w = pick(bag), guard = 0;
  while(B && B.q && w.en === B.q.word.en && guard++ < 12) w = pick(bag);
  return w;
}
/* 这一题出拼写的概率：底子 10%，拼写流的两件遗物各再加 15%。
   「盲斗」不走这条线，它是硬锁 100%。*/
function spellChance(){
  return Math.min(1, SPELL_RATE + spellBonusPct() / 100);
}
/* 遗物给的**额外**拼写率（不含底子的 SPELL_RATE）。
   ⚠️ 盲斗以前吃这个数换伤害，2026-09 改成「一击必杀」之后就不吃了 —— 这里只管出题概率。 */
function spellBonusPct(){
  let p = 0;
  if(hasRelic("carve")) p += SPELL_RELIC_RATE * 100;      // 刻字 +15
  if(hasRelic("recite")) p += RECITE_SPELL_RATE * 100;    // 默诵 +30
  if(hasRelic("caution")) p += CAUTION_SPELL_RATE * 100;  // 慎笔 +5（2026-09-21 加：拼写题只占 5%，
                                                          //   光靠「拼写答错减伤」这条永远吃不满一件稀有）
  return Math.round(p);
}
/* ---- 答题读条（用户 2026-09）----
   选择题给 QUIZ_TIME 秒，读条走完还没作答 = 怪咬你一口，**题目原样留着、读条从头再走**（见 timeUp）。
   ⚠️ **拼写题不限时**（字母要一个一个点，本来就慢），复读者的补救题也一样。
   ⚠️ 条子是**绝对定位压在题面卡片顶边**的，不占纵向空间 ——
      「战斗窗答题前后一样高」那条规矩还在，别把它放回文档流里。
   计时器存在模块级的 qTimer 上，不挂 B —— B 随时会被清成 null，那样就关不掉了。*/
let qTimer = null;
function clearQTimer(){
  if(qTimer){ clearInterval(qTimer); qTimer = null; }
  const t = $("qTimer");
  if(t) t.hidden = true;
}
/* 这一题的读条有几秒：底子 QUIZ_TIME，「沙漏」每替你挡一次超时就短 GLASS_CUT 秒
   （只在这一层有效，nextFloor 里清零），最短 QUIZ_TIME_MIN 秒。*/
function qSeconds(){
  const base = qBase();
  return Math.max(Math.min(QUIZ_TIME_MIN, base), base - (G && G.glassCut ? G.glassCut : 0));
}
/* 自定义答题时间（用户 2026-09-25）：粘贴存档码「snow」解锁（OPT.snow），设置页里自己填秒数（OPT.qtime）。
   OPT.qtime = 1~999 秒；0 = 不限时（读条整个不出，跟拼写题一样）；没填 = 默认 QUIZ_TIME。
   它是「这台设备」的设置，跟 OPT 走、不进存档码。不限时时 qBase() 仍返回 QUIZ_TIME ——「从容」要拿它算剩几秒。*/
function qCustom(){ return OPT.snow && typeof OPT.qtime === "number" ? OPT.qtime : -1; }
function qBase(){ const c = qCustom(); return c > 0 ? c : QUIZ_TIME; }
function startQTimer(){
  clearQTimer();
  if(!B || !B.q || B.q.type === "spell") return;
  if(P && P.tut) return;          // 教程关不限时 —— 先把规矩看明白
  if(qCustom() === 0) return;     // 设置里选了「不限时」
  const t = $("qTimer"), fill = $("qTimerFill");
  if(!t || !fill) return;
  let secs = qSeconds();
  /* 定心：血低于 25% 时**每道题**都多给几秒（2026-09 用户把「整趟一次」的限制去掉、品质降到稀有）。
     直接加在这道题的读条上，不改 qSeconds() 本身（沙漏还要读它）。
     ⚠️ 不写日志 —— 低血时每题都触发，写一行就把战斗日志刷满了，读条变长本身看得见。*/
  if(hasRelic("steady") && P && P.hp <= stats().maxHp * 0.25) secs += STEADY_BONUS;
  const total = Math.max(1, secs) * 1000, t0 = Date.now();
  t.hidden = false;
  t.classList.remove("hot");
  fill.style.width = "100%";
  qTimer = setInterval(function(){
    if(!B || !B.q || B.locked){ clearQTimer(); return; }
    const left = total - (Date.now() - t0);
    if(left <= 0){ clearQTimer(); timeUp(); return; }
    fill.style.width = (left / total * 100) + "%";
    t.classList.toggle("hot", left <= 2000);
  }, 100);
}
/* 读条走完还没作答（用户 2026-09 改的）：**怪咬你一口，仅此而已**。
   - **不算一次答错**：熟练度、心魔、P.used、连击、赌骰全都不动；
   - **不刷新题目**：题面、四个选项、冒险按钮原样留着，答案也不揭晓；
   - 读条**从头再走一遍**，下一次超时就再咬一口，直到答出来（或者被咬死）为止。
   挨的那一下走的还是跟答错一样的减伤链（护甲 → mitigate）。
   ⚠️ 别再往这里加「揭晓正确答案 / 禁用选项 / 露出继续钮」那一套 —— 那是判错的做法。*/
function timeUp(){
  if(!B || !B.q || B.locked) return;
  const m = B.mob, s = stats();
  /* 沙漏：超时那一下完全不掉血，代价是这一层的读条永久短一截。
     ⚠️ 要在减伤链之前就返回 —— 不然会白白吃掉屏息的次数、白掷一次错身。*/
  if(hasRelic("glass")){
    G.glassCut = (G.glassCut || 0) + GLASS_CUT;
    say(T("沙漏替你咽下了这一下 —— 这一层的读条只剩 <b>") + qSeconds() + T("</b> 秒了。"), "hurt");
    startQTimer();
    return;
  }
  /* 破盾余威给的那次"接下来失手全免"，超时也算一次失手——跟答错那边的消耗逻辑对齐，
     不然护盾刚好破在超时那一下反而占不到便宜。*/
  if(B.shatterFree){
    B.shatterFree = false;
    say(T("时间到，但破盾余威替你接住了这一口。题还在，接着答。"), "good");
    startQTimer();
    return;
  }
  const mit = mitigate(Math.max(1, m.dmg - s.def), s);
  if(mit.dodged){
    say(T("时间到 —— 你侧了半步躲开。题还在，接着答。"), "hurt");
  } else {
    takeHit(mit.dmg, m, false);
    say(T("时间到，") + m.name + T(" 咬了你 <b>") + mit.dmg + T("</b> 点。题还在，接着答。"), "hurt");
  }
  const saved0 = deathSave();
  if(saved0) say(saved0, "crit");
  renderBattleBars();
  renderHud();
  if(P.hp <= 0){ B.locked = true; setTimeout(function(){ finishBattle(false); }, 480); return; }
  startQTimer();          // 题不换，读条重新开始
}
/* 四选一不让近义词同框（用户 2026-09-24：「词 4 选一时不要出现近义词」「所有语言都要优化近义词」）。
   表是离线算好的：学中文查 words-zh.js 的 ZH_SYN（zh-words/build.py），英语 / 西语 / 日语查 syn.js 的 SYN_EN / SYN_ES / SYN_JA
   （syn-words/build.py）。格式都是 {词: "近义词1|近义词2"}、只存一个方向，这里两边都挂上。
   另外任何语言都再比一次释义主干（去掉括号和 to/a/the）—— "shirt" 和 "shirt (top)" 这种。*/
let synMap = null;
function synIndex(){
  if(synMap) return synMap;
  synMap = {};
  const t = LANG_LEARN === "zh" ? (typeof ZH_SYN !== "undefined" ? ZH_SYN : null)
          : LANG_LEARN === "es" ? (typeof SYN_ES !== "undefined" ? SYN_ES : null)
          : LANG_LEARN === "ja" ? (typeof SYN_JA !== "undefined" ? SYN_JA : null)
          : (typeof SYN_EN !== "undefined" ? SYN_EN : null);
  if(t) Object.keys(t).forEach(function(a){
    t[a].split("|").forEach(function(b){
      (synMap[a] = synMap[a] || {})[b] = true;
      (synMap[b] = synMap[b] || {})[a] = true;
    });
  });
  return synMap;
}
function synHead(s){
  return String(s).toLowerCase().replace(/[（(][^）)]*[）)]/g, "").replace(/^\s*(to|a|an|the)\s+/, "").replace(/\s+/g, " ").trim();
}
function nearSyn(a, b){
  const m = synIndex();
  if(m[a.en] && m[a.en][b.en]) return true;
  const x = synHead(a.cn);
  return !!x && x === synHead(b.cn);
}
function nextQuestion(){
  clearQTimer();
  const m = B.mob;
  const word = pickQuizWord(m.cat);
  B.asked++;
  let type;
  if(P.tut) type = tutQuestionType(B.asked);                  // 教程关：题型是排好的
  else if(Math.random() < spellChance()) type = "spell";      // 每题独立掷一次
  else type = (B.asked % 2 === 1) ? "en2zh" : "zh2en";
  // 听音辨词已经删掉了（用户 2026-09）。🔊 还在，但只能自己点，或者答完自动念。
  B.q = {word:word, type:type, done:false, haunted: hauntReady(word.en)};
  /* 速答线（第十批）：记下这一题是什么时候摆出来的，answer() 里一减就知道答得快不快。
     ⚠️ 超时（timeUp）**不刷新**它 —— 读条走完一圈的人本来就不算「快」。
     ⚠️ 它不进续玩档（B 本来就不存），读档后那一题从头计时。*/
  B.qAt = Date.now();
  B.locked = false;
  // 「锁定冒险」开着就每题自动押上（拼写题除外，那题本来就不给冒险）
  B.wager = !!OPT.lock && type !== "spell";
  $("qHaunt").hidden = !B.q.haunted;
  $("qcard").classList.toggle("haunted", !!B.q.haunted);   // 标签浮在 qlabel 的位置上，不占高度（见 style.css）
  const wr = $("wagerRow"), wb = $("btnWager");
  wb.classList.toggle("on", B.wager);
  wb.disabled = false;
  wr.hidden = (type === "spell");                             // 拼写题不给冒险，太难
  setWagerLabel();
  $("verdict").innerHTML = "";
  $("btnNextQ").hidden = true;
  $("btnNextQ").textContent = T("继续");
  $("btnFlee").hidden = COOP;    // 联机里没有撤退（联机方案.md）
  $("spellBar").hidden = true;
  $("letters").hidden = true;
  $("opts").hidden = false;
  $("btnSpeak").hidden = true;

  B.optCount = 4;
  if(type === "spell"){ renderSpell(word); return; }

  if(type === "en2zh"){
    $("qLabel").textContent = T("这个词是什么意思？");
    $("qWord").innerHTML = arTag(word) + word.en + pyTag(word);
    $("qWord").className = LEARN_CJK ? "qword zh" : "qword";
  } else {
    $("qLabel").textContent = T("用英语怎么说？");
    $("qWord").textContent = word.cn;
    $("qWord").className = "qword cn";
  }

  // 干扰项跟**这个词本身**同难度，不重新掘一次 ——
  // B1 的词配 A1 干扰项等于白送
  const scoped = scopeToLevel(ALLW, word.lv || 1);
  const same = scoped.filter(function(o){ return o.cat === word.cat && o.en !== word.en; });
  const others = scoped.filter(function(o){ return o.en !== word.en && o.cat !== word.cat; });
  const opts = [word];
  const bag = same.slice();
  while(opts.length < (B.optCount || 4)){
    const src = bag.length ? bag : others;
    const c = src.splice(Math.floor(Math.random()*src.length),1)[0];
    if(!c) break;
    if(opts.some(function(o){ return o.en === c.en || o.cn === c.cn || nearSyn(o, c); })) continue;
    opts.push(c);
  }
  opts.sort(function(){ return Math.random() - .5; });
  B.q.opts = opts;          // 答错时要照这个顺序把每个选项的中英都摊开（answer 里）
  const box = $("opts");
  box.innerHTML = "";
  opts.forEach(function(o, i){
    const b = document.createElement("button");
    b.type = "button"; b.className = "opt" + (LEARN_CJK && type === "zh2en" ? " zh" : "");
    b.innerHTML = "<span class=\"n\">" + (i+1) + "</span>" +
                  (type === "zh2en" ? o.en : o.cn);
    b.addEventListener("click", function(){ answer(b, o.en === word.en); });
    box.appendChild(b);
  });
  startQTimer();          // 选择题才有读条（startQTimer 自己会放过拼写题）
}
/* 冒险按钮上的两行字：第一行是按钮自己的文本节点，第二行是里面的 <em>。
   ⚠️ 别用 textContent 整块赋值 —— 那会把 <em> 一起干掉（以前就是这个 bug）。 */
function setWagerLabel(){
  const b = $("btnWager"), on = !!(B && B.wager);
  if(b.firstChild && b.firstChild.nodeType === 3){
    b.firstChild.textContent = on ? T("冒险中 · 双倍赌注") : T("冒险 · 我确定");
  }
  const em = b.querySelector("em");
  if(em) em.textContent = OPT.lock ? T("已锁定：每题自动冒险") : T("对了伤害翻倍，错了受伤翻倍");
}
function renderSpell(word){
  $("qLabel").textContent = T("拼出这个词 · 对了双倍经验");
  /* 学中文：给英文释义 + 拼音（拼音就是英语那边「听读音」的等价物），玩家按顺序点汉字 */
  $("qWord").innerHTML = word.cn + hintTag(word);
  $("qWord").className = "qword cn";
  $("opts").hidden = true;
  $("spellBar").hidden = false;
  $("letters").hidden = false;
  /* 拼写题旁边那个 🔊：进来先自动念一遍（用户 2026-09 要的），之后随时能再点。
     它不跟设置里的「答完自动朗读」挂钩 —— 那条管的是答完之后那一次。
     ⚠️ 走 speakQueued：**等上一题那次朗读念完了再念**（用户 2026-09），
        直接 speak() 会把上一段掐断，两个词叠在一起听。*/
  $("btnSpellSpeak").hidden = !CAN_SPEAK;
  speakQueued(spellOf(word));   // 日语念读音（假名）：漢字交给 TTS 常念错
  B.spell = "";
  const target = spellOf(word);
  const letters = target.split("");
  /* 净写：不再给那两个干扰字母，键盘上只剩这个词自己的字母。
     博闻：这个词已经"掌握"（熟练度 ≥3）的话也一样不给干扰项——跟净写共用同一条判断，
     两件同时带着也不会叠出负数个干扰字母。*/
  const mastered = LEX[lexKey(word)] && (LEX[lexKey(word)].str || 0) >= 3;
  if(LEARN_ZH){
    if(!hasRelic("clean") && !(hasRelic("wellread") && mastered))
      Array.prototype.push.apply(letters, decoyChars(word, 3));
  } else if(LEARN_JA){
    if(!hasRelic("clean") && !(hasRelic("wellread") && mastered))
      Array.prototype.push.apply(letters, jaDecoys(word, 3));
  } else if(LANG_LEARN === "es"){
    if(!hasRelic("clean") && !(hasRelic("wellread") && mastered))
      Array.prototype.push.apply(letters, esDecoys(word, 2));
  } else if(!hasRelic("clean") && !(hasRelic("wellread") && mastered)){
    const extra = "aeioustrnlm".split("");
    for(let i=0;i<2;i++) letters.push(pick(extra));
    /* 星期/月份这类专有名词首字母大写，干扰项里也得有一个大写的 ——
       不然「全场唯一的大写字母」等于直接告诉玩家哪个字母排第一。
       ⚠️ 这一句改的是**最后一个干扰项**，所以整段必须待在 clean 的判断里面 ——
       没有干扰项时它会把词本身的字母改成大写，拼出来就对不上了。*/
    if(/[A-Z]/.test(word.en)) letters[letters.length-1] = letters[letters.length-1].toUpperCase();
  }
  letters.sort(function(){ return Math.random() - .5; });
  /* 笔顺：随机挑一格白送。轮到那一格时 giftFill() 自己填上，玩家不用按也退不掉。
     没有这件遗物就是 null。*/
  B.gift = hasRelic("stroke") ? ri(0, target.length - 1) : null;
  B.slots = slotNew(target.length);
  const box = $("letters");
  box.innerHTML = "";
  letters.forEach(function(ch){
    const b = document.createElement("button");
    b.type = "button"; b.className = "lbtn" + (LEARN_CJK ? " zh" : ""); b.textContent = ch;
    b.addEventListener("click", function(){
      if(B.locked || B.slots.done || !slotFill(B.slots, ch, b)) return;
      spellStep(word);
    });
    box.appendChild(b);
  });
  const back = document.createElement("button");
  back.type = "button"; back.className = "lbtn"; back.textContent = "⌫";
  back.addEventListener("click", function(){
    if(B.locked || B.slots.done || !slotLast(B.slots)) return;
    spellStep(word);
  });
  box.appendChild(back);
  /* 笔顺：随机挑一格白送 —— 一进来就填上、按掉对应的字母键，那一格退不掉也点不掉 */
  if(typeof B.gift === "number") slotGift(B.slots, B.gift, spellOf(word)[B.gift], box);
  spellStep(word);
}
/* ---- 拼写字格（用户 2026-09-25）：宝箱和战斗里的拼写题共用 ----
   点键盘：填进**最左边的空格**。点一个已经放上去的字母：把它取下来还回键盘，
   **那一格就空着，后面的字母不往前挪**（下一次点键盘先补这个空）。⌫ 退掉最右边那一个。
   笔顺送的那格是 fixed，退格和点字格都拿不掉。填满就 done，判题前那 180ms 里什么都动不了。*/
function slotNew(n){ const a = []; for(let i=0;i<n;i++) a.push(null); a.done = false; return a; }
function slotWord(st){ return st.map(function(x){ return x ? x.ch : ""; }).join(""); }
function slotFull(st){ return st.indexOf(null) < 0; }
function slotFill(st, ch, btn){
  const i = st.indexOf(null);
  if(i < 0) return false;
  st[i] = {ch:ch, btn:btn};
  btn.disabled = true; btn.dataset.used = "1";
  return true;
}
function slotTake(st, i){
  const x = st[i];
  if(!x || x.fixed || st.done) return false;
  st[i] = null;
  if(x.btn){ x.btn.disabled = false; delete x.btn.dataset.used; }
  return true;
}
function slotLast(st){
  for(let i=st.length-1;i>=0;i--) if(st[i] && !st[i].fixed) return slotTake(st, i);
  return false;
}
function slotGift(st, i, ch, box){
  const btn = Array.prototype.filter.call(box.children, function(b){
    return !b.disabled && b.textContent === ch;
  })[0] || null;
  if(btn){ btn.disabled = true; btn.dataset.used = "1"; }
  st[i] = {ch:ch, btn:btn, fixed:true};
}
/* 画字格：放了字母的格子能点（取下来），空格子挂 .empty，笔顺送的挂 .gift */
function slotDraw(row, st, onTake){
  row.innerHTML = "";
  st.forEach(function(x, i){
    const d = document.createElement("div");
    d.className = "sbox" + (x ? (x.fixed ? " gift" : " take") : "");
    d.textContent = x ? x.ch : "";
    if(x && !x.fixed) d.addEventListener("click", function(){ onTake(i); });
    row.appendChild(d);
  });
}
/* 拼写题走一步：重画；填满了就判这一题 */
function spellStep(word){
  B.spell = slotWord(B.slots);
  drawSpell(word);
  const target = spellOf(word);
  if(slotFull(B.slots)){
    B.slots.done = true;
    setTimeout(function(){ answer(null, B.spell === target); }, 180);
  }
}
function drawSpell(word){
  const row = $("spellRow");
  /* 词长到 9 个字母以上，字格要缩一号，否则一行摆不下会折行、把战斗窗顶高 */
  const target = spellOf(word);
  row.className = "spellrow" + (target.length >= (LEARN_JA ? 7 : 9) ? " long" : "") + (LEARN_CJK ? " zh" : "");
  slotDraw(row, B.slots, function(i){
    if(B.locked || !slotTake(B.slots, i)) return;
    spellStep(word);
  });
}
/* ================= 粒子反馈 =================
   捡到东西时，从东西所在的位置甩出几点碎屑，飞到它「进了哪儿」的那个数字上：
   金币 → 顶上那个「金」，遗物 → 底部的「遗物」标签。飞完那个目标自己跳一下。
   纯装饰：粒子挂在 body 上、pointer-events:none，飞完就删；
   系统开了「减少动态效果」就整段跳过，只留目标跳一下都不做。 */
/* 回血/掉血的动效 0.65s、升级光圈 1.5s（用户 2026-09 指定的时长）。
   CSS 里 .hpbar.hurt / .hpbar.heal / .lvring / .lvmote 的动画时长要跟这两个数对上。*/
var HP_FX_MS = 650, LEVEL_FX_MS = 1500;
var REDUCE_MOTION = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

function rectOf(el){
  if(!el || !el.getBoundingClientRect) return null;
  const r = el.getBoundingClientRect();
  if(!r.width && !r.height) return null;          // 藏起来的元素量不到，别飞
  return r;
}
function popTarget(el){
  if(!el || REDUCE_MOTION) return;
  el.classList.remove("pop");
  void el.offsetWidth;                            // 强制回流，连着捡两次也能再播一遍
  el.classList.add("pop");
  setTimeout(function(){ el.classList.remove("pop"); }, 420);
}
/* from/to 都是 DOM 元素；kind 决定碎屑长什么样（coin / gem）*/
function fxFly(fromEl, toEl, kind, n, color){
  if(REDUCE_MOTION) return;
  const a = rectOf(fromEl), b = rectOf(toEl);
  if(!a || !b) return;
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
  const x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
  const svg = kind === "gem" ? MOTE_GEM : MOTE_COIN;
  const size = kind === "gem" ? 11 : 10;
  for(let i = 0; i < n; i++){
    const d = document.createElement("div");
    d.className = "mote";
    d.innerHTML = svg;
    d.style.width = d.style.height = size + "px";
    d.style.left = (x0 - size / 2) + "px";
    d.style.top  = (y0 - size / 2) + "px";
    if(color) d.style.color = color;
    // 先各自炸开一点，再一起飞向目标 —— 两段用同一条 transition，靠延迟错开
    const sx = (Math.random() - .5) * 46, sy = (Math.random() - .5) * 46 - 10;
    d.style.transform = "translate(" + sx + "px," + sy + "px)";
    document.body.appendChild(d);
    const delay = 60 + i * 34;
    setTimeout(function(){
      d.style.transition = "transform .5s cubic-bezier(.5,0,.75,.5), opacity .5s ease-in";
      d.style.transform = "translate(" + (x1 - x0) + "px," + (y1 - y0) + "px) scale(.45)";
      d.style.opacity = "0";
    }, delay);
    setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); }, delay + 560);
  }
  setTimeout(function(){ popTarget(toEl); }, 60 + n * 34 + 380);
}
/* 升级：一圈光晕从人身上荡开，外加一圈金色粒子（用户 2026-09）。
   起点优先用地图上主角那一格；战斗中地图看不见，就落到战斗窗的血条上。
   纯装饰、挂在 body 上、LEVEL_FX_MS 之后全删，REDUCE_MOTION 开着就整段跳过。*/
function fxLevelUp(){
  if(REDUCE_MOTION) return;
  const host = (P && cells && cells[P.y * W + P.x]) || null;
  const from = rectOf(host) ? host
             : rectOf($("bHpBar")) ? $("bHpBar")
             : $("stageBox");
  const a = rectOf(from);
  if(!a) return;
  const cx = a.left + a.width / 2, cy = a.top + a.height / 2;
  const gold = getComputedStyle(document.documentElement)
                 .getPropertyValue("--coin").trim() || "#E3B23C";
  const ring = document.createElement("div");
  ring.className = "lvring";
  ring.style.left = cx + "px";
  ring.style.top  = cy + "px";
  ring.style.color = gold;
  document.body.appendChild(ring);
  // 粒子：从中心向四周散开，慢慢淡掉
  for(let i = 0; i < 14; i++){
    const d = document.createElement("div");
    d.className = "lvmote";
    d.style.left = cx + "px";
    d.style.top  = cy + "px";
    d.style.color = gold;
    document.body.appendChild(d);
    const ang = (Math.PI * 2 / 14) * i + Math.random() * 0.4;
    const dist = 52 + Math.random() * 46;
    setTimeout(function(){
      d.style.transform = "translate(" + Math.cos(ang) * dist + "px," +
                          (Math.sin(ang) * dist - 16) + "px) scale(.4)";
      d.style.opacity = "0";
    }, 20 + i * 12);
  }
  const tab = $("hLevel");
  if(tab) setTimeout(function(){ popTarget(tab); }, 240);
  setTimeout(function(){
    Array.prototype.forEach.call(document.querySelectorAll(".lvring,.lvmote"), function(el){
      if(el.parentNode) el.parentNode.removeChild(el);
    });
  }, LEVEL_FX_MS);
}
/* 捡金币：从那一格飞到顶上的「金」 */
function fxGold(x, y){
  const cell = cells[y * W + x];
  fxFly(cell || $("stageBox"), $("hGold"), "coin", 7);
}
/* 怪倒下：掉的金币飞向「金」，经验飞向「等级」（绿色，跟血/金区分开）*/
function fxKill(x, y){
  const cell = cells[y * W + x] || $("stageBox");
  fxFly(cell, $("hGold"), "coin", 6);
  const green = getComputedStyle(document.documentElement)
                  .getPropertyValue("--venom").trim() || "#47702F";
  fxFly(cell, $("hLevel"), "gem", 5, green);
}
/* 拿遗物：从弹窗（或屏幕中央）飞到底部的「遗物」标签，颜色按品质走 */
function fxRelic(r){
  // 起点：当前开着的那个弹层（三选一 / 宝箱 / 游商都行），没有就用地图
  const open = Array.prototype.filter.call(document.querySelectorAll(".sheet"), function(el){
    return rectOf(el) && !el.closest(".ghost");        // 正在淡出的那份复制品不算（弹窗关闭动画）
  });
  const from = open[open.length - 1] || $("stageBox");
  const tab = document.querySelector('.nav[data-view="viewRelic"]');
  const color = getComputedStyle(document.documentElement)
                  .getPropertyValue("--q" + ((r && r.r) || 0)).trim() || "#B8860B";
  fxFly(from, tab, "gem", 6, color);
}
function floatNum(where, txt, cls){
  const s = document.createElement("span");
  s.className = "float " + cls;
  s.textContent = txt;
  if(where === "foe"){
    document.querySelector(".foe").appendChild(s);
  } else {
    /* 玩家这边（用户 2026-09-25）：「-4」直接压在**玩家血条**上 —— 战斗窗开着就是战斗里那条，
       不然是地图顶上那条（祭坛献血这种）。血条自己 overflow:hidden，字往上飘会被切掉，
       所以挂在 body 上按血条的位置 fixed 定位，不占任何布局。*/
    const bar = $("veilBattle").hidden ? $("hpBar") : $("bHpBar");
    const r = bar && bar.getBoundingClientRect();
    if(!r || !r.width){ return; }
    s.className += " onbar";
    s.style.right = Math.max(0, window.innerWidth - r.right + 8) + "px";
    s.style.top = (r.top + r.height / 2 - 11) + "px";
    document.body.appendChild(s);
  }
  setTimeout(function(){ if(s.parentNode) s.parentNode.removeChild(s); }, 900);
}
function answer(btn, ok){
  /* 联机第二期：怪死是服务器广播确认的共识事件（见 coopHandleDead），
     窗口可能在这一题答完之前就已经被队友那条广播关掉了 —— B 这时候是 null。 */
  if(!B || B.locked) return;
  B.locked = true;
  clearQTimer();                 // 答了就把读条收掉，别让它在判定画面上继续走
  $("btnWager").disabled = true;
  G.floorAsked = (G.floorAsked || 0) + 1;    // 破晓甲：这一层已经答过几题，nextFloor() 里清零
  const word = B.q.word, m = B.mob, s = stats();
  const firstSeen = !LEX[lexKey(word)];          // 课业：这个存档从没见过的生词（LEX 里没记录）
  const rec = LEX[lexKey(word)] || {str:0, seen:0, wrong:0};
  rec.seen++;
  if(P.seenWords.indexOf(word.en) < 0) P.seenWords.push(word.en);
  // 一趟之内：答对过就不再出（记进 P.used），答错就放回池子里接着找你
  if(!P.used) P.used = {};
  if(ok) P.used[word.en] = 1; else delete P.used[word.en];
  /* 这一趟按层记一笔（结算时跟 MET.accF 里的历史比）。
     ⚠️ 先只记在 P 上，endRun 里才并进 MET —— 不然「历史平均」里就掺了本局自己。*/
  if(!P.accF) P.accF = {};
  const fk = String(G.floor);
  if(!P.accF[fk]) P.accF[fk] = {r:0, w:0};
  if(ok) P.accF[fk].r++; else P.accF[fk].w++;
  const today = todayRec();                      // 今日已学 / 今日正确率（信息页）
  today.ws[lexKey(word)] = 1;
  if(ok) today.r++; else today.w++;

  if(B.q.type !== "spell"){
    /* 答错了就把**每个选项的中英两边都摊开**（用户 2026-09）——
       字写在方块里面（方块本来就是正方形，装得下第二行），
       **不往 verdict 加行**，战斗窗答题前后照旧同高。
       对号用的是 B.q.opts 的下标，不再去解析按钮文字。*/
    const list = B.q.opts || [];
    Array.prototype.forEach.call($("opts").children, function(b, i){
      b.disabled = true;
      const o = list[i];
      if(!o) return;
      if(o.en === word.en) b.classList.add("right");
      if(!ok){
        const sub = document.createElement("span");
        sub.className = "sub";
        /* 学中文时顺手把拼音也带上：汉字那一格补「拼音 · 释义」，释义那一格补「汉字 拼音」*/
        sub.textContent = (B.q.type === "zh2en") ? (o.py ? o.py + " · " + o.cn : o.cn)
                                                 : (o.py ? o.en + " " + o.py : wordFull(o));
        b.appendChild(sub);
        b.classList.add("two");
        if(LANG_LEARN !== "en") b.classList.add("tight");     // 学中文 / 西语：英文释义长，摊开两行时收一号字，别撑出方块
      }
    });
    if(!ok && btn) btn.classList.add("wrong");
  } else {
    Array.prototype.forEach.call($("letters").children, function(b){ b.disabled = true; });
  }

  const wasStrong = (rec.str || 0) >= 3;          // 学者：看的是答题前的熟练度
  // Boss 的弱点是词性，普通怪的弱点是类别（makeFoe 里的 weakPos 标着是哪一种）
  // 通感：每一题都算打中弱点（弱点的 +2 点伤、破绽、追猎全都跟着生效）
  const hitWeak = hasRelic("synes") || (!!m.weak && (m.weakPos ? word.pos === m.weak : word.cat === m.weak));
  const isSpell = B.q.type === "spell";
  /* ===== 速答线（第十批）=====
     从摆题到作答花了几秒（B.qAt 在 nextQuestion() 里记），FAST_SEC 秒之内算「快」。
     ⚠️ **拼写题拼对算「0 秒内答对」**（用户 2026-09-25）：它不限时、字母要一个一个点，按真实用时算永远快不了，
     所以拼对一律当成 0 秒 —— 速答线那五件全吃、「从容」按读条满格算、「刹那」照样记一次速答。
     拼错就不算快（跟选择题答错一样）。*/
  const usedSec = isSpell ? 0 : (Date.now() - (B.qAt || Date.now())) / 1000;
  const fastAns = isSpell ? ok : usedSec <= FAST_SEC;  // 答得快（不分对错，「刹那」数的是这个）
  const fast = fastAns && ok;                          // 「3 秒内答对」——速答线那五件看的都是它
  const leftSec = (isSpell && !ok) ? 0 : Math.max(0, Math.floor(qSeconds() - usedSec));   // 从容：读条还剩几整秒
  let head, note = "";
  /* ⚠️ note 是死变量（从来没被渲染过，老代码留的）。新遗物的反馈一律攒在 relicLog 上，
     接到底下那条 say() 后面 —— 想让玩家在战斗窗里当场看见，就只能写进 head。*/
  let relicLog = "";
  /* 割裂：**每答一题**（不论对错）自伤 1 点，但**累计割掉 REND_CAP 点就停手**（用户 2026-09）。
     不会致死，最低留 1 点。P.rend 记的是这一趟一共割掉多少，跟着 P 进续玩档（读处 || 0）。*/
  if(hasRelic("rend") && (P.rend || 0) < REND_CAP){
    P.rend = (P.rend || 0) + 1;
    P.hp = Math.max(1, P.hp - 1);
    if(P.rend >= REND_CAP) relicLog += T(" <span class=\"sys\">(割裂割满 ") + REND_CAP + T(" 点，从此不再割)</span>");
  }
  if(ok){
    P.right++; rec.str = Math.min(5, (rec.str||0) + 1); rec.wrong = 0;
    /* 蚀甲：答对一题护甲 +1，封顶 CORRODE_MAX（2026-09-21 修好的方向）——
       原来的写法把「被磨掉几点」记在 G.corrodeLoss 上、封在 0，所以「每答对 +1」
       永远只能把护甲还回原值，一件史诗从头到尾只有负面。*/
    if(hasRelic("corrode")) G.corrodeArmor = Math.min(CORRODE_MAX, (G.corrodeArmor || 0) + 1);
    /* **冒险答对记 2 点连击**（用户 2026-09）—— 押上了本来就更难 */
    P.combo += B.wager ? 2 : 1;
    if(fast && hasRelic("offbeat")) P.combo += OFFBEAT_COMBO;   // 抢拍：答得快多记一点（在拼对那 +10 之前）
    /* 拼对的默认奖励（数值在 content.js）：连击直接加一截 + 本场经验翻倍。
       连击是在算伤害之前加的 —— 这一刀就能吃到加成。*/
    if(isSpell){ P.combo += SPELL_COMBO * (hasRelic("boom") ? 2 : 1); B.xpx = SPELL_XPX; }  // 破音：连击奖励翻倍
    if(hitWeak && hasRelic("chase")){                       // 追猎：打中弱点多攒两下 + 回血
      P.combo += 2;
      const ch = healUp(Math.max(1, Math.ceil(stats().maxHp * CHASE_HEAL)));
      if(ch.hp) relicLog += T(" <span class=\"sys\">(追猎 · 回 ") + ch.hp + T(" 点)</span>");
    }
    /* 续弦：5% 把连击接回这一趟最长的那一串。**必须在下面更新 maxCombo 之前判**，
       不然 P.combo 刚好就是 maxCombo，接回来等于没接。*/
    if(hasRelic("restring") && luck(RESTRING_RATE)){
      if(P.combo < (P.maxCombo || 0)) P.combo = P.maxCombo;
      const rs = healUp(RESTRING_HEAL);
      relicLog += T(" <span class=\"sys\">(续弦 · 连击 ×") + P.combo +
        (rs.hp ? T("，回 ") + rs.hp + T(" 点") : "") + ")</span>";
    }
    if(P.combo > (P.maxCombo || 0)) P.maxCombo = P.combo;   // 结算按这个给宝石
    if(hasRelic("counter") && P.combo > 0 && P.combo % 10 === 0) healUp(COUNTER_HEAL, s);   // 计数器
    /* ===== 伤害：四层，顺序写死在这儿（品质阶梯见 content.js 顶上的注释）=====
         伤害 =（攻击 + 基础点伤 + 额外伤害）×（1 + 百分比合计）+ 点伤，再 ×暴击倍率，最后减护甲，最低 1
       ⚠️ **额外伤害现在进这条式子**（用户 2026-09 改的公式）——
          它跟基础点伤同一个桶，照样吃百分比、吃暴击、被护甲减，不再是单独扣的一笔。
       **只有「×(1+百分比)」和「×暴击倍率」两个乘区，别再加第三个。** */

    /* 无常（神圣）：每答对随机触发一档。伤害那一档攒在 B.whim 上，**只在这一场有效**，
       而且是在下面的百分比桶里跟别的 % 一起相加 —— 没有新乘区。*/
    let whim = "";
    if(hasRelic("whim")){
      const roll = ri(1, 3);
      if(roll === 1){ B.whim = (B.whim || 0) + 8; whim = T("伤害 +8%（本场累计 ") + B.whim + T("%）"); }
      else if(roll === 2){
        const back = Math.max(1, Math.ceil(s.maxHp * 0.05));
        healUp(back, s);
        whim = T("回 ") + back + T(" 点生命");
      } else { P.gold += 60; whim = T("+60 金"); }
      relicLog += T(" <span class=\"sys\">(无常 · ") + whim + ")</span>";
    }

    // 第一层 · 基础点伤（会被百分比放大）
    let base = s.atk;

    // 第二层 · 百分比（全部相加，最后只乘一次）
    // 连击也在这一桶里：每 comboStep 次 +comboPct%，不封顶（火星让 step 少 1）
    /* 不看这一题、不看这只怪的那些（连击 / 金币 / 血量 / 护甲 / 护盾换的 …）全在 pctSteady() 里 ——
       信息页「属性」那一格读的是同一个函数，两边口径只有一个。这里只加**这一刀才有**的。*/
    const cbo = comboPct();
    let pct = pctSteady(s);
    const recoil = hasRelic("recoil") ? (P.recoil || 0) * RECOIL_PCT : 0;   // 反震：已经算在 pctSteady 里了，这里只留着给下面打完清零、写日志
    if(isSpell && hasRelic("carve")) pct += CARVE_PCT;                      // 刻字：拼对的那一刀
    if(isSpell && hasRelic("boom"))  pct += BOOM_PCT;                       // 破音：同上（连击翻倍在上面）
    if(hasRelic("nerve") && B.wager) pct += NERVE_PCT;                      // 铁胆：冒险答对的加码
    if(hitWeak && hasRelic("scent")) pct += SCENT_PCT;                      // 嗅迹
    if(hitWeak && hasRelic("synes")) pct += SYNES_PCT;                      // 通感
    if(hasRelic("slay") && m.boss) pct += SLAY_PCT;                         // 弑主：对 Boss 再加（对谁都加的那一档在 pctSteady）
    if(B.whim) pct += B.whim;                                               // 无常：本场攒下的
    /* 拼刃：拼对之后的 SBLADE_Q 题各 +SBLADE_PCT%。窗口记在 P.bladeLeft 上（跟着续玩档），
       **这里消耗一格**；答错那条分支也会消耗一格（"接下来 5 题"，不分对错）。*/
    if(hasRelic("spellblade") && (P.bladeLeft || 0) > 0){ pct += SBLADE_PCT; P.bladeLeft--; }
    /* 节奏件：「×2」「×1.5」都摊成②层的百分比 —— 全局仍然只有两个乘区。
       两件同时触发就是 +150%（相加，不是相乘）。*/
    /* 冒险（用户 2026-09 报的 bug：开了跟没开一样）——
       按钮上写的就是「对了伤害翻倍」，所以它是②层的 +100%，不是原来那个 +3 点伤。
       ⚠️ 摊进百分比桶，别给它开第三个乘区。*/
    if(B.wager) pct += 100;
    /* 开场 2026-09-21 从「每层第一次」改成「每层前 OPENING_N 次」——
       「每层一次」摊到一层 35 刀上只剩 +2.9%，撑不起一件稀有（见面礼「每场一次」是它的 11.5 倍）。*/
    if(hasRelic("opening") && (G.openLeft || 0) > 0){ pct += OPENING_PCT; G.openLeft--; }
    if(hasRelic("greet") && !B.greetUsed){ pct += GREET_PCT; B.greetUsed = true; }  // 见面礼：每场第一次
    /* ===== 第十批落在②层的十一件（2026-09-21）=====
       照旧全部摊进这**同一个**百分比桶，没有新乘区。*/
    if(fast && hasRelic("swift")) pct += SWIFT_PCT;                         // 疾思：答得快
    if(hasRelic("poise")) pct += Math.min(POISE_MAX, leftSec * POISE_PCT);  // 从容：读条每剩 1 秒
    if(hasRelic("longword") && wordLen(word) >= LONGW_AT) pct += LONGW_PCT;   // 长句：长词
    if(B.q.haunted && hasRelic("fearless")) pct += FEARLESS_PCT;            // 无惧：答对心魔词
    /* 全盛：满血给大的，刚掉血的几题给个缓冲 —— 不然一被咬就整件失效，体感太脆。
       P.primeLeft 跟着续玩档（读处 || 0）。*/
    if(hasRelic("prime")){
      if(P.hp >= s.maxHp){ pct += PRIME_PCT; P.primeLeft = PRIME_Q; }
      else if((P.primeLeft || 0) > 0){ pct += PRIME_AFTER; P.primeLeft--; }
    }
    /* 锐进：升级之后的 RISE_Q 题各 +RISE_PCT%（跟「拼刃」一个写法，窗口记在 P.riseLeft 上，
       **答错那条分支也消耗一格** —— 写的是「升级后的 5 题」，不分对错）。*/
    if(hasRelic("keenrise") && (P.riseLeft || 0) > 0){ pct += RISE_PCT; P.riseLeft--; }
    /* 刹那（神圣）：上一轮攒满 INSTANT_RUN 次速答，这一刀就是那一刀。先吃、再数这一题。*/
    if(hasRelic("instant") && G.instantReady){ pct += INSTANT_PCT; G.instantReady = false; }

    // 第三层 · 点伤（百分比之后才加，吃暴击、被护甲减）
    let flat = 0;
    if(hitWeak) flat += 2;                                                  // 打中弱点：③点伤 +2
    if(B.wager && hasRelic("gambler")) flat += GAMBLER_FLAT;                // 赌徒：冒对了再加一笔点伤
    let surge = false;
    if(hasRelic("surge") && luck(.25)){ flat += SURGE_FLAT; surge = true; } // 潮汐
    flat += flatSteady();                                                   // 镜盾 / 血锤（信息页同一个口径）

    /* 第四层 · 额外伤害：跟基础点伤同一个桶（用户 2026-09 改的公式），
       所以它照样吃下面的百分比和暴击 —— 数字给得比①层大得多，品质也都在传奇以上。*/
    let extra = extraSteady(s);                                             // 割裂 / 滚雪球 / 锋满（信息页同一个口径）
    if(isSpell && hasRelic("recite")) extra += RECITE_EXTRA;                // 默诵：拼对才给
    if(fast && hasRelic("snap")) extra += SNAP_EXTRA;                       // 抢答：答得快
    if(hasRelic("volume")) extra += Math.max(0, wordLen(word) - VOLUME_FROM) * VOLUME_EXTRA;  // 累牍：每超一个字母

    // 第四层 · 暴击率／暴击伤害。超过 100% 的部分每 5 点换 +10% 暴击伤害，不浪费
    const cc = critSteady(s, pct);                                          // 暴击率 / 倍率全是常驻的，信息页同一个口径
    const critRate = cc.rate, critMult = cc.mult;
    // 灵光：连击每满 5 次，那一刀必定暴击（吃的还是同一个暴击乘区，没有第三个）
    // 刹那（神圣）：答得快的那一刀也必定暴击 —— 走同一个 forceCrit，还是那一个乘区
    const forceCrit = (hasRelic("flash") && P.combo > 0 && P.combo % 5 === 0) ||
                      (fast && hasRelic("instant")) || hasRelic("fate");   // 定数（第十一批）：每一刀都暴击
    /* 无锋（第十一批）：不再暴击 —— 灵光 / 刹那 / 定数的「必定暴击」也一起哑掉（两件都带时按无锋算）*/
    const crit = !hasRelic("noedge") && (forceCrit || Math.random() * 100 < critRate);
    // 蓄势：暴了就清零，没暴就再攒一层（跨怪物保留，跟连击一个道理）
    if(hasRelic("charge")) P.charge = crit ? 0 : (P.charge || 0) + 1;

    /* 双面（神圣）要拿「这一刀打出去多少加成」换减伤，记在 G 上，mitigate() 里读。
       ⚠️ 记的是**算完的 pct**，所以它换来的减伤总是慢一刀 —— 故意的，两边同时现算会绕成死循环。*/
    if(G) G.lastPct = pct;
    let raw = Math.round((base + extra) * (1 + pct / 100)) + flat;
    if(crit) raw = Math.round(raw * critMult);                              // 乘区二
    // 破绽：打中弱点时无视护甲；碎颅：暴击时无视护甲
    /* 破绽 2026-09-21 从「打中弱点时」改成无条件 —— 弱点命中率只有 7%，
       而怪物护甲平均 0.8 点，两个小数字乘在一起等于这件传奇什么都没做。*/
    const noArmor = hasRelic("flaw") || (crit && hasRelic("crush"));
    const armor = noArmor ? 0 : m.armor;
    const dmg = Math.max(1, raw - armor);
    if(crit && hasRelic("vamp")) healUp(VAMP_HEAL, s);                      // 饮血
    // 记仇看的是"连续挨你打了几刀"——每一次真的落下的攻击都算一刀，跟这次是不是暴击/额外伤害无关
    if(hasRelic("grudge")) m.hitsLanded = (m.hitsLanded || 0) + 1;
    /* 吸血（第十一批）只算**真的打进血条**的那部分：一刀 2 万打一只剩 1600 血的怪，按 1600 算 ——
       所以一层能回多少有天然封顶（一层怪的血就那么多）。深渊那只血是一层层的，打进去多少就算多少。*/
    let landed = landedOn(m, dmg);
    coopDealDamage(m, dmg);
    /* 回响之厅（神圣）：50% 立刻再打一刀 —— 就是把刚才那一刀**原样再来一次**
       （不重新掷暴击、不再算额外伤害、不加连击），所以还是那两个乘区。*/
    let hall = 0;
    if(hasRelic("hall") && luck(0.5)){
      hall = dmg;
      landed += landedOn(m, hall);
      coopDealDamage(m, hall);
      setTimeout(function(){ floatNum("foe", "-" + hall, "dmg"); }, 380);
      relicLog += T(" <span class=\"sys\">(回响之厅又补了 ") + hall + T(" 点)</span>");
    }
    if(recoil){ P.recoil = 0; relicLog += T(" <span class=\"sys\">(反震 +") + recoil + T("% 打了出去)</span>"); }
    /* ===== 第十一批：按「这一刀」长的四件（2026-09-25）=====
       前期一刀只值零点几点，每刀取整会全被吃掉，所以都按小数攒在 G 上、攒满 1 点给 1 点（每层清零）。*/
    const sipPct = (hasRelic("thirst") ? THIRST_PCT : 0) + ((crit && hasRelic("bloodmoon")) ? MOON_PCT : 0);
    if(sipPct > 0 && landed > 0){                                            // 渴刃 / 血月：吸血
      G.sipBank = (G.sipBank || 0) + landed * sipPct / 100;
      const n = Math.floor(G.sipBank);
      if(n > 0){ G.sipBank -= n; healUp(n, s); }
    }
    if(hasRelic("bloodriver") && landed > 0){                                // 血河：吸血，溢出的一半转盾
      G.riverBank = (G.riverBank || 0) + landed * RIVER_PCT / 100;
      const n = Math.floor(G.riverBank);
      if(n > 0){
        G.riverBank -= n;
        const before = P.shield || 0;
        const rv = healUp(n, s, true);
        /* 转出来的盾最多补到上限的 RIVER_SHIELD —— 只封这一笔（别的件给的盾不管，所以按「转之前」的盾量算）*/
        if(rv.sh > 0) P.shield = before + Math.max(0, Math.min(rv.sh, Math.ceil(s.maxHp * RIVER_SHIELD) - before));
      }
    }
    /* 刃壁：按这一刀**打出去的数**（溢出的也算 —— 它就是给后期「一刀几万、怪一千多血」那部分溢出找的出口），
       每层累计封在上限的 BWALL_MAX。刹车踩在产量上，跟凝盾那条规矩一样。回响之厅补的那一刀不算。*/
    if(hasRelic("bladewall")){
      const capW = Math.ceil(s.maxHp * BWALL_MAX);
      if((G.bwallGot || 0) < capW){
        G.bwallBank = (G.bwallBank || 0) + dmg * BWALL_PCT;
        let n = Math.floor(G.bwallBank);
        if(n > 0){
          G.bwallBank -= n;
          n = Math.min(n, capW - (G.bwallGot || 0));
          G.bwallGot = (G.bwallGot || 0) + n;
          P.shield = (P.shield || 0) + n;
        }
      }
    }
    if(hasRelic("drain") && luck(DRAIN_RATE)) healUp(DRAIN_HEAL, s);  // 吞噬
    // 搏动：按百分比回血 —— 定额那几件（吞噬 +2）在深层等于零
    if(hasRelic("pulse")) healUp(Math.max(1, Math.ceil(s.maxHp * PULSE_PCT)), s);
    /* 不死鸟：血掉到 PHOENIX_AT 以下之后，每答对回一大口。
       ⚠️ 判断放在饮血/吞噬**之后** —— 那两件先垫一口，还在线下才轮到它 */
    if(hasRelic("phoenix") && P.hp <= s.maxHp * PHOENIX_AT){
      const r = healUp(Math.max(1, Math.ceil(s.maxHp * PHOENIX_HEAL)), s);
      if(r.hp) relicLog += T(" <span class=\"sys\">(不死鸟回了 ") + r.hp + T(" 点)</span>");
    }
    if(hasRelic("dice") && luck(DICE_RATE)) G.dice = (G.dice || 0) + 1;  // 赌骰：答对 50% 叠一层（本层内）
    if(B.wager && hasRelic("allin") && luck(.10)){                // 孤注
      healUp(Math.max(1, Math.round(s.maxHp * ALLIN_PCT)), s);
    }
    if(hasRelic("midas") && luck(0.25)) P.gold += 10;             // 点金：固定 10 金
    /* ===== 第九批「跨流派组合」的答对触发（2026-09-21）=====
       拼写和连击那两条线带齐之后触发频率会翻十倍，所以**每件都有每层次数上限** ——
       计数挂在 G 上、nextFloor() 里清零。别把上限删了（算法见 遗物数据表.md 附录 C）。*/
    if(isSpell){
      if(hasRelic("needle") && (G.needleN || 0) < NEEDLE_N){               // 粗针：拼写→护盾
        G.needleN = (G.needleN || 0) + 1;
        P.shield = (P.shield || 0) + NEEDLE_SHIELD;
      }
      if(hasRelic("cap") && (G.capN || 0) < CAP_N){                        // 学徒帽：拼写→回血
        G.capN = (G.capN || 0) + 1;
        const ch2 = healUp(Math.max(1, Math.ceil(s.maxHp * CAP_HEAL)), s);
        if(ch2.hp) relicLog += T(" <span class=\"sys\">(学徒帽 · 回 ") + ch2.hp + T(" 点)</span>");
      }
      if(hasRelic("glyph")) G.glyphArmor = Math.min(GLYPH_MAX, (G.glyphArmor || 0) + GLYPH_ARMOR);  // 咒文：拼写→本层护甲
      if(hasRelic("spellblade") && (G.bladeN || 0) < SBLADE_N){            // 拼刃：开一扇 5 题的窗口
        G.bladeN = (G.bladeN || 0) + 1;
        P.bladeLeft = SBLADE_Q;
      }
    }
    if(hasRelic("oldrope") && P.combo > 0 && P.combo % ROPE_AT === 0 && (G.ropeN || 0) < ROPE_N){   // 旧绳：连击→护盾
      G.ropeN = (G.ropeN || 0) + 1;
      P.shield = (P.shield || 0) + ROPE_SHIELD;
    }
    if(hasRelic("longsong") && P.combo > 0 && P.combo % SONG_AT === 0 && (G.songN || 0) < SONG_N){  // 长歌：连击→护盾＋回血
      G.songN = (G.songN || 0) + 1;
      P.shield = (P.shield || 0) + SONG_SHIELD;
      const sg = healUp(Math.max(1, Math.ceil(s.maxHp * SONG_HEAL)), s);
      relicLog += T(" <span class=\"sys\">(长歌 · 护盾 +") + SONG_SHIELD +
        (sg.hp ? T("，回 ") + sg.hp + T(" 点") : "") + ")</span>";
    }
    /* ===== 第十批「答对就给盾／给血」的五件（2026-09-21）=====
       跟第九批一个规矩：**每件都封每层次数**，计数挂 G 上、nextFloor() 里清零。
       不封的话「秒针」一层能产 80 点盾、「长考」150 点，各是本档的三到六倍。*/
    if(fast && hasRelic("secondhand") && (G.tickN || 0) < TICK_N){          // 秒针：速答→护盾
      G.tickN = (G.tickN || 0) + 1;
      P.shield = (P.shield || 0) + TICK_SHIELD;
    }
    if(wordLen(word) >= LONGW_AT && hasRelic("ponder") && (G.longN || 0) < PONDER_N){   // 长考：长词→护盾
      G.longN = (G.longN || 0) + 1;
      P.shield = (P.shield || 0) + PONDER_SHIELD;
    }
    if(B.q.haunted){
      if(hasRelic("exorcise") && (G.exorN || 0) < EXOR_N){                  // 驱邪：答对心魔词→回血
        G.exorN = (G.exorN || 0) + 1;
        const ex = healUp(Math.max(1, Math.ceil(s.maxHp * EXOR_HEAL)), s);
        if(ex.hp) relicLog += T(" <span class=\"sys\">(驱邪 · 回 ") + ex.hp + T(" 点)</span>");
      }
      if(hasRelic("calmsoul") && (G.calmsN || 0) < CALMS_N){                // 镇魂：答对心魔词→护盾
        G.calmsN = (G.calmsN || 0) + 1;
        P.shield = (P.shield || 0) + CALMS_SHIELD;
      }
    }
    /* 刹那（神圣）：连续 INSTANT_RUN 次速答攒满，下一刀 +INSTANT_PCT%（上面那条吃它）。
       ⚠️ 只要有一题不是「速答」就从头数 —— 答错那条分支也会把它清零。*/
    if(hasRelic("instant")){
      if(fast){
        G.fastRun = (G.fastRun || 0) + 1;
        if(G.fastRun >= INSTANT_RUN){
          G.fastRun = 0; G.instantReady = true;
          relicLog += T(" <span class=\"sys\">(刹那攒满了 —— 下一刀 +") + INSTANT_PCT + "%)</span>";
        }
      } else G.fastRun = 0;
    }
    if(crit && hasRelic("critshield") && (G.critShN || 0) < CRITSH_N){     // 暴盾：暴击→护盾
      G.critShN = (G.critShN || 0) + 1;
      P.shield = (P.shield || 0) + CRITSH_SHIELD;
    }
    /* 凝盾：每答对 AEGIS_EVERY 题攒 AEGIS_GAIN 点护盾，攒到 AEGIS_MAX 封顶 */
    if(hasRelic("aegis")){
      P.aegisN = (P.aegisN || 0) + 1;
      if(P.aegisN >= AEGIS_EVERY){
        P.aegisN = 0;
        const before = P.shield || 0;
        P.shield = Math.min(AEGIS_MAX, before + AEGIS_GAIN);
        if(P.shield > before) relicLog += T(" <span class=\"sys\">(凝盾 · 护盾 ") + P.shield + ")</span>";
      }
    }
    if(wasStrong && hasRelic("tome")) P.gold += 8;                          // 典藏：答对掌握过的词
    if(firstSeen && hasRelic("lesson")) P.gold += 10;                       // 课业：这个存档第一次见的生词
    floatNum("foe", "-" + dmg, "dmg");
    $("foeArt").classList.remove("hurt"); void $("foeArt").offsetWidth; $("foeArt").classList.add("hurt");
    head = "<span class=\"big ok\">" +
           (B.wager ? T("冒对了！") : crit ? T("暴击！") : isSpell ? T("拼对了！") : T("命中！")) + "</span>";
    note = T("你砍中 ") + m.name + T("，造成 <b>") + dmg + T("</b> 点伤害") +
           (hitWeak ? T("（正中弱点）") : "") +
           (surge ? T("，浪涌炸开") : "") +
           (extra ? T("（额外伤害 +") + extra + T("）") : "") +
           (pct ? T("（+") + pct + "%" + (cbo ? T("，其中连击 +") + cbo + "%" : "") + T("）") : "") + T("。");
    /* 反刍：上一题答错了，这一题答对就回一口血 */
    if(P.chew && hasRelic("chew")){
      P.chew = false;
      const back = Math.max(1, Math.ceil(s.maxHp * CHEW_PCT));
      healUp(back, s);
      relicLog += T(" <span class=\"sys\">(反刍回了 ") + back + T(" 点生命)</span>");
    }
    const hauntGone = dropHaunt(word.en);     // 答对了就从名单里拿掉（还没熬到的也一样）
    if(B.q.haunted && hauntGone){
      const back = hasRelic("bind") ? Math.max(1, Math.round(s.maxHp * BIND_HEAL)) : 2;
      healUp(back, s);
      note += T(" <span style=\"color:var(--venom)\">心魔散了，回 ") + back + T(" 点生命。</span>");
    }
  } else {
    P.wrong++; rec.str = Math.max(0, (rec.str||0) - 1); rec.wrong = (rec.wrong||0) + 1;
    G.floorWrong = (G.floorWrong || 0) + 1;    // 循迹：这一层打错了几题，nextFloor() 里跟上一层比
    B.wrongTimes = (B.wrongTimes || 0) + 1;    // 后劲：这一场第几次答错，mitigate() 里读
    /* 二见 2026-09-21 从「连续第二次」改成「**本局**第二次」——
       连续两次错同一个词太罕见（中间答对一次就重新数），一件史诗基本吃不到。
       P.wrongSeen 记这一趟错过哪些词，跟着 P 进续玩档（读处 || {}）。*/
    if(!P.wrongSeen) P.wrongSeen = {};
    const repeatWord = !!P.wrongSeen[word.en];
    P.wrongSeen[word.en] = true;
    /* 铁胆：冒险失手不断连击；长链：答错只减半；
       **拼写题拼错也只减半**（用户 2026-09：拼写比选择难，错一次不该把长链清零）*/
    /* 断链：连击攒够 `unchainAt()`（= **当前层数**）就能拿它挡一下 —— 完全免伤，
       连击减掉同样多（不清零）。越深越难触发、触发一次也越贵，是用户 2026-09-21 定的形状。
       惯性：连击 ≥20 时不清零、直接砍到 20，比长链的"减半"更保底，排在长链前面。
       归位：连击真的要清零那一刻，如果原本 ≥REBOUND_AT(10) 就返还一半并回血，
       只在"真清零"这条分支里算，而且**每层只有一次**。
       ⚠️ **必须在下面动 P.combo 之前判**，不然连击已经清零/减半了，条件就永远不成立。*/
    const unchain = hasRelic("unchain") && P.combo >= unchainAt();
    const inertia = hasRelic("inertia") && P.combo >= INERTIA_AT;
    const beforeCombo = P.combo;
    /* 铁胆的保护 2026-09-21 封成**每层 NERVE_N(2) 次**（G.nerveN，nextFloor/resumeRun 里清零）——
       次数用完就照常往下走长链/惯性/清零那条链，不再白保。*/
    const nerveOk = B.wager && hasRelic("nerve") && (G.nerveN || 0) < NERVE_N;
    if(nerveOk){
      G.nerveN = (G.nerveN || 0) + 1;                                  // 连击保住
      relicLog += T(" <span class=\"sys\">(铁胆 · 连击留住 ×") + P.combo +
        T("，本层还剩 ") + (NERVE_N - G.nerveN) + T(" 次)</span>");
    }
    else if(unchain) P.combo = Math.max(0, P.combo - unchainAt());   // 代价也是「当前层数」
    else if(inertia) P.combo = INERTIA_AT;
    else if(isSpell || hasRelic("chain")) P.combo = Math.floor(P.combo / 2);
    else {
      P.combo = 0;
      /* 归位 2026-09-21 也封成**每层一次**（G.reboundUsed）—— 一层能断六次链，不封就是一层多回三成血 */
      if(hasRelic("rebound") && beforeCombo >= REBOUND_AT && !G.reboundUsed){
        G.reboundUsed = true;
        P.combo = Math.round(beforeCombo * REBOUND_KEEP);
        const rb = healUp(Math.max(1, Math.ceil(stats().maxHp * REBOUND_HEAL)));
        relicLog += T(" <span class=\"sys\">(归位 · 连击缓冲回 ×") + P.combo +
          (rb.hp ? T("，回 ") + rb.hp + T(" 点") : "") + ")</span>";
      }
    }
    if(hasRelic("spellblade") && (P.bladeLeft || 0) > 0) P.bladeLeft--;   // 拼刃：窗口是「接下来 5 题」，答错也算一题
    if(hasRelic("keenrise") && (P.riseLeft || 0) > 0) P.riseLeft--;       // 锐进：同理，「升级后的 5 题」不分对错
    if(hasRelic("instant")) G.fastRun = 0;                                 // 刹那：连着的速答断了
    G.dice = 0;                       // 赌骰：答错把这一层攒的暴击率清零
    if(hasRelic("chew")) P.chew = true;     // 反刍：欠着，下一题答对才还
    if(hasRelic("build")){                  // 筑盾：错了也不白错
      P.shield = (P.shield || 0) + BUILD_SHIELD;
      relicLog += T(" <span class=\"sys\">(筑盾 · 护盾 ") + P.shield + ")</span>";
    }
    const wasHaunted = B.q.haunted;
    /* 无惧（传奇，第十批）：心魔词答错**不再加重心魔** —— 这个词不会重新排到队尾去，
       熬的时间也不重算（免伤那一半在下面的减伤链最前面）。*/
    const fearless = hasRelic("fearless") && wasHaunted;
    if(!fearless) addHaunt(word.en);         // 答错就缠上来

    {   // （这层花括号原来是「复读者补救题」那条分支留下的，删遗物时保留块作用域，省得整段重缩进）
      // 受伤也全是加减：怪物伤害 − 护甲，再加上冒险失手/心魔的惩罚
      let dmg = Math.max(1, m.dmg - s.def);   // 背水已经算在 s.def 里
      // 冒险失手 —— 按钮写的是「错了受伤翻倍」；托底把这个倍率从 ×2 降到 ×1.5
      if(B.wager) dmg = Math.round(dmg * (hasRelic("cushion") ? CUSHION_MULT : 2));
      if(wasHaunted) dmg += 1;                 // 心魔又答错
      /* 心镜 2026-09-21 从「完全免伤」改成减伤 —— 加成挪进了 mitigate() 的 cut 桶
         （靠 opt.haunted 传进去），所以它现在跟别的百分比减伤一起相加、一起吃 MIT_CUT_MAX。*/
      /* 无惧：心魔词答错一律不掉血。排在断链之后、默诵之前 ——
         它是「这一下本来就不该疼」，同样不该去消耗默诵/回声/屏息的次数。*/
      /* 断链排在所有免伤的最前面：它是拿连击换来的，不该去消耗默诵/回声/屏息的次数 */
      if(dmg > 0 && unchain){
        dmg = 0;
        head = T("<span class=\"big no\">断链 —— 链子替你挨了</span>");
        note = T("连击 −") + unchainAt() + T("，血一点没掉。");
      }
      if(dmg > 0 && fearless){
        dmg = 0;
        head = T("<span class=\"big no\">无惧 —— 旧账咬不动你</span>");
        note = T("心魔答错不掉血，这个词也没再加重。");
      }
      // 默诵：拼写题答错不掉血，但**每层只有 RECITE_FREE 次**（老续玩档没这个字段，所以 || 0）
      if(dmg > 0 && isSpell && hasRelic("recite") && (G.reciteFree || 0) < RECITE_FREE){
        G.reciteFree = (G.reciteFree || 0) + 1;
        dmg = 0;
        head = T("<span class=\"big no\">默诵替你挡下了</span>");
        note = T("这一层的免伤还剩 ") + (RECITE_FREE - G.reciteFree) + T(" 次。");
      }
      /* 慎笔 2026-09-21：从「拼写答错 −15%」改成「拼写答错不掉血」+ 拼写出现率 +5% ——
         拼写题只占 5% 的题，−15% 摊下来只有 0.4 价值，是全表最低的一件。*/
      if(dmg > 0 && isSpell && hasRelic("caution")){
        dmg = 0;
        head = T("<span class=\"big no\">慎笔 —— 笔尖悬住了</span>");
        note = T("拼错了，但这一下没落到身上。");
      }
      if(dmg > 0 && hasRelic("echo") && !G.echoUsed){           // 回声：每层第一次答错不掉血 + 回一口
        G.echoUsed = true;
        dmg = 0;
        const eh = healUp(Math.max(1, Math.ceil(stats().maxHp * ECHO_HEAL)));
        head = T("<span class=\"big no\">回声替你挡下了</span>");
        note = T("这一层的第一次失手，不掉血") + (eh.hp ? T("，还回了 ") + eh.hp + T(" 点") : "") + T("。");
      }
      /* 防御线的减伤链放在**最后**：默诵/回声先挡，全挡下了就不消耗屏息的次数、也不掷错身。*/
      if(dmg > 0){
        const mit = mitigate(dmg, s, {wrong:true, repeatWord:repeatWord, haunted:wasHaunted});
        dmg = mit.dmg;
        if(mit.dodged){
          head = mit.by === "glimmer" ? T("<span class=\"big no\">浮光 —— 刀穿过去了</span>")
                                      : T("<span class=\"big no\">错身 —— 没碰到你</span>");
          note = T("你侧了半步，这一下落空了（连击照断）。");
        } else {
          head = "<span class=\"big no\">" + (B.wager ? T("冒险失手") : T("失手")) + "</span>";
          note = takeHit(dmg, m, wasHaunted);
          relicLog += mit.why;
        }
      } else if(!head){
        head = T("<span class=\"big no\">失手</span>");
        note = T("这一下没让你掉血。");
      }
      if(hasRelic("thorns")){                 // 赤鳞：额外伤害层，无视护甲
        coopDealDamage(m, THORNS_EXTRA);
        note += T(" 赤鳞反弹了 <b>") + THORNS_EXTRA + T("</b> 点。");
        floatNum("foe", "-" + THORNS_EXTRA, "dmg");
      }
    }
    const saved = deathSave();
    if(saved) relicLog += " <span class=\"sys\">(" + saved + ")</span>";
  }
  LEX[lexKey(word)] = rec;     // 只改内存，下一个存档点（下楼 / 回主城）才落盘

  $("verdict").innerHTML = head +
    "<span class=\"mean\"><b>" + wordFull(word) + "</b>" + (word.py ? " " + word.py : "") + T("　") + word.cn + T("　<span style=\"color:var(--faint)\">") + CAT_CN[word.cat] + "</span></span>";
  if(CAN_SPEAK){
    $("btnSpeak").hidden = false;                  // 答完了，随时能再听一次
    if(OPT.speak) speak(spellOf(word));                  // 设置里开着就自动念一遍
  }
  let spellLog = "";
  /* 拼错不再当场退回成选择题（用户 2026-09）—— 跟别的答错一样进心魔，
     熬满 HAUNT_DELAY 题才回来找你。*/
  if(isSpell && ok) spellLog =
    T(" <span class=\"sys\">(拼对 · 连击 +") + SPELL_COMBO + T("，本场经验 ×") + SPELL_XPX + ")</span>";
  say((ok ? T("答对 ") : T("答错 ")) + wordShow(word) + " = " + word.cn + spellLog + relicLog, ok ? "good" : "hurt");
  if(P.tut) tutEvent(ok ? "right" : "wrong");
  renderBattleBars();
  renderHud();
  $("btnFlee").hidden = true;

  // 最后一击：多留一会儿，让人看清这一题的词和释义 —— 之后直接关窗，没有中间画面了
  if(m.hp <= 0){
    if(COOP && coopTrySwitchTarget(m)){
      // 我这条空了、队友那条还有血 —— 转去帮砍，不结束战斗，往下走正常的答题流程
    } else if(COOP){
      /* 两条血条这边看着都空了：怪死是共识事件，等服务器广播的 dead 才真的收（联机方案.md 第 3/6 节）。
         B.locked 已经是 true 了（函数最上面挡的），这里只是把「下一题」按钮也收起来，别让人干等着点它。*/
      $("btnNextQ").hidden = true;
      say(m.name + T("晃了一下，血条空了 —— 等确认最后一下。"), "sys");
      return;
    } else {
      setTimeout(function(){ finishBattle(true); }, 760);
      return;
    }
  }
  if(P.hp <= 0){ setTimeout(function(){ finishBattle(false); }, 480); return; }
  if(ok && OPT.auto) setTimeout(function(){ if(B && B.locked) nextQuestion(); }, 450);
  else $("btnNextQ").hidden = false;
}
/* ---- 倒下那一刻的保险，**两道都在这儿** ----
   不灭薪火：每层一次，把血钉在 1 点；回魂：整趟一次，回到 REVIVE_PCT 的上限。
   ⚠️ **所有「打完发现血 ≤ 0」的地方都必须调这一个函数**（答错 / 超时 / 补救失败结清）——
   以前这三处各写了一遍薪火的判断，加第二道保险时很容易漏掉一处。
   返回要显示的那句话；没救下来就是空字符串。*/
function deathSave(){
  if(P.hp > 0) return "";
  /* 一息（第十一批）：排在**最前面** —— 先用最便宜的这一次（只留 1 点），薪火和回魂留给下一下。*/
  if(hasRelic("lastgasp") && G && !G.gaspUsed){
    G.gaspUsed = true;
    P.hp = 1;
    return T("一息 —— 还剩一口气，你没倒下（这一层就这一次）。");
  }
  if(hasRelic("undying") && !P.undying){
    P.undying = true;
    /* 2026-09-21：原来是把血钉在 1 点 —— 钉在 1 点等于下一下还是死，
       一件神圣只值「多挨一下」。现在直接回 UNDYING_HEAL 的上限。*/
    P.hp = Math.max(1, Math.ceil(stats().maxHp * UNDYING_HEAL));
    if(hasRelic("warmth")) P.warmthLeft = WARMTH_HITS;   // 余温：薪火之后接下来几次答错单独再减半
    return T("薪火在胸口炸开 —— 你带着 ") + P.hp + T(" 点生命站住了。");
  }
  // 回魂：本局 REVIVE_N 次（P.revived 从布尔改成计数，老续玩档存的 true/false 会被 JS 当 1/0 比）
  if(hasRelic("revive") && (P.revived || 0) < REVIVE_N){
    P.revived = (P.revived || 0) + 1;
    P.hp = Math.max(1, Math.ceil(stats().maxHp * REVIVE_PCT));
    return T("回魂 —— 你数到第二次心跳，又站了起来（") + P.hp + T(" 点生命，本局还剩 ") +
           (REVIVE_N - P.revived) + T(" 次）。");
  }
  return "";
}
/* ---- 回血的唯一入口 ----
   ⚠️ **所有回血都要从这儿过**（跟挨打那边的 takeHit() 是一对）：
   「泉涌」要把**溢出上限的那部分**按 SPILL_RATE（2 点血 → 1 点盾）转成护盾，
   散在各处直接写 `P.hp = Math.min(maxHp, ...)` 的话它就收不到那笔溢出。
   force = true 时不看有没有泉涌也转（「水」自己那条词条）。
   返回 {hp, sh}：真回了多少血、转了多少盾，调用方拿去写日志。*/
function healUp(n, s0, force){
  if(!(n > 0)) return {hp:0, sh:0};
  const s = s0 || stats();
  const room = Math.max(0, s.maxHp - P.hp);
  const up = Math.min(room, n), spill = n - up;
  if(up > 0) P.hp += up;
  // 汗巾／血锤按「这一层回了多少血」给加成 —— 只算真的进了血条的那部分，转成护盾的不算
  if(up > 0 && G) G.healed = (G.healed || 0) + up;
  let sh = 0;
  if(spill > 0 && (force || hasRelic("well"))){
    sh = Math.floor(spill / SPILL_RATE);
    if(sh > 0) P.shield = (P.shield || 0) + sh;
  }
  return {hp:up, sh:sh};
}
/* ---- 挨打这一侧的减伤链（2026-09 的防御线）----
   顺序写死在这儿：软甲 −10% → 屏息每层前 HOLD_FREE 次减半 → 钝痛把单次封在上限 10% →
   错身 25% 完全躲开。返回 {dmg, dodged, why}，why 是接在受伤那句话后面的说明。
   ⚠️ **只在真的要掉血的时候调**（默诵/回声先挡，挡掉了就别进来）——
   不然会白白吃掉屏息的次数、白掷一次错身。
   ⚠️ 这条线里**没有固定减伤**：第 1 层的怪只打 1~2 点，「每次少挨 3 点」就是开局无敌，
   到后期又等于没有 —— 跟 content.js 里「不给后面的章加护甲」是同一个数学。 */
/* ---- 概率的唯一口子（第十批「幸运」线，2026-09-21）----
   全表所有**遗物的**掷骰都走它：潮汐／吞噬／药膏／错身／赌骰／施粥／点金／续弦／孤注／回响之厅。
   「幸运」把概率按 FORTUNE_X **相对**抬一档（0.25 → 0.3125），「再摇」在没中的时候再给一次机会。
   ⚠️ 新加带概率的遗物一律走 `luck(p)`，别再直接写 `Math.random() < p` ——
   那两件神圣/史诗就是靠这个口子吃饭的，漏一处就少一处。
   ⚠️ 地图生成、出题、洗牌那些**不是遗物效果**的随机照旧用 Math.random()，别一起收进来。*/
function luck(p){
  let q = p;
  if(hasRelic("fortune")) q = Math.min(1, q * (1 + FORTUNE_X / 100));      // 幸运：相对加成
  if(Math.random() < q) return true;
  if(hasRelic("reshake") && Math.random() < RESHAKE_P) return Math.random() < q;   // 再摇：再掷一次
  return false;
}
/* ===== 常驻的那几档（信息页「属性」和 answer() / mitigate() 共用，2026-09-25）=====
   只收**不看这一题、不看这只怪**的加成：连击、金币、血量、护甲、护盾、本层回血、金坛 …
   拼对 / 打中弱点 / 冒险 / 答得快 / 对 Boss / 每层前几次 这类「这一刀才有」的留在 answer() 里现加。
   ⚠️ 这几个函数**不许有副作用**（信息页一刷新就要调一次）——会扣次数的（开场 / 拼刃 / 锐进 / 全盛）别搬进来。
   ⚠️ 新加一件「常驻」的伤害 / 暴击 / 减伤遗物，加在这里，信息页自动就显示了。 */
function pctSteady(s){
  let pct = comboPct();                                                   // 连击：每 comboStep 次一档
  if(hasRelic("quick")) pct += Math.min(QUICK_MAX, Math.floor(P.combo / 5) * QUICK_PER); // 速记
  if(hasRelic("ember") && P.hp <= s.maxHp / 3) pct += EMBER_PCT;          // 残焰
  if(hasRelic("hoard")) pct += Math.floor((P.gold || 0) / HOARD_PER) * HOARD_PCT;  // 守财：不封顶
  if(hasRelic("flaw"))  pct += FLAW_PCT;                                  // 破绽（无视护甲在 answer）
  if(hasRelic("inertia") && P.combo >= INERTIA_AT) pct += INERTIA_PCT;    // 惯性
  // 以 RELIC_MAX（15）为准，不跟着「行囊」的上限走，免得两件叠成滚雪球
  if(hasRelic("empty")) pct += Math.max(0, RELIC_MAX - P.relics.length) * EMPTY_PCT;  // 空手
  if(hasRelic("spend")) pct += Math.min(40, Math.floor((P.spent || 0) / 300) * 2); // 散财：每花 300 金 +2%
  if(hasRelic("offer")) pct += OFFER_PCT;                                 // 献身（生命减半在 stats() 里）
  pct += gildGet("pct");                                                  // 金坛：本局攒下的伤害 %
  if(hasRelic("slay")) pct += SLAY_ALL;                                   // 弑主：对谁都加的那一档（对 Boss 再加在 answer）
  if(G && hasRelic("delve")) pct += Math.min(DELVE_MAX, G.floor * 0.5);   // 踏层：每下一层 +0.5%
  // 铁壁：每 1 点护甲 +3%。用 defGear —— 练习模式那 +50 不算数（见 stats()）
  if(hasRelic("bastion")) pct += (s.defGear || 0) * BASTION_PER;
  if(hasRelic("recoil")) pct += (P.recoil || 0) * RECOIL_PCT;             // 反震：挨几下就攒几层
  /* ===== 第九批「跨流派组合」落在②层的六件（2026-09-21）=====
     全部照旧摊进这一个百分比桶，**没有新乘区**。*/
  if(hasRelic("shedge")){                                                 // 盾锋：护盾→伤害%
    pct += Math.min(SHEDGE_MAX, Math.floor((P.shield || 0) / SHEDGE_PER) * SHEDGE_PCT);
  }
  if(G && hasRelic("towel")){                                             // 汗巾：本层回血→伤害%
    const per = Math.max(1, Math.ceil(s.maxHp * TOWEL_PER / 100));
    pct += Math.min(TOWEL_MAX, Math.floor((G.healed || 0) / per) * TOWEL_PCT);
  }
  if(hasRelic("bile")) pct += Math.min(BILE_MAX, Math.floor(cutStatic() / BILE_PER) * BILE_PCT);  // 苦胆：减伤→伤害%
  if(hasRelic("shieldking")){                                             // 盾王：护盾→伤害%（护甲在 stats）
    pct += Math.min(SKING_TIERS, Math.floor((P.shield || 0) / SKING_PER)) * SKING_PCT;
  }
  if(hasRelic("ironvow")){                                                // 铁誓：护甲→伤害%（减伤在 cutState）
    pct += Math.min(IRONVOW_TIERS, Math.floor((s.defGear || 0) / IRONVOW_PER)) * IRONVOW_PCT;
  }
  if(hasRelic("confluence")) pct += confTiers(s) * CONF_PCT;              // 万流归宗
  if(hasRelic("janus")){                                                  // 双面：常驻减伤→伤害%
    pct += JANUS_PCT + Math.min(JANUS_C_TIERS, Math.floor(cutStatic() / JANUS_C_PER)) * JANUS_C_STEP;
  }
  /* 第十批 */
  if(hasRelic("feeddemon")) pct += Math.min(FEED_MAX, readyHaunts().length * FEED_PCT);  // 养魔：身上的心魔
  if(hasRelic("full") && P.hp > s.maxHp * FULL_AT) pct += FULL_PCT;       // 饱满：血还满着
  if(hasRelic("whole") && P.hp >= s.maxHp) pct += WHOLE_PCT;              // 圆满：满血（护甲那半在 stats）
  if(hasRelic("bamboo")) pct += Math.min(BAMBOO_MAX, (P.killStreak || 0) * BAMBOO_PCT);   // 势如破竹
  if(hasRelic("stockpile")) pct += Math.min(STOCK_MAX, (P.bought || 0) * STOCK_PCT);      // 囤货：本局买过几件
  if(G && hasRelic("knock") && isBossFloor(G.floor)) pct += KNOCK_PCT;    // 叩关：Boss 层（减伤那半在 cutState）
  if(hasRelic("billow")) pct += BILLOW_PCT;                               // 叠浪（第十一批）：换暴击伤害那一半在 critSteady
  return pct;
}
/* ③点伤里常驻的两件（不被百分比放大，吃暴击、被护甲减）*/
function flatSteady(){
  let flat = 0;
  /* 镜盾：每 MIRROR_PER 点护盾 +1 点伤。⚠️ 2026-09 用户把它从「每 2 点」改成「每 5 点」并加了 MIRROR_MAX 封顶 ——
     凝盾现在是每题 8 点盾，不封的话堆盾流的点伤会一路飞出去。*/
  if(hasRelic("mirror")) flat += Math.min(MIRROR_MAX, Math.floor((P.shield || 0) / MIRROR_PER));
  // 血锤：**这一层**回了多少血就换多少点伤（G.healed 在 healUp() 里累，nextFloor() 清零）
  if(G && hasRelic("bloodmaul")) flat += Math.min(BMAUL_MAX, Math.floor((G.healed || 0) / BMAUL_PER) * BMAUL_FLAT);
  return flat;
}
/* ④额外伤害里常驻的三件（跟攻击同一个桶，吃百分比、吃暴击）*/
function extraSteady(s){
  let extra = 0;
  if(hasRelic("rend")) extra += REND_EXTRA;                               // 割裂（自伤在 answer，每题一次）
  if(hasRelic("snow")) extra += Math.floor(P.combo / SNOW_PER) * SNOW_EXTRA;  // 滚雪球：连击每满 10 一档，不封顶
  if(hasRelic("keenfull") && P.hp > s.maxHp * KEENF_AT) extra += KEENF_EXTRA;   // 锋满：血过半
  return extra;
}
/* 暴击率 / 暴击倍率：整段都是常驻的。pct 传「这一刀算完的百分比」（叠浪要读它），信息页传 pctSteady()。
   返回的 rate 已经封在 100（溢出的部分换成了倍率）。*/
function critSteady(s, pct){
  let critRate = s.crit, critMult = 2;
  if(hasRelic("maul")){ critMult += MAUL_MULT; critRate += MAUL_CRIT; }   // 重锤：暴击率 + 暴击伤害
  if(hasRelic("edge")) critMult += EDGE_MULT;                             // 薄刃：暴击伤害 ×2 → ×2.5
  if(hasRelic("crush")) critMult += CRUSH_MULT;                           // 碎颅：暴击伤害（无视护甲在 answer）
  if(hasRelic("tempo") && P.combo >= TEMPO_AT) critRate += TEMPO_CRIT;    // 节拍
  if(G && hasRelic("dice")) critRate += (G.dice || 0) * DICE_CRIT;        // 赌骰：本层内叠加
  if(hasRelic("spark")) critRate += SPARK_CRIT;                           // 火星：档位变密 + 暴击率
  if(hasRelic("charge")) critRate += (P.charge || 0) * CHARGE_CRIT;       // 蓄势：攒了几刀没暴就叠几档
  /* 溢锋（第十一批）：溢出那一档从 +10% 换成 +20% */
  if(critRate > 100){ critMult += Math.floor((critRate - 100) / 5) * (hasRelic("overcrit") ? OVERCRIT_STEP : 0.1); critRate = 100; }
  /* 叠浪（第十一批）：②层那个百分比桶每满 100%，暴击倍率 +0.2 —— ②层是加法、堆得越高越不值钱，
     这件把溢出来的那部分挪进暴击乘区。读的是**这一刀全部算完**的 pct（冒险那 +100% 也算）。*/
  if(hasRelic("billow")) critMult += Math.floor(pct / BILLOW_PER) * BILLOW_CRIT;
  if(hasRelic("fate")) critMult -= FATE_CUT;                              // 定数：必定暴击，倍率 ×2 → ×1.6
  return {rate: critRate, mult: critMult};
}
/* 「受到的伤害 −N%」里按**当前状态**算的那部分：cutStatic() + 看血量 / 护甲 / 护盾 / Boss 层的几件，
   wrong = true 时再加上「答错挨打」都有的几件（长链 / 后劲 / 老对手 / 苦行）。
   每层一次的（粗布 / 缓坠）、看这只怪的（镇压 / 记仇 / 面熟）、看这道题的（稳答 / 心镜 / 二见）留在 mitigate() 里。*/
function cutState(s, wrong){
  let cut = cutStatic();
  if(hasRelic("scale") && P.hp < s.maxHp / 2) cut += SCALE_CUT;           // 逆鳞：半血以下
  /* 第十批：余裕跟逆鳞正好相反（血还满着才有）；叩关只在 Boss 层生效（那一层的容错是全游戏最低的）。*/
  if(hasRelic("ease") && P.hp > s.maxHp * EASE_AT) cut += EASE_CUT;       // 余裕：血还在八成以上
  if(hasRelic("knock") && G && isBossFloor(G.floor)) cut += KNOCK_CUT;    // 叩关：Boss 层（伤害那半在 pctSteady）
  /* ===== 第九批「跨流派组合」里依赖护甲／护盾的三件（不能进 cutStatic，那儿不许调 stats）===== */
  if(hasRelic("shieldheart") && (P.shield || 0) >= SHEART_AT) cut += SHEART_CUT;   // 盾心：护盾够厚
  if(hasRelic("ironvow")){                                                // 铁誓：护甲→减伤
    cut += Math.min(IRONVOW_TIERS, Math.floor((s.defGear || 0) / IRONVOW_PER)) * IRONVOW_CUT;
  }
  if(hasRelic("confluence")) cut += confTiers(s) * CONF_CUT;              // 万流归宗：三条线的档数
  /* 双面：拿**上一刀真的打出去的伤害加成**（G.lastPct，answer() 里记）换减伤 ——
     它自己那一档是「减伤→伤害」，方向相反，所以不会跟 cutStatic() 绕成死循环。*/
  if(hasRelic("janus") && G){
    cut += Math.min(JANUS_P_TIERS, Math.floor((G.lastPct || 0) / JANUS_P_PER)) * JANUS_P_STEP;
  }
  if(!wrong) return cut;
  if(hasRelic("chain")) cut += CHAIN_CUT;                                 // 长链：答错时的减伤
  /* 后劲 2026-09-21 从「同一场」改成「同一层」、并且**第 1 次答错就起算** ——
     一场平均只答错 0.52 次，原来那条「同场第二次起」一层只发生 1.3 次。
     ⚠️ mitigate() 调的时候 G.floorWrong 已经把这一下 +1 过了；信息页读到的是「下一次答错」之前的数，差一档，无所谓。*/
  if(G && hasRelic("grit")) cut += Math.min(GRIT_MAX, (G.floorWrong || 0) * GRIT_STEP);
  /* 老对手：本局**每遇到过一次** Boss/层间守者就再减 NEMESIS_CUT%（2026-09-21 改成对所有敌人生效）。
     P.bossSeen 在 startBattle() 里累，整趟不清零。*/
  if(hasRelic("nemesis") && P.bossSeen){
    let met = 0;
    for(const k in P.bossSeen) met += P.bossSeen[k] || 0;
    cut += Math.min(NEMESIS_MAX, met * NEMESIS_CUT);
  }
  // 苦行：这一趟没喝过泉（P.everDrankSpring 在 resolveSpring()/drinkAll() 里置真），跟老茧同一个公式
  if(G && hasRelic("ascetic") && !P.everDrankSpring) cut += Math.min(ASCETIC_MAX, G.floor * ASCETIC_PER);
  return cut;
}
/* ---- 常驻减伤合计（第九批「跨流派组合」用）----
   只装**跟这一下无关**的那几项：装备、层数、金币、连击决定，每一下都生效。
   「苦胆」「恒甲」「双面」读的就是它，mitigate() 也从它起算 —— 全局只有这一个口径，
   别再在别处抄一份。
   ⚠️ **不许在这里调 stats()**：stats() 自己要读它（恒甲按常驻减伤给护甲），调回去就是死循环。
   所以依赖护甲/生命上限的那几项（逆鳞、盾心、铁誓、万流归宗）留在 mitigate() 里单独加。*/
function cutStatic(){
  let cut = 0;
  if(hasRelic("soft")) cut += 7;                                          // 软甲
  if(hasRelic("shed")) cut += SHED_CUT;                                   // 脱壳
  if(hasRelic("hide")) cut += 3;                                          // 皮甲
  if(G && hasRelic("tough")) cut += Math.min(TOUGH_MAX, G.floor * TOUGH_PER);   // 老茧
  if(hasRelic("still")) cut += STILL_CUT;                                 // 不动
  if(G && hasRelic("deep") && G.floor >= DEEP_FROM) cut += DEEP_CUT;      // 深潜
  if(hasRelic("quell")) cut += QUELL_ALL;             // 镇压：对 Boss 多的那一档在 mitigate() 里
  // 第九批：三件自带底数的减伤 + 两件挂在别的流派上的
  if(hasRelic("bile")) cut += BILE_CUT;                                   // 苦胆自带
  if(hasRelic("evervow")) cut += EVERVOW_CUT;                             // 恒甲自带
  if(hasRelic("janus")) cut += JANUS_CUT;                                 // 双面自带
  if(hasRelic("goldplate")){                                              // 金甲：金币→减伤
    cut += GPLATE_CUT + Math.min(GPLATE_MAX, Math.floor((P.gold || 0) / GPLATE_PER) * GPLATE_STEP);
  }
  if(hasRelic("linked")){                                                 // 连环：连击→减伤
    cut += LINKED_CUT + Math.min(LINKED_MAX, Math.floor((P.combo || 0) / LINKED_AT) * LINKED_STEP);
  }
  cut += gildGet("cut");                                                  // 金坛：本局攒下的减伤
  return cut;
}
/* 万流归宗（神圣）：护盾／护甲／连击三条线各数几档（各最多 CONF_TIERS 档），
   档数加起来 —— 打人那边每档 +CONF_PCT% 伤害（answer()），挨打那边每档 −CONF_CUT%（mitigate()）。*/
function confTiers(s0){
  if(!hasRelic("confluence")) return 0;
  const s = s0 || stats();
  return Math.min(CONF_TIERS, Math.floor((P.shield || 0) / CONF_SH_PER)) +
         Math.min(CONF_TIERS, Math.floor((s.defGear || 0) / CONF_AR_PER)) +
         Math.min(CONF_TIERS, Math.floor((P.combo || 0) / CONF_CB_PER));
}
function mitigate(dmg, s0, opt){
  const s = s0 || stats();
  let out = dmg, why = "";
  const wrong = !!(opt && opt.wrong);        // 这一下是不是「答错」挨的（超时不算）
  /* 减伤百分比这一档**先全部相加再乘一次**（软甲 10 + 皮甲 5 = 15%）——
     跟伤害那边「只有一个百分比乘区」是同一条规矩，玩家要能心算。*/
  /* 常驻那一档（软甲／皮甲／脱壳／老茧／不动／深潜／镇压的全局档 + 第九批的五件）
     统一从 cutStatic() 起算 —— 「苦胆」「双面」「恒甲」要读同一个数，口径只能有一个。*/
  let cut = cutState(s, wrong);      // 常驻 + 看血量/护甲/护盾 + 答错都有的几件（信息页同一个口径）
  /* 粗布 2026-09-21 从「每场一次减半」改成「**每层**一次 −BURLAP_CUT%」，并挪进 cut 桶 ——
     一层 11.5 场却只答错 6 次，「每场一次」等于近八成的答错都被砍半，
     一件**普通**品质比传奇「不动」还强，是全表最大的一处定价事故。*/
  if(wrong && hasRelic("burlap") && !G.burlapUsed){ G.burlapUsed = true; cut += BURLAP_CUT; }
  // 镇压：只挡 Boss 那一口（全局那一档在 cutStatic() 里；Boss 层的容错只有 3 下出头）
  if(hasRelic("quell") && B && B.mob && B.mob.boss) cut += QUELL_CUT;
  /* 稳答／慎笔：按题型分——mitigate() 只有两个调用点（timeUp() 不传 wrong，answer() 的答错分支传
     {wrong:true}），所以这里的 wrong 已经排除了超时；题型看 B.q.type（此时题目还没被清掉）。*/
  if(wrong && hasRelic("calm") && B && B.q && B.q.type !== "spell") cut += CALM_CUT;
  // 心镜 2026-09-21 从「完全免伤」改成减伤（原来一层能免掉 2.4 次挨打，稀有档超标三倍）
  if(wrong && hasRelic("psyche") && opt && opt.haunted) cut += PSYCHE_CUT;
  // 缓冲：!wrong 就是超时那条路（唯二两个调用点之一），跟沙漏是两条路——沙漏会在 timeUp() 里提前返回
  if(!wrong && hasRelic("buffer")) cut += BUFFER_CUT;
  // 记仇：连续挨你打到第 GRUDGE_AT 刀起——m.hitsLanded 在 answer() 答对分支里累加，只属于这一只怪
  if(wrong && hasRelic("grudge") && B && B.mob && (B.mob.hitsLanded || 0) >= GRUDGE_AT) cut += GRUDGE_CUT;
  // 面熟：这一层同类别的怪见过几只——G.catSeen 在 startBattle() 里累，nextFloor() 清零
  if(wrong && hasRelic("familiar") && B && B.mob && G.catSeen){
    const n = G.catSeen[B.mob.cat] || 0;
    if(n >= 2) cut += Math.min(FAMILIAR_MAX, (n - 1) * FAMILIAR_STEP);
  }
  // 二见：同一个词连续第二次答错——由 answer() 通过 opt.repeatWord 告诉这里（rec.wrong 是答题函数本地变量）
  if(wrong && hasRelic("twice") && opt && opt.repeatWord) cut += TWICE_CUT;
  // 缓坠：这一层第一次跌破半血的那一下——用这一下"挨完之后会不会跌破半血"当判定，每层限一次
  if(wrong && hasRelic("brace") && !G.braceUsed && P.hp >= s.maxHp / 2 && (P.hp - out) < s.maxHp / 2){
    cut += BRACE_CUT;
    G.braceUsed = true;
  }
  /* 残壁：血下 10% 触发、回到 50% 以上才解除，中间这段窗口一直有效（有滞回，只用一个布尔位）。
     状态每次挨打前都会按当前血量刷新一遍，不用另外找地方挂钩子。*/
  if(hasRelic("rampart")){
    if(P.hp <= s.maxHp * 0.10) P.rampartOn = true;
    else if(P.hp >= s.maxHp * 0.50) P.rampartOn = false;
    if(wrong && P.rampartOn) cut += RAMPART_CUT;
  }
  /* ⚠️ 这一步**向下取整**（玩家占便宜）：向上取整的话 5% 在小数字上等于没有 ——
     早期怪只打 5~6 点，ceil(6×0.95)=6，皮甲就成了一件骗人的遗物。最低仍然掉 1 点（下面兜）。*/
  /* 减伤总和封顶（`MIT_CUT_MAX`）—— 不封的话堆七八件就是「每次只掉 1 点」，那是练习模式不是构筑。
     ⚠️ 先乘后除，**别写成 `out * (1 - cut/100)`** —— 那样 55% 会算成
     `1 - 0.55 = 0.44999999999999996`，floor 之后白多掉 1 点（实测 100 点打成 44 而不是 45）。*/
  if(cut > MIT_CUT_MAX) cut = MIT_CUT_MAX;
  if(cut) out = Math.floor(out * (100 - cut) / 100);
  if(hasRelic("hold") && (G.holdUsed || 0) < HOLD_FREE){                  // 屏息：每层前两次减半
    G.holdUsed = (G.holdUsed || 0) + 1;
    out = Math.max(1, Math.ceil(out / 2));
    why += T(" <span class=\"sys\">(屏息卸掉一半，这一层还剩 ") + (HOLD_FREE - G.holdUsed) + T(" 次)</span>");
  }
  /* 卸力（第十一批）：每场第一次**真的要掉血**的那一下减半，每层最多 DEFLECT_N 次。
     跟屏息 / 余温各减各的（同一下能被减两次半）。B.deflectUsed 跟着 B 一场一清。*/
  if(hasRelic("deflect") && B && !B.deflectUsed && (G.deflectN || 0) < DEFLECT_N){
    B.deflectUsed = true;
    G.deflectN = (G.deflectN || 0) + 1;
    out = Math.max(1, Math.ceil(out / 2));
    why += T(" <span class=\"sys\">(卸力卸掉一半，这一层还剩 ") + (DEFLECT_N - G.deflectN) + T(" 次)</span>");
  }
  /* 余温：不灭薪火触发之后才有 P.warmthLeft（在 deathSave() 里发），接下来这几次答错单独再减半，
     不占粗布/屏息的名额——放在它们后面，是"薪火给的额外缓冲"，不是替代它们。*/
  /* 余温 2026-09-21 补了自带触发源：每层第一次跌破半血也发一轮 ——
     原来只认「不灭薪火」，而薪火是一件掉不出来的神圣，单带余温永远触发不了。*/
  if(hasRelic("warmth") && !G.warmthUsed && P.hp <= s.maxHp / 2){
    G.warmthUsed = true;
    P.warmthLeft = Math.max(P.warmthLeft || 0, WARMTH_HITS);
  }
  if(wrong && hasRelic("warmth") && (P.warmthLeft || 0) > 0){
    P.warmthLeft--;
    out = Math.max(1, Math.ceil(out / 2));
    why += T(" <span class=\"sys\">(余温还护着你，减半，剩 ") + P.warmthLeft + T(" 次)</span>");
  }
  /* 钝痛 10% / 石胎 5%：两件都是「单次封顶」，一起带就按**低的那个**算，不叠乘 */
  let capPct = 0;
  if(hasRelic("blunt")) capPct = BLUNT_PCT;
  if(hasRelic("womb")) capPct = capPct ? Math.min(capPct, WOMB_PCT) : WOMB_PCT;
  if(capPct){
    const byWomb = capPct === WOMB_PCT;
    /* 无尽深处封顶线跟着一半的深渊压迫往上抬（方案 B，capRamp()）—— 不抬的话它是全游戏唯一越深越强的东西 */
    const cap = Math.max(1, Math.ceil(s.maxHp * capPct * capRamp()));
    if(out > cap){
      out = cap;
      why += " <span class=\"sys\">(" + (byWomb ? T("石胎") : T("钝痛")) + T("把这一下压到 ") + cap + T(" 点)</span>");
    }
  }
  /* 尚存：单次伤害超过生命上限 ENDURE_PCT 就砍半，放在所有其它减伤算完之后判 ——
     算到最后才比，是为了拿"你真正要挨的那个数"去对门槛。
     ⚠️ 2026-09 用户把「整趟一次」的限制去掉了，现在每一记重击都吃得到。*/
  if(hasRelic("endure") && out > s.maxHp * ENDURE_PCT){
    out = Math.max(1, Math.floor(out * (100 - ENDURE_CUT) / 100));
    why += T(" <span class=\"sys\">(尚存削掉了这记重击的 ") + ENDURE_CUT + "%)</span>";
  }
  out = Math.max(1, out);
  if(hasRelic("slip") && luck(SLIP_RATE)) return {dmg:0, dodged:true, why:"", by:"slip"};   // 错身
  if(hasRelic("glimmer") && luck(GLIMMER_RATE)) return {dmg:0, dodged:true, why:"", by:"glimmer"};   // 浮光：各掷各的
  return {dmg:out, dodged:false, why:why};
}
/* ---- 挨一下：先扣护盾、剩下的才扣血，跳数字，返回写进 verdict 的那句话 ----
   ⚠️ **所有真的要掉血的路都必须从这儿过**（答错、超时、补救失败结清），
   护盾才不会被某一条路绕过去。
   ⚠️ 不走这儿的两处是**故意**的：撤退（那是掉一半上限，不是挨打，由「脱壳」管）
   和「割裂」的自伤（自己割的，盾挡不住）。 */
function takeHit(dmg, m, haunted){
  let left = dmg, ate = 0;
  const hadShield = (P.shield || 0) > 0;
  if((P.shield || 0) > 0){
    ate = Math.min(P.shield, left);
    P.shield -= ate;
    left -= ate;
  }
  if(left > 0){
    P.hp -= left;
    P.killStreak = 0;         // 连杀线（第十批）：真的掉了血就从头数（护盾全吃掉的那种不算）
    G.tookDamage = true;      // 叠甲：这一层不干净了，nextFloor() 里按它算连续记录
    // 反震：**真的掉了血**才攒（护盾全吃掉的那种不算）
    if(hasRelic("recoil")) P.recoil = Math.min(RECOIL_MAX, (P.recoil || 0) + 1);
  }
  // 蚀甲：每次挨打（不管盾扛没扛住）把攒下的额外护甲扣掉 CORRODE_LOSS 点，最低 0
  if(hasRelic("corrode")) G.corrodeArmor = Math.max(0, (G.corrodeArmor || 0) - CORRODE_LOSS);
  // 护盾从"有"变成"没有"的那一下（真的被打穿，不是本来就没盾）：借甲 / 破盾余威 / 久经 都挂在这个事件上
  const brokeNow = hadShield && (P.shield || 0) <= 0;
  if(brokeNow){
    P.shieldBrokenCount = (P.shieldBrokenCount || 0) + 1;    // 久经：累计次数，stats() 里按门槛判
    if(hasRelic("borrow") && !G.borrowUsed){                 // 借甲：每层一次，白送一批新盾
      G.borrowUsed = true;
      // 2026-09-21：加了 BORROW_SHIELD 保底 —— 裸装护甲是 0，原来这一笔恒为 0
      const gain = Math.max(BORROW_SHIELD, Math.round((stats().defGear || 0) * BORROW_MULT));
      if(gain > 0){ P.shield = gain; say(T("借甲趁护盾破的那一下，立刻又撑起 <b>") + gain + T("</b> 点。"), "good"); }
    }
    if(hasRelic("shatter") && B && !B.shatterUsed){          // 破盾余威：这场一次，免下一下答错伤害
      B.shatterUsed = true;
      B.shatterFree = true;
      say(T("破盾余威 —— 下一次失手会被它接住。"), "sys");
    }
  }
  /* 圆满（神圣，第十批）：每层一次 —— 血被打到 WHOLE_AT 以下就立刻拉回 WHOLE_TO。
     ⚠️ 挂在这儿（掉血的唯一入口）而不是 deathSave()：它是「别让高血流被一口咬穿」，
     不是第三道致死保险。血真的归零那一下交给 deathSave()，两者不冲突。*/
  if(hasRelic("whole") && !G.wholeUsed && P.hp > 0){
    const sw = stats();
    if(P.hp < sw.maxHp * WHOLE_AT){
      G.wholeUsed = true;
      const back = Math.max(1, Math.ceil(sw.maxHp * WHOLE_TO) - P.hp);
      const rw = healUp(back, sw);
      say(T("圆满 —— 裂口自己合上了，回 <b>") + rw.hp + T("</b> 点生命（这一层就这一次）。"), "good");
    }
  }
  floatNum("me", "-" + dmg, "ouch");
  return m.name + T(" 咬中你，") +
    (ate ? (T("护盾吃掉 <b>") + ate + T("</b> 点") + (left ? T("，你失去 <b>") + left + T("</b> 点生命") : T("，血一点没掉")) + "")
         : (T("你失去 <b>") + left + T("</b> 点生命"))) +
    (haunted ? T("（心魔加重）") : "") + T("。");
}
function finishBattle(win){
  const m = B.mob;
  clearQTimer();
  if(!win){
    B = null;
    $("veilBattle").hidden = true;
    /* 联机第二期：血掉光不出局，是「倒地」——两人同时倒下才算这趟结束（联机方案.md）。 */
    if(COOP){ coopGoDown(); return; }
    gameOver();
    return;
  }
  /* 怪一倒就直接收：不再弹「XX 倒下了」那一屏，也不用点「收取战利品」。
     answer() 那边已经留了看清最后一题释义的时间，这里立刻关窗结算。
     B.won 是闸 —— 万一窗已经被别的流程关了（比如通关结算），别再收一次。 */
  B.won = true;
  $("btnNextQ").hidden = true;
  $("btnFlee").hidden = true;
  renderBattleBars();
  closeBattleWin();
}
function closeBattleWin(){
  const m = B.mob;
  const xpx = B.xpx || 1;            // 本场拼对过就是 2 倍（B 马上要清掉，先取出来）
  B = null;
  $("veilBattle").hidden = true;
  const i = G.mobs.indexOf(m);
  if(i >= 0) G.mobs.splice(i,1);
  P.kills++;
  P.killStreak = (P.killStreak || 0) + 1;   // 连杀线（第十批）：掉血在 takeHit() 里清零
  const xp = gainXp(m.xp * xpx);     // 求知的 +20% 在 gainXp 里加，日志写实际到手的
  // Boss 房一整层就它一只，身上压着一层份的金币（m.loot，makeBossFoe 里定的）
  const g = Math.round((ri(2,5) + G.floor + (m.loot || 0)) * (hasRelic("greed") ? 1.2 : 1));   // 拾荒者 +20%
  P.gold += g;
  fxKill(m.x, m.y);                  // 金币和经验各飞一串碎屑
  const s0 = stats();
  let heal = CHAPTER.killHeal;
  if(hasRelic("reap")) heal += REAP_HEAL;
  // 药膏（用户 2026-09 提到稀有）：75% 概率回 4 点，不是每次都给
  if(hasRelic("salve") && luck(SALVE_RATE)) heal += SALVE_HEAL;
  if(hasRelic("breath")) heal += Math.max(1, Math.ceil(s0.maxHp * BREATH_PCT));  // 喘息：每打倒一只
  if(hasRelic("mend")) heal += Math.max(1, Math.ceil(s0.maxHp * MEND_PCT));      // 归血：收割的百分比版
  if(hasRelic("reapfull")) heal += Math.max(1, Math.ceil(s0.maxHp * REAPF_PCT)); // 收势：收割的百分比版（第十批）
  const got = healUp(heal, s0);                                           // 泉涌要收溢出，所以走 healUp
  if(hasRelic("disarm")) P.shield = (P.shield || 0) + Math.max(1, Math.round(s0.maxHp * DISARM_PCT));   // 缴械（第十一批）
  const gained = got.hp;
  say(m.name + T(" 化成了灰。<span class=\"sys\">(+") + xp + " EXP" + (xpx > 1 ? " ×" + xpx : "") +
      T("，+") + g + T(" 金") +
      (gained > 0 ? T("，回复 ") + gained + T(" 生命") : "") + ")</span>", "good");
  if(G.mobs.length === 0){
    /* 阶梯直接开在最后一只怪倒下的地方 —— 不用再满地图找那个 ▼。
       怪站的一定是地板，所以这个位置永远合法。 */
    G.stair = {x:m.x, y:m.y};
    G.seen[m.y][m.x] = true;
    say(T("这一层清空了。") + m.name + T(" 倒下的地方裂开了 —— 阶梯 ▼ 就在那儿。"), "crit");
    coopUnlockMove();     // 联机：怪清完了，移动锁解除（联机方案.md）
    spawnGild();          // 无尽章 50 层往下的 Boss 房：阶梯旁边立起金坛
    if(hasRelic("finale")){                       // 收尾：清完一层回 FINALE_PCT 的上限
      const back = Math.max(1, Math.ceil(stats().maxHp * FINALE_PCT));
      const r = healUp(back);
      if(r.hp || r.sh) say(T("这一层干净了 —— 收尾替你补了 <b>") + r.hp + T("</b> 点生命") +
        (r.sh ? T("，溢出的化成 <b>") + r.sh + T("</b> 点护盾") : "") + T("。"), "good");
    }
    if(hasRelic("welfare")){                       // 均富：清空这一层再单独发一笔
      const wg = G.floor * 2;
      P.gold += wg;
      say(T("均富 —— 这一层清空了，回廊分给你 <b>") + wg + T("</b> 金。"), "good");
    }
  }
  fov();
  // 普通怪不再掉东西（金币已经给过了）；遗物统一由清层/房间给
  G.paused = false;
  lockInput(260);        // 战斗窗是自动关的，挡一下手里还没停的那一点
  render();
  if(P.tut) tutEvent(G.mobs.length ? "kill" : "clear");
  maybeRelic();
}
/* 撤退**要付一半的最大生命**（用户 2026-09，以前是白撤）：转身那一下露空门。
   最低留 1 点 —— 撤退不会把人撤死，但撤完基本只能去找泉水。
   怪身上掉的血照旧留着，回头还能接着打。*/
function flee(){
  if(COOP) return;    // 联机里禁用撤退（联机方案.md）：碰上了就必须打完，按钮在 startBattle() 里就藏掉了
  if(!B || B.locked) return;
  autoOff();          // 主动撤退就是「我不想打这只」，别让自动寻路扭头又走回去
  clearQTimer();
  const m = B.mob, s = stats();
  // 脱壳：每层第一次撤退不付那半条命
  const free = hasRelic("shed") && !G.fleeFree;
  if(free) G.fleeFree = true;
  const before = P.hp;
  if(!free) P.hp = Math.max(1, P.hp - Math.max(1, Math.round(s.maxHp * FLEE_HP_PCT)));
  const lost = before - P.hp;
  B = null;
  $("veilBattle").hidden = true;
  G.paused = false;
  say(free
      ? (T("你把壳留在原地，人退了出来 —— 这一层的第一次撤退不掉血。") + m.name + T(" 伤口还在。"))
      : (T("你转身退开 —— 空门露了一下，失去 <b>") + lost + T("</b> 点生命。") +
         m.name + T(" 留在原地，伤口还在。")), "hurt");
  lockInput(260);
  renderHud();
  render();
}
/* 返回**实际到手**的经验（求知加成之后），调用方拿它去写日志 */
function gainXp(n){
  if(hasRelic("study")) n = Math.round(n * STUDY_MULT);  // 求知
  P.xp += n;
  while(P.xp >= xpNeed(P.lvl)){
    P.xp -= xpNeed(P.lvl);
    P.lvl++;
    /* 烙印/铭心按当前等级在 stats() 里现算，这儿不再攒 P.bonusAtk / P.bonusHp
       （那是永久面板加成，卖掉遗物也不还 —— 2026-09 已经改掉）。
       铭心涨的是上限，按老规矩当前血也跟着补上。*/
    if(hasRelic("engrave") && P.lvl * 3 <= ENGRAVE_MAX) P.hp += 3;   // 封顶之后不再补（见 stats()）
    const s = stats();
    healUp(CHAPTER.levelHeal, s);
    /* ===== 第十批「升级那一刻」的四件（2026-09-21）=====
       ⚠️ 频率是**每层约 1.8 次**（31 层升到 56 级），比「每层一次」还密，估价别按每层一次算。*/
    if(hasRelic("sprout")) healUp(Math.max(1, Math.ceil(s.maxHp * SPROUT_PCT)), s);   // 拔节
    if(hasRelic("satori")) P.shield = (P.shield || 0) + SATORI_SHIELD;                // 开悟
    if(hasRelic("keenrise")) P.riseLeft = RISE_Q;                                     // 锐进：开一扇 5 题的窗
    if(hasRelic("ascend") && G){                                                      // 拾级：本层护甲 + 回血
      G.stepArmor = Math.min(ASCEND_MAX, (G.stepArmor || 0) + ASCEND_ARMOR);
      healUp(Math.max(1, Math.ceil(s.maxHp * ASCEND_HEAL)), s);
    }
    fxLevelUp();
    say(T("<b>等级提升！</b>你现在是 ") + P.lvl + T(" 级 —— 攻击 ") + s.atk + T("，生命上限 ") + s.maxHp + T("。"), "good");
  }
  return n;
}

/* ================= 房间：祭坛 / 上锁宝箱 / 游商 =================
   都挂在 G.things 上，靠 kind 分支。进格子时 onEnter 弹窗，处理完 G.paused 放开。 */
var ALTAR_COST = 5;
/* 祭坛要付多少血 —— 「祭余」把它砍到 1 点。判断、扣血、文案都走这一个口 */
function altarCost(){ return hasRelic("spare") ? 1 : ALTAR_COST; }
/* 还愿：护盾优先抵祭坛的代价，护盾不够才扣血。"付不付得起"和"真的怎么扣"都要走它，
   两处算法不一致会出现"按钮显示能割，点了却因为血不够被拒"的错配。*/
function altarAfford(){
  const cost = altarCost();
  if(!hasRelic("atone")) return P.hp > cost;
  const fromShield = Math.min(P.shield || 0, cost);
  return P.hp > cost - fromShield;
}

/* ---- 泉水：踩上去先问一句，不喝就留在原地，回头还能来 ----
   用户 2026-09 从「回满血」改成**回复最大生命的 CHAPTER.springPct**（向上取整、最少 1 点）。*/
function springHeal(s){ return Math.max(1, Math.ceil((s || stats()).maxHp * CHAPTER.springPct)); }
/* 「水」：一进这一层就把地上的泉全喝了，**溢出的按 SPILL_RATE 换护盾**
   （不管有没有「泉涌」—— 这是它自己那条词条，所以 healUp 传 force）。
   ⚠️ 必须在 genFloor() 之后调，那时候泉才摆上去。 */
function drinkAll(){
  const springs = G.things.filter(function(th){ return th.kind === "feat"; });
  if(!springs.length) return;
  P.everDrankSpring = true;   // 苦行看的就是这个——「水」自己会把这一层的泉喝光，两件天生互斥
  const s = stats();
  let hp = 0, sh = 0;
  springs.forEach(function(th){
    const r = healUp(springHeal(s), s, true);
    hp += r.hp; sh += r.sh;
    removeThing(th);
  });
  say(T("你把这一层的泉水全喝了 —— 回复 <b>") + hp + T("</b> 点生命") +
      (sh ? T("，溢出的化成 <b>") + sh + T("</b> 点护盾") : "") + T("。"), "good");
}
function openSpring(th){
  G.paused = true;
  pendingRoom = th;
  const s = stats(), room = s.maxHp - P.hp, full = springHeal(s);
  const heal = Math.min(room, full);
  /* 「泉涌」把喝不下的那部分变成护盾 —— 所以满血时它也值得喝，按钮不能再禁掉 */
  const spill = hasRelic("well") ? Math.floor(Math.max(0, full - room) / SPILL_RATE) : 0;
  $("springLedger").innerHTML =
    li(T("你现在"), P.hp + " / " + s.maxHp + ((P.shield || 0) ? T("　盾 ") + P.shield : "")) +
    li(T("喝下去"), (heal > 0 ? T("回复 ") + heal + T(" 点（上限的 ") + Math.round(CHAPTER.springPct * 100) + T("%）") : T("你已经是满的了")) +
                (spill > 0 ? T("，溢出的化成 ") + spill + T(" 点护盾") : ""));
  $("btnSpringDrink").disabled = room <= 0 && spill <= 0;
  $("btnSpringDrink").textContent = (room > 0 || spill > 0) ? T("掬一捧喝下") : T("喝不下了");
  $("springNote").textContent = (room > 0 || spill > 0)
    ? T("这口泉只够喝一次 —— 喝完它就干了。不想现在喝，它会留在原地等你。")
    : T("满血的时候喝它是浪费。留着，等真需要的时候回来。");
  hideAll();
  $("veilSpring").hidden = false;
  ($("btnSpringDrink").disabled ? $("btnSpringSkip") : $("btnSpringDrink")).focus();
}
function resolveSpring(drink){
  const th = pendingRoom; pendingRoom = null;
  $("veilSpring").hidden = true;
  G.paused = false;
  if(drink && th){
    P.everDrankSpring = true;   // 苦行：这一趟喝过泉了，减伤那条线从此不再吃它
    const s = stats(), r = healUp(springHeal(s), s);       // 泉涌：喝不下的那部分变护盾
    const got = r.hp;
    if(got) floatNum("me", "+" + got, "heal");
    say(T("你掬起一捧泉水 —— 回复了 <b>") + got + T("</b> 点生命（") + P.hp + " / " + s.maxHp + T("）") +
        (r.sh ? T("，溢出的化成 <b>") + r.sh + T("</b> 点护盾") : "") + T("。"), "good");
    removeThing(th);
  } else {
    say(T("泉水留在原地，还冒着气泡。"), "sys");
  }
  lockInput(200);
  renderHud(); render();
}

/* 石台有两副面孔（用户 2026-09）：
   寻常的血祭坛（献 5 点血换一件遗物），和 ALTAR_FORGE_RATE 概率的**熔炉** ——
   献祭身上的一件遗物，三分之一升一档、三分之一同档换一件、三分之一降一档。
   ⚠️ 是哪一种**第一次踩上去就定死、记在物件上**（th.forge，跟着续玩档走），
      走开再回来还是同一个 —— 不然玩家可以反复踩着刷。
   身上一件遗物都没有时熔炉没东西可吃，退回成寻常祭坛。*/
function openAltar(th){
  // 第 ALTAR_FORGE_FROM 层之后熔炉概率抬到 80%（用户 2026-09）——深层缺的是「换掉烂件」的机会
  if(th.forge == null){
    const rate = G.floor > ALTAR_FORGE_FROM ? ALTAR_FORGE_DEEP : ALTAR_FORGE_RATE;
    th.forge = Math.random() < rate;
  }
  if(th.forge && P.relics && P.relics.length){ openForge(th); return; }
  G.paused = true;
  pendingRoom = th;
  const s = stats();
  const cost = altarCost(), enough = altarAfford();
  $("altarCost").innerHTML =
    li(T("代价"), cost + T(" 点生命（你现在 ") + P.hp + " / " + s.maxHp + T("）")) +
    li(T("回报"), T("一件遗物"));
  $("btnAltarPay").disabled = !enough;
  $("btnAltarPay").textContent = enough ? T("割一刀") : T("血不够");
  hideAll();
  $("veilAltar").hidden = false;
}
function resolveAltar(pay){
  const th = pendingRoom; pendingRoom = null;
  $("veilAltar").hidden = true;
  G.paused = false;
  const cost = altarCost();
  if(pay && altarAfford()){
    if(hasRelic("atone") && (P.shield || 0) > 0){
      const fromShield = Math.min(P.shield, cost);
      P.shield -= fromShield;
      const fromHp = cost - fromShield;
      if(fromHp > 0){ P.hp -= fromHp; floatNum("me", "-" + fromHp, "ouch"); }
      if(fromShield > 0) say(T("还愿先耗掉了 <b>") + fromShield + T("</b> 点护盾抵代价。"), "sys");
    } else {
      P.hp -= cost;
      floatNum("me", "-" + cost, "ouch");
    }
    removeThing(th);
    say(T("你把手按在浅槽上。石台吸干了那一点血。"), "hurt");
    grantRelic(rollRelic(), T("石台吐出了"));
    lockInput(200);
    renderHud(); render();
    return;
  }
  say(T("你收回手，绕开了石台。"), "sys");
  lockInput(200);
  renderHud(); render();
}

/* ---- 金坛（无尽章，用户 2026-09-25）----
   无尽章第 ENDLESS_FROM 层**往下**的每一间 Boss 房（60 / 70 / 80 …），守者倒下之后阶梯旁边立起一座金坛：
   投金币换一项随机的属性加成，**本局一直有效**（记在 P.gild 上，不是遗物 —— 卖不掉、换不掉，也不占格子）。
   价格按这一趟投过几次（P.gildN）翻倍，加成按同一个次数 ×GILD_GROW 往上涨（数值表在 content.js 的 GILD_STATS）。
   一座坛能连着投，钱够就行；走开再回来还能接着投，下一层它就没了。
   ⚠️ 它不写进续玩档：存档点是「刚踏进这一层」，那时候守者还站着、坛还没立起来 —— 读档重打一遍就又有了。*/
var gildLast = null;           // 刚投中的那一项（窗里那一行亮一下），纯界面状态
function gildOn(){ return !!(G && isEndless() && isBossFloor(G.floor) && G.floor > ENDLESS_FROM); }
function gildGet(k){ return (P && P.gild && P.gild[k]) || 0; }
function gildCost(){ return Math.round(GILD_COST0 * Math.pow(GILD_COST_X, P.gildN || 0)); }
/* 第 (n+1) 次献祭那一档的数值（n = 已经投过几次）*/
function gildAmt(st, n){ return Math.max(1, Math.round(st.base * Math.pow(GILD_GROW, n))); }
function gildVal(st, v){ return (st.neg ? "−" : "+") + v + (st.pc ? "%" : ""); }
function gildText(st, v){ return T(st.n) + " " + gildVal(st, v); }
/* 守者倒下、这一层清空的那一下调（单人 closeBattleWin / 联机 coopHandleDead 两处）。
   摆在阶梯的四邻里：上 → 下 → 左 → 右，跳过人站的那一格。*/
function spawnGild(){
  if(!gildOn() || !P || P.tut || !G.stair) return;
  if(G.things.some(function(th){ return th.kind === "gild"; })) return;
  const dirs = [[0,-1], [0,1], [-1,0], [1,0]];
  for(let i=0;i<dirs.length;i++){
    const nx = G.stair.x + dirs[i][0], ny = G.stair.y + dirs[i][1];
    if(nx < 0 || ny < 0 || nx >= W || ny >= H || !G.map[ny][nx]) continue;
    if((nx === P.x && ny === P.y) || mobAt(nx, ny) || thingAt(nx, ny)) continue;
    G.things.push({x:nx, y:ny, kind:"gild"});
    say(T("阶梯旁边升起一座<b>金坛</b> —— 投进金币，换一项本局有效的属性加成。"), "crit");
    return;
  }
}
function openGild(th){
  G.paused = true;
  pendingRoom = th;
  gildLast = null;
  renderGild();
  hideAll();
  $("veilGild").hidden = false;
}
function renderGild(){
  const n = P.gildN || 0, cost = gildCost(), enough = (P.gold || 0) >= cost;
  $("gildLedger").innerHTML =
    li(T("你有"), (P.gold || 0) + T(" 金")) +
    li(T("这一次"), cost + T(" 金") + L("（第 " + (n + 1) + " 次）", " (offering #" + (n + 1) + ")"));
  let h = "<span class=\"gh\"></span><span class=\"gh\">" + T("这一次") + "</span><span class=\"gh\">" + T("已得到") + "</span>";
  GILD_STATS.forEach(function(st){
    const have = gildGet(st.id), on = gildLast === st.id ? " got" : "";
    h += "<span class=\"gn" + on + "\">" + T(st.n) + "</span>" +
         "<span class=\"gv" + on + "\">" + gildVal(st, gildAmt(st, n)) + "</span>" +
         "<span class=\"gv" + on + "\">" + (have ? gildVal(st, have) : "—") + "</span>";
  });
  $("gildTable").innerHTML = h;
  const b = $("btnGildPay");
  b.disabled = !enough;
  b.textContent = enough ? L("投入 " + cost + " 金", "Offer " + cost + " gold") : T("金币不够");
}
function payGild(){
  const th = pendingRoom;
  if(!th || th.kind !== "gild") return;
  const cost = gildCost();
  if((P.gold || 0) < cost) return;
  P.gold -= cost;
  P.spent = (P.spent || 0) + cost;              // 散财：投进坛里的也算花出去了
  const st = pick(GILD_STATS), v = gildAmt(st, P.gildN || 0);
  withMaxHp(function(){ P.gild[st.id] = (P.gild[st.id] || 0) + v; });   // 生命上限涨了，当前血跟着补
  P.gildN = (P.gildN || 0) + 1;
  gildLast = st.id;
  say(T("金坛吞下了 <b>") + cost + T("</b> 金 —— <b>") + gildText(st, v) + T("</b>（本局有效）。"), "crit");
  toast(gildText(st, v));
  renderGild();
  renderHud();
}
function closeGild(){
  pendingRoom = null;
  $("veilGild").hidden = true;
  G.paused = false;
  const th = thingAt(P.x, P.y);
  if(th && th.kind === "gild") stepAside();     // 跟游商一样退开一格，想再投就再踩上去
  say(T("金坛还立在阶梯旁边。这一层走之前，随时能回来再投。"), "sys");
  lockInput(200);
  renderHud(); render();
}

/* ---- 熔炉：献祭一件遗物，升一档 / 同档换一件 / 降一档，各三分之一 ---- */
function openForge(th){
  G.paused = true;
  pendingRoom = th;
  const box = $("forgeList");
  box.innerHTML = "";
  P.relics.forEach(function(id){
    const r = relicById(id);
    if(!r) return;
    const d = document.createElement("button");
    d.type = "button"; d.className = "relic"; d.dataset.id = id;
    d.innerHTML = "<span class=\"rt q" + (r.r||0) + "\">" + RAR_CN[r.r||0] + "</span>" +
                  "<span class=\"rn q" + (r.r||0) + "\">" + r.n + "</span>" +
                  "<span class=\"rp\">" + r.pw + "</span>" +
                  T("<span class=\"rl\">点它 → 扔进炉子</span>");
    box.appendChild(d);
  });
  hideAll();
  $("veilForge").hidden = false;
}
/* 献祭一件。掷一次：1 升一档 / 2 同档 / 3 降一档。
   那一档已经没有还没拿过的遗物了，就按 想要的 → 原档 → 更高 → 更低 的顺序找个有货的档；
   全都没货（遗物快被拿光了）才折成金币。*/
function forgePick(id){
  const th = pendingRoom; pendingRoom = null;
  $("veilForge").hidden = true;
  G.paused = false;
  const old = relicById(id), at = P.relics.indexOf(id);
  if(!old || at < 0){ lockInput(200); render(); return; }
  removeThing(th);                                   // 炉子用过就没了
  const roll = ri(1, 3);
  const want = Math.max(0, Math.min(4, (old.r || 0) + (roll === 1 ? 1 : roll === 3 ? -1 : 0)));
  const pool = relicPool().filter(function(x){ return x.id !== id; });
  let got = null;
  [want, (old.r || 0), want + 1, want - 1, 0, 1, 2, 3, 4].forEach(function(t){
    if(got || t < 0 || t > 4) return;
    const hit = pool.filter(function(x){ return (x.r || 0) === t; });
    if(hit.length) got = blessPick(hit);
  });
  clearNewRelic(id);
  if(!got){
    const g = sellRelicGold(old);
    withMaxHp(function(){ P.relics.splice(P.relics.indexOf(id), 1); });
    P.gold += g;
    say(T("炉火吞了 ") + rc(old) + T("，什么也没吐出来 —— 只剩 <b>") + g + T("</b> 金币。"), "sys");
  } else {
    withMaxHp(function(){
      P.relics.splice(P.relics.indexOf(id), 1);
      P.relics.push(got.id);
    });
    noteRelicFound(got, T("炉子吐出了"));
    const up = (got.r || 0) - (old.r || 0);
    say(T("你把 ") + rc(old) + T(" 扔进炉子 —— ") +
        (up > 0 ? T("火苗窜起来，它<b>升了一档</b>") : up < 0 ? T("火舌卷下去，它<b>降了一档</b>") : T("形状变了，还是同一档")) +
        T("：") + rc(got) + " —— " + got.pw + T("。"), up < 0 ? "hurt" : "crit");
  }
  lockInput(200);
  renderHud(); render();
}
function closeForge(){
  const th = pendingRoom; pendingRoom = null;
  $("veilForge").hidden = true;
  G.paused = false;
  say(T("炉膛里的火还亮着。你什么也没扔进去。"), "sys");
  lockInput(200);
  renderHud(); render();
}

/* ---- 上锁宝箱：拼对开箱，拼错锁死 ---- */
function openChest(th){
  G.paused = true;
  pendingRoom = th;
  const word = pickQuizWord("all");
  chestQ = {word:word, spell:"", done:false, slots:slotNew(spellOf(word).length)};
  $("chestTitle").textContent = T("锁上刻着一个词");
  $("chestHint").textContent = T("拼出「") + word.cn + T("」");
  $("chestClue").innerHTML = word.cn + hintTag(word);
  $("chestVerdict").innerHTML = "";
  $("btnChestDone").hidden = true;
  $("btnChestLeave").hidden = false;
  drawChestSpell();
  buildChestLetters(word);
  hideAll();
  $("veilChest").hidden = false;
}
function drawChestSpell(){
  const row = $("chestRow"), en = spellOf(chestQ.word);
  row.className = "spellrow" + (LEARN_CJK ? " zh" : "") + (LEARN_JA && en.length >= 7 ? " long" : "");
  slotDraw(row, chestQ.slots, function(i){
    if(!chestQ || chestQ.done || !slotTake(chestQ.slots, i)) return;
    chestStep();
  });
}
/* 宝箱拼写走一步：跟战斗里的 spellStep() 一个路子（字格规矩见 slotNew 那一段） */
function chestStep(){
  chestQ.spell = slotWord(chestQ.slots);
  drawChestSpell();
  if(slotFull(chestQ.slots)){
    chestQ.slots.done = true;
    setTimeout(function(){ judgeChest(); }, 180);
  }
}
function buildChestLetters(word){
  const box = $("chestLetters");
  box.innerHTML = "";
  const target = spellOf(word);
  const pool = target.split("");
  const extra = "abcdefghijklmnopqrstuvwxyz".split("");
  if(LEARN_ZH) Array.prototype.push.apply(pool, decoyChars(word, 4));
  else if(LEARN_JA) Array.prototype.push.apply(pool, jaDecoys(word, Math.max(3, Math.min(12, target.length + 4) - target.length)));
  else if(LANG_LEARN === "es") Array.prototype.push.apply(pool, esDecoys(word, Math.max(2, Math.min(12, word.en.length + 4) - word.en.length)));
  else while(pool.length < Math.min(12, word.en.length + 4)) {
    const c = pick(extra);
    if(pool.indexOf(c) < 0 || Math.random() < .3) pool.push(c);
  }
  pool.sort(function(){ return Math.random() - .5; });
  pool.forEach(function(ch){
    const b = document.createElement("button");
    b.type = "button"; b.className = "lbtn" + (LEARN_CJK ? " zh" : ""); b.textContent = ch;
    b.addEventListener("click", function(){
      if(!chestQ || chestQ.done || chestQ.slots.done || !slotFill(chestQ.slots, ch, b)) return;
      chestStep();
    });
    box.appendChild(b);
  });
  const back = document.createElement("button");
  back.type = "button"; back.className = "lbtn back"; back.textContent = "←";
  back.addEventListener("click", function(){
    if(!chestQ || chestQ.done || !slotLast(chestQ.slots)) return;
    chestStep();
  });
  box.appendChild(back);
}
function judgeChest(){
  const w = chestQ.word, ok = chestQ.spell === spellOf(w);
  // 钥匙：拼错也照样开箱。⚠️ 熟练度和心魔照常按「拼错」记 —— 撬开的是锁，不是这个词
  const opened = ok || hasRelic("key");
  chestQ.done = true;
  const rec = LEX[lexKey(w)] || {str:0, seen:0, wrong:0};
  rec.seen++;
  if(ok){ rec.str = Math.min(5, (rec.str||0) + 1); rec.wrong = 0; }
  else { rec.str = Math.max(0, (rec.str||0) - 1); rec.wrong = (rec.wrong||0) + 1; addHaunt(w.en); }
  LEX[lexKey(w)] = rec;        // 同上，等存档点
  $("chestVerdict").innerHTML = (ok
      ? T("<span class=\"big ok\">咔哒 —— 开了</span>")
      : opened
        ? T("<span class=\"big ok\">拼错了 —— 钥匙替你撬开了</span>")
        : T("<span class=\"big no\">锁咬死了</span>")) +
    "<span class=\"mean\"><b>" + wordFull(w) + "</b>" + (w.py ? " " + w.py : "") + T("　") + w.cn + "</span>";
  $("btnChestLeave").hidden = true;
  $("btnChestDone").hidden = false;
  $("btnChestDone").textContent = opened ? T("拿走") : T("认了");
  chestQ.ok = opened;
  chestQ.spelled = ok;          // 钥匙的二选一只认真的拼对了的那一次
}
function closeChest(){
  const th = pendingRoom; pendingRoom = null;
  const ok = chestQ && chestQ.ok;
  const spelled = !!(chestQ && chestQ.spelled);   // 真的拼对了（钥匙撬开的不算）
  chestQ = null;
  $("veilChest").hidden = true;
  G.paused = false;
  removeThing(th);
  if(ok){
    const g = 4 + G.floor * 2;
    P.gold += g;
    say(T("木箱开了，里面有 <b>") + g + T("</b> 金币。"), "good");
    /* 钥匙的第二个机制（用户 2026-09）：**拼对**的话箱底那件遗物二选一。
       ⚠️ 只给真的拼对了的（chestQ.spelled）—— 钥匙撬开的那一次不算，撬的是锁，不是那个词。*/
    if(spelled && hasRelic("key")){
      const picks = [];
      for(let i=0; i<2; i++){
        const c = rollRelic();
        if(c && picks.indexOf(c) < 0) picks.push(c);
      }
      if(picks.length > 1){
        G.paused = true;                      // 挑完（fuseTake）才放开
        openFusePick(picks, picks[0].r || 0,
          {via:"grant", how:T("箱底压着"), eyebrow:T("钥匙 · 箱底有两件"), title:T("挑一件带走")});
        renderHud(); render();
        return;
      }
      grantRelic(picks[0] || null, T("箱底压着"));
      lockInput(200);
      renderHud(); render();
      return;
    }
    grantRelic(rollRelic(), T("箱底压着"));
    lockInput(200);
    renderHud(); render();
    return;
  }
  say(T("锁彻底咬死了。这箱子谁也打不开了。"), "hurt");
  lockInput(200);
  renderHud(); render();
}

/* ---- 游商：局内金币现在有地方花了 ---- */
/* 铺一批新货架，5 件（用户 2026-09 从 3 件加到 5 件）。openShop() 首次进店、
   shopReroll() 刷新的时候都调它 —— 两处生成规则必须是同一份，不然刷新出来的货
   会跟第一次进店的不是一个规矩。 */
function rollShopStock(){
  const stock = [];
  for(let i=0;i<5;i++){
    let r = null;
    for(let g=0; g<30 && !r; g++){
      const c = rollRelic();
      if(c && !stock.some(function(x){ return x.relic === c; })) r = c;
    }
    if(!r) break;
    // 标价 = 这件的分解价 × shopMarkup()（普通/稀有 1.3，史诗以上 1.3×1.8）—— 买进来再拆掉永远是亏的，
    // 别改回那套 (10 + 品质×12 + 层数) × 5 的老公式：低品质在浅层比分解价还便宜。
    stock.push({relic:r, price: Math.ceil(sellPrice(r) * shopMarkup(r)), sold:false});
  }
  return stock;
}
function openShop(th){
  G.paused = true;
  pendingRoom = th;
  if(!th.stock){
    // 进店那一刻定下货，存在物件上 —— 再进来不会重 roll
    th.stock = rollShopStock();
    th.rerollsLeft = SHOP_REROLL_N;    // 每家店（每个 th）能刷新几次，见 content.js 的 SHOP_REROLL_N
  }
  renderShop();
  hideAll();
  $("veilShop").hidden = false;
}
/* 「刷新」：整批换掉，不是重抽某一件（用户 2026-09 要求"商店可以刷新一次"）。
   跟遗物「重掷」是平行的两套：重掷是遗物效果、每层一次；这个是基础功能、每家店限
   SHOP_REROLL_N 次，不需要拿遗物。旧货架里已经买过的东西照样换掉——买过的钱不退，
   纯粹是换个货架。⚠️ `th.rerollsLeft` 老续玩档没有这个字段，renderShop() 里读处要 `|| 0` 兜底。 */
function shopReroll(){
  const th = pendingRoom;
  if(!th || !(th.rerollsLeft > 0)) return;
  th.stock = rollShopStock();
  th.rerollsLeft--;
  say(T("游商把布收了收，换了一批货。"), "sys");
  renderShop();
}
/* 游商的实际标价：货是进店那一刻定下的（存在 th.stock 上），
   「熟客」的折扣**不写进货架**，每次现算 —— 这样进店之后才拿到熟客也能立刻便宜。*/
/* 一件遗物在货架上标多少倍的分解价 —— **标价的唯一口径**（数值在 content.js）。
   普通/稀有 `SHOP_MARKUP`(1.3)；**史诗以上再 ×`SHOP_HI_X`(1.8)**（用户 2026-09-22）。
   ⚠️ 「熟客」的 −15% 不在这儿，它是**结账时**在 shopPrice() 里现算的。*/
function shopMarkup(r){
  return SHOP_MARKUP * ((((r && r.r) || 0) >= SHOP_HI_FROM) ? SHOP_HI_X : 1);
}
function shopPrice(row){
  return Math.max(1, Math.round(row.price * (hasRelic("regular") ? 0.85 : 1)));
}
function renderShop(){
  const th = pendingRoom;
  if(!th) return;
  $("shopGold").innerHTML = T("你身上有 <b style=\"color:var(--torch)\">") + P.gold + T("</b> 金币。");
  const rb = $("btnShopReroll");
  if(rb) rb.hidden = !((th.rerollsLeft || 0) > 0);
  const box = $("shopList");
  box.innerHTML = "";
  if(!th.stock.length){
    box.innerHTML = T("<div class=\"bagempty\">他的布上空空如也 —— 你已经什么都有了。</div>");
    return;
  }
  /* 货架照**三选一那种遗物卡**摆（用户 2026-09）：品质、名字、效果、传说各一行，
     买的按钮压在卡片右下角。五件竖着排，弹层自己会滚。*/
  th.stock.forEach(function(row, i){
    const r = row.relic, q = r.r || 0;
    const price = shopPrice(row);
    const d = document.createElement("div");
    d.className = "shopit" + (row.sold ? " sold" : "");
    d.innerHTML =
      "<span class=\"rt q" + q + "\">" + RAR_CN[q] + T(" · 遗物</span>") +
      "<span class=\"rn q" + q + "\">" + r.n + "</span>" +
      "<span class=\"rp\">" + r.pw + "</span>" +
      "<span class=\"rl\">" + r.lore + "</span>" +
      "<button type=\"button\" class=\"buy\" data-i=\"" + i + "\"" +
        (row.sold || P.gold < price ? " disabled" : "") + ">" +
        (row.sold ? T("已售") : price + T(" 金")) + "</button>";
    box.appendChild(d);
  });
}
function buyFrom(i){
  const th = pendingRoom;
  pendingRoom = null;
  if(!th) return;
  const row = th.stock[i];
  if(!row) return;
  const price = shopPrice(row);               // 熟客的折扣在这儿现算
  if(row.sold || P.gold < price) return;
  P.gold -= price;
  P.spent = (P.spent || 0) + price;           // 散财：这一趟花出去多少
  P.bought = (P.bought || 0) + 1;             // 囤货：这一趟买过几件（第十批，跟散财是一对）
  row.sold = true;
  say(T("你付了 <b>") + price + T("</b> 金币。"), "sys");
  grantRelic(row.relic, T("游商递给你"));
  pendingRoom = th;             // 货架还开着，接着选
  renderShop();
  renderHud();
}
function closeShop(){
  pendingRoom = null;
  $("veilShop").hidden = true;
  G.paused = false;
  /* 出了店自己往旁边空地退一格（用户 2026-09-25），别一直站在商人头上。
     四邻都没有空地板就留在原地。*/
  const shop = thingAt(P.x, P.y);
  if(shop && shop.kind === "shop") stepAside();
  lockInput(200);
  renderHud(); render();
}
function removeThing(th){
  if(!th) return;
  const i = G.things.indexOf(th);
  if(i >= 0) G.things.splice(i,1);
}

/* ================= 遗物 =================
   只在这一趟里有效，倒下就没了（P 整个重建）。
   效果一律在 answer() / nextQuestion() 里用 hasRelic() 分支实现。 */
var RELIC_MAX = 15;               // 持有上限 —— 满了必须取舍，这是搭配成立的前提
/* 实际上限：「行囊」+3。⚠️ 判满、遗物页的计数、取舍弹窗全走这一个口，别再直接读 RELIC_MAX
   （只有「空手」故意按 15 这个基准算，见 answer()）。*/
/* 能同时带几件遗物：底子 RELIC_MAX，「行囊」+3，再加**深度给的格子** ——
   第 RELIC_CAP_FROM 层之后每 RELIC_CAP_EVERY 层 +1（用户 2026-09），无尽章一路往上长。*/
function capByFloor(fl){
  const f = (fl == null) ? (G ? G.floor : 1) : fl;
  return f > RELIC_CAP_FROM ? Math.floor((f - RELIC_CAP_FROM) / RELIC_CAP_EVERY) : 0;
}
function relicCap(){ return RELIC_MAX + (hasRelic("pack") ? 3 : 0) + capByFloor(); }
let pendingSwap = null;           // 等着被换进来的那件
/* 刚拿到、还没在遗物页上点开看过的那几件 —— 卡片左上角挂个「new」小红点。
   **纯界面状态，不进存档**：回主城 / 重开一趟就清掉。 */
let newRelics = [];
function markNewRelic(id){ if(newRelics.indexOf(id) < 0) newRelics.push(id); }
function clearNewRelic(id){
  const i = newRelics.indexOf(id);
  if(i < 0) return false;
  newRelics.splice(i, 1);
  return true;
}

function hasRelic(id){ return !!(P && P.relics && P.relics.indexOf(id) >= 0); }
/* 遗物一动，生命上限就可能跟着动。规矩：**上限涨多少，当前血就涨多少** ——
   20/30 拿到「上限 +8」之后是 28/38，不是 20/38（白给的上限等于没给）。
   反过来，换掉或拆掉加血的遗物时把当前血压回新上限，但至少留 1 点。
   所有会改 P.relics 的地方都要从这儿过。 */
function withMaxHp(fn){
  const before = stats().maxHp;
  fn();
  const after = stats().maxHp;
  if(after > before){
    const up = after - before;
    P.hp += up;
    say(T("生命上限 <b>+") + up + T("</b> —— 当前生命跟着补上了（") + P.hp + " / " + after + T("）。"), "good");
  }
  if(P.hp > after) P.hp = after;
  if(P.hp < 1) P.hp = 1;
}
function relicById(id){ return RELICS.filter(function(r){ return r.id === id; })[0]; }
function relicRar(id){ const r = relicById(id); return r ? (r.r || 0) : 0; }

/* 层数 → 掉落品质权重。写成「每档各几份」，rarWt 把它摊成带权重的数组。
   前期几乎全是普通（它们是合成燃料）。
   **深层也不该随手就是传奇/神圣** —— 越往下高品质只是「有机会」，
   想要成型的搭配主要靠合成和游商，不是靠白捡。*/
function rarWt(n0, n1, n2, n3, n4){
  const out = [], n = [n0, n1, n2, n3, n4];
  for(let r = 0; r < 5; r++) for(let i = 0; i < n[r]; i++) out.push(r);
  return out;
}
/* 用户 2026-09：整体**左移一档** —— 高品质以前太容易白捡。
   神圣权重归零（只能靠合成拿），传奇接原来神圣的份，史诗接原来传奇的份，
   空出来的那份按普通:稀有当时的比例回填。 */
function rarityWeights(floor){
  if(floor <= 10) return rarWt(7, 1, 0, 0, 0);    // 普通 87.5% · 稀有 12.5%
  if(floor <= 20) return rarWt(15, 5, 0, 0, 0);   // 普通 75% · 稀有 25%
  if(floor <= 30) return rarWt(12, 7, 1, 0, 0);   // 史诗 5% 才露头
  if(floor <= 40) return rarWt(10, 8, 2, 0, 0);   // 史诗 10%，传奇还没有
  /* 41 层往下一律这一档（用户 2026-09：**50 层之后保持 50 层的爆率**，不再继续左移也不继续右移）——
     无尽章没有底，再往深处抬就是白送传奇。神圣照旧不掉，只能靠合成/游商。*/
  return rarWt(7, 9, 3, 1, 0);                    // 普通 35% · 稀有 45% · 史诗 15% · 传奇 5%
}
/* 按当前层数抽一件还没拿过的遗物；那个品质抽干了就逐级往下找 */
function rollRelic(floor){
  let want = pick(rarityWeights(floor == null ? (G ? G.floor : 1) : floor));
  /* 吉兆（第十批）：OMEN_RATE 的概率把这一次的品质**往上抬一档**。
     ⚠️ 抬不到神圣 —— 那一档按设计恒为 0（只能靠合成和游商），
     所以门槛是 want < 3，跟祝福「偏爱」的神圣槽是同一个道理。*/
  if(hasRelic("omen") && want < 3 && luck(OMEN_RATE)) want++;
  const pool = relicPool();
  if(!pool.length) return null;
  for(let d = 0; d < 5; d++){
    for(const r of [want - d, want + d]){
      if(r < 0 || r > 4) continue;
      const hit = pool.filter(function(x){ return (x.r || 0) === r; });
      if(hit.length) return blessPick(hit);      // 祝福·偏爱在同品质里加权，见 blessPick()
    }
  }
  return blessPick(pool);
}

/* ---- 分解：拆掉一件换金币，腾出格子 ---- */
/* 一件遗物值多少金 —— 分解、遗物页上的标价、带满了折算，全走这一个口。
   ⚠️ 这个函数只算数字，**不要**在这儿加「寄存」之类的副作用——它还要给分解按钮的价签、
   游商标价这些只是显示预览的地方用，加了副作用会变成"看一眼价格就先扣一次盾"。
   真的把遗物变成钱的那几处走下面的 sellRelicGold()。*/
function sellPrice(r){
  return (RAR_SELL[(r && r.r) || 0] || RAR_SELL[0]) + Math.floor((G ? G.floor : 1) / 5);
}
/* 「寄存」：分解或换掉一件遗物时，按分解价的 DEPOSIT_PCT 转护盾。
   收在这一个口子上——手动分解 / 换掉的旧件 / 熔炉吃不到新遗物折成钱，三处都从这儿过。*/
function sellRelicGold(r){
  const g = sellPrice(r);
  if(hasRelic("deposit") && g > 0){
    const sh = Math.floor(g * DEPOSIT_PCT);
    if(sh > 0){
      P.shield = (P.shield || 0) + sh;
      say(T("寄存把这份钱的一角存成了 <b>") + sh + T("</b> 点护盾。"), "sys");
    }
  }
  return g;
}
function sellRelic(id){
  const i = P.relics.indexOf(id);
  if(i < 0) return;
  const r = relicById(id);
  const g = sellRelicGold(r);
  clearNewRelic(id);
  withMaxHp(function(){ P.relics.splice(i, 1); });
  P.gold += g;
  say(T("你拆了 ") + rc(r) + T("，换成 <b>") + g + T("</b> 金币。"), "sys");
  renderHud();
}
/* ---- 合成：玩家自己挑 3 件同品质的，换一件高一档的（换到哪一件仍是随机） ----
   遗物页上两个按钮：「选择」进/退挑选状态，「合成」把挑中的三件砸了。
   挑选状态下整张遗物卡可点，选了第一件之后别的品质就点不动了。 */
/* 合成的两个数：「配方」把件数 3 → 2、金币减半。所有地方都走这两个函数，别直接读常量。 */
function fuseN(){ return hasRelic("recipe") ? 2 : FUSE_N; }
function fuseCost(){ return hasRelic("recipe") ? Math.round(FUSE_COST / 2) : FUSE_COST; }
let fuseOn = false;      // 是不是正在挑
let fuseSel = [];        // 挑中的遗物 id

function fuseRar(){ return fuseSel.length ? relicRar(fuseSel[0]) : -1; }
function fuseToggleMode(){
  fuseOn = !fuseOn;
  fuseSel = [];
  renderRelics();
}
function fusePick(id){
  if(!fuseOn) return;
  const i = fuseSel.indexOf(id);
  if(i >= 0){ fuseSel.splice(i, 1); renderRelics(); return; }
  const q = relicRar(id);
  if(q >= 4){ say(T("神圣已经是顶了，它没法当材料。"), "sys"); return; }
  if(fuseSel.length && q !== fuseRar()){
    say(T("得是<b>同一个品质</b>的三件 —— 现在挑的是") + RAR_CN[fuseRar()] + T("。"), "sys");
    return;
  }
  if(fuseSel.length >= fuseN()){ say(T("已经挑满 ") + fuseN() + T(" 件了。"), "sys"); return; }
  fuseSel.push(id);
  renderRelics();
}
/* 点「合成」先弹一个二选一的确认窗 —— 合成要花钱，砸下去不可撤销 */
function askFuse(){
  if(fuseSel.length !== fuseN()) return;
  const rar = fuseRar();
  if(rar < 0 || rar >= 4) return;
  const gold = (P && P.gold) || 0;
  const names = fuseSel.map(function(id){ const r = relicById(id); return r ? r.n : "?"; }).join(T("、"));
  $("fuseTitle").textContent = fuseN() + T(" 件") + RAR_CN[rar] + T(" → 1 件") + RAR_CN[rar + 1];
  $("fuseLedger").innerHTML =
    li(T("砸掉"), names) +
    li(T("花费"), fuseCost() + T(" 金（你有 ") + gold + T("）")) +
    li(T("换回"), RAR_CN[rar + 1] + T(" · 两件里挑一件"));
  const yes = $("btnFuseYes");
  yes.disabled = gold < fuseCost();
  yes.textContent = yes.disabled ? T("金币不够") : T("花 ") + fuseCost() + T(" 金合成");
  $("veilFuse").hidden = false;
  (yes.disabled ? $("btnFuseNo") : yes).focus();
}
function closeFuseAsk(){ $("veilFuse").hidden = true; }
/* 砸下去之后**在两件里挑一件**（用户 2026-09，以前是随机塞一件）：
   材料和金币先结清，再弹 veilFuseGot 让玩家挑。
   更高一档只剩一件没拿过时就直接给，不弹那个窗。*/
let fusePicks = [], fuseVia = null, fuseHow = T("合成出");
function fuseGo(){
  closeFuseAsk();
  if(fuseSel.length !== fuseN()) return;
  const rar = fuseRar();
  if(rar < 0 || rar >= 4) return;
  if(!P || P.gold < fuseCost()){ say(T("合成要 <b>") + fuseCost() + T("</b> 金，你还不够。"), "sys"); return; }
  // 挑的这几件必须都还在手上（分解过就作废）
  const eat = fuseSel.filter(function(id){ return P.relics.indexOf(id) >= 0; });
  if(eat.length !== fuseN()){ fuseSel = []; renderRelics(); return; }
  const up = relicPool().filter(function(x){ return (x.r || 0) === rar + 1; });
  if(!up.length){ say(T("更高一档的遗物你已经拿齐了。"), "sys"); return; }
  const cost = fuseCost();
  P.gold -= cost;
  P.spent = (P.spent || 0) + cost;        // 散财：合成的钱也算花出去了
  withMaxHp(function(){
    eat.forEach(function(id){ P.relics.splice(P.relics.indexOf(id), 1); });
  });
  fuseOn = false; fuseSel = [];
  say(T("你付了 <b>") + cost + T("</b> 金，把 ") + fuseN() + T(" 件") + RAR_CN[rar] + T("遗物砸在一起。"), "sys");
  const picks = blessPickN(up, FUSE_PICK);    // 祝福·偏爱在候选里加权（神圣那个偏爱槽主要吃这条）
  renderHud();
  if(picks.length <= 1){ fuseTake(picks[0] ? picks[0].id : null); return; }
  openFusePick(picks, rar + 1);
}
/* 两件挑一件的窗子。合成走的是老路（fuseVia 空 = 材料已经砸了，格子一定够，直接塞进背包）；
   宝箱的「钥匙」二选一走 fuseVia="grant" —— 要过 grantRelic，带满了才会弹取舍窗。*/
function openFusePick(picks, rar, opt){
  const o = opt || {};
  fuseVia = o.via || null;
  fuseHow = o.how || T("合成出");
  fusePicks = picks.map(function(r){ return r.id; });
  $("fuseGotEyebrow").textContent = o.eyebrow || T("合成");
  $("fuseGotTitle").textContent = o.title || (picks.length + T("件") + RAR_CN[rar] + T("，挑一件"));
  const box = $("fuseGotList");
  box.innerHTML = "";
  picks.forEach(function(r){
    const d = document.createElement("button");
    d.type = "button"; d.className = "relic"; d.dataset.id = r.id;
    d.innerHTML = "<span class=\"rt q" + (r.r || 0) + "\">" + RAR_CN[r.r || 0] + "</span>" +
      "<span class=\"rn q" + (r.r || 0) + "\">" + r.n + "</span>" +
      "<span class=\"rp\">" + r.pw + "</span>" +
      "<span class=\"rl\">" + r.lore + "</span>";
    box.appendChild(d);
  });
  $("veilFuseGot").hidden = false;
}
/* 挑定了（或者本来就只有一件）。
   合成：材料已经砸掉了，格子一定够，直接塞进背包。
   宝箱（fuseVia="grant"）：背包可能是满的，所以要从 grantRelic 走一遍（它会弹取舍窗）。*/
function fuseTake(id){
  $("veilFuseGot").hidden = true;
  const via = fuseVia, how = fuseHow;
  fuseVia = null; fuseHow = T("合成出");
  const ok = fusePicks.indexOf(id) >= 0 || (fusePicks.length === 0 && id);
  fusePicks = [];
  const got = ok ? relicById(id) : null;
  if(via === "grant"){
    if(G) G.paused = false;      // grantRelic 里要是弹取舍窗，它自己会再 paused 回去
    if(got) grantRelic(got, how);
    lockInput(200);
    renderHud(); render();
    return;
  }
  if(!got){ renderHud(); return; }
  withMaxHp(function(){ P.relics.push(got.id); });
  noteRelicFound(got, how);
  say("—— " + rc(got) + T(" 成了：") + got.pw + T("。"), "crit");
  renderHud();
}
/* 遗物名字上色 */
function rc(r){ return "<span style=\"color:var(--q" + (r.r || 0) + ")\">" + r.n + "</span>"; }
/* 还没拿过的遗物；全拿全了就返回空数组 */
function relicPool(){
  const own = (P && P.relics) || [];
  return RELICS.filter(function(r){
    if(own.indexOf(r.id) >= 0) return false;
    if(COOP && r.id === "shed") return false;    // 联机里禁用撤退，脱壳是纯废牌，别让它掉出来
    if(blessBanned(r.id)) return false;          // 祝福·封印：这一局它根本不出现
    return true;
  });
}
/* 直接给一件（祭坛/宝箱/游商走这里），没得给就折成金币 */
function grantRelic(r, how){
  // 带满了：弹窗让玩家选换掉哪一件，或者放弃
  if(r && P.relics.length >= relicCap()){ offerSwap(r, how); return; }
  if(!r){
    const g = 8 + G.floor * 2;
    P.gold += g;
    say(T("遗物已经被你撑满了，折成 <b>") + g + T("</b> 金币。"), "sys");
    return;
  }

  withMaxHp(function(){ P.relics.push(r.id); });
  noteRelicFound(r, how);
  say((how || T("你得到了")) + " " + rc(r) + " —— " + r.pw + T("。"), "crit");
}
/* 带满了的取舍弹窗 */
function offerSwap(r, how){
  pendingSwap = {relic:r, how:how};
  G.paused = true;
  $("swapMax").textContent = relicCap();
  /* 点这件新的 = 不要了，当场分解（用户 2026-09）——
     跟底下那个「不要了，折成金币」是同一条路（doSwap(null)），少走一趟视线。*/
  $("swapNew").innerHTML = "<span class=\"rt q" + (r.r||0) + "\">" + RAR_CN[r.r||0] + "</span>" +
    "<span class=\"rn q" + (r.r||0) + "\">" + r.n + "</span><span class=\"rp\">" + r.pw + "</span>" +
    T("<span class=\"rl\">点它 → 直接卖掉，换 ") + sellPrice(r) + T(" 金</span>");
  const box = $("swapList");
  box.innerHTML = "";
  P.relics.forEach(function(id){
    const old = relicById(id);
    if(!old) return;
    const d = document.createElement("button");
    d.type = "button"; d.className = "relic"; d.dataset.id = id;
    d.innerHTML = "<span class=\"rt q" + (old.r||0) + "\">" + RAR_CN[old.r||0] + "</span>" +
                  "<span class=\"rn q" + (old.r||0) + "\">" + old.n + "</span>" +
                  "<span class=\"rp\">" + old.pw + "</span>" +
                  T("<span class=\"rl\">点它 → 换成「") + r.n + T("」</span>");
    box.appendChild(d);
  });
  hideAll();
  $("veilSwap").hidden = false;
}
function doSwap(dropId){
  const ps = pendingSwap; pendingSwap = null;
  $("veilSwap").hidden = true;
  G.paused = false;
  if(!ps) return;
  if(dropId){
    const i = P.relics.indexOf(dropId), old = relicById(dropId);
    /* 换下来的那件**当场分解**（用户 2026-09）：跟手动分解一个价，
       遗物页上的分解按钮照旧留着。⚠️ 动 P.relics 一律从 withMaxHp() 过。*/
    const back = old ? sellRelicGold(old) : 0;
    withMaxHp(function(){
      if(i >= 0) P.relics.splice(i, 1);
      P.relics.push(ps.relic.id);
    });
    if(back) P.gold += back;
    noteRelicFound(ps.relic, ps.how);
    say(T("你放下 ") + (old ? old.n : T("旧遗物")) +
        T("，换上了 ") + rc(ps.relic) + T("。") +
        (back ? T(" 旧的那件碎成了 <b>") + back + T("</b> 金币。") : ""), "crit");
  } else {
    const g = sellRelicGold(ps.relic);      // 不换就当场分解，跟分解价一样
    P.gold += g;
    say(T("你没动手上的东西，") + ps.relic.n + T(" 折成了 <b>") + g + T("</b> 金币。"), "sys");
  }
  renderHud(); render();
  maybeRelic();
}

/* 跨局图鉴：记首次在第几层拿到、总共拿过几次 */
function noteRelicFound(r, how){
  blessNoteGot(r.id);                // 祝福·偏爱：本局拿到过一次就不再加权
  markNewRelic(r.id);                // 遗物页上挂个「new」，点一下那张卡就没了
  const first = !CODEX[r.id];
  CODEX[r.id] = {depth: first ? G.floor : CODEX[r.id].depth, times: (first ? 0 : CODEX[r.id].times) + 1};
  fxRelic(r);                        // 碎屑飞向底部的「遗物」标签
  if(first) say(T("—— 初次发现：") + r.n + " ——", "crit");
}

/* 这一层能重掷几次：现在只有「集齐」给 —— 身上凑齐普通/稀有/史诗三个品质就是 1 次。
   （遗物「重掷」2026-09 已按用户要求删掉。）G.rerollUsed 记的是"已经用掉几次"（数字，不是布尔）。 */
function rerollBudget(){
  let n = 0;
  if(hasRelic("fullset")){
    const q = {};
    (P.relics || []).forEach(function(id){ const r = relicById(id); if(r) q[r.r || 0] = true; });
    if(q[0] && q[1] && q[2]) n++;
  }
  return n;
}
function offerRelics(){
  const pool = relicPool();      // ⚠️ 走这一个口，封印/已拥有/联机禁用件都在里面滤掉了
  if(!pool.length){ G.relicDone = true; return false; }
  // 每一件都按层数权重单抽，互不重复（2026-09 从三选一改成五选一，RELIC_OFFER_N）
  const picks = [];
  for(let i = 0; i < RELIC_OFFER_N; i++){
    let r = null;
    for(let g = 0; g < 30 && !r; g++){
      const c = rollRelic();
      if(c && picks.indexOf(c) < 0) r = c;
    }
    if(r) picks.push(r);
  }

  G.paused = true;
  $("relicEyebrow").textContent = CH.name + T(" 第 ") + G.floor + T(" 层 · 清干净了");
  $("relicTitle").textContent = CH.name + T("给了你一样东西");   // 四章各叫各的名字
  const box = $("relicList");
  box.innerHTML = "";
  picks.forEach(function(r){
    const d = document.createElement("button");
    d.type = "button"; d.className = "relic"; d.dataset.id = r.id;
    d.innerHTML = "<span class=\"rt q" + (r.r || 0) + "\">" + RAR_CN[r.r || 0] + "</span>" +
      "<span class=\"rn q" + (r.r || 0) + "\">" + r.n + "</span>" +
      "<span class=\"rp\">" + r.pw + "</span>" +
      "<span class=\"rl\">" + r.lore + "</span>";
    box.appendChild(d);
  });
  /* 「集齐」：换一批五选一，次数看 rerollBudget()（G.rerollUsed 在 nextFloor 里清零） */
  const rb = $("btnRelicRedraw");
  if(rb) rb.hidden = !(rerollBudget() > (G.rerollUsed || 0));
  hideAll();
  $("veilRelic").hidden = false;
  return true;
}
function takeRelic(id){
  const r = relicById(id);
  if(!r) return;
  G.relicDone = true;
  $("veilRelic").hidden = true;
  if(P.relics.length >= relicCap()){ offerSwap(r, T("你拿起了")); return; }
  G.paused = false;
  withMaxHp(function(){ P.relics.push(id); });
  noteRelicFound(r, T("你拿起了"));
  say(T("你拿起了 ") + rc(r) + " —— " + r.pw + T("。"), "crit");
  renderHud(); render();
  if(P.tut) tutEvent("relic");
}
/* 清完一层就给一次；掉落弹窗结束后再触发，免得两个窗打架 */
function maybeRelic(){
  if(!G || G.over || G.relicDone) return false;
  if(G.mobs.length > 0) return false;
  if(pendingLoot) return false;
  return offerRelics();
}
function renderRelics(){
  const own = (P && P.relics) || [];
  $("relicHead").textContent = T("遗物 ") + own.length + " / " + relicCap();
  const dot = $("bagDot");
  dot.textContent = own.length;
  dot.hidden = own.length === 0;
  const box = $("relicOwned");
  box.innerHTML = "";
  // 选中的东西可能已经不在手上了（被换掉、被分解），先对一遍
  fuseSel = fuseSel.filter(function(id){ return own.indexOf(id) >= 0; });
  newRelics = newRelics.filter(function(id){ return own.indexOf(id) >= 0; });
  if(!own.length){
    box.innerHTML = T("<div class=\"bagempty\">还没有。每清完一层会让你五选一。</div>");
    fuseOn = false; fuseSel = [];
    renderFuse();
    return;
  }
  // 按品质从高到低排，一眼能看出手里有什么
  own.slice().sort(function(a, b){ return relicRar(b) - relicRar(a); }).forEach(function(id){
    const r = relicById(id);
    if(!r) return;
    const q = r.r || 0;
    const d = document.createElement("div");
    const picked = fuseSel.indexOf(id) >= 0;
    // 挑选状态：整张卡可点，品质对不上（或已是神圣）的压暗；分解按钮收起来免得误触
    const off = fuseOn && !picked && (q >= 4 || (fuseSel.length && q !== fuseRar()));
    const isNew = newRelics.indexOf(id) >= 0;
    d.className = "relic own" + (fuseOn ? " pickable" : "") + (picked ? " picked" : "") +
                  (off ? " off" : "") + (isNew ? " fresh" : "");
    d.dataset.id = id;
    d.innerHTML =
      (isNew ? "<span class=\"newdot\">new</span>" : "") +
      "<div class=\"col\">" +
        "<span class=\"rt q" + q + "\">" + RAR_CN[q] + (picked ? T(" · 已选") : "") + "</span>" +
        "<span class=\"rn q" + q + "\">" + r.n + "</span>" +
        "<span class=\"rp\">" + r.pw + "</span>" +
      "</div>" +
      (fuseOn
        ? "<span class=\"tick\">" + (picked ? "✓" : "") + "</span>"
        : "<button type=\"button\" class=\"melt\" data-sell=\"" + id + T("\">分解<em>") +
          sellPrice(r) + T(" 金</em></button>"));
    box.appendChild(d);
  });
  renderFuse();
}
/* 合成面板：每个品质一行，够 3 件就能点 */
/* 两个按钮的状态 + 一行说明。列表本身由 renderRelics 画，这里只管按钮。 */
function renderFuse(){
  const pickBtn = $("btnFusePick"), goBtn = $("btnFuseGo"), note = $("fuseState");
  if(!pickBtn || !goBtn) return;
  const own = (P && P.relics) || [];
  // 手上有没有任何一个品质凑得够三件
  let ready = -1;
  for(let q = 0; q < 4; q++){
    if(own.filter(function(id){ return relicRar(id) === q; }).length >= fuseN()){ ready = q; break; }
  }
  // 标题也跟着「配方」变（2 件 + 150 金）
  const fh = $("fuseHead");
  if(fh) fh.textContent = T("合成 · ") + fuseN() + T(" 件同品质 + ") + fuseCost() + T(" 金 → ") + FUSE_PICK + T(" 选 1");
  pickBtn.textContent = fuseOn ? T("取消选择") : T("选择");
  pickBtn.disabled = !fuseOn && ready < 0;
  goBtn.disabled = fuseSel.length !== fuseN();
  goBtn.textContent = fuseOn && fuseSel.length ? (T("合成（") + fuseSel.length + "/" + fuseN() + T("）")) : T("合成");
  if(!note) return;
  if(fuseOn){
    note.innerHTML = fuseSel.length
      ? (T("已挑 <b>") + fuseSel.length + " / " + fuseN() + T("</b> 件") + RAR_CN[fuseRar()] +
         T("，合成后在 ") + FUSE_PICK + T(" 件<b>") + RAR_CN[fuseRar() + 1] + T("</b>里挑一件，另付 <b>") + fuseCost() + T("</b> 金。"))
      : T("在上面点 <b>") + fuseN() + T(" 件同品质</b>的遗物。神圣已经是顶了，不能当材料。");
  } else {
    note.innerHTML = ready >= 0
      ? (T("点「选择」，挑 ") + fuseN() + T(" 件同品质的砸成一件更高的（另付 <b>") + fuseCost() + T("</b> 金）。你的<b>") + RAR_CN[ready] + T("</b>已经够了。"))
      : "";                 // 材料还不够时这一行整条不写（用户 2026-09-21：标题上已经写着配方了）
  }
  note.hidden = !note.innerHTML;   // 空着就连位置都别占
}

/* ================= 心魔 =================
   这一趟答错过的词会缠上来：抽题时优先出现，答对驱散并回血，再答错额外掉 1 点。
   名单是 P.haunt（只存 en 字符串），每个词记下答错时的答题数 P.hauntAt[en]。 */
var HAUNT_MAX = 6;
/* **答错之后要再过 10 次答题，这个词才会以心魔的身份回来**（用户 2026-09）——
   以前是下一题就可能被拽出来重考，刚错完立刻再问一遍太黏人。
   计时用的是这一趟的答题总数（P.right + P.wrong），所以跨战斗照样在走。*/
var HAUNT_DELAY = 10;
function answered(){ return (P.right || 0) + (P.wrong || 0); }
function addHaunt(en){
  if(!P.haunt) P.haunt = [];
  if(!P.hauntAt) P.hauntAt = {};
  const i = P.haunt.indexOf(en);
  if(i >= 0) P.haunt.splice(i, 1);
  P.haunt.push(en);
  P.hauntAt[en] = answered();      // addHaunt 是在 P.wrong++ 之后调的，含这一题
  while(P.haunt.length > HAUNT_MAX) delete P.hauntAt[P.haunt.shift()];
}
/* 这个词熬到时候了没有 —— 战斗窗那条「心魔」标签、额外 1 点伤害、驱散回血都看它。
   老续玩档没记时间（hauntAt 里没这个键），当成已经熬到。*/
function hauntReady(en){
  if(!P.haunt || P.haunt.indexOf(en) < 0) return false;
  const at = P.hauntAt ? P.hauntAt[en] : undefined;
  return typeof at !== "number" || answered() - at >= HAUNT_DELAY;
}
function readyHaunts(){
  if(!P.haunt) return [];
  return P.haunt.filter(hauntReady);
}
function dropHaunt(en){
  if(!P.haunt) return false;
  const i = P.haunt.indexOf(en);
  if(i < 0) return false;
  P.haunt.splice(i, 1);
  if(P.hauntAt) delete P.hauntAt[en];
  return true;
}

/* ================= 主城 =================
   两个场景：town / run。主城是常驻的，一趟探索只是从镇口下去一次。
   死亡 = 身上一切归零回镇上，**金币留在洞里** —— 带回来的是结算换的**宝石**（endRun）。 */
var TOWN_KEY = "youxu.town.v1";
/* 宝石就是以前的「镇上存款」，**localStorage 的键没变**（老档照样能读）。
   字段从 gold 改叫 gem，读的时候兜一下老档。宝石以后花在「祝福」上。 */
var TOWN = (function(){
  const t = load(TOWN_KEY, {gem:0}) || {};
  return {gem: typeof t.gem === "number" ? t.gem : (t.gold || 0), bless: fixBless(t.bless),
          orb: fixOrb(t.orb)};            // 宝珠（2026-09-23，orb.js 里正规化）
})();
/* 宝石一变就落盘（用户要求）——**别绕过这个函数直接改 TOWN.gem** */
function addGems(n){
  TOWN.gem = Math.max(0, (TOWN.gem || 0) + n);
  commitPerm();
  if(SCENE === "town") renderTown();
}
/* ================= 祝福（局外养成） =================
   主城那个原来灰着的「祝福」：用**宝石**开槽位，把某件遗物钉在两种效果之一上。
   一共 **10 个槽位 = 偏爱 5 + 封印 5**，每一组**每个品质各一个**（普通/稀有/史诗/传奇/神圣），
   所以一个品质最多同时有「偏爱一件 + 封印一件」。

   - **偏爱**：那件遗物在**同品质的候选里权重 ×BLESS_FAV_X（300%）**，
     **本局拿到过一次就歇了**（P.blessGot 记着，卖掉也不会再涨回来）。
     ⚠️ 只改「同品质里抽哪一件」，**不动 rarityWeights 那张掉率表** ——
     所以神圣那个偏爱槽在掉落里没用（神圣本来就不掉），它吃的是**合成候选和游商**。
   - **封印**：那件遗物这一局**永远不出现**（relicPool() 里直接滤掉）。

   开一个槽位收 BLESS_SLOT_COST 宝石，开了之后**换遗物不再收钱**，可以在**全部遗物**里自选。
   数据挂在 TOWN.bless 上，跟着宝石一起走 TOWN_KEY，**没有新开 localStorage 键**
   （所以 commit/snapshot/overwrite 三处自动带上，只有 mergeData 要单独写一条合并规矩）。*/
function blankBless(){
  return {open:{fav:[0,0,0,0,0], ban:[0,0,0,0,0]},
          pick:{fav:["","","","",""], ban:["","","","",""]}};
}
/* 存档里读回来的那份可能是老档/坏档/删过的遗物 —— 一律过这儿正规化：
   槽位没开的不认它存的遗物，品质对不上的也不认。*/
function fixBless(b){
  const out = blankBless();
  if(!b || typeof b !== "object") return out;
  ["fav", "ban"].forEach(function(k){
    for(let r = 0; r < 5; r++){
      if(b.open && b.open[k] && b.open[k][r]) out.open[k][r] = 1;
      const id = (b.pick && b.pick[k] && b.pick[k][r]) || "";
      const R = id ? relicById(id) : null;
      if(R && (R.r || 0) === r && out.open[k][r]) out.pick[k][r] = id;
    }
  });
  return out;
}
function blessOpen(kind, rar){ return !!(TOWN.bless && TOWN.bless.open[kind][rar]); }
/* 这个槽位钉着哪一件（没开的槽位一律当空） */
function blessId(kind, rar){ return blessOpen(kind, rar) ? (TOWN.bless.pick[kind][rar] || "") : ""; }
function blessSlots(){
  let n = 0;
  ["fav", "ban"].forEach(function(k){ for(let r = 0; r < 5; r++) if(blessOpen(k, r)) n++; });
  return n;
}
function blessHas(kind, id){
  if(!id) return false;
  for(let r = 0; r < 5; r++) if(blessId(kind, r) === id) return true;
  return false;
}
/* 封印：这一局根本不出现 */
function blessBanned(id){ return blessHas("ban", id); }
/* 偏爱：还在生效吗 —— 本局已经拿到过一次就歇了（P.blessGot） */
function blessFavored(id){
  if(!blessHas("fav", id)) return false;
  return !(P && P.blessGot && P.blessGot.indexOf(id) >= 0);
}
/* 从一串遗物里抽一件，偏爱的那件占 BLESS_FAV_X 份。
   ⚠️ 所有「随机抽一件遗物」的地方都走它，别再直接 pick()。*/
function blessPick(list){
  if(!list || !list.length) return null;
  const bag = [];
  list.forEach(function(r){
    const n = blessFavored(r.id) ? BLESS_FAV_X : 1;
    for(let i = 0; i < n; i++) bag.push(r);
  });
  return pick(bag);
}
/* 不重复地抽 n 件（合成的候选用） */
function blessPickN(list, n){
  const bag = (list || []).slice(), out = [];
  while(out.length < n && bag.length){
    const r = blessPick(bag);
    if(!r) break;
    bag.splice(bag.indexOf(r), 1);
    out.push(r);
  }
  return out;
}
/* 本局拿到了一件偏爱的 —— 记一笔，这一趟剩下的时间它不再加权（noteRelicFound 里调） */
function blessNoteGot(id){
  if(!P || !blessHas("fav", id)) return;
  if(!P.blessGot) P.blessGot = [];
  if(P.blessGot.indexOf(id) < 0) P.blessGot.push(id);
}

/* ---- 买槽位 / 换遗物 ---- */
function blessBuy(kind, rar){
  if(blessOpen(kind, rar)) return;
  if((TOWN.gem || 0) < BLESS_SLOT_COST) return;      // 按钮本来就是禁的，这儿再兜一层
  TOWN.bless.open[kind][rar] = 1;
  addGems(-BLESS_SLOT_COST);                          // 它自己 commitPerm()，bless 跟着一起落盘
  renderBless();
}
function blessSet(kind, rar, id){
  if(!blessOpen(kind, rar)) return;
  const R = id ? relicById(id) : null;
  if(id && (!R || (R.r || 0) !== rar)) return;        // 槽位的品质是钉死的
  /* 同一件不能又偏爱又封印 —— 塞进这一边就把另一边那个槽位空出来。
     两边的槽位按品质一一对应，所以只可能撞在同一个下标上。*/
  const other = kind === "fav" ? "ban" : "fav";
  if(id && TOWN.bless.pick[other][rar] === id) TOWN.bless.pick[other][rar] = "";
  TOWN.bless.pick[kind][rar] = id || "";
  commitPerm();
  renderBless();
}

/* ---- 界面 ---- */
var BLESS_CN = {fav:T("偏爱"), ban:T("封印")};
let blessPickSlot = null;      // 正在挑的那个槽位 {kind, rar}
let blessArmed = "";           // 开槽位的两步确认（"kind:rar"），跟「放弃」一个套路
function openBless(){
  blessArmed = "";
  hideAll();
  renderBless();
  $("veilBless").hidden = false;
}
function closeBless(){ $("veilBless").hidden = true; blessArmed = ""; }
function renderBless(){
  $("blessGem").textContent = TOWN.gem || 0;
  $("blessCost").textContent = BLESS_SLOT_COST;      // 价钱只有 content.js 那一处源
  const box = $("blessList");
  box.innerHTML = "";
  ["fav", "ban"].forEach(function(kind){
    const h = document.createElement("div");
    h.className = "eyebrow bhead";
    h.textContent = kind === "fav"
      ? (T("偏爱 · 同品质里出现概率 ") + (BLESS_FAV_X * 100) + T("%，拿到一次失效"))
      : T("封印 · 本局永不出现");
    box.appendChild(h);
    for(let rar = 0; rar < 5; rar++){
      const open = blessOpen(kind, rar), id = blessId(kind, rar), R = id ? relicById(id) : null;
      const armed = blessArmed === (kind + ":" + rar);
      const afford = (TOWN.gem || 0) >= BLESS_SLOT_COST;
      const d = document.createElement("button");
      d.type = "button";
      d.className = "bslot" + (open ? "" : " locked") + (R ? " set" : "") + (armed ? " armed" : "");
      d.dataset.kind = kind; d.dataset.rar = rar;
      if(!open && !afford && !armed) d.disabled = true;
      const title = open ? (R ? R.n : T("空着")) : T("未开启");
      const sub = open ? (R ? R.pw : L("点这里挑一件" + RAR_CN[rar] + "遗物", "Tap to pick a " + RAR_CN[rar] + " relic"))
                       : (armed ? T("再点一次 = 花 ") + BLESS_SLOT_COST + T(" 宝石开它")
                                : (afford ? BLESS_SLOT_COST + T(" 宝石开启") : T("宝石还差 ") + (BLESS_SLOT_COST - (TOWN.gem || 0))));
      d.innerHTML =
        "<span class=\"bq q" + rar + "\">" + RAR_CN[rar] + "</span>" +
        "<span class=\"bcol\"><b class=\"bn" + (R ? " q" + rar : "") + "\">" + title + "</b>" +
        "<em>" + sub + "</em></span>" +
        "<span class=\"bgo\">" + (open ? "▸" : (armed ? T("确认") : (afford ? T("开启") : T("锁")))) + "</span>";
      box.appendChild(d);
    }
  });
}
/* 挑遗物：只摆这个槽位那一个品质的，全部可选（用户要求「可以自选所有遗物」）。
   这一局已经钉着的那件标出来，再点一下等于换成别的。*/
function openBlessPick(kind, rar){
  blessPickSlot = {kind:kind, rar:rar};
  $("blessPickEyebrow").textContent = BLESS_CN[kind] + " · " + RAR_CN[rar];
  $("blessPickTitle").textContent = kind === "fav" ? T("什么是你的最爱") : T("不想再见到哪一件？");
  const f = $("blessFind");
  if(f) f.value = "";
  renderBlessPick();
  $("veilBless").hidden = true;
  $("veilBlessPick").hidden = false;
}
function renderBlessPick(){
  if(!blessPickSlot) return;
  const kind = blessPickSlot.kind, rar = blessPickSlot.rar, cur = blessId(kind, rar);
  // 另一边同品质那个槽位钉着谁 —— 挑到它就等于把那边空出来，先在卡片上说一声
  const other = blessId(kind === "fav" ? "ban" : "fav", rar);
  const f = $("blessFind"), q = f ? f.value.trim().toLowerCase() : "";
  const box = $("blessPickList");
  box.innerHTML = "";
  RELICS.filter(function(R){ return (R.r || 0) === rar; })
    .filter(function(R){ return !q || (R.n + R.pw + R.lore).toLowerCase().indexOf(q) >= 0; })
    .forEach(function(R){
      const d = document.createElement("button");
      d.type = "button";
      d.className = "relic" + (R.id === cur ? " cur" : "");
      d.dataset.id = R.id;
      d.innerHTML = "<span class=\"rt q" + rar + "\">" + RAR_CN[rar] +
          (R.id === cur ? T(" · 现在钉着它") : (R.id && R.id === other ? T(" · 现在") + BLESS_CN[kind === "fav" ? "ban" : "fav"] + T("着，选了就换过来") : "")) + "</span>" +
        "<span class=\"rn q" + rar + "\">" + R.n + "</span>" +
        "<span class=\"rp\">" + R.pw + "</span>" +
        "<span class=\"rl\">" + R.lore + "</span>";
      box.appendChild(d);
    });
  if(!box.children.length){
    box.innerHTML = T("<div class=\"relic hot\"><span class=\"rn\">没找到</span></div>");
  }
  const c = $("btnBlessClear");
  if(c) c.hidden = !cur;
}
function closeBlessPick(){
  blessPickSlot = null;
  $("veilBlessPick").hidden = true;
  renderBless();
  $("veilBless").hidden = false;
}
function blessTake(id){
  if(!blessPickSlot) return;
  blessSet(blessPickSlot.kind, blessPickSlot.rar, id);
  closeBlessPick();
}

/* ================= 浮窗提示 toast（用户 2026-09-23）=================
   「买下了一颗宝珠」「分解了两颗」「存档码已复制」这类一句话的反馈，一律从底部弹出来、过一会儿自己淡掉。
   ⚠️ **别再往面板里塞一行 note 当提示** —— 那会把下面的东西顶下去，用户明确要「交互后不要变形」。
   同一时间只有一条：新的来了直接换字、重新计时。纯装饰，挂在 body 上，不占任何布局。 */
let toastTimer = null;
function toast(text){
  if(!text) return;
  let t = $("toast");
  if(!t){
    t = document.createElement("div");
    t.id = "toast"; t.className = "toast";
    t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite");
    document.body.appendChild(t);
  }
  t.textContent = text;
  t.classList.remove("show"); void t.offsetWidth;    // 连着两条时也重播一次弹出
  t.classList.add("show");
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ t.classList.remove("show"); toastTimer = null; }, 2400);
}

/* ================= 弹窗的关闭动画（用户 2026-09-23：「所有弹窗也加入平滑过渡动画」）=================
   **打开**的动画全在 CSS 里（.veil 从 hidden 变成显示的那一下自己播）。
   **关闭**不能去动那几十处 `$("veilXxx").hidden = true` —— 好多地方紧接着就读 `.hidden` 判断状态，
   把隐藏推迟就会串。所以换个做法：窗口被藏掉的那一刻，**把它的样子复制一份（去掉所有 id）盖在原地淡出**，
   180ms 后删掉。复制品不接点击、不参与任何逻辑，纯画面。
   ⚠️ 同一批里又打开了另一个窗（关一个开一个）就不放淡出，交给新窗的弹入动画，免得两层叠着闪一下。
   ⚠️ 节点太多的窗（图鉴一开几千张卡）不复制，直接关 —— 复制一次要卡一下。 */
(function(){
  if(REDUCE_MOTION || !window.MutationObserver) return;
  const veils = Array.prototype.slice.call(document.querySelectorAll(".veil"));
  function ghostOut(v){
    if(v.getElementsByTagName("*").length > 2500) return;
    const g = v.cloneNode(true);
    g.removeAttribute("hidden");
    g.removeAttribute("id");
    Array.prototype.forEach.call(g.querySelectorAll("[id]"), function(e){ e.removeAttribute("id"); });
    g.classList.add("ghost");
    g.setAttribute("aria-hidden", "true");
    document.body.appendChild(g);
    setTimeout(function(){ if(g.parentNode) g.parentNode.removeChild(g); }, 220);
  }
  const mo = new MutationObserver(function(list){
    const closed = [];
    list.forEach(function(m){
      // oldValue === null：改之前没有 hidden 属性，也就是「本来开着、现在被关上」
      if(m.target.hidden && m.oldValue === null && closed.indexOf(m.target) < 0) closed.push(m.target);
    });
    if(!closed.length) return;
    if(veils.some(function(v){ return !v.hidden; })) return;
    closed.forEach(ghostOut);
  });
  veils.forEach(function(v){ mo.observe(v, {attributes:true, attributeFilter:["hidden"], attributeOldValue:true}); });
})();

/* ================= 宝珠（局外养成，用户 2026-09-23）=================
   用宝石买、在「背包」里鉴定 / 强化 / 装备，**只在战场生效**（battle.js 开局读一次）。
   配置表和纯函数在 orb.js；这里只管主城的界面和花钱。
   数据挂在 TOWN.orb 上，跟着宝石一起走 TOWN_KEY —— **没有新开 localStorage 键**，
   commit / snapshot / overwrite 三处自动带上，mergeData 和存档码各单独写了一段。
   ⚠️ **所有花宝石的按钮都是两步确认**（orbArmed，跟祝福开槽位一个套路）——
      一次一千到五千，误点一下很亏。鉴定是免费的，一下就鉴。 */
let orbSub = "bag";           // 背包页里停在哪个子栏目：bag 背包 / me 人物
let orbArmed = "";            // 两步确认："buy:0" / "re" / "enh:<uid>"
let orbMeltOn = false;        // 分解的挑选状态（背包顶上那颗「分解」按钮开的）
let orbMeltSel = [];          // 挑中要分解的 uid
let orbInfoU = 0;             // 详情弹窗开着的是哪一颗

function orbData(){ return TOWN.orb; }
/* 商店货架：没有就当场摇一批并**立刻落盘** —— 不存的话刷新页面就是免费换货 */
function orbShop(){
  const od = orbData();
  if(!od.shop){ od.shop = orbRollShop(); commitPerm(); }
  return od.shop;
}
function orbRollShop(){
  const out = [];
  for(let i = 0; i < ORB_SHOP_N; i++)
    out.push({b: Math.random() < ORB_BASE_RATE ? pick(ORB_BASE).id : "", sold:false});
  return out;
}
/* 花宝石都从这儿过：扣钱（addGems 自己落盘）+ 记一笔 spent（合并存档时按它判谁的进度多） */
function orbPay(n){
  if(n <= 0){ commitPerm(); return true; }
  if((TOWN.gem || 0) < n) return false;
  orbData().spent += n;
  addGems(-n);
  return true;
}
function orbBuy(i){
  const s = orbShop()[i];
  if(!s || s.sold) return;
  if(orbArmed !== "buy:" + i){ orbArmed = "buy:" + i; renderOrbShop(); return; }
  orbArmed = "";
  if(!orbPay(ORB_PRICE)){ renderOrbShop(); return; }
  const od = orbData();
  od.bag.push({u: ++od.seq, c:"", b:s.b, lv:0, pt:0, a:[]});
  s.sold = true;
  commitPerm();
  toast(T("买下了一颗未鉴定的宝珠，放进背包了。"));
  renderOrbShop();
}
function orbReroll(){
  if(orbArmed !== "re"){ orbArmed = "re"; renderOrbShop(); return; }
  orbArmed = "";
  if(!orbPay(ORB_REROLL)){ renderOrbShop(); return; }
  orbData().shop = orbRollShop();
  commitPerm();
  renderOrbShop();
}
function orbRollColor(){
  let t = 0, i;
  for(i = 0; i < ORB_COLORS.length; i++) t += ORB_COLORS[i].w;
  let x = Math.random() * t;
  for(i = 0; i < ORB_COLORS.length; i++){ x -= ORB_COLORS[i].w; if(x < 0) return ORB_COLORS[i].id; }
  return ORB_COLORS[0].id;
}
function orbIdentify(u){
  const o = orbFind(orbData(), u);
  if(!o || o.c) return;
  if(!orbPay(ORB_IDENT_COST)) return;
  o.c = orbRollColor();
  commitPerm();
  toast(T("鉴定出来了：") + orbColorName(o) + T("。"));
  orbRefresh();
}
function orbEnhCost(o){
  const c = ORB_ENH_COST[o.lv];
  if(c === undefined) return 0;
  return o.b === "thrift" ? Math.round(c * 0.8) : c;
}
/* 强化一次：抽 7~12 点（稳手至少 9、淬心再 +1）。
   点数每跨过一个 10 就抽一条词条（最多 8 条），跨过 100 的那一下随机翻倍一条。
   ⚠️ 一次最多 13 点，所以一次可能跨两个 10（比如 9 → 22），要逐个数。 */
function orbEnhance(u){
  const o = orbFind(orbData(), u);
  if(!o || !o.c || o.lv >= ORB_ENH_COST.length) return;
  const cost = orbEnhCost(o);
  if(orbArmed !== "enh:" + u){ orbArmed = "enh:" + u; orbRefresh(); return; }
  orbArmed = "";
  if(!orbPay(cost)){ orbRefresh(); return; }
  let roll = ri(ORB_PT_MIN, ORB_PT_MAX);
  if(o.b === "steady") roll = Math.max(9, roll);
  if(o.b === "temper") roll += 1;
  const old = o.pt, got = [];
  o.pt += roll; o.lv++;
  for(let k = Math.floor(old / ORB_PT_STEP) + 1; k <= Math.floor(o.pt / ORB_PT_STEP); k++){
    if(o.a.length >= ORB_AFFIX_MAX) break;
    const d = pick(ORB_AFFIX), x = {k:d.id, v:ri(d.lo, d.hi), d:0};
    o.a.push(x); got.push(orbAffixText(x));
  }
  let dbl = "";
  if(old < ORB_DOUBLE_AT && o.pt >= ORB_DOUBLE_AT){
    const pool = o.a.filter(function(x){ return !x.d; });
    if(pool.length){ const x = pick(pool); x.d = 1; dbl = orbAffixText(x); }
  }
  commitPerm();
  toast(orbColorName(o) + L(" 第 " + o.lv + " 次强化 +", " · enhancement #" + o.lv + ": +") + roll + T(" 点（共 ") + o.pt + T("）") +
           (got.length ? T("　新词条：") + got.join(T("、")) : "") +
           (dbl ? T("　翻倍：") + dbl : ""));
  orbRefresh();
}
function orbSlotOf(u){ return orbData().eq.indexOf(u); }
/* 背包里的 = 没戴着的（用户 2026-09-23：「装备后宝珠会从背包里消失」）。
   ⚠️ 数据上 TOWN.orb.bag 还是**全部**宝珠、eq 记着戴的是哪几颗 —— 只是背包页不画戴着的。
      这样存档格式和存档码一个字节都不用动。 */
function orbLoose(){ return orbData().bag.filter(function(o){ return orbSlotOf(o.u) < 0; }); }
/* 戴到第 slot 个位置（slot 省略 = 第一个空位）；那个位置原来有一颗就换回背包 */
function orbPut(u, slot){
  const od = orbData(), o = orbFind(od, u);
  if(!o || !o.c) return;
  if(slot === undefined || slot < 0) slot = od.eq.indexOf(0);
  if(slot < 0){ toast(T("六个位置都满了，先在「人物」里卸下一颗。")); orbRefresh(); return; }
  const was = orbSlotOf(u);
  if(was >= 0) od.eq[was] = 0;
  od.eq[slot] = u;
  commitPerm();
  toast(orbColorName(o) + T(" 装备上了。"));
  orbRefresh();
}
function orbOff(u){
  const od = orbData(), at = orbSlotOf(u);
  if(at < 0) return;
  od.eq[at] = 0;
  commitPerm();
  orbRefresh();
}

/* ---- 界面 ---- */
function orbGemHtml(o){
  if(!o) return "<span class=\"orbgem none\"></span>";
  if(!o.c) return "<span class=\"orbgem unk\">?</span>";
  if(o.c === "rainbow") return "<span class=\"orbgem bow\"></span>";
  return "<span class=\"orbgem\" style=\"background:" + ORB_CMAP[o.c].c + "\"></span>";
}
function orbBtn(act, u, txt, cls, off){
  return "<button class=\"btn" + (cls ? " " + cls : "") + "\" type=\"button\" data-act=\"" + act +
         "\" data-u=\"" + u + "\"" + (off ? " disabled" : "") + ">" + txt + "</button>";
}
/* mode：bag 背包（鉴定 / 强化 / 装备）· cur 装备位上这颗（强化 / 卸下）· pick 弹窗里挑（装备）*/
function orbCardHtml(o, mode){
  mode = mode || "bag";
  const full = o.lv >= ORB_ENH_COST.length;
  let h = "<div class=\"orbcard" + (mode === "cur" ? " eq" : "") + "\">" + orbGemHtml(o) +
    "<div class=\"ocol\"><b>" + orbColorName(o) + (o.lv ? " +" + o.lv : "") + "</b>" +
    (o.c ? T("<em>点数 ") + o.pt + "</em>" : "") +
    "<span class=\"ob\">" + (o.b ? orbBaseText(o.b) : T("基础词缀：无")) + "</span>";
  /* 一条词条一个 <i>（inline-block）—— 折行只在两条之间折，别把「生命上限」拦腰切开 */
  if(o.a.length) h += "<span class=\"oa\">" + o.a.map(function(x){ return "<i>" + orbAffixText(x) + "</i>"; }).join("") + "</span>";
  h += "</div><div class=\"oacts\">";
  if(!o.c){
    h += orbBtn("id", o.u, T("鉴定"), "primary");
  } else if(mode === "pick"){
    h += orbBtn("put", o.u, orbPickSlot >= 0 && orbData().eq[orbPickSlot] ? T("换上") : T("装备"), "primary");
  } else {
    const cost = orbEnhCost(o), armed = orbArmed === "enh:" + o.u, poor = (TOWN.gem || 0) < cost;
    h += orbBtn("enh", o.u, full ? T("已满") : armed ? T("再点一次<br>") + cost + T(" 宝石") : T("强化<br>") + cost,
                armed ? "primary" : "", full || (poor && !armed));
    h += mode === "cur" ? orbBtn("off", o.u, T("卸下"), "ghost") : orbBtn("eq", o.u, T("装备"), "ghost");
  }
  return h + "</div></div>";
}
/* 改完任何东西都走这一个：背包页开着就重画背包页，挑宝珠的弹窗开着就重画弹窗 */
function orbRefresh(){
  if($("viewOrb").classList.contains("on")) renderOrbBag();
  if(!$("veilOrbPick").hidden) renderOrbPick();
  if(!$("veilOrbInfo").hidden) renderOrbInfo();
  if(!$("veilOrbShop").hidden) renderOrbShop();
}
function renderOrbBag(){
  const od = orbData();
  $("orbGemB").textContent = TOWN.gem || 0;
  Array.prototype.forEach.call(document.querySelectorAll(".osub"), function(b){
    b.classList.toggle("on", b.dataset.osub === orbSub);
  });
  $("orbBagPanel").hidden = orbSub !== "bag";
  $("orbMePanel").hidden = orbSub !== "me";
  if(orbSub === "bag"){
    const loose = orbLoose();
    $("orbBagHead").textContent = T("背包 ") + loose.length;   // 只写这一句 —— 右边要给两颗定宽的按钮留位置
    /* 背包是**定死大小的方格**（用户 2026-09-23）：格子里只有珠子、名字、强化等级，
       点一格才弹详情窗（鉴定 / 强化 / 装备都在那儿）。分解状态下点一格 = 勾选。
       排序：没鉴定的最前（等着处理），其余按颜色，同色强化高的在前。 */
    orbMeltSel = orbMeltSel.filter(function(u){ return loose.some(function(o){ return o.u === u; }); });
    const list = loose.sort(orbColorOrder);
    $("orbList").innerHTML = list.length ? list.map(function(o){
        const sel = orbMeltSel.indexOf(o.u) >= 0;
        return "<button class=\"orbtile" + (sel ? " sel" : "") + "\" type=\"button\" data-u=\"" + o.u + "\">" +
          orbGemHtml(o) + "<b>" + orbColorName(o) + "</b>" +
          "<em>" + (o.c ? (o.lv ? "+" + o.lv : T("未强化")) : T("点开鉴定")) + "</em>" +
          (o.b ? "<i>" + ORB_BMAP[o.b].n + "</i>" : "") + "</button>";
      }).join("")
      : "<div class=\"bagempty\">" + (od.bag.length ? T("都戴在身上了。") : T("还没有宝珠。主城里的「宝珠商店」有卖。")) + "</div>";
    /* 顶上钉住的分解按钮：平时一颗「分解」；进了挑选状态变成「取消」+「分解 N 颗」 */
    const mb = $("btnOrbMelt"), mg = $("btnOrbMeltGo"), n = orbMeltSel.length, armed = orbArmed === "melt";
    mb.textContent = orbMeltOn ? T("取消") : T("分解");
    mb.classList.toggle("on", orbMeltOn);
    /* ⚠️ 用 visibility 不用 hidden：那一格位置永远留着，进出分解状态时顶上这一行不变形 */
    mg.style.visibility = orbMeltOn ? "visible" : "hidden";
    mg.disabled = !n;
    mg.classList.toggle("primary", armed);
    mg.textContent = !n ? T("点宝珠勾选") : armed ? T("再点一次 · +") + n * ORB_MELT + T(" 宝石") : T("分解 ") + n + T(" 颗 · +") + n * ORB_MELT;
    $("orbList").classList.toggle("melting", orbMeltOn);
    return;
  }
  /* 人物：六个位置 + 总效果 */
  let h = "";
  for(let i = 0; i < ORB_SLOTS; i++){
    const o = od.eq[i] ? orbFind(od, od.eq[i]) : null;
    h += "<button class=\"orbslot" + (o ? "" : " empty") + "\" type=\"button\" data-slot=\"" + i + "\">" +
         orbGemHtml(o) + "<span>" + (o ? orbColorName(o) + (o.lv ? " +" + o.lv : "") : T("空")) + "</span></button>";
  }
  $("orbSlots").innerHTML = h;
  const b = orbBuild(od), on = orbOnLines(b), base = orbBaseLines(b), add = orbAddLines(b);
  let s = "";
  on.forEach(function(x){
    s += "<div class=\"orbfx\">" + orbGemHtml({c:x.c}) + "<b>" + ORB_CMAP[x.c].n + " " + x.t + "</b><span>" + x.s + "</span></div>";
  });
  base.forEach(function(t){ s += T("<div class=\"orbfx\"><b>词缀</b><span>") + t + "</span></div>"; });
  if(add.length) s += T("<div class=\"orbfx\"><b>词条</b><span class=\"oa\">") + add.map(function(t){ return "<i>" + t + "</i>"; }).join("") + "</span></div>";
  $("orbSets").innerHTML = s || T("<div class=\"bagempty\">还没有效果。同色 2 颗起生效。</div>");
  /* 全部颜色的效果表，收在 details 里（别堆提示文字） */
  let ref = "";
  ORB_COLORS.forEach(function(c){
    const st = ORB_SETS[c.id], cnt = b.cnt[c.id] || 0;
    ref += "<div class=\"orbfx ref\">" + orbGemHtml({c:c.id}) + "<b>" + c.n + " ×" + cnt + "</b><span>" +
      ORB_TIERS.filter(function(t){ return st[t]; }).map(function(t){
        return "<i" + (b.on[c.id + t] ? " class=\"lit\"" : "") + ">" + t + T("：") + st[t] + "</i>";
      }).join("") + "</span></div>";
  });
  $("orbRef").innerHTML = ref;
}

/* ---- 点装备位弹出来的那个窗（用户 2026-09-23）----
   空位：列出背包里鉴定过的，点一颗就戴到这个位置。
   有珠：顶上是这颗（能强化、能卸下），底下是背包里的，点一颗就换上。
   ⚠️ 跟祝福的弹层一样是**主城弹层**，故意不进 hideAll() / anyVeil()（那两张表是局内的）。 */
let orbPickSlot = -1;
function openOrbPick(slot){
  orbPickSlot = slot; orbArmed = ""
  renderOrbPick();
  $("veilOrbPick").hidden = false;
}
function closeOrbPick(){
  $("veilOrbPick").hidden = true; orbPickSlot = -1; orbArmed = "";
  orbRefresh();
}
function renderOrbPick(){
  const od = orbData(), cur = od.eq[orbPickSlot] ? orbFind(od, od.eq[orbPickSlot]) : null;
  $("orbPickTitle").textContent = L("第 " + (orbPickSlot + 1) + " 个位置", "Slot " + (orbPickSlot + 1)) + (cur ? " · " + orbColorName(cur) : T(" · 空着"));
  $("orbPickCur").innerHTML = cur ? orbCardHtml(cur, "cur") : "";
  $("orbPickCur").hidden = !cur;
  /* 按颜色排（用户 2026-09-23），同色强化高的在前 */
  const list = orbLoose().filter(function(o){ return o.c; }).sort(orbColorOrder);
  const unk = orbLoose().length - list.length;
  $("orbPickList").innerHTML = list.length ? list.map(function(o){ return orbCardHtml(o, "pick"); }).join("")
    : T("<div class=\"bagempty\">背包里没有鉴定过的宝珠") + (unk ? T("（还有 ") + unk + T(" 颗没鉴定）") : "") + T("。</div>");
}
/* 按颜色排（ORB_COLORS 的顺序），没鉴定的最前；同色强化高的在前、再按买的顺序 */
function orbColorOrder(a, b){
  const ia = a.c ? ORB_COLORS.indexOf(ORB_CMAP[a.c]) : -1, ib = b.c ? ORB_COLORS.indexOf(ORB_CMAP[b.c]) : -1;
  return ia - ib || b.lv - a.lv || a.u - b.u;
}

/* ---- 分解（用户 2026-09-23）：背包顶上那颗按钮进挑选状态，勾好了两步确认，一颗统一 ORB_MELT 宝石 ----
   只分得到背包里的（戴着的本来就不在背包里）。spent 不退 —— 它是「投入过多少」，合并存档时按它比。 */
function orbMeltToggle(){
  orbMeltOn = !orbMeltOn; orbMeltSel = []; orbArmed = ""
  renderOrbBag();
}
function orbMeltPick(u){
  const k = orbMeltSel.indexOf(u);
  if(k >= 0) orbMeltSel.splice(k, 1); else orbMeltSel.push(u);
  orbArmed = "";
  renderOrbBag();
}
function orbMeltGo(){
  if(!orbMeltSel.length) return;
  if(orbArmed !== "melt"){ orbArmed = "melt"; renderOrbBag(); return; }
  orbArmed = "";
  const od = orbData(), kill = {};
  let n = 0;
  orbMeltSel.forEach(function(u){ if(orbSlotOf(u) < 0 && orbFind(od, u)){ kill[u] = 1; n++; } });
  od.bag = od.bag.filter(function(o){ return !kill[o.u]; });
  orbMeltSel = []; orbMeltOn = false;
  toast(T("分解了 ") + n + T(" 颗，宝石 +") + n * ORB_MELT + T("。"));
  addGems(n * ORB_MELT);                 // 它自己 commitPerm()，宝珠的删除跟着一起落盘
  renderOrbBag();
}

/* ---- 点背包里的一格弹出来的详情窗：全部信息 + 鉴定 / 强化 / 装备 ----
   ⚠️ 主城弹层，跟祝福一样故意不进 hideAll() / anyVeil()。 */
function openOrbInfo(u){
  orbInfoU = u; orbArmed = ""
  renderOrbInfo();
  $("veilOrbInfo").hidden = false;
}
function closeOrbInfo(){
  $("veilOrbInfo").hidden = true; orbInfoU = 0; orbArmed = "";
  orbRefresh();
}
function renderOrbInfo(){
  const o = orbFind(orbData(), orbInfoU);
  if(!o){ closeOrbInfo(); return; }
  $("orbInfoTitle").textContent = orbColorName(o) + (o.lv ? " +" + o.lv : "");
  $("orbInfoBody").innerHTML =
    "<div class=\"orbinfohead\">" + orbGemHtml(o).replace("orbgem", "orbgem big") +
      "<span>" + (o.c ? T("点数 ") + o.pt + T(" · 强化 ") + o.lv + " / " + ORB_ENH_COST.length : T("还没鉴定，看不出颜色")) + "</span></div>" +
    "<p class=\"ob\">" + (o.b ? orbBaseText(o.b) : T("基础词缀：无")) + "</p>" +
    (o.a.length ? "<p class=\"oa\">" + o.a.map(function(x){ return "<i>" + orbAffixText(x) + "</i>"; }).join("") + "</p>"
                : (o.c ? T("<p class=\"ob dim\">还没有词条 —— 强化点数每满 10 抽一条。</p>") : ""));
  let h = "";
  if(!o.c) h += orbBtn("id", o.u, T("鉴定"), "primary");
  else {
    const full = o.lv >= ORB_ENH_COST.length, cost = orbEnhCost(o), armed = orbArmed === "enh:" + o.u;
    h += orbBtn("enh", o.u, full ? T("已满") : armed ? T("再点一次 · ") + cost + T(" 宝石") : T("强化 · ") + cost,
                armed ? "primary" : "", full || ((TOWN.gem || 0) < cost && !armed));
    h += orbBtn("eq", o.u, T("装备"), "");
  }
  $("orbInfoActs").innerHTML = h;
}

/* 两处列表共用一个点击处理 */
function orbActClick(e){
  const b = e.target.closest ? e.target.closest("button[data-act]") : null;
  if(!b || b.disabled) return;
  const u = +b.dataset.u, act = b.dataset.act;
  if(act !== "enh"){ orbArmed = ""; }
  if(act === "id") orbIdentify(u);
  else if(act === "enh") orbEnhance(u);
  else if(act === "eq"){ orbPut(u); if(!$("veilOrbInfo").hidden && orbSlotOf(u) >= 0) closeOrbInfo(); }
  else if(act === "off"){ orbOff(u); if(!$("veilOrbPick").hidden) closeOrbPick(); }
  else if(act === "put"){ orbPut(u, orbPickSlot); closeOrbPick(); }
}

/* ---- 宝珠商店：主城的一个地点（用户 2026-09-23 从底部标签挪到主城）---- */
function openOrbShop(){
  orbArmed = ""
  hideAll();
  renderOrbShop();
  $("veilOrbShop").hidden = false;
}
function closeOrbShop(){ $("veilOrbShop").hidden = true; orbArmed = ""; }
function renderOrbShop(){
  const shop = orbShop(), gem = TOWN.gem || 0;
  $("orbGemS").textContent = gem;
  $("orbShop").innerHTML = shop.map(function(s, i){
    const armed = orbArmed === "buy:" + i;
    return "<div class=\"orbcard shopcard" + (s.sold ? " sold" : "") + "\">" + orbGemHtml(s.sold ? null : {c:""}) +
      "<div class=\"ocol\"><b>" + (s.sold ? T("已售出") : T("未鉴定宝珠")) + "</b>" +
      (s.sold ? "" : "<span class=\"ob\">" + (s.b ? orbBaseText(s.b) : T("基础词缀：无")) + "</span>") +
      "</div><div class=\"oacts\">" +
      (s.sold ? "" : "<button class=\"btn" + (armed ? " primary" : "") + "\" type=\"button\" data-i=\"" + i + "\"" +
        (gem < ORB_PRICE && !armed ? " disabled" : "") + ">" +
        (armed ? T("再点一次<br>") : T("购买<br>")) + ORB_PRICE + T(" 宝石</button>")) +
      "</div></div>";
  }).join("");
  const re = $("btnOrbReroll"), armed = orbArmed === "re";
  re.textContent = armed ? T("再点一次 · ") + ORB_REROLL + T(" 宝石") : T("刷新 · ") + ORB_REROLL + T(" 宝石");
  re.classList.toggle("primary", armed);
  re.disabled = gem < ORB_REROLL && !armed;
}

let SCENE = "town";

/* 地牢那几块和主城面板互斥显示 */
function showScene(){
  const inRun = SCENE === "run";
  /* hudRow / barsRow 现在住在 stageBox 里面（.mapui 浮层），跟着 stage 一起显隐，不用单独管 */
  ["stageBox","log"].forEach(function(id){ $(id).hidden = !inRun; });
  $("townPanel").hidden = inRun;
  /* 探索时顶栏整块收起 —— 章节名挪进了地图浮层的「层」那一格，省下的高度全给地图 */
  $("topBar").hidden = inRun;
  /* 第三个标签：主城里是「背包」（宝珠），进了洞变回「遗物」（用户 2026-09-23）。
     点击时现读 data-view，所以换掉它就够了；正停在被换掉的那一页上就跟着换过去。 */
  const nb = $("navBag");
  if(nb){
    const want = inRun ? "viewRelic" : "viewOrb", gone = inRun ? "viewOrb" : "viewRelic";
    nb.dataset.view = want;
    nb.querySelector("i").textContent = inRun ? "✦" : "◎";
    nb.querySelector("span").textContent = inRun ? T("遗物") : T("背包");
    if($(gone).classList.contains("on")) showView(want);
  }
  $("hChap").textContent = CH.name;
  $("chapterTag").textContent = T("主城 · 灰岩镇");
  if(inRun) sizeMap();
}
function renderTown(){
  const M = meta();
  $("tGold").textContent = TOWN.gem;
  // 祝福那一格的小字：开了几个槽位（没开过就写价钱）
  const bs = $("blessSub");
  if(bs) bs.textContent = blessSlots()
    ? (T("已开 ") + blessSlots() + T(" / 10 个槽位"))
    : (T("用宝石换永久的好处 · ") + BLESS_SLOT_COST + T(" 宝石一个槽位"));
  const os = $("orbShopSub");
  if(os) os.textContent = T("宝珠 · ") + ORB_PRICE + T(" 宝石一颗，只在战场生效");
  $("tBest").textContent = M.best ? (T("第 ") + M.best + T(" 层")) : "—";
  $("tClears").textContent = M.clears || 0;
  $("tDeaths").textContent = M.deaths || 0;
  $("townFlavor").textContent = UI_EN
    ? (M.runs === 0 ? "You stand here for the first time. The cave mouth lies north of town; wind blows up from inside."
       : M.deaths ? "You're back again. Your pockets are empty, but your purse still has some weight."
                  : "Wind rises from the Stone Hall's mouth, smelling of rust.")
    : M.runs === 0
    ? "\u4f60\u7b2c\u4e00\u6b21\u7ad9\u5728\u8fd9\u513f\u3002\u6d1e\u53e3\u5728\u9547\u5b50\u5317\u8fb9\uff0c\u98ce\u4ece\u91cc\u9762\u5f80\u4e0a\u5439\u3002"
    : (M.deaths ? "\u4f60\u53c8\u56de\u6765\u4e86\u3002\u8eab\u4e0a\u7a7a\u4e86\uff0c\u53e3\u888b\u8fd8\u6709\u70b9\u91cd\u91cf\u3002"
                : "\u77f3\u5eca\u7684\u98ce\u4ece\u6d1e\u53e3\u5439\u4e0a\u6765\uff0c\u5e26\u7740\u94c1\u9508\u5473\u3002");
}
/* 回主城：身上的一切清空，重建一个空角色 */
function goTown(){
  SCENE = "town";
  tipOff();
  cancelWalk();
  autoOff();
  B = null; pendingLoot = null; pendingRoom = null; chestQ = null; reopenShop = null; pendingSwap = null;
  P = { x:0, y:0, lvl:1, xp:0, hp:CHAPTER.playerBase.hp, gold:0, kills:0,
        right:0, wrong:0, seenWords:[], used:{}, combo:0, maxCombo:0,
        relics:[], haunt:[], hauntAt:{}, undying:false };
  G = { floor:0, paused:true, over:true };
  resetHpFx();                           // 回主城重建了角色，血条动效的基准跟着清
  fuseOn = false; fuseSel = [];          // 合成的挑选状态跟着这一趟一起结束
  newRelics = [];                        // 「new」红点也是局内的界面状态，不进存档
  commit(false);       // 存档点之三：回到主城 —— 永久数据落盘，续玩档删掉
  hideAll();
  showScene();
  renderTown();
  renderHud();
  refreshSaveState();
  showView("viewAdv");
}
/* ================= 难度等级（用户 2026-09-21）=================
   **A 级 = 这个游戏本来的数值**，B/C/D 只放宽玩家攻击（+25% / +50% / +100%）。
   跟练习模式一样是**纯局前选项**：不进 OPT、不落盘，进洞那一下写进 P.diff，
   跟着续玩档走，数值在 stats() 最后一步结算。
   ⚠️ 两者**可以同时开**，攻击那两个倍率相乘只取整一次 ——
   所以 D 级 + 练习正好 ×1，等于白拿那 50 点护甲（用户定的）。
   流程：洞窟里点一条路 → 这个弹层选难度 → 才真的进（联机由房主选，见 coopProposeRoute）。*/
let diffOn = DIFF_DEFAULT;
let pendingRoute = null;         // 选难度的时候，等在门口的那条路线 id
function diffById(id){
  for(let i=0;i<DIFFS.length;i++) if(DIFFS[i].id === id) return DIFFS[i];
  return null;
}
/* 当前选的那一档 —— 存档/网络里传的都是它，认不出来就退回 A 级 */
function diffId(){ return diffById(diffOn) ? diffOn : DIFF_DEFAULT; }
/* 攻击倍率的唯一口径（stats() 和界面上的预览都走它），认不出来的一律当 A 级 */
function diffMult(id){
  const d = diffById(id);
  return d ? d.atkMult : 1;
}
/* 一行短说明：难度 + 练习模式合起来实际是多少攻击。
   ⚠️ 别在这儿写第二屏说明（CLAUDE.md「别堆提示文字」），一行就够。*/
function diffLine(id){
  const d = diffById(id);
  if(!d) return "";
  if(!practiceOn) return d.desc + (d.note ? " · " + d.note : "");
  // 练习模式开着：那两个倍率是乘起来的，直接把**实际**攻击倍率写出来，省得玩家自己算
  const mul = Math.round(d.atkMult * CHAPTER.practiceAtkMult * 100) / 100;
  return d.desc + T(" · 练习后实际 ×") + mul;
}
/* 选完路线弹出来的那个窗。联机里只有房主进得来（队友的路线卡片本来就点不动）。*/
function askDiff(routeId){
  const r = ROUTES.filter(function(x){ return x.id === routeId; })[0];
  if(!r || !r.open) return;
  pendingRoute = routeId;
  const sub = $("diffSub");
  if(sub) sub.textContent = r.name + " · " + r.tag;
  renderDiffList();
  $("veilDiff").hidden = false;
  tip("diff", "veilDiff");
}
function closeDiff(){
  pendingRoute = null;
  $("veilDiff").hidden = true;
}
function renderDiffList(){
  const box = $("diffList");
  if(!box) return;
  box.innerHTML = "";
  DIFFS.forEach(function(d){
    const b = document.createElement("button");
    b.type = "button";
    b.className = "route diff" + (d.id === diffOn ? " picked" : "");
    b.dataset.id = d.id;
    b.innerHTML = "<span class=\"rt\">" + d.tag + "</span>" +
      "<span class=\"rn\">" + d.name + "</span>" +
      "<span class=\"rd\">" + diffLine(d.id) + "</span>" +
      "<span class=\"rgo\">" + (COOP ? T("选这档 ▸") : T("进入 ▸")) + "</span>";
    box.appendChild(b);
  });
}
/* 选定一档：单人直接进洞；联机是房主在提议，要等队友确认。*/
function takeDiff(id){
  if(!diffById(id) || !pendingRoute) return;
  /* 联机：难度归房主。窗开着的这会儿队友要是断了，就别再往外提议了 —— 直接退回洞窟，
     那边会重新画成「等待队友连接…」。*/
  if(COOP && !(coopIsHost() && window.NET && NET.isConnected() && NET.hasMate())){
    closeDiff(); openCave(); return;
  }
  diffOn = id;
  const route = pendingRoute;
  closeDiff();
  if(COOP){ coopProposeRoute(route); return; }
  enterRoute(route);
}

/* 练习模式的开关：**纯局前选项**，不进设置存档 ——
   勾了之后 newRun() 把它写进 P.practice，那一趟才算数（数值在 stats() 里）。*/
let practiceOn = false;
function renderPractice(){
  const b = $("btnPractice");
  if(!b) return;
  b.classList.toggle("on", practiceOn);
  b.setAttribute("aria-pressed", practiceOn ? "true" : "false");
  if(b.firstChild && b.firstChild.nodeType === 3){
    b.firstChild.textContent = practiceOn ? T("练习模式 · 开") : T("练习模式 · 关");
  }
  /* 难度卡上那行字要写「练习后实际 ×几」，所以练习模式一变、开着的难度窗也得跟着重画
     （联机里房主的练习开关是从网络上来的，可能正好赶上难度窗开着）。*/
  const dv = $("veilDiff");
  if(dv && !dv.hidden) renderDiffList();
}
/* 这一章的词见过多少（用户 2026-09 要在洞窟的卡片上显示）——
   分母是这一章那几档难度的全部词（BYLV[难度]，无尽章是 3+4+5 三桶加起来），
   分子是**熟练度表 LEX 里已经有记录**的那些，
   也就是这个存档真的遇到过的。返回 0~100 的整数。
   ⚠️ 老存档里可能留着已经删掉的词（比如整类删掉的虚词），所以要过一遍 WMAP。*/
function chapterSeenPct(chId){
  const ch = chapterById(chId);
  if(!ch) return 0;
  let pool = [];
  chapterLvs(ch).forEach(function(l){ pool = pool.concat(BYLV[l] || []); });
  if(!pool.length) return 0;
  let seen = 0;
  pool.forEach(function(w){ if(LEX[lexKey(w)]) seen++; });
  return Math.round(seen / pool.length * 100);
}
function openCave(){
  renderPractice();
  setTimeout(function(){ tip(["route", "practice"], "veilCave"); }, 0);   // 卡片画完再闪
  const box = $("routeList");
  box.innerHTML = "";
  ROUTES.forEach(function(r){
    if(!forLearn(r)) return;                 // 学英语时没有「书冢」那一章
    const d = document.createElement("button");
    d.type = "button";
    d.className = "route" + (r.open ? "" : " off");
    d.disabled = !r.open;
    d.dataset.id = r.id;
    /* 卡片背后铺一条淡蓝：宽度就是这一章遇见过的词的比例，右上角再写一遍百分数。
       .rfill 是第一个子元素、压在文字底下（z-index 在 style.css 里）。*/
    const pct = chapterSeenPct(r.ch || 1);
    d.innerHTML = "<span class=\"rfill\" style=\"width:" + pct + "%\"></span>" +
      T("<span class=\"rpct\">遇见 ") + pct + "%</span>" +
      "<span class=\"rt\">" + r.tag + "</span>" +
      "<span class=\"rn\">" + r.name + "</span>" +
      "<span class=\"rd\">" + r.desc + "</span>" +
      (r.open ? T("<span class=\"rgo\">进入 ▸</span>") : T("<span class=\"rgo\">还没挖通</span>"));
    box.appendChild(d);
  });
  /* 联机：选哪条路由房主定，队友只能看、点了会走 coopConfirmEnter() 那条路。
     四档状态：没组队 → 房主没队友 → 房主可以选（或已经选了在等确认）→ 队友等/确认。
     练习模式也是房主统一定（联机方案.md）。*/
  if(COOP){
    const host = coopIsHost(), connected = window.NET && NET.isConnected(),
          hasMate = window.NET && NET.hasMate();
    const title = $("caveTitle"), note = $("caveConfirmNote"), confirmBtn = $("btnCaveConfirm");
    const disableAll = function(){ Array.prototype.forEach.call(box.children, function(d){ d.disabled = true; }); };
    note.hidden = true; confirmBtn.hidden = true;
    if(!connected){
      disableAll();
      if(title) title.textContent = T("还没组队");
      note.hidden = false; note.textContent = T("先回镇上点「组队」，创建或加入一个房间。");
    } else if(!hasMate){
      disableAll();
      if(title) title.textContent = T("等待队友连接…");
    } else if(host){
      if(title) title.textContent = coopProposedRoute ? T("已经选好了") : T("下去哪里？");
      if(coopProposedRoute){
        Array.prototype.forEach.call(box.children, function(d){
          d.classList.toggle("picked", d.dataset.id === coopProposedRoute);
        });
        note.hidden = false;
        note.textContent = T("难度 ") + (diffById(diffId()) || {}).name +
          T(" · 等队友确认…（还能重新选，选别的会覆盖掉这次）");
      }
    } else {
      // 队友：路线列表只看不点，靠下面这个按钮确认
      disableAll();
      if(coopProposedRoute){
        Array.prototype.forEach.call(box.children, function(d){
          d.classList.toggle("picked", d.dataset.id === coopProposedRoute);
        });
        if(title) title.textContent = T("房主选了这条路");
        // 难度也是房主定的，队友只能看 —— 写在确认钮上面那行字里
        note.hidden = false;
        note.textContent = T("难度 ") + (diffById(diffId()) || {}).name + " · " + diffLine(diffId());
        confirmBtn.hidden = false;
      } else if(title) title.textContent = T("等待房主选路线…");
    }
    const pb = $("btnPractice");
    if(pb) pb.disabled = !host;
  }
  $("veilCave").hidden = false;
}
/* 联机：房主点一条路 = 提出来，不会立刻进；队友点「确认，一起下去」才真的一起进。
   host 重新选一条会覆盖之前那次提议（队友要重新确认）。coopProposedRoute 声明在文件顶部。*/
function coopProposeRoute(id){
  const r = ROUTES.filter(function(x){ return x.id === id; })[0];
  if(!r || !r.open) return;
  coopProposedRoute = id;
  // 难度也是房主定的（用户 2026-09-21），跟路线一起提出去，队友照着显示
  NET.send({t:"route", id: id, diff: diffId()});
  openCave();
}
function coopConfirmEnter(){
  if(!coopProposedRoute) return;
  NET.send({t:"enterConfirm", id: coopProposedRoute});
  enterRoute(coopProposedRoute, true);
}
function enterRoute(id, fromNet){
  const r = ROUTES.filter(function(x){ return x.id === id; })[0];
  if(!r || !r.open || !forLearn(r)) return;
  setChapter(r.ch || 1);          // 路线决定这一趟是哪一章（词难度、怪、宝石倍率）
  pendingRoute = null;
  $("veilDiff").hidden = true;
  $("veilCave").hidden = true;
  SCENE = "run";
  showScene();
  newRun();            // 存档点之一：进入关卡（落盘在 newRun → nextFloor 里）
  refreshSaveState();
}

/* ================= 存档 =================
   规矩就一条：**读是自动的，存只有三下。**

   读：boot() 里有档就直接接着走，不弹窗不询问。
   存：只有这三个时刻落盘，别的地方（走路、战斗、拿遗物、买卖、切后台、定时器）
       一律不存 —— 以前那一堆兜底监听全删了，别再加回来。
         1. 进入关卡（enterRoute → newRun → nextFloor）
         2. 下一层（nextFloor）
         3. 回到主城（goTown；死亡 / 通关的结算 endRun 也算这一档）
   全部落盘走 commit()，一次把四个永久键 + 层存档一起写完。

   所以续玩档存的是「**刚踏进这一层时**的样子」：中途关页面 == 退回本层开头重来，
   这一层里打的怪、捡的金币、拿的遗物都不算数。 */
var RUN_KEY = "youxu.run.v1", RUN_V = 4;   // v2：地图改成 15×21；v4：改成 33×25 的房间图，
                                           // 存的是压成字符串的地图，行宽一变旧档就对不上，只能作废。
                                           // 作废的只有「没走完的那一趟」，宝石/熟练度/图鉴/统计都不受影响。
let booting = false;      // 为真时 commit 空转（整档覆盖后重载的那一小会儿）

/* 四个永久键一起写。导入存档也走这一条（那是存档管理，不动续玩档）。 */
function commitPerm(){
  if(booting) return;
  MET.t = Date.now();          // 存档信息卡拿它当「上次游玩」
  put(LEX_KEY, LEX);
  put(CODEX_KEY, CODEX);
  put(META_KEY, MET);
  put(TOWN_KEY, TOWN);
}
/* 三个存档点唯一的入口。keepRun=true 写这一层的快照，false 删掉续玩档（回镇上 / 这一趟结束）。 */
function commit(keepRun){
  if(booting) return;
  commitPerm();
  if(keepRun) writeRun(); else dropRun();
}

function packRow(row, f){ return row.map(f).join(""); }
function writeRun(){
  if(!P || !G || G.over || !G.map) return;
  try{
    put(RUN_KEY, {
      v: RUN_V, ch: CH.id, t: Date.now(),
      P: P,
      floor: G.floor,
      // 地图和已探索按行压成 "0110..." 字符串，整档才几 KB
      map:  G.map.map(function(r){ return packRow(r, function(v){ return v ? 1 : 0; }); }).join("|"),
      seen: G.seen.map(function(r){ return packRow(r, function(v){ return v ? 1 : 0; }); }).join("|"),
      stair: G.stair,
      rooms: G.rooms || null,        // 自动寻路要「先扫完当前这间屋子」，老档没有就退回全图最近
      // 怪只存 defId + 当前状态，读档时重新链回 FOES
      mobs: G.mobs.map(function(m){
        return {d:m.def.id, x:m.x, y:m.y, hp:m.hp, max:m.max,
                dmg:m.dmg, armor:m.armor, xp:m.xp, lt:m.loot || 0, ly:m.layer || 0, s:m.seen};
      }),
      things: G.things
    });
  }catch(e){}
}
function readRun(){
  const s = load(RUN_KEY, null);
  // 版本对不上直接丢，不写迁移。章节不再要求等于当前章 —— 存的是哪一章就接着哪一章走
  if(!s || s.v !== RUN_V || !chapterById(s.ch || 1)) return null;
  if(!s.P || !s.map || !s.seen || !s.mobs || !s.stair) return null;
  // ⚠️ 这里还没 setChapter，CH 仍是上一趟那一章 —— 上限要按**存档里那一章**算
  // 上限是**深渊那一层**（前四章 51，无尽章 Infinity），不是章末 Boss 那一层
  if(!s.floor || s.floor < 1 || s.floor > abyssFloor(chapterById(s.ch || 1))) return null;
  return s;
}
function dropRun(){ try{ localStorage.removeItem(RUN_KEY); }catch(e){} }
function foeDef(id){
  // 各章的 Boss 和守层者也得能找回来，不然续玩档一读，它们就凭空消失了
  // ⚠️ 无尽章的 boss 是 null（它没有章末 Boss），别在这儿点空
  for(let i=0;i<CHAPTERS.length;i++) if(CHAPTERS[i].boss && CHAPTERS[i].boss.id === id) return CHAPTERS[i].boss;
  if(id === GATEKEEPER.id) return GATEKEEPER;
  if(id === ABYSS.id) return ABYSS;          // 深渊那只（前四章第 51 层）
  for(let i=0;i<FOES.length;i++) if(FOES[i].id === id) return FOES[i];
  return null;
}
function unpackGrid(str, f){
  return str.split("|").map(function(row){ return row.split("").map(f); });
}
function resumeRun(s){
  setChapter(s.ch || 1);          // 先把章切对，下面的词难度/怪/结算才对得上
  P = s.P;
  // 旧档的 gear/bag 字段留着也无害，没人读它了                 // 老档兜底
  if(!P.relics) P.relics = [];
  P.relics = P.relics.filter(function(id){ return !!relicById(id); });   // 遗物被删掉的老档
  if(!P.haunt) P.haunt = [];
  if(!P.hauntAt) P.hauntAt = {};                 // 老档没记心魔的答错时间，hauntReady 会当成熬到了
  if(!P.gild || typeof P.gild !== "object") P.gild = {};   // 金坛（2026-09-25），老档没有
  if(typeof P.gildN !== "number") P.gildN = 0;
  if(typeof P.combo !== "number") P.combo = 0;   // 连击现在存在 P 上，老档没有这个字段
  if(typeof P.shield !== "number") P.shield = 0; // 护盾（第四批），老档没有
  if(typeof P.aegisN !== "number") P.aegisN = 0;
  if(typeof P.recoil !== "number") P.recoil = 0;  // 反震攒了几层
  // 回魂 2026-09-21 从「整趟一次」改成「本局 REVIVE_N 次」，字段从布尔变成计数
  if(typeof P.revived !== "number") P.revived = P.revived ? 1 : 0;
  if(!P.wrongSeen) P.wrongSeen = {};                         // 二见：这一趟错过哪些词
  if(typeof P.maxCombo !== "number") P.maxCombo = P.combo;   // 老档没有最大连击
  if(!P.used) P.used = {};                                   // 老档没有「这趟出过的词」
  if(typeof P.practice !== "boolean") P.practice = false;    // 老档没有练习模式
  if(!diffById(P.diff)) P.diff = DIFF_DEFAULT;               // 老档没有难度等级 —— 一律按 A 级算
  if(!P.accF) P.accF = {};                                   // 老档没有按层的答题记录
  if(!P.blessGot) P.blessGot = [];                           // 老档没有祝福·偏爱的本局记录
  if(typeof P.down !== "boolean") P.down = false;             // 老档没有「倒地」（联机第二期）
  if(typeof P.cleared !== "boolean") P.cleared = false;       // 老档没有「这一趟通关过没」（深渊）
  if(typeof P.abyss !== "number") P.abyss = 0;                // 老档没有「打穿了几层深渊」
  resetHpFx();                                               // 读档不该播一次掉血/回血动画
  G = { floor: s.floor, paused:false, over:false,
        map:  unpackGrid(s.map,  function(c){ return c === "1" ? 1 : 0; }),
        seen: unpackGrid(s.seen, function(c){ return c === "1"; }),
        vis: [], things: s.things || [], stair: s.stair, rooms: s.rooms || null, mobs: [] };
  /* 续玩档存的是「刚踏进这一层」的样子，所以这几个每层字段直接按新一层初始化。
     ⚠️ 开场那个 openLeft 是计数不是布尔，不补的话读档后这一层就白少三刀。*/
  G.openLeft = OPENING_N;
  G.corrodeArmor = 0;
  G.warmthUsed = false;
  G.floorWrong = 0;
  G.burlapUsed = false;
  G.nerveN = 0;
  G.reboundUsed = false;
  /* 第十批的每层计数，同理按新一层初始化 */
  G.tickN = 0;
  G.longN = 0;
  G.exorN = 0;
  G.calmsN = 0;
  G.stepArmor = 0;
  G.fastRun = 0;
  G.instantReady = false;
  G.wholeUsed = false;
  /* 第十一批的每层计数，同理按新一层初始化 */
  G.deflectN = 0;
  G.gaspUsed = false;
  G.bwallGot = 0;
  G.bwallBank = 0;
  G.sipBank = 0;
  G.riverBank = 0;
  /* 第九批「跨流派组合」的每层计数，同理按新一层初始化。
     ⚠️ G.healed（本层回了多少血）补成 0 —— 进层那几笔种子回血是**上一次**发的、
     血量已经存在档里了，这里重发就成了读档回血外挂。代价是读档那一层的
     「汗巾」「血锤」要重新攒，差一档（+2% 伤害 / +3 点伤），故意选的。*/
  G.healed = 0;
  G.needleN = 0;
  G.ropeN = 0;
  G.capN = 0;
  G.critShN = 0;
  G.songN = 0;
  G.bladeN = 0;
  G.glyphArmor = 0;
  G.lastPct = 0;
  // 游商货架上可能还摆着已经删掉的遗物（老档），先清一遍
  G.things.forEach(function(th){
    if(th && th.stock) th.stock = th.stock.filter(function(row){ return row.relic && relicById(row.relic.id); });
  });
  for(let y=0;y<H;y++) G.vis.push(new Array(W).fill(false));   // 视野是算出来的，不存
  s.mobs.forEach(function(m){
    const def = foeDef(m.d);
    if(!def) return;                     // 怪被删掉了就当它不存在，别崩
    // 弱点不进存档（makeFoe 里现算的），读档时照样式补一个：普通怪是自己那类，
    // Boss 重新掷一个词性 —— 以前这里整个漏了，读档后 Boss 就没有弱点了
    const boss = !!def.boss;
    G.mobs.push({x:m.x, y:m.y, def:def, g:def.g, name:def.name, art:def.art,
                 cat:def.cat, boss:boss, weak: boss ? pick(chapterPos()) : def.cat, weakPos:boss,
                 hp:m.hp, max:m.max, layer:m.ly || 1,
                 dmg:m.dmg, armor:m.armor, xp:m.xp, loot:m.lt || 0, seen:!!m.s});
  });
  /* 联机：怪身上的 cid / 两条血条 / 归谁砍**不进存档**（writeRun 里只存 defId + 状态），
     所以读档之后必须照 genFloor() 的规矩补一次，否则 coopDealDamage 的 m.cid 是 undefined、
     伤害根本不上报，#foeMateBar 也没数据。单人版 COOP 恒为 false，这句走不到。
     ⚠️ 它按数组下标发 cid —— 两人的续玩档来自同一份广播世界，顺序一致，所以 cid 对得上。
     重连之后角色可能翻转（房主掉线队友会被扶正），afterJoined 里还会再绑一次 side。*/
  if(COOP) coopPrepMobs();
  $("log").innerHTML = "";
  hideAll();
  fov(); buildGrid(); render(); renderHud();
  say("—— " + CH.name + T(" 第 ") + G.floor + T(" 层") + (inAbyss() ? T(" · 深渊") : "") + " ——", "crit");
  say(T("你回到了踏进这一层时的样子 —— 存档存在每层的入口。"), "sys");
  lockInput(320);
}
/* ================= 结算 ================= */
/* 返回的就是内存里那一份，改完等 commit() 落盘，别单独写 localStorage */
function meta(){ return MET; }
function gameOver(){ if(P && P.tut){ tutFinish(true); return; } endRun(false); }
/* 主动放弃：跟倒下一样走结算（用户 2026-09 改的，以前是一颗宝石都不给），
   但不算一次死亡 —— 统计里只加一次探索。 */
function giveUpRun(){
  if(SCENE === "run" && G && !G.over){
    if(P.tut){ tutFinish(true); return; }        // 教程关里点「放弃」= 跳过教程
    endRun(false, true);
  }
}
function chapterClear(){ endRun(true); }
/* 一趟的结算：局内表现算成分，再乘这一章的难度倍率 = 带回镇上的宝石。
   每一条都摆在结算界面上，玩家能自己把这笔账对一遍。数值在 content.js 的 SCORE 里。 */
function runScore(win){
  const total = P.right + P.wrong;
  const acc = total ? Math.round(P.right / total * 100) : 0;
  // 无尽章不封顶、深渊是第 51 层，所以上限取 abyssFloor()，走到哪算哪
  const floor = Math.min(G.floor, abyssFloor());
  /* 到达的层数**不再是一项加分，它是主倍率**（用户 2026-09）：
     宝石 =（下面这几项相加）× 层数倍率 × 这一章的难度系数。两个乘区，没有第三个。*/
  const rows = [
    {k:T("最大连击 ") + (P.maxCombo || 0),  v: (P.maxCombo || 0) * SCORE.perCombo},
    {k:T("击败 ") + P.kills + T(" 只"),        v: P.kills * SCORE.perKill},
    {k:T("正确率 ") + acc + "%",            v: Math.floor(acc / SCORE.accDiv)},
    {k:T("没花完的 ") + P.gold + T(" 金币"),   v: Math.floor((P.gold || 0) / SCORE.goldDiv)}
  ];
  if(win) rows.push({k:T("通关"), v: SCORE.clear});
  // 深渊：打穿无终之影一层给一份（用户 2026-09-22 加的那只，见 content.js 的 ABYSS）
  if(P.abyss) rows.push({k:T("深渊 · 打穿 ") + P.abyss + T(" 层"), v: P.abyss * SCORE.perAbyss});
  const sum = rows.reduce(function(a, r){ return a + r.v; }, 0);
  const fmul = Math.max(SCORE.floorMin, floor / SCORE.floorDiv);
  return {rows:rows, sum:sum, acc:acc, floor:floor, fmul:fmul,
          gems: Math.floor(sum * fmul * CH.gemMult)};
}
/* 这一层历史上的平均正确率（**不含本局** —— 本局的那一笔在 endRun 里才并进去）。
   没有历史记录就返回 null，界面上写「—」。 */
function histAcc(floor){
  const rec = MET.accF && MET.accF[String(floor)];
  if(!rec) return null;
  const t = (rec.r || 0) + (rec.w || 0);
  return t ? Math.round(rec.r / t * 100) : null;
}
/* 本局按层记下的答题数并进历史。只在一趟结束时调一次。 */
function foldAcc(){
  if(!P || !P.accF) return;
  if(!MET.accF) MET.accF = {};
  for(const k in P.accF){
    const inc = P.accF[k];
    if(!MET.accF[k]) MET.accF[k] = {r:0, w:0};
    MET.accF[k].r += inc.r || 0;
    MET.accF[k].w += inc.w || 0;
  }
}
function endRun(win, gaveUp){
  G.over = true;
  const M = meta();
  M.runs++;
  if(G.floor > M.best) M.best = Math.min(G.floor, abyssFloor());
  /* 深渊（用户 2026-09-22）是**通关之后的加时**：走过章末 Boss 那一层的时候就记了 P.cleared，
     所以倒在深渊里照样算这一章通关 —— 统计里记 clears、不记 deaths，宝石里的「通关」也照给。
     ⚠️ `win` 仍然只表示「走到了这一章的尽头之外」（chapterClear），现在基本只是兜底。*/
  const cleared = win || !!(P && P.cleared);
  const abyssEnd = !win && !!(P && P.cleared);
  if(cleared) M.clears++; else if(!gaveUp) M.deaths = (M.deaths || 0) + 1;
  // 遗物和金币都留在洞里 —— 带回镇上的是结算换来的**宝石**
  const sc = runScore(cleared);
  /* 历史平均要**在并进本局之前**算，不然等于跟自己比 */
  const hAcc = histAcc(sc.floor);
  foldAcc();
  addGems(sc.gems);    // 宝石一变就落盘
  commit(false);       // 存档点之三（上半截）：这一趟结束，人被抬回镇上，续玩档作废
  $("endTitle").textContent = win ? ((CH.boss ? CH.boss.name : T("这一章")) + T("倒下了"))
                                  : abyssEnd ? (gaveUp ? T("你从深渊里退了出来") : T("无终之影把你压了下去"))
                                  : gaveUp ? (T("你从第 ") + G.floor + T(" 层退了出来"))
                                           : (T("你倒在第 ") + G.floor + T(" 层"));
  $("endEyebrow").textContent = cleared
    ? (T("第") + chNo() + T("章 · 通关") + (P.abyss ? T(" · 深渊 ") + P.abyss + T(" 层") : ""))
    : gaveUp ? T("主动撤离") : T("你被抬回了镇上");
  /* 强调这一块（用户 2026-09）：本局正确率 vs 这一层历史上的平均正确率。
     高了标绿、低了标红，没有历史记录就写「—」。 */
  const dv = hAcc == null ? null : sc.acc - hAcc;
  $("endAcc").innerHTML =
    "<div class=\"accbox\">" +
      T("<div class=\"accone\"><i>本局正确率</i><b>") + sc.acc + "%</b></div>" +
      "<div class=\"accvs\">vs</div>" +
      T("<div class=\"accone\"><i>历史平均 · 第 ") + sc.floor + T(" 层</i><b>") +
        (hAcc == null ? "—" : hAcc + "%") + "</b></div>" +
    "</div>" +
    (dv == null ? T("<div class=\"accdiff\">这一层还没有历史记录，这一趟就是第一笔。</div>")
                : "<div class=\"accdiff " + (dv > 0 ? "up" : dv < 0 ? "down" : "") + "\">" +
                  (dv > 0 ? T("比你在这一层的平均高 ") + dv + T(" 个百分点")
                          : dv < 0 ? T("比你在这一层的平均低 ") + (-dv) + T(" 个百分点")
                                   : T("跟你在这一层的平均持平")) + "</div>");
  $("endStats").innerHTML =
    sc.rows.map(function(r){ return li(r.k, "+" + r.v); }).join("") +
    li(T("<b>小计</b>"), "<b>" + sc.sum + "</b>") +
    li(T("到达第 ") + sc.floor + T(" 层"), "×" + sc.fmul.toFixed(1)) +
    li(T("难度 · 第") + chNo() + T("章 ") + CH.level, "×" + Math.round(CH.gemMult * 100) + "%") +
    li(T("<b>获得宝石</b>"), "<b style=\"color:var(--q3)\">+" + sc.gems + "</b>") +
    li(T("宝石合计"), TOWN.gem) +
    (P.practice ? li(T("练习模式"), T("护甲 +50 · 攻击 −50%")) : "") +
    /* ⚠️ 这一行写「难度等级」不写「难度」—— 上面那行「难度 · 第N章」已经占了「难度」两个字
       （那是宝石的章节倍率），两行都叫难度会以为是同一件事。*/
    (P.diff !== DIFF_DEFAULT && diffById(P.diff)
       ? li(T("难度等级 · ") + diffById(P.diff).name, diffById(P.diff).desc) : "") +
    li(T("丢在洞里"), (P.relics.length || 0) + T(" 件遗物 · ") + P.gold + T(" 金币")) +
    li(T("这趟遇到的词"), P.seenWords.length + T(" 个")) +
    li(T("累计掌握"), Object.keys(LEX).filter(function(k){ return lexWord(k) && (LEX[k].str||0) >= 3; }).length + " / " + WORDS.length);
  const box = $("endWords");
  box.innerHTML = "";
  if(!P.seenWords.length){
    box.innerHTML = T("<div class=\"cx lost\"><div class=\"cn\">还没遇到任何词</div></div>");
  } else {
    P.seenWords.forEach(function(en){
      const w = WMAP[en], r = (w && LEX[lexKey(w)]) || {str:0};
      if(!w) return;
      const s = r.str || 0;
      const d = document.createElement("div");
      d.className = "cx " + (s >= 3 ? "w-ok" : r.wrong ? "w-bad" : "");
      d.innerHTML = "<div class=\"cn\"><span>" + arTag(w) + w.en + (w.py ? " <i class=\"py\">" + w.py + "</i>" : "") + "</span>" +
        "<span class=\"meta stars\">" + "★".repeat(s) + "☆".repeat(5-s) + "</span></div>" +
        "<div class=\"cd\">" + w.cn + T("　<span style=\"color:var(--faint)\">") + CAT_CN[w.cat] + "</span></div>";
      box.appendChild(d);
    });
  }
  $("btnAgain").textContent = T("回到镇上");
  hideAll();
  $("veilEnd").hidden = false;
  $("btnAgain").focus();
  if(win && CH.boss) say(CH.boss.name + T("碎成了石块。第") + chNo() + T("章结束。"), "crit");
}
function li(k,v){ return "<div class=\"li\"><span class=\"lb\">" + k + "</span><span class=\"am\">" + v + "</span></div>"; }

/* ================= 图鉴 ================= */
let cTab = "word";
/* 搜索词（用户 2026-09）：词库按英文/中文找，遗物按名字/效果/铭文找。
   纯界面状态，不进存档；每次打开图鉴都清空。 */
function codexFind(){
  const el = $("codexFind");
  return el ? el.value.trim().toLowerCase() : "";
}
function openCodex(tab){
  cTab = tab || cTab;
  Array.prototype.forEach.call(document.querySelectorAll(".tab"), function(b){
    b.classList.toggle("on", b.dataset.tab === cTab);
  });
  const M = meta();
  if(cTab === "bf"){
    const BM = load(BF_KEY, {best:0, kills:0, runs:0});
    $("codexTally").innerHTML = T("最深 <b>第 ") + (BM.best||0) + T(" 波</b>　击杀 <b>") + (BM.kills||0) +
      T("</b>　下场 <b>") + (BM.runs||0) + T("</b> 次");
  } else {
    $("codexTally").innerHTML = T("最深 <b>第 ") + M.best + T(" 层</b>　通关 <b>") + M.clears + T("</b> 次　探索 <b>") + M.runs + T("</b> 次");
  }
  const box = $("codexList");
  box.innerHTML = "";
  if(cTab === "bf"){
    /* 战场遗物：**同一批 228 件**，只是把词条换成战场里的说法（content.js 的 bfWord）。
       战场模式不写 CODEX，所以这一页没有「拿过几次」—— 别去蹭地牢那份计数，会看混。*/
    $("codexTitle").textContent = T("战场遗物");
    const q = codexFind();
    RELICS.map(function(R, i){ return {r:R, i:i}; })
      .sort(function(a, b){ return ((a.r.r||0) - (b.r.r||0)) || (a.i - b.i); })
      .map(function(x){ return x.r; })
      .filter(function(R){
        if(!q) return true;
        return (R.n + bfWord(R) + R.lore + (RAR_CN[R.r||0] || "")).toLowerCase().indexOf(q) >= 0;
      })
      .forEach(function(R){
        const d = document.createElement("div");
        d.className = "cx found";
        d.innerHTML =
          "<div class=\"cn\">" + R.n + "</div>" +
          "<div class=\"cd\" style=\"color:var(--q" + (R.r||0) + ")\">" + RAR_CN[R.r||0] + " · " + bfWord(R) + "</div>" +
          "<div class=\"cd\" style=\"font-family:var(--flavor);font-style:italic\">" + R.lore + "</div>";
        box.appendChild(d);
      });
  } else if(cTab === "leg"){
    const book = CODEX;
    $("codexTitle").textContent = T("遗物 ") + Object.keys(book).length + " / " + RELICS.length;
    /* 图鉴**默认全解锁**：名字、效果、铭文一律直接给，没拿过的只是没有计数。
       （用户定的，别再把没拿过的遮成 ▨▨。）
       顺序按品质**普通 → 神圣**排（content.js 里是按搭配线分组的，看图鉴时对不上）。
       同品质保持 RELICS 里的原顺序，所以用带下标的稳定排序。*/
    const q = codexFind();
    RELICS.map(function(R, i){ return {r:R, i:i}; })
      .sort(function(a, b){ return ((a.r.r||0) - (b.r.r||0)) || (a.i - b.i); })
      .map(function(x){ return x.r; })
      .filter(function(R){
        if(!q) return true;
        return (R.n + R.pw + R.lore + (RAR_CN[R.r||0] || "")).toLowerCase().indexOf(q) >= 0;
      })
      .forEach(function(R){
      const rec = book[R.id], d = document.createElement("div");
      d.className = "cx " + (rec ? "found" : "lost");
      d.innerHTML =
        "<div class=\"cn\">" + R.n + "<span class=\"meta\">" +
          (rec ? (T("初见第 ") + rec.depth + T(" 层 · 拿过 ") + rec.times + T(" 次")) : T("还没拿到过")) +
        "</span></div>" +
        "<div class=\"cd\" style=\"color:var(--q" + (R.r||0) + ")\">" + RAR_CN[R.r||0] + " · " + R.pw + "</div>" +
        "<div class=\"cd\" style=\"font-family:var(--flavor);font-style:italic\">" + R.lore + "</div>";
      box.appendChild(d);
    });
  } else {
    /* 标题只剩「词库」两个字（用户 2026-09）——
       掌握 / 遇见 / 总数三个数搬到了信息页那块「本章词汇」上，别在这儿再摆一遍。*/
    $("codexTitle").textContent = T("词库");
    const q = codexFind();
    Object.keys(BYCAT).forEach(function(cat){
      const hit = q ? BYCAT[cat].filter(function(w){
        return foldMarks(w.en).indexOf(foldMarks(q)) >= 0 || w.cn.toLowerCase().indexOf(q) >= 0 ||
               (w.py && w.py.normalize("NFD").replace(/[\u0300-\u036f']/g, "").toLowerCase()
                     .indexOf(q.normalize("NFD").replace(/[\u0300-\u036f']/g, "")) >= 0) ||
               (CAT_CN[cat] || "").toLowerCase().indexOf(q) >= 0;
      }) : BYCAT[cat];
      if(!hit.length) return;               // 这一类一个都没命中，连类名都别画
      const h = document.createElement("div");
      h.className = "eyebrow"; h.style.marginTop = "4px";
      h.textContent = CAT_CN[cat];
      box.appendChild(h);
      hit.forEach(function(w){
        const r = LEX[lexKey(w)];
        const s = r ? (r.str||0) : 0;
        const d = document.createElement("div");
        d.className = "cx " + (!r ? "lost" : s >= 3 ? "w-ok" : r.wrong ? "w-bad" : "");
        d.innerHTML =
          "<div class=\"cn\"><span>" + arTag(w) + w.en + (w.py ? " <i class=\"py\">" + w.py + "</i>" : "") + "</span>" +
            "<span class=\"meta " + (r ? "stars" : "") + "\">" +
            (r ? ("★".repeat(s) + "☆".repeat(5-s)) : T("还没遇到")) + "</span></div>" +
          "<div class=\"cd\">" + w.cn +
            (r && r.wrong ? T("　<span style=\"color:var(--blood)\">上次答错</span>") : "") + "</div>";
        box.appendChild(d);
      });
    });
  }
  if(!box.children.length){
    box.innerHTML = T("<div class=\"cx lost\"><div class=\"cn\">没找到「") +
      ($("codexFind") ? $("codexFind").value.trim() : "") + T("」</div></div>");
  }
  $("veilCodex").hidden = false;
}
function hideAll(){
  clearQTimer();          // 战斗窗要是被顺手藏掉了，读条别还在后台走
  ["veilBattle","veilEnd","veilCodex","veilHelp","veilRelic","veilSwap","veilAltar","veilGild","veilForge","veilChest","veilShop","veilStair","veilSpring","veilFuse","veilBless","veilBlessPick"].forEach(function(id){ $(id).hidden = true; });
}
/* ⚠️ veilFuseGot **故意不进 hideAll**：材料已经砸掉了，窗一被顺手藏掉那一件就没了。
   它只进 anyVeil（挡住键盘走路），玩家必须挑一件才关得掉。*/
function anyVeil(){
  const ids = ["veilBattle","veilEnd","veilCodex","veilHelp","veilRelic","veilSwap","veilAltar","veilGild","veilForge","veilChest","veilShop","veilStair","veilSpring","veilFuse","veilFuseGot","veilBless","veilBlessPick"];
  for(let i=0;i<ids.length;i++) if(!$(ids[i]).hidden) return $(ids[i]);
  return null;
}

/* ================= 云存档 · 存档码 =================
   界面上只有两个按钮：**复制存档码** / **粘贴存档码**。没有服务器 ——
   这个站是纯静态的，所以「云」就是那段码本身：数据全装在码里，谁拿着码谁就拿着存档。

   码里**只有永久数据**：四门语言的熟练度 / 遗物图鉴 / 探索记录 / 宝石 + 祝福 + 宝珠 / 教程走过没。
   **局内数据（没走完的那一趟）一个字节都不进去** —— 它是「换设备」用的，不是「续上这一层」用的。
   导入是**合并取优**，不是覆盖 —— 免得从旧设备导一次就把新进度抹了。

   现在生成的是**第三版 YX3**（2026-09-23，用户嫌 YX2 太长），同一份档只有 YX2 的五分之一上下。三招：
     · **自适应区间编码**（LZMA 那一套二进制区间编码器）：每一个 bit 都按「前面同类的 bit 是 0 多还是 1 多」
       现算概率去压 —— 熟练度大多是「见过一两次、熟练度 1、没错」，「哪些词有记录」一段一段扎堆，
       这些规律全被它吃掉，不用再手工挑位图还是间隔表。
     · **一个字装 12 bit**：字节流最后换成 CJK 扩展 A 的字（U+3400 起的 4096 个生僻字），
       一个字顶 base64 的两个字符。生僻字拼不出敏感词、没有 Unicode 规范化的问题；看着是乱码，本来就是。
     · **写读共用一份 `codeIO(io)`**：io.enc 为真时读存档往码里写，否则从码里读出来 —— 字段顺序只写一遍。
   ⚠️ **新数据只许往 `codeIO()` 的 `secs` 末尾追加一段**：码头上记着「有几段」，老版本读完自己认识的就收手，
      老码到新版本上少几段就少几段（跟 YX2 末尾那几个「1 bit 有没有」一个道理，只是不用再一层层 try）。
   ⚠️ **概率的上下文只许看「已经读出来的值」**，别去看本地词库（比如按词的难度分上下文）——
      词库变了（校验对不上）的时候那一段照样得原样读过去，上下文跟写的时候不一样，后面整串就全错位了。
   ⚠️ 熟练度照旧按**词库下标**存，带 `nWords + 前 nWords 个词的 16 位校验`：往词库末尾追加不影响老码，
      中间插 / 删 / 重排会被查出来、只跳过那一门的熟练度。**加词只往末尾追加。** 遗物图鉴同理。
   老码 YX2（紧凑位流）/ YX1（JSON + base64）**只读、不再生成**，下面 parseCode2() 那一套就是为它们留的。 */
var CODE_TAG = "YX1.";          // 老码（JSON + base64），只读
var CODE2_TAG = "YX2";          // 老码（紧凑位流），只读
var CODE2_V = 2;
var CODE3_TAG = "YX3";          // 现在生成的
var CODE3_CH0 = 0x3400;         // 一个字 = 12 bit：U+3400 ~ U+43FF

/* ---- 16 位校验：既给「词库有没有变过」用，也给「码有没有被截断」用 ---- */
function hash16(list){
  let h = 0x1234;
  for(let i=0;i<list.length;i++){
    const s = String(list[i]);
    for(let j=0;j<s.length;j++) h = ((h * 31 + s.charCodeAt(j)) & 0xFFFF);
    h = ((h * 31 + 1) & 0xFFFF);
  }
  return h;
}
/* ⚠️ 学中文时 WORDS 换成了中文那一份 —— 所以一律显式传词库 */
function wordsHash(n, list){
  const a = [];
  for(let i=0;i<n;i++) a.push(list[i][0]);
  return hash16(a);
}
/* 读码时认哪一份词表：校验对上现在这份就用它；中文词库 2026-09-24 原位换过一批词（ZH_PAST，见 words-zh.js），
   老码是按旧词算的校验 —— 拿旧词替回去再算一遍，对上了就按旧词当键读回来（旧词的熟练度留着不用，不会串到新词上）。
   都对不上返回 null。*/
function lexList(n, list, h){
  if(n > list.length) return null;
  if(wordsHash(n, list) === h) return list;
  if(typeof ZH_WORDS !== "undefined" && list === ZH_WORDS && typeof ZH_PAST !== "undefined"){
    for(let k=0;k<ZH_PAST.length;k++){
      const past = ZH_PAST[k];
      const alt = list.slice(0, n).map(function(w, i){ return past[i] ? [past[i]] : w; });
      if(wordsHash(n, alt) === h) return alt;
    }
  }
  return null;
}
function relicsHash(n){
  const a = [];
  for(let i=0;i<n;i++) a.push(RELICS[i].id);
  return hash16(a);
}
function sumHash(bytes){
  let h = 0x9E37;
  for(let i=0;i<bytes.length;i++) h = ((h * 31 + bytes[i]) & 0xFFFF);
  return h;
}

/* ---- 区间编码器（YX3）：跟 LZMA 的 rc 一模一样，概率 11 位、每次往实际结果挪 1/32 ----
   不带 bytes = 写，带 = 读。读过了头一律当 0 —— 写的时候末尾的 0 字节本来就是剪掉的。
   JS 的数是 double，low 最多 33 位也装得下，所以不用拆高低位。 */
function RcIO(bytes){
  this.enc = !bytes;
  this.range = 0xFFFFFFFF;
  this.p = {};                                   // 上下文 → 「这一位是 0」的概率（满 2048）
  if(this.enc){ this.low = 0; this.cache = 0; this.pend = 1; this.out = []; }
  else { this.b = bytes; this.i = 0; this.code = 0; for(let k=0;k<4;k++) this.code = this.code * 256 + this.byte(); }
}
RcIO.prototype.byte = function(){ return this.i < this.b.length ? this.b[this.i++] : 0; };
RcIO.prototype.shift = function(){               // 写：吐出 low 的最高字节（进位要回头补给前面压着的 0xFF）
  if(this.low < 0xFF000000 || this.low >= 0x100000000){
    const carry = this.low >= 0x100000000 ? 1 : 0;
    let c = this.cache;
    do{ this.out.push((c + carry) & 255); c = 255; }while(--this.pend);
    this.cache = (this.low >>> 24) & 255;
  }
  this.pend++;
  this.low = (this.low & 0xFFFFFF) * 256;
};
RcIO.prototype.code1 = function(p, b){           // 按概率 p 写 / 读一位
  const bound = (this.range >>> 11) * p;
  if(this.enc){
    if(b){ this.low += bound; this.range -= bound; } else this.range = bound;
    while(this.range < 0x1000000){ this.range *= 256; this.shift(); }
  } else {
    if(this.code < bound){ this.range = bound; b = 0; }
    else { this.code -= bound; this.range -= bound; b = 1; }
    while(this.range < 0x1000000){ this.range *= 256; this.code = this.code * 256 + this.byte(); }
  }
  return b;
};
/* 下面这几个写的时候传值进去、读的时候传什么都行，都返回那个值 */
RcIO.prototype.bit = function(key, b){           // 带上下文的一位
  const p = this.p[key] || 1024;
  b = this.code1(p, b ? 1 : 0);
  this.p[key] = b ? p - (p >> 5) : p + ((2048 - p) >> 5);
  return b;
};
RcIO.prototype.raw = function(v, k){             // k 位不压的（校验值）
  let x = 0;
  for(let i=k-1;i>=0;i--) x = x * 2 + this.code1(1024, (v >> i) & 1);
  return x;
};
RcIO.prototype.sym = function(key, v, k){        // 0 ~ 2^k-1 的小数：按位走一棵二叉树
  let x = 1;
  for(let i=k-1;i>=0;i--) x = x * 2 + this.bit(key + x, (v >> i) & 1);
  return x - (1 << k);
};
RcIO.prototype.num = function(key, v){           // 非负整数：先说有几位，再逐位写（Elias-gamma）
  v = this.enc ? Math.max(0, Math.round(v || 0)) + 1 : 0;
  let n = 0, x = 1;
  while(this.bit(key + "~" + n, v >= Math.pow(2, n + 1))) if(++n > 52) throw new Error(T("码坏了"));
  for(let i=n-1;i>=0;i--) x = x * 2 + this.bit(key + n + "." + i + (i >= n - 2 ? "/" + x : ""), Math.floor(v / Math.pow(2, i)) & 1);
  return x - 1;
};
/* 「n 个里哪几个有」：先写个数，再逐个写有没有，上下文是「前 8 个里有几个」（记录是一段一段扎堆的）。
   个数凑够了后面就全是没有、剩下的全得有，这两种都不用写。on：写的时候是布尔数组。*/
RcIO.prototype.set = function(key, n, on){
  let left = this.num(key + "#", on ? on.filter(Boolean).length : 0), near = 0;
  if(left > n) throw new Error(T("码里的条数比词库还多"));
  const out = [], got = new Uint8Array(n);
  for(let i=0;i<n && left>0;i++){
    const b = (n - i === left) ? 1 : this.bit(key + near, on && on[i]);
    if(b){ out.push(i); got[i] = 1; left--; }
    near += b - (i >= 8 ? got[i - 8] : 0);
  }
  return out;
};
RcIO.prototype.finish = function(){
  for(let k=0;k<5;k++) this.shift();
  const out = this.out.slice(1);                 // 第一个字节永远是 0
  while(out.length && !out[out.length - 1]) out.pop();
  return out;
};

/* ---- 码里有什么，写读共用这一份 ---- 返回 mergeData 吃的 {lex, codex, meta, town}，外加 note（要跟玩家说的话）*/
function codeIO(io){
  const E = io.enc, out = {lex:{}, codex:{}, meta:{accF:{}}, town:{}}, notes = [], nR = RELICS.length;
  let relOk = true;
  const many = function(n){ if(n > 99999) throw new Error(T("码坏了")); return n; };
  /* 一门语言的熟练度：词数 + 前缀校验 + 哪些词有记录 + 每个词（见过几次 → 熟练度 → 上次错没错，前一个给后一个当上下文）*/
  function lex(list, pre){
    const n = io.num("wn", list.length), h = io.raw(E ? wordsHash(n, list) : 0, 16);
    const got = E ? list : lexList(n, list, h), ok = !!got;
    io.set("w", n, E ? list.map(function(w){ return !!LEX[pre + w[0]]; }) : null).forEach(function(i){
      const rec = E ? LEX[pre + list[i][0]] : {};
      const seen = io.num("ws", rec.seen);
      const str = Math.min(5, io.sym("wt" + Math.min(seen, 4), Math.max(0, Math.min(5, rec.str || 0)), 3));
      const wrong = io.bit("wr" + str + (seen > 1 ? "+" : ""), (rec.wrong || 0) > 0);
      if(!E && ok) out.lex[pre + got[i][0]] = {str:str, seen:seen, wrong:wrong};
    });
    if(!ok) notes.push(T("词库变过了，这串码里的熟练度跳过了"));
  }
  const secs = [
    function(){ lex(EN_WORDS, ""); },
    function(){                                            // 遗物图鉴：按 RELICS 下标
      const n = io.num("rn", nR), h = io.raw(E ? relicsHash(n) : 0, 16);
      relOk = E || (n <= nR && relicsHash(n) === h);
      io.set("r", n, E ? RELICS.map(function(r){ return !!CODEX[r.id]; }) : null).forEach(function(i){
        const c = E ? CODEX[RELICS[i].id] : {};
        const depth = io.num("rd", c.depth), times = io.num("rt", c.times);
        if(!E && relOk) out.codex[RELICS[i].id] = {depth:depth, times:times};
      });
      if(!relOk) notes.push(T("遗物表变过了，图鉴跳过了"));
    },
    function(){                                            // 探索记录 + 每层答题数（层号按间隔存）
      const M = E ? meta() : {}, acc = M.accF || {};
      ["best", "runs", "clears", "deaths"].forEach(function(k){ out.meta[k] = io.num("m" + k, M[k]); });
      const fk = Object.keys(acc).map(Number).filter(function(f){
        return f >= 0 && acc[f] && (acc[f].r || acc[f].w);
      }).sort(function(a, b){ return a - b; });
      let f = -1;
      for(let k = 0, n = many(io.num("fn", fk.length)); k < n; k++){
        f += 1 + io.num("ff", fk[k] - f - 1);
        out.meta.accF[f] = {r:io.num("fr", E && acc[f].r), w:io.num("fw", E && acc[f].w)};
      }
    },
    function(){                                            // 宝石 + 祝福（开没开 1 位，开了的再存钉着哪一件的下标 +1）
      out.town.gem = io.num("g", TOWN.gem);
      const B = E ? fixBless(TOWN.bless) : blankBless();
      ["fav", "ban"].forEach(function(kind){
        for(let r = 0; r < 5; r++){
          if(!io.bit("bo", B.open[kind][r])) continue;
          const at = io.num("bp", E ? RELICS.findIndex(function(x){ return x.id === B.pick[kind][r]; }) + 1 : 0) - 1;
          if(!E){ B.open[kind][r] = 1; if(relOk && at >= 0 && at < nR) B.pick[kind][r] = RELICS[at].id; }
        }
      });
      out.town.bless = B;
    },
    function(){                                            // 宝珠：颜色 / 基础 / 词条都按 orb.js 三张表的下标 +1 存（0 = 不认识）
      const src = E ? TOWN.orb : {bag:[], eq:[]}, od = {seq:0, spent:io.num("os", src.spent), bag:[], eq:[]};
      const n = many(io.num("on", src.bag.length));
      for(let k = 0; k < n; k++){
        const o = src.bag[k] || {a:[]};
        const c = io.num("oc", o.c ? ORB_COLORS.indexOf(ORB_CMAP[o.c]) + 1 : 0) - 1;
        const b = io.num("ob", o.b ? ORB_BASE.indexOf(ORB_BMAP[o.b]) + 1 : 0) - 1;
        const lv = io.num("ol", o.lv), pt = io.num("op", o.pt), a = [];
        for(let j = 0, na = many(io.num("oa", o.a.length)); j < na; j++){
          const x = o.a[j] || {};
          const ai = io.num("ok", x.k ? ORB_AFFIX.indexOf(ORB_AMAP[x.k]) + 1 : 0) - 1;
          const v = io.num("ov", x.v), d = io.bit("od", x.d);
          if(ORB_AFFIX[ai]) a.push({k:ORB_AFFIX[ai].id, v:v, d:d});
        }
        od.bag.push({u:k + 1, c:ORB_COLORS[c] ? ORB_COLORS[c].id : "", b:ORB_BASE[b] ? ORB_BASE[b].id : "",
                     lv:lv, pt:pt, a:a});
      }
      od.seq = n;
      for(let i = 0; i < ORB_SLOTS; i++){                   // 装备位存背包里的第几颗（+1，0 = 空），读回来正好就是 uid
        let at = 0;
        for(let k = 0; k < src.bag.length; k++) if(src.eq[i] && src.bag[k].u === src.eq[i]){ at = k + 1; break; }
        od.eq.push(io.num("oe", at));
      }
      out.town.orb = od;
    },
    function(){ lex(ZH_WORDS, ""); out.meta.tut = io.bit("tut", MET.tut); },
    function(){ lex(ES_WORDS, "es:"); },                   // 西语 / 日语的键带前缀（见 lexKey()），码里按下标存所以不用管
    function(){ lex(JA_WORDS, "ja:"); }
    /* ⚠️ 新的一段只许加在这儿（最后）*/
  ];
  const ns = io.num("n", secs.length);
  for(let i = 0; i < ns && i < secs.length; i++) secs[i]();
  out.note = notes.join(T("；"));
  return out;
}

/* ---- 生成：字节流 → 两个字节的校验 + 正文，每 3 个字节换成 2 个字 ---- */
function makeCode(){
  const io = new RcIO(null);
  codeIO(io);
  const body = io.finish();
  while((body.length + 2) % 3) body.push(0);             // 读过头本来就当 0，补几个 0 不碍事
  const ck = sumHash(body), all = [ck & 255, ck >> 8].concat(body);
  let s = CODE3_TAG;
  for(let i = 0; i < all.length; i += 3){
    const v = all[i] * 65536 + all[i + 1] * 256 + all[i + 2];
    s += String.fromCharCode(CODE3_CH0 + (v >> 12), CODE3_CH0 + (v & 4095));
  }
  return s;
}
function parseCode3(txt){
  const s = txt.slice(CODE3_TAG.length), bytes = [];
  if(s.length < 2 || s.length % 2) throw new Error(T("码短了"));
  for(let i = 0; i < s.length; i += 2){
    const a = s.charCodeAt(i) - CODE3_CH0, b = s.charCodeAt(i + 1) - CODE3_CH0;
    if(a < 0 || a > 4095 || b < 0 || b > 4095) throw new Error(T("码里混进了别的字符"));
    const v = a * 4096 + b;
    bytes.push(v >> 16, (v >> 8) & 255, v & 255);
  }
  const body = bytes.slice(2);
  if(sumHash(body) !== (bytes[0] | (bytes[1] << 8))) throw new Error(T("校验对不上 —— 复制的时候少了一截或者多带了字符"));
  return codeIO(new RcIO(body));
}

/* ================ 老码（只读）================ */
function b64dec(s){                                        // YX1：UTF-8 字符串的 base64
  const bin = atob(s), b = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) b[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(b);
}
function b64uToBytes(s){                                   // YX2：裸字节的无填充 base64url
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while(s.length % 4) s += "=";
  const bin = atob(s), out = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) out[i] = bin.charCodeAt(i);
  return out;
}
/* YX2 的位流：低位在前。vint = 每次 7 位数据 + 1 位「还有下一段」 */
function BitR(bytes){ this.bytes = bytes; this.i = 0; }
BitR.prototype.bits = function(k){
  let v = 0;
  for(let j=0;j<k;j++){
    const byteAt = this.i >> 3;
    if(byteAt >= this.bytes.length) throw new Error(T("码短了"));
    if(this.bytes[byteAt] & (1 << (this.i & 7))) v |= (1 << j);
    this.i++;
  }
  return v;
};
BitR.prototype.vint = function(){
  let v = 0, scale = 1;
  for(;;){
    const chunk = this.bits(7), more = this.bits(1);
    v += chunk * scale;
    if(!more) return v;
    scale *= 128;
  }
};
/* 末尾追加的那几段：前面 1 bit「有没有」，老码读到底就当没有 */
BitR.prototype.more = function(){ try{ return this.bits(1); }catch(e){ return 0; } };
/* 稀疏下标表：开头 1 bit 记是位图还是间隔表 */
function getSet(r, n){
  const count = r.vint(), out = [];
  if(!count) return out;
  if(count > n) throw new Error(T("码里的条数比词库还多"));
  if(r.bits(1) === 0){
    for(let i=0;i<n;i++) if(r.bits(1)) out.push(i);       // n 个 bit 要全部读完，不然位流错位
  } else {
    let prev = -1;
    for(let k=0;k<count;k++){ prev += r.vint() + 1; out.push(prev); }
  }
  if(out.length !== count) throw new Error(T("码里的条数对不上"));
  if(out.length && out[out.length-1] >= n) throw new Error(T("码里的下标超出范围"));
  return out;
}
/* 一门语言的熟练度：nWords + 前缀校验 + 稀疏表 + 每词 7 bit（熟练度 3 + 错没错 1 + 见过几次 3，7 = 逃逸）*/
function getLex(r, list, out, pre, notes){
  const nW = r.vint(), wh = r.vint();
  const got = lexList(nW, list, wh), ok = !!got;
  const idx = getSet(r, nW);
  for(let k=0;k<idx.length;k++){
    const str = r.bits(3), wrong = r.bits(1);
    let seen = r.bits(3);
    if(seen === 7) seen = 7 + r.vint();
    if(ok) out[(pre || "") + got[idx[k]][0]] = {str:str, seen:seen, wrong:wrong};
  }
  if(!ok) notes.push(T("词库变过了，这串码里的熟练度跳过了"));
}
function parseCode2(txt){
  const bytes = b64uToBytes(txt.slice(CODE2_TAG.length));
  if(bytes.length < 4) throw new Error(T("码太短了"));
  const body = Array.prototype.slice.call(bytes, 0, bytes.length - 2);
  const want = bytes[bytes.length-2] | (bytes[bytes.length-1] << 8);
  if(sumHash(body) !== want) throw new Error(T("校验对不上 —— 复制的时候少了一截或者多带了字符"));
  const r = new BitR(body);
  if(r.bits(8) !== CODE2_V) throw new Error(T("这串码是别的版本生成的"));
  const out = {lex:{}, codex:{}, meta:{accF:{}}, town:{}}, notes = [];

  getLex(r, EN_WORDS, out.lex, "", notes);

  const nR = r.vint(), rh = r.vint();
  const relicsOk = (nR <= RELICS.length && relicsHash(nR) === rh);
  const ri = getSet(r, nR);
  for(let k=0;k<ri.length;k++){
    const depth = r.vint(), times = r.vint();
    if(relicsOk) out.codex[RELICS[ri[k]].id] = {depth:depth, times:times};
  }
  if(!relicsOk) notes.push(T("遗物表变过了，图鉴跳过了"));

  out.meta.best = r.vint(); out.meta.runs = r.vint();
  out.meta.clears = r.vint(); out.meta.deaths = r.vint();
  const nA = r.vint();
  for(let k=0;k<nA;k++){
    const f = r.vint(), rr = r.vint(), ww = r.vint();
    out.meta.accF[String(f)] = {r:rr, w:ww};
  }

  out.town.gem = r.vint();
  const bl = blankBless(), order = [];
  ["fav", "ban"].forEach(function(kind){
    for(let i=0;i<5;i++){ bl.open[kind][i] = r.bits(1); if(bl.open[kind][i]) order.push([kind, i]); }
  });
  order.forEach(function(slot){
    const at = r.vint() - 1;
    if(relicsOk && at >= 0 && at < nR) bl.pick[slot[0]][slot[1]] = RELICS[at].id;
  });
  out.town.bless = bl;

  if(r.more()){                                            // 宝珠
    const od = {seq:0, spent:r.vint(), bag:[], eq:[]}, n = r.vint();
    for(let k = 0; k < n; k++){
      const c = r.vint(), b = r.vint(), lv = r.vint(), pt = r.vint(), na = r.vint(), a = [];
      for(let j = 0; j < na; j++){
        const ai = r.vint(), v = r.vint(), d = r.bits(1);
        if(ORB_AFFIX[ai]) a.push({k:ORB_AFFIX[ai].id, v:v, d:d});
      }
      od.bag.push({u:k + 1, c: c && ORB_COLORS[c - 1] ? ORB_COLORS[c - 1].id : "",
                   b: b && ORB_BASE[b - 1] ? ORB_BASE[b - 1].id : "", lv:lv, pt:pt, a:a});
    }
    od.seq = n;
    for(let i = 0; i < ORB_SLOTS; i++) od.eq.push(r.vint());
    out.town.orb = od;
  }
  if(r.more()){                                            // 中文 + 教程 → 西语 → 日语
    getLex(r, ZH_WORDS, out.lex, "", notes);
    out.meta.tut = r.bits(1);
    if(r.more()){
      getLex(r, ES_WORDS, out.lex, "es:", notes);
      if(r.more()) getLex(r, JA_WORDS, out.lex, "ja:", notes);
    }
  }
  out.note = notes.join(T("；"));
  return out;
}
/* 四种都认：新码 YX3、老码 YX2 / YX1、以及直接粘进来的存档文件 JSON */
function applyCode(txt){
  txt = (txt || "").trim();
  if(!txt) return T("剪贴板里没有存档码。");
  /* 测试口令（用户 2026-09-23 要的）：粘贴「audience2006」直接 +10000 宝石，次数不限 */
  if(txt === "audience2006"){ addGems(10000); return T("测试口令：宝石 +10000（现在 ") + TOWN.gem + T(" 颗）。"); }
  /* 特殊口令（用户 2026-09-25）：粘贴「snow」解锁设置页的「答题时间」，自己填秒数 */
  if(txt.toLowerCase() === "snow"){
    OPT.snow = true; saveOpt(); renderQTimeSet();
    return T("口令输入成功：设置页多了「答题时间」，可以自己填秒数。");
  }
  let o;
  const code = txt.replace(/[\s\u200B-\u200D\uFEFF]+/g, "");   // 聊天软件会插空格 / 换行 / 零宽字符
  if(txt.charAt(0) === "{"){
    try{ o = JSON.parse(txt); }
    catch(e){ return T("这段文本读不出来 —— 像是存档文件但缺了一截。"); }
  } else if(code.indexOf(CODE3_TAG) === 0 || code.indexOf(CODE2_TAG) === 0){
    try{ o = code.indexOf(CODE3_TAG) === 0 ? parseCode3(code) : parseCode2(code); }
    catch(e){ return T("这串码读不出来：") + e.message + T("。"); }
  } else if(code.indexOf(CODE_TAG) === 0){
    try{ o = JSON.parse(b64dec(code.slice(CODE_TAG.length))); }
    catch(e){ return T("这串老码读不出来，多半是复制时漏了一截。"); }
  } else {
    return T("这不像存档码 —— 它应该以 ") + CODE3_TAG + T(" 开头。");
  }
  if(!o || typeof o !== "object" || !o.lex) return T("这串码里没有存档数据。");
  const note = o.note;
  const res = mergeData(o);
  return T("导入成功：更新了 ") + res.words + T(" 个词，补上 ") + res.legs + T(" 件遗物")
       + (res.gold ? (T("，宝石 +") + res.gold + T(" 颗")) : "") + T("。")
       + (note ? (T("（") + note + T("）")) : "");
}
/* 合并取优 —— 导出码和本地存档文件共用这一套。
   吃 {lex, codex, meta, town, run}，缺哪块跳过哪块，任何一块都不会让这台设备倒退。 */
function mergeData(o){
  let better = 0;
  for(const k in (o.lex || {})){
    const inc = o.lex[k], cur = LEX[k];
    if(!inc || typeof inc !== "object") continue;
    // 取熟练度高的那份；平手就取见得多的
    if(!cur || (inc.str||0) > (cur.str||0) ||
       ((inc.str||0) === (cur.str||0) && (inc.seen||0) > (cur.seen||0))){
      LEX[k] = {str:inc.str||0, seen:inc.seen||0, wrong:inc.wrong||0};
      better++;
    }
  }

  let legs = 0;
  for(const k in (o.codex || {})){
    const inc = o.codex[k];
    if(!inc) continue;
    if(!CODEX[k]){ CODEX[k] = inc; legs++; }
    else CODEX[k] = {depth: Math.min(CODEX[k].depth, inc.depth),
                     times: Math.max(CODEX[k].times, inc.times)};
  }

  const M = meta(), im = o.meta || {};
  M.best = Math.max(M.best||0, im.best||0);
  M.runs = Math.max(M.runs||0, im.runs||0);
  M.clears = Math.max(M.clears||0, im.clears||0);
  M.deaths = Math.max(M.deaths||0, im.deaths||0);
  /* 今日学习：同一天取并集 / 取大值，不同天留日期新的那边（日期串按数字比）*/
  if(im.day && im.day.d && im.day.ws){
    const dn = function(x){ return x.split("-").map(Number).reduce(function(a, v){ return a * 100 + v; }, 0); };
    const cur = M.day;
    if(!cur || !cur.d || dn(im.day.d) > dn(cur.d)) M.day = {d:im.day.d, r:im.day.r || 0, w:im.day.w || 0, ws:Object.assign({}, im.day.ws)};
    else if(cur.d === im.day.d){
      cur.r = Math.max(cur.r || 0, im.day.r || 0); cur.w = Math.max(cur.w || 0, im.day.w || 0);
      cur.ws = Object.assign(cur.ws || {}, im.day.ws);
    }
  }
  if(im.tut) M.tut = 1;              // 新手教程：哪边走过都算走过（一个账号一次）
  if(typeof im.tips === "number") M.tips = (M.tips | 0) | im.tips;   // 第一趟的提示：看过哪条取并集
  /* 每层答题记录（历史平均正确率用的）：两边**相加** ——
     它是「一共答过多少题」，不是进度，取大值会白丢一边的记录。*/
  if(!M.accF) M.accF = {};
  for(const fk in (im.accF || {})){
    const inc = im.accF[fk];
    if(!inc) continue;
    if(!M.accF[fk]) M.accF[fk] = {r:0, w:0};
    M.accF[fk].r += inc.r || 0;
    M.accF[fk].w += inc.w || 0;
  }

  // 镇上存款取多的那边，**不相加** —— 免得来回导两次就凭空富了
  const before = TOWN.gem || 0;
  const inGem = (o.town && (typeof o.town.gem === "number" ? o.town.gem : o.town.gold)) || 0;
  TOWN.gem = Math.max(before, inGem);
  /* 祝福：**整份取开得多的那一边**，不做并集 —— 跟存款同一个道理，
     两边各开一半再并起来，等于一次的钱开出两个槽位。 */
  const inBless = fixBless(o.town && o.town.bless);
  let inN = 0, myN = blessSlots();
  ["fav", "ban"].forEach(function(k){ for(let r = 0; r < 5; r++) if(inBless.open[k][r]) inN++; });
  if(inN > myN) TOWN.bless = inBless;
  /* 宝珠：**整份取「在宝珠上花得多」的那一边**（spent = 买 + 刷新 + 强化花掉的宝石累计），
     不做并集 —— 并起来就是一份钱买出两份宝珠。本机的商店货架不动（码里本来也不带）。 */
  if(o.town && o.town.orb){
    const inOrb = fixOrb(o.town.orb);
    if(inOrb.spent > (TOWN.orb.spent || 0)){ inOrb.shop = TOWN.orb.shop; TOWN.orb = inOrb; }
  }

  /* 导入是玩家自己点的，就地写一次盘 —— 它不是游戏里的那三个存档点，而是存档管理本身；
     不马上写的话玩家关掉页面会以为导入没生效。只写永久数据，
     磁盘上那份层存档一个字节都不动（下面单独判断要不要接管）。 */
  commitPerm();

  /* 战场模式的记录：三项都取大值 / 相加，跟宝石一个规矩（battle.js 拥有这个键）。
     ⚠️ 这个对象是**整份重拼**出来的，所以 battle.js 往里加的字段必须在这儿一条条接上，
        漏一个就会在「导入一次存档」之后静默消失。现在有两个：
        `tb`（每个难度层的最深波数，解锁用）**按层取大值**；
        `run`（战场没走完的那一趟）**本机有就一点不动**，跟地牢的层存档一个规矩。 */
  if(o.bf && typeof o.bf === "object"){
    const mine = load(BF_KEY, {best:0, kills:0, runs:0});
    const tb = Object.assign({}, mine.tb || {});
    const ob = o.bf.tb || {};
    for(const k in ob) tb[k] = Math.max(tb[k] || 0, ob[k] || 0);
    put(BF_KEY, {best: Math.max(mine.best || 0, o.bf.best || 0),
                 kills: (mine.kills || 0) + (o.bf.kills || 0),
                 runs:  (mine.runs  || 0) + (o.bf.runs  || 0),
                 tb,
                 run: mine.run || o.bf.run || null});
  }

  // 没走完的那一趟：只有这台设备手头没有在进行的探索时才接过来，有就一点不动
  let gotRun = false;
  if(o.run && o.run.P && !readRun() && !(SCENE === "run" && G && !G.over)){
    if(o.run.v === RUN_V && chapterById(o.run.ch || 1)){ put(RUN_KEY, o.run); gotRun = true; }
  }

  renderHud();
  if(SCENE === "town") renderTown();
  refreshSaveState();
  return {words:better, legs:legs, gold:(TOWN.gem - before), run:gotRun};
}

/* ================= 本地存档文件 =================
   导出码只带永久数据；这里是「整台设备的存档」—— 连没走完的那一趟一起打成一个 .json 文件，
   文件在玩家自己手里：换浏览器、清过缓存、换设备，选回文件就接着玩。
   选中（或拖进来）之后**立刻把文件读出来**，先把里面有什么摊在卡片上，再让玩家决定合并还是覆盖。 */
var FILE_TAG = "youxu-huilang", FILE_V = 1;
let pendingFile = null;          // 已经读出来、等玩家点确认的那份存档

/* 导出的是**内存里的现状**（永久数据），加上磁盘上那份层存档。
   不在这里落盘 —— 存档点只有三个，导出不是其中之一。 */
function snapshot(){
  return {
    game: FILE_TAG, v: FILE_V, app: "幽墟回廊", ch: CH.id, t: Date.now(),
    lex: LEX, codex: CODEX, meta: meta(),
    town: TOWN, opt: OPT, run: load(RUN_KEY, null),
    /* 战场模式的记录（battle.js 自己写这个键，game.js 只负责让它跟着搬家）*/
    bf: load(BF_KEY, null)
  };
}
function pad2(n){ return (n < 10 ? "0" : "") + n; }
function fmtTime(t){
  if(!t) return T("不详");
  const d = new Date(t);
  return d.getFullYear() + "-" + pad2(d.getMonth()+1) + "-" + pad2(d.getDate()) +
         " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}
function agoText(t){
  if(!t) return T("不详");
  const mins = Math.max(1, Math.round((Date.now() - t) / 60000));
  return mins < 60 ? (mins + T(" 分钟前"))
       : mins < 1440 ? (Math.round(mins/60) + T(" 小时前"))
       : (Math.round(mins/1440) + T(" 天前"));
}
/* 一份存档（本地的或刚读出来的文件）摊成信息表 —— 导入前后看的是同一张表，好对数 */
function tally(o){
  const lex = o.lex || {}, keys = Object.keys(lex);
  const mastered = keys.filter(function(k){ return (lex[k].str||0) >= 3; }).length;
  const M = o.meta || {}, r = o.run;
  return li(T("存档时间"), fmtTime(o.t || M.t))
       + li(T("上次游玩"), agoText(o.t || M.t))
       + li(T("词汇"), T("掌握 ") + mastered + T(" / 遇到 ") + keys.length + T(" / 共 ") + WORDS.length)
       + li(T("遗物图鉴"), Object.keys(o.codex || {}).length + " / " + RELICS.length + T(" 件"))
       + li(T("最深 / 通关 / 探索"), T("第 ") + (M.best||0) + T(" 层　") + (M.clears||0) + T(" 次　") + (M.runs||0) + T(" 趟"))
       + li(T("镇上宝石"), ((o.town && (typeof o.town.gem === "number" ? o.town.gem : o.town.gold)) || 0) + T(" 颗"))
       + li(T("没走完的探索"), r && r.P ? (T("第 ") + r.floor + T(" 层 · Lv.") + r.P.lvl + " · " + Math.max(0, r.P.hp) + T(" 血")) : T("无"));
}
function fileMsg(t){ $("fileMsg").textContent = t || ""; }
function closeFileCard(){ pendingFile = null; $("fileCard").hidden = true; $("fileIn").value = ""; }

function downloadSave(){
  const txt = JSON.stringify(snapshot());
  const name = "youxu-huilang-" + (function(d){
    return d.getFullYear() + pad2(d.getMonth()+1) + pad2(d.getDate()) + "-" + pad2(d.getHours()) + pad2(d.getMinutes());
  })(new Date()) + ".json";
  try{
    const url = URL.createObjectURL(new Blob([txt], {type:"application/json"}));
    const a = document.createElement("a");
    a.href = url; a.download = name; a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ try{ URL.revokeObjectURL(url); a.remove(); }catch(e){} }, 8000);
    return T("已导出 ") + name + T("（约 ") + Math.max(1, Math.round(txt.length/1024)) + T(" KB）—— 去浏览器的下载列表里找它。");
  }catch(e){
    codeBoxShow(txt, true);        // 下载被挡了就退回下面那个框，至少能手动复制走
    return T("这个浏览器挡了下载。存档已经放进下面「云存档」那个框里，手动复制走一样能用。");
  }
}
/* 认三种东西：本游戏的存档文件、存成文本的导出码、以及裸 JSON（有 lex 就行） */
function parseSave(txt){
  txt = (txt || "").replace(/^\uFEFF/, "").trim();
  if(!txt) return {err:T("这个文件是空的。")};
  let o = null;
  if(txt.charAt(0) === "{"){
    try{ o = JSON.parse(txt); }
    catch(e){ return {err:T("这个文件读不出来 —— 内容不完整，或者根本不是存档。")}; }
  } else if(txt.indexOf(CODE_TAG) === 0){
    try{ o = JSON.parse(b64dec(txt.replace(/\s+/g, "").slice(CODE_TAG.length))); }
    catch(e){ return {err:T("文件里的导出码读不出来，多半是复制时漏了一截。")}; }
  } else {
    return {err:T("这不是幽墟回廊的存档文件。")};
  }
  if(!o || typeof o !== "object") return {err:T("这不是幽墟回廊的存档文件。")};
  if(o.game && o.game !== FILE_TAG) return {err:T("这是别的东西的存档，不是幽墟回廊的。")};
  if(!o.lex || typeof o.lex !== "object") return {err:T("文件里没有词汇数据，不像是这个游戏的存档。")};
  return {data:o};
}
/* 选中就读 —— 不用再点一次「读取」，读完直接把信息摊出来 */
function takeFile(file){
  closeFileCard();
  if(!file) return;
  if(file.size > 8 * 1024 * 1024){ fileMsg(T("这个文件有 ") + Math.round(file.size/1048576) + T("MB，太大了，不像是存档。")); return; }
  fileMsg(T("正在读 ") + file.name + " …");
  const fr = new FileReader();
  fr.onerror = function(){ fileMsg(T("这个文件读不出来 —— 换一份试试。")); };
  fr.onload = function(){
    const r = parseSave(String(fr.result || ""));
    if(r.err){ fileMsg(r.err); return; }
    pendingFile = r.data;
    $("fileName").textContent = file.name;
    $("fileInfo").innerHTML = tally(r.data);
    $("fileCard").hidden = false;
    fileMsg(T("读出来了 —— 对一眼上面的数字，再决定怎么导入。"));
  };
  fr.readAsText(file);
}
/* 整档覆盖：本地几个键全换掉，然后重载页面。
   重载最干净 —— 页面上到处是旧数字；重载完开局流程会自动接着文件里那一趟走。 */
function overwriteAll(o){
  booting = true;                  // 重载前锁住 commit，别把刚导入的档又被内存里的旧数据盖回去
  put(LEX_KEY, o.lex || {});
  put(CODEX_KEY, o.codex || {});
  put(META_KEY, o.meta || {best:0, runs:0, clears:0, t:0});
  put(TOWN_KEY, o.town || {gem:0});
  if(o.opt && typeof o.opt === "object") put(OPT_KEY, o.opt);
  if(o.bf && typeof o.bf === "object") put(BF_KEY, o.bf);
  if(o.run && o.run.P && o.run.v === RUN_V && chapterById(o.run.ch || 1)) put(RUN_KEY, o.run);
  else try{ localStorage.removeItem(RUN_KEY); }catch(e){}
  setTimeout(function(){ try{ location.reload(); }catch(e){} }, 700);
}

/* ================= 事件 ================= */
document.addEventListener("keydown", function(ev){
  if(ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const v = anyVeil();
  if(v){
    // 正在输入框里打字（图鉴搜索）：键盘全交给它，别被 Enter/Esc 的快捷键抢走
    const tag = ev.target && ev.target.tagName;
    if(tag === "INPUT" || tag === "TEXTAREA"){
      if(ev.key === "Escape") ev.target.blur();
      return;
    }
    if(v.id === "veilBattle"){
      if(/^[1-4]$/.test(ev.key) && B && !B.locked && B.q && B.q.type !== "spell"){
        const b = $("opts").children[+ev.key - 1];
        if(b){ ev.preventDefault(); b.click(); }
      } else if(ev.key === "Enter" && !$("btnNextQ").hidden){
        ev.preventDefault(); $("btnNextQ").click();
      }
      return;
    }
    if(ev.key === "Enter"){
      const b = v.querySelector(".btn.primary");
      if(b){ ev.preventDefault(); b.click(); }
    } else if(ev.key === "Escape"){
      if(v.id === "veilBlessPick") closeBlessPick();       // 挑遗物的窗：Esc = 退回祝福那一页
      else if(v.id === "veilCodex" || v.id === "veilHelp" || v.id === "veilFuse" || v.id === "veilBless") v.hidden = true;
      else if(v.id === "veilStair") closeStair(false);       // Esc = 再待一会儿
    }
    return;
  }
  const k = ev.key.toLowerCase(), rep = !!ev.repeat;
  if(k === "arrowup" || k === "w"){ ev.preventDefault(); tryMove(0,-1,rep); }
  else if(k === "arrowdown" || k === "s"){ ev.preventDefault(); tryMove(0,1,rep); }
  else if(k === "arrowleft" || k === "a"){ ev.preventDefault(); tryMove(-1,0,rep); }
  else if(k === "arrowright" || k === "d"){ ev.preventDefault(); tryMove(1,0,rep); }
  else if(k === "escape"){ cancelWalk(); render(); }
});
$("map").addEventListener("click", function(ev){
  const c = ev.target.closest(".c");
  if(!c || G.paused || G.over) return;
  if(coopLocked()){ coopNoteLocked(); return; }   // 怪没清完，双方都不能自己动（联机方案.md）
  const x = +c.dataset.x, y = +c.dataset.y;
  // 站在阶梯上再点一下脚下这格 = 重新问「要不要下去」（上次选了「再待一会儿」的退路）
  autoOff();        // 自己点了地图 = 关掉自动寻路
  if(x === P.x && y === P.y && G.stair && x === G.stair.x && y === G.stair.y){ askStair(); return; }
  goTo(x, y);
});
$("btnSpeak").addEventListener("click", function(){ if(B && B.q) speak(spellOf(B.q.word)); });
$("btnSpellSpeak").addEventListener("click", function(){ if(B && B.q) speak(spellOf(B.q.word)); });
$("btnNextQ").addEventListener("click", function(){
  if(!B) return;
  if(B.won) closeBattleWin();
  else nextQuestion();
});
$("btnFlee").addEventListener("click", flee);

/* ---- 底部标签切换 ---- */
function showView(id){
  Array.prototype.forEach.call(document.querySelectorAll(".view"), function(v){
    v.classList.toggle("on", v.id === id);
  });
  Array.prototype.forEach.call(document.querySelectorAll(".nav"), function(b){
    b.classList.toggle("on", b.dataset.view === id);
  });
  // 地图在隐藏时量不到尺寸，切回来必须重算一次
  if(id === "viewAdv") sizeMap();
  // 进设置页就把本地存档重读一遍，省得看着上一趟的数字
  if(id === "viewSet") refreshSaveState();
  // 宝珠的两页：换页就把没点完的两步确认和上一条消息清掉
  if(id === "viewOrb"){ orbArmed = ""; orbMeltOn = false; orbMeltSel = []; renderOrbBag(); }
}
Array.prototype.forEach.call(document.querySelectorAll(".nav"), function(b){
  b.addEventListener("click", function(){ showView(b.dataset.view); });
});

/* ---- 宝珠：背包 / 人物 / 商店（用户 2026-09-23）---- */
Array.prototype.forEach.call(document.querySelectorAll(".osub"), function(b){
  b.addEventListener("click", function(){ orbSub = b.dataset.osub; orbArmed = ""; orbMeltOn = false; orbMeltSel = []; renderOrbBag(); });
});
/* 背包的方格：平时点开详情窗，分解状态下点 = 勾选 */
$("orbList").addEventListener("click", function(e){
  const b = e.target.closest ? e.target.closest(".orbtile") : null;
  if(!b) return;
  if(orbMeltOn) orbMeltPick(+b.dataset.u); else openOrbInfo(+b.dataset.u);
});
$("btnOrbMelt").addEventListener("click", orbMeltToggle);
$("btnOrbMeltGo").addEventListener("click", orbMeltGo);
$("orbInfoActs").addEventListener("click", orbActClick);
$("btnOrbInfoClose").addEventListener("click", closeOrbInfo);
$("orbPickCur").addEventListener("click", orbActClick);
$("orbPickList").addEventListener("click", orbActClick);
$("btnOrbPickClose").addEventListener("click", closeOrbPick);
/* 人物：点一个装备位就弹窗（空位挑一颗戴上；有珠的看它、强化、卸下或换一颗）*/
$("orbSlots").addEventListener("click", function(e){
  const b = e.target.closest ? e.target.closest(".orbslot") : null;
  if(b) openOrbPick(+b.dataset.slot);
});
$("btnOrbShop").addEventListener("click", openOrbShop);
$("btnOrbShopClose").addEventListener("click", closeOrbShop);
$("orbShop").addEventListener("click", function(e){
  const b = e.target.closest ? e.target.closest("button[data-i]") : null;
  if(!b || b.disabled) return;
  if(orbArmed.indexOf("buy:") !== 0) orbArmed = "";
  orbBuy(+b.dataset.i);
});
$("btnOrbReroll").addEventListener("click", function(){
  if(orbArmed !== "re") orbArmed = "";
  orbReroll();
});

/* ---- 设置 ---- */
$("optSpeak").checked = OPT.speak !== false;
$("optAuto").checked = OPT.auto !== false;
$("optSpeak").addEventListener("change", function(){ OPT.speak = this.checked; saveOpt(); });
$("optAuto").addEventListener("change", function(){ OPT.auto = this.checked; saveOpt(); });
/* 答题时间（「snow」口令解锁，见 qCustom()）。输入框失焦 / 回车才生效，空着或乱填就退回当前值 */
function renderQTimeSet(){
  const box = $("qtimeSet");
  if(!box) return;
  box.hidden = !OPT.snow;
  const c = qCustom(), inp = $("optQTime");
  if(document.activeElement !== inp) inp.value = c > 0 ? c : (c === 0 ? "" : QUIZ_TIME);
  inp.placeholder = c === 0 ? "∞" : "";
  $("btnQTimeOff").classList.toggle("on", c === 0);
  $("btnQTimeReset").classList.toggle("on", c < 0);
}
$("optQTime").addEventListener("change", function(){
  const v = Math.round(Number(this.value));
  if(this.value !== "" && v >= 1){
    OPT.qtime = Math.min(999, v); saveOpt();
    toast(L("答题时间：", "Answer time: ") + OPT.qtime + L(" 秒", "s"));
  }
  renderQTimeSet();
});
$("optQTime").addEventListener("keydown", function(e){ if(e.key === "Enter") this.blur(); });
$("btnQTimeOff").addEventListener("click", function(){
  OPT.qtime = 0; saveOpt(); renderQTimeSet(); toast(T("答题不限时"));
});
$("btnQTimeReset").addEventListener("click", function(){
  delete OPT.qtime; saveOpt(); renderQTimeSet();
  toast(L("答题时间恢复默认 ", "Answer time reset to ") + QUIZ_TIME + L(" 秒", "s"));
});
renderQTimeSet();
/* 发音（用户 2026-09-24：「浏览器的发音怪怪的」）：挑声音的逻辑在 util.js（voicesFor / pickVoice），这里只管设置页。
   声音按学习语言分开记（OPT.voice.en / .zh …）—— 声音名是这台设备自己的，所以跟 OPT 走、不进存档码。 */
const RATES = [0.7, 0.9, 1.05];
function applySpeakPref(){
  const vv = OPT.voice && OPT.voice[LANG_LEARN];
  SPEAK_PREF.voice = typeof vv === "string" ? vv : "";
  SPEAK_PREF.rate = RATES.indexOf(OPT.rate) >= 0 ? OPT.rate : 0.9;
}
function voiceLabel(v){ return v.name.replace(/\s+-\s+.*$/, "") + " · " + String(v.lang).replace(/_/g, "-"); }
function renderVoiceSet(){
  const sel = $("optVoice");
  if(!CAN_SPEAK){ $("voiceSet").hidden = true; return; }
  const list = voicesFor(), cur = SPEAK_PREF.voice;
  sel.innerHTML = "";
  const add = function(val, txt){ const o = document.createElement("option"); o.value = val; o.textContent = txt; sel.appendChild(o); };
  if(!list.length){ add("", T("这台设备没有这门语言的语音")); sel.disabled = true; $("btnVoiceTry").disabled = true; }
  else{
    sel.disabled = false; $("btnVoiceTry").disabled = false;
    add("", T("自动") + " · " + voiceLabel(pickVoice() || list[0]));
    list.forEach(function(v){ add(v.name, voiceLabel(v)); });
  }
  sel.value = list.some(function(v){ return v.name === cur; }) ? cur : "";
  $("rateRow").querySelectorAll(".lchip").forEach(function(b){ b.classList.toggle("on", +b.dataset.rate === SPEAK_PREF.rate); });
}
applySpeakPref(); renderVoiceSet(); onVoices(renderVoiceSet);
$("optVoice").addEventListener("change", function(){
  if(!OPT.voice || typeof OPT.voice !== "object") OPT.voice = {};
  OPT.voice[LANG_LEARN] = this.value; saveOpt(); applySpeakPref();
  speak(spellOf(pick(ALLW)));        // 换完当场念一个，省得再去点试听
});
$("btnVoiceTry").addEventListener("click", function(){ speak(spellOf(pick(ALLW))); });
$("rateRow").addEventListener("click", function(e){
  const b = e.target.closest(".lchip"); if(!b) return;
  OPT.rate = +b.dataset.rate; saveOpt(); applySpeakPref(); renderVoiceSet();
  speak(spellOf(pick(ALLW)));
});
/* 「清除全部存档」那个按钮**已经删掉了**（用户 2026-09）——
   连同它两步确认的那一段。要再开一个抹档的口子，记得内存里的
   LEX / CODEX / MET / TOWN 得跟 localStorage 一起清，
   不然紧接着的 goTown() 会把旧数据原样写回去。 */
$("btnAgain").addEventListener("click", goTown);
/* 图鉴的搜索框：边打边筛。⚠️ 从按钮进来的时候先清空，别让上次的搜索词把图鉴筛成空的 */
$("btnCodex").addEventListener("click", function(){ $("codexFind").value = ""; openCodex(); });
var findTimer = null;
$("codexFind").addEventListener("input", function(){
  // 词库有四千多张卡，每敲一下都重画会卡 —— 停手 150ms 再筛
  if(findTimer) clearTimeout(findTimer);
  findTimer = setTimeout(function(){ findTimer = null; openCodex(); }, 150);
});
$("btnCloseCodex").addEventListener("click", function(){ $("veilCodex").hidden = true; });
Array.prototype.forEach.call(document.querySelectorAll(".tab"), function(b){
  b.addEventListener("click", function(){ openCodex(b.dataset.tab); });
});
$("btnHelp").addEventListener("click", function(){ $("veilHelp").hidden = false; });
$("btnCloseHelp").addEventListener("click", function(){ $("veilHelp").hidden = true; });
window.addEventListener("resize", sizeMap);

/* ---- 存档相关按钮 ---- */
function refreshSaveState(){
  const s = readRun(), inRun = (SCENE === "run" && G && !G.over);
  $("saveInfo").innerHTML = tally({
    // 时间取「续玩档写下的那一刻」，没有续玩档才退回永久档的时间戳
    t: (s && s.t) || 0,
    lex: LEX, codex: CODEX, meta: meta(), town: TOWN, run: s
  });
  $("saveState").innerHTML = inRun
    ? (T("你正在洞里。存档停在<b>第 ") + (s ? s.floor : G.floor) + T(" 层的入口</b> —— ") +
       T("游戏只在<b>进入关卡、下一层、回到主城</b>这三个时候存。关掉页面，下次打开自动从这一层开头接着走，不会问你。"))
    : s
      ? (T("上次的探索停在<b>") + ((chapterById(s.ch || 1) || CH).name) + T(" 第 ") + s.floor +
         T(" 层</b>（Lv.") + s.P.lvl + T("）的入口。下次打开会自动接着走，也可以现在就继续。"))
      : T("存档只在<b>进入关卡、下一层、回到主城</b>这三个时候写，下次打开自动读档。你现在在镇上，没有在进行的探索。");
  $("btnResumeHere").hidden = !(s && !inRun);
  /* 「放弃」已经挪到取景框左下角，它跟着 stageBox 一起显隐（只有探索时在），
     不用再按存档状态禁用 —— 以前它住在设置页才需要那一行。 */
}
/* ---- 房间：祭坛 / 宝箱 / 游商 ---- */
/* ---- 下楼确认 ---- */
$("btnSpringDrink").addEventListener("click", function(){ resolveSpring(true); });
$("btnSpringSkip").addEventListener("click", function(){ resolveSpring(false); });
$("btnStairGo").addEventListener("click", function(){
  if(COOP){ coopConfirmStair(); return; }
  closeStair(true);
});
$("btnStairStay").addEventListener("click", function(){
  if(COOP && window.NET) NET.send({t:"ready", what:"floor", on:false});
  closeStair(false);
});
$("btnAltarPay").addEventListener("click", function(){ resolveAltar(true); });
$("btnGildPay").addEventListener("click", payGild);
$("btnGildSkip").addEventListener("click", closeGild);
$("btnAltarSkip").addEventListener("click", function(){ resolveAltar(false); });
/* 熔炉：点身上的一件遗物就是把它扔进去 */
$("forgeList").addEventListener("click", function(ev){
  const b = ev.target.closest(".relic");
  if(b && b.dataset.id) forgePick(b.dataset.id);
});
$("btnForgeSkip").addEventListener("click", closeForge);
$("btnChestDone").addEventListener("click", closeChest);
$("btnChestLeave").addEventListener("click", function(){
  // 还没拼就走：箱子留在原地，以后可以再来
  pendingRoom = null; chestQ = null;
  $("veilChest").hidden = true;
  G.paused = false;
  lockInput(200);
  render();
});
$("btnShopLeave").addEventListener("click", closeShop);
$("btnShopReroll").addEventListener("click", shopReroll);
$("shopList").addEventListener("click", function(ev){
  const b = ev.target.closest("button.buy");
  if(b && !b.disabled) buyFrom(+b.dataset.i);
});

/* ---- 冒险（以前叫押注）---- */
$("btnWager").addEventListener("click", function(){
  if(!B || B.locked || !B.q) return;
  B.wager = !B.wager;
  this.classList.toggle("on", B.wager);
  setWagerLabel();
});
/* ---- 锁定冒险：每题自动押上，省得一题点一次 ---- */
/* 取景框右下角那个开关（用户 2026-09 从地图下面那一行挪上来的，样式跟「寻路」同一套）。
   ⚠️ 按钮上只写「锁定冒险」四个字，开关状态靠 .on 的亮起来表示 ——
   跟「寻路」一个规矩，别把「· 开 / · 关」写回去，那块地方放不下。*/
function renderLock(){
  const b = $("btnLockWager");
  if(!b) return;
  b.classList.toggle("on", !!OPT.lock);
  b.setAttribute("aria-pressed", OPT.lock ? "true" : "false");
  b.title = OPT.lock ? T("锁定冒险 · 开：每题自动押上") : T("锁定冒险 · 关");
}
$("btnLockWager").addEventListener("click", function(){
  this.classList.remove("tipmark");
  OPT.lock = !OPT.lock;
  saveOpt();                       // 设置项，立刻落盘（不受三个存档点的限制）
  renderLock();
  // 正在答的这题也跟着变，免得开了锁还要等下一题才生效
  if(B && !B.locked && B.q && B.q.type !== "spell"){
    B.wager = !!OPT.lock;
    $("btnWager").classList.toggle("on", B.wager);
    setWagerLabel();
  }
  say(OPT.lock ? T("锁定冒险：接下来每题都<b>自动押上</b> —— 对了伤害翻倍，错了受伤翻倍。")
               : T("解除锁定：恢复成每题自己决定要不要冒险。"), "sys");
});

/* ---- 遗物页：分解 / 合成 ---- */
$("relicOwned").addEventListener("click", function(ev){
  // 点一下卡片就把「new」红点摘掉（挑选状态下也算，顺手的事）
  const hit = ev.target.closest(".relic.own");
  if(hit && clearNewRelic(hit.dataset.id)){ renderRelics(); }
  const b = ev.target.closest("button[data-sell]");
  if(b){ sellRelic(b.dataset.sell); return; }
  const card = ev.target.closest(".relic.own[data-id]");
  if(card && fuseOn) fusePick(card.dataset.id);
});
$("btnFusePick").addEventListener("click", fuseToggleMode);
$("btnFuseGo").addEventListener("click", function(){ if(!this.disabled) askFuse(); });
$("btnFuseNo").addEventListener("click", closeFuseAsk);
$("btnFuseYes").addEventListener("click", function(){ if(!this.disabled) fuseGo(); });
/* 合成完的二选一：只能挑，没有关闭钮（材料已经砸了） */
$("fuseGotList").addEventListener("click", function(ev){
  const b = ev.target.closest(".relic");
  if(b && b.dataset.id) fuseTake(b.dataset.id);
});

/* ---- 带满了的取舍 ---- */
$("swapList").addEventListener("click", function(ev){
  const b = ev.target.closest(".relic");
  if(b && b.dataset.id) doSwap(b.dataset.id);
});
$("btnSwapSkip").addEventListener("click", function(){ doSwap(null); });
// 点上面那件新的 = 直接卖掉它（跟「不要了，折成金币」一个意思）
$("swapNew").addEventListener("click", function(){ if(pendingSwap) doSwap(null); });

/* ---- 遗物五选一 ---- */
$("relicList").addEventListener("click", function(ev){
  const b = ev.target.closest(".relic");
  if(b && b.dataset.id) takeRelic(b.dataset.id);
});
/* 「集齐」：窗不关，就地换一批（次数看 rerollBudget()） */
$("btnRelicRedraw").addEventListener("click", function(){
  if(!G || (G.rerollUsed || 0) >= rerollBudget()) return;
  G.rerollUsed = (G.rerollUsed || 0) + 1;
  say(T("你把这几样推了回去 —— 换一批。"), "sys");
  offerRelics();
});

/* ---- 主城 与 洞窟 ---- */
$("btnCave").addEventListener("click", openCave);
$("btnCloseCave").addEventListener("click", function(){ closeDiff(); $("veilCave").hidden = true; });
$("btnTownCodex").addEventListener("click", function(){ $("codexFind").value = ""; openCodex(); });

/* ---- 祝福 ---- */
$("btnBless").addEventListener("click", openBless);
$("btnCloseBless").addEventListener("click", closeBless);
/* 整块委托：开槽位（两步确认）/ 点开着的槽位去挑遗物 */
$("blessList").addEventListener("click", function(ev){
  const b = ev.target.closest(".bslot");
  if(!b) return;
  const kind = b.dataset.kind, rar = +b.dataset.rar, key = kind + ":" + rar;
  if(blessOpen(kind, rar)){ blessArmed = ""; openBlessPick(kind, rar); return; }
  // 2000 宝石不是小数目，误点一下很亏 —— 跟「放弃」一样两步确认
  if(blessArmed !== key){ blessArmed = key; renderBless(); return; }
  blessArmed = "";
  blessBuy(kind, rar);
});
$("blessPickList").addEventListener("click", function(ev){
  const b = ev.target.closest(".relic");
  if(!b || !b.dataset.id) return;
  blessTake(b.dataset.id);
});
$("blessFind").addEventListener("input", renderBlessPick);
$("btnBlessClear").addEventListener("click", function(){ blessTake(""); });
$("btnBlessBack").addEventListener("click", closeBlessPick);
$("btnPractice").addEventListener("click", function(){
  if(COOP && !coopIsHost()) return;     // 练习模式由房主统一定
  practiceOn = !practiceOn;
  renderPractice();
  if(COOP && window.NET) NET.send({t:"practice", on: practiceOn});
});
/* 点一条路不再直接进洞 —— 先弹难度窗（用户 2026-09-21）。
   联机里队友的卡片是 disabled 的，所以这条只有房主走得到。*/
$("routeList").addEventListener("click", function(ev){
  const b = ev.target.closest(".route");
  if(!b || b.disabled) return;
  askDiff(b.dataset.id);
});
$("diffList").addEventListener("click", function(ev){
  const b = ev.target.closest(".route");
  if(!b) return;
  takeDiff(b.dataset.id);
});
$("btnCloseDiff").addEventListener("click", closeDiff);
/* #btnCaveConfirm 只有 coop.html 才有 —— index.html 里 $() 会拿到 null，
   在外面直接 addEventListener 会当场报错，所以这个监听必须守着 COOP 才挂。*/
if(COOP) $("btnCaveConfirm").addEventListener("click", coopConfirmEnter);
/* 取景框左下角的「放弃」：两步确认 —— 手滑点掉一趟很伤 */
let abandonArmed = 0;
function abandonText(){ return (P && P.tut && SCENE === "run") ? L("跳过教程", "Skip") : T("放弃"); }
$("btnAbandon").addEventListener("click", function(){
  const b = this;
  if(Date.now() > abandonArmed){
    abandonArmed = Date.now() + 4000;
    b.textContent = T("再点一次");
    b.classList.add("armed");
    setTimeout(function(){
      if(Date.now() > abandonArmed){ b.textContent = abandonText(); b.classList.remove("armed"); }
    }, 4100);
    return;
  }
  abandonArmed = 0;
  b.textContent = abandonText();
  b.classList.remove("armed");
  autoOff();
  giveUpRun();       // 直接结算：算分、发宝石、弹结算窗
});
/* 取景框左下角的「寻路」：开关式。开着就一路走 —— 怪 → 金币 → 楼梯。
   ⚠️ **不过 `gate()`** —— 战斗刚结束那 260ms 的输入锁会把「停下」这一下吃掉，
   而玩家按停就是想马上停。连点两下 = 关了又开，无害。*/
$("btnPathfind").addEventListener("click", function(){
  if(COOP){ coopToggleMove(); return; }
  autoToggle();
});

/* ---- 云存档：两个按钮 ----
   「复制」= 现生成一段码直接塞进剪贴板；「粘贴」= 从剪贴板读回来导入。
   ⚠️ 剪贴板不是每个浏览器都给网页用（Firefox 不给读、http 页面两样都不给），
   所以两条路都有同一个退路：露出 #codeBox 那个框，让玩家自己复制/粘贴。
   平时它是 hidden 的 —— 界面上就只有那两个按钮。*/
function codeMsg(t){ toast(t); }   // 2026-09-23 起走浮窗（面板里那行 note 删了，不再把按钮顶下去）
function codeBoxShow(v, ro){
  const box = $("codeBox");
  box.hidden = false;
  box.readOnly = !!ro;
  box.value = v || "";
  box.focus();
  if(ro) box.select();
  return box;
}
function codeBoxHide(){ const box = $("codeBox"); box.value = ""; box.hidden = true; }
$("btnCopySave").addEventListener("click", function(){
  let code;
  try{ code = makeCode(); }
  catch(e){ codeMsg(T("生成存档码时出错了：") + (e && e.message ? e.message : e)); return; }
  const b = this, ok = function(){
    codeBoxHide();
    b.textContent = T("已复制");
    setTimeout(function(){ b.textContent = T("复制存档码"); }, 1600);
    codeMsg(T("存档码（") + code.length + T(" 个字符）已经在剪贴板里 —— 到另一台设备上点「粘贴存档码」。"));
  };
  const manual = function(){
    codeBoxShow(code, true);
    codeMsg(T("这个浏览器不让网页写剪贴板 —— 码已经放在下面的框里并选中了，自己复制走。"));
  };
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(code).then(ok, manual);
      return;
    }
  }catch(e){}
  // 老路：先把码放进框里选中，再试一次 execCommand
  const box = codeBoxShow(code, true);
  let done = false;
  try{ done = document.execCommand("copy"); }catch(e){}
  if(done) ok(); else manual();
});
$("btnPasteSave").addEventListener("click", function(){
  const box = $("codeBox");
  // 退路那个框里已经有东西了：这一下就是「导入它」
  if(!box.hidden && !box.readOnly && box.value.trim()){
    const msg = applyCode(box.value);
    codeMsg(msg);
    if(msg.indexOf(T("成功")) >= 0) codeBoxHide();
    return;
  }
  const manual = function(why){
    codeBoxShow("", false);
    codeMsg(why || T("这个浏览器不让网页读剪贴板 —— 把存档码粘到下面的框里，再点一次「粘贴存档码」。"));
  };
  try{
    if(navigator.clipboard && navigator.clipboard.readText){
      navigator.clipboard.readText().then(function(t){
        // 读到了但是空的：这不是浏览器的锅，别报错怪它
        if(!String(t || "").trim()){
          manual(T("剪贴板里是空的 —— 先在旧设备上点「复制存档码」。要手输也行：粘到下面的框里再点一次。"));
          return;
        }
        const msg = applyCode(t);
        codeMsg(msg);
        if(msg.indexOf(T("成功")) >= 0) codeBoxHide();
      }, function(){ manual(); });      // 拒绝理由是个 Error，别把它当提示文案用
      return;
    }
  }catch(e){}
  manual();
});

/* ---- 本地存档文件 ---- */
$("btnSaveFile").addEventListener("click", function(){ fileMsg(downloadSave()); });
$("btnPickFile").addEventListener("click", function(){ $("fileIn").click(); });
$("fileIn").addEventListener("change", function(){ takeFile(this.files && this.files[0]); });
$("dropZone").addEventListener("click", function(){ $("fileIn").click(); });
["dragenter","dragover"].forEach(function(t){
  $("dropZone").addEventListener(t, function(ev){ ev.preventDefault(); this.classList.add("over"); });
});
["dragleave","drop"].forEach(function(t){
  $("dropZone").addEventListener(t, function(ev){ ev.preventDefault(); this.classList.remove("over"); });
});
$("dropZone").addEventListener("drop", function(ev){
  const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
  takeFile(f);
});
/* 页面别的地方接住误拖的文件，免得浏览器直接把 json 打开、把游戏顶掉 */
["dragover","drop"].forEach(function(t){
  window.addEventListener(t, function(ev){ if(ev.target.id !== "dropZone") ev.preventDefault(); });
});
$("btnCancelFile").addEventListener("click", function(){ closeFileCard(); fileMsg(T("已取消，什么都没动。")); });
$("btnMergeFile").addEventListener("click", function(){
  if(!pendingFile){ fileMsg(T("先选一个存档文件。")); return; }
  const r = mergeData(pendingFile);
  closeFileCard();
  fileMsg(T("合并完成：更新 ") + r.words + T(" 个词，补上 ") + r.legs + T(" 件遗物")
        + (r.gold ? (T("，宝石 +") + r.gold + T(" 颗")) : "")
        + (r.run ? T("，还接回了一趟没走完的探索。") : T("。")));
});
/* 覆盖是抹掉这台设备的进度，两步确认 —— 跟「清除全部存档」一个规矩 */
let overArmed = 0;
$("btnOverwriteFile").addEventListener("click", function(){
  if(!pendingFile){ fileMsg(T("先选一个存档文件。")); return; }
  const b = this;
  if(Date.now() > overArmed){
    overArmed = Date.now() + 4000;
    b.textContent = T("再点一次确认覆盖");
    setTimeout(function(){ if(Date.now() > overArmed) b.textContent = T("整档覆盖"); }, 4100);
    return;
  }
  overArmed = 0;
  b.textContent = T("整档覆盖");
  fileMsg(T("正在覆盖，马上重新载入…"));
  overwriteAll(pendingFile);
});
/* 镇上也能接着走上次那一趟 —— 以前只有刚打开页面时才问一次 */
$("btnResumeHere").addEventListener("click", function(){
  const s = readRun();
  if(!s) { refreshSaveState(); return; }
  SCENE = "run"; showScene(); resumeRun(s);
  refreshSaveState(); showView("viewAdv");
});

/* 这里以前挂着 pagehide / freeze / blur / visibilitychange 四个监听，外加一条
   setInterval(saveRun, 15000)。现在存档点只有三个（进入关卡 / 下一层 / 回到主城），
   全删了 —— 别再加回来。 */

/* ================= 联机（第一期）：房间加入 + 消息分发 =================
   全部包在 if(COOP) 里 —— coop.html 才有 #veilRoom / #veilCoopWait / #mateRow 这几个元素，
   index.html 里 $() 找不到它们会是 null，所以这一段代码在单人版里一步都跑不到（COOP 恒为 false）。 */
/* ⚠️ 这几个函数必须写在 if(COOP) 外面（顶层）——
   strict mode 下 block 里的 function 声明是块作用域的，写在 if(COOP){...} 里面
   外面（比如 btnPathfind 的 click 监听，定义在文件更前面）就调不到，直接 ReferenceError。
   它们只会被 COOP 分支的代码调用，所以内部不用再判断一次 COOP。 */
/* 「寻路」在联机里怪没清完时不是立刻开，是先跟服务器说「我想走了」，
   等两人都点了（服务器的 go{what:"move",on:true}）才真正开始算路，走的是共享那条路。
   怪一清完，锁就解了（coopLocked() 变 false）——这时候寻路跟单人版一模一样，
   点一下就自己走自己的（找自己的金币），不用等队友，也不用走服务器那套握手
   （用户 2026-09：「打完怪物后解除所有限制，包括玩家 B 不再自动跟随玩家 A」）。*/
function coopToggleMove(){
  if(!P || !G || !G.map || G.over || SCENE !== "run") return;
  if(P.down) return;      // 倒地的人按不动这个按钮，寻路的意愿已经替他摆好了（见 coopGoDown）
  if(!coopLocked()){ autoToggle(); return; }
  coopMoveWant = !coopMoveWant;
  const b = $("btnPathfind");
  if(b) b.classList.toggle("armed", coopMoveWant);
  NET.send({t:"ready", what:"move", on: coopMoveWant});
}
/* 这一层的怪清完了——移动锁解除，寻路也跟着停一下，交还给玩家自己决定接下来干嘛
   （各自去找各自的金币，或者手动逛）。⚠️ 不管 autoOn 现在是不是已经是 false 都发一次
   ready:{move,off}：server.js 里 room.ready.move 是常驻的、不会自动复位，两边只要有一边
   没真的发过这条 off，下一层"两人都点寻路才走"的判定就会被这一层的残留状态提前凑成
   go——所以这里幂等地发，两边各自检测到"我的 G.mobs 空了"都会调用一次，才能真的把
   服务器那边的 [true,true] 清成 [false,false]。 */
function coopUnlockMove(){
  if(!COOP) return;
  coopMoveWant = false;
  const b = $("btnPathfind");
  if(b) b.classList.remove("armed");
  if(window.NET) NET.send({t:"ready", what:"move", on:false});
  if(autoOn){ autoOff(); cancelWalk(); render(); }
}

/* ================= 联机（第二期）：双血条战斗 =================
   跟第一期的移动/世界同步是同一套开关隔离：全走 if(COOP) 分支，单人版一行不变。
   详细设计（三方分工、m.hp 的语义、竞态怎么处理）见 联机方案.md 第 3/4/6/8 节，
   这里只放实现。⚠️ 这些函数被 answer()/finishBattle()/nextFloor() 等顶层函数调用，
   所以必须写在顶层（block 里的 function 声明是块作用域的，见文件前面那条踩过的坑）。

   怪的两条血条不是 m.hpA/m.hpB 各处替换 —— 那样要把全文件读写 m.hp 的地方都改一遍。
   正确做法（联机方案.md 第 3 节）：m.hp 永远是「我现在正在砍的那条」，
   m.curSide 记着这条对应服务器上的 a 还是 b，m.hpMate 是**另一条**的缓存值（纯显示，
   权威值来自服务器的 hp 广播）。我自己这条空了、队友那条还有血，就把 m.hp 换成 m.hpMate、
   m.curSide 翻过去——这就是「转去帮队友砍」，answer() 里那一大段伤害计算一个字不用改。 */

/* 房主生成 / 非房主铺场之后都要跑一遍：给这一层每只怪挂上 cid（跟当前数组下标无关，
   死一只之后 splice 会让下标错位，所以身份必须是一个跟着怪走的固定号）和两条血条的初始值。
   单人版里 COOP 恒为 false，直接返回，一步都不多做。 */
function coopPrepMobs(){
  if(!COOP || !G || !G.mobs) return;
  const mySide = coopIsHost() ? "a" : "b";
  G.mobs.forEach(function(m, i){
    m.cid = i;
    m.mySide = mySide;
    m.curSide = mySide;
    m.hpMate = m.max;
  });
}
/* 按 cid（不是数组下标！）找回这只怪 —— dmg/hp/dead 消息里带的都是 cid。 */
function mobByCid(cid){
  if(!G || !G.mobs) return null;
  for(let i=0;i<G.mobs.length;i++) if(G.mobs[i].cid === cid) return G.mobs[i];
  return null;
}
/* 联机里，怪掉的血要上报服务器定序（两人可能同时把同一条血条砍成负数，见联机方案.md 第 3 节
   那条竞态）。m.hp 本身的语义不变——这个函数只是把 answer() 里原来的 `m.hp -= n` 包一层，
   单人版（COOP 恒为 false）行为跟原来一模一样。 */
function coopDealDamage(m, n){
  if(!(n > 0)) return;
  /* 无终之影：伤害在「层」之间穿过去，血条不会归零（abyssAbsorb）。
     ⚠️ 联机里**这一刀不上报** —— 服务器那套是按「一条会被打空的血条」写的，
     报过去它会判这只怪死了、广播 dead 把它从场上抹掉。深渊里两人各打各的层。*/
  if(m.def && m.def.abyss){ abyssAbsorb(m, n); return; }
  m.hp -= n;
  if(COOP && window.NET && m.cid != null){
    NET.send({t:"dmg", mob:m.cid, side:m.curSide || m.mySide, n:n});
  }
}
/* 我这条血条空了：队友那条还有血就转过去帮砍（强的人能带弱的人）。
   两条都空了返回 false —— 调用方（answer() 的判怪死那一处）改成「等服务器的 dead 广播」，
   不在本地直接判定，避免两人同时砍死同一只怪时各自都以为是自己补的最后一刀。 */
function coopTrySwitchTarget(m){
  if(!((m.hpMate || 0) > 0)) return false;
  m.hp = m.hpMate;
  m.hpMate = 0;
  m.curSide = m.curSide === "a" ? "b" : "a";
  say(T("你把") + m.name + T("这边砍空了 —— 转去帮队友砍剩下那条。"), "crit");
  renderBattleBars();
  return true;
}
/* 服务器广播「这只怪两条血条都空了」。三种情况：
   ① 我正在打它（B.mob 就是它）—— 等一小会儿让人看清最后一题，再走跟单人版一样的 finishBattle(true)；
   ② 我压根没在打它（还没走到 / 队友一个人带走了）—— 直接从地图上摘掉，不结算经验金币；
   ③ 摘完之后这一层空了 —— 补上阶梯（跟 closeBattleWin() 里那段是同一件事，
      这里单独写一遍是因为①会自己走 closeBattleWin，②不会）。 */
function coopHandleDead(cid){
  const m = mobByCid(cid);
  if(!m) return;
  if(B && B.mob === m){
    clearQTimer();                                    // 别让读条在这个空当里咬一口
    setTimeout(function(){ if(B && B.mob === m) finishBattle(true); }, 300);
    return;
  }
  const i = G.mobs.indexOf(m);
  if(i >= 0) G.mobs.splice(i, 1);
  if(G.mobs.length === 0){
    G.stair = {x:m.x, y:m.y};
    G.seen[m.y][m.x] = true;
    say(T("这一层清空了 —— 阶梯 ▼ 出现了。"), "crit");
    coopUnlockMove();     // 联机：怪清完了，移动锁解除（联机方案.md）
    spawnGild();          // 金坛各人一座（金币和加成本来就是各算各的）
    if(hasRelic("finale")){    // 收尾：清完一层回 FINALE_PCT 的上限——清场是共识事件，没亲手补最后一刀也该有
      const back = Math.max(1, Math.ceil(stats().maxHp * FINALE_PCT));
      const r = healUp(back);
      if(r.hp || r.sh) say(T("这一层干净了 —— 收尾替你补了 <b>") + r.hp + T("</b> 点生命") +
        (r.sh ? T("，溢出的化成 <b>") + r.sh + T("</b> 点护盾") : "") + T("。"), "good");
    }
    if(hasRelic("welfare")){                       // 均富：清空这一层再单独发一笔
      const wg = G.floor * 2;
      P.gold += wg;
      say(T("均富 —— 这一层清空了，回廊分给你 <b>") + wg + T("</b> 金。"), "good");
    }
  }
  fov();
  render();
  renderHud();
  coopCheckRevive();
}
/* 血掉光不出局，是「倒地」：停止答题，怪也不再打他，队友清完层原地复活（1 点血）。
   ⚠️ 寻路的算路/广播是房主单方面做的（跟着房主自己的坐标算），房主倒下之后再算就是错的路 ——
   所以房主倒下要连寻路一起停住，队友只能手动点地图清完剩下的怪（手动移动不看房主状态，不受影响）。
   队友倒下就不用管这些：房主继续正常算路，队友这边只是不亲自挪（stepWalk 里挡住了）。 */
function coopGoDown(){
  P.down = true;
  P.hp = 0;
  cancelWalk();
  G.paused = false;
  autoOff();
  if(coopIsHost()){
    if(window.NET) NET.send({t:"ready", what:"move", on:false});
    say(T("你倒下了 —— 你是房主，寻路先停住，队友得手动清完剩下的怪，你才会原地复活。"), "hurt");
  } else {
    // 倒地的人不阻塞移动：替自己把「寻路」那份 ready 摆成「已同意」，房主一个人点寻路也能继续走
    if(window.NET) NET.send({t:"ready", what:"move", on:true});
    say(T("你倒下了 —— 撑着等队友把这一层清完，你会原地站起来。"), "hurt");
  }
  renderHud();
  render();
  coopSendMe();
  coopCheckBothDown();
}
/* 队友把这一层清完（G.mobs 空了）：倒地的人原地复活，回 1 点生命。 */
function coopCheckRevive(){
  if(!COOP || !P || !P.down || !G || G.mobs.length !== 0) return;
  P.down = false;
  P.hp = 1;
  say(T("队友把这一层清干净了 —— 你摇晃着站了起来（1 点生命）。"), "good");
  renderHud();
  render();
  coopSendMe();
}
/* 两人同时倒下才算这趟结束（联机方案.md）——各自走各自的 gameOver()/endRun()，各算各的宝石。 */
function coopCheckBothDown(){
  if(COOP && P && P.down && coopMateInfo && coopMateInfo.down && G && !G.over) gameOver();
}
/* 下楼前的双确认：点「下去」先只是举手，等两人都举手了服务器才发 go{what:"floor"}，
   到那时候才真的调 closeStair(true) 进下一层。 */
function coopConfirmStair(){
  NET.send({t:"ready", what:"floor", on:true});
  const b = $("btnStairGo");
  if(b){ b.disabled = true; b.textContent = T("等待队友确认…"); }
}
/* 非房主：收到 path 消息时可能正在打自己的那一场战斗（G.paused），
   stepWalk() 这时候什么都不会做。这个小轮询专门等 G.paused 解开再接着走那条路，
   不用去改战斗/弹层每一处「关闭」的地方挂钩子。 */
function coopMateResume(){
  if(coopMateTimer) return;
  coopMateTimer = setTimeout(function(){
    coopMateTimer = null;
    if(!P || !G || !G.map || G.over || SCENE !== "run") return;
    if(G.paused){ coopMateResume(); return; }
    if(walkPath && walkPath.length && !walkTimer) stepWalk();
  }, 200);
}
function coopUpdateWaitUi(){
  const w = $("veilCoopWait");
  if(!w) return;
  const connected = NET.isConnected(), mate = NET.hasMate();
  if(!coopEverConnected){ w.hidden = true; return; }   // 还没组过队，不是"断线"，别弹遮罩
  if(!connected){
    $("coopWaitTitle").textContent = T("网络断了…");
    $("coopWaitNote").textContent = T("正在自动重连，接上之后从这一层继续走。");
    w.hidden = false;
  } else if(!mate && SCENE === "run"){
    $("coopWaitTitle").textContent = T("等待队友…");
    $("coopWaitNote").textContent = T("队友掉线了，等他重新连上再继续。");
    w.hidden = false;
  } else {
    w.hidden = true;
  }
}

if(COOP){
  /* ================= 联机（第一期）：组队面板 =================
     跟一开始的版本不一样：**不再一进页面就拿一层遮罩挡住整个游戏**（用户 2026-09 要求改成
     主城里一个板块）。没组队也能逛主城、看图鉴、改设置；只有真要进洞窟才需要先组好队。
     `coopEverConnected` 用来区分"从没连过"和"连过又断了"——前者不弹断线遮罩（声明在文件顶部）。 */
  /* 房间号只用数字（用户 2026-09 要求）——4 位，手机上不用切字母键盘，报数字给队友也方便念。
     纯数字只有 10000 种组合，但这就是个临时接头暗号，用完就忘，撞号概率practically 可以不管。*/
  function randRoomCode(){
    return String(Math.floor(1000 + Math.random() * 9000));   // 1000~9999，不带前导 0
  }
  function teamHint(){
    const b = $("teamHint");
    if(!b) return;
    if(!NET.isConnected()) b.textContent = T("创建或加入一个房间");
    else b.textContent = T("房间 ") + NET.roomCode() + " · " + (coopIsHost() ? T("房主") : T("队友")) +
      (NET.hasMate() ? T(" · 已连接") : T(" · 等待对方"));
  }
  function showTeamPanel(which){
    ["teamPick", "teamJoinForm", "teamStatus"].forEach(function(id){ $(id).hidden = (id !== which); });
  }
  /* 邀请链接：队友直接打开就自动加入这个房间，不用再手输房间号。
     ?room=1234 —— 页面一加载就会检查这个参数，见文件末尾的 autoJoinFromUrl()。*/
  function coopInviteLink(){
    return location.origin + location.pathname + "?room=" + NET.roomCode();
  }
  function renderTeamStatus(){
    if(!NET.isConnected()){ showTeamPanel("teamPick"); return; }
    showTeamPanel("teamStatus");
    $("teamLedger").innerHTML =
      li(T("房间号"), "<b>" + NET.roomCode() + "</b>") +
      li(T("你是"), NET.isHost() ? T("房主") : T("队友")) +
      li(T("队友"), NET.hasMate() ? T("已连接") : T("还没连上 —— 把房间号告诉他"));
    $("teamNote").textContent = NET.isHost()
      ? T("房主负责在洞窟里选路线。")
      : T("进洞窟之后，房主选好路线，你确认一下就一起下去。");
    $("teamLinkText").value = coopInviteLink();
  }
  function openTeamPanel(){
    $("roomMsg").textContent = "";
    $("teamTitle").textContent = T("两个人，一个房间号");
    renderTeamStatus();
    $("veilTeam").hidden = false;
  }
  function afterJoined(){
    coopEverConnected = true;
    $("roomMsg").textContent = "";
    /* 把房间号写进地址栏（用户 2026-09-20 报「退出之后回不到之前那个存档」）。
       ⚠️ 这就是那个 bug 的主因：自动重连只认 URL 上的 ?room=，而**房主的地址栏里从来没有它**
       （队友是点邀请链接进来的，所以队友刷新反而能自己回去）。房主一刷新就变成
       「读回了自己的续玩档，但没在任何房间里」，看着就像存档丢了。
       写进 URL 之后，刷新/误关标签页/手机切后台被杀，重新打开都会自动回到同一个房间，
       服务器那边还缓存着 room.world，会立刻把当前这一层补发过来。*/
    try{
      const code = NET.roomCode();
      if(code) history.replaceState(null, "", location.pathname + "?room=" + encodeURIComponent(code));
    }catch(e){}
    /* 重连之后角色可能跟上一次不一样（房主掉线的话队友会被服务器扶正成房主），
       而「我砍的是哪条血条」是按角色定的 —— 在局内就重绑一次，两边才对得上。
       不在局内时 coopPrepMobs() 自己会因为没有 G.mobs 直接返回。*/
    coopPrepMobs();
    renderTeamStatus();
    teamHint();
    coopUpdateWaitUi();
    coopStartTicker();
    if(SCENE === "town" && !$("veilCave").hidden) openCave();   // 刷新洞窟弹层（谁是房主/队友到没到）
  }

  NET.on("err", function(msg){ $("roomMsg").textContent = msg.why || T("连接失败"); });
  NET.on("joined", afterJoined);
  NET.on("resume", function(){
    renderTeamStatus(); teamHint(); coopUpdateWaitUi();
    /* 队友重连回来了：房主把**当前**这一层重新广播一次，让他直接对齐现在的进度，
       而不是停在自己续玩档里那份「刚踏进这一层」的快照（队友走之后房主可能已经清了半层）。
       服务器本来就缓存着 room.world 并会补发给新连接，但那份是上一次广播的；
       这里再发一次才是此刻的真实状态。*/
    if(coopIsHost() && SCENE === "run" && P && G && !G.over && G.map) coopBroadcastWorld();
  });
  NET.on("pause", function(){ renderTeamStatus(); teamHint(); coopUpdateWaitUi(); });
  NET.on("_close", function(){ teamHint(); coopUpdateWaitUi(); });

  /* 房主提的路线，两边都存一份：房主自己选中的那条，队友收到的房主选的那条。
     只是"提议"，不会自动进 —— 真正进要么是房主收到 enterConfirm，要么是队友自己点确认。*/
  NET.on("route", function(msg){
    if(coopIsHost()) return;                 // 自己发的不用处理（服务器也不会回给发送者自己）
    coopProposedRoute = msg.id;
    if(diffById(msg.diff)) diffOn = msg.diff;     // 难度由房主定，队友照单收下
    if(SCENE === "town" && !$("veilCave").hidden) openCave();
  });
  NET.on("enterConfirm", function(msg){
    if(!coopIsHost()) return;
    if(SCENE === "town") enterRoute(msg.id || coopProposedRoute, true);
  });
  NET.on("practice", function(msg){
    if(coopIsHost()) return;
    practiceOn = !!msg.on;
    renderPractice();
  });
  NET.on("world", function(msg){
    if(coopIsHost()) return;
    applyCoopWorld(msg);
  });
  NET.on("path", function(msg){
    if(coopIsHost()) return;
    if(!P || !G || !G.map || G.over || SCENE !== "run") return;
    if(P.down) return;      // 倒地的人不跟着走，原地等复活（联机方案.md 第二期）
    if(!coopLocked()) return;   // 已经解锁了，不用再跟着房主的共享路走（防一条晚到的旧消息）
    cancelWalk();
    walkPath = (msg.steps || []).slice();
    G.goal = walkPath.length ? walkPath[walkPath.length - 1] : null;
    render();
    coopMateResume();
  });
  /* 联机第二期：怪的两条血条。hp 是服务器算完之后的权威值（校正本地乐观扣的那一下），
     dead 是两条都空了的共识确认——真正扣怪的地方是 coopHandleDead()。 */
  NET.on("hp", function(msg){
    const m = mobByCid(msg.mob);
    if(!m) return;
    if(m.def && m.def.abyss) return;   // 深渊那只的血按层算，服务器不认它（见 coopDealDamage）
    const mine = m.curSide === "a" ? msg.a : msg.b;
    const other = m.curSide === "a" ? msg.b : msg.a;
    if(typeof mine === "number") m.hp = mine;
    if(typeof other === "number") m.hpMate = other;
    if(B && B.mob === m) renderBattleBars();
  });
  NET.on("dead", function(msg){ coopHandleDead(msg.mob); });
  NET.on("go", function(msg){
    if(msg.what === "move"){
      const b = $("btnPathfind");
      if(msg.on){
        autoOn = true;
        if(b){ b.classList.add("on"); b.classList.remove("armed"); b.setAttribute("aria-pressed", "true"); }
        if(coopIsHost()) autoTick();
        else say(T("寻路已同步 —— 两人一起走。"), "sys");
      } else {
        coopMoveWant = false;
        autoOff();
        cancelWalk();
        if(b) b.classList.remove("armed");
        render();
      }
    } else if(msg.what === "floor"){
      if(msg.on && !$("veilStair").hidden) closeStair(true);
    }
  });
  NET.on("mate", function(msg){
    const wasDown = coopMateInfo && coopMateInfo.down;
    coopMateInfo = msg;
    coopMateX = (typeof msg.x === "number") ? msg.x : null;
    coopMateY = (typeof msg.y === "number") ? msg.y : null;
    const wasBusy = coopMateBusy;
    coopMateBusy = !!msg.busy;
    // 队友刚从忙碌变空闲，房主没必要等 300ms 的下一轮，立刻重新算一次目标
    if(coopIsHost() && wasBusy && !coopMateBusy && autoOn && !(walkPath && walkPath.length)) autoTick();
    if(SCENE === "run" && G && G.map) render();   // 地图还没铺好（等 world 中）就先别画，cells 可能还是空的
    if(B && B.mob) renderBattleBars();   // 战斗窗开着的话，自己血条上方那条队友血条也要跟着刷新
    if(!wasDown && msg.down) say(T("队友倒下了 —— 清完这一层他会原地复活。"), "hurt");
    else if(wasDown && !msg.down) say(T("队友站起来了。"), "good");
    coopCheckBothDown();
  });
  NET.on("used", function(msg){
    if(SCENE === "run") say(T("队友用了") + (msg.what || T("点什么")) + T("。"), "sys");
  });

  /* ---- 主城「组队」板块 ---- */
  $("btnTeam").addEventListener("click", openTeamPanel);
  $("btnTeamClose").addEventListener("click", function(){ $("veilTeam").hidden = true; });
  $("btnTeamCreate").addEventListener("click", function(){
    const code = randRoomCode();
    coopMyName = T("旅人");
    $("roomMsg").textContent = T("房间号 ") + code + T(" —— 正在连接…");
    NET.connect(code, coopMyName);
  });
  $("btnTeamJoin").addEventListener("click", function(){ showTeamPanel("teamJoinForm"); });
  $("btnTeamBack").addEventListener("click", function(){ showTeamPanel("teamPick"); });
  $("btnTeamJoinGo").addEventListener("click", function(){
    const code = $("roomCode").value.trim();
    if(!code){ $("roomMsg").textContent = T("先填个房间号。"); return; }
    coopMyName = $("roomName").value.trim() || T("旅人");
    $("roomMsg").textContent = T("连接中…");
    NET.connect(code, coopMyName);
  });
  $("btnTeamCopyLink").addEventListener("click", function(){
    const t = $("teamLinkText"), b = this;
    t.select();
    try{
      navigator.clipboard.writeText(t.value);
      b.textContent = T("已复制");
    }catch(e){
      // 局域网 http:// 不是"安全上下文"，有的浏览器压根没有 navigator.clipboard ——
      // 已经帮你选中了，手动复制（跟设置页「复制导出码」那个按钮一个套路）
      b.textContent = T("已选中，手动复制");
    }
    setTimeout(function(){ b.textContent = T("复制邀请链接"); }, 1600);
  });
  $("btnTeamLeave").addEventListener("click", function(){
    NET.close();
    // 主动离开就把地址栏里的 ?room= 摘掉，免得下次打开又自己连回去（跟上面 afterJoined 成对）
    try{ history.replaceState(null, "", location.pathname); }catch(e){}
    coopEverConnected = false;      // 自己主动离开，不算"断线"，别弹断线遮罩
    $("veilCoopWait").hidden = true;
    coopProposedRoute = null;
    showTeamPanel("teamPick");
    teamHint();
    if(SCENE === "town" && !$("veilCave").hidden) openCave();
  });

  /* ---- 邀请链接自动加入 ----
     打开 coop.html?room=1234 直接就去连那个房间，不用再点"加入房间"、手输房间号。
     链接是 renderTeamStatus() 里 coopInviteLink() 生成的，队友直接打开就行。 */
  (function autoJoinFromUrl(){
    let code = "";
    try{ code = new URLSearchParams(location.search).get("room") || ""; }catch(e){}
    code = code.trim();
    if(!code) return;
    coopMyName = T("旅人");
    openTeamPanel();
    $("roomMsg").textContent = T("邀请链接 —— 正在加入房间 ") + code + "…";
    NET.connect(code, coopMyName);
  })();
}

/* ================= 语言（2026-09-23，见 i18n.js）=================
   母语 = 界面语言，学习语言 = 背哪门的词。能选的组合在 LANG_PAIRS 里（现在两种）。
   选择分两步：先母语（veilLang / 设置页母语钮），再弹学习语言列表（veilLearn，openLearnPick）。
   换语言一律**写进 OPT 然后重载**（takeLearn）：词库和静态文案都是加载时定死的，重载最干净。
   ⚠️ 洞里不许换（续玩档里的词是按这一门语言记的，换了读档会对不上）—— 回镇上才能换。*/
function pairFor(ui, learn){
  for(let i = 0; i < LANG_PAIRS.length; i++){
    const p = LANG_PAIRS[i];
    if((ui == null || p.ui === ui) && (learn == null || p.learn === learn)) return p;
  }
  return null;
}
/* 设置页：母语两个钮 + 「学习：English ▸」一个钮。点哪个都是弹 veilLearn 挑学习语言（学习语言跟着母语走）。*/
function renderLangPanel(){
  const box = $("langPanel");
  if(!box) return;
  Array.prototype.forEach.call(box.querySelectorAll("button[data-ui]"), function(b){
    b.classList.toggle("on", b.dataset.ui === LANG_UI);
  });
  const lp = $("btnLearnPick"), li = LEARN_INFO[LANG_LEARN];
  if(lp && li) lp.textContent = li.name[LANG_UI] + " ▸";
}
function langClick(ev){
  const b = ev.target.closest ? ev.target.closest("button") : null;
  if(!b) return;
  if(SCENE === "run" && G && !G.over){ toast(L("先回镇上再换语言。", "Return to town before switching languages.")); return; }
  if(b.dataset.ui){ if(b.dataset.ui !== LANG_UI) openLearnPick(b.dataset.ui, "settings"); }
  else if(b.id === "btnLearnPick") openLearnPick(LANG_UI, "settings");
}
/* 第二步：学习语言的列表。文字按「刚挑的母语」写 —— 那时候界面可能还是另一种语言，所以不走 T()，自带一张小表。*/
const LEARN_UI = {
  zh: {eb:"学习语言", title:"想学哪门语言？", back:"返回", cur:"正在学", words:" 词"},
  en: {eb:"Learning language", title:"Which language do you want to learn?", back:"Back", cur:"current", words:" words"}
};
let learnFor = {ui:LANG_UI, mode:"first"};
function learnWordCount(learn){
  const list = learn === "zh" ? (window.ZH_WORDS || []) : learn === "es" ? (window.ES_WORDS || []) : learn === "ja" ? (window.JA_WORDS || []) : learn === "en" ? (window.EN_WORDS || []) : [];
  return list.length;
}
function openLearnPick(ui, mode){
  learnFor = {ui:ui, mode:mode};
  const t = LEARN_UI[ui] || LEARN_UI.zh;
  $("learnEyebrow").textContent = t.eb;
  $("learnTitle").textContent = t.title;
  $("btnLearnBack").textContent = t.back;
  const box = $("learnList");
  box.innerHTML = "";
  LANG_PAIRS.filter(function(p){ return p.ui === ui; }).forEach(function(p){
    const info = LEARN_INFO[p.learn] || {name:{}, self:p.learn, lv:""};
    const cur = p.ui === LANG_UI && p.learn === LANG_LEARN && LANG_SET;
    const n = learnWordCount(p.learn);
    const d = document.createElement("button");
    d.type = "button"; d.className = "lcard" + (cur ? " on" : ""); d.dataset.learn = p.learn;
    d.innerHTML = "<span class=\"lself\">" + info.self + "</span>" +
      "<span class=\"lname\">" + (info.name[ui] || info.self) + (cur ? " · " + t.cur : "") + "</span>" +
      "<span class=\"linfo\">" + info.lv + (n ? " · " + n.toLocaleString(ui === "zh" ? "zh-CN" : "en-US") + t.words : "") + "</span>";
    box.appendChild(d);
  });
  $("veilLang").hidden = true;
  $("veilLearn").hidden = false;
}
function takeLearn(learn){
  const pair = pairFor(learnFor.ui, learn);
  if(!pair) return;
  $("veilLearn").hidden = true;
  const first = learnFor.mode === "first";
  OPT.lang = {ui:pair.ui, learn:pair.learn};
  saveOpt();
  if(pair.ui !== LANG_UI || pair.learn !== LANG_LEARN){ try{ location.reload(); }catch(e){} return; }
  renderLangPanel();
  if(first && !tutDone()) startTutorial();
}
function openLangPick(){ $("veilLang").hidden = false; }
function isFreshAccount(){
  return !(MET.runs || 0) && !Object.keys(LEX).length && !(TOWN.gem || 0) && !Object.keys(CODEX).length;
}

/* ================= 新手教程（2026-09-23）=================
   **一个账号一次**：走完（或点「放弃」跳过）就在 MET 上记 `tut:1`，跟着存档码 / 存档文件走。
   老账号（更新之前就在玩的）直接记成走过，不打扰；设置页「别的」里能再走一遍。
   教程关就是一趟特殊的探索（P.tut）：一间屋子、一堆金币、两只怪（第二只先考一道拼写），
   清完挑一件遗物，踩上阶梯就结束。**不写续玩档、不结算、不记死亡**，读条也关掉。
   提示走右上角那个小气泡（coach），按事件一步一步换字，点一下能收起。*/
var tutPending = false;
let tutStep = "", tutBattles = 0;
function tutDone(){ return !!MET.tut; }
function startTutorial(){
  hideAll();
  setChapter(1);
  practiceOn = false; diffOn = DIFF_DEFAULT;
  tutPending = true; tutStep = ""; tutBattles = 0; tutShown = {};
  SCENE = "run"; showScene(); showView("viewAdv");
  newRun();
}
function genTutorialFloor(){
  const map = [], seen = [], vis = [];
  for(let y=0;y<H;y++){
    map.push(new Array(W).fill(0));
    seen.push(new Array(W).fill(true));
    vis.push(new Array(W).fill(true));
  }
  /* 一间 7×5 的屋子，按取景框（人居中、左右各 4 格）排：一进来金币和两只怪全都看得见 */
  const w = 7, h = 5, x0 = Math.floor((W - w) / 2), y0 = Math.floor((H - h) / 2);
  for(let j=y0;j<y0+h;j++) for(let i=x0;i<x0+w;i++) map[j][i] = 1;
  G.map = map; G.seen = seen; G.vis = vis; G.mobs = []; G.things = [];
  G.rooms = [{x:x0, y:y0, w:w, h:h}];
  const my = y0 + 2;
  P.x = x0 + 1; P.y = my;
  G.things.push({x:x0 + 3, y:my, kind:"gold", amt:12});
  G.mobs.push(makeFoe(FOES[0], x0 + 5, y0 + 1));
  G.mobs.push(makeFoe(FOES[1], x0 + 5, y0 + 3));
  G.stair = {x:x0 + 6, y:my};          // 清空前只是个占位，真阶梯开在最后一只怪倒下的地方
}
/* 题型排好：第一只怪英→中、中→英轮着来；第二只怪第一题是拼写 */
function tutQuestionType(asked){
  if(tutBattles >= 2 && asked === 1) return "spell";
  return (asked % 2 === 1) ? "en2zh" : "zh2en";
}
/* 五步，每一步只教一件事（用户 2026-09-24：「新手教程还是很模糊，keep simple and clear」）：
   1 捡金币 → 2 打第一只怪 → 3 打第二只（先考一道拼写）→ 4 挑遗物 → 5 走上阶梯。
   气泡左边一个「2/5」，写这一步要干什么；要点的那一格在地图上一直闪（tutTarget()）。
   一句话一个意思，别再往一条提示里塞两件事（原来「连击 + 冒险」挤在一条里，读不完就被下一条顶掉了）。*/
const TUT_TEXT = {
  walk:  [1, "点一下<b>金币</b>，走过去捡起来。",
             "Tap the <b>gold</b> to walk over and pick it up."],
  gold:  [2, "点一下<b>怪物</b>，开始战斗。",
             "Tap a <b>monster</b> to fight it."],
  fight: [2, "选出意思：<b>答对你砍它，答错它咬你</b>。",
             "<b>Right</b>: you hit it. <b>Wrong</b>: it bites you."],
  right: [2, "答对了！<b>连着答对</b>，伤害越来越高。",
             "Correct! <b>Keep a streak</b> for more damage."],
  wrong: [2, "答错会掉血。这个词<b>过一会儿还会再考</b>。",
             "Wrong costs HP. This word <b>comes back later</b>."],
  kill:  [3, "打倒一只！再去打<b>另一只</b>。",
             "One down! Now fight <b>the other one</b>."],
  spell: [3, LEARN_ZH ? "拼写题：<b>按顺序点汉字</b>，拼出这个词。"
           : LEARN_JA ? "拼写题：<b>按顺序点假名</b>，拼出读音。"
                      : "拼写题：<b>按顺序点字母</b>，拼出这个词。",
          LEARN_ZH ? "Spelling: <b>tap the characters in order</b>."
          : LEARN_JA ? "Spelling: <b>tap the kana in order</b>."
                     : "Spelling: <b>tap the letters in order</b>."],
  clear: [4, "清空了！<b>挑一件遗物</b>，让你变强。",
             "Floor cleared! <b>Pick a relic</b> to get stronger."],
  relic: [5, "阶梯 ▼ 出现了，<b>走上去</b>就完成教程。",
             "Stairs ▼ appeared. <b>Step on them</b> to finish."],
  done:  [0, "教程完成！回镇上点<b>「洞窟」</b>开始冒险。",
             "All done! In town, tap <b>Caves</b> to start."]
};
const TUT_STEPS = 5;
function coachEl(){
  let el = $("coach");
  if(el) return el;
  el = document.createElement("div");
  el.id = "coach"; el.className = "coach"; el.hidden = true;
  el.innerHTML = "<div class=\"crow\"><i></i><p></p></div><button type=\"button\" class=\"btn primary\" hidden></button>";
  el.addEventListener("click", function(ev){
    if(ev.target.tagName === "BUTTON") return;
    if(tipOn){ tipNext(); return; }                 // 第一趟的提示：点一下换下一条
    if(tutStep !== "done") el.hidden = true;       // 点一下收起（最后那一步必须点按钮）
  });
  document.body.appendChild(el);
  return el;
}
function coach(key, btn, onBtn){
  const el = coachEl(), t = TUT_TEXT[key];
  if(!t) return;
  tipClear();
  tutStep = key;
  const i = el.querySelector("i");
  i.textContent = t[0] ? t[0] + "/" + TUT_STEPS : "✓";
  el.querySelector("p").innerHTML = UI_EN ? t[2] : t[1];
  const b = el.querySelector("button");
  b.hidden = !btn;
  if(btn){ b.textContent = btn; b.onclick = onBtn; }
  el.hidden = false;
  if(G && G.map) render();             // 地图上要点的那一格跟着这一步换
}
function coachOff(){ const el = $("coach"); if(el) el.hidden = true; }
/* 这一步要点地图上哪一格（render() 给它挂 .tutmark，一直闪）：
   捡金币 → 那堆金币；打怪 → 最近的一只；挑完遗物 → 阶梯。别的步骤不闪。*/
function tutTarget(){
  if(!P || !P.tut || !G || !G.mobs) return null;
  if(tutStep === "walk"){
    const g = G.things.find(function(t){ return t.kind === "gold"; });
    if(g) return g;
  }
  if(tutStep === "walk" || tutStep === "gold" || tutStep === "kill"){
    let best = null, bd = 1e9;
    G.mobs.forEach(function(m){ const d = Math.abs(m.x - P.x) + Math.abs(m.y - P.y); if(d < bd){ bd = d; best = m; } });
    return best;
  }
  if(tutStep === "relic" && !G.mobs.length) return G.stair;
  return null;
}
function tutChrome(on){
  document.body.classList.toggle("tutmode", !!on);
  $("btnAbandon").textContent = abandonText();
}
function tutBegin(){
  say(L("—— 新手教程 ——", "— Tutorial —"), "crit");
  tutChrome(true);
  coach("walk");
}
/* 按事件推进：每一条提示只出一次（先打怪再回来捡钱也不会倒着冒出来）。
   第一只怪只讲一次「答对 / 答错」—— 哪个先发生讲哪个，另一个不再讲，免得两条挨着互相顶掉。*/
let tutShown = {};
function tutEvent(ev){
  if(!P || !P.tut) return;
  const once = function(k){ if(!tutShown[k]){ tutShown[k] = 1; coach(k); } };
  if(ev === "gold"){ if(!tutShown.fight) once("gold"); }
  else if(ev === "battle"){
    tutBattles++;
    once(tutBattles === 1 ? "fight" : "spell");
  }
  else if((ev === "right" || ev === "wrong") && tutBattles === 1 && !tutShown.right && !tutShown.wrong) once(ev);
  else if(ev === "kill") once("kill");
  else if(ev === "clear") once("clear");
  else if(ev === "relic") once("relic");
}
function tutFinish(skipped){
  MET.tut = 1;
  if(typeof MET.tips !== "number") MET.tips = 0;   // 教程之后的第一趟提示：从这儿起才出（老账号没有这个字段，一条都不出）
  commitPerm();                          // 一个账号一次：马上落盘
  const leave = function(){ coachOff(); goTown(); tutChrome(false); };
  if(skipped){ leave(); return; }
  G.paused = true;
  coach("done", L("回到镇上", "Go to town"), leave);
}
/* ================= 第一趟的提示（用户 2026-09-24） =================
   教程只教了打怪；走完以后第一次进洞窟 / 选难度 / 下第一层 / 打第一场，各补一句话。
   复用教程那个气泡（不带步骤徽章，左边一个「!」），点一下收起或换下一条；要看的按钮跟着闪（.tipmark）。
   **每条一个账号只出一次**：记在 MET.tips 的位上（跟 tut 一起落盘、合并取并集），
   ⚠️ MET.tips 只有走过（或跳过）教程才会从 undefined 变成 0 —— 老账号一条都不出，别改成默认 0。
   ⚠️ 存档码不带它（换设备后就当老账号，不再出提示），故意的。
   加一条：TIP_TEXT 抄一行（位号往后排）+ 在该出的地方 tip("键")。一句话、别超过一行（390 宽中文 ≤ 18 字）。*/
const TIP_TEXT = {
  route:    [0, "第一次先走<b>「石廊」</b>，词最简单。",
                "Start with <b>Stone Hall</b>: easiest words."],
  practice: [1, "开<b>「练习模式」</b>几乎不掉血。",
                "<b>Practice mode</b>: you barely lose HP."],
  diff:     [2, "<b>A 最难，D 最松</b>，每次进洞都能重选。",
                "<b>A is hardest, D easiest.</b> Pick each run."],
  path:     [3, "点左下<b>「寻路」</b>，自动打怪捡钱。",
                "Tap <b>Path</b> (bottom-left) to auto-fight."],
  risk:     [4, "有把握再<b>「冒险」</b>，答错掉两倍血。",
                "<b>Risk it</b> if sure: 2× damage, or 2× hurt."]
};
const TIP_MARK = { route:function(){ return document.querySelector("#routeList .route:not(.off)"); },
                   practice:function(){ return $("btnPractice"); },
                   path:function(){ return $("btnPathfind"); },
                   risk:function(){ return $("btnWager"); } };
let tipOn = "", tipQ = [], tipWatch = null;
function tipSeen(k){ return typeof MET.tips !== "number" || !!(MET.tips & (1 << TIP_TEXT[k][0])); }
function tipUnmark(){ document.querySelectorAll(".tipmark").forEach(function(e){ e.classList.remove("tipmark"); }); }
function tipClear(){
  tipOn = ""; tipQ = []; tipUnmark();
  if(tipWatch){ tipWatch.disconnect(); tipWatch = null; }
}
/* 排一串提示；veilId 给了的话，那个弹层一关气泡就跟着收（选完路线、关掉洞窟都不该留着它）。*/
function tip(keys, veilId){
  if(COOP || (P && P.tut)) return;
  keys = [].concat(keys).filter(function(k){ return !tipSeen(k); });
  if(!keys.length) return;
  tipClear();
  tipQ = keys;
  if(veilId && $(veilId) && window.MutationObserver){
    tipWatch = new MutationObserver(function(){
      if(!$(veilId).hidden) return;
      const was = tipOn;
      tipClear(); coachOff();
      /* 讲完「冒险」，打完这一场让右下角的「锁定冒险」闪一下（不另出一条字，到下一层就停） */
      if(was === "risk"){ const lk = $("btnLockWager"); if(lk) lk.classList.add("tipmark"); }
    });
    tipWatch.observe($(veilId), {attributes:true, attributeFilter:["hidden"]});
  }
  tipNext();
}
function tipNext(){
  tipUnmark();
  const k = tipQ.shift();
  if(!k){ tipClear(); coachOff(); return; }
  const el = coachEl(), t = TIP_TEXT[k];
  tipOn = k; tutStep = "";
  MET.tips |= 1 << t[0];
  commitPerm();                          // 看过就算：马上落盘
  el.querySelector("i").textContent = "!";
  el.querySelector("p").innerHTML = UI_EN ? t[2] : t[1];
  el.querySelector("button").hidden = true;
  el.hidden = false;
  const m = TIP_MARK[k] && TIP_MARK[k]();
  if(m) m.classList.add("tipmark");
}
function tipOff(){ if(tipOn){ tipClear(); coachOff(); } }
$("btnTutorial").addEventListener("click", function(){
  if(SCENE === "run" && G && !G.over){ toast(L("先回镇上再重走教程。", "Return to town to replay the tutorial.")); return; }
  startTutorial();
});
$("langPanel").addEventListener("click", langClick);
$("veilLang").addEventListener("click", function(ev){
  const b = ev.target.closest ? ev.target.closest("button[data-ui]") : null;
  if(b) openLearnPick(b.dataset.ui, "first");
});
$("learnList").addEventListener("click", function(ev){
  const b = ev.target.closest ? ev.target.closest(".lcard") : null;
  if(b) takeLearn(b.dataset.learn);
});
$("btnLearnBack").addEventListener("click", function(){
  $("veilLearn").hidden = true;
  if(learnFor.mode === "first") openLangPick();   // 第一次进来：退回挑母语那一步
});
renderLangPanel();
if(COOP){ $("panelLang").hidden = true; $("btnTutorial").hidden = true; }   // 联机固定语言，也不走教程

/* ================= 启动 =================
   打开就自动接着上次存下的那一层 —— 不问、不弹窗（单人版、联机版都一样，
   联机版没组队也能先逛主城）。不想接着走的话，取景框左下角有「放弃」。 */
renderLock();                      // 「锁定冒险」的开关状态存在 OPT 里，开局先摆正
(function boot(){
  const s = readRun();
  if(s){ SCENE = "run"; showScene(); resumeRun(s); return; }
  goTown();
  if(COOP) return;                 // 联机固定中文界面 + 学英语，也不走教程
  if(!LANG_SET){
    /* 第一次打开：新账号先挑语言（挑完才走教程）；老账号 = 更新之前就在玩的，
       默认就是原来那一档，不打扰，教程也直接记成走过（设置里能再走一遍）。*/
    if(isFreshAccount()){ openLangPick(); return; }
    OPT.lang = {ui:LANG_UI, learn:LANG_LEARN};
    saveOpt();
    if(!tutDone()){ MET.tut = 1; commitPerm(); }
  }
  if(!tutDone()) startTutorial();
})();
refreshSaveState();
})();
