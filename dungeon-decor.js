/* Native vector scenery and deterministic placement. Decoration never changes collision. */
var DungeonDecor=(function(){
  'use strict';
  const shadow='<ellipse cx="32" cy="57" rx="23" ry="5" fill="#161b18" opacity=".24"/>';
  const svg=(body,flat)=>'<svg viewBox="0 0 64 64" aria-hidden="true">'+(flat?'':shadow)+'<g stroke="#403c32" stroke-width="1.5" stroke-linejoin="round">'+body+'</g></svg>';
  const art={
    rack:svg('<path d="M12 55V14h6v41m29 0V14h5v41M13 20h39" fill="#735238"/><path d="m22 13 3 31 4 5 3-5-5-31Z" fill="#b5c2b6"/><path d="m38 13-4 31 3 5 4-4 3-32Z" fill="#c9c7ad"/><path d="m20 39 13-2m-1 2 13 1" stroke="#b89550" stroke-width="4"/><path d="M9 56h47" stroke="#b6a17b" stroke-width="3"/>'),
    crate:svg('<path d="m10 22 32-8 13 11v29l-32 7-13-10Z" fill="#775337"/><path d="m10 22 13 11 32-8M23 33v28" fill="none" stroke="#d7b179"/><path d="m26 38 25-6v18l-25 6Z" fill="#ac7b4b"/><path d="m29 38 19 12m0-16L29 54M13 29l7 7v17l-7-6Z" fill="none" stroke="#deb885" stroke-width="3"/><path d="m15 22 27-6 7 6-26 7Z" fill="#c59961"/>'),
    barrel:svg('<ellipse cx="32" cy="16" rx="17" ry="7" fill="#ccac78"/><path d="M15 16q-9 22 0 38 17 12 34 0 9-22 0-38Z" fill="#93673f"/><ellipse cx="32" cy="16" rx="17" ry="7" fill="#b98a55"/><path d="M20 21q-4 20 0 33m11-31v35m12-37q4 20 0 33" fill="none" stroke="#dbaf71"/><path d="M14 27q18 8 36 0m-37 17q19 8 38 0" fill="none" stroke="#66756d" stroke-width="5"/>'),
    banner:svg('<path d="M12 10h40" stroke="#b69c67" stroke-width="4"/><path d="M19 11h26v42l-8-6-6 11-12-9Z" fill="#8e554d"/><path d="M23 14h17v28l-9 7-8-5Z" fill="#b3715a"/><path d="m31 21 6 8-6 8-6-8Z" fill="#d8b981"/><path d="m18 54 4-7m18 3 3-8" stroke="#d4c5a3"/>'),
    statue:svg('<path d="M15 56h35l-5-9H20Z" fill="#686f63"/><path d="M21 47V26l11-9 12 9v21Z" fill="#8d9780"/><path d="m21 28-7 17 10-2m19-15 7 17-10-2" fill="#a1ab8e"/><circle cx="32" cy="14" r="9" fill="#a6af98"/><path d="M27 15h3m4 0h3m-7 6 6 16-6 10" stroke="#64705f" fill="none"/><path d="M17 52h30" stroke="#c4ccb2"/>'),
    candles:svg('<path d="M17 56h30l-6-6H23Zm14-7V28" fill="#75674a" stroke="#a49265" stroke-width="4"/><path d="M19 28v14q13 8 26 0V28" fill="none" stroke="#b09a65" stroke-width="3"/><path d="M15 15h8v20h-8Zm13-8h8v23h-8Zm13 9h8v19h-8Z" fill="#ebdcb5"/><path d="m19 3-4 9q4 7 8 0Zm13-3-4 7q4 6 8 0Zm13 3-4 10q4 7 8 0Z" fill="#e9ac4d" stroke="#f3d685"/><path d="M17 18v10m13-17v12m13-3v9" stroke="#fff6d8"/>'),
    eggs:svg('<path d="M9 52q23-22 47 1l-8 7H17Z" fill="#667457"/><ellipse cx="21" cy="40" rx="12" ry="17" fill="#a4ae7b"/><ellipse cx="41" cy="31" rx="14" ry="21" fill="#b8bf8f"/><path d="m38 15-4 9 6 7-8 9m-16-8 6 9-4 8" fill="none" stroke="#738355" stroke-width="2"/><path d="M45 18q6 7 4 14M15 34l-1 6" fill="none" stroke="#e3e8b8" stroke-width="3"/>'),
    web:svg('<path d="M5 4 57 7 54 55ZM5 4l33 34m-2-32 2 32 18-9M20 5q3 21 35 42M7 19q20-5 48-2M9 34q26-11 46 0" fill="none" stroke="#b8c3af" stroke-width="1.2" opacity=".65"/>',true),
    chains:svg('<path d="M15 6v8m0 8v9m0 8v9m33-43v10m0 8v10m0 8v12" fill="none" stroke="#899087" stroke-width="4"/><g fill="none" stroke="#a8afa0" stroke-width="3"><ellipse cx="15" cy="17" rx="5" ry="7"/><ellipse cx="15" cy="35" rx="5" ry="7"/><ellipse cx="15" cy="52" rx="5" ry="7"/><ellipse cx="48" cy="19" rx="5" ry="7"/><ellipse cx="48" cy="37" rx="5" ry="7"/></g>'),
    cage:svg('<path d="M11 55V21Q32-5 53 21v34Z" fill="#3d4a47"/><path d="M11 21h42M11 53h42M20 16v37m12-42v42m12-37v37" stroke="#a2a58b" stroke-width="3" fill="none"/><path d="M7 56h50v5H7Z" fill="#747f70"/><path d="M27 31h10v13H27Z" fill="#c0a465"/><circle cx="32" cy="36" r="2" fill="#594d36"/>'),
    forge:svg('<path d="M9 57V21L20 8h24l11 13v36Z" fill="#687164"/><path d="M20 8h24v9H20Zm-8 18h40M12 48h40" fill="#98a187"/><path d="M20 49V30q12-15 24 0v19Z" fill="#3a342b"/><path d="m22 47 5-16 6 9 6-15 5 22Z" fill="#c87f3d" stroke="#e5bb65"/><path d="M8 55h48v6H8Z" fill="#9a9477"/>'),
    anvil:svg('<path d="M23 40h18l5 16H17Z" fill="#777768"/><path d="M9 22h45l-5 10H37v9H24V30l-9 1-9-5Z" fill="#899e9a"/><path d="M10 22h44v4H10Z" fill="#c6d3c2"/><path d="m46 43 9 9m-8-10 5-5 6 6-5 5" fill="#b9925a" stroke="#ccb67f" stroke-width="3"/>'),
    crystal:svg('<path d="m13 52 3-24 12-13 10 18 10-9 8 29-23 8Z" fill="#856d8f"/><path d="m17 29 10-10 1 34-12 1Zm13-16 7-9 12 16-9 32-10 5Z" fill="#ae83aa"/><path d="m37 9 2 43 8-31Zm-7 8 5 6-4 21" fill="#d4b3cc"/><path d="m44 33 5-5 5 24-10 3Z" fill="#c2a4bc"/>'),
    bones:svg('<path d="m13 50 34-25m-32-9 31 35" stroke="#c9c4a7" stroke-width="5"/><path d="M10 11q-5 6 2 9m33 28q7-2 8 5M10 48q-4 6 3 9m30-35q7-3 9 4" stroke="#ded7bb" stroke-width="5" fill="none"/><path d="M23 34q-9-14 4-19 13-3 17 10l-4 8-3 10-10-1Z" fill="#dad8bb"/><path d="m27 26 5 2m4-4 4 1m-8 8v3" stroke="#5c6757" stroke-width="3"/>'),
    nest:svg('<ellipse cx="32" cy="45" rx="25" ry="12" fill="#736b46"/><ellipse cx="32" cy="41" rx="21" ry="10" fill="#b19b63"/><ellipse cx="32" cy="40" rx="14" ry="6" fill="#4e5946"/><path d="m7 39 18 9 29-7M9 50l21 5 24-6M14 33l14 7 21-8M23 27l8 11 10-12" stroke="#ccb47c" stroke-width="2" fill="none"/>'),
    mushroom:svg('<path d="M17 32h8v24h-8Zm23-13h8v35h-8Z" fill="#d8c8a3"/><path d="M4 32Q20-1 36 32Z" fill="#a58263"/><path d="M27 21Q44-10 60 21Z" fill="#8e9e75"/><path d="M10 30h20M34 19h20" stroke="#d1cbb1"/><circle cx="17" cy="20" r="3" fill="#ead9b6"/><circle cx="44" cy="9" r="3" fill="#d7dfb7"/>'),
    totem:svg('<path d="M17 57h31l-5-7H22Z" fill="#717b6d"/><path d="M23 50V17l10-9 10 9v33Z" fill="#9b9e8a"/><path d="m33 15 7 9-7 9-7-9Z" fill="#a6c5bb"/><path d="m33 34 7 8-7 8-7-8Z" fill="#c5a9c7"/><path d="M25 20h-9v8h8m17 8h10v8H41" fill="none" stroke="#cfbd8c" stroke-width="3"/>'),
    treasure:svg('<path d="m7 53 8-14 13-2 7-14 15 14 8 16Z" fill="#8c6b32"/><g fill="#ddb961" stroke="#9e7d3c"><ellipse cx="18" cy="47" rx="10" ry="4"/><ellipse cx="18" cy="42" rx="9" ry="4"/><ellipse cx="36" cy="50" rx="13" ry="5"/><ellipse cx="45" cy="41" rx="10" ry="4"/><ellipse cx="37" cy="33" rx="8" ry="4"/></g><path d="m35 16 7 7-7 6-6-6Z" fill="#a5c8b6"/><path d="m16 42 5-1m10 8h8m4-10h6" stroke="#fff0b4" stroke-width="2"/>'),
    stall:svg('<path d="M8 24h48v32H8Z" fill="#876344"/><path d="M5 23 15 7h34l10 16Z" fill="#a77660"/><path d="m22 7-5 16m17-16v16m11-16 7 16" stroke="#e4cba2" stroke-width="7"/><path d="M5 23q5 9 11 0 6 9 12 0 6 9 12 0 6 9 12 0 4 9 7 0" fill="#d7bd91"/><path d="M6 42h52v6H6Z" fill="#b99867"/><path d="M14 42V32h9v10m10 0V30h10v12m5 0v-6h6v6" fill="#8db2a3"/>'),
    workbench:svg('<path d="M10 38h5v20h-5m34-20h6v20h-6" fill="#755537"/><path d="m5 26 42-7 12 13-42 9-12-7Z" fill="#b79563"/><path d="m17 41 42-9v6l-42 9-12-7v-6Z" fill="#806344"/><path d="m22 19 18-5 7 8-18 5Z" fill="#a7b2a0"/><path d="m13 26 14 6m14-6 8 3" stroke="#5d6b66" stroke-width="4"/>'),
    tent:svg('<path d="M4 56 25 10l13-3 23 48Z" fill="#9c956c"/><path d="M4 56 25 10l16 45Z" fill="#d1c69b"/><path d="m16 54 10-28 10 28Z" fill="#4d574b"/><path d="m38 7 23 48H41Z" fill="#818361"/><path d="M7 55 1 60m58-6 4 6M25 10l1-7" stroke="#decda3" stroke-width="2"/>'),
    campfire:svg('<ellipse cx="32" cy="48" rx="26" ry="12" fill="#ccb17b" opacity=".32" stroke="none"/><path d="m12 48 38 9m-37-1 36-11" stroke="#8a603e" stroke-width="7"/><path d="m17 46 8-24 7 11L39 9l9 24-3 15Z" fill="#d38b42" stroke="#edc276"/><path d="m25 45 8-15 6 19Z" fill="#f3d996"/><path d="M8 54h8m33 0h7M14 42h6m24 15h7" stroke="#a4ac95" stroke-width="5"/>'),
    pool:svg('<ellipse cx="32" cy="46" rx="28" ry="13" fill="#78897b"/><ellipse cx="32" cy="43" rx="25" ry="11" fill="#9ba995"/><ellipse cx="32" cy="42" rx="20" ry="8" fill="#80b3af"/><path d="M17 42q15 6 30-1m-24 5q10 3 19-1" stroke="#c8e1d1" fill="none"/><path d="m6 41 8-5m37 13 7-4" stroke="#c1c8ad" stroke-width="4"/>'),
    reeds:svg('<path d="M17 57 13 19m11 37-4-41m10 40 6-35m4 34 8-28m-19 29 2-47" stroke="#7a946e" stroke-width="3" fill="none"/><path d="m14 33-8-12m17 14 7-12m8 17 14-7" stroke="#a1b38a" fill="none"/><path d="m12 18-1-10m10 7-1-10m15 15 2-10m10 15 4-10" stroke="#ad9868" stroke-width="5"/>'),
    bookshelf:svg('<path d="M8 6h48v53H8Z" fill="#75583c"/><path d="M13 11h38v43H13Z" fill="#403d32"/><path d="M16 12h6v17h-6m8-17h7v17h-7m9-18h5v18h-5m7-15 6-1 3 16-6 1" fill="#9b7967"/><path d="M16 35h7v18h-7m9-19h6v19h-6m10-16 7-2 4 16-7 2m8-20h5v20h-5" fill="#8ca08b"/><path d="M9 29h46v5H9Zm0 24h46v5H9Z" fill="#c0a277"/><path d="M18 16v7m9-8v9m10-10v11m-17 13v11m8-10v8m11-9 2 10" stroke="#d8c393"/>'),
    scrolls:svg('<path d="m8 37 30-8 17 11-30 10Z" fill="#826856"/><path d="m8 42 17 8 30-9v7l-30 10-17-8Z" fill="#c5b68f"/><path d="M16 14h31v23H16Z" fill="#e0d0a6"/><path d="M16 14q-8 0-7 8t7 0m31-8q8 0 8 8t-8 0" fill="#c5b184"/><path d="M24 21h15m-15 5h12m-12 5h16" stroke="#9b9275"/>'),
    mirror:svg('<path d="M16 57h33l-8-7H24Z" fill="#8e846a"/><path d="M17 18Q32-3 48 18v31H17Z" fill="#b9aa81"/><path d="M22 20q10-17 21 0v24H22Z" fill="#9bbaaf"/><path d="m29 14 5 12-8 9 8 9m4-27 3 9" stroke="#e1e8cf" fill="none"/><path d="M17 48h31v5H17Z" fill="#756c57"/>'),
    rubble:svg('<path d="m8 39 13-9 12 10-5 12H9Zm25 4 10-11 12 10-5 11H36Zm-9-15 7-8 10 8-8 8Z" fill="#939883" stroke="#6e7968"/><path d="m9 39 15-3m14 7 12-3m-21-12 7-3" stroke="#bcc0a5"/>',true),
    moss:svg('<path d="M5 44q-4-9 9-9-3-14 9-9 8-15 16-3 16-5 17 9 13 5 1 14-21 12-52-2Z" fill="#899e6a" fill-opacity=".4" stroke="none"/><path d="m12 40 8-5m10 4 6-6m4 10 10-4m-27-13 3 5" stroke="#bac38b" opacity=".6"/>',true),
    stain:svg('<path d="M7 39q3-9 15-4-3-11 10-9 8-12 15-2 16 6 8 18-18 14-48-3Z" fill="#995f58" fill-opacity=".25" stroke="none"/><path d="m21 41 11-6m10 7 5-4" stroke="#b27c6a" opacity=".35"/>',true),
    runes:svg('<ellipse cx="32" cy="33" rx="26" ry="18" fill="none" stroke="#b4aa80" opacity=".6"/><path d="m32 18 14 15-14 15-14-15Zm0 0v30M11 33h42" fill="none" stroke="#8a9f8d" opacity=".65"/>',true),
    rug:svg('<path d="m6 18 43-6 11 33-43 8Z" fill="#987d72" fill-opacity=".55" stroke="#d2bf93"/><path d="m13 23 31-5 8 23-30 5Z" fill="none" stroke="#c7b08a"/><path d="m30 23 8 8-4 10-8-7Z" fill="#b8aa83"/><path d="m8 21-5 1m7 6-5 1m7 6-5 1m10 17-4 3m11-4-4 4m11-5-4 4m11-5-4 4" stroke="#c2ad83"/>',true),
    arch:svg('<path d="M7 60V24C7-6 57-6 57 24v36H46V25c0-18-28-18-28 0v35Z" fill="#7b8878"/><path d="M7 25h11m-11 16h11m28-16h11M46 41h11M14 9l7 7M43 9l-7 7M27 3v11M12 57h5m30 0h6" stroke="#b7bea0" stroke-width="3"/><path d="m32 7 4 6-4 7-4-7Z" fill="#c2ad73"/>'),
    pillar:svg('<path d="M12 59h40v-7H12Zm5-47h30V6H17Z" fill="#a1aa91"/><path d="M22 13h21v39H22Z" fill="#85917c"/><path d="M25 15v34m7-35v35" stroke="#bcc5a8" stroke-width="3"/><path d="M40 15v34" stroke="#596b5b" stroke-width="3"/>'),
    sconce:svg('<ellipse cx="32" cy="28" rx="24" ry="27" fill="#e1b96d" opacity=".12" stroke="none"/><path d="M26 53V29h12v24Z" fill="#80674b"/><path d="m23 30 18-1-5 11h-8Z" fill="#ae9871"/><path d="m25 26 5-16 4 7 5-11 4 18-6 7h-8Z" fill="#e6b464" stroke="#efd49c"/><path d="m29 27 5-9 3 10Z" fill="#f8e6ac"/>')
  };
  const themes={
    outpost:{props:['rack','crate','banner','sconce'],ground:'rubble'},ambush:{props:['arch','rack','sconce','barrel'],ground:'rubble'},
    elite:{props:['statue','pillar','candles','banner'],ground:'rug'},nest:{props:['eggs','mushroom','nest','web'],ground:'moss'},
    bounty:{props:['chains','cage','bones','banner'],ground:'stain'},cursed:{props:['cage','chains','crystal','candles'],ground:'runes'},
    rift:{props:['forge','anvil','workbench','sconce'],ground:'rubble'},bleed:{props:['crystal','bones','candles','chains'],ground:'stain'},
    pack:{props:['nest','mushroom','reeds','eggs'],ground:'moss'},wheel:{props:['totem','pillar','candles','statue'],ground:'runes'},
    vault:{props:['treasure','crate','pillar','banner'],ground:'rug'},market:{props:['stall','barrel','crate','sconce'],ground:'rug'},
    workshop:{props:['workbench','anvil','crate','barrel'],ground:'rubble'},shrine:{props:['statue','candles','totem','sconce'],ground:'runes'},
    camp:{props:['tent','campfire','barrel','crate'],ground:'rug'},spring:{props:['pool','reeds','mushroom','statue'],ground:'moss'},
    library:{props:['bookshelf','scrolls','candles','pillar'],ground:'rug'},memory:{props:['mirror','scrolls','crystal','totem'],ground:'runes'},
    prison:{props:['cage','chains','bones','sconce'],ground:'stain'},mystery:{props:['arch','totem','crystal','sconce'],ground:'runes'},
    boss:{props:['pillar','statue','banner','sconce'],ground:'runes'},study:{props:['bookshelf','scrolls','candles','mirror'],ground:'rug'}
  };
  const cache=new WeakMap();
  function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
  function assets(){return Object.keys(art).map(id=>({id,svg:art[id],color:'#ffffff'}));}
  function layout(map,room,chapter){
    const id=themes[room]?room:'outpost',key=id+':'+chapter;let memo=cache.get(map);if(memo&&memo[key])return memo[key];if(!memo){memo={};cache.set(map,memo);}
    const h=map.length,w=map[0].length,walk=(x,y)=>!!(map[y]&&map[y][x]===1),walls=[],floors=[],shadows=[],props=[],ground=[],theme=themes[id];
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      if(walk(x,y)){
        for(const [dx,dy,dir] of [[0,-1,'n'],[1,0,'e'],[0,1,'s'],[-1,0,'w']])if(!walk(x+dx,y+dy))shadows.push({x,y,key:'shade:'+dir});
        if(walk(x-1,y)&&walk(x+1,y)&&walk(x,y-1)&&walk(x,y+1))floors.push({x,y,rank:hash(key+':floor:'+x+','+y)});
      }else if(walk(x,y+1)||walk(x,y-1))walls.push({x,y,front:!walk(x,y+1),rank:hash(key+':wall:'+x+','+y)});
    }
    walls.sort((a,b)=>Number(a.front)-Number(b.front)||a.rank-b.rank);
    const cap=Math.min(10,Math.max(4,Math.floor(walls.length/5)));
    for(const p of walls){if(props.length>=cap)break;if(props.some(q=>Math.abs(q.x-p.x)+Math.abs(q.y-p.y)<3))continue;
      const type=walk(p.x,p.y-1)&&walk(p.x,p.y+1)?'pillar':theme.props[props.length%theme.props.length];
      props.push({x:p.x,y:p.y,key:'decor:'+type,width:['tent','stall','pool','forge','arch'].includes(type)?1.35:1.1,height:['bookshelf','statue','cage','pillar','arch','tent'].includes(type)?1.65:1.3,alpha:p.front?.72:1});
    }
    // A small foreground accent adds depth without lining every corridor with props.
    const front=walls.find(p=>p.front&&!props.some(q=>Math.abs(q.x-p.x)+Math.abs(q.y-p.y)<3));
    if(front&&props.length<10)props.push({x:front.x,y:front.y,key:'decor:'+(['nest','pack'].includes(id)?'mushroom':'pillar'),width:1.05,height:1.55,alpha:.7});
    floors.sort((a,b)=>a.rank-b.rank);for(const p of floors){if(ground.length>=18)break;if(ground.some(q=>Math.abs(q.x-p.x)+Math.abs(q.y-p.y)<3))continue;ground.push({x:p.x,y:p.y,key:'decor:'+theme.ground,width:1.2,height:1,alpha:.55});}
    return memo[key]={id,props,ground,shadows};
  }
  return {assets,themes,layout};
})();
if(typeof module!=='undefined')module.exports=DungeonDecor;
