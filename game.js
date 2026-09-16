/* 幽墟回廊 · 核心逻辑
   依赖加载顺序：util.js → words-a1.js → content.js → art.js → game.js
   本文件只管规则和渲染，数值和文案在 content.js / words-a1.js */
(function(){
"use strict";

const W = CHAPTER.W, H = CHAPTER.H, FLOORS = CHAPTER.floors;
const LEX_KEY = "youxu.a1lex.v1", CODEX_KEY = "youxu.codex.v1", META_KEY = "youxu.meta2.v1";

let LEX = load(LEX_KEY, {});
let P = null, G = null, B = null, cells = [], pendingLoot = null, pendingRoom = null, chestQ = null, reopenShop = null;
let lastAct = 0, lockUntil = 0;
var OPT_KEY = "youxu.opt.v1";
var OPT = load(OPT_KEY, {speak:true, auto:true});
function saveOpt(){ save(OPT_KEY, OPT); }

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
        right:0, wrong:0, seenWords:[],
        relics:[], haunt:[], undying:false };
  G = { floor:0, paused:false, over:false };
  clearRun();
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
  saveRun();
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
  let cx = P.x - ((VW - 1) >> 1), cy = P.y - ((VH - 1) >> 1);
  cx = Math.max(0, Math.min(Math.max(0, W - VW), cx));
  cy = Math.max(0, Math.min(Math.max(0, H - VH), cy));
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
    c.textContent = glyph;
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
  if(!walkPath.length){ cancelWalk(); saveRun(); }
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
  if(!G.paused && !G.over && G.floor === floorBefore){ fov(); render(); saveRun(); }
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
    } else if(th.kind === "feat"){
      P.hp = stats().maxHp;
      say("你掬起一捧泉水 —— 生命恢复至满。", "good");
      G.things.splice(G.things.indexOf(th),1);
    } else if(th.kind === "altar"){ openAltar(th); return; }
    else if(th.kind === "chest"){ openChest(th); return; }
    else if(th.kind === "shop"){ openShop(th); return; }
  }
  if(P.x === G.stair.x && P.y === G.stair.y){
    if(G.mobs.length > 0){
      say("石门纹丝不动 —— 这一层还剩 <b>" + G.mobs.length + "</b> 只没清。", "hurt");
    } else {
      fov(); render();
      nextFloor();
    }
  }
}

