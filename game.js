/* 幽墟回廊 · 核心逻辑
   依赖加载顺序：util.js → words-a1.js → content.js → art.js → game.js
   本文件只管规则和渲染，数值和文案在 content.js / words-a1.js */
(function(){
"use strict";

const W = CHAPTER.W, H = CHAPTER.H, FLOORS = CHAPTER.floors;
const LEX_KEY = "youxu.a1lex.v1", CODEX_KEY = "youxu.codex.v1", META_KEY = "youxu.meta2.v1";

/* 所有落盘都过这一道。util 的 save 写不进去会返回 false（无痕模式、本地存储被禁、配额满），
   以前是静默丢档 —— 玩家一路玩一路以为在存，关掉才发现什么都没有。现在第一次失败就顶到
   页面顶部那条报错横幅上，并指路去下载存档文件。 */
var saveWarned = false;
function put(k, v){
  if(save(k, v)) return true;
  if(!saveWarned){
    saveWarned = true;
    if(window.showErr) window.showErr(
      "存档写不进去 —— 浏览器多半开了无痕模式，或者禁掉了本地存储。这一趟关掉页面就没了，换个普通窗口再来。");
  }
  return false;
}

/* 三份永久数据都常驻内存，游戏过程中只改内存；落盘统一交给 commit()。
   —— 存档点只有三个：进入关卡 / 下一层 / 回到主城。 */
let LEX = load(LEX_KEY, {});
let CODEX = load(CODEX_KEY, {});
let MET = load(META_KEY, {best:0, runs:0, clears:0, t:0});
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
function setChapter(id){
  const c = chapterById(id);
  if(c) CH = c;
  $("hChap").textContent = CH.name;   // 顶栏那块在主城里固定写「主城 · 灰岩镇」，不用管
  return CH;
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
        spent:0, bonusAtk:0, bonusHp:0, chew:false, charge:0,
        // 护盾（第四批）：先扣盾再扣血。shield 是当前盾，aegisN 是凝盾数到第几题了
        shield:0, aegisN:0, recoil:0 };
  G = { floor:0, paused:false, over:false };
  newRelics = [];
  comboShown = null;          // 连击动效的基准，新的一趟从头算（不然第一场会白播一次「掉了」）
  autoOff();
  // 不用先删旧档：下面 nextFloor() 会 commit 一次，直接盖掉（存档点之一：进入关卡）
  $("log").innerHTML = "";
  hideAll();
  say("石门在身后合上。走廊里只有火把的回声。", "sys");
  say("这一层有几只东西待在原地不动 —— 找到它们，念对那个词。", "sys");
  nextFloor();
}
/* 升一级要多少经验。「速成」在这儿减 20% —— HUD 的经验条和 gainXp 都走它，一处改两处生效。*/
function xpNeed(l){
  const n = 5 + l * 3;
  return hasRelic("adept") ? Math.max(1, Math.ceil(n * 0.8)) : n;   // 速成
}
/* 属性只有两个来源：等级 + 遗物。装备系统已删。
   幸运也一并去掉了 —— 它只影响过掉宝品质，现在没宝可掉。*/
function stats(){
  const pb = CHAPTER.playerBase, pl = CHAPTER.perLevel;
  const s = {atk: pb.atk + (P.lvl-1) * pl.atk, def:0, crit:pb.crit,
             maxHp: pb.hp + (P.lvl-1) * pl.hp};
  // 普通品质：纯数值，全部在这儿结清
  if(hasRelic("whet"))  s.atk += 1;
  if(hasRelic("grind")) s.atk += 2;
  if(hasRelic("nick")){ s.atk += 1; s.crit += 5; }
  if(hasRelic("iron"))  s.def += 1;
  if(hasRelic("plate")) s.def += 2;
  if(hasRelic("gird")){ s.def += 1; s.maxHp += 4; }
  if(hasRelic("heart")) s.maxHp += 6;
  if(hasRelic("ward"))  s.maxHp += 8;
  if(hasRelic("vigor")) s.maxHp += 12;
  if(hasRelic("pad"))   s.maxHp += 10;                       // 棉衬
  if(hasRelic("callus")){ s.def += 1; s.maxHp += 4; }        // 硬茧
  if(hasRelic("keen"))  s.crit += 15;
  if(hasRelic("edge"))  s.crit += 8;
  /* 成长线：拿到「烙印」「铭心」之后每升一级攒下来的，记在 P 上（gainXp 里加） */
  if(P.bonusAtk) s.atk += P.bonusAtk;                        // 烙印：每级 +1 攻击
  if(P.bonusHp)  s.maxHp += P.bonusHp;                       // 铭心：每级 +3 上限
  /* 献身：最大生命减半 —— **必须放在所有加血遗物之后**，下面的背水也按减半后的上限判 */
  if(hasRelic("offer")) s.maxHp = Math.max(1, Math.ceil(s.maxHp / 2));
  if(hasRelic("stand") && P.hp < s.maxHp / 2) s.def += 4;   // 背水
  /* 守财现在是百分比伤害，不在这儿加攻击了 —— 见 answer() 的百分比层 */
  return s;
}
/* ================= 生成 ================= */
function nextFloor(){
  cancelWalk();
  autoOff();       // 下一层要重新手动开寻路（用户 2026-09），别自己接着冲
  /* 盲斗：每下一层楼梯**直接往下 BLIND_STEP 层**（用户 2026-09）。
     ⚠️ 撞到章末那一层就停在那儿 —— 不能让人跳过章末 Boss 直接通关。*/
  const from = G.floor;
  const jump = (P && P.relics && from > 0 && from < FLOORS && hasRelic("blind")) ? BLIND_STEP : 1;
  G.floor = jump > 1 ? Math.min(from + jump, FLOORS) : from + 1;
  P.undying = false;
  G.relicDone = false;     // 这一层清完再给一次遗物
  if(P.relics){                                    // 进层结算的普通遗物
    if(hasRelic("lamp"))  healUp(5);                                   // 油灯
    if(hasRelic("purse")) P.gold += 30;                                // 钱袋
  }
  G.echoUsed = false;      // 「回声」每层一次
  G.reciteFree = 0;        // 「默诵」每层 RECITE_FREE 次
  G.holdUsed = 0;          // 「屏息」每层 HOLD_FREE 次
  G.rerollUsed = false;    // 「重掷」每层一次
  G.openUsed = false;      // 「开场」每层一次
  G.fleeFree = false;      // 「脱壳」每层第一次撤退不掉血
  G.glassCut = 0;          // 「沙漏」这一层被超时削掉了几秒读条
  /* 盾誓：每进一层把护盾**补到**上限的 SHIELD_FLOOR_PCT —— 取大值而不是直接赋值，
     免得把「凝盾」辛苦攒下的一大堆盾按回去。*/
  if(hasRelic("vow")){
    const want = Math.max(1, Math.ceil(stats().maxHp * SHIELD_FLOOR_PCT));
    if((P.shield || 0) < want){ P.shield = want; say("盾誓在身前合拢 —— 护盾 <b>" + want + "</b>。", "good"); }
  }
  if(hasRelic("thick")) P.shield = (P.shield || 0) + THICK_SHIELD;   // 厚盾：每层白得一点
  if(G.floor > FLOORS){ chapterClear(); return; }
  genFloor();
  if(hasRelic("water")) drinkAll();     // 「水」：泉是 genFloor 摆的，所以只能放在它后面
  fov();
  buildGrid();
  render();
  lockInput(320);
  const last = G.floor === FLOORS;
  const bossRoom = isBossFloor(G.floor);
  if(G.floor > from + 1) say("盲斗把楼梯烧穿了 —— 你一口气落到了第 " + G.floor + " 层。", "crit");
  say("—— " + CH.name + " 第 " + G.floor + " 层" + (bossRoom ? " · BOSS" : "") + " ——", "crit");
  say(last ? "空气冷得发硬。这一层尽头有东西在等。"
     : bossRoom ? ("门在身后落下。一间屋子，一只 " + G.mobs[0].name + "。")
     : ("这一层有 " + G.mobs.length + " 只敌人。清干净才能下去。"), (last || bossRoom) ? "hurt" : "sys");
  commit(true);          // 存档点之二：下一层
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
/* 每 BOSS_EVERY 层就是一层 Boss 房（第 10/20/30/40/50 层）。顶栏那层写成 `10*`，血色。 */
function isBossFloor(f){ return f > 0 && f % BOSS_EVERY === 0; }
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
  const def = (G.floor === FLOORS) ? CH.boss : GATEKEEPER;
  G.mobs.push(makeBossFoe(def, bx, by));
}
function genFloor(){
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
    G.things.push({x:sp.x, y:sp.y, kind:"gold", amt: ri(2,6) + G.floor});
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
/* 一只怪在第 floor 层的数值：基础 + 层数成长 + 章节 foeBonus，**最后**再乘一次分段倍率。
   抽出来是因为 Boss 房要「参照上一层的小怪」现算一遍（refFoe）。 */
function foeNums(def, floor){
  const gw = CHAPTER.grow;
  // def.fixed = 章末 Boss，数值写死不随层数长、也不吃分段倍率；别的（含守层者）都要长
  const step = def.fixed ? 0 : Math.max(0, floor - 1);
  const fb = (def.fixed ? null : CH.foeBonus) || {hp:0, dmg:0, armor:0, xp:0};
  const band = def.fixed ? {hp:1, dmg:1} : foeBand(floor);
  return {
    hp:  Math.max(1, Math.round((def.hp  + step * gw.hpPerFloor + fb.hp) * band.hp)),
    dmg: Math.max(1, Math.round((def.dmg + Math.floor(step / gw.dmgEvery) + fb.dmg) * band.dmg)),
    armor: def.armor + fb.armor,
    xp: def.xp + Math.floor(step / gw.xpEvery) + fb.xp
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
  $("hFloor").textContent = G.floor + (bossFloor ? "*" : "") + "/" + FLOORS;
  $("hFloor").classList.toggle("bossfloor", bossFloor);
  $("hLevel").textContent = P.lvl;
  $("hGold").textContent = P.gold;
  const left = G.mobs.length;
  $("hLeft").textContent = left === 0 ? "已清" : left;
  $("hLeft").parentNode.className = "hi " + (left === 0 ? "done" : "left");
  paintHp($("hpBar"), $("hpFill"), $("hpTxt"), P.hp, s.maxHp, $("hpShield"));
  const need = xpNeed(P.lvl);
  $("xpFill").style.width = Math.min(100, P.xp / need * 100) + "%";

  renderSheets(s);
}
function st(k,v){ return "<span class=\"s\">" + k + "<b>" + v + "</b></span>"; }
/* 血条：低于 35% 变深红，低于 15% 再加搏动。地牢和战斗界面共用一套 */
function paintHp(bar, fill, txt, hp, max, sh){
  const v = Math.max(0, hp), r = max > 0 ? v / max : 0;
  const shield = Math.max(0, (P && P.shield) || 0);
  fill.style.width = (r * 100) + "%";
  // 护盾：条子上压一段冷色 + 文字后面缀一个数。没有盾就什么都不显示
  if(sh) sh.style.width = (shield > 0 && max > 0 ? Math.min(100, shield / max * 100) : 0) + "%";
  txt.innerHTML = v + " / " + max +
    (shield > 0 ? " <span class=\"shn\">盾 " + shield + "</span>" : "");
  if(bar) bar.className = "hpbar" + (r <= 0.15 ? " low crit" : r <= 0.35 ? " low" : "");
}
function renderSheets(s){
  $("stats").innerHTML =
    st("攻击", s.atk) + st("护甲", s.def) + st("暴击", s.crit + "%");
  // 老存档里可能还留着已经删掉的词（比如整类删掉的虚词），统计时过一遍 WMAP
  const keys = Object.keys(LEX).filter(function(k){ return !!WMAP[k]; });
  let mastered = 0;
  keys.forEach(function(k){ if((LEX[k].str || 0) >= 3) mastered++; });
  // 三项各占一格（用户 2026-09）：掌握过的 / 遇见过的 / 词库一共多少
  $("vocab").innerHTML = st("已掌握", mastered) + st("已遇见", keys.length) + st("总数", WORDS.length);
  const acc = (P.right + P.wrong) ? Math.round(P.right / (P.right + P.wrong) * 100) + "%" : "—";
  $("runStats").innerHTML = st("答对", P.right) + st("答错", P.wrong) +
    st("正确率", acc) + st("击杀", P.kills) +
    st("等级", "Lv." + P.lvl) + st("经验", P.xp + " / " + xpNeed(P.lvl));
  renderRelics();
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
    if(G.seen[ty][tx] && G.map[ty][tx] === 1) say("那边过不去 —— 有东西挡着路。", "sys");
    return false;
  }
  cancelWalk();
  walkPath = path;
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
  const goals = G.mobs.concat(G.things.filter(function(th){ return th.kind === "gold"; }));
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
  if(G.paused){ autoWake(400); return; }                  // 弹层开着，等它关
  if(walkPath && walkPath.length){ autoWake(160); return; }   // 还在走，别插手
  if(!autoPath()){ autoOff(); return; }                   // 没地方可去了，自己关掉
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
  if(walkPath && walkPath.length) walkTimer = setTimeout(stepWalk, 108);
}
function tryMove(dx, dy, rep){
  if(G.paused || G.over) return;
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
      say("你拾起 <b>" + amt + "</b> 金币。", "sys");
      G.things.splice(G.things.indexOf(th),1);
      fxGold(P.x, P.y);                     // 碎屑飞向顶上的「金」
    } else if(th.kind === "feat"){ openSpring(th); return; }
    else if(th.kind === "altar"){ openAltar(th); return; }
    else if(th.kind === "chest"){ openChest(th); return; }
    else if(th.kind === "shop"){ openShop(th); return; }
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
  G.paused = true;
  const last = G.floor === FLOORS;
  // 盲斗会一口气往下走 BLIND_STEP 层 —— 门上写的层数得跟真正会落到的那一层对上
  const to = (!last && hasRelic("blind")) ? Math.min(G.floor + BLIND_STEP, FLOORS) : G.floor + 1;
  $("stairEyebrow").textContent = CH.name + " 第 " + G.floor + " 层 · 已清空";
  $("stairTitle").textContent = last ? "最后一道石门" : "阶梯通向第 " + to + " 层";
  $("stairNote").innerHTML = last
    ? "下面就是这一章的尽头。<b>下去就没有回头路。</b>"
    : (isBossFloor(to) ? "下面是一间屋子，里面<b>只有一只 BOSS</b>。" : "") +
      (to > G.floor + 1 ? "盲斗会把中间几层一起烧穿。" : "") +
      "下去之后<b>这一层不会再回来</b>。进下一层时会存一次档。";
  hideAll();
  $("veilStair").hidden = false;
  $("btnStairGo").focus();
}
function closeStair(go){
  $("veilStair").hidden = true;
  G.paused = false;
  if(go){ nextFloor(); return; }
  say("你在阶梯口停住了。想走的时候，再点一下脚下那格。", "sys");
  lockInput(200);
  render();
}

/* ================= 战斗 ================= */
function startBattle(m){
  /* 连击（P.combo）不在这儿清零 —— 它跟着人走，打完一只接着下一只还算数。
     只有答错、倒下、回主城才断。dice（赌骰层数）仍然是每场一算。 */
  B = {mob:m, q:null, locked:false, asked:0,
       wager:false, repeatUsed:false, retry:null, optCount:4, dice:0,
       pend:null, rescue:false, rescueTimer:null};
  clearQTimer();          // 上一场要是被别的路子掐断了，读条可能还挂着
  G.paused = true;
  $("foeArt").className = "portrait" + (m.boss ? " boss" : "");
  $("foeArt").innerHTML = ART[m.art];
  $("meArt").innerHTML = HERO;
  $("foeName").textContent = m.name;
  $("foeTag").textContent = m.boss ? "章节首领 · 全部词类" : ("遭遇 · " + CAT_CN[m.cat] + "类词");
  showWeak(m);
  $("btnFlee").hidden = false;
  $("veilBattle").hidden = false;
  say("你撞上了 " + m.name + "。", "hurt");
  if(P.combo > 0) say("上一场的连击 <b>×" + P.combo + "</b> 还留着 —— 别断。", "crit");
  renderBattleBars();
  nextQuestion();
}
/* Boss 的弱点是**词性**（POS_CN），普通怪的弱点是**类别**（CAT_CN）—— 看 m.weakPos */
function showWeak(m){
  const el = $("foeWeak");
  const cn = m.weak && (m.weakPos ? POS_CN[m.weak] : CAT_CN[m.weak]);
  if(!cn){ el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = "弱点 · <b>" + cn + "</b>类词伤害更高";
}
function renderBattleBars(){
  const m = B.mob, s = stats();
  $("foeFill").style.width = Math.max(0, m.hp / m.max * 100) + "%";
  $("foeTxt").textContent = Math.max(0, m.hp) + " / " + m.max;
  paintHp($("bHpBar"), $("bHpFill"), $("bHpTxt"), P.hp, s.maxHp, $("bHpShield"));
  renderCombo();
}
/* ---- 连击：每 comboStep 次 +comboPct%，可叠加不封顶（火星把 step 减 1）---- */
function comboStep(){ return Math.max(1, CHAPTER.comboStep - (hasRelic("spark") ? 1 : 0)); }
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
    "<span class=\"cmb-n\">连击 <b>×" + n + "</b></span>" +
    "<span class=\"cmb-p" + (pct ? "" : " off") + "\">伤害 +" + pct + "%</span>" +
    "<span class=\"cmb-next\">再对 " + need + " 个 +" + CHAPTER.comboPct + "%</span>";
  const was = comboShown;
  comboShown = n;
  if(was === null || was === n || REDUCE_MOTION) return;
  void c.offsetWidth;                       // 强制回流，连着涨两次也能再播一遍
  const cls = n > was ? "up" : "down";
  c.classList.add(cls);
  setTimeout(function(){ c.classList.remove(cls); }, 460);
}
/* **一章只出一个难度的词**（第一章 A1、第二章 A2、第三章 B1、第四章 B2）——
   用户定的「每章词不要重复」。以前是一章里从 A1 混到 B1，那样两章必然重叠。
   难度写在 content.js 的 CHAPTERS[].wordLv 上。*/
function chapterLv(){ return (CH && CH.wordLv) || 1; }
/* 这一章**真的有词**的词性（Boss 弱点只在这里面挑，用户 2026-09 从「按类别」改过来的）。
   每个难度的每个词性都补到了 ≥6（词库文件顶上的规矩），所以正常不会退回全表。*/
function chapterPos(){
  const lv = chapterLv(), out = [];
  Object.keys(BYPOS).forEach(function(p){
    if(BYPOS[p].filter(function(w){ return (w.lv || 1) === lv; }).length >= 6) out.push(p);
  });
  return out.length ? out : Object.keys(BYPOS);
}
/* 先按权重抽一个难度（数组里重复几次就是几倍权重），再按这个难度筛词。
   筛得太窄就逐级回退，**永远不返回空数组** —— 出不出题直接关系到能不能打。*/
function scopeToLevel(pool, want){
  let out = pool.filter(function(w){ return (w.lv || 1) === want; });
  if(out.length >= 6) return out;
  out = ALLW.filter(function(w){ return (w.lv || 1) === want; });
  return out.length >= 6 ? out : pool;
}
function scopeByLevel(pool){
  return scopeToLevel(pool, chapterLv());
}
/* **一趟之内答对过的词不再出第二次**（用户 2026-09）——「除了答错的」：
   答对就记进 `P.used`，答错（或先对后错）就从里面拿掉，于是错过的词照样会再来找你。
   心魔那条分支是故意不过滤的：它本来就是「这趟答错过的词」。
   ⚠️ 一章的词是问得完的（A1/A2 各 500 上下，B1/B2 各 2000）—— 挑空了就**清空 P.used 开新一轮**
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
  const catRate = hasRelic("scent") ? 0.9 : 0.7;        // 嗅迹：多出弱点类的词
  const all = scopeByLevel(ALLW);
  let pool = (cat !== "all" && Math.random() < catRate && BYCAT[cat]) ? BYCAT[cat] : ALLW;
  pool = unused(scopeByLevel(pool));
  if(!pool.length) pool = unused(all);                  // 这一类问完了，退回全池
  if(!pool.length){ P.used = {}; pool = all; }          // 整章都问过一轮了，从头再来
  /* **没学过的新词权重 80%**（用户 2026-09）：LEX 里没有记录 = 这个存档从没遇到过。
     掷中就只在生词里挑；这一章的生词问完了（fresh 空）自然落回下面那个熟练度加权袋。*/
  const fresh = pool.filter(function(w){ return !LEX[w.en]; });
  if(fresh.length && Math.random() < NEW_WORD_RATE) pool = fresh;
  const bag = [];
  pool.forEach(function(w){
    const r = LEX[w.en], s = r ? (r.str || 0) : 0;
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
  return Math.max(QUIZ_TIME_MIN, QUIZ_TIME - (G && G.glassCut ? G.glassCut : 0));
}
function startQTimer(){
  clearQTimer();
  if(!B || !B.q || B.q.type === "spell") return;
  const t = $("qTimer"), fill = $("qTimerFill");
  if(!t || !fill) return;
  const total = Math.max(1, qSeconds()) * 1000, t0 = Date.now();
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
    say("沙漏替你咽下了这一下 —— 这一层的读条只剩 <b>" + qSeconds() + "</b> 秒了。", "hurt");
    startQTimer();
    return;
  }
  const mit = mitigate(Math.max(1, m.dmg - s.def), s);
  if(mit.dodged){
    say("时间到 —— 你侧了半步躲开。题还在，接着答。", "hurt");
  } else {
    takeHit(mit.dmg, m, false);
    say("时间到，" + m.name + " 咬了你 <b>" + mit.dmg + "</b> 点。题还在，接着答。", "hurt");
  }
  if(P.hp <= 0 && hasRelic("undying") && !P.undying){
    P.undying = true; P.hp = 1;
    say("薪火在胸口炸开 —— 你以 1 点生命站住了。", "crit");
  }
  renderBattleBars();
  renderHud();
  if(P.hp <= 0){ B.locked = true; setTimeout(function(){ finishBattle(false); }, 480); return; }
  startQTimer();          // 题不换，读条重新开始
}
function nextQuestion(){
  clearQTimer();
  const m = B.mob;
  let word;
  // 复读者的重考优先，其它都现挑一个
  if(B.retry){ word = B.retry; B.retry = null; }   // 复读者：重考刚才那个
  else word = pickQuizWord(m.cat);
  B.asked++;
  let type;
  if(B.rescue) type = "spell";                                // 复读者的补救题：一定是拼写
  else if(hasRelic("blind")) type = "spell";                  // 盲斗：全拼写
  else if(Math.random() < spellChance()) type = "spell";      // 每题独立掷一次
  else type = (B.asked % 2 === 1) ? "en2zh" : "zh2en";
  // 听音辨词已经删掉了（用户 2026-09）。🔊 还在，但只能自己点，或者答完自动念。
  B.q = {word:word, type:type, done:false, haunted: hauntReady(word.en)};
  B.locked = false;
  // 「锁定冒险」开着就每题自动押上（拼写题除外，那题本来就不给冒险）
  B.wager = !!OPT.lock && type !== "spell";
  $("qHaunt").hidden = !B.q.haunted;
  const wr = $("wagerRow"), wb = $("btnWager");
  wb.classList.toggle("on", B.wager);
  wb.disabled = false;
  wr.hidden = (type === "spell");                             // 拼写题不给冒险，太难
  setWagerLabel();
  $("verdict").innerHTML = "";
  $("btnNextQ").hidden = true;
  $("btnNextQ").textContent = "继续";
  $("btnRescue").hidden = true;
  $("btnFlee").hidden = false;
  $("spellBar").hidden = true;
  $("letters").hidden = true;
  $("opts").hidden = false;
  $("btnSpeak").hidden = true;

  B.optCount = 4;
  if(type === "spell"){ renderSpell(word); return; }

  if(type === "en2zh"){
    $("qLabel").textContent = "这个词是什么意思？";
    $("qWord").textContent = word.en;
    $("qWord").className = "qword";
  } else {
    $("qLabel").textContent = "用英语怎么说？";
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
    if(opts.some(function(o){ return o.en === c.en || o.cn === c.cn; })) continue;
    opts.push(c);
  }
  opts.sort(function(){ return Math.random() - .5; });
  B.q.opts = opts;          // 答错时要照这个顺序把每个选项的中英都摊开（answer 里）
  const box = $("opts");
  box.innerHTML = "";
  opts.forEach(function(o, i){
    const b = document.createElement("button");
    b.type = "button"; b.className = "opt";
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
    b.firstChild.textContent = on ? "冒险中 · 双倍赌注" : "冒险 · 我确定";
  }
  const em = b.querySelector("em");
  if(em) em.textContent = OPT.lock ? "已锁定：每题自动冒险" : "对了伤害翻倍，错了受伤翻倍";
}
function renderSpell(word){
  $("qLabel").textContent = "拼出这个词 · 对了双倍经验";
  $("qWord").textContent = word.cn;
  $("qWord").className = "qword cn";
  $("opts").hidden = true;
  $("spellBar").hidden = false;
  $("letters").hidden = false;
  /* 拼写题旁边那个 🔊：进来先自动念一遍（用户 2026-09 要的），之后随时能再点。
     它不跟设置里的「答完自动朗读」挂钩 —— 那条管的是答完之后那一次。
     ⚠️ 走 speakQueued：**等上一题那次朗读念完了再念**（用户 2026-09），
        直接 speak() 会把上一段掐断，两个词叠在一起听。*/
  $("btnSpellSpeak").hidden = !CAN_SPEAK;
  speakQueued(word.en);
  B.spell = "";
  const letters = word.en.split("");
  /* 净写：不再给那两个干扰字母，键盘上只剩这个词自己的字母 */
  if(!hasRelic("clean")){
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
  B.gift = hasRelic("stroke") ? ri(0, word.en.length - 1) : null;
  const box = $("letters");
  box.innerHTML = "";
  letters.forEach(function(ch){
    const b = document.createElement("button");
    b.type = "button"; b.className = "lbtn"; b.textContent = ch;
    b.addEventListener("click", function(){
      if(B.locked || B.spell.length >= word.en.length) return;
      B.spell += ch; b.disabled = true; b.dataset.used = "1";
      spellStep(word, box);
    });
    box.appendChild(b);
  });
  const back = document.createElement("button");
  back.type = "button"; back.className = "lbtn"; back.textContent = "⌫";
  back.addEventListener("click", function(){
    if(B.locked || !B.spell.length) return;
    spellPop(box);
    /* 笔顺送的那一格不能挡着退格：退到它头上就连它一起退掉，
       不然它下一拍又被自动填回来，前面那个字母就永远改不了了。*/
    if(typeof B.gift === "number" && B.spell.length === B.gift && B.spell.length > 0) spellPop(box);
    if(typeof B.gift === "number" && B.spell.length === B.gift) giftFill(word, box);  // 第 0 格那种：马上补回来
    drawSpell(word);
  });
  box.appendChild(back);
  spellStep(word, box);        // 「笔顺」可能就送在第一格，进来先走一拍
}
/* 拼写题走一步：先补上「笔顺」送的那一格，再重画；填满了就判这一题 */
function spellStep(word, box){
  giftFill(word, box);
  drawSpell(word);
  if(B.spell.length && B.spell.length === word.en.length){
    setTimeout(function(){ answer(null, B.spell === word.en); }, 180);
  }
}
/* 笔顺：轮到 B.gift 那一格就自动填上，并把对应的字母键按掉（键盘上的字母数要对得上） */
function giftFill(word, box){
  if(typeof B.gift !== "number" || B.spell.length !== B.gift) return;
  const ch = word.en[B.gift];
  B.spell += ch;
  Array.prototype.some.call(box.children, function(b){
    if(!b.disabled && b.textContent === ch){ b.disabled = true; b.dataset.used = "1"; return true; }
    return false;
  });
}
/* 退一格：把最后那个字母还回键盘 */
function spellPop(box){
  const ch = B.spell.slice(-1);
  B.spell = B.spell.slice(0, -1);
  Array.prototype.some.call(box.children, function(b){
    if(b.disabled && b.textContent === ch){ b.disabled = false; delete b.dataset.used; return true; }
    return false;
  });
}
function drawSpell(word){
  const row = $("spellRow");
  /* 词长到 9 个字母以上，字格要缩一号，否则一行摆不下会折行、把战斗窗顶高 */
  row.className = "spellrow" + (word.en.length >= 9 ? " long" : "");
  row.innerHTML = "";
  for(let i=0;i<word.en.length;i++){
    const d = document.createElement("div");
    d.className = "sbox";
    d.textContent = B.spell[i] || "";
    row.appendChild(d);
  }
}
/* ================= 粒子反馈 =================
   捡到东西时，从东西所在的位置甩出几点碎屑，飞到它「进了哪儿」的那个数字上：
   金币 → 顶上那个「金」，遗物 → 底部的「遗物」标签。飞完那个目标自己跳一下。
   纯装饰：粒子挂在 body 上、pointer-events:none，飞完就删；
   系统开了「减少动态效果」就整段跳过，只留目标跳一下都不做。 */
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
  const open = Array.prototype.filter.call(document.querySelectorAll(".sheet"), function(el){ return rectOf(el); });
  const from = open[open.length - 1] || $("stageBox");
  const tab = document.querySelector('.nav[data-view="viewRelic"]');
  const color = getComputedStyle(document.documentElement)
                  .getPropertyValue("--q" + ((r && r.r) || 0)).trim() || "#B8860B";
  fxFly(from, tab, "gem", 6, color);
}
function floatNum(where, txt, cls){
  const host = where === "foe" ? document.querySelector(".foe") : document.querySelector(".mybar");
  const s = document.createElement("span");
  s.className = "float " + cls;
  s.textContent = txt;
  host.appendChild(s);
  setTimeout(function(){ if(s.parentNode) s.parentNode.removeChild(s); }, 900);
}
function answer(btn, ok){
  if(B.locked) return;
  B.locked = true;
  clearQTimer();                 // 答了就把读条收掉，别让它在判定画面上继续走
  $("btnWager").disabled = true;
  const word = B.q.word, m = B.mob, s = stats();
  const firstSeen = !LEX[word.en];          // 课业：这个存档从没见过的生词（LEX 里没记录）
  const rec = LEX[word.en] || {str:0, seen:0, wrong:0};
  rec.seen++;
  if(P.seenWords.indexOf(word.en) < 0) P.seenWords.push(word.en);
  // 一趟之内：答对过就不再出（记进 P.used），答错就放回池子里接着找你
  if(!P.used) P.used = {};
  if(ok) P.used[word.en] = 1; else delete P.used[word.en];

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
        sub.textContent = (B.q.type === "zh2en") ? o.cn : o.en;
        b.appendChild(sub);
        b.classList.add("two");
      }
    });
    if(!ok && btn) btn.classList.add("wrong");
  } else {
    Array.prototype.forEach.call($("letters").children, function(b){ b.disabled = true; });
  }

  const wasStrong = (rec.str || 0) >= 3;          // 学者：看的是答题前的熟练度
  // Boss 的弱点是词性，普通怪的弱点是类别（makeFoe 里的 weakPos 标着是哪一种）
  // 通感：每一题都算打中弱点（弱点的点伤、猎手、破绽、追猎全都跟着生效）
  const hitWeak = hasRelic("synes") || (!!m.weak && (m.weakPos ? word.pos === m.weak : word.cat === m.weak));
  const isSpell = B.q.type === "spell";
  let head, note = "";
  /* ⚠️ note 是死变量（从来没被渲染过，老代码留的）。新遗物的反馈一律攒在 relicLog 上，
     接到底下那条 say() 后面 —— 想让玩家在战斗窗里当场看见，就只能写进 head。*/
  let relicLog = "";
  /* 割裂：**每答一题**（不论对错）自伤 1 点，但**累计割掉 REND_CAP 点就停手**（用户 2026-09）。
     不会致死，最低留 1 点。P.rend 记的是这一趟一共割掉多少，跟着 P 进续玩档（读处 || 0）。*/
  if(hasRelic("rend") && (P.rend || 0) < REND_CAP){
    P.rend = (P.rend || 0) + 1;
    P.hp = Math.max(1, P.hp - 1);
    if(P.rend >= REND_CAP) relicLog += " <span class=\"sys\">(割裂割满 " + REND_CAP + " 点，从此不再割)</span>";
  }
  if(ok){
    P.right++; rec.str = Math.min(5, (rec.str||0) + 1); rec.wrong = 0;
    /* **冒险答对记 2 点连击**（用户 2026-09）—— 押上了本来就更难 */
    P.combo += B.wager ? 2 : 1;
    /* 拼对的默认奖励（数值在 content.js）：连击直接加一截 + 本场经验翻倍。
       连击是在算伤害之前加的 —— 这一刀就能吃到加成。*/
    if(isSpell){ P.combo += SPELL_COMBO * (hasRelic("boom") ? 2 : 1); B.xpx = SPELL_XPX; }  // 破音：连击奖励翻倍
    if(hitWeak && hasRelic("chase")) P.combo += 2;          // 追猎：打中弱点多攒两下
    /* 续弦：5% 把连击接回这一趟最长的那一串。**必须在下面更新 maxCombo 之前判**，
       不然 P.combo 刚好就是 maxCombo，接回来等于没接。*/
    if(hasRelic("restring") && P.combo < (P.maxCombo || 0) && Math.random() < 0.05){
      P.combo = P.maxCombo;
      relicLog += " <span class=\"sys\">(续弦 · 连击接回 ×" + P.combo + ")</span>";
    }
    if(P.combo > (P.maxCombo || 0)) P.maxCombo = P.combo;   // 结算按这个给宝石
    /* ===== 伤害：四层，顺序写死在这儿（品质阶梯见 content.js 顶上的注释）=====
         伤害 =（攻击 + 基础点伤）×（1 + 百分比合计）+ 点伤，再 ×暴击倍率，最后减护甲，最低 1
         额外伤害不进这条式子：无视护甲、不吃暴击，单独从怪血里扣。
       **只有「×(1+百分比)」和「×暴击倍率」两个乘区，别再加第三个。** */

    /* 无常（神圣）：每答对随机触发一档。伤害那一档攒在 B.whim 上，**只在这一场有效**，
       而且是在下面的百分比桶里跟别的 % 一起相加 —— 没有新乘区。*/
    let whim = "";
    if(hasRelic("whim")){
      const roll = ri(1, 3);
      if(roll === 1){ B.whim = (B.whim || 0) + 8; whim = "伤害 +8%（本场累计 " + B.whim + "%）"; }
      else if(roll === 2){
        const back = Math.max(1, Math.ceil(s.maxHp * 0.05));
        healUp(back, s);
        whim = "回 " + back + " 点生命";
      } else { P.gold += 60; whim = "+60 金"; }
      relicLog += " <span class=\"sys\">(无常 · " + whim + ")</span>";
    }

    // 第一层 · 基础点伤（会被百分比放大）
    let base = s.atk;
    if(wasStrong && hasRelic("scholar")) base += 1;                         // 学者

    // 第二层 · 百分比（全部相加，最后只乘一次）
    // 连击也在这一桶里：每 comboStep 次 +comboPct%，不封顶（火星让 step 少 1）
    const cbo = comboPct();
    let pct = cbo;
    if(hasRelic("quick")) pct += Math.min(20, Math.floor(P.combo / 5) * 2); // 速记：每 5 连击 +2%，上限 20%
    if(isSpell && hasRelic("carve")) pct += 20;                             // 刻字
    if(hasRelic("ember") && P.hp <= s.maxHp / 3) pct += 33;                 // 残焰
    if(hasRelic("hoard")) pct += Math.min(75, Math.floor((P.gold||0) / 200) * 5);  // 守财：每 200 金 +5%，上限 75%
    // 以 RELIC_MAX（15）为准，不跟着「行囊」的上限走，免得两件叠成滚雪球
    if(hasRelic("empty")) pct += Math.max(0, RELIC_MAX - P.relics.length) * 5;      // 空手：每少带一件 +5%
    if(hasRelic("spend")) pct += Math.min(40, Math.floor((P.spent || 0) / 300) * 2); // 散财：每花 300 金 +2%
    if(hasRelic("offer")) pct += 60;                                        // 献身（生命减半在 stats() 里）
    if(hasRelic("slay") && m.boss) pct += 25;                               // 弑主：Boss 和守层者
    if(hasRelic("delve")) pct += Math.min(40, G.floor * 0.5);               // 踏层：每下一层 +0.5%
    if(B.whim) pct += B.whim;                                               // 无常：本场攒下的
    if(hasRelic("bastion")) pct += (s.def || 0) * BASTION_PER;              // 铁壁：每 1 点护甲 +3%
    const recoil = hasRelic("recoil") ? (P.recoil || 0) * RECOIL_PCT : 0;   // 反震：挨几下就攒几层
    pct += recoil;
    /* 节奏件：「×2」「×1.5」都摊成②层的百分比 —— 全局仍然只有两个乘区。
       两件同时触发就是 +150%（相加，不是相乘）。*/
    if(hasRelic("opening") && !G.openUsed){ pct += 100; G.openUsed = true; }   // 开场：每层第一次答对
    if(hasRelic("greet") && !B.greetUsed){ pct += 50; B.greetUsed = true; }    // 见面礼：每场第一次答对

    // 第三层 · 点伤（百分比之后才加，吃暴击、被护甲减）
    let flat = 0;
    if(hitWeak) flat += hasRelic("hunter") ? 3 : 2;                         // 弱点 +2，猎手再 +1
    if(B.wager) flat += hasRelic("gambler") ? 5 : 3;                        // 冒对了
    let surge = false;
    if(hasRelic("surge") && Math.random() < .25){ flat += 4; surge = true; } // 潮汐
    // 镜盾：每 MIRROR_PER 点护盾 +1 点伤（③层：吃暴击、被护甲减，不被百分比放大）
    if(hasRelic("mirror")) flat += Math.floor((P.shield || 0) / MIRROR_PER);

    // 第四层 · 额外伤害（无视护甲、不吃暴击，单独一笔）
    let extra = 0;
    if(hasRelic("rend")) extra += REND_EXTRA;                               // 割裂（自伤在上面，每题一次）
    if(isSpell && hasRelic("recite")) extra += 2;                           // 默诵
    if(hasRelic("snow")) extra += P.combo >= 30 ? 9 : P.combo >= 20 ? 6 : P.combo >= 10 ? 3 : 0;  // 滚雪球

    // 第四层 · 暴击率／暴击伤害。超过 100% 的部分每 5 点换 +10% 暴击伤害，不浪费
    let critRate = s.crit, critMult = 2;
    if(hasRelic("maul")) critMult += 0.4;                                   // 重锤：暴击伤害 ×2 → ×2.4
    if(hasRelic("tempo") && P.combo >= 10) critRate += 15;                  // 节拍
    if(hasRelic("dice")) critRate += (B.dice || 0) * 5;                     // 赌骰
    if(hasRelic("charge")) critRate += (P.charge || 0) * 8;                 // 蓄势：攒了几刀没暴就加几个 8%
    if(critRate > 100){ critMult += Math.floor((critRate - 100) / 5) * 0.1; critRate = 100; }
    // 灵光：连击每满 5 次，那一刀必定暴击（吃的还是同一个暴击乘区，没有第三个）
    const forceCrit = hasRelic("flash") && P.combo > 0 && P.combo % 5 === 0;
    const crit = forceCrit || Math.random() * 100 < critRate;
    // 蓄势：暴了就清零，没暴就再攒一层（跨怪物保留，跟连击一个道理）
    if(hasRelic("charge")) P.charge = crit ? 0 : (P.charge || 0) + 1;

    let raw = Math.round(base * (1 + pct / 100)) + flat;
    if(crit) raw = Math.round(raw * critMult);                              // 乘区二
    // 破绽：打中弱点时无视护甲；碎颅：暴击时无视护甲
    const noArmor = (hitWeak && hasRelic("flaw")) || (crit && hasRelic("crush"));
    const armor = noArmor ? 0 : m.armor;
    const dmg = Math.max(1, raw - armor);
    if(crit && hasRelic("vamp")) healUp(4, s);                              // 饮血
    m.hp -= dmg + extra;
    /* 盲斗：答对**一击必杀**（用户 2026-09）。代价是所有题都变成拼写题 ——
       它现在是「拼得出就砍得死」的速通件，不再走伤害那条线。*/
    if(hasRelic("blind") && m.hp > 0){
      m.hp = 0;
      relicLog += " <span class=\"sys\">(盲斗 · 一击必杀)</span>";
    }
    /* 回响之厅（神圣）：50% 立刻再打一刀 —— 就是把刚才那一刀**原样再来一次**
       （不重新掷暴击、不再算额外伤害、不加连击），所以还是那两个乘区。*/
    let hall = 0;
    if(hasRelic("hall") && Math.random() < 0.5){
      hall = dmg;
      m.hp -= hall;
      setTimeout(function(){ floatNum("foe", "-" + hall, "dmg"); }, 380);
      relicLog += " <span class=\"sys\">(回响之厅又补了 " + hall + " 点)</span>";
    }
    if(recoil){ P.recoil = 0; relicLog += " <span class=\"sys\">(反震 +" + recoil + "% 打了出去)</span>"; }
    if(hasRelic("drain")) healUp(2, s);                                     // 吞噬
    /* 不死鸟：血掉到 PHOENIX_AT 以下之后，每答对回一大口。
       ⚠️ 判断放在饮血/吞噬**之后** —— 那两件先垫一口，还在线下才轮到它 */
    if(hasRelic("phoenix") && P.hp <= s.maxHp * PHOENIX_AT){
      const r = healUp(Math.max(1, Math.ceil(s.maxHp * PHOENIX_HEAL)), s);
      if(r.hp) relicLog += " <span class=\"sys\">(不死鸟回了 " + r.hp + " 点)</span>";
    }
    if(hasRelic("dice") && Math.random() < .10) B.dice = (B.dice || 0) + 1; // 赌骰：答对 10% 叠一层
    if(B.wager && hasRelic("allin") && Math.random() < .10){                // 孤注
      healUp(Math.max(1, Math.round(s.maxHp * 0.2)), s);
    }
    if(hasRelic("midas") && Math.random() < 0.25) P.gold += 10;             // 点金：固定 10 金
    /* 凝盾：每答对 AEGIS_EVERY 题攒 AEGIS_GAIN 点护盾，攒到 AEGIS_MAX 封顶 */
    if(hasRelic("aegis")){
      P.aegisN = (P.aegisN || 0) + 1;
      if(P.aegisN >= AEGIS_EVERY){
        P.aegisN = 0;
        const before = P.shield || 0;
        P.shield = Math.min(AEGIS_MAX, before + AEGIS_GAIN);
        if(P.shield > before) relicLog += " <span class=\"sys\">(凝盾 · 护盾 " + P.shield + ")</span>";
      }
    }
    if(wasStrong && hasRelic("tome")) P.gold += 8;                          // 典藏：答对掌握过的词
    if(firstSeen && hasRelic("lesson")) P.gold += 10;                       // 课业：这个存档第一次见的生词
    floatNum("foe", "-" + dmg, "dmg");
    if(extra > 0) setTimeout(function(){ floatNum("foe", "-" + extra, "dmg"); }, 220);
    $("foeArt").classList.remove("hurt"); void $("foeArt").offsetWidth; $("foeArt").classList.add("hurt");
    head = "<span class=\"big ok\">" +
           (B.wager ? "冒对了！" : crit ? "暴击！" : isSpell ? "拼对了！" : "命中！") + "</span>";
    note = "你砍中 " + m.name + "，造成 <b>" + dmg + "</b> 点伤害" +
           (hitWeak ? "（正中弱点）" : "") +
           (surge ? "，浪涌炸开" : "") +
           (pct ? "（+" + pct + "%" + (cbo ? "，其中连击 +" + cbo + "%" : "") + "）" : "") + "。" +
           (extra ? " 额外 <b>" + extra + "</b> 点无视护甲。" : "");
    /* 反刍：上一题答错了，这一题答对就回一口血 */
    if(P.chew && hasRelic("chew")){
      P.chew = false;
      const back = Math.max(1, Math.ceil(s.maxHp * 0.08));
      healUp(back, s);
      relicLog += " <span class=\"sys\">(反刍回了 " + back + " 点生命)</span>";
    }
    if(B.rescue){                                     // 补救成功：刚才欠的那一下一笔勾销
      B.rescue = false; B.pend = null;
      note += " <span style=\"color:var(--good)\">补救成功 —— 刚才那一下没掉血。</span>";
    }
    const hauntGone = dropHaunt(word.en);     // 答对了就从名单里拿掉（还没熬到的也一样）
    if(B.q.haunted && hauntGone){
      const back = hasRelic("bind") ? Math.max(1, Math.round(s.maxHp * 0.15)) : 2;
      healUp(back, s);
      note += " <span style=\"color:var(--venom)\">心魔散了，回 " + back + " 点生命。</span>";
    }
  } else {
    P.wrong++; rec.str = Math.max(0, (rec.str||0) - 1); rec.wrong = (rec.wrong||0) + 1;
    /* 铁胆：冒险失手不断连击；长链：答错只减半；
       **拼写题拼错也只减半**（用户 2026-09：拼写比选择难，错一次不该把长链清零）*/
    /* 断链：连击攒够 UNCHAIN_AT 就能拿它挡一下 —— 完全免伤，连击只减 UNCHAIN_CUT。
       ⚠️ **必须在下面动 P.combo 之前判**，不然连击已经清零/减半了，条件就永远不成立。*/
    const unchain = hasRelic("unchain") && P.combo >= UNCHAIN_AT;
    if(B.wager && hasRelic("nerve")){ /* 连击保住 */ }
    else if(unchain) P.combo = Math.max(0, P.combo - UNCHAIN_CUT);
    else if(isSpell || hasRelic("chain")) P.combo = Math.floor(P.combo / 2);
    else P.combo = 0;
    B.dice = 0;                       // 赌骰层数清零
    if(hasRelic("chew")) P.chew = true;     // 反刍：欠着，下一题答对才还
    if(hasRelic("build")){                  // 筑盾：错了也不白错
      P.shield = (P.shield || 0) + BUILD_SHIELD;
      relicLog += " <span class=\"sys\">(筑盾 · 护盾 " + P.shield + ")</span>";
    }
    const wasHaunted = B.q.haunted;
    addHaunt(word.en);                      // 答错就缠上来

    if(B.rescue){
      /* 补救题也答错 —— 把刚才欠下的那一下结清，这一题本身不再另算一次 */
      B.rescue = false;
      const owe = B.pend; B.pend = null;
      head = "<span class=\"big no\">补救失败</span>";
      note = takeHit(owe ? owe.dmg : Math.max(1, m.dmg - s.def), m, owe && owe.haunted);
    } else {
      // 受伤也全是加减：怪物伤害 − 护甲，再加上冒险失手/心魔的惩罚
      let dmg = Math.max(1, m.dmg - s.def);   // 背水已经算在 s.def 里
      if(B.wager) dmg += 2;                   // 冒险失手
      /* 偏移：心魔词答错时减半，**那额外的 1 点也免掉**（所以先不加） */
      const swerve = wasHaunted && hasRelic("swerve");
      if(wasHaunted && !swerve) dmg += 1;      // 心魔又答错
      if(swerve) dmg = Math.max(1, Math.ceil(dmg / 2));
      /* 断链排在所有免伤的最前面：它是拿连击换来的，不该去消耗默诵/回声/屏息的次数 */
      if(dmg > 0 && unchain){
        dmg = 0;
        head = "<span class=\"big no\">断链 —— 链子替你挨了</span>";
        note = "连击 −" + UNCHAIN_CUT + "，血一点没掉。";
      }
      // 默诵：拼写题答错不掉血，但**每层只有 RECITE_FREE 次**（老续玩档没这个字段，所以 || 0）
      if(dmg > 0 && isSpell && hasRelic("recite") && (G.reciteFree || 0) < RECITE_FREE){
        G.reciteFree = (G.reciteFree || 0) + 1;
        dmg = 0;
        head = "<span class=\"big no\">默诵替你挡下了</span>";
        note = "这一层的免伤还剩 " + (RECITE_FREE - G.reciteFree) + " 次。";
      }
      if(dmg > 0 && hasRelic("echo") && !G.echoUsed){           // 回声：每层第一次答错不掉血
        G.echoUsed = true;
        dmg = 0;
        head = "<span class=\"big no\">回声替你挡下了</span>";
        note = "这一层的第一次失手，不掉血。";
      }
      /* 防御线的减伤链放在**最后**：默诵/回声先挡，全挡下了就不消耗屏息的次数、也不掷错身。
         复读者欠下的那一下存的是**已经减过的**伤害，所以补救失败结清时不用再算一遍。*/
      if(dmg > 0){
        const mit = mitigate(dmg, s, {wrong:true});   // 告诉减伤链这是「答错」挨的（粗布只认这个）
        dmg = mit.dmg;
        if(mit.dodged){
          head = "<span class=\"big no\">错身 —— 没碰到你</span>";
          note = "你侧了半步，这一下落空了（连击照断）。";
        } else if(hasRelic("repeat") && !B.repeatUsed){
          /* 复读者：这一下先欠着，给 5 秒的补救窗口（openRescue 里倒计时）。
             点了补救就把这个词变成拼写题重来一次，拼对免伤，拼错才结清。 */
          B.pend = {dmg:dmg, haunted:wasHaunted};
          head = "<span class=\"big no\">失手 —— 还有一次补救</span>";
          note = "5 秒内点「补救」，把这个词拼对，这 <b>" + dmg + "</b> 点就不掉。";
          openRescue();
        } else {
          head = "<span class=\"big no\">" + (B.wager ? "冒险失手" : "失手") + "</span>";
          note = takeHit(dmg, m, wasHaunted);
          relicLog += mit.why;
        }
      } else if(!head){
        head = "<span class=\"big no\">失手</span>";
        note = "这一下没让你掉血。";
      }
      if(hasRelic("thorns")){                 // 赤鳞：额外伤害层，无视护甲
        m.hp -= 2;
        note += " 赤鳞反弹了 <b>2</b> 点。";
        floatNum("foe", "-2", "dmg");
      }
    }
    if(P.hp <= 0 && hasRelic("undying") && !P.undying){ P.undying = true; P.hp = 1; note += " 薪火在胸口炸开 —— 你以 1 点生命站住了。"; }
  }
  LEX[word.en] = rec;          // 只改内存，下一个存档点（下楼 / 回主城）才落盘

  $("verdict").innerHTML = head +
    "<span class=\"mean\"><b>" + word.en + "</b>　" + word.cn + "　<span style=\"color:var(--faint)\">" + CAT_CN[word.cat] + "</span></span>";
  if(CAN_SPEAK){
    $("btnSpeak").hidden = false;                  // 答完了，随时能再听一次
    if(OPT.speak) speak(word.en);                  // 设置里开着就自动念一遍
  }
  let spellLog = "";
  /* 拼错不再当场退回成选择题（用户 2026-09）—— 跟别的答错一样进心魔，
     熬满 HAUNT_DELAY 题才回来找你。*/
  if(isSpell && ok) spellLog =
    " <span class=\"sys\">(拼对 · 连击 +" + SPELL_COMBO + "，本场经验 ×" + SPELL_XPX + ")</span>";
  say((ok ? "答对 " : "答错 ") + word.en + " = " + word.cn + spellLog + relicLog, ok ? "good" : "hurt");
  renderBattleBars();
  renderHud();
  $("btnFlee").hidden = true;

  // 最后一击：多留一会儿，让人看清这一题的词和释义 —— 之后直接关窗，没有中间画面了
  if(m.hp <= 0){ setTimeout(function(){ finishBattle(true); }, 760); return; }
  if(P.hp <= 0){ setTimeout(function(){ finishBattle(false); }, 480); return; }
  if(B.rescueTimer) return;                 // 补救倒计时开着：只留「补救」这一个按钮
  if(ok && OPT.auto) setTimeout(function(){ if(B && B.locked) nextQuestion(); }, 450);
  else $("btnNextQ").hidden = false;
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
function mitigate(dmg, s0, opt){
  const s = s0 || stats();
  let out = dmg, why = "";
  const wrong = !!(opt && opt.wrong);        // 这一下是不是「答错」挨的（超时不算）
  /* 减伤百分比这一档**先全部相加再乘一次**（软甲 10 + 皮甲 5 = 15%）——
     跟伤害那边「只有一个百分比乘区」是同一条规矩，玩家要能心算。*/
  let cut = 0;
  if(hasRelic("soft")) cut += 10;                                         // 软甲
  if(hasRelic("hide")) cut += 5;                                          // 皮甲
  if(hasRelic("tough")) cut += Math.min(TOUGH_MAX, G.floor * TOUGH_PER);  // 老茧：每深一层 +1%
  if(hasRelic("scale") && P.hp < s.maxHp / 2) cut += SCALE_CUT;           // 逆鳞：半血以下
  /* ⚠️ 这一步**向下取整**（玩家占便宜）：向上取整的话 5% 在小数字上等于没有 ——
     早期怪只打 5~6 点，ceil(6×0.95)=6，皮甲就成了一件骗人的遗物。最低仍然掉 1 点（下面兜）。*/
  if(cut) out = Math.floor(out * (1 - cut / 100));
  /* 粗布排在屏息前面：它是**每场一次**（一层十来只怪，给得多），
     先花它才不会白白吃掉屏息那两次「每层」的额度。⚠️ 只认答错，超时不触发。*/
  if(wrong && hasRelic("burlap") && B && !B.burlapUsed){
    B.burlapUsed = true;
    out = Math.max(1, Math.ceil(out / 2));
    why += " <span class=\"sys\">(粗布挡掉一半)</span>";
  }
  if(hasRelic("hold") && (G.holdUsed || 0) < HOLD_FREE){                  // 屏息：每层前两次减半
    G.holdUsed = (G.holdUsed || 0) + 1;
    out = Math.max(1, Math.ceil(out / 2));
    why += " <span class=\"sys\">(屏息卸掉一半，这一层还剩 " + (HOLD_FREE - G.holdUsed) + " 次)</span>";
  }
  if(hasRelic("blunt")){                                                  // 钝痛：单次封顶
    const cap = Math.max(1, Math.ceil(s.maxHp * 0.1));
    if(out > cap){ out = cap; why += " <span class=\"sys\">(钝痛把这一下压到 " + cap + " 点)</span>"; }
  }
  out = Math.max(1, out);
  if(hasRelic("slip") && Math.random() < 0.25) return {dmg:0, dodged:true, why:""};   // 错身
  return {dmg:out, dodged:false, why:why};
}
/* ---- 挨一下：先扣护盾、剩下的才扣血，跳数字，返回写进 verdict 的那句话 ----
   ⚠️ **所有真的要掉血的路都必须从这儿过**（答错、超时、补救失败结清），
   护盾才不会被某一条路绕过去。
   ⚠️ 不走这儿的两处是**故意**的：撤退（那是掉一半上限，不是挨打，由「脱壳」管）
   和「割裂」的自伤（自己割的，盾挡不住）。 */
