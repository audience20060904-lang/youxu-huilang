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
        right:0, wrong:0, seenWords:[], combo:0,
        relics:[], haunt:[], undying:false };
  G = { floor:0, paused:false, over:false };
  // 不用先删旧档：下面 nextFloor() 会 commit 一次，直接盖掉（存档点之一：进入关卡）
  $("log").innerHTML = "";
  hideAll();
  say("石门在身后合上。走廊里只有火把的回声。", "sys");
  say("这一层有几只东西待在原地不动 —— 找到它们，念对那个词。", "sys");
  nextFloor();
}
function xpNeed(l){ return 5 + l * 3; }
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
  if(hasRelic("keen"))  s.crit += 15;
  if(hasRelic("edge"))  s.crit += 8;
  if(hasRelic("hoard")) s.atk += Math.floor((P.gold || 0) / 20);   // 守财：每 20 金 +1 攻
  if(hasRelic("stand") && P.hp < s.maxHp / 2) s.def += 2;   // 背水
  return s;
}
/* ================= 生成 ================= */
function nextFloor(){
  cancelWalk();
  G.floor++;
  P.undying = false;
  G.relicDone = false;     // 这一层清完再给一次遗物
  if(P.relics){                                    // 进层结算的普通遗物
    if(hasRelic("lamp"))  P.hp = Math.min(stats().maxHp, P.hp + 5);   // 油灯
    if(hasRelic("purse")) P.gold += 3;                                 // 钱袋
  }
  G.echoUsed = false;      // 「回声」每层一次
  if(G.floor > FLOORS){ chapterClear(); return; }
  genFloor();
  fov();
  buildGrid();
  render();
  lockInput(320);
  const last = G.floor === FLOORS;
  say("—— " + CHAPTER.name + " 第 " + G.floor + " 层 ——", "crit");
  say(last ? "空气冷得发硬。这一层尽头有东西在等。" : ("这一层有 " + G.mobs.length + " 只敌人。清干净才能下去。"), last ? "hurt" : "sys");
  commit(true);          // 存档点之二：下一层
}
function genFloor(){
  const map = [], seen = [], vis = [];
  for(let y=0;y<H;y++){
    map.push(new Array(W).fill(0));
    seen.push(new Array(W).fill(false));
    vis.push(new Array(W).fill(false));
  }
  const rooms = [];
  for(let a=0; a<200 && rooms.length<7; a++){
    const w = ri(4,7), h = ri(3,5), x = ri(1, W-w-2), y = ri(1, H-h-2);
    let ok = true;
    for(let i=0;i<rooms.length;i++){
      const r = rooms[i];
      if(x-1 < r.x+r.w+1 && x+w+1 > r.x-1 && y-1 < r.y+r.h+1 && y+h+1 > r.y-1){ ok = false; break; }
    }
    if(!ok) continue;
    rooms.push({x:x,y:y,w:w,h:h,cx:x+(w>>1),cy:y+(h>>1)});
    for(let j=y;j<y+h;j++) for(let i=x;i<x+w;i++) map[j][i] = 1;
  }
  for(let i=1;i<rooms.length;i++){
    const a = rooms[i-1], b = rooms[i];
    let x = a.cx, y = a.cy;
    while(x !== b.cx){ x += b.cx > x ? 1 : -1; map[y][x] = 1; }
    while(y !== b.cy){ y += b.cy > y ? 1 : -1; map[y][x] = 1; }
  }
  G.map = map; G.seen = seen; G.vis = vis; G.mobs = []; G.things = [];
  P.x = rooms[0].cx; P.y = rooms[0].cy;
  const last = rooms[rooms.length-1];
  G.stair = {x:last.cx, y:last.cy};

  const spots = [];
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    if(map[y][x] === 1 && !(x===P.x && y===P.y) && !(x===G.stair.x && y===G.stair.y)
       && Math.abs(x-P.x) + Math.abs(y-P.y) > 4) spots.push({x:x,y:y});
  }
  function take(){ return spots.length ? spots.splice(Math.floor(Math.random()*spots.length),1)[0] : null; }

  const pool = FOES.filter(function(f){ return f.from <= G.floor; });
  const gate = (G.floor === FLOORS) || (G.floor % 10 === 0);
  const n = gate ? CHAPTER.mobsPerFloor - 1 : CHAPTER.mobsPerFloor;
  for(let i=0;i<n;i++){
    const sp = take(); if(!sp) break;
    G.mobs.push(makeFoe(pick(pool), sp.x, sp.y));
  }
  if(G.floor === FLOORS){
    const sp = take();
    if(sp) G.mobs.push(makeFoe(BOSS, sp.x, sp.y));
  } else if(G.floor % 10 === 0){
    const sp = take();
    if(sp) G.mobs.push(makeFoe(GATEKEEPER, sp.x, sp.y));   // 每 10 层的守门人
  }
  for(let i=0, k=ri(3,4); i<k; i++){
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
  if(Math.random() < 0.30){ const sp = take(); if(sp) G.things.push({x:sp.x, y:sp.y, kind:"altar"}); }
  if(G.floor >= 2 && Math.random() < 0.35){ const sp = take(); if(sp) G.things.push({x:sp.x, y:sp.y, kind:"shop"}); }
}
function makeFoe(def, x, y){
  // 成长曲线在 CHAPTER.grow 里，全是整数加法。
  // 守层者也要涨（不然第 40 层的门跟第 10 层一样弱），只有章末 Boss 固定。
  // step 按**绝对层数**算，不是“距离首次出现几层”。
  // 否则第 38 层登场的怪在第 40 层只长了 2 层，一出场就是纸糊。
  // def.from 只决定**什么时候出现**，def.hp 决定它在同层怪里的相对硬度。
  const gw = CHAPTER.grow;
  const step = def.id === "warden" ? 0 : Math.max(0, G.floor - 1);
  const hp = def.hp + step * gw.hpPerFloor;
  // 弱点词类：普通怪就是它自己那类，Boss 每次随机（逼你换着类背）
  const weak = def.boss ? pick(Object.keys(BYCAT)) : def.cat;
  return { x:x, y:y, def:def, g:def.g, name:def.name, art:def.art, cat:def.cat, boss:!!def.boss, weak:weak,
           hp:hp, max:hp, dmg:def.dmg + Math.floor(step / gw.dmgEvery), armor:def.armor,
           xp:def.xp + Math.floor(step / gw.xpEvery), seen:false };
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
function los(x0,y0,x1,y1){
  let dx = Math.abs(x1-x0), dy = Math.abs(y1-y0);
  let sx = x0<x1?1:-1, sy = y0<y1?1:-1, err = dx-dy, x = x0, y = y0;
  while(true){
    if(x===x1 && y===y1) return true;
    if(!(x===x0 && y===y0) && G.map[y][x] === 0) return false;
    const e2 = 2*err;
    if(e2 > -dy){ err -= dy; x += sx; }
    if(e2 < dx){ err += dx; y += sy; }
  }
}
function fov(){
  const R = 6;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) G.vis[y][x] = false;
  for(let y=Math.max(0,P.y-R); y<=Math.min(H-1,P.y+R); y++){
    for(let x=Math.max(0,P.x-R); x<=Math.min(W-1,P.x+R); x++){
      if(Math.sqrt((x-P.x)*(x-P.x)+(y-P.y)*(y-P.y)) > R + .4) continue;
      if(los(P.x,P.y,x,y)){ G.vis[y][x] = true; G.seen[y][x] = true; }
    }
  }
  G.mobs.forEach(function(m){ if(G.vis[m.y][m.x]) m.seen = true; });
}

