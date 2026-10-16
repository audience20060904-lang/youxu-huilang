/* node dev/check-walking.js — real movement paths, dirty-state fallback and terrain ownership. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8').replace(/\r\n/g,'\n');
let groups=0;function check(name,fn){fn();groups++;console.log('PASS '+name);}
function load(name,c){const i=source.indexOf('function '+name+'('),j=source.indexOf('\n}',i);assert(i>=0&&j>i,name);vm.runInContext(source.slice(i,j+2),c);}
function context(){let full=0,camera=0,fx=0,tiles=[];const grid=[[1,1,1],[1,1,1]],mobs=[{x:2,y:0}],things=[];
 const c=vm.createContext({W:3,H:2,COOP:false,P:{x:0,y:1,hero:'adv'},G:{map:grid,mobs,things,goal:null,stair:{x:0,y:0}},cells:[],window:{DungeonFX:true},DungeonFX:{move(){fx++;}},heroArt:()=>'<svg/>',heroCls:()=>'',
  $:()=>({}),render(){full++;},camera(){camera++;},renderMapTile:(...a)=>tiles.push(a)});
 c.mapRenderState={world:grid,grid:c.cells,mobs,mobCount:mobs.length,things,thingCount:things.length,goal:-1};
 load('renderStep',c);return {c,get full(){return full},get camera(){return camera},get fx(){return fx},tiles};
}
check('Empty walking updates only camera/actors, with no full-map/HUD/attribute work',()=>{
 const t=context(),c=t.c;for(let i=0;i<1000;i++){c.P.x=i%2;c.renderStep();}
 assert.equal(t.full,0);assert.equal(t.camera,1000);assert.equal(t.fx,1000);assert.equal(t.tiles.length,0);
});
check('Target changes redraw only the previous and next goal; arriving removes the old marker',()=>{
 const t=context(),c=t.c;c.G.goal={x:2,y:1};c.renderStep();assert.deepEqual(t.tiles.map(a=>a.slice(0,2)),[[2,1]]);
 c.G.goal={x:1,y:1};c.renderStep();assert.deepEqual(t.tiles.slice(1).map(a=>a.slice(0,2)),[[2,1],[1,1]]);
 c.G.goal=null;c.renderStep();assert.deepEqual(t.tiles.at(-1).slice(0,2),[1,1]);assert.equal(t.full,0);
});
check('Pickup, monster changes, world/DOM replacement, tutorial and coop fall back to full refresh',()=>{
 for(const change of [c=>c.G.things.push({}),c=>c.G.things=[],c=>c.G.mobs.pop(),c=>c.G.mobs=[],c=>c.G.map=[[1]],c=>c.cells=[],c=>c.P.tut=true,c=>c.COOP=true]){
  const t=context();change(t.c);t.c.renderStep();assert.equal(t.full,1);assert.equal(t.camera,0);
 }
});
check('Always-lit visibility is initialized once per world/array while new monsters stay visible',()=>{
 const t=context(),c=t.c;let writes=0;const rows=()=>Array.from({length:2},()=>Array.from({length:3},()=>false).map((v,i)=>v));
 const tracked=()=>rows().map(row=>new Proxy(row,{set(a,k,v){writes++;a[k]=v;return true;}}));
 c.G.seen=tracked();c.G.vis=tracked();c.fovGrid=c.fovSeen=c.fovVis=null;load('fov',c);c.fov();assert.equal(writes,12);
 for(let i=0;i<1000;i++)c.fov();assert.equal(writes,12);c.G.mobs.push({seen:false});c.fov();assert.equal(c.G.mobs.at(-1).seen,true);
 c.G.seen=tracked();c.fov();assert.equal(writes,24);
});
check('Static terrain keeps its content beneath the player; coins/monsters do not become player DOM',()=>{
 const t=context(),c=t.c;const cell={classList:{add(){}}};c.cells=Array(6).fill(cell);c.G.seen=[[true,true,true],[true,true,true]];c.G.vis=c.G.seen;
 let html,classes;c.paintMapCell=(el,v)=>html=v;c.paintMapClass=(el,v)=>classes=v;c.wallEdge=()=>false;c.thingAt=()=>null;c.mobAt=()=>null;c.MOB_ART={};c.STAIR='<stair/>';
 load('renderMapTile',c);c.renderMapTile(0,1,false,null);assert.equal(html,'');assert.equal(classes,'c floor dot walkable');assert(!classes.includes('you'));
 c.thingAt=()=>({kind:'gold'});c.COIN='<coin/>';c.renderMapTile(0,1,false,null);assert.equal(html,'<coin/>');assert(classes.includes('gold'));
});
check('Actual stepWalk preserves one-cell timing, arrival cleanup, and uses the fast render path',()=>{
 const t=context(),c=t.c;let entered=0,views=0,fast=0,schedule=[];
 Object.assign(c,{walkPath:[{x:1,y:1},{x:2,y:1}],walkTimer:null,CHAPTER:{stepMs:144},mobAt:()=>null,onEnter(){entered++;},fov(){views++;},renderStep(){fast++;},cancelWalk(){c.walkPath=null;c.G.goal=null;},setTimeout(fn,ms){schedule.push(ms);return 1;}});
 c.G.floor=1;load('stepWalk',c);c.stepWalk();assert.equal(c.P.x,1);assert.equal(entered,1);assert.equal(fast,1);assert.deepEqual(schedule,[144]);
 c.stepWalk();assert.equal(c.P.x,2);assert.equal(c.walkPath,null);assert.equal(fast,2);assert.equal(views,2);
});
check('Terrain grid is isolated from actor/trail insertion and retains all clickable coordinates',()=>{
 const t=context(),c=t.c;
 function el(){return {children:[],dataset:{},style:{setProperty(){}},appendChild(n){if(n.fragment)this.children.push(...n.children);else this.children.push(n);},set innerHTML(v){this.children=[];}};}
 const map=el();c.$=()=>map;c.document={createElement:el,createDocumentFragment:()=>Object.assign(el(),{fragment:true})};c.CHAPTER={stepMs:144};c.sizeMap=()=>{};
 load('buildGrid',c);c.buildGrid();assert.equal(map.children.length,1);assert.equal(map.children[0].className,'map-tiles');assert.equal(map.children[0].children.length,6);assert.equal(c.cells.length,6);assert.equal(c.cells[5].dataset.x,2);assert.equal(c.cells[5].dataset.y,1);assert.equal(c.mapRenderState,null);
});
console.log(groups+' walking checks passed.');