function takeHit(dmg, m, haunted){
  let left = dmg, ate = 0;
  if((P.shield || 0) > 0){
    ate = Math.min(P.shield, left);
    P.shield -= ate;
    left -= ate;
  }
  if(left > 0){
    P.hp -= left;
    // 反震：**真的掉了血**才攒（护盾全吃掉的那种不算）
    if(hasRelic("recoil")) P.recoil = Math.min(RECOIL_MAX, (P.recoil || 0) + 1);
  }
  floatNum("me", "-" + dmg, "ouch");
  return m.name + " 咬中你，" +
    (ate ? ("护盾吃掉 <b>" + ate + "</b> 点" + (left ? "，你失去 <b>" + left + "</b> 点生命" : "，血一点没掉") + "")
         : ("你失去 <b>" + left + "</b> 点生命")) +
    (haunted ? "（心魔加重）" : "") + "。";
}
/* ---- 复读者的补救窗口（用户 2026-09 选的方案：5 秒内自己点才进）----
   答错时伤害先欠着（B.pend），这五秒里只有「补救」一个按钮：
   点了 → 同一个词变成拼写题重来（B.rescue），拼对免伤、拼错结清；
   没点 → 倒计时归零自动结清，照常掉血。 */
function openRescue(){
  clearQTimer();               // 补救窗口自己有 5 秒倒计时，读条别跟它抢
  const b = $("btnRescue");
  let left = 5;
  b.textContent = "补救 · " + left + "s";
  b.hidden = false;
  $("btnNextQ").hidden = true;
  B.rescueTimer = setInterval(function(){
    left--;
    if(left <= 0){ closeRescue(true); return; }
    b.textContent = "补救 · " + left + "s";
  }, 1000);
}
function closeRescue(expired){
  if(B && B.rescueTimer){ clearInterval(B.rescueTimer); B.rescueTimer = null; }
  $("btnRescue").hidden = true;
  if(!B) return;
  if(!expired){                              // 玩家点了补救
    B.repeatUsed = true;
    B.rescue = true;
    B.retry = B.q.word;
    nextQuestion();
    return;
  }
  const owe = B.pend; B.pend = null;         // 没点：把欠的那一下结清
  if(owe){
    const m = B.mob;
    const line = takeHit(owe.dmg, m, owe.haunted);
    $("verdict").insertAdjacentHTML("beforeend", "<span class=\"mean\">没有补救 —— " + line + "</span>");
    say("没有补救，掉了 " + owe.dmg + " 点生命。", "hurt");
    if(P.hp <= 0 && hasRelic("undying") && !P.undying){ P.undying = true; P.hp = 1; say("薪火在胸口炸开 —— 你以 1 点生命站住了。", "crit"); }
    renderBattleBars();
    renderHud();
    if(P.hp <= 0){ setTimeout(function(){ finishBattle(false); }, 480); return; }
  }
  $("btnNextQ").hidden = false;
}
function finishBattle(win){
  const m = B.mob;
  clearQTimer();
  if(B.rescueTimer){ clearInterval(B.rescueTimer); B.rescueTimer = null; }
  $("btnRescue").hidden = true;
  if(!win){
    B = null;
    $("veilBattle").hidden = true;
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
  const xp = gainXp(m.xp * xpx);     // 求知的 +20% 在 gainXp 里加，日志写实际到手的
  // Boss 房一整层就它一只，身上压着一层份的金币（m.loot，makeBossFoe 里定的）
  const g = Math.round((ri(2,5) + G.floor + (m.loot || 0)) * (hasRelic("greed") ? 1.2 : 1));   // 拾荒者 +20%
  P.gold += g;
  fxKill(m.x, m.y);                  // 金币和经验各飞一串碎屑
  const s0 = stats();
  let heal = CHAPTER.killHeal;
  if(hasRelic("reap")) heal += 5;
  if(hasRelic("salve")) heal += 2;                                        // 药膏
  if(hasRelic("breath")) heal += Math.max(1, Math.ceil(s0.maxHp * BREATH_PCT));  // 喘息：每场一次
  const got = healUp(heal, s0);
  const gained = got.hp;
  say(m.name + " 化成了灰。<span class=\"sys\">(+" + xp + " EXP" + (xpx > 1 ? " ×" + xpx : "") +
      "，+" + g + " 金" +
      (gained > 0 ? "，回复 " + gained + " 生命" : "") + ")</span>", "good");
  if(G.mobs.length === 0){
    /* 阶梯直接开在最后一只怪倒下的地方 —— 不用再满地图找那个 ▼。
       怪站的一定是地板，所以这个位置永远合法。 */
    G.stair = {x:m.x, y:m.y};
    G.seen[m.y][m.x] = true;
    say("这一层清空了。" + m.name + " 倒下的地方裂开了 —— 阶梯 ▼ 就在那儿。", "crit");
    if(hasRelic("finale")){                       // 收尾：清完一层回 20% 上限
      const back = Math.max(1, Math.ceil(stats().maxHp * 0.2));
      const r = healUp(back);
      if(r.hp || r.sh) say("这一层干净了 —— 收尾替你补了 <b>" + r.hp + "</b> 点生命" +
        (r.sh ? "，溢出的化成 <b>" + r.sh + "</b> 点护盾" : "") + "。", "good");
    }
  }
  fov();
  // 普通怪不再掉东西（金币已经给过了）；遗物统一由清层/房间给
  G.paused = false;
  lockInput(260);        // 战斗窗是自动关的，挡一下手里还没停的那一点
  render();
  maybeRelic();
}
/* 撤退**要付一半的最大生命**（用户 2026-09，以前是白撤）：转身那一下露空门。
   最低留 1 点 —— 撤退不会把人撤死，但撤完基本只能去找泉水。
   怪身上掉的血照旧留着，回头还能接着打。*/
function flee(){
  if(!B || B.locked) return;
  autoOff();          // 主动撤退就是「我不想打这只」，别让自动寻路扭头又走回去
  clearQTimer();
  if(B.rescueTimer){ clearInterval(B.rescueTimer); B.rescueTimer = null; }
  $("btnRescue").hidden = true;
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
      ? ("你把壳留在原地，人退了出来 —— 这一层的第一次撤退不掉血。" + m.name + " 伤口还在。")
      : ("你转身退开 —— 空门露了一下，失去 <b>" + lost + "</b> 点生命。" +
         m.name + " 留在原地，伤口还在。"), "hurt");
  lockInput(260);
  renderHud();
  render();
}
/* 返回**实际到手**的经验（求知加成之后），调用方拿它去写日志 */
function gainXp(n){
  if(hasRelic("study")) n = Math.round(n * 1.2);        // 求知 +20%
  P.xp += n;
  while(P.xp >= xpNeed(P.lvl)){
    P.xp -= xpNeed(P.lvl);
    P.lvl++;
    /* 成长线：拿到之后升的级才算，累在 P 上（stats() 里读）。
       铭心涨的是上限，按老规矩当前血也跟着补上。*/
    if(hasRelic("brand")) P.bonusAtk = (P.bonusAtk || 0) + 1;                 // 烙印
    if(hasRelic("engrave")){ P.bonusHp = (P.bonusHp || 0) + 3; P.hp += 3; }   // 铭心
    const s = stats();
    healUp(CHAPTER.levelHeal, s);
    say("<b>等级提升！</b>你现在是 " + P.lvl + " 级 —— 攻击 " + s.atk + "，生命上限 " + s.maxHp + "。", "good");
  }
  return n;
}

