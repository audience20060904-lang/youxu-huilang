/* node dev/check-dungeon-raster.js — optional mobile renderer, incremental cache and safe fallback. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'..','dungeon-raster.js'),'utf8');let groups=0;
function check(name,fn){fn();groups++;console.log('PASS '+name);}
function setup(){
 const frames=[],calls={clear:0,image:0,images:0},media={matches:true,addEventListener(type,fn){this.change=fn;}};
 const ctx=new Proxy({clearRect(){calls.clear++;},drawImage(){calls.image++;},createRadialGradient(){return {addColorStop(){}};}},{get:(o,k)=>k in o?o[k]:()=>{}});
 const el=()=>{const names=new Set();return {style:{},children:[],hidden:false,isConnected:false,classList:{add:n=>names.add(n),remove:n=>names.delete(n),contains:n=>names.has(n)},setAttribute(){},appendChild(n){this.children.push(n);n.isConnected=true;},getContext:()=>ctx};};
 const art='<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="10"/></svg>',bad='<svg bad/>';
 class Image{constructor(){calls.images++;}set src(v){this.url=v;Promise.resolve().then(()=>v.includes('bad')?this.onerror():this.onload());}}
 const c=vm.createContext({window:{matchMedia:()=>media},document:{createElement:el},Image,MOB_ART:{a:art},COIN:art,CHEST:art,SPRING:art,ALTAR:art,SHOP:art,STAIR:art,HEROES:[{id:'medium',col:'#9872af'}],setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:f=>{frames.push(f);return frames.length;}});
 vm.runInContext(code,c);const map=el(),cells=Array.from({length:6},(_,i)=>({className:'c floor dot walkable',dataset:{detail:String(i),face:''},_sceneHtml:i===1?art:''}));map.isConnected=true;
 return {c,api:c.DungeonRaster,media,map,cells,ctx,calls,art,bad,flush(){while(frames.length)frames.shift()();}};
}
(async()=>{
 const t=setup();await t.api.prepare();
 check('Map sprites are prepared once before mobile painting',()=>{assert.equal(t.calls.images,1);assert.equal(t.api.light(),true);});
 check('Mobile terrain is cached; goal movement does not repaint tiles or query geometry',()=>{
  t.api.paint(t.map,t.cells,3,2,30,1,null,false);t.flush();assert.equal(t.calls.clear,6);assert.equal(t.calls.image,1);assert(t.map.classList.contains('raster-map'));
  t.api.paint(t.map,t.cells,3,2,30,1,{x:2,y:1},false);t.flush();assert.equal(t.calls.clear,6);assert.equal(t.map._raster.goal.style.transform,'translate(60px,30px)');
  t.cells[1]._sceneHtml='';t.api.paint(t.map,t.cells,3,2,30,1,null,false);t.flush();assert.equal(t.calls.clear,7);assert(t.map._raster.goal.hidden);
 });
 check('Resize and biome changes invalidate the cache without growing beyond one canvas/goal',()=>{
  t.api.paint(t.map,t.cells,3,2,40,2,null,false);t.flush();assert.equal(t.calls.clear,13);assert.equal(t.map.children.length,2);assert.equal(t.map._raster.canvas.style.width,'120px');
  t.api.paint(t.map,t.cells,33,25,46,2,null,false);t.flush();assert(t.map._raster.canvas.width*t.map._raster.canvas.height<=3010000);
 });
 check('Desktop, tutorial and cooperative views retain the DOM renderer',()=>{
  t.api.paint(t.map,t.cells,3,2,40,2,null,true);assert(!t.map.classList.contains('raster-map'));assert(t.map._raster.canvas.hidden);
  t.media.matches=false;t.api.paint(t.map,t.cells,3,2,40,2,null,false);assert(!t.map.classList.contains('raster-map'));assert.equal(t.api.sprite(t.art,''),t.art);
 });
 check('Mobile actor sprites preserve hero color and use one shared image URL',()=>{
  t.media.matches=true;const a=t.api.sprite(t.art,' hr-medium');assert(a.startsWith('<img'));assert(decodeURIComponent(a).includes('color:#9872af'));assert.equal(a,t.api.sprite(t.art,' hr-medium'));
 });
 const failed=setup();failed.map.getContext=()=>null;failed.c.document.createElement=()=>({style:{},setAttribute(){},getContext:()=>null});await failed.api.prepare();
 check('Unavailable canvas never hides the working DOM map',()=>{failed.api.paint(failed.map,failed.cells,3,2,30,1,null,false);assert(!failed.map.classList.contains('raster-map'));});
 const bad=setup();await bad.api.prepare();bad.cells[0]._sceneHtml=bad.bad;bad.api.paint(bad.map,bad.cells,3,2,30,1,null,false);await Promise.resolve();await Promise.resolve();
 check('Failed sprite decoding falls back to visible DOM without blocking startup',()=>{bad.api.paint(bad.map,bad.cells,3,2,30,1,null,false);assert(!bad.map.classList.contains('raster-map'));});
 console.log(groups+' mobile raster checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