/* ================= 战斗 ================= */
function startBattle(m){
  B = {mob:m, combo:0, q:null, locked:false, asked:0,
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
  const bonus = B.combo >= 5 ? CHAPTER.comboAt5 : B.combo >= 3 ? CHAPTER.comboAt3 : 0;
  c.textContent = "连击 ×" + B.combo + (bonus ? "　伤害 +" + bonus : (B.combo ? "　再对 " + (3 - B.combo) + " 个 +1 伤害" : ""));
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
  B.wager = false;
  $("qHaunt").hidden = !B.q.haunted;
  const wr = $("wagerRow"), wb = $("btnWager");
  wb.classList.remove("on");
  wb.disabled = false;
  wr.hidden = (type === "spell");                             // 拼写题不给押注，太难
  $("btnWager").textContent = "押注 · 我确定";
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
    B.combo++;
    // 伤害 =（攻击 + 连击加成）×暴击倍数 − 对方护甲，最低 1
    // 伤害：先把所有加成加完，**只有暴击一个乘区**，最后减护甲。
    // 别再往里加乘法 —— 玩家要能一眼算出还要答对几个。
    const c3 = hasRelic("quick") ? 2 : 3, c5 = hasRelic("quick") ? 4 : 5;   // 速记：连击门槛降一级
    let raw = s.atk;
    let bonus = B.combo >= c5 ? CHAPTER.comboAt5 : B.combo >= c3 ? CHAPTER.comboAt3 : 0;
    if(bonus && hasRelic("spark")) bonus += 1;                              // 火星
    raw += bonus;
    if(hitWeak) raw += hasRelic("hunter") ? 3 : 2;                          // 弱点 +2，猎手再 +1
    if(wasStrong && hasRelic("scholar")) raw += 1;                          // 学者
    if(hasRelic("blind")) raw += 3;                                         // 盲斗
    if(B.q.type === "spell" && hasRelic("carve")) raw += 2;                  // 刻字
    if(B.combo >= 8 && hasRelic("snow")) raw += 3;                           // 滚雪球
    if(hasRelic("ember") && P.hp <= s.maxHp / 3) raw += 4;                   // 残焰
    if(hasRelic("rend")){ raw += 3; P.hp = Math.max(1, P.hp - 1); }          // 割裂（不致死）
    if(B.wager) raw += hasRelic("gambler") ? 5 : 3;                         // 押中了
    let surge = false;
    if(hasRelic("surge") && Math.random() < .25){ raw += 2; surge = true; } // 潮汐
    // 暴击率的临时加成（赌骰/节拍）—— 加的是概率，不是第二个乘区
    let critRate = s.crit;
    if(hasRelic("dice"))  critRate += (B.dice || 0) * 5;
    if(hasRelic("tempo") && B.combo >= 3) critRate += 10;
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
    head = "<span class=\"big ok\">" + (B.wager ? "押中了！" : crit ? "暴击！" : "命中！") + "</span>";
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
    // 铁胆：押错不断连击；长链：答错只减半
    if(B.wager && hasRelic("nerve")){ /* 连击保住 */ }
    else if(hasRelic("chain")) B.combo = Math.floor(B.combo / 2);
    else B.combo = 0;
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
      // 受伤也全是加减：怪物伤害 − 护甲，再加上押错/心魔的惩罚
      let dmg = Math.max(1, m.dmg - s.def);   // 背水已经算在 s.def 里
      if(B.wager) dmg += 2;                   // 押错了
      if(wasHaunted) dmg += 1;                // 心魔又答错
      if(B.q.type === "spell" && hasRelic("recite")) dmg = 0;   // 默诵：拼写题答错不掉血
      // 回声：每层第一次答错不掉血
      if(hasRelic("echo") && !G.echoUsed){
        G.echoUsed = true;
        head = "<span class=\"big no\">回声替你挡下了</span>";
        note = "这一层的第一次失手，不掉血。";
      } else {
        if(dmg > 0){ P.hp -= dmg; floatNum("me", "-" + dmg, "ouch"); }
        head = "<span class=\"big no\">" + (B.wager ? "押错了" : "失手") + "</span>";
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
  LEX[word.en] = rec;
  save(LEX_KEY, LEX);

  $("verdict").innerHTML = head +
    "<span class=\"mean\"><b>" + word.en + "</b>　" + word.cn + "　<span style=\"color:var(--faint)\">" + CAT_CN[word.cat] + "</span></span>";
  if(CAN_SPEAK){
    $("btnSpeak").hidden = false;
    $("btnSpeak").textContent = "🔊 " + word.en;
  }
  say((ok ? "答对 " : "答错 ") + word.en + " = " + word.cn, ok ? "good" : "hurt");
  renderBattleBars();
  renderHud();
  saveRun();
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
  $("btnNextQ").hidden = false;
  $("btnNextQ").textContent = "收取战利品";
  $("btnFlee").hidden = true;
  B.won = true;
  renderBattleBars();
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
  if(G.mobs.length === 0) say("这一层清空了。阶梯 ▼ 打开了。", "crit");
  fov();
  // 普通怪不再掉东西（金币已经给过了）；遗物统一由清层/房间给
  G.paused = false;
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
  saveRun();
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
    renderHud(); render(); saveRun();
    return;
  }
  say("你收回手，绕开了石台。", "sys");
  lockInput(200);
  renderHud(); render(); saveRun();
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
  LEX[w.en] = rec; save(LEX_KEY, LEX);
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
    renderHud(); render(); saveRun();
    return;
  }
  say("锁彻底咬死了。这箱子谁也打不开了。", "hurt");
  lockInput(200);
  renderHud(); render(); saveRun();
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
  saveRun();
}
function closeShop(){
  pendingRoom = null;
  $("veilShop").hidden = true;
  G.paused = false;
  lockInput(200);
  renderHud(); render(); saveRun();
}
function removeThing(th){
  if(!th) return;
  const i = G.things.indexOf(th);
  if(i >= 0) G.things.splice(i,1);
}