/* ================= 房间：祭坛 / 上锁宝箱 / 游商 =================
   都挂在 G.things 上，靠 kind 分支。进格子时 onEnter 弹窗，处理完 G.paused 放开。 */
var ALTAR_COST = 5;
/* 祭坛要付多少血 —— 「祭余」把它砍到 1 点。判断、扣血、文案都走这一个口 */
function altarCost(){ return hasRelic("spare") ? 1 : ALTAR_COST; }

/* ---- 泉水：踩上去先问一句，不喝就留在原地，回头还能来 ----
   用户 2026-09 从「回满血」改成**回复最大生命的 CHAPTER.springPct**（向上取整、最少 1 点）。*/
function springHeal(s){ return Math.max(1, Math.ceil((s || stats()).maxHp * CHAPTER.springPct)); }
/* 「水」：一进这一层就把地上的泉全喝了，**溢出的按 SPILL_RATE 换护盾**
   （不管有没有「泉涌」—— 这是它自己那条词条，所以 healUp 传 force）。
   ⚠️ 必须在 genFloor() 之后调，那时候泉才摆上去。 */
function drinkAll(){
  const springs = G.things.filter(function(th){ return th.kind === "feat"; });
  if(!springs.length) return;
  const s = stats();
  let hp = 0, sh = 0;
  springs.forEach(function(th){
    const r = healUp(springHeal(s), s, true);
    hp += r.hp; sh += r.sh;
    removeThing(th);
  });
  say("你把这一层的泉水全喝了 —— 回复 <b>" + hp + "</b> 点生命" +
      (sh ? "，溢出的化成 <b>" + sh + "</b> 点护盾" : "") + "。", "good");
}
function openSpring(th){
  G.paused = true;
  pendingRoom = th;
  const s = stats(), room = s.maxHp - P.hp, full = springHeal(s);
  const heal = Math.min(room, full);
  /* 「泉涌」把喝不下的那部分变成护盾 —— 所以满血时它也值得喝，按钮不能再禁掉 */
  const spill = hasRelic("well") ? Math.floor(Math.max(0, full - room) / SPILL_RATE) : 0;
  $("springLedger").innerHTML =
    li("你现在", P.hp + " / " + s.maxHp + ((P.shield || 0) ? "　盾 " + P.shield : "")) +
    li("喝下去", (heal > 0 ? "回复 " + heal + " 点（上限的 " + Math.round(CHAPTER.springPct * 100) + "%）" : "你已经是满的了") +
                (spill > 0 ? "，溢出的化成 " + spill + " 点护盾" : ""));
  $("btnSpringDrink").disabled = room <= 0 && spill <= 0;
  $("btnSpringDrink").textContent = (room > 0 || spill > 0) ? "掬一捧喝下" : "喝不下了";
  $("springNote").textContent = (room > 0 || spill > 0)
    ? "这口泉只够喝一次 —— 喝完它就干了。不想现在喝，它会留在原地等你。"
    : "满血的时候喝它是浪费。留着，等真需要的时候回来。";
  hideAll();
  $("veilSpring").hidden = false;
  ($("btnSpringDrink").disabled ? $("btnSpringSkip") : $("btnSpringDrink")).focus();
}
function resolveSpring(drink){
  const th = pendingRoom; pendingRoom = null;
  $("veilSpring").hidden = true;
  G.paused = false;
  if(drink && th){
    const s = stats(), r = healUp(springHeal(s), s);       // 泉涌：喝不下的那部分变护盾
    const got = r.hp;
    if(got) floatNum("me", "+" + got, "heal");
    say("你掬起一捧泉水 —— 回复了 <b>" + got + "</b> 点生命（" + P.hp + " / " + s.maxHp + "）" +
        (r.sh ? "，溢出的化成 <b>" + r.sh + "</b> 点护盾" : "") + "。", "good");
    removeThing(th);
  } else {
    say("泉水留在原地，还冒着气泡。", "sys");
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
  if(th.forge == null) th.forge = Math.random() < ALTAR_FORGE_RATE;
  if(th.forge && P.relics && P.relics.length){ openForge(th); return; }
  G.paused = true;
  pendingRoom = th;
  const s = stats();
  const cost = altarCost(), enough = P.hp > cost;
  $("altarCost").innerHTML =
    li("代价", cost + " 点生命（你现在 " + P.hp + " / " + s.maxHp + "）") +
    li("回报", "一件遗物");
  $("btnAltarPay").disabled = !enough;
  $("btnAltarPay").textContent = enough ? "割一刀" : "血不够";
  hideAll();
  $("veilAltar").hidden = false;
}
function resolveAltar(pay){
  const th = pendingRoom; pendingRoom = null;
  $("veilAltar").hidden = true;
  G.paused = false;
  const cost = altarCost();
  if(pay && P.hp > cost){
    P.hp -= cost;
    floatNum("me", "-" + cost, "ouch");
    removeThing(th);
    say("你把手按在浅槽上。石台吸干了那一点血。", "hurt");
    grantRelic(rollRelic(), "石台吐出了");
    lockInput(200);
    renderHud(); render();
    return;
  }
  say("你收回手，绕开了石台。", "sys");
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
                  "<span class=\"rl\">点它 → 扔进炉子</span>";
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
    if(hit.length) got = pick(hit);
  });
  clearNewRelic(id);
  if(!got){
    const g = sellPrice(old);
    withMaxHp(function(){ P.relics.splice(P.relics.indexOf(id), 1); });
    P.gold += g;
    say("炉火吞了 " + rc(old) + "，什么也没吐出来 —— 只剩 <b>" + g + "</b> 金币。", "sys");
  } else {
    withMaxHp(function(){
      P.relics.splice(P.relics.indexOf(id), 1);
      P.relics.push(got.id);
    });
    noteRelicFound(got, "炉子吐出了");
    const up = (got.r || 0) - (old.r || 0);
    say("你把 " + rc(old) + " 扔进炉子 —— " +
        (up > 0 ? "火苗窜起来，它<b>升了一档</b>" : up < 0 ? "火舌卷下去，它<b>降了一档</b>" : "形状变了，还是同一档") +
        "：" + rc(got) + " —— " + got.pw + "。", up < 0 ? "hurt" : "crit");
  }
  lockInput(200);
  renderHud(); render();
}
function closeForge(){
  const th = pendingRoom; pendingRoom = null;
  $("veilForge").hidden = true;
  G.paused = false;
  say("炉膛里的火还亮着。你什么也没扔进去。", "sys");
  lockInput(200);
  renderHud(); render();
}