/* ================= 渲染 ================= */
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
    const base = isWall ? "wall" : "floor";
    let glyph = isWall ? "" : "·";
    let content = isWall ? "" : "dot";
    if(!isWall && x === G.stair.x && y === G.stair.y){
      glyph = "▼"; content = "stair" + (cleared ? "" : " locked");
    }
    const th = thingAt(x,y);
    if(th){
      if(th.kind === "gold"){ glyph = "◎"; content = "gold"; }
      else if(th.kind === "feat"){ glyph = th.what; content = "feat"; }
      else if(th.kind === "altar"){ glyph = "坛"; content = "altar"; }
      else if(th.kind === "chest"){ glyph = "箱"; content = "chest"; }
      else if(th.kind === "shop"){ glyph = "商"; content = "shop"; }
    }
    const mo = mobAt(x,y);
    if(mo && (visible || mo.seen)){ glyph = mo.g; content = "mob" + (mo.boss ? " boss" : ""); }
    if(x === P.x && y === P.y){
      c.innerHTML = HERO;
      c.className = "c floor you walkable" + (isGoal ? " goal" : "");
      continue;
    }
    // 金币是画出来的（COIN），别的还是一个字符
    if(content === "gold") c.innerHTML = COIN; else c.textContent = glyph;
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
  $("hFloor").textContent = G.floor + "/" + FLOORS;
  $("hLevel").textContent = P.lvl;
  $("hGold").textContent = P.gold;
  const left = G.mobs.length;
  $("hLeft").textContent = left === 0 ? "已清" : left;
  $("hLeft").parentNode.className = "hi " + (left === 0 ? "done" : "left");
  paintHp($("hpBar"), $("hpFill"), $("hpTxt"), P.hp, s.maxHp);
  const need = xpNeed(P.lvl);
  $("xpFill").style.width = Math.min(100, P.xp / need * 100) + "%";

  renderSheets(s);
}
function st(k,v){ return "<span class=\"s\">" + k + "<b>" + v + "</b></span>"; }
/* 血条：低于 35% 变深红，低于 15% 再加搏动。地牢和战斗界面共用一套 */
function paintHp(bar, fill, txt, hp, max){
  const v = Math.max(0, hp), r = max > 0 ? v / max : 0;
  fill.style.width = (r * 100) + "%";
  txt.textContent = v + " / " + max;
  if(bar) bar.className = "hpbar" + (r <= 0.15 ? " low crit" : r <= 0.35 ? " low" : "");
}
function renderSheets(s){
  $("stats").innerHTML =
    st("攻击", s.atk) + st("护甲", s.def) + st("暴击", s.crit + "%");
  const keys = Object.keys(LEX);
  let mastered = 0, weak = 0;
  keys.forEach(function(k){ const v = LEX[k].str || 0; if(v >= 3) mastered++; else if(LEX[k].wrong) weak++; });
  $("vocab").innerHTML = st("已掌握", mastered + "/" + WORDS.length) + st("要复习", weak);
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
function findPath(tx, ty){
  if(tx === P.x && ty === P.y) return null;
  if(!G.seen[ty][tx] || G.map[ty][tx] === 0) return null;
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
      if(!G.seen[ny][nx] || G.map[ny][nx] === 0) continue;
      const k = key(nx,ny);
      if(done[k]) continue;
      if(mobAt(nx,ny) && !(nx === tx && ny === ty)) continue;  // 怪物挡路
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
function goTo(tx, ty){
  if(G.paused || G.over) return;
  const path = findPath(tx, ty);
  if(!path){
    if(G.seen[ty][tx] && G.map[ty][tx] === 1) say("那边过不去 —— 有东西挡着路。", "sys");
    return;
  }
  cancelWalk();
  walkPath = path;
  G.goal = {x:tx, y:ty};
  render();
  stepWalk();
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
      let amt = Math.round(th.amt * (hasRelic("greed") ? 1.6 : 1));
      if(hasRelic("rust")) amt = Math.round(amt * 1.3);                     // 铜锈
      if(hasRelic("narrow")) amt = Math.max(1, Math.round(amt * 0.6));   // 窄视：金币少四成
      P.gold += amt;
      say("你拾起 <b>" + amt + "</b> 金币。", "sys");
      G.things.splice(G.things.indexOf(th),1);
      fxGold(P.x, P.y);                     // 碎屑飞向顶上的「金」
    } else if(th.kind === "feat"){ openSpring(th); return; }
    else if(th.kind === "altar"){ openAltar(th); return; }
    else if(th.kind === "chest"){ openChest(th); return; }
    else if(th.kind === "shop"){ openShop(th); return; }
  }
  if(P.x === G.stair.x && P.y === G.stair.y){
    if(G.mobs.length > 0){
      say("石门纹丝不动 —— 这一层还剩 <b>" + G.mobs.length + "</b> 只没清。", "hurt");
    } else {
      fov(); render();
      askStair();
    }
  }
}
/* 踩上阶梯不再直接掉下去 —— 先问一句。
   选「再待一会儿」就留在阶梯上，想走的时候**再点一下脚下那格 ▼** 就是这个窗。 */
