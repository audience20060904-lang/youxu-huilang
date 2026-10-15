/* 地牢视觉反馈：只读战斗结果，不参与判定、计时或存档。 */
(function(){
  "use strict";
  const reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const live = new Set(), motions = new Map();
  let anchor = null;
  const $ = id => document.getElementById(id);
  const enabled = () => !(reduce && reduce.matches) && !document.hidden;
  const battleOpen = () => $("veilBattle") && !$("veilBattle").hidden;
  const label = (zh, en) => typeof L === "function" ? L(zh, en) : zh;
  const shapes = {
    slash:'<path d="M13 82 Q37 19 89 15 Q57 40 13 82Z" fill="currentColor"/><path d="M22 85 Q51 43 88 25" fill="none" stroke="#fff8db" stroke-width="2"/>',
    guard:'<path d="M50 7 82 20 79 57 Q73 78 50 93 Q27 78 21 57 L18 20Z" fill="currentColor" fill-opacity=".13" stroke="currentColor" stroke-width="3"/><path d="M35 48 46 59 67 36" fill="none" stroke="#f4ffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
    ring:'<circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" stroke-width="2"/><path d="M50 6V18M50 82V94M6 50H18M82 50H94" stroke="currentColor" stroke-width="3"/>',
    heal:'<path d="M43 24H57V43H76V57H57V76H43V57H24V43H43Z" fill="currentColor"/><circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="2"/>'
  };
  function forget(el){
    const entry = Array.from(live).find(item => item.el === el);
    if(entry){ clearTimeout(entry.timer); live.delete(entry); }
    el.remove();
  }
  function keep(el, ms, kind){
    while(live.size >= 48) forget(live.values().next().value.el);
    const entry = {el:el, kind:kind, timer:setTimeout(() => forget(el), ms)};
    live.add(entry);
    el.addEventListener("animationend", event => { if(event.target === el) forget(el); }, {once:true});
    return el;
  }
  function clear(kind){
    Array.from(live).forEach(item => { if(!kind || item.kind === kind) forget(item.el); });
    motions.forEach((motion, el) => {
      if(!kind || motion.kind === kind){ motion.animation.cancel(); motions.delete(el); }
    });
    if(!kind || kind === "map") anchor = null;
  }
  function motion(el, frames, ms, kind, hold){
    if(!enabled() || !el || !el.animate) return;
    const old = motions.get(el);
    if(old) old.animation.cancel();
    const animation = el.animate(frames, {duration:ms, easing:"cubic-bezier(.2,.7,.25,1)", fill:hold ? "forwards" : "none"});
    motions.set(el, {animation:animation, kind:kind || "battle"});
    const done = () => { if(!hold && motions.get(el)?.animation === animation) motions.delete(el); };
    animation.finished.then(done, done);
  }
  function point(el){
    if(!el || !el.getClientRects().length) return null;
    const r = el.getBoundingClientRect();
    if(!r.width || !r.height) return null;
    return {x:r.left+r.width/2, y:r.top+r.height/2, size:Math.max(r.width,r.height)};
  }
  function stamp(el, type, shape, size){
    if(!enabled() || !battleOpen()) return null;
    const p = point(el);
    if(!p) return null;
    const fx = document.createElement("span");
    fx.className = "dfx dfx-" + type;
    fx.setAttribute("aria-hidden", "true");
    fx.style.left = p.x + "px"; fx.style.top = p.y + "px";
    fx.style.width = fx.style.height = (size || p.size * 1.5) + "px";
    if(shape) fx.innerHTML = '<svg viewBox="0 0 100 100">' + shapes[shape] + '</svg>';
    document.body.appendChild(fx);
    return keep(fx, 950, "battle");
  }
  function text(el, zh, en, type){
    const fx = stamp(el, "text " + type, null, 140);
    if(fx) fx.textContent = label(zh, en);
  }
  function sparks(el, type, n){
    for(let i=0;i<n;i++){
      const fx = stamp(el, "spark " + type, null, 5);
      if(!fx) break;
      const angle = i * Math.PI * 2 / n + .3;
      const reach = type === "slain" ? 42 : 27;
      fx.style.setProperty("--dx", Math.cos(angle)*reach + "px");
      fx.style.setProperty("--dy", Math.sin(angle)*reach + "px");
      fx.style.setProperty("--turn", Math.round(angle*180/Math.PI) + "deg");
    }
  }
  function incoming(){
    motion($("foeArt"), [{transform:"translateY(0)"},{transform:"translateY(8px) scale(1.05)",offset:.3},{transform:"translateY(0)"}], 280);
  }
  const api = {
    resetBattle:() => clear("battle"),
    attack:function(crit){
      if(!enabled() || !battleOpen()) return;
      motion($("meArt"), [{transform:"translateY(0)"},{transform:"translateY(-9px) rotate(-7deg)",offset:.25},{transform:"translateY(0)"}], 320);
      motion($("foeArt"), [{transform:"translateX(0)",filter:"brightness(1)"},{transform:"translateX(6px) rotate(5deg)",filter:"brightness(1.9)",offset:.25},{transform:"translateX(-3px)",offset:.5},{transform:"translateX(0)",filter:"brightness(1)"}], 360);
      stamp($("foeArt"), crit ? "slash critical" : "slash", "slash");
      sparks($("foeArt"), crit ? "critical" : "hit", crit ? 9 : 5);
      if(crit){ stamp($("foeArt"), "slash cross", "slash"); text($("foeArt"), "暴击", "CRITICAL", "critical"); }
    },
    hurt:function(hp, shield){
      if(!enabled() || !battleOpen()) return;
      incoming();
      if(shield > 0) api.block(false, true);
      if(hp > 0){
        motion($("meArt"), [{transform:"translateX(0)"},{transform:"translateX(-7px) rotate(-8deg)",offset:.25},{transform:"translateX(4px)",offset:.5},{transform:"translateX(0)"}], 360);
        stamp($("meArt"), "hurt", "ring");
        sparks($("meArt"), "hurt", 5);
      }
    },
    block:function(lunge, shield){
      if(!enabled() || !battleOpen()) return;
      if(lunge !== false) incoming();
      stamp($("meArt"), "guard", "guard");
      text($("meArt"), shield ? "护盾格挡" : "格挡", shield ? "SHIELD" : "BLOCK", "guard");
    },
    dodge:function(){
      if(!enabled() || !battleOpen()) return;
      incoming();
      const el = $("meArt"), ghost = stamp(el, "ghost", null);
      if(ghost && el){ ghost.innerHTML = el.innerHTML; ghost.className += " " + el.className; }
      motion(el, [{transform:"translateX(0)",opacity:1},{transform:"translateX(17px) rotate(9deg)",opacity:.45,offset:.3},{transform:"translateX(0)",opacity:1}], 460);
      text(el, "闪避", "DODGE", "evade");
    },
    kill:function(){
      if(!enabled() || !battleOpen()) return;
      stamp($("foeArt"), "slain", "ring");
      sparks($("foeArt"), "slain", 12);
      text($("foeArt"), "击破", "DEFEATED", "slain");
      motion($("foeArt"), [{opacity:1,transform:"scale(1)"},{opacity:1,transform:"scale(1.08)",offset:.2},{opacity:0,transform:"scale(.65) translateY(-12px)"}], 650, "battle", true);
    },
    mapKill:function(map, cell){
      if(!enabled() || !map || !cell || !cell.offsetWidth) return;
      const fx = document.createElement("span");
      fx.className = "map-burst";
      fx.setAttribute("aria-hidden", "true");
      fx.innerHTML = '<svg viewBox="0 0 100 100">' + shapes.ring + '</svg>';
      fx.style.left = cell.offsetLeft + cell.offsetWidth/2 + "px";
      fx.style.top = cell.offsetTop + cell.offsetHeight/2 + "px";
      fx.style.width = fx.style.height = cell.offsetWidth*2 + "px";
      map.appendChild(fx); keep(fx,750,"map");
    },
    combo:function(n, milestone){
      if(!enabled() || !battleOpen()) return;
      const c = $("combo");
      motion(c, [{filter:"brightness(1)"},{filter:"brightness(1.4)",offset:.25},{filter:"brightness(1)"}], 420);
      if(milestone){ sparks(c,"critical",8); text(c, n + " 连击", n + " COMBO", "critical combo-burst"); }
    },
    heal:function(){ stamp($("meArt"), "heal", "heal"); },
    move:function(map, cells, width, world, x, y, svg, cls){
      const previous = anchor;
      anchor = {map:map, world:world, x:x, y:y};
      if(!enabled() || !map || !previous || previous.map !== map || previous.world !== world){
        Array.from(live).forEach(item => { if(item.kind === "map") forget(item.el); });
        return;
      }
      if(Math.abs(x-previous.x)+Math.abs(y-previous.y) !== 1) return;
      const from = cells[previous.y*width+previous.x], to = cells[y*width+x];
      if(!from || !to || !to.offsetWidth) return;
      // 直接挂在地图上，格子重绘不会擦掉；相机平移时残影留在原来的路上。
      for(let i=0;i<3;i++){
        const trail = document.createElement("span"), t = i/3;
        trail.className = "move-trail" + cls;
        trail.setAttribute("aria-hidden", "true");
        trail.innerHTML = svg;
        trail.style.left = (from.offsetLeft+(to.offsetLeft-from.offsetLeft)*t) + "px";
        trail.style.top = (from.offsetTop+(to.offsetTop-from.offsetTop)*t) + "px";
        trail.style.width = from.offsetWidth + "px"; trail.style.height = from.offsetHeight + "px";
        trail.style.setProperty("--trail-alpha", .14+i*.09);
        map.appendChild(trail); keep(trail, 500, "map");
      }
      const trails = Array.from(live).filter(item => item.kind === "map");
      trails.slice(0,Math.max(0,trails.length-12)).forEach(item => forget(item.el));
      motion(to, [{transform:"translateY(0)"},{transform:"translateY(-2px)",offset:.4},{transform:"translateY(0)"}], 170, "map");
    }
  };
  if(reduce){
    const changed = () => { if(reduce.matches) clear(); };
    if(reduce.addEventListener) reduce.addEventListener("change", changed);
    else if(reduce.addListener) reduce.addListener(changed);
  }
  document.addEventListener("visibilitychange", () => { if(document.hidden) clear(); });
  window.addEventListener("pagehide", () => clear());
  const veil = $("veilBattle");
  if(veil && window.MutationObserver) new MutationObserver(() => { if(veil.hidden) clear("battle"); }).observe(veil, {attributes:true, attributeFilter:["hidden"]});
  window.DungeonFX = api;
})();