/* ---- 上锁宝箱：拼对开箱，拼错锁死 ---- */
function openChest(th){
  G.paused = true;
  pendingRoom = th;
  const word = pickQuizWord("all");
  chestQ = {word:word, spell:"", done:false};
  $("chestTitle").textContent = "锁上刻着一个词";
  $("chestHint").textContent = "拼出「" + word.cn + "」";
  $("chestClue").textContent = word.cn;
  $("chestVerdict").innerHTML = "";
  $("btnChestDone").hidden = true;
  $("btnChestLeave").hidden = false;
  drawChestSpell();
  buildChestLetters(word);
  hideAll();
  $("veilChest").hidden = false;
}
function drawChestSpell(){
  const row = $("chestRow"), en = chestQ.word.en;
  row.innerHTML = "";
  for(let i=0;i<en.length;i++){
    const d = document.createElement("div");
    d.className = "sbox";
    d.textContent = chestQ.spell[i] || "";
    row.appendChild(d);
  }
}
function buildChestLetters(word){
  const box = $("chestLetters");
  box.innerHTML = "";
  const pool = word.en.split("");
  const extra = "abcdefghijklmnopqrstuvwxyz".split("");
  while(pool.length < Math.min(12, word.en.length + 4)) {
    const c = pick(extra);
    if(pool.indexOf(c) < 0 || Math.random() < .3) pool.push(c);
  }
  pool.sort(function(){ return Math.random() - .5; });
  pool.forEach(function(ch){
    const b = document.createElement("button");
    b.type = "button"; b.className = "lbtn"; b.textContent = ch;
    b.addEventListener("click", function(){
      if(!chestQ || chestQ.done || chestQ.spell.length >= word.en.length) return;
      chestQ.spell += ch; b.disabled = true;
      drawChestSpell();
      if(chestQ.spell.length === word.en.length){
        setTimeout(function(){ judgeChest(); }, 180);
      }
    });
    box.appendChild(b);
  });
  const back = document.createElement("button");
  back.type = "button"; back.className = "lbtn back"; back.textContent = "←";
  back.addEventListener("click", function(){
    if(!chestQ || chestQ.done || !chestQ.spell.length) return;
    const ch = chestQ.spell.slice(-1);
    chestQ.spell = chestQ.spell.slice(0,-1);
    const b = Array.prototype.filter.call(box.children, function(x){
      return x.disabled && x.textContent === ch;
    })[0];
    if(b) b.disabled = false;
    drawChestSpell();
  });
  box.appendChild(back);
}
function judgeChest(){
  const w = chestQ.word, ok = chestQ.spell === w.en;
  // 钥匙：拼错也照样开箱。⚠️ 熟练度和心魔照常按「拼错」记 —— 撬开的是锁，不是这个词
  const opened = ok || hasRelic("key");
  chestQ.done = true;
  const rec = LEX[w.en] || {str:0, seen:0, wrong:0};
  rec.seen++;
  if(ok){ rec.str = Math.min(5, (rec.str||0) + 1); rec.wrong = 0; }
  else { rec.str = Math.max(0, (rec.str||0) - 1); rec.wrong = (rec.wrong||0) + 1; addHaunt(w.en); }
  LEX[w.en] = rec;             // 同上，等存档点
  $("chestVerdict").innerHTML = (ok
      ? "<span class=\"big ok\">咔哒 —— 开了</span>"
      : opened
        ? "<span class=\"big ok\">拼错了 —— 钥匙替你撬开了</span>"
        : "<span class=\"big no\">锁咬死了</span>") +
    "<span class=\"mean\"><b>" + w.en + "</b>　" + w.cn + "</span>";
  $("btnChestLeave").hidden = true;
  $("btnChestDone").hidden = false;
  $("btnChestDone").textContent = opened ? "拿走" : "认了";
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
    say("木箱开了，里面有 <b>" + g + "</b> 金币。", "good");
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
          {via:"grant", how:"箱底压着", eyebrow:"钥匙 · 箱底有两件", title:"挑一件带走"});
        renderHud(); render();
        return;
      }
      grantRelic(picks[0] || null, "箱底压着");
      lockInput(200);
      renderHud(); render();
      return;
    }
    grantRelic(rollRelic(), "箱底压着");
    lockInput(200);
    renderHud(); render();
    return;
  }
  say("锁彻底咬死了。这箱子谁也打不开了。", "hurt");
  lockInput(200);
  renderHud(); render();
}