function askStair(){
  if(!G || G.over || G.mobs.length > 0) return;
  G.paused = true;
  const last = G.floor === FLOORS;
  $("stairEyebrow").textContent = CHAPTER.name + " 第 " + G.floor + " 层 · 已清空";
  $("stairTitle").textContent = last ? "最后一道石门" : "阶梯通向第 " + (G.floor + 1) + " 层";
  $("stairNote").innerHTML = last
    ? "下面就是这一章的尽头。<b>下去就没有回头路。</b>"
    : "下去之后<b>这一层不会再回来</b>。进下一层时会存一次档。";
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
       wager:false, repeatUsed:false, retry:null, optCount:4, dice:0};
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
function showWeak(m){
  const el = $("foeWeak");
  if(!m.weak || !CAT_CN[m.weak]){ el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = "弱点 · <b>" + CAT_CN[m.weak] + "</b>类词伤害更高";
}
function renderBattleBars(){
  const m = B.mob, s = stats();
  $("foeFill").style.width = Math.max(0, m.hp / m.max * 100) + "%";
  $("foeTxt").textContent = Math.max(0, m.hp) + " / " + m.max;
  paintHp($("bHpBar"), $("bHpFill"), $("bHpTxt"), P.hp, s.maxHp);
  const c = $("combo");
  const bonus = P.combo >= 5 ? CHAPTER.comboAt5 : P.combo >= 3 ? CHAPTER.comboAt3 : 0;
  c.textContent = "连击 ×" + P.combo + (bonus ? "　伤害 +" + bonus : (P.combo ? "　再对 " + (3 - P.combo) + " 个 +1 伤害" : ""));
  c.className = "combo" + (bonus ? "" : " none");
}
/* 层数 → 词难度。数组里重复出现就是权重，比写百分比直观。
   50 层的曲线：前 12 层纯 A1，之后逐段掺 A2，30 层后开始出 B1，40 层后以 B1 为主。*/
function wordLevels(floor){
  if(floor <= 12) return [1];
  if(floor <= 20) return [1,1,2];
  if(floor <= 30) return [1,2,2];
  if(floor <= 40) return [2,2,3];
  return [2,3,3];
}
/* 先按权重抽一个难度（数组里重复几次就是几倍权重），再按这个难度筛词。
   筛得太窄就逐级回退，**永远不返回空数组** —— 出不出题直接关系到能不能打。*/
function scopeToLevel(pool, want){
  let out = pool.filter(function(w){ return (w.lv || 1) === want; });
  if(out.length >= 6) return out;
  out = ALLW.filter(function(w){ return (w.lv || 1) === want; });
  return out.length >= 6 ? out : pool;
}
function scopeByLevel(pool, floor){
  return scopeToLevel(pool, pick(wordLevels(floor)));
}
function pickQuizWord(cat){
  // 心魔：这一趟答错过的词，有 35% 直接被拽出来重考
  const hauntRate = hasRelic("bind") ? 0.7 : 0.35;      // 缚魂：心魔出现率翻倍
  if(P.haunt && P.haunt.length && Math.random() < hauntRate){
    const en = pick(P.haunt), w = WMAP[en];
    if(w && !(B && B.q && B.q.word.en === en)) return w;
  }
  const floor = G ? G.floor : 1;
  const catRate = hasRelic("scent") ? 0.9 : 0.7;        // 嗅迹：多出弱点类的词
  let pool = (cat !== "all" && Math.random() < catRate && BYCAT[cat]) ? BYCAT[cat] : ALLW;
  pool = scopeByLevel(pool, floor);
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
function nextQuestion(){
  const m = B.mob;
  let word;
  if(B.retry){ word = B.retry; B.retry = null; }   // 复读者：重考刚才那个
  else word = pickQuizWord(m.cat);
  B.asked++;
  let type;
  if(hasRelic("blind")) type = "spell";                       // 盲斗：全拼写
  else if(m.boss && B.asked % 3 === 0) type = "spell";
  else if(CAN_SPEAK && B.asked % 4 === 0) type = "listen";
  else type = (B.asked % 2 === 1) ? "en2zh" : "zh2en";
  B.q = {word:word, type:type, done:false, haunted: !!(P.haunt && P.haunt.indexOf(word.en) >= 0)};
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
  $("btnFlee").hidden = false;
  $("spellRow").hidden = true;
  $("letters").hidden = true;
  $("opts").hidden = false;
  $("btnSpeak").hidden = true;

  B.optCount = hasRelic("narrow") ? 3 : 4;                    // 窄视：选项少一个
  if(type === "spell"){ renderSpell(word); return; }

  if(type === "listen"){
    $("qLabel").textContent = "听音辨词 · 它念的是什么？";
    $("qWord").textContent = "🔈 ? ? ?";
    $("qWord").className = "qword";
    $("btnSpeak").hidden = false;
    $("btnSpeak").textContent = "🔊 再听一次";
    if(OPT.speak) speak(word.en);
  } else if(type === "en2zh"){
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
  $("qLabel").textContent = "拼出这个词";
  $("qWord").textContent = word.cn;
  $("qWord").className = "qword cn";
  $("opts").hidden = true;
  $("spellRow").hidden = false;
  $("letters").hidden = false;
  B.spell = "";
  const letters = word.en.split("");
  const extra = "aeioustrnlm".split("");
  for(let i=0;i<2;i++) letters.push(pick(extra));
  letters.sort(function(){ return Math.random() - .5; });
  drawSpell(word);
  const box = $("letters");
  box.innerHTML = "";
  letters.forEach(function(ch){
    const b = document.createElement("button");
    b.type = "button"; b.className = "lbtn"; b.textContent = ch;
    b.addEventListener("click", function(){
      if(B.locked || B.spell.length >= word.en.length) return;
      B.spell += ch; b.disabled = true; b.dataset.used = "1";
      drawSpell(word);
      if(B.spell.length === word.en.length){
        setTimeout(function(){ answer(null, B.spell === word.en); }, 180);
      }
    });
    box.appendChild(b);
  });
  const back = document.createElement("button");
  back.type = "button"; back.className = "lbtn"; back.textContent = "⌫";
  back.addEventListener("click", function(){
    if(B.locked || !B.spell.length) return;
    const ch = B.spell.slice(-1);
    B.spell = B.spell.slice(0,-1);
    Array.prototype.some.call(box.children, function(b){
      if(b.disabled && b.textContent === ch){ b.disabled = false; delete b.dataset.used; return true; }
      return false;
    });
    drawSpell(word);
  });
  box.appendChild(back);
}
function drawSpell(word){
  const row = $("spellRow");
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
  $("btnWager").disabled = true;
  const word = B.q.word, m = B.mob, s = stats();
  const rec = LEX[word.en] || {str:0, seen:0, wrong:0};
  rec.seen++;
  if(P.seenWords.indexOf(word.en) < 0) P.seenWords.push(word.en);

  if(B.q.type !== "spell"){
    Array.prototype.forEach.call($("opts").children, function(b){
      b.disabled = true;
      const label = b.textContent.replace(/^\d/, "");
      if(label === (B.q.type === "zh2en" ? word.en : word.cn)) b.classList.add("right");
    });
    if(!ok && btn) btn.classList.add("wrong");
  } else {
    Array.prototype.forEach.call($("letters").children, function(b){ b.disabled = true; });
  }

  const wasStrong = (rec.str || 0) >= 3;          // 学者：看的是答题前的熟练度
  const hitWeak = m.weak && word.cat === m.weak;
  let head, note = "";
  if(ok){
    P.right++; rec.str = Math.min(5, (rec.str||0) + 1); rec.wrong = 0;
    P.combo++;
    // 伤害 =（攻击 + 连击加成）×暴击倍数 − 对方护甲，最低 1
    // 伤害：先把所有加成加完，**只有暴击一个乘区**，最后减护甲。
    // 别再往里加乘法 —— 玩家要能一眼算出还要答对几个。
    const c3 = hasRelic("quick") ? 2 : 3, c5 = hasRelic("quick") ? 4 : 5;   // 速记：连击门槛降一级
    let raw = s.atk;
    let bonus = P.combo >= c5 ? CHAPTER.comboAt5 : P.combo >= c3 ? CHAPTER.comboAt3 : 0;
    if(bonus && hasRelic("spark")) bonus += 1;                              // 火星
    raw += bonus;
    if(hitWeak) raw += hasRelic("hunter") ? 3 : 2;                          // 弱点 +2，猎手再 +1
    if(wasStrong && hasRelic("scholar")) raw += 1;                          // 学者
    if(hasRelic("blind")) raw += 3;                                         // 盲斗
    if(B.q.type === "spell" && hasRelic("carve")) raw += 2;                  // 刻字
    if(P.combo >= 8 && hasRelic("snow")) raw += 3;                           // 滚雪球
    if(hasRelic("ember") && P.hp <= s.maxHp / 3) raw += 4;                   // 残焰
    if(hasRelic("rend")){ raw += 3; P.hp = Math.max(1, P.hp - 1); }          // 割裂（不致死）
    if(B.wager) raw += hasRelic("gambler") ? 5 : 3;                         // 冒对了
    let surge = false;
    if(hasRelic("surge") && Math.random() < .25){ raw += 2; surge = true; } // 潮汐
    // 暴击率的临时加成（赌骰/节拍）—— 加的是概率，不是第二个乘区
    let critRate = s.crit;
    if(hasRelic("dice"))  critRate += (B.dice || 0) * 5;
    if(hasRelic("tempo") && P.combo >= 3) critRate += 10;
    const crit = Math.random()*100 < critRate;
    if(crit) raw *= 2;                                                      // 唯一的乘区
    // 破绻：打中弱点时无视护甲
    const armor = (hitWeak && hasRelic("flaw")) ? 0 : m.armor;
    const dmg = Math.max(1, raw - armor);
    if(crit && hasRelic("vamp")) P.hp = Math.min(s.maxHp, P.hp + 2);        // 饮血
    m.hp -= dmg;
    if(hasRelic("drain")) P.hp = Math.min(s.maxHp, P.hp + 1);               // 吞噬
    if(B.wager){
      B.dice = (B.dice || 0) + 1;                                           // 赌骰累层
      if(hasRelic("allin")) P.hp = Math.min(s.maxHp, P.hp + 2);             // 孤注
    }
    if(hasRelic("midas") && Math.random() < 0.25) P.gold += 2;              // 点金
    floatNum("foe", "-" + dmg, "dmg");
    $("foeArt").classList.remove("hurt"); void $("foeArt").offsetWidth; $("foeArt").classList.add("hurt");
    head = "<span class=\"big ok\">" + (B.wager ? "冒对了！" : crit ? "暴击！" : "命中！") + "</span>";
    note = "你砍中 " + m.name + "，造成 <b>" + dmg + "</b> 点伤害" +
           (hitWeak ? "（正中弱点）" : "") +
           (surge ? "，浪涌炸开" : "") + (bonus ? "（连击 +" + bonus + "）" : "") + "。";
    if(B.q.haunted && dropHaunt(word.en)){
      const back = hasRelic("bind") ? 4 : 2;
      P.hp = Math.min(s.maxHp, P.hp + back);
      note += " <span style=\"color:var(--venom)\">心魔散了，回 " + back + " 点生命。</span>";
      if(hasRelic("settle")){
        m.hp -= 5;
        floatNum("foe", "-5", "dmg");
        note += " <span style=\"color:var(--torch)\">旧账一并算了，再砍 5 点。</span>";
      }
    }
  } else {
    P.wrong++; rec.str = Math.max(0, (rec.str||0) - 1); rec.wrong = (rec.wrong||0) + 1;
    // 铁胆：冒险失手不断连击；长链：答错只减半
    if(B.wager && hasRelic("nerve")){ /* 连击保住 */ }
    else if(hasRelic("chain")) P.combo = Math.floor(P.combo / 2);
    else P.combo = 0;
    B.dice = 0;                       // 赌骰层数清零
    const wasHaunted = B.q.haunted;
    addHaunt(word.en);                      // 答错就缠上来

    // 复读者：每场一次，这一题不扣血，立刻重考同一个词
    if(hasRelic("repeat") && !B.repeatUsed){
      B.repeatUsed = true;
      B.retry = word;
      head = "<span class=\"big no\">复读者拦下了这一下</span>";
      note = "没有扣血 —— 同一个词马上再来一次。";
    } else {
      // 受伤也全是加减：怪物伤害 − 护甲，再加上冒险失手/心魔的惩罚
      let dmg = Math.max(1, m.dmg - s.def);   // 背水已经算在 s.def 里
      if(B.wager) dmg += 2;                   // 冒险失手
      if(wasHaunted) dmg += 1;                // 心魔又答错
      if(B.q.type === "spell" && hasRelic("recite")) dmg = 0;   // 默诵：拼写题答错不掉血
      // 回声：每层第一次答错不掉血
      if(hasRelic("echo") && !G.echoUsed){
        G.echoUsed = true;
        head = "<span class=\"big no\">回声替你挡下了</span>";
        note = "这一层的第一次失手，不掉血。";
      } else {
        if(dmg > 0){ P.hp -= dmg; floatNum("me", "-" + dmg, "ouch"); }
        head = "<span class=\"big no\">" + (B.wager ? "冒险失手" : "失手") + "</span>";
        note = m.name + " 咬中你，你失去 <b>" + dmg + "</b> 点生命" +
               (wasHaunted ? "（心魔加重）" : "") + "。";
      }
    }
    if(hasRelic("thorns") && !B.retry){
      m.hp -= 1;
      note += " 赤鳞反弹了 <b>1</b> 点。";
      floatNum("foe", "-1", "dmg");
    }
    if(P.hp <= 0 && hasRelic("undying") && !P.undying){ P.undying = true; P.hp = 1; note += " 薪火在胸口炸开 —— 你以 1 点生命站住了。"; }
  }
  LEX[word.en] = rec;          // 只改内存，下一个存档点（下楼 / 回主城）才落盘

  $("verdict").innerHTML = head +
    "<span class=\"mean\"><b>" + word.en + "</b>　" + word.cn + "　<span style=\"color:var(--faint)\">" + CAT_CN[word.cat] + "</span></span>";
  if(CAN_SPEAK){
    $("btnSpeak").hidden = false;
    $("btnSpeak").textContent = "🔊 " + word.en;
  }
  say((ok ? "答对 " : "答错 ") + word.en + " = " + word.cn, ok ? "good" : "hurt");
  renderBattleBars();
  renderHud();
  $("btnFlee").hidden = true;

  if(m.hp <= 0){ setTimeout(function(){ finishBattle(true); }, 380); return; }
  if(P.hp <= 0){ setTimeout(function(){ finishBattle(false); }, 480); return; }
  if(ok && OPT.auto) setTimeout(function(){ if(B && B.locked) nextQuestion(); }, 450);
  else $("btnNextQ").hidden = false;
}
function finishBattle(win){
  const m = B.mob;
  if(!win){
    B = null;
    $("veilBattle").hidden = true;
    gameOver();
    return;
  }
  $("verdict").innerHTML = "<span class=\"big ok\">" + m.name + " 倒下了</span>";
  $("opts").innerHTML = "";
  $("opts").hidden = true;
  $("spellRow").hidden = true;
  $("letters").hidden = true;
  $("wagerRow").hidden = true;
  $("qHaunt").hidden = true;
  $("btnNextQ").hidden = true;          // 不用再点「收取战利品」了
  $("btnFlee").hidden = true;
  B.won = true;
  renderBattleBars();
  /* 怪一倒就自动收：给一秒看清「倒下了」和最后那个词的释义，然后关窗。
     用 B.won 做闸 —— 这一秒里要是窗已经被别的流程关了（比如通关结算），就别再收一次。 */
  setTimeout(function(){ if(B && B.won) closeBattleWin(); }, 1000);
}
function closeBattleWin(){
  const m = B.mob;
  B = null;
  $("veilBattle").hidden = true;
  const i = G.mobs.indexOf(m);
  if(i >= 0) G.mobs.splice(i,1);
  P.kills++;
  gainXp(m.xp);
  const greed = hasRelic("greed") ? 2 : 1;
  const g = (ri(2,5) + G.floor) * greed;
  P.gold += g;
  const s0 = stats();
  let heal = CHAPTER.killHeal;
  if(hasRelic("reap")) heal += 3;
  if(hasRelic("salve")) heal += 2;                                        // 药膏
  const before = P.hp;
  P.hp = Math.min(s0.maxHp, P.hp + heal);
  const gained = P.hp - before;
  say(m.name + " 化成了灰。<span class=\"sys\">(+" + m.xp + " EXP，+" + g + " 金" +
      (gained > 0 ? "，回复 " + gained + " 生命" : "") + ")</span>", "good");
  if(G.mobs.length === 0){
    /* 阶梯直接开在最后一只怪倒下的地方 —— 不用再满地图找那个 ▼。
       怪站的一定是地板，所以这个位置永远合法。 */
    G.stair = {x:m.x, y:m.y};
    G.seen[m.y][m.x] = true;
    say("这一层清空了。" + m.name + " 倒下的地方裂开了 —— 阶梯 ▼ 就在那儿。", "crit");
  }
  fov();
  // 普通怪不再掉东西（金币已经给过了）；遗物统一由清层/房间给
  G.paused = false;
  lockInput(260);        // 战斗窗是自动关的，挡一下手里还没停的那一点
  render();
  maybeRelic();
}
function flee(){
  if(!B || B.locked) return;
  const m = B.mob;
  B = null;
  $("veilBattle").hidden = true;
  G.paused = false;
  say("你退开了半步。" + m.name + " 留在原地，伤口还在。", "sys");
  lockInput(260);
  render();
}
function gainXp(n){
  P.xp += n;
  while(P.xp >= xpNeed(P.lvl)){
    P.xp -= xpNeed(P.lvl);
    P.lvl++;
    const s = stats();
    P.hp = Math.min(s.maxHp, P.hp + CHAPTER.levelHeal);
    say("<b>等级提升！</b>你现在是 " + P.lvl + " 级 —— 攻击 " + s.atk + "，生命上限 " + s.maxHp + "。", "good");
  }
}

/* ================= 房间：祭坛 / 上锁宝箱 / 游商 =================
   都挂在 G.things 上，靠 kind 分支。进格子时 onEnter 弹窗，处理完 G.paused 放开。 */
var ALTAR_COST = 5;

/* ---- 泉水：踩上去先问一句，不喝就留在原地，回头还能来 ---- */
function openSpring(th){
  G.paused = true;
  pendingRoom = th;
  const s = stats(), heal = s.maxHp - P.hp;
  $("springLedger").innerHTML =
    li("你现在", P.hp + " / " + s.maxHp) +
    li("喝下去", heal > 0 ? ("回复 " + heal + " 点，回到满血") : "你已经是满的了");
  $("btnSpringDrink").disabled = heal <= 0;
  $("btnSpringDrink").textContent = heal > 0 ? "掬一捧喝下" : "喝不下了";
  $("springNote").textContent = heal > 0
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
    const s = stats(), got = s.maxHp - P.hp;
    P.hp = s.maxHp;
    floatNum("me", "+" + got, "heal");
    say("你掬起一捧泉水 —— 生命恢复至满（<b>+" + got + "</b>）。", "good");
    removeThing(th);
  } else {
    say("泉水留在原地，还冒着气泡。", "sys");
  }
  lockInput(200);
  renderHud(); render();
}

function openAltar(th){
  G.paused = true;
  pendingRoom = th;
  const s = stats();
  const enough = P.hp > ALTAR_COST;
  $("altarCost").innerHTML =
    li("代价", ALTAR_COST + " 点生命（你现在 " + P.hp + " / " + s.maxHp + "）") +
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
  if(pay && P.hp > ALTAR_COST){
    P.hp -= ALTAR_COST;
    floatNum("me", "-" + ALTAR_COST, "ouch");
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
      if(chestQ.done || chestQ.spell.length >= word.en.length) return;
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
    if(chestQ.done || !chestQ.spell.length) return;
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
  chestQ.done = true;
  const rec = LEX[w.en] || {str:0, seen:0, wrong:0};
  rec.seen++;
  if(ok){ rec.str = Math.min(5, (rec.str||0) + 1); rec.wrong = 0; }
  else { rec.str = Math.max(0, (rec.str||0) - 1); rec.wrong = (rec.wrong||0) + 1; addHaunt(w.en); }
  LEX[w.en] = rec;             // 同上，等存档点
  $("chestVerdict").innerHTML = (ok
      ? "<span class=\"big ok\">咔哒 —— 开了</span>"
      : "<span class=\"big no\">锁咬死了</span>") +
    "<span class=\"mean\"><b>" + w.en + "</b>　" + w.cn + "</span>";
  $("btnChestLeave").hidden = true;
  $("btnChestDone").hidden = false;
  $("btnChestDone").textContent = ok ? "拿走" : "认了";
  chestQ.ok = ok;
}
function closeChest(){
  const th = pendingRoom; pendingRoom = null;
  const ok = chestQ && chestQ.ok;
  chestQ = null;
  $("veilChest").hidden = true;
  G.paused = false;
  removeThing(th);
  if(ok){
    const g = 4 + G.floor * 2;
    P.gold += g;
    say("木箱开了，里面有 <b>" + g + "</b> 金币。", "good");
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
    for(let i=0;i<3;i++){
      let r = null;
      for(let g=0; g<30 && !r; g++){
        const c = rollRelic();
        if(c && !th.stock.some(function(x){ return x.relic === c; })) r = c;
      }
      if(!r) break;
      th.stock.push({relic:r, price: 10 + (r.r || 0) * 12 + G.floor, sold:false});
    }
  }
  renderShop();
  hideAll();
  $("veilShop").hidden = false;
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
  th.stock.forEach(function(row, i){
    const r = row.relic;
    const d = document.createElement("div");
    d.className = "shopit" + (row.sold ? " sold" : "");
    d.innerHTML =
      "<div class=\"col\">" +
        "<div class=\"sk\">" + RAR_CN[r.r || 0] + " · 遗物</div>" +
        "<div class=\"sn\" style=\"color:var(--q" + (r.r || 0) + ")\">" + r.n + "</div>" +
        "<div class=\"sd\">" + r.pw + "</div>" +
      "</div>" +
      "<button type=\"button\" class=\"buy\" data-i=\"" + i + "\"" +
        (row.sold || P.gold < row.price ? " disabled" : "") + ">" +
        (row.sold ? "已售" : row.price + " 金") + "</button>";
    box.appendChild(d);
  });
}
function buyFrom(i){
  const th = pendingRoom;
  pendingRoom = null;
  if(!th) return;
  const row = th.stock[i];
  if(!row || row.sold || P.gold < row.price) return;
  P.gold -= row.price;
  row.sold = true;
  say("你付了 <b>" + row.price + "</b> 金币。", "sys");
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
let pendingSwap = null;           // 等着被换进来的那件

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

/* 层数 → 掉落品质权重。数组里重复几次就是几倍权重，跟 wordLevels 一个写法。
   前期几乎全是普通（它们是合成燃料），神圣只在深层才有影。*/
function rarityWeights(floor){
  if(floor <= 10) return [0,0,0,0,1];
  if(floor <= 20) return [0,0,0,1,1,2];
  if(floor <= 30) return [0,0,1,1,2,2,3];
  if(floor <= 40) return [0,1,1,2,2,3,3,4];
  return [1,1,2,2,3,3,4,4];
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
function sellRelic(id){
  const i = P.relics.indexOf(id);
  if(i < 0) return;
  const r = relicById(id);
  const g = (RAR_SELL[r.r || 0] || 4) + Math.floor((G ? G.floor : 1) / 5);
  withMaxHp(function(){ P.relics.splice(i, 1); });
  P.gold += g;
  say("你拆了 " + rc(r) + "，换成 <b>" + g + "</b> 金币。", "sys");
  renderHud();
}
/* ---- 合成：玩家自己挑 3 件同品质的，换一件高一档的（换到哪一件仍是随机） ----
   遗物页上两个按钮：「选择」进/退挑选状态，「合成」把挑中的三件砸了。
   挑选状态下整张遗物卡可点，选了第一件之后别的品质就点不动了。 */
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
  if(fuseSel.length >= FUSE_N){ say("已经挑满 " + FUSE_N + " 件了。", "sys"); return; }
  fuseSel.push(id);
  renderRelics();
}
function fuseGo(){
  if(fuseSel.length !== FUSE_N) return;
  const rar = fuseRar();
  if(rar < 0 || rar >= 4) return;
  // 挑的这三件必须都还在手上（分解过就作废）
  const eat = fuseSel.filter(function(id){ return P.relics.indexOf(id) >= 0; });
  if(eat.length !== FUSE_N){ fuseSel = []; renderRelics(); return; }
  const up = relicPool().filter(function(x){ return (x.r || 0) === rar + 1; });
  if(!up.length){ say("更高一档的遗物你已经拿齐了。", "sys"); return; }
  const got = pick(up);
  withMaxHp(function(){
    eat.forEach(function(id){ P.relics.splice(P.relics.indexOf(id), 1); });
    P.relics.push(got.id);
  });
  fuseOn = false; fuseSel = [];
  noteRelicFound(got, "合成出");
  say("你把 " + FUSE_N + " 件" + RAR_CN[rar] + "遗物砸在一起 —— " + rc(got) + " 成了。", "crit");
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
  if(r && P.relics.length >= RELIC_MAX){ offerSwap(r, how); return; }
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
  $("swapMax").textContent = RELIC_MAX;
  $("swapNew").innerHTML = "<span class=\"rt q" + (r.r||0) + "\">" + RAR_CN[r.r||0] + "</span>" +
    "<span class=\"rn q" + (r.r||0) + "\">" + r.n + "</span><span class=\"rp\">" + r.pw + "</span>";
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
    withMaxHp(function(){
      if(i >= 0) P.relics.splice(i, 1);
      P.relics.push(ps.relic.id);
    });
    noteRelicFound(ps.relic, ps.how);
    say("你放下 " + (old ? old.n : "旧遗物") +
        "，换上了 " + rc(ps.relic) + "。", "crit");
  } else {
    const g = 8 + G.floor * 2;
    P.gold += g;
    say("你没动手上的东西，" + ps.relic.n + " 折成了 <b>" + g + "</b> 金币。", "sys");
  }
  renderHud(); render();
  maybeRelic();
}

/* 跨局图鉴：记首次在第几层拿到、总共拿过几次 */
function noteRelicFound(r, how){
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
  $("relicEyebrow").textContent = CHAPTER.name + " 第 " + G.floor + " 层 · 清干净了";
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
  hideAll();
  $("veilRelic").hidden = false;
  return true;
}
function takeRelic(id){
  const r = relicById(id);
  if(!r) return;
  G.relicDone = true;
  $("veilRelic").hidden = true;
  if(P.relics.length >= RELIC_MAX){ offerSwap(r, "你拿起了"); return; }
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
  $("relicHead").textContent = "遗物 " + own.length + " / " + RELIC_MAX;
  const dot = $("bagDot");
  dot.textContent = own.length;
  dot.hidden = own.length === 0;
  const box = $("relicOwned");
  box.innerHTML = "";
  // 选中的东西可能已经不在手上了（被换掉、被分解），先对一遍
  fuseSel = fuseSel.filter(function(id){ return own.indexOf(id) >= 0; });
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
    d.className = "relic own" + (fuseOn ? " pickable" : "") + (picked ? " picked" : "") + (off ? " off" : "");
    d.dataset.id = id;
    d.innerHTML =
      "<div class=\"col\">" +
        "<span class=\"rt q" + q + "\">" + RAR_CN[q] + (picked ? " · 已选" : "") + "</span>" +
        "<span class=\"rn q" + q + "\">" + r.n + "</span>" +
        "<span class=\"rp\">" + r.pw + "</span>" +
      "</div>" +
      (fuseOn
        ? "<span class=\"tick\">" + (picked ? "✓" : "") + "</span>"
        : "<button type=\"button\" class=\"melt\" data-sell=\"" + id + "\">分解<em>" +
          ((RAR_SELL[q] || 4) + Math.floor((G ? G.floor : 1) / 5)) + " 金</em></button>");
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
    if(own.filter(function(id){ return relicRar(id) === q; }).length >= FUSE_N){ ready = q; break; }
  }
  pickBtn.textContent = fuseOn ? "取消选择" : "选择";
  pickBtn.disabled = !fuseOn && ready < 0;
  goBtn.disabled = fuseSel.length !== FUSE_N;
  goBtn.textContent = fuseOn && fuseSel.length ? ("合成（" + fuseSel.length + "/" + FUSE_N + "）") : "合成";
  if(!note) return;
  if(fuseOn){
    note.innerHTML = fuseSel.length
      ? ("已挑 <b>" + fuseSel.length + " / " + FUSE_N + "</b> 件" + RAR_CN[fuseRar()] +
         "，合成后换回一件<b>" + RAR_CN[fuseRar() + 1] + "</b>（随机一件）。再点一下可以取消选中。")
      : "在上面点 <b>" + FUSE_N + " 件同品质</b>的遗物。神圣已经是顶了，不能当材料。";
  } else {
    note.innerHTML = ready >= 0
      ? ("点「选择」，挑 " + FUSE_N + " 件同品质的砸成一件更高的。你的<b>" + RAR_CN[ready] + "</b>已经够了。")
      : "同一个品质攒够 " + FUSE_N + " 件才能合成。";
  }
}

/* ================= 心魔 =================
   这一趟答错过的词会缠上来：抽题时优先出现，答对驱散并回血，再答错额外掉 1 点。
   数据用的是现成的 P.haunt（只存 en 字符串）。 */
var HAUNT_MAX = 6;
function addHaunt(en){
  if(!P.haunt) P.haunt = [];
  const i = P.haunt.indexOf(en);
  if(i >= 0) P.haunt.splice(i, 1);
  P.haunt.push(en);
  while(P.haunt.length > HAUNT_MAX) P.haunt.shift();
}
function dropHaunt(en){
  if(!P.haunt) return false;
  const i = P.haunt.indexOf(en);
  if(i < 0) return false;
  P.haunt.splice(i, 1);
  return true;
}

/* ================= 主城 =================
   两个场景：town / run。主城是常驻的，一趟探索只是从镇口下去一次。
   死亡 = 身上一切归零回镇上，**只有金币带得回来**（在 endRun 里结算）。 */
var TOWN_KEY = "youxu.town.v1";
var TOWN = load(TOWN_KEY, {gold:0});
/* TOWN 也常驻内存，改完等 commit() 落盘 */
let SCENE = "town";

/* 地牢那几块和主城面板互斥显示 */
function showScene(){
  const inRun = SCENE === "run";
  /* hudRow / barsRow 现在住在 stageBox 里面（.mapui 浮层），跟着 stage 一起显隐，不用单独管 */
  ["stageBox","mapTools","log"].forEach(function(id){ $(id).hidden = !inRun; });
  $("townPanel").hidden = inRun;
  /* 探索时顶栏整块收起 —— 章节名挪进了地图浮层的「层」那一格，省下的高度全给地图 */
  $("topBar").hidden = inRun;
  $("hChap").textContent = CHAPTER.name;
  $("chapterTag").textContent = "主城 · 灰岩镇";
  if(inRun) sizeMap();
}
function renderTown(){
  const M = meta();
  $("tGold").textContent = TOWN.gold;
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
  B = null; pendingLoot = null; pendingRoom = null; chestQ = null; reopenShop = null; pendingSwap = null;
  P = { x:0, y:0, lvl:1, xp:0, hp:CHAPTER.playerBase.hp, gold:0, kills:0,
        right:0, wrong:0, seenWords:[], combo:0,
        relics:[], haunt:[], undying:false };
  G = { floor:0, paused:true, over:true };
  fuseOn = false; fuseSel = [];          // 合成的挑选状态跟着这一趟一起结束
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
var RUN_KEY = "youxu.run.v1", RUN_V = 3;   // v2：地图改成 15×21，旧档行宽对不上，作废
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
      v: RUN_V, ch: CHAPTER.id, t: Date.now(),
      P: P,
      floor: G.floor,
      // 地图和已探索按行压成 "0110..." 字符串，整档才几 KB
      map:  G.map.map(function(r){ return packRow(r, function(v){ return v ? 1 : 0; }); }).join("|"),
      seen: G.seen.map(function(r){ return packRow(r, function(v){ return v ? 1 : 0; }); }).join("|"),
      stair: G.stair,
      // 怪只存 defId + 当前状态，读档时重新链回 FOES
      mobs: G.mobs.map(function(m){
        return {d:m.def.id, x:m.x, y:m.y, hp:m.hp, max:m.max,
                dmg:m.dmg, armor:m.armor, xp:m.xp, s:m.seen};
      }),
      things: G.things
    });
  }catch(e){}
}
function readRun(){
  const s = load(RUN_KEY, null);
  if(!s || s.v !== RUN_V || s.ch !== CHAPTER.id) return null;   // 版本对不上直接丢，不写迁移
  if(!s.P || !s.map || !s.seen || !s.mobs || !s.stair) return null;
  if(!s.floor || s.floor < 1 || s.floor > FLOORS) return null;
  return s;
}
function dropRun(){ try{ localStorage.removeItem(RUN_KEY); }catch(e){} }
function foeDef(id){
  if(id === BOSS.id) return BOSS;
  for(let i=0;i<FOES.length;i++) if(FOES[i].id === id) return FOES[i];
  return null;
}
function unpackGrid(str, f){
  return str.split("|").map(function(row){ return row.split("").map(f); });
}
function resumeRun(s){
  P = s.P;
  // 旧档的 gear/bag 字段留着也无害，没人读它了                 // 老档兜底
  if(!P.relics) P.relics = [];
  if(!P.haunt) P.haunt = [];
  if(typeof P.combo !== "number") P.combo = 0;   // 连击现在存在 P 上，老档没有这个字段
  G = { floor: s.floor, paused:false, over:false,
        map:  unpackGrid(s.map,  function(c){ return c === "1" ? 1 : 0; }),
        seen: unpackGrid(s.seen, function(c){ return c === "1"; }),
        vis: [], things: s.things || [], stair: s.stair, mobs: [] };
  for(let y=0;y<H;y++) G.vis.push(new Array(W).fill(false));   // 视野是算出来的，不存
  s.mobs.forEach(function(m){
    const def = foeDef(m.d);
    if(!def) return;                     // 怪被删掉了就当它不存在，别崩
    G.mobs.push({x:m.x, y:m.y, def:def, g:def.g, name:def.name, art:def.art,
                 cat:def.cat, boss:!!def.boss, hp:m.hp, max:m.max,
                 dmg:m.dmg, armor:m.armor, xp:m.xp, seen:!!m.s});
  });
  $("log").innerHTML = "";
  hideAll();
  fov(); buildGrid(); render(); renderHud();
  say("—— " + CHAPTER.name + " 第 " + G.floor + " 层 ——", "crit");
  say("你回到了踏进这一层时的样子 —— 存档存在每层的入口。", "sys");
  lockInput(320);
}
/* ================= 结算 ================= */
/* 返回的就是内存里那一份，改完等 commit() 落盘，别单独写 localStorage */
function meta(){ return MET; }
function gameOver(){ endRun(false); }
function chapterClear(){ endRun(true); }
function endRun(win){
  G.over = true;
  const M = meta();
  M.runs++;
  if(G.floor > M.best) M.best = Math.min(G.floor, FLOORS);
  if(win) M.clears++; else M.deaths = (M.deaths || 0) + 1;
  // 装备和背包都留在洞里，只有金币能带回镇上
  const haul = P.gold;
  TOWN.gold += haul;
  commit(false);       // 存档点之三（上半截）：这一趟结束，人被抬回镇上，续玩档作废
  const total = P.right + P.wrong;
  const acc = total ? Math.round(P.right / total * 100) : 0;
  $("endEyebrow").textContent = win ? ("第" + CHAPTER.id + "章 · 通关") : "本次探索结束";
  $("endTitle").textContent = win ? (BOSS.name + "倒下了") : ("你倒在第 " + G.floor + " 层");
  $("endEyebrow").textContent = win ? ("第" + CHAPTER.id + "章 · 通关") : "你被抬回了镇上";
  $("endStats").innerHTML =
    li("到达层数", "第 " + Math.min(G.floor, FLOORS) + " / " + FLOORS + " 层") +
    li("答对 / 答错", P.right + " / " + P.wrong) +
    li("正确率", acc + "%") +
    li("击败", P.kills + " 只") +
    li("这趟遇到的词", P.seenWords.length + " 个") +
    li("带回存款", haul + " 枚（共 " + TOWN.gold + "）") +
    li("丢在洞里", (P.relics.length || 0) + " 件遗物") +
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
  if(win) say(BOSS.name + "碎成了石块。第" + CHAPTER.id + "章结束 —— 下一章还没开凿。", "crit");
}
function li(k,v){ return "<div class=\"li\"><span class=\"lb\">" + k + "</span><span class=\"am\">" + v + "</span></div>"; }