/* ================= 遗物 =================
   只在这一趟里有效，倒下就没了（P 整个重建）。
   效果一律在 answer() / nextQuestion() 里用 hasRelic() 分支实现。 */
var RELIC_MAX = 10;               // 持有上限 —— 满了必须取舍，这是搭配成立的前提
let pendingSwap = null;           // 等着被换进来的那件

function hasRelic(id){ return !!(P && P.relics && P.relics.indexOf(id) >= 0); }
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
  P.relics.splice(i, 1);
  P.gold += g;
  say("你拆了 " + rc(r) + "，换成 <b>" + g + "</b> 金币。", "sys");
  renderHud(); saveRun();
}
/* ---- 合成：3 件同品质 → 1 件更高品质（随机） ---- */
function fuseRelics(rar){
  rar = +rar;
  if(rar >= 4) return;                                   // 神圣封顶，再合无处去
  const same = P.relics.filter(function(id){ return relicRar(id) === rar; });
  if(same.length < FUSE_N) return;
  const up = relicPool().filter(function(x){ return (x.r || 0) === rar + 1; });
  if(!up.length){ say("更高一档的遗物你已经拿齐了。", "sys"); return; }
  const eat = same.slice(0, FUSE_N);
  eat.forEach(function(id){ P.relics.splice(P.relics.indexOf(id), 1); });
  const got = pick(up);
  P.relics.push(got.id);
  noteRelicFound(got, "合成出");
  say("你把 " + FUSE_N + " 件" + RAR_CN[rar] + "遗物砸在一起 —— " + rc(got) + " 成了。", "crit");
  renderHud(); saveRun();
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
  P.relics.push(r.id);
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
    if(i >= 0) P.relics.splice(i, 1);
    P.relics.push(ps.relic.id);
    noteRelicFound(ps.relic, ps.how);
    say("你放下 " + (old ? old.n : "旧遗物") +
        "，换上了 " + rc(ps.relic) + "。", "crit");
  } else {
    const g = 8 + G.floor * 2;
    P.gold += g;
    say("你没动手上的东西，" + ps.relic.n + " 折成了 <b>" + g + "</b> 金币。", "sys");
  }
  renderHud(); render(); saveRun();
  maybeRelic();
}