/* ---- 游商：局内金币现在有地方花了 ---- */
function openShop(th){
  G.paused = true;
  pendingRoom = th;
  if(!th.stock){
    // 进店那一刻定下货，存在物件上 —— 再进来不会重 roll
    th.stock = [];
    for(let i=0;i<5;i++){          // 货架 5 件（用户 2026-09 从 3 件加到 5 件）
      let r = null;
      for(let g=0; g<30 && !r; g++){
        const c = rollRelic();
        if(c && !th.stock.some(function(x){ return x.relic === c; })) r = c;
      }
      if(!r) break;
      // 标价 = 这件的分解价 × SHOP_MARKUP（1.3）—— 买进来再拆掉永远是亏的，
      // 别改回那套 (10 + 品质×12 + 层数) × 5 的老公式：低品质在浅层比分解价还便宜。
      th.stock.push({relic:r, price: Math.ceil(sellPrice(r) * SHOP_MARKUP), sold:false});
    }
  }
  renderShop();
  hideAll();
  $("veilShop").hidden = false;
}
/* 游商的实际标价：货是进店那一刻定下的（存在 th.stock 上），
   「熟客」的折扣**不写进货架**，每次现算 —— 这样进店之后才拿到熟客也能立刻便宜。*/
function shopPrice(row){
  return Math.max(1, Math.round(row.price * (hasRelic("regular") ? 0.85 : 1)));
}
function renderShop(){
  const th = pendingRoom;
  if(!th) return;
  $("shopGold").innerHTML = "你身上有 <b style=\"color:var(--torch)\">" + P.gold + "</b> 金币。";
  const box = $("shopList");
  box.innerHTML = "";
  if(!th.stock.length){
    box.innerHTML = "<div class=\"bagempty\">他的布上空空如也 —— 你已经什么都有了。</div>";
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
      "<span class=\"rt q" + q + "\">" + RAR_CN[q] + " · 遗物</span>" +
      "<span class=\"rn q" + q + "\">" + r.n + "</span>" +
      "<span class=\"rp\">" + r.pw + "</span>" +
      "<span class=\"rl\">" + r.lore + "</span>" +
      "<button type=\"button\" class=\"buy\" data-i=\"" + i + "\"" +
        (row.sold || P.gold < price ? " disabled" : "") + ">" +
        (row.sold ? "已售" : price + " 金") + "</button>";
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
  row.sold = true;
  say("你付了 <b>" + price + "</b> 金币。", "sys");
  grantRelic(row.relic, "游商递给你");
  pendingRoom = th;             // 货架还开着，接着选
  renderShop();
  renderHud();
}
function closeShop(){
  pendingRoom = null;
  $("veilShop").hidden = true;
  G.paused = false;
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
function relicCap(){ return RELIC_MAX + (hasRelic("pack") ? 3 : 0); }
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
    say("生命上限 <b>+" + up + "</b> —— 当前生命跟着补上了（" + P.hp + " / " + after + "）。", "good");
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
  return rarWt(7, 9, 3, 1, 0);                    // 50 层也只有 5% 传奇，神圣不掉
}
/* 按当前层数抽一件还没拿过的遗物；那个品质抽干了就逐级往下找 */
function rollRelic(floor){
  const want = pick(rarityWeights(floor == null ? (G ? G.floor : 1) : floor));
  const pool = relicPool();
  if(!pool.length) return null;
  for(let d = 0; d < 5; d++){
    for(const r of [want - d, want + d]){
      if(r < 0 || r > 4) continue;
      const hit = pool.filter(function(x){ return (x.r || 0) === r; });
      if(hit.length) return pick(hit);
    }
  }
  return pick(pool);
}

/* ---- 分解：拆掉一件换金币，腾出格子 ---- */
/* 一件遗物值多少金 —— 分解、遗物页上的标价、带满了折算，全走这一个口 */
function sellPrice(r){
  return (RAR_SELL[(r && r.r) || 0] || RAR_SELL[0]) + Math.floor((G ? G.floor : 1) / 5);
}
function sellRelic(id){
  const i = P.relics.indexOf(id);
  if(i < 0) return;
  const r = relicById(id);
  const g = sellPrice(r);
  clearNewRelic(id);
  withMaxHp(function(){ P.relics.splice(i, 1); });
  P.gold += g;
  say("你拆了 " + rc(r) + "，换成 <b>" + g + "</b> 金币。", "sys");
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
  if(q >= 4){ say("神圣已经是顶了，它没法当材料。", "sys"); return; }
  if(fuseSel.length && q !== fuseRar()){
    say("得是<b>同一个品质</b>的三件 —— 现在挑的是" + RAR_CN[fuseRar()] + "。", "sys");
    return;
  }
  if(fuseSel.length >= fuseN()){ say("已经挑满 " + fuseN() + " 件了。", "sys"); return; }
  fuseSel.push(id);
  renderRelics();
}
/* 点「合成」先弹一个二选一的确认窗 —— 合成要花钱，砸下去不可撤销 */
function askFuse(){
  if(fuseSel.length !== fuseN()) return;
  const rar = fuseRar();
  if(rar < 0 || rar >= 4) return;
  const gold = (P && P.gold) || 0;
  const names = fuseSel.map(function(id){ const r = relicById(id); return r ? r.n : "?"; }).join("、");
  $("fuseTitle").textContent = fuseN() + " 件" + RAR_CN[rar] + " → 1 件" + RAR_CN[rar + 1];
  $("fuseLedger").innerHTML =
    li("砸掉", names) +
    li("花费", fuseCost() + " 金（你有 " + gold + "）") +
    li("换回", RAR_CN[rar + 1] + " · 两件里挑一件");
  const yes = $("btnFuseYes");
  yes.disabled = gold < fuseCost();
  yes.textContent = yes.disabled ? "金币不够" : "花 " + fuseCost() + " 金合成";
  $("veilFuse").hidden = false;
  (yes.disabled ? $("btnFuseNo") : yes).focus();
}
function closeFuseAsk(){ $("veilFuse").hidden = true; }
/* 砸下去之后**在两件里挑一件**（用户 2026-09，以前是随机塞一件）：
   材料和金币先结清，再弹 veilFuseGot 让玩家挑。
   更高一档只剩一件没拿过时就直接给，不弹那个窗。*/
let fusePicks = [], fuseVia = null, fuseHow = "合成出";
function fuseGo(){
  closeFuseAsk();
  if(fuseSel.length !== fuseN()) return;
  const rar = fuseRar();
  if(rar < 0 || rar >= 4) return;
  if(!P || P.gold < fuseCost()){ say("合成要 <b>" + fuseCost() + "</b> 金，你还不够。", "sys"); return; }
  // 挑的这几件必须都还在手上（分解过就作废）
  const eat = fuseSel.filter(function(id){ return P.relics.indexOf(id) >= 0; });
  if(eat.length !== fuseN()){ fuseSel = []; renderRelics(); return; }
  const up = relicPool().filter(function(x){ return (x.r || 0) === rar + 1; });
  if(!up.length){ say("更高一档的遗物你已经拿齐了。", "sys"); return; }
  const cost = fuseCost();
  P.gold -= cost;
  P.spent = (P.spent || 0) + cost;        // 散财：合成的钱也算花出去了
  withMaxHp(function(){
    eat.forEach(function(id){ P.relics.splice(P.relics.indexOf(id), 1); });
  });
  fuseOn = false; fuseSel = [];
  say("你付了 <b>" + cost + "</b> 金，把 " + fuseN() + " 件" + RAR_CN[rar] + "遗物砸在一起。", "sys");
  const bag = up.slice(), picks = [];
  for(let i = 0; i < FUSE_PICK && bag.length; i++){
    picks.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0]);
  }
  renderHud();
  if(picks.length <= 1){ fuseTake(picks[0] ? picks[0].id : null); return; }
  openFusePick(picks, rar + 1);
}
/* 两件挑一件的窗子。合成走的是老路（fuseVia 空 = 材料已经砸了，格子一定够，直接塞进背包）；
   宝箱的「钥匙」二选一走 fuseVia="grant" —— 要过 grantRelic，带满了才会弹取舍窗。*/