/* ================= 图鉴 ================= */
let cTab = "word";
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
       （用户定的，别再把没拿过的遮成 ▨▨。）*/
    RELICS.forEach(function(R){
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
    const met = Object.keys(LEX).length;
    const mastered = Object.keys(LEX).filter(function(k){ return (LEX[k].str||0) >= 3; }).length;
    $("codexTitle").textContent = "词库 " + mastered + " 掌握 / " + met + " 遇到 / " + WORDS.length + " 总数";
    Object.keys(BYCAT).forEach(function(cat){
      const h = document.createElement("div");
      h.className = "eyebrow"; h.style.marginTop = "4px";
      h.textContent = CAT_CN[cat];
      box.appendChild(h);
      BYCAT[cat].forEach(function(w){
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
  $("veilCodex").hidden = false;
}
function hideAll(){
  ["veilBattle","veilEnd","veilCodex","veilHelp","veilRelic","veilSwap","veilAltar","veilChest","veilShop","veilStair","veilSpring"].forEach(function(id){ $(id).hidden = true; });
}
function anyVeil(){
  const ids = ["veilBattle","veilEnd","veilCodex","veilHelp","veilRelic","veilSwap","veilAltar","veilChest","veilShop","veilStair","veilSpring"];
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
  const before = TOWN.gold || 0;
  TOWN.gold = Math.max(before, (o.town && o.town.gold) || 0);

  /* 导入是玩家自己点的，就地写一次盘 —— 它不是游戏里的那三个存档点，而是存档管理本身；
     不马上写的话玩家关掉页面会以为导入没生效。只写永久数据，
     磁盘上那份层存档一个字节都不动（下面单独判断要不要接管）。 */
  commitPerm();

  // 没走完的那一趟：只有这台设备手头没有在进行的探索时才接过来，有就一点不动
  let gotRun = false;
  if(o.run && o.run.P && !readRun() && !(SCENE === "run" && G && !G.over)){
    if(o.run.v === RUN_V && o.run.ch === CHAPTER.id){ put(RUN_KEY, o.run); gotRun = true; }
  }

  renderHud();
  if(SCENE === "town") renderTown();
  refreshSaveState();
  return {words:better, legs:legs, gold:(TOWN.gold - before), run:gotRun};
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
    game: FILE_TAG, v: FILE_V, app: "幽墟回廊", ch: CHAPTER.id, t: Date.now(),
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
       + li("镇上存款", ((o.town && o.town.gold) || 0) + " 枚")
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
  put(TOWN_KEY, o.town || {gold:0});
  if(o.opt && typeof o.opt === "object") put(OPT_KEY, o.opt);
  if(o.run && o.run.P && o.run.v === RUN_V && o.run.ch === CHAPTER.id) put(RUN_KEY, o.run);
  else try{ localStorage.removeItem(RUN_KEY); }catch(e){}
  setTimeout(function(){ try{ location.reload(); }catch(e){} }, 700);
}

/* ================= 事件 ================= */
document.addEventListener("keydown", function(ev){
  if(ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const v = anyVeil();
  if(v){
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
      if(v.id === "veilCodex" || v.id === "veilHelp") v.hidden = true;
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
  if(x === P.x && y === P.y && G.stair && x === G.stair.x && y === G.stair.y){ askStair(); return; }
  goTo(x, y);
});
$("btnSpeak").addEventListener("click", function(){ if(B && B.q) speak(B.q.word.en); });
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
}
Array.prototype.forEach.call(document.querySelectorAll(".nav"), function(b){
  b.addEventListener("click", function(){ showView(b.dataset.view); });
});

/* ---- 设置 ---- */
$("optSpeak").checked = OPT.speak !== false;
$("optAuto").checked = OPT.auto !== false;
$("optSpeak").addEventListener("change", function(){ OPT.speak = this.checked; saveOpt(); });
$("optAuto").addEventListener("change", function(){ OPT.auto = this.checked; saveOpt(); });
/* 两步确认：artifact 跑在沙箱 iframe 里，confirm() 未必可用 */
let wipeArmed = 0;
$("btnWipe").addEventListener("click", function(){
  const b = this;
  if(Date.now() > wipeArmed){
    wipeArmed = Date.now() + 4000;
    b.textContent = "再点一次确认清除";
    setTimeout(function(){
      if(Date.now() > wipeArmed){ b.textContent = "清除全部存档"; }
    }, 4100);
    return;
  }
  wipeArmed = 0;
  [LEX_KEY, CODEX_KEY, META_KEY, TOWN_KEY, RUN_KEY].forEach(function(k){
    try{ localStorage.removeItem(k); }catch(e){}
  });
  /* 内存里那几份也得一起清空 —— 不清的话下面 goTown() 的 commit 会把它们原样写回去 */
  LEX = {};
  CODEX = {};
  MET = {best:0, runs:0, clears:0, t:0};
  TOWN = {gold:0};
  b.textContent = "已清除";
  setTimeout(function(){ b.textContent = "清除全部存档"; }, 1500);
  goTown();
});
$("btnAgain").addEventListener("click", goTown);
$("btnCodex").addEventListener("click", function(){ openCodex(); });
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
      ? ("上次的探索停在<b>第 " + s.floor + " 层</b>（Lv." + s.P.lvl + "）的入口。下次打开会自动接着走，也可以现在就继续。")
      : "存档只在<b>进入关卡、下一层、回到主城</b>这三个时候写，下次打开自动读档。你现在在镇上，没有在进行的探索。";
  $("btnResumeHere").hidden = !(s && !inRun);
  $("btnAbandon").disabled = !s;
}
/* ---- 房间：祭坛 / 宝箱 / 游商 ---- */
/* ---- 下楼确认 ---- */
$("btnSpringDrink").addEventListener("click", function(){ resolveSpring(true); });
$("btnSpringSkip").addEventListener("click", function(){ resolveSpring(false); });
$("btnStairGo").addEventListener("click", function(){ closeStair(true); });
$("btnStairStay").addEventListener("click", function(){ closeStair(false); });
$("btnAltarPay").addEventListener("click", function(){ resolveAltar(true); });
$("btnAltarSkip").addEventListener("click", function(){ resolveAltar(false); });
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
  const b = ev.target.closest("button[data-sell]");
  if(b){ sellRelic(b.dataset.sell); return; }
  const card = ev.target.closest(".relic.own[data-id]");
  if(card && fuseOn) fusePick(card.dataset.id);
});
$("btnFusePick").addEventListener("click", fuseToggleMode);
$("btnFuseGo").addEventListener("click", function(){ if(!this.disabled) fuseGo(); });

/* ---- 带满了的取舍 ---- */
$("swapList").addEventListener("click", function(ev){
  const b = ev.target.closest(".relic");
  if(b && b.dataset.id) doSwap(b.dataset.id);
});
$("btnSwapSkip").addEventListener("click", function(){ doSwap(null); });

/* ---- 遗物三选一 ---- */
$("relicList").addEventListener("click", function(ev){
  const b = ev.target.closest(".relic");
  if(b && b.dataset.id) takeRelic(b.dataset.id);
});

/* ---- 主城 与 洞窟 ---- */
$("btnCave").addEventListener("click", openCave);
$("btnCloseCave").addEventListener("click", function(){ $("veilCave").hidden = true; });
$("btnTownCodex").addEventListener("click", function(){ openCodex(); });
$("routeList").addEventListener("click", function(ev){
  const b = ev.target.closest(".route");
  if(b && !b.disabled) enterRoute(b.dataset.id);
});
/* 放弃本次探索也要两步确认 —— 手滑点掉一趟很伤 */
let abandonArmed = 0;
$("btnAbandon").addEventListener("click", function(){
  const b = this;
  if(Date.now() > abandonArmed){
    abandonArmed = Date.now() + 4000;
    b.textContent = "再点一次确认放弃";
    setTimeout(function(){ if(Date.now() > abandonArmed) b.textContent = "放弃本次探索，回主城"; }, 4100);
    return;
  }
  abandonArmed = 0;
  b.textContent = "放弃本次探索，回主城";
  goTown();          // 主动放弃：金币也不结算，免得进去捣一把就跑
});

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
        + (r.gold ? ("，存款 +" + r.gold + " 枚") : "")
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
   不想接着走的话，设置页有「放弃本次探索，回主城」。 */
renderLock();                      // 「锁定冒险」的开关状态存在 OPT 里，开局先摆正
(function boot(){
  const s = readRun();
  if(s){ SCENE = "run"; showScene(); resumeRun(s); return; }
  goTown();
})();
refreshSaveState();
})();