/* 跨局图鉴：记首次在第几层拿到、总共拿过几次 */
function noteRelicFound(r, how){
  const book = load(CODEX_KEY, {});
  const first = !book[r.id];
  book[r.id] = {depth: first ? G.floor : book[r.id].depth, times: (first ? 0 : book[r.id].times) + 1};
  save(CODEX_KEY, book);
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
  P.relics.push(id);
  noteRelicFound(r, "你拿起了");
  say("你拿起了 " + rc(r) + " —— " + r.pw + "。", "crit");
  renderHud(); render(); saveRun();
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
  if(!own.length){
    box.innerHTML = "<div class=\"bagempty\">还没有。每清完一层会让你三选一。</div>";
    return;
  }
  // 按品质从高到低排，一眼能看出手里有什么
  own.slice().sort(function(a, b){ return relicRar(b) - relicRar(a); }).forEach(function(id){
    const r = relicById(id);
    if(!r) return;
    const q = r.r || 0;
    const d = document.createElement("div");
    d.className = "relic own";
    d.innerHTML =
      "<div class=\"col\">" +
        "<span class=\"rt q" + q + "\">" + RAR_CN[q] + "</span>" +
        "<span class=\"rn q" + q + "\">" + r.n + "</span>" +
        "<span class=\"rp\">" + r.pw + "</span>" +
      "</div>" +
      "<button type=\"button\" class=\"melt\" data-sell=\"" + id + "\">分解<em>" +
        ((RAR_SELL[q] || 4) + Math.floor((G ? G.floor : 1) / 5)) + " 金</em></button>";
    box.appendChild(d);
  });
  renderFuse();
}
/* 合成面板：每个品质一行，够 3 件就能点 */
function renderFuse(){
  const box = $("fuseList");
  if(!box) return;
  box.innerHTML = "";
  const own = (P && P.relics) || [];
  for(let q = 0; q < 4; q++){
    const n = own.filter(function(id){ return relicRar(id) === q; }).length;
    const can = n >= FUSE_N;
    const d = document.createElement("div");
    d.className = "fuserow" + (can ? " on" : "");
    d.innerHTML =
      "<span class=\"fq q" + q + "\">" + RAR_CN[q] + "</span>" +
      "<span class=\"fn\">× " + n + "</span>" +
      "<span class=\"fa\">→ " + RAR_CN[q+1] + "</span>" +
      "<button type=\"button\" class=\"fuseb\" data-fuse=\"" + q + "\"" +
        (can ? "" : " disabled") + ">" + (can ? "合成" : "还差 " + (FUSE_N - n)) + "</button>";
    box.appendChild(d);
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
function saveTown(){ save(TOWN_KEY, TOWN); }
let SCENE = "town";

/* 地牢那几块和主城面板互斥显示 */
function showScene(){
  const inRun = SCENE === "run";
  /* hudRow / barsRow 现在住在 stageBox 里面（.mapui 浮层），跟着 stage 一起显隐，不用单独管 */
  ["stageBox","log"].forEach(function(id){ $(id).hidden = !inRun; });
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
  clearRun();
  cancelWalk();
  B = null; pendingLoot = null; pendingRoom = null; chestQ = null; reopenShop = null; pendingSwap = null;
  P = { x:0, y:0, lvl:1, xp:0, hp:CHAPTER.playerBase.hp, gold:0, kills:0,
        right:0, wrong:0, seenWords:[],
        relics:[], haunt:[], undying:false };
  G = { floor:0, paused:true, over:true };
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
  newRun();
  refreshSaveState();
}

/* ================= 存档 =================
   分两层：
   - 永久数据（词汇熟练度 / 图鉴 / 探索记录 / 设置）—— 一直都在存，跨局跨趟
   - 续玩档 RUN_KEY —— 只存「这一趟」，死透或通关就删

   续玩档只存地图层面的状态，**不存战斗**：血量和怪的伤口都已经存下了，
   所以中途关页面 == 点「撤退」，玩家侧零新概念，也堵死「打不过就关页面」。 */
var RUN_KEY = "youxu.run.v1", RUN_V = 3;   // v2：地图改成 15×21，旧档行宽对不上，作废
let bootSave = null;      // 开局询问期间暂存的旧档
let booting = false;      // 为真时 saveRun 空转，别把旧档覆掉

function packRow(row, f){ return row.map(f).join(""); }
function saveRun(){
  if(booting) return;
  if(!P || !G || G.over || !G.map) return;
  try{
    save(RUN_KEY, {
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
function clearRun(){ if(booting) return; try{ localStorage.removeItem(RUN_KEY); }catch(e){} }
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
  say("你回到了刚才站的地方。伤口和战果都还在。", "sys");
  lockInput(320);
}
function describeRun(s){
  const mins = Math.max(1, Math.round((Date.now() - (s.t || Date.now())) / 60000));
  const ago = mins < 60 ? (mins + " 分钟前")
            : mins < 1440 ? (Math.round(mins/60) + " 小时前")
            : (Math.round(mins/1440) + " 天前");
  return li("停在", CHAPTER.name + " 第 " + s.floor + " / " + FLOORS + " 层")
       + li("等级 / 生命", "Lv." + s.P.lvl + "　" + Math.max(0, s.P.hp) + " 血")
       + li("这趟答对 / 答错", s.P.right + " / " + s.P.wrong)
       + li("上次游玩", ago);
}

/* ================= 结算 ================= */
function meta(){ return load(META_KEY, {best:0, runs:0, clears:0}); }
function gameOver(){ endRun(false); }
function chapterClear(){ endRun(true); }
function endRun(win){
  G.over = true;
  clearRun();          // 这一趟真的结束了，续玩档没意义了
  const M = meta();
  M.runs++;
  if(G.floor > M.best) M.best = Math.min(G.floor, FLOORS);
  if(win) M.clears++; else M.deaths = (M.deaths || 0) + 1;
  save(META_KEY, M);
  // 装备和背包都留在洞里，只有金币能带回镇上
  const haul = P.gold;
  TOWN.gold += haul;
  saveTown();
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
    const book = load(CODEX_KEY, {});
    $("codexTitle").textContent = "遗物 " + Object.keys(book).length + " / " + RELICS.length;
    RELICS.forEach(function(R){
      const rec = book[R.id], d = document.createElement("div");
      d.className = "cx " + (rec ? "found" : "lost");
      d.innerHTML = rec
        ? "<div class=\"cn\">" + R.n + "<span class=\"meta\">初见第 " + rec.depth + " 层 · 拿过 " + rec.times + " 次</span></div>" +
          "<div class=\"cd\" style=\"color:var(--q" + (R.r||0) + ")\">" + R.pw + "</div>" +
          "<div class=\"cd\" style=\"font-family:var(--flavor);font-style:italic\">" + R.lore + "</div>"
        : "<div class=\"cn\">▨▨ ▨▨<span class=\"meta\">还没拿到过</span></div>" +
          "<div class=\"cd\">它还在某一层的黑暗里。</div>";
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
        d.innerHTML = r
          ? "<div class=\"cn\">" + w.en + "<span class=\"meta stars\">" + "★".repeat(s) + "☆".repeat(5-s) + "</span></div>" +
            "<div class=\"cd\">" + w.cn + (r.wrong ? "　<span style=\"color:var(--blood)\">上次答错</span>" : "") + "</div>"
          : "<div class=\"cn\">▨▨▨<span class=\"meta\">还没遇到</span></div>";
        box.appendChild(d);
      });
    });
  }
  $("veilCodex").hidden = false;
}
function hideAll(){
  ["veilBattle","veilEnd","veilCodex","veilHelp","veilRelic","veilSwap","veilAltar","veilChest","veilShop"].forEach(function(id){ $(id).hidden = true; });
}
function anyVeil(){
  const ids = ["veilBattle","veilEnd","veilCodex","veilHelp","veilRelic","veilSwap","veilAltar","veilChest","veilShop"];
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
    lex: LEX, codex: load(CODEX_KEY, {}), meta: meta()
  }));
}
function applyCode(txt){
  txt = (txt || "").replace(/\s+/g, "");          // 粘贴常带换行，先洗掉
  if(!txt) return "先把码粘进来。";
  if(txt.indexOf(CODE_TAG) !== 0) return "这串码不对 —— 应该以 " + CODE_TAG + " 开头。";
  let o;
  try{ o = JSON.parse(b64dec(txt.slice(CODE_TAG.length))); }
  catch(e){ return "这串码读不出来，多半是复制时漏了一截。"; }
  if(!o || typeof o !== "object" || !o.lex) return "这串码里没有词汇数据。";

  let better = 0;
  for(const k in o.lex){
    const inc = o.lex[k], cur = LEX[k];
    if(!inc || typeof inc !== "object") continue;
    // 取熟练度高的那份；平手就取见得多的
    if(!cur || (inc.str||0) > (cur.str||0) ||
       ((inc.str||0) === (cur.str||0) && (inc.seen||0) > (cur.seen||0))){
      LEX[k] = {str:inc.str||0, seen:inc.seen||0, wrong:inc.wrong||0};
      better++;
    }
  }
  save(LEX_KEY, LEX);

  const book = load(CODEX_KEY, {});
  let legs = 0;
  for(const k in (o.codex || {})){
    const inc = o.codex[k];
    if(!inc) continue;
    if(!book[k]){ book[k] = inc; legs++; }
    else book[k] = {depth: Math.min(book[k].depth, inc.depth),
                    times: Math.max(book[k].times, inc.times)};
  }
  save(CODEX_KEY, book);

  const M = meta(), im = o.meta || {};
  M.best = Math.max(M.best||0, im.best||0);
  M.runs = Math.max(M.runs||0, im.runs||0);
  M.clears = Math.max(M.clears||0, im.clears||0);
  M.deaths = Math.max(M.deaths||0, im.deaths||0);
  save(META_KEY, M);

  renderHud();
  return "导入成功：更新了 " + better + " 个词，补上 " + legs + " 件传说。";
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
    } else if(ev.key === "Escape" && (v.id === "veilCodex" || v.id === "veilHelp")) v.hidden = true;
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
  goTo(+c.dataset.x, +c.dataset.y);
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
  LEX = {};
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
  const s = readRun();
  $("saveState").innerHTML = s
    ? ("洞里的进度会自动保存。当前档：<b>第 " + s.floor + " 层</b>，Lv." + s.P.lvl + "。")
    : "洞里的进度会自动保存。你现在在镇上，没有在进行的探索。";
  $("btnAbandon").disabled = !s;
}
$("btnResume").addEventListener("click", function(){
  const s = bootSave || readRun();
  bootSave = null; booting = false;
  $("veilResume").hidden = true;
  if(s){ SCENE = "run"; showScene(); resumeRun(s); saveRun(); }
  else goTown();
  refreshSaveState();
});
$("btnFresh").addEventListener("click", function(){
  bootSave = null; booting = false;
  $("veilResume").hidden = true;
  goTown();          // 不继续就回镇上，重新从洞窟选
  refreshSaveState();
});
/* ---- 房间：祭坛 / 宝箱 / 游商 ---- */
$("btnAltarPay").addEventListener("click", function(){ resolveAltar(true); });
$("btnAltarSkip").addEventListener("click", function(){ resolveAltar(false); });
$("btnChestDone").addEventListener("click", closeChest);
$("btnChestLeave").addEventListener("click", function(){
  // 还没拼就走：箱子留在原地，以后可以再来
  pendingRoom = null; chestQ = null;
  $("veilChest").hidden = true;
  G.paused = false;
  lockInput(200);
  render(); saveRun();
});
$("btnShopLeave").addEventListener("click", closeShop);
$("shopList").addEventListener("click", function(ev){
  const b = ev.target.closest("button.buy");
  if(b && !b.disabled) buyFrom(+b.dataset.i);
});