function openFusePick(picks, rar, opt){
  const o = opt || {};
  fuseVia = o.via || null;
  fuseHow = o.how || "合成出";
  fusePicks = picks.map(function(r){ return r.id; });
  $("fuseGotEyebrow").textContent = o.eyebrow || "合成";
  $("fuseGotTitle").textContent = o.title || ("两件" + RAR_CN[rar] + "，挑一件");
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
  fuseVia = null; fuseHow = "合成出";
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
  say("—— " + rc(got) + " 成了：" + got.pw + "。", "crit");
  renderHud();
}
/* 遗物名字上色 */
function rc(r){ return "<span style=\"color:var(--q" + (r.r || 0) + ")\">" + r.n + "</span>"; }
/* 还没拿过的遗物；全拿全了就返回空数组 */
function relicPool(){
  const own = (P && P.relics) || [];
  return RELICS.filter(function(r){ return own.indexOf(r.id) < 0; });
}
/* 直接给一件（祭坛/宝箱/游商走这里），没得给就折成金币 */
function grantRelic(r, how){
  // 带满了：弹窗让玩家选换掉哪一件，或者放弃
  if(r && P.relics.length >= relicCap()){ offerSwap(r, how); return; }
  if(!r){
    const g = 8 + G.floor * 2;
    P.gold += g;
    say("遗物已经被你撑满了，折成 <b>" + g + "</b> 金币。", "sys");
    return;
  }

  withMaxHp(function(){ P.relics.push(r.id); });
  noteRelicFound(r, how);
  say((how || "你得到了") + " " + rc(r) + " —— " + r.pw + "。", "crit");
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
    "<span class=\"rl\">点它 → 直接卖掉，换 " + sellPrice(r) + " 金</span>";
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
                  "<span class=\"rl\">点它 → 换成「" + r.n + "」</span>";
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
    const back = old ? sellPrice(old) : 0;
    withMaxHp(function(){
      if(i >= 0) P.relics.splice(i, 1);
      P.relics.push(ps.relic.id);
    });
    if(back) P.gold += back;
    noteRelicFound(ps.relic, ps.how);
    say("你放下 " + (old ? old.n : "旧遗物") +
        "，换上了 " + rc(ps.relic) + "。" +
        (back ? " 旧的那件碎成了 <b>" + back + "</b> 金币。" : ""), "crit");
  } else {
    const g = sellPrice(ps.relic);          // 不换就当场分解，跟分解价一样
    P.gold += g;
    say("你没动手上的东西，" + ps.relic.n + " 折成了 <b>" + g + "</b> 金币。", "sys");
  }
  renderHud(); render();
  maybeRelic();
}

/* 跨局图鉴：记首次在第几层拿到、总共拿过几次 */
function noteRelicFound(r, how){
  markNewRelic(r.id);                // 遗物页上挂个「new」，点一下那张卡就没了
  const first = !CODEX[r.id];
  CODEX[r.id] = {depth: first ? G.floor : CODEX[r.id].depth, times: (first ? 0 : CODEX[r.id].times) + 1};
  fxRelic(r);                        // 碎屑飞向底部的「遗物」标签
  if(first) say("—— 初次发现：" + r.n + " ——", "crit");
}

function offerRelics(){
  const owned = P.relics || [];
  const pool = RELICS.filter(function(r){ return owned.indexOf(r.id) < 0; });
  if(!pool.length){ G.relicDone = true; return false; }
  // 每一件都按层数权重单抽，互不重复
  const picks = [];
  for(let i = 0; i < 3; i++){
    let r = null;
    for(let g = 0; g < 30 && !r; g++){
      const c = rollRelic();
      if(c && picks.indexOf(c) < 0) r = c;
    }
    if(r) picks.push(r);
  }

  G.paused = true;
  $("relicEyebrow").textContent = CH.name + " 第 " + G.floor + " 层 · 清干净了";
  $("relicTitle").textContent = CH.name + "给了你一样东西";   // 四章各叫各的名字
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
  /* 「重掷」：每层一次，换一批三选一（G.rerollUsed 在 nextFloor 里清） */
  const rb = $("btnRelicRedraw");
  if(rb) rb.hidden = !(hasRelic("redraw") && !G.rerollUsed);
  hideAll();
  $("veilRelic").hidden = false;
  return true;
}
function takeRelic(id){
  const r = relicById(id);
  if(!r) return;
  G.relicDone = true;
  $("veilRelic").hidden = true;
  if(P.relics.length >= relicCap()){ offerSwap(r, "你拿起了"); return; }
  G.paused = false;
  withMaxHp(function(){ P.relics.push(id); });
  noteRelicFound(r, "你拿起了");
  say("你拿起了 " + rc(r) + " —— " + r.pw + "。", "crit");
  renderHud(); render();
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
  $("relicHead").textContent = "遗物 " + own.length + " / " + relicCap();
  const dot = $("bagDot");
  dot.textContent = own.length;
  dot.hidden = own.length === 0;
  const box = $("relicOwned");
  box.innerHTML = "";
  // 选中的东西可能已经不在手上了（被换掉、被分解），先对一遍
  fuseSel = fuseSel.filter(function(id){ return own.indexOf(id) >= 0; });
  newRelics = newRelics.filter(function(id){ return own.indexOf(id) >= 0; });
  if(!own.length){
    box.innerHTML = "<div class=\"bagempty\">还没有。每清完一层会让你三选一。</div>";
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
        "<span class=\"rt q" + q + "\">" + RAR_CN[q] + (picked ? " · 已选" : "") + "</span>" +
        "<span class=\"rn q" + q + "\">" + r.n + "</span>" +
        "<span class=\"rp\">" + r.pw + "</span>" +
      "</div>" +
      (fuseOn
        ? "<span class=\"tick\">" + (picked ? "✓" : "") + "</span>"
        : "<button type=\"button\" class=\"melt\" data-sell=\"" + id + "\">分解<em>" +
          sellPrice(r) + " 金</em></button>");
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
  if(fh) fh.textContent = "合成 · " + fuseN() + " 件同品质 + " + fuseCost() + " 金 → " + FUSE_PICK + " 选 1";
  pickBtn.textContent = fuseOn ? "取消选择" : "选择";
  pickBtn.disabled = !fuseOn && ready < 0;
  goBtn.disabled = fuseSel.length !== fuseN();
  goBtn.textContent = fuseOn && fuseSel.length ? ("合成（" + fuseSel.length + "/" + fuseN() + "）") : "合成";
  if(!note) return;
  if(fuseOn){
    note.innerHTML = fuseSel.length
      ? ("已挑 <b>" + fuseSel.length + " / " + fuseN() + "</b> 件" + RAR_CN[fuseRar()] +
         "，合成后在两件<b>" + RAR_CN[fuseRar() + 1] + "</b>里挑一件，另付 <b>" + fuseCost() + "</b> 金。")
      : "在上面点 <b>" + fuseN() + " 件同品质</b>的遗物。神圣已经是顶了，不能当材料。";
  } else {
    note.innerHTML = ready >= 0
      ? ("点「选择」，挑 " + fuseN() + " 件同品质的砸成一件更高的（另付 <b>" + fuseCost() + "</b> 金）。你的<b>" + RAR_CN[ready] + "</b>已经够了。")
      : "同一个品质攒够 " + fuseN() + " 件，再加 <b>" + fuseCost() + "</b> 金才能合成。";
  }
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
  return {gem: typeof t.gem === "number" ? t.gem : (t.gold || 0)};
})();
/* 宝石一变就落盘（用户要求）——**别绕过这个函数直接改 TOWN.gem** */
function addGems(n){
  TOWN.gem = Math.max(0, (TOWN.gem || 0) + n);
  commitPerm();
  if(SCENE === "town") renderTown();
}
let SCENE = "town";

