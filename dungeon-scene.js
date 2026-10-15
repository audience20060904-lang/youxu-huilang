/* 代码原生 SVG 场景资源；没有重复 SVG id，不引入远程贴图。 */
var DungeonScene=(function(){
  'use strict';
  const svg=body=>'<svg viewBox="0 0 32 32" aria-hidden="true">'+body+'</svg>';
  const shadow='<ellipse cx="16" cy="28" rx="12" ry="2.7" fill="#1a1713" opacity=".2"/>';
  COIN=svg(shadow+'<ellipse cx="12" cy="23" rx="8" ry="4" fill="#9c641e"/><ellipse cx="12" cy="21" rx="8" ry="4" fill="#e6b755"/><path d="M5 22v3M10 23v3M15 23v3" stroke="#f8d58a"/><ellipse cx="21" cy="18" rx="7" ry="4" fill="#ae7629"/><ellipse cx="21" cy="16" rx="7" ry="4" fill="#efc86d"/><path d="M16 16q5-4 10 0" fill="none" stroke="#fff0b5"/><circle cx="12" cy="12" r="7" fill="#bb812f" stroke="#fae0a1"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="#f0c76c"/><path d="m12 8 2 4-2 4-2-4Z" fill="#ffe3a2"/>');
  CHEST=svg(shadow+'<path d="M5 15h22v12H5Z" fill="#6a4028" stroke="#3e2e24"/><path d="M5 15V11q11-9 22 0v4Z" fill="#a76c3b" stroke="#513721"/><path d="M5 14h22M8 19h16M8 24h16" stroke="#d19c60" opacity=".65"/><path d="M9 8v19M23 8v19" stroke="#c3a569" stroke-width="2.4"/><path d="M4 15h24v3H4Z" fill="#d6b977"/><rect x="13" y="14" width="6" height="7" rx="1" fill="#f2d48e" stroke="#785c29"/><circle cx="16" cy="17" r="1.3" fill="#60482b"/><path d="M6 11q10-6 20 0" stroke="#e2b36b" fill="none"/>');
  SPRING=svg(shadow+'<ellipse cx="16" cy="25" rx="12" ry="5" fill="#797b6c"/><path d="M5 23q11 8 22 0v-4H5Z" fill="#a6ae9b"/><ellipse cx="16" cy="19" rx="11" ry="5" fill="#6d8e8b" stroke="#c0c6ae" stroke-width="2"/><ellipse cx="16" cy="19" rx="8" ry="3" fill="#77bfc6"/><path d="M9 18q6 3 14 0M12 21q4 1 8 0" stroke="#daf3e6" fill="none"/><path d="M16 6c-9 10-4 12 0 12s9-2 0-12" fill="#70cbd2" opacity=".9"/><path d="M15 9q-4 5-2 6" stroke="#ecffff" fill="none" stroke-linecap="round"/>');
  ALTAR=svg(shadow+'<path d="M5 27h22l-3-5H8Z" fill="#7a6f61"/><path d="M9 22V14h14v8" fill="#a99d83"/><path d="M6 12h20v4H6Z" fill="#c0b28f" stroke="#6e6559"/><path d="m16 3 6 6-6 7-6-7Z" fill="#b291cf" stroke="#eedcf5"/><path d="m16 3-2 6 2 7 3-7Z" fill="#e4c8f4" opacity=".65"/><path d="M12 19h8M12 21h8" stroke="#766552"/><path d="M4 8v3M2.5 9.5h3M27 5v4M25 7h4" stroke="#debf77"/>');
  SHOP=svg(shadow+'<path d="M7 14h19v13H7Z" fill="#825532"/><path d="M7 20h19v7H7Z" fill="#a77e4b"/><path d="M5 14h23L24 5H9Z" fill="#b76445"/><path d="m11 5-2 9M17 5v9M23 5l3 9" stroke="#efd49a" stroke-width="3"/><path d="M5 14q3 6 6 0 3 6 6 0 3 6 6 0 3 6 5 0" fill="#ead6a7"/><path d="M8 27V14M25 27V14" stroke="#493c2b" stroke-width="2"/><circle cx="12" cy="23" r="2.2" fill="#e1b65d"/><path d="M17 22h6v4h-6Z" fill="#6e8c80"/>');
  STAIR=svg(shadow+'<path d="M5 8h22v19H5Z" fill="#554e48"/><path d="M8 11h16v4H8Zm0 5h16v4H8Zm0 5h16v5H8Z" fill="#a69b83"/><path d="M9 12h14M9 17h14M9 22h14" stroke="#e5d2a2" opacity=".5"/><path d="m16 3 4 4h-3v3h-2V7h-3Z" fill="#e1b450"/>');
  const pet=svg(shadow+'<path d="m6 15 1-9 6 5 7-2 7 7-4 9H9Z" fill="#b59a70" stroke="#4d4337"/><path d="m9 11 1-3 3 4M23 13l2 3-4 7-5-2" fill="#ead6ac"/><path d="m10 25-2 4M22 25l2 4M6 20l-4-4" stroke="#7c6950" stroke-width="3" stroke-linecap="round"/><circle cx="19" cy="16" r="1.5" fill="#32535c"/><path d="m24 19 4-1-1 4" fill="#3a3431"/><path d="M11 15h3M9 18h4" stroke="#715b42"/>');
  let world=null,mapNode=null,pawn=null,companion=null;
  function paint(map,cells,w,grid,x,y,art,hasPet,chapter){
    if(!map)return;const cell=cells[y*w+x];if(!cell)return;
    const fresh=world!==grid||mapNode!==map||!pawn||!pawn.isConnected;
    const snap=fresh||pawn._cellSize!==cell.offsetWidth;
    if(fresh){
      world=grid;mapNode=map;map.dataset.biome=String(chapter||1);
      if(pawn)pawn.remove();if(companion)companion.remove();
      pawn=document.createElement('span');pawn.className='map-pawn';pawn.setAttribute('aria-hidden','true');map.appendChild(pawn);
      companion=document.createElement('span');companion.className='map-pet';companion.innerHTML=pet;companion.setAttribute('aria-hidden','true');map.appendChild(companion);
      for(let i=0;i<cells.length;i++){const c=cells[i],cx=i%w,cy=Math.floor(i/w);c.style.setProperty('--tile-tone',((cx*13+cy*7)%5)*.025);c.dataset.detail=String((cx*17+cy*31)%23);}
    }
    if(pawn._art!==art){pawn.innerHTML=art;pawn._art=art;}
    const size=cell.offsetWidth;if(!size)return;pawn._cellSize=size;
    for(const node of [pawn,companion]){node.style.width=node.style.height=size+'px';node.style.transition=snap?'none':'';}
    pawn.style.transform='translate('+cell.offsetLeft+'px,'+cell.offsetTop+'px)';
    companion.hidden=!hasPet;companion.style.transform='translate('+(cell.offsetLeft-size*.58)+'px,'+(cell.offsetTop+size*.27)+'px)';
    if(snap){void pawn.offsetWidth;void companion.offsetWidth;}
  }
  function battlePet(show){
    const host=document.getElementById('meArt');if(!host)return;
    let node=host.querySelector('.battle-pet');
    if(show&&!node){node=document.createElement('span');node.className='battle-pet';node.setAttribute('aria-hidden','true');node.innerHTML=pet;host.appendChild(node);}
    if(node)node.hidden=!show;
  }
  function camera(map,targetX,targetY,key,size){
    const prior=map._camera,far=!prior||prior.key!==key||prior.size!==size||Math.abs(prior.x-targetX)+Math.abs(prior.y-targetY)>size*3;
    map.style.transition=far?'none':'';map.style.transform='translate('+targetX+'px,'+targetY+'px)';
    if(far)void map.offsetWidth;map._camera={x:targetX,y:targetY,key:key,size:size};
  }
  return {paint:paint,battlePet:battlePet,camera:camera,pet:pet};
})();