/* ---- 押注 ---- */
$("btnWager").addEventListener("click", function(){
  if(!B || B.locked || !B.q) return;
  B.wager = !B.wager;
  this.classList.toggle("on", B.wager);
  this.firstChild.textContent = B.wager ? "已押注 · 双倍赌注" : "押注 · 我确定";
});

/* ---- 遗物页：分解 / 合成 ---- */
$("relicOwned").addEventListener("click", function(ev){
  const b = ev.target.closest("button[data-sell]");
  if(b) sellRelic(b.dataset.sell);
});
$("fuseList").addEventListener("click", function(ev){
  const b = ev.target.closest("button[data-fuse]");
  if(b && !b.disabled) fuseRelics(b.dataset.fuse);
});

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

/* ---- 手机切后台 / 关标签页前补存一次 ----
   iOS Safari 杀后台标签页之前只给这一次机会，没有它前面那些存档时机都白搭 */
window.addEventListener("pagehide", saveRun);
window.addEventListener("visibilitychange", function(){
  if(document.visibilityState === "hidden") saveRun();
});

/* ================= 启动 =================
   有可续的档就先问，别声不响地把人丢回第 3 层 */
(function boot(){
  const s = readRun();
  if(s){
    bootSave = s;
    booting = true;      // 下面 newRun 会跑一遍生成流程，得拦住它的存档
    SCENE = "run"; showScene();
    newRun();            // 先建一局打底，P/G 不能是 undefined
    $("resumeTitle").textContent = CHAPTER.name + " 第 " + s.floor + " 层";
    $("resumeStats").innerHTML = describeRun(s);
    hideAll();
    $("veilResume").hidden = false;
    $("btnResume").focus();
    return;
  }
  goTown();
  if(meta().runs === 0) $("veilHelp").hidden = false;
})();
refreshSaveState();
})();