/* 地牢那几块和主城面板互斥显示 */
function showScene(){
  const inRun = SCENE === "run";
  /* hudRow / barsRow 现在住在 stageBox 里面（.mapui 浮层），跟着 stage 一起显隐，不用单独管 */
  ["stageBox","mapTools","log"].forEach(function(id){ $(id).hidden = !inRun; });
  $("townPanel").hidden = inRun;
  /* 探索时顶栏整块收起 —— 章节名挪进了地图浮层的「层」那一格，省下的高度全给地图 */
  $("topBar").hidden = inRun;
  $("hChap").textContent = CH.name;
  $("chapterTag").textContent = "主城 · 灰岩镇";
  if(inRun) sizeMap();
}
function renderTown(){
  const M = meta();
  $("tGold").textContent = TOWN.gem;
  $("tBest").textContent = M.best ? ("第 " + M.best + " 层") : "—";
  $("tClears").textContent = M.clears || 0;
  $("tDeaths").textContent = M.deaths || 0;
  $("townFlavor").textContent = M.runs === 0
    ? "\u4f60\u7b2c\u4e00\u6b21\u7ad9\u5728\u8fd9\u513f\u3002\u6d1e\u53e3\u5728\u9547\u5b50\u5317\u8fb9\uff0c\u98ce\u4ece\u91cc\u9762\u5f80\u4e0a\u5439\u3002"
    : (M.deaths ? "\u4f60\u53c8\u56de\u6765\u4e86\u3002\u8eab\u4e0a\u7a7a\u4e86\uff0c\u53e3\u888b\u8fd8\u6709\u70b9\u91cd\u91cf\u3002"
                : "\u77f3\u5eca\u7684\u98ce\u4ece\u6d1e\u53e3\u5439\u4e0a\u6765\uff0c\u5e26\u7740\u94c1\u9508\u5473\u3002");
}
/* 回主城：身上的一切清空，重建一个空角色 */
function goTown(){
  SCENE = "town";
  cancelWalk();
  autoOff();
  B = null; pendingLoot = null; pendingRoom = null; chestQ = null; reopenShop = null; pendingSwap = null;
  P = { x:0, y:0, lvl:1, xp:0, hp:CHAPTER.playerBase.hp, gold:0, kills:0,
        right:0, wrong:0, seenWords:[], used:{}, combo:0, maxCombo:0,
        relics:[], haunt:[], hauntAt:{}, undying:false };
  G = { floor:0, paused:true, over:true };
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
function openCave(){
  const box = $("routeList");
  box.innerHTML = "";
  ROUTES.forEach(function(r){
    const d = document.createElement("button");
    d.type = "button";
    d.className = "route" + (r.open ? "" : " off");
    d.disabled = !r.open;
    d.dataset.id = r.id;
    d.innerHTML = "<span class=\"rt\">" + r.tag + "</span>" +
      "<span class=\"rn\">" + r.name + "</span>" +
      "<span class=\"rd\">" + r.desc + "</span>" +
      (r.open ? "<span class=\"rgo\">进入 ▸</span>" : "<span class=\"rgo\">还没挖通</span>");
    box.appendChild(d);
  });
  $("veilCave").hidden = false;
}
function enterRoute(id){
  const r = ROUTES.filter(function(x){ return x.id === id; })[0];
  if(!r || !r.open) return;
  setChapter(r.ch || 1);          // 路线决定这一趟是哪一章（词难度、怪、宝石倍率）
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
                dmg:m.dmg, armor:m.armor, xp:m.xp, lt:m.loot || 0, s:m.seen};
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
  if(!s.floor || s.floor < 1 || s.floor > FLOORS) return null;
  return s;
}
function dropRun(){ try{ localStorage.removeItem(RUN_KEY); }catch(e){} }
function foeDef(id){
  // 各章的 Boss 和守层者也得能找回来，不然续玩档一读，它们就凭空消失了
  for(let i=0;i<CHAPTERS.length;i++) if(CHAPTERS[i].boss.id === id) return CHAPTERS[i].boss;
  if(id === GATEKEEPER.id) return GATEKEEPER;
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
  if(typeof P.combo !== "number") P.combo = 0;   // 连击现在存在 P 上，老档没有这个字段
  if(typeof P.shield !== "number") P.shield = 0; // 护盾（第四批），老档没有
  if(typeof P.aegisN !== "number") P.aegisN = 0;
  if(typeof P.recoil !== "number") P.recoil = 0;  // 反震攒了几层
  if(typeof P.maxCombo !== "number") P.maxCombo = P.combo;   // 老档没有最大连击
  if(!P.used) P.used = {};                                   // 老档没有「这趟出过的词」
  G = { floor: s.floor, paused:false, over:false,
        map:  unpackGrid(s.map,  function(c){ return c === "1" ? 1 : 0; }),
        seen: unpackGrid(s.seen, function(c){ return c === "1"; }),
        vis: [], things: s.things || [], stair: s.stair, rooms: s.rooms || null, mobs: [] };
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
                 hp:m.hp, max:m.max,
                 dmg:m.dmg, armor:m.armor, xp:m.xp, loot:m.lt || 0, seen:!!m.s});
  });
  $("log").innerHTML = "";
  hideAll();
  fov(); buildGrid(); render(); renderHud();
  say("—— " + CH.name + " 第 " + G.floor + " 层 ——", "crit");
  say("你回到了踏进这一层时的样子 —— 存档存在每层的入口。", "sys");
  lockInput(320);
}
/* ================= 结算 ================= */
/* 返回的就是内存里那一份，改完等 commit() 落盘，别单独写 localStorage */
function meta(){ return MET; }
function gameOver(){ endRun(false); }
/* 主动放弃：跟倒下一样走结算（用户 2026-09 改的，以前是一颗宝石都不给），
   但不算一次死亡 —— 统计里只加一次探索。 */
function giveUpRun(){ if(SCENE === "run" && G && !G.over) endRun(false, true); }
function chapterClear(){ endRun(true); }
/* 一趟的结算：局内表现算成分，再乘这一章的难度倍率 = 带回镇上的宝石。
   每一条都摆在结算界面上，玩家能自己把这笔账对一遍。数值在 content.js 的 SCORE 里。 */
function runScore(win){
  const total = P.right + P.wrong;
  const acc = total ? Math.round(P.right / total * 100) : 0;
  const floor = Math.min(G.floor, FLOORS);
  /* 到达的层数**不再是一项加分，它是主倍率**（用户 2026-09）：
     宝石 =（下面这几项相加）× 层数倍率 × 这一章的难度系数。两个乘区，没有第三个。*/
  const rows = [
    {k:"最大连击 " + (P.maxCombo || 0),  v: (P.maxCombo || 0) * SCORE.perCombo},
    {k:"击败 " + P.kills + " 只",        v: P.kills * SCORE.perKill},
    {k:"正确率 " + acc + "%",            v: Math.floor(acc / SCORE.accDiv)},
    {k:"没花完的 " + P.gold + " 金币",   v: Math.floor((P.gold || 0) / SCORE.goldDiv)}
  ];
  if(win) rows.push({k:"通关", v: SCORE.clear});
  const sum = rows.reduce(function(a, r){ return a + r.v; }, 0);
  const fmul = Math.max(SCORE.floorMin, floor / SCORE.floorDiv);
  return {rows:rows, sum:sum, acc:acc, floor:floor, fmul:fmul,
          gems: Math.floor(sum * fmul * CH.gemMult)};
}
function endRun(win, gaveUp){
  G.over = true;
  const M = meta();
  M.runs++;
  if(G.floor > M.best) M.best = Math.min(G.floor, FLOORS);
  if(win) M.clears++; else if(!gaveUp) M.deaths = (M.deaths || 0) + 1;
  // 遗物和金币都留在洞里 —— 带回镇上的是结算换来的**宝石**
  const sc = runScore(win);
  addGems(sc.gems);    // 宝石一变就落盘
  commit(false);       // 存档点之三（上半截）：这一趟结束，人被抬回镇上，续玩档作废
  $("endTitle").textContent = win ? (CH.boss.name + "倒下了")
                                  : gaveUp ? ("你从第 " + G.floor + " 层退了出来")
                                           : ("你倒在第 " + G.floor + " 层");
  $("endEyebrow").textContent = win ? ("第" + CH.id + "章 · 通关")
                                    : gaveUp ? "主动撤离" : "你被抬回了镇上";
  $("endStats").innerHTML =
    sc.rows.map(function(r){ return li(r.k, "+" + r.v); }).join("") +
    li("<b>小计</b>", "<b>" + sc.sum + "</b>") +
    li("到达第 " + sc.floor + " 层", "×" + sc.fmul.toFixed(1)) +
    li("难度 · 第" + CH.id + "章 " + CH.level, "×" + Math.round(CH.gemMult * 100) + "%") +
    li("<b>获得宝石</b>", "<b style=\"color:var(--q3)\">+" + sc.gems + "</b>") +
    li("宝石合计", TOWN.gem) +
    li("丢在洞里", (P.relics.length || 0) + " 件遗物 · " + P.gold + " 金币") +
    li("这趟遇到的词", P.seenWords.length + " 个") +
    li("累计掌握", Object.keys(LEX).filter(function(k){ return (LEX[k].str||0) >= 3; }).length + " / " + WORDS.length);
  const box = $("endWords");
  box.innerHTML = "";
  if(!P.seenWords.length){
    box.innerHTML = "<div class=\"cx lost\"><div class=\"cn\">还没遇到任何词</div></div>";
  } else {
    P.seenWords.forEach(function(en){
      const w = WMAP[en], r = LEX[en] || {str:0};
      const s = r.str || 0;
      const d = document.createElement("div");
      d.className = "cx " + (s >= 3 ? "w-ok" : r.wrong ? "w-bad" : "");
      d.innerHTML = "<div class=\"cn\">" + w.en +
        "<span class=\"meta stars\">" + "★".repeat(s) + "☆".repeat(5-s) + "</span></div>" +
        "<div class=\"cd\">" + w.cn + "　<span style=\"color:var(--faint)\">" + CAT_CN[w.cat] + "</span></div>";
      box.appendChild(d);
    });
  }
  $("btnAgain").textContent = "回到镇上";
  hideAll();
  $("veilEnd").hidden = false;
  $("btnAgain").focus();
  if(win) say(CH.boss.name + "碎成了石块。第" + CH.id + "章结束。", "crit");
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
  $("codexTally").innerHTML = "最深 <b>第 " + M.best + " 层</b>　通关 <b>" + M.clears + "</b> 次　探索 <b>" + M.runs + "</b> 次";
  const box = $("codexList");
  box.innerHTML = "";
  if(cTab === "leg"){
    const book = CODEX;
    $("codexTitle").textContent = "遗物 " + Object.keys(book).length + " / " + RELICS.length;
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
          (rec ? ("初见第 " + rec.depth + " 层 · 拿过 " + rec.times + " 次") : "还没拿到过") +
        "</span></div>" +
        "<div class=\"cd\" style=\"color:var(--q" + (R.r||0) + ")\">" + RAR_CN[R.r||0] + " · " + R.pw + "</div>" +
        "<div class=\"cd\" style=\"font-family:var(--flavor);font-style:italic\">" + R.lore + "</div>";
      box.appendChild(d);
    });
  } else {
    /* 标题只剩「词库」两个字（用户 2026-09）——
       掌握 / 遇见 / 总数三个数搬到了信息页那块「本章词汇」上，别在这儿再摆一遍。*/
    $("codexTitle").textContent = "词库";
    const q = codexFind();
    Object.keys(BYCAT).forEach(function(cat){
      const hit = q ? BYCAT[cat].filter(function(w){
        return w.en.toLowerCase().indexOf(q) >= 0 || w.cn.indexOf(q) >= 0 ||
               (CAT_CN[cat] || "").indexOf(q) >= 0;
      }) : BYCAT[cat];
      if(!hit.length) return;               // 这一类一个都没命中，连类名都别画
      const h = document.createElement("div");
      h.className = "eyebrow"; h.style.marginTop = "4px";
      h.textContent = CAT_CN[cat];
      box.appendChild(h);
      hit.forEach(function(w){
        const r = LEX[w.en];
        const s = r ? (r.str||0) : 0;
        const d = document.createElement("div");
        d.className = "cx " + (!r ? "lost" : s >= 3 ? "w-ok" : r.wrong ? "w-bad" : "");
        d.innerHTML =
          "<div class=\"cn\">" + w.en + "<span class=\"meta " + (r ? "stars" : "") + "\">" +
            (r ? ("★".repeat(s) + "☆".repeat(5-s)) : "还没遇到") + "</span></div>" +
          "<div class=\"cd\">" + w.cn +
            (r && r.wrong ? "　<span style=\"color:var(--blood)\">上次答错</span>" : "") + "</div>";
        box.appendChild(d);
      });
    });
  }
  if(!box.children.length){
    box.innerHTML = "<div class=\"cx lost\"><div class=\"cn\">没找到「" +
      ($("codexFind") ? $("codexFind").value.trim() : "") + "」</div></div>";
  }
  $("veilCodex").hidden = false;
}
function hideAll(){
  clearQTimer();          // 战斗窗要是被顺手藏掉了，读条别还在后台走
  ["veilBattle","veilEnd","veilCodex","veilHelp","veilRelic","veilSwap","veilAltar","veilForge","veilChest","veilShop","veilStair","veilSpring","veilFuse"].forEach(function(id){ $(id).hidden = true; });
}
/* ⚠️ veilFuseGot **故意不进 hideAll**：材料已经砸掉了，窗一被顺手藏掉那一件就没了。
   它只进 anyVeil（挡住键盘走路），玩家必须挑一件才关得掉。*/
function anyVeil(){
  const ids = ["veilBattle","veilEnd","veilCodex","veilHelp","veilRelic","veilSwap","veilAltar","veilForge","veilChest","veilShop","veilStair","veilSpring","veilFuse","veilFuseGot"];
  for(let i=0;i<ids.length;i++) if(!$(ids[i]).hidden) return $(ids[i]);
  return null;
}

/* ================= 跨设备导出码 =================
   只带永久数据：词汇熟练度 / 图鉴 / 探索记录。本局进度不在里面。
   导入是**合并取优**，不是覆盖 —— 免得从旧设备导一次就把新进度抹了。 */
