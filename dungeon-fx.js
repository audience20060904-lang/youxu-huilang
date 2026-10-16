/* 地牢视觉反馈：只读战斗结果，不参与判定、计时或存档。 */
(function(){
  "use strict";
  const reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const live = new Set(), motions = new Map();
  const trailPool=[];
  const scheduled=new Set(),responses=new Set();let round=0,responseEpoch=0,roundText=null,roundBar=null;
  let anchor = null;
  const skillAt=new Map();
  const $ = id => document.getElementById(id);
  const enabled = () => !(reduce && reduce.matches) && !document.hidden;
  const mobile=window.matchMedia?window.matchMedia('(max-width:600px), (pointer:coarse)'):null;
  const light=()=>!!(mobile&&mobile.matches);
  function later(fn,ms,response){const bucket=response?responses:scheduled,token=response?responseEpoch:round;const id=setTimeout(()=>{bucket.delete(id);if(token===(response?responseEpoch:round))fn();},ms);bucket.add(id);return id;}
  function restoreBar(){
    if(!roundBar)return;
    const bar=roundBar;roundBar=null;
    const active=motions.get(bar.el);if(active){active.animation.cancel();motions.delete(bar.el);}
    bar.el.style.width=bar.width;
  }
  function resetRound(){restoreBar();round++;responseEpoch++;for(const bucket of [scheduled,responses]){for(const id of bucket)clearTimeout(id);bucket.clear();}if(roundText!==null&&$("foeTxt"))$("foeTxt").textContent=roundText;roundText=null;clear("battle");}
  const battleOpen = () => $("veilBattle") && !$("veilBattle").hidden;
  const label = (zh, en) => typeof L === "function" ? L(zh, en) : zh;
  const shapes = {
    compass:'<path d="M50 5 61 39 95 50 61 61 50 95 39 61 5 50 39 39Z" fill="currentColor" fill-opacity=".3" stroke="currentColor" stroke-width="2"/><circle cx="50" cy="50" r="30" fill="none" stroke="currentColor"/>',
    glyph:'<path d="M20 20H80V80H20ZM30 30 70 70M70 30 30 70M50 12V88" fill="none" stroke="currentColor" stroke-width="3"/>',
    leaf:'<path d="M19 76Q15 16 83 15Q82 77 19 76Z" fill="currentColor" fill-opacity=".2" stroke="currentColor" stroke-width="3"/><path d="m15 85 51-53M36 65l-3-23M50 51l22 3" stroke="currentColor" stroke-width="3" fill="none"/>',
    book:'<path d="M12 22Q31 16 50 30Q69 16 88 22V78Q68 70 50 82Q32 70 12 78ZM50 30V82M24 35l16 5M24 48l16 5M62 40l14-5M62 53l14-5" fill="none" stroke="currentColor" stroke-width="3"/>',
    flame:'<path d="M52 5Q76 38 65 45Q84 34 84 61Q81 94 49 93Q12 88 18 55Q32 56 36 29Q40 52 49 55Q42 30 52 5Z" fill="currentColor" fill-opacity=".35" stroke="currentColor" stroke-width="2"/>',
    star:'<path d="m50 9 10 28 30 1-24 18 8 29-24-17-24 17 8-29-24-18 30-1Z" fill="currentColor" fill-opacity=".2" stroke="currentColor" stroke-width="3"/><circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-dasharray="3 8"/>',
    note:'<path d="M35 65V22L78 13V57M35 32 78 23" fill="none" stroke="currentColor" stroke-width="5"/><ellipse cx="24" cy="70" rx="13" ry="9" transform="rotate(-20 24 70)" fill="currentColor"/><ellipse cx="67" cy="62" rx="13" ry="9" transform="rotate(-20 67 62)" fill="currentColor"/>',
    clock:'<circle cx="50" cy="50" r="37" fill="none" stroke="currentColor" stroke-width="3"/><path d="M50 23V50L29 63M7 19v20h20M93 81V61H73" fill="none" stroke="currentColor" stroke-width="4"/><path d="M13 34Q26 4 59 10M87 66Q74 96 41 90" fill="none" stroke="currentColor" stroke-width="3"/>',
    spirit:'<path d="M23 80V43Q23 12 50 12Q77 12 77 43V80L64 70 50 84 36 70Z" fill="currentColor" fill-opacity=".25" stroke="currentColor" stroke-width="3"/><path d="M37 40v12M63 40v12" stroke="currentColor" stroke-width="6"/>',
    target:'<circle cx="50" cy="50" r="28" fill="none" stroke="currentColor" stroke-width="3"/><path d="M50 5V35M50 65V95M5 50H35M65 50H95" stroke="currentColor" stroke-width="4"/>',
    hammer:'<path d="m25 12 54 21-12 27-54-22ZM47 49 33 88 45 92 61 55" fill="currentColor" fill-opacity=".3" stroke="currentColor" stroke-width="3"/>',
    coin:'<circle cx="50" cy="50" r="36" fill="currentColor" fill-opacity=".2" stroke="currentColor" stroke-width="3"/><path d="m50 23 18 27-18 27-18-27Z" fill="none" stroke="currentColor" stroke-width="3"/>',
    claw:'<path d="M23 8Q20 49 9 85Q38 62 41 24M49 7Q47 46 35 88Q65 62 67 23M76 10Q75 49 64 89Q91 65 93 28" fill="currentColor"/>',
    wave:'<path d="M16 45Q50 8 84 45M9 61Q50 19 91 61M6 80Q50 35 94 80" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>',
    question:'<path d="M29 28Q30 10 51 10Q77 11 74 33Q73 45 54 50V66" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><circle cx="54" cy="83" r="4" fill="currentColor"/>',
    slash:'<path d="M13 82 Q37 19 89 15 Q57 40 13 82Z" fill="currentColor"/><path d="M22 85 Q51 43 88 25" fill="none" stroke="#fff8db" stroke-width="2"/>',
    guard:'<path d="M50 7 82 20 79 57 Q73 78 50 93 Q27 78 21 57 L18 20Z" fill="currentColor" fill-opacity=".13" stroke="currentColor" stroke-width="3"/><path d="M35 48 46 59 67 36" fill="none" stroke="#f4ffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
    ring:'<circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" stroke-width="2"/><path d="M50 6V18M50 82V94M6 50H18M82 50H94" stroke="currentColor" stroke-width="3"/>',
    heal:'<path d="M43 24H57V43H76V57H57V76H43V57H24V43H43Z" fill="currentColor"/><circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="2"/>'
  };
  const signatures={adv:['compass','#c9aa68'],clerk:['glyph','#80b8cc'],duelist:['slash','#e3b179'],hermit:['ring','#8fb5a1'],pioneer:['compass','#a0bd80'],keeper:['flame','#f1c26e'],exorcist:['glyph','#a0d9d0'],rogue:['target','#e09182'],reader:['book','#e2cb90'],naturalist:['leaf','#9fc878'],poet:['glyph','#c8a6dc'],bard:['note','#a9c4dc'],clock:['clock','#d2bf88'],examiner:['question','#a4c6cc'],heir:['flame','#edbe77'],mage:['flame','#ef9870'],astro:['star','#b5b6ed'],smith:['hammer','#e6af78'],necro:['spirit','#9ac6bf'],bounty:['target','#d4b16d'],medium:['spirit','#c6aedc'],apothecary:['heal','#a9d8a0'],debater:['question','#bfd3dc'],mentor:['book','#d9c398'],merchant:['coin','#ebc96f'],tamer:['claw','#d9bb91'],warcrier:['wave','#ecb68d'],collector:['star','#c3afe0'],rewinder:['clock','#98d3d5'],saint:['slash','#f1dba7']};
  function forget(el){
    const entry = Array.from(live).find(item => item.el === el);
    if(entry){ clearTimeout(entry.timer); live.delete(entry); }
    const active=motions.get(el);
    if(active){active.animation.cancel();motions.delete(el);}
    el.remove();
    if(el._moveTrail && trailPool.length<15)trailPool.push(el);
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
    if(!kind || kind === "map"){anchor = null;trailPool.length=0;}
  }
  function motion(el, frames, ms, kind, hold, easing){
    if(!enabled() || !el || !el.animate) return;
    const old = motions.get(el);
    if(old) old.animation.cancel();
    const animation = el.animate(frames, {duration:ms, easing:easing||"cubic-bezier(.2,.7,.25,1)", fill:hold ? "forwards" : "none"});
    motions.set(el, {animation:animation, kind:kind || "battle"});
    const done = () => { if(!hold && motions.get(el)?.animation === animation) motions.delete(el); };
    animation.finished.then(done, done);
  }
  function effectSpace(){
    const host=$("battleEffects");if(!host)return null;
    const r=host.getBoundingClientRect(),w=host.clientWidth||r.width,h=host.clientHeight||r.height;
    return {host:host,x:r.left,y:r.top,width:w,height:h,sx:r.width/w||1,sy:r.height/h||1};
  }
  function actor(el){return el&&el.querySelector?(el.querySelector(':scope > svg')||el):el;}
  function point(el,space){
    if(!el || !el.getClientRects().length) return null;
    const r = el.getBoundingClientRect();
    if(!r.width || !r.height) return null;
    return {x:(r.left+r.width/2-(space?space.x:0))/(space?space.sx:1), y:(r.top+r.height/2-(space?space.y:0))/(space?space.sy:1), size:Math.max(r.width/(space?space.sx:1),r.height/(space?space.sy:1)),space:space};
  }
  function stamp(el, type, shape, size, position, lifetime){
    if(!enabled() || !battleOpen()) return null;
    const p = position || point(el,effectSpace());
    if(!p) return null;
    const fx = document.createElement("span");
    fx.className = "dfx dfx-" + type;
    fx.setAttribute("aria-hidden", "true");
    fx.style.left = p.x + "px"; fx.style.top = p.y + "px";
    fx.style.width = fx.style.height = (size || p.size * 1.5) + "px";
    if(shape) fx.innerHTML = '<svg viewBox="0 0 100 100">' + shapes[shape] + '</svg>';
    keep(fx,lifetime||950,"battle");(p.space?p.space.host:document.body).appendChild(fx);
    return fx;
  }
  function text(el, zh, en, type, position){
    const fx = stamp(el, "text " + type, null, 140, position);
    if(fx) fx.textContent = label(zh, en);
    return fx;
  }
  function sparks(el, type, n, at){
    if(light())n=Math.min(n,2);
    // 粒子共享同一次布局读取，避免每追加一颗都强制重新计算页面。
    const position=at||point(el,effectSpace());if(!position)return;
    for(let i=0;i<n;i++){
      const fx = stamp(el, "spark " + type, null, 5, position);
      if(!fx) break;
      const angle = i * Math.PI * 2 / n + .3;
      const reach = type === "slain" ? 42 : 27;
      fx.style.setProperty("--dx", Math.cos(angle)*reach + "px");
      fx.style.setProperty("--dy", Math.sin(angle)*reach + "px");
      fx.style.setProperty("--turn", Math.round(angle*180/Math.PI) + "deg");
    }
  }
  const casters=new Set(['clerk','reader','naturalist','poet','bard','clock','examiner','mage','astro','necro','medium','apothecary','mentor','collector','rewinder','exorcist']);
  function strike(from,to,color,origin,target,shape){
    const space=origin?origin.space:effectSpace(),a=origin||point(from,space),b=target||point(to,space);if(!a||!b)return;
    const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1,reach=Math.min(!shape||shape==='slash'||shape==='claw'?32:10,length*.28),ux=dx/length,uy=dy/length;
    motion(actor(from),[{transform:'translate(0,0) scale(1)'},{transform:'translate('+(-ux*3)+'px,'+(-uy*3)+'px) scale(.96)',offset:.14},
      {transform:'translate('+(ux*reach)+'px,'+(uy*reach)+'px) rotate('+(dy<0?-6:6)+'deg) scale(1.04)',offset:.4},{transform:'translate(0,0) scale(1)'}],220);
    const bolt=stamp(from,'bolt',shape||'slash',shape&&shape!=='slash'?27:22,a,180);
    if(bolt){
      bolt.style.color=color;
      const rotate=shape&&shape!=='slash'?'':' rotate('+(Math.atan2(dy,dx)*180/Math.PI+45)+'deg)';
      motion(bolt,[{transform:'translate(-50%,-50%)'+rotate+' scale(.65)',opacity:.2},
        {transform:'translate(calc(-50% + '+dx+'px),calc(-50% + '+dy+'px))'+rotate+' scale(1)',opacity:1,offset:.94},{transform:'translate(calc(-50% + '+dx+'px),calc(-50% + '+dy+'px))'+rotate+' scale(1)',opacity:0}],90,'battle',true,'linear');
    }
  }
  function incoming(impact){
    const space=effectSpace(),target=point($("meArt"),space),origin=point($("foeArt"),space);
    strike($("foeArt"),$("meArt"),'#d59b82',origin,target);
    if(impact)later(()=>{if(battleOpen())impact(target);},90,true);
  }
  function guardImpact(shield,target){
    motion(actor($("meArt")),[{transform:'translate(0,0) scale(1)'},{transform:'translate(-2px,3px) scale(.97)',offset:.25},{transform:'translate(0,0) scale(1)'}],220);
    stamp($("meArt"),'guard','guard',null,target);
    text($("meArt"),shield?'护盾格挡':'格挡',shield?'SHIELD':'BLOCK','guard',target);
  }
  const api = {
    resetBattle:() => {resetRound();skillAt.clear();},
    resetRound:resetRound,
    playRound:function(hits,health){
      if(!enabled()||!battleOpen()||!hits.length)return 0;
      restoreBar();round++;for(const id of scheduled)clearTimeout(id);scheduled.clear();
      const txt=$("foeTxt"),fill=$("foeFill"),gap=hits.length>15?Math.max(20,Math.floor(1200/(hits.length-1))):hits.length>8?85:150;
      // Freeze geometry once before inserting effects; animated SVG children do not move their anchors.
      const space=effectSpace(),foe=$("foeArt"),target=point(foe,space),positions=new Map();
      const attacks=hits.map(hit=>{
        const pet=hit.kind==='pet'?document.querySelector('.battle-pet'):null;
        const source=hit.kind==='soul'?($("battleSoul"+(hit.index||0))||$("meArt")):pet||$("meArt");
        if(!positions.has(source))positions.set(source,point(source,space));
        return {hit:hit,source:source,origin:positions.get(source)};
      });
      roundText=txt&&!health.study?txt.textContent:null;let remaining=health.hp,critShown=false;
      if(txt&&!health.study)txt.textContent=Math.max(0,remaining)+' / '+health.max;
      if(fill&&!health.study&&health.max>0){roundBar={el:fill,width:fill.style.width};fill.style.width='100%';
        motion(fill,[{transform:'scaleX('+Math.min(1,Math.max(0,remaining/health.max))+')'},{transform:'scaleX('+Math.min(1,Math.max(0,remaining/health.max))+')'}],1,'battle',true);}
      attacks.forEach(({hit,source,origin},i)=>{
        const start=i*gap,sig=signatures[hit.hero]||signatures.adv;
        const shape=hit.kind==='soul'?'spirit':hit.kind==='pet'?'claw':hit.kind==='dot'?'ring':casters.has(hit.hero)?sig[0]:'slash';
        later(()=>{
          if(hit.kind!=='dot')strike(source,foe,sig[1],origin,target,shape);
          later(()=>{
            const force=hit.crit?6:3,tilt=i%2?-4:4;
            motion(actor(foe),hit.kind==='dot'?[{opacity:1},{opacity:.7,offset:.4},{opacity:1}]:
              [{transform:'translate(0,0) scale(1)',opacity:1},{transform:'translate('+force+'px,-'+force+'px) rotate('+tilt+'deg) scale(.95)',opacity:.75,offset:.25},{transform:'translate(0,0) scale(1)',opacity:1}],hit.crit?210:150);
            const effect=stamp(foe,'skill round-hit '+hit.kind+(hit.crit?' critical':''),shape,hit.crit?62:44,target,300);
            if(effect){effect.style.color=sig[1];effect.style.setProperty('--cut-turn',(i%2?20:-20)+'deg');}
            const pos=target?Object.assign({},target,{x:target.x+((i%3)-1)*13,y:target.y-12-(i%2)*8}):null;
            const number=text(foe,'-'+hit.damage,'-'+hit.damage,'round-number'+(hit.crit?' critical':''),pos);
            if(number)number.style.setProperty('--number-ms',Math.max(160,Math.min(430,gap*3))+'ms');
            if(hit.crit&&!critShown){critShown=true;text(foe,'暴击','CRITICAL','critical',target);sparks(foe,'critical',light()?2:4,target);}
            const from=Math.max(0,remaining);remaining-=hit.damage;
            const to=Math.max(0,i===hits.length-1&&Number.isFinite(health.end)?health.end:remaining);
            if(!health.study&&fill&&health.max>0)motion(fill,[{transform:'scaleX('+Math.min(1,from/health.max)+')'},{transform:'scaleX('+Math.min(1,to/health.max)+')'}],100,'battle',true,'ease-out');
            if(txt&&!health.study)txt.textContent=to+' / '+health.max;
            if(i===hits.length-1&&txt&&roundText!==null)txt.textContent=roundText;
          },90);
        },start);
      });
      later(restoreBar,(hits.length-1)*gap+190);
      return (hits.length-1)*gap+250;
    },
    skill:function(hero,kind){
      if(!enabled() || !battleOpen())return;
      const key=hero+':'+kind,now=Date.now(),last=skillAt.get(key)||0;if(now-last<160)return;skillAt.set(key,now);
      let sig=signatures[hero]||signatures.adv;
      if(kind==='frost')sig=['guard','#a0d9ed'];else if(kind==='renew')sig=['heal','#a2d9a0'];else if(kind==='meteor')sig=['star','#ec9c70'];
      const offense=['strike','pet','forge','coin','fire','meteor'].includes(kind);
      const target=offense?$("foeArt"):$("meArt"),space=effectSpace(),at=point(target,space),fx=stamp(target,"skill skill-"+hero+" "+(kind==='pet'?'pet-strike':''),sig[0],offense?76:60,at);
      if(fx)fx.style.color=sig[1];
      if(kind==='pet'){
        const pet=document.querySelector('.battle-pet');
        strike(pet,$("foeArt"),'#d9bb91',point(pet,space),at,'claw');
      }
    },
    attack:function(crit){
      if(!enabled() || !battleOpen()) return;
      const space=effectSpace(),target=point($("foeArt"),space),origin=point($("meArt"),space);
      strike($("meArt"),$("foeArt"),crit?"#ffe0a0":"#d1d9bc",origin,target);
      motion(actor($("foeArt")), [{transform:"translateX(0)",opacity:1},{transform:"translateX(6px) rotate(5deg)",opacity:.6,offset:.25},{transform:"translateX(-3px)",offset:.5},{transform:"translateX(0)",opacity:1}], 360);
      stamp($("foeArt"), crit ? "slash critical" : "slash", "slash",null,target);
      sparks($("foeArt"), crit ? "critical" : "hit", crit ? 9 : 5,target);
      if(crit){ stamp($("foeArt"), "slash cross", "slash",null,target); text($("foeArt"), "暴击", "CRITICAL", "critical",target); }
    },
    hurt:function(hp,shield){
      if(!enabled()||!battleOpen())return;
      incoming(target=>{
        if(shield>0)guardImpact(true,target);
        if(hp>0){
          motion(actor($("meArt")),[{transform:'translate(0,0)'},{transform:'translate(-4px,7px) rotate(-6deg) scale(.96)',offset:.25},{transform:'translate(1px,-1px)',offset:.6},{transform:'translate(0,0)'}],300);
          stamp($("meArt"),'hurt','ring',null,target);sparks($("meArt"),'hurt',light()?2:4,target);
        }
      });
    },
    block:function(lunge,shield){
      if(!enabled()||!battleOpen())return;
      if(lunge!==false)incoming(target=>guardImpact(shield,target));
      else guardImpact(shield,point($("meArt"),effectSpace()));
    },
    dodge:function(){
      if(!enabled()||!battleOpen())return;
      const el=$("meArt"),space=effectSpace(),target=point(el,space),origin=point($("foeArt"),space);
      strike($("foeArt"),el,'#d59b82',origin,target);
      const ghost=stamp(el,'ghost',null,target?target.size:null,target),visual=actor(el);
      if(ghost&&visual){ghost.innerHTML=visual.outerHTML||visual.innerHTML;ghost.style.color='#b5d2df';}
      motion(visual,[{transform:'translateX(0)',opacity:1},{transform:'translateX(20px) rotate(8deg)',opacity:.55,offset:.25},{transform:'translateX(20px)',opacity:1,offset:.6},{transform:'translateX(0)',opacity:1}],330);
      later(()=>text(el,'闪避','DODGE','evade',target),90,true);
    },
    kill:function(){
      if(!enabled()||!battleOpen())return;
      const foe=$("foeArt"),target=point(foe,effectSpace());
      stamp(foe,'slain','ring',null,target);sparks(foe,'slain',light()?2:7,target);text(foe,'击破','DEFEATED','slain',target);
      motion(actor(foe),[{opacity:1,transform:'scale(1)'},{opacity:1,transform:'scale(.95)',offset:.12},{opacity:.85,transform:'scale(1.08)',offset:.3},{opacity:0,transform:'scale(.7) translateY(-12px)'}],650,'battle',true);
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
      motion(c,[{transform:"scale(1)"},{transform:"scale(1.13)",offset:.25},{transform:"scale(1)"}],240);
      if(milestone){ sparks($("meArt"),"critical",8); stamp($("meArt"),"skill combo-burst","star",70); }
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
      if(!from || !to) return;
      const size=map._cellSize||to.offsetWidth;if(!size)return;
      const x0=map._cellSize?previous.x*size:from.offsetLeft,y0=map._cellSize?previous.y*size:from.offsetTop;
      const x1=map._cellSize?x*size:to.offsetLeft,y1=map._cellSize?y*size:to.offsetTop;
      const visual=svg;
      // 直接挂在地图上，格子重绘不会擦掉；相机平移时残影留在原来的路上。
      for(let i=0;i<3;i++){
        const trail = trailPool.pop()||document.createElement("span"), t = i/3;
        trail._moveTrail=true;
        if(trail.className!=="move-trail"+cls)trail.className="move-trail"+cls;
        if(!trail._decorative){trail.setAttribute("aria-hidden", "true");trail._decorative=true;}
        if(trail._art!==visual){trail.innerHTML = visual;trail._art=visual;}
        trail.style.left = (x0+(x1-x0)*t) + "px";
        trail.style.top = (y0+(y1-y0)*t) + "px";
        if(trail._size!==size){trail.style.width=trail.style.height=size+"px";trail._size=size;}
        map.appendChild(trail); keep(trail, 500, "map");
        // 复用节点时显式重启淡出，不通过 offsetWidth 强制重排来重启 CSS 动画。
        motion(trail,[{opacity:.14+i*.09,transform:"scale(.92)"},{opacity:0,transform:"scale(.6)"}],420,"map",true,"ease-out");
      }
      const trails = Array.from(live).filter(item => item.kind === "map");
      trails.slice(0,Math.max(0,trails.length-12)).forEach(item => forget(item.el));
      // 人物由独立的 map-pawn 平滑移动；格子本身不位移。
    }
  };
  if(reduce){
    const changed = () => { if(reduce.matches){resetRound();clear();} };
    if(reduce.addEventListener) reduce.addEventListener("change", changed);
    else if(reduce.addListener) reduce.addListener(changed);
  }
  document.addEventListener("visibilitychange", () => { if(document.hidden){resetRound();clear();} });
  window.addEventListener("pagehide", () => {resetRound();clear();});
  const veil = $("veilBattle");
  if(veil && window.MutationObserver) new MutationObserver(() => { if(veil.hidden) resetRound(); }).observe(veil, {attributes:true, attributeFilter:["hidden"]});
  window.DungeonFX = api;
})();