var CODE_TAG = "YX1.";
function b64enc(str){
  const b = new TextEncoder().encode(str);
  let bin = "";
  for(let i=0;i<b.length;i++) bin += String.fromCharCode(b[i]);
  return btoa(bin);
}
function b64dec(s){
  const bin = atob(s), b = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) b[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(b);
}
function makeCode(){
  return CODE_TAG + b64enc(JSON.stringify({
    lex: LEX, codex: CODEX, meta: meta()
  }));
}
function applyCode(txt){
  txt = (txt || "").trim();
  if(!txt) return "先把码粘进来。";
  let o;
  if(txt.charAt(0) === "{"){                       // 存档文件的内容被直接粘进来了，也认
    try{ o = JSON.parse(txt); }
    catch(e){ return "这段文本读不出来 —— 像是存档文件但缺了一截。"; }
  } else {
    txt = txt.replace(/\s+/g, "");                 // 粘贴常带换行，先洗掉
    if(txt.indexOf(CODE_TAG) !== 0) return "这串码不对 —— 应该以 " + CODE_TAG + " 开头。";
    try{ o = JSON.parse(b64dec(txt.slice(CODE_TAG.length))); }
    catch(e){ return "这串码读不出来，多半是复制时漏了一截。"; }
  }
  if(!o || typeof o !== "object" || !o.lex) return "这串码里没有词汇数据。";
  const r = mergeData(o);
  return "导入成功：更新了 " + r.words + " 个词，补上 " + r.legs + " 件传说。";
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

  // 镇上存款取多的那边，**不相加** —— 免得来回导两次就凭空富了
  const before = TOWN.gem || 0;
  const inGem = (o.town && (typeof o.town.gem === "number" ? o.town.gem : o.town.gold)) || 0;
  TOWN.gem = Math.max(before, inGem);

  /* 导入是玩家自己点的，就地写一次盘 —— 它不是游戏里的那三个存档点，而是存档管理本身；
     不马上写的话玩家关掉页面会以为导入没生效。只写永久数据，
     磁盘上那份层存档一个字节都不动（下面单独判断要不要接管）。 */
  commitPerm();

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
    town: TOWN, opt: OPT, run: load(RUN_KEY, null)
  };
}
function pad2(n){ return (n < 10 ? "0" : "") + n; }
function fmtTime(t){
  if(!t) return "不详";
  const d = new Date(t);
  return d.getFullYear() + "-" + pad2(d.getMonth()+1) + "-" + pad2(d.getDate()) +
         " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}
function agoText(t){
  if(!t) return "不详";
  const mins = Math.max(1, Math.round((Date.now() - t) / 60000));
  return mins < 60 ? (mins + " 分钟前")
       : mins < 1440 ? (Math.round(mins/60) + " 小时前")
       : (Math.round(mins/1440) + " 天前");
}
/* 一份存档（本地的或刚读出来的文件）摊成信息表 —— 导入前后看的是同一张表，好对数 */
function tally(o){
  const lex = o.lex || {}, keys = Object.keys(lex);
  const mastered = keys.filter(function(k){ return (lex[k].str||0) >= 3; }).length;
  const M = o.meta || {}, r = o.run;
  return li("存档时间", fmtTime(o.t || M.t))
       + li("上次游玩", agoText(o.t || M.t))
       + li("词汇", "掌握 " + mastered + " / 遇到 " + keys.length + " / 共 " + WORDS.length)
       + li("遗物图鉴", Object.keys(o.codex || {}).length + " / " + RELICS.length + " 件")
       + li("最深 / 通关 / 探索", "第 " + (M.best||0) + " 层　" + (M.clears||0) + " 次　" + (M.runs||0) + " 趟")
       + li("镇上宝石", ((o.town && (typeof o.town.gem === "number" ? o.town.gem : o.town.gold)) || 0) + " 颗")
       + li("没走完的探索", r && r.P ? ("第 " + r.floor + " 层 · Lv." + r.P.lvl + " · " + Math.max(0, r.P.hp) + " 血") : "无");
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
    return "已导出 " + name + "（约 " + Math.max(1, Math.round(txt.length/1024)) + " KB）—— 去浏览器的下载列表里找它。";
  }catch(e){
    $("codeOut").value = txt;      // 下载被挡了就退回文本框，至少能手动复制走
    return "这个浏览器挡了下载。存档已经放进下面「导出码」的框里，手动复制走一样能用。";
  }
}
/* 认三种东西：本游戏的存档文件、存成文本的导出码、以及裸 JSON（有 lex 就行） */
function parseSave(txt){
  txt = (txt || "").replace(/^\uFEFF/, "").trim();
  if(!txt) return {err:"这个文件是空的。"};
  let o = null;
  if(txt.charAt(0) === "{"){
    try{ o = JSON.parse(txt); }
    catch(e){ return {err:"这个文件读不出来 —— 内容不完整，或者根本不是存档。"}; }
  } else if(txt.indexOf(CODE_TAG) === 0){
    try{ o = JSON.parse(b64dec(txt.replace(/\s+/g, "").slice(CODE_TAG.length))); }
    catch(e){ return {err:"文件里的导出码读不出来，多半是复制时漏了一截。"}; }
  } else {
    return {err:"这不是幽墟回廊的存档文件。"};
  }
  if(!o || typeof o !== "object") return {err:"这不是幽墟回廊的存档文件。"};
  if(o.game && o.game !== FILE_TAG) return {err:"这是别的东西的存档，不是幽墟回廊的。"};
  if(!o.lex || typeof o.lex !== "object") return {err:"文件里没有词汇数据，不像是这个游戏的存档。"};
  return {data:o};
}
/* 选中就读 —— 不用再点一次「读取」，读完直接把信息摊出来 */
function takeFile(file){
  closeFileCard();
  if(!file) return;
  if(file.size > 8 * 1024 * 1024){ fileMsg("这个文件有 " + Math.round(file.size/1048576) + "MB，太大了，不像是存档。"); return; }
  fileMsg("正在读 " + file.name + " …");
  const fr = new FileReader();
  fr.onerror = function(){ fileMsg("这个文件读不出来 —— 换一份试试。"); };
  fr.onload = function(){
    const r = parseSave(String(fr.result || ""));
    if(r.err){ fileMsg(r.err); return; }
    pendingFile = r.data;
    $("fileName").textContent = file.name;
    $("fileInfo").innerHTML = tally(r.data);
    $("fileCard").hidden = false;
    fileMsg("读出来了 —— 对一眼上面的数字，再决定怎么导入。");
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
      } else if(ev.key === "Enter" && !$("btnRescue").hidden){
        ev.preventDefault(); $("btnRescue").click();
      } else if(ev.key === "Enter" && !$("btnNextQ").hidden){
        ev.preventDefault(); $("btnNextQ").click();
      }
      return;
    }
    if(ev.key === "Enter"){
      const b = v.querySelector(".btn.primary");
      if(b){ ev.preventDefault(); b.click(); }
    } else if(ev.key === "Escape"){
      if(v.id === "veilCodex" || v.id === "veilHelp" || v.id === "veilFuse") v.hidden = true;
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
  const x = +c.dataset.x, y = +c.dataset.y;
  // 站在阶梯上再点一下脚下这格 = 重新问「要不要下去」（上次选了「再待一会儿」的退路）
  autoOff();        // 自己点了地图 = 关掉自动寻路
  if(x === P.x && y === P.y && G.stair && x === G.stair.x && y === G.stair.y){ askStair(); return; }
  goTo(x, y);
});
$("btnSpeak").addEventListener("click", function(){ if(B && B.q) speak(B.q.word.en); });
$("btnSpellSpeak").addEventListener("click", function(){ if(B && B.q) speak(B.q.word.en); });
$("btnNextQ").addEventListener("click", function(){
  if(!B) return;
  if(B.won) closeBattleWin();
  else nextQuestion();
});
$("btnRescue").addEventListener("click", function(){ closeRescue(false); });
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
}
Array.prototype.forEach.call(document.querySelectorAll(".nav"), function(b){
  b.addEventListener("click", function(){ showView(b.dataset.view); });
});

/* ---- 设置 ---- */
$("optSpeak").checked = OPT.speak !== false;
$("optAuto").checked = OPT.auto !== false;
$("optSpeak").addEventListener("change", function(){ OPT.speak = this.checked; saveOpt(); });
$("optAuto").addEventListener("change", function(){ OPT.auto = this.checked; saveOpt(); });
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
    ? ("你正在洞里。存档停在<b>第 " + (s ? s.floor : G.floor) + " 层的入口</b> —— " +
       "游戏只在<b>进入关卡、下一层、回到主城</b>这三个时候存。关掉页面，下次打开自动从这一层开头接着走，不会问你。")
    : s
      ? ("上次的探索停在<b>" + ((chapterById(s.ch || 1) || CH).name) + " 第 " + s.floor +
         " 层</b>（Lv." + s.P.lvl + "）的入口。下次打开会自动接着走，也可以现在就继续。")
      : "存档只在<b>进入关卡、下一层、回到主城</b>这三个时候写，下次打开自动读档。你现在在镇上，没有在进行的探索。";
  $("btnResumeHere").hidden = !(s && !inRun);
  /* 「放弃」已经挪到取景框左下角，它跟着 stageBox 一起显隐（只有探索时在），
     不用再按存档状态禁用 —— 以前它住在设置页才需要那一行。 */
}
/* ---- 房间：祭坛 / 宝箱 / 游商 ---- */
/* ---- 下楼确认 ---- */
$("btnSpringDrink").addEventListener("click", function(){ resolveSpring(true); });
$("btnSpringSkip").addEventListener("click", function(){ resolveSpring(false); });
$("btnStairGo").addEventListener("click", function(){ closeStair(true); });
$("btnStairStay").addEventListener("click", function(){ closeStair(false); });
$("btnAltarPay").addEventListener("click", function(){ resolveAltar(true); });
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
function renderLock(){
  const b = $("btnLockWager");
  if(!b) return;
  b.classList.toggle("on", !!OPT.lock);
  b.textContent = OPT.lock ? "锁定冒险 · 开（每题双倍）" : "锁定冒险 · 关";
}
$("btnLockWager").addEventListener("click", function(){
  OPT.lock = !OPT.lock;
  saveOpt();                       // 设置项，立刻落盘（不受三个存档点的限制）
  renderLock();
  // 正在答的这题也跟着变，免得开了锁还要等下一题才生效
  if(B && !B.locked && B.q && B.q.type !== "spell"){
    B.wager = !!OPT.lock;
    $("btnWager").classList.toggle("on", B.wager);
    setWagerLabel();
  }
  say(OPT.lock ? "锁定冒险：接下来每题都<b>自动押上</b> —— 对了伤害翻倍，错了受伤翻倍。"
               : "解除锁定：恢复成每题自己决定要不要冒险。", "sys");
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

/* ---- 遗物三选一 ---- */
$("relicList").addEventListener("click", function(ev){
  const b = ev.target.closest(".relic");
  if(b && b.dataset.id) takeRelic(b.dataset.id);
});
/* 「重掷」：窗不关，就地换一批（每层一次） */
$("btnRelicRedraw").addEventListener("click", function(){
  if(!G || G.rerollUsed || !hasRelic("redraw")) return;
  G.rerollUsed = true;
  say("你把这三样推了回去 —— 换一批。", "sys");
  offerRelics();
});

/* ---- 主城 与 洞窟 ---- */
$("btnCave").addEventListener("click", openCave);
$("btnCloseCave").addEventListener("click", function(){ $("veilCave").hidden = true; });
$("btnTownCodex").addEventListener("click", function(){ $("codexFind").value = ""; openCodex(); });
$("routeList").addEventListener("click", function(ev){
  const b = ev.target.closest(".route");
  if(b && !b.disabled) enterRoute(b.dataset.id);
});
/* 取景框左下角的「放弃」：两步确认 —— 手滑点掉一趟很伤 */
let abandonArmed = 0;
$("btnAbandon").addEventListener("click", function(){
  const b = this;
  if(Date.now() > abandonArmed){
    abandonArmed = Date.now() + 4000;
    b.textContent = "再点一次";
    b.classList.add("armed");
    setTimeout(function(){
      if(Date.now() > abandonArmed){ b.textContent = "放弃"; b.classList.remove("armed"); }
    }, 4100);
    return;
  }
  abandonArmed = 0;
  b.textContent = "放弃";
  b.classList.remove("armed");
  autoOff();
  giveUpRun();       // 直接结算：算分、发宝石、弹结算窗
});
/* 取景框左下角的「寻路」：开关式。开着就一路走 —— 怪 → 金币 → 楼梯。
   ⚠️ **不过 `gate()`** —— 战斗刚结束那 260ms 的输入锁会把「停下」这一下吃掉，
   而玩家按停就是想马上停。连点两下 = 关了又开，无害。*/
$("btnPathfind").addEventListener("click", autoToggle);

/* ---- 导出码 ---- */
$("btnGenCode").addEventListener("click", function(){
  $("codeOut").value = makeCode();
  $("codeMsg").textContent = "生成好了 —— 复制它，到另一台设备粘进下面那个框。";
});
$("btnCopyCode").addEventListener("click", function(){
  const t = $("codeOut");
  if(!t.value){ $("codeMsg").textContent = "先点「生成导出码」。"; return; }
  t.select();
  const b = this;
  try{
    navigator.clipboard.writeText(t.value);
    b.textContent = "已复制";
  }catch(e){
    b.textContent = "请手动复制";     // 沙箱里剪贴板可能被挡，已经帮你选中了
  }
  setTimeout(function(){ b.textContent = "复制"; }, 1600);
});
$("btnImport").addEventListener("click", function(){
  const msg = applyCode($("codeIn").value);
  $("codeMsg").textContent = msg;
  if(msg.indexOf("成功") >= 0) $("codeIn").value = "";
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
$("btnCancelFile").addEventListener("click", function(){ closeFileCard(); fileMsg("已取消，什么都没动。"); });
$("btnMergeFile").addEventListener("click", function(){
  if(!pendingFile){ fileMsg("先选一个存档文件。"); return; }
  const r = mergeData(pendingFile);
  closeFileCard();
  fileMsg("合并完成：更新 " + r.words + " 个词，补上 " + r.legs + " 件遗物"
        + (r.gold ? ("，宝石 +" + r.gold + " 颗") : "")
        + (r.run ? "，还接回了一趟没走完的探索。" : "。"));
});
/* 覆盖是抹掉这台设备的进度，两步确认 —— 跟「清除全部存档」一个规矩 */
let overArmed = 0;
$("btnOverwriteFile").addEventListener("click", function(){
  if(!pendingFile){ fileMsg("先选一个存档文件。"); return; }
  const b = this;
  if(Date.now() > overArmed){
    overArmed = Date.now() + 4000;
    b.textContent = "再点一次确认覆盖";
    setTimeout(function(){ if(Date.now() > overArmed) b.textContent = "整档覆盖"; }, 4100);
    return;
  }
  overArmed = 0;
  b.textContent = "整档覆盖";
  fileMsg("正在覆盖，马上重新载入…");
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

/* ================= 启动 =================
   打开就自动接着上次存下的那一层 —— 不问、不弹窗。
   不想接着走的话，取景框左下角有「放弃」（两步确认，点完直接结算）。 */
renderLock();                      // 「锁定冒险」的开关状态存在 OPT 里，开局先摆正
(function boot(){
  const s = readRun();
  if(s){ SCENE = "run"; showScene(); resumeRun(s); return; }
  goTown();
})();
refreshSaveState();
})();
