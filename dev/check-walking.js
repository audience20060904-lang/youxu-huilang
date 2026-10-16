/* node dev/check-walking.js — real movement paths, dirty-state fallback and terrain ownership. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8').replace(/\r\n/g,'\n');
let groups=0;function check(name,fn){fn();groups++;console.log('PASS '+name);}
function load(name,c){const i=source.indexOf('function '+name+'('),j=source.indexOf('\n}',i);assert(i>=0&&j>i,name);vm.runInContext(source.slice(i,j+2),c);}
function context(){let full=0,camera=0,fx=0,tiles=[],goals=[];const grid=[[1,1,1],[1,1,1]],mobs=[{x:2,y:0}],things=[];
 const c=vm.createContext({W:3,H:2,COOP:false,P:{x:0,y:1,hero:'adv'},G:{map:grid,mobs,things,goal:null,stair:{x:0,y:0}},cells:Array.from({length:6},(_,i)=>({classList:{toggle:(name,on)=>goals.push([i,name,on])}})),window:{DungeonFX:true},DungeonFX:{move(){fx++;}},heroArt:()=>'<svg/>',heroCls:()=>'',
  $:()=>({}),render(){full++;},camera(){camera++;},renderMapTile:(...a)=>tiles.push(a)});
 c.mapRenderState={world:grid,grid:c.cells,mobs,mobCount:mobs.length,things,thingCount:things.length,goal:-1};
 load('renderStep',c);return {c,get full(){return full},get camera(){return camera},get fx(){return fx},tiles,goals};
}
check('Empty walking updates only camera/actors, with no full-map/HUD/attribute work',()=>{
 const t=context(),c=t.c;for(let i=0;i<1000;i++){c.P.x=i%2;c.renderStep();}
 assert.equal(t.full,0);assert.equal(t.camera,1000);assert.equal(t.fx,1000);assert.equal(t.tiles.length,0);
});
check('Starting, switching and clearing a target only toggle marker classes, without terrain rendering',()=>{
 const t=context(),c=t.c;c.G.goal={x:2,y:1};c.renderStep();assert.deepEqual(t.goals,[[5,'goal',true]]);
 c.G.goal={x:1,y:1};c.renderStep();assert.deepEqual(t.goals.slice(1),[[5,'goal',false],[4,'goal',true]]);
 c.G.goal=null;c.renderStep();assert.deepEqual(t.goals.at(-1),[4,'goal',false]);assert.equal(t.full,0);assert.equal(t.tiles.length,0);
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
check('Viewport resize bursts settle once instead of reallocating the map repeatedly',()=>{
 let id=0,runs=0;const pending=new Map(),c=vm.createContext({mapResizeTimer:null,sizeMap:()=>runs++,setTimeout(fn,ms){assert.equal(ms,100);pending.set(++id,fn);return id;},clearTimeout:id=>pending.delete(id)});
 load('scheduleMapResize',c);for(let i=0;i<40;i++)c.scheduleMapResize();assert.equal(pending.size,1);assert.equal(runs,0);
 const fn=[...pending.values()][0];fn();assert.equal(runs,1);assert.equal(c.mapResizeTimer,null);
});
check('A new walking target starts its first step directly, without a pre-move render',()=>{
 const t=context(),c=t.c;let frames=0,steps=0;c.findPath=()=>[{x:1,y:1},{x:2,y:1}];c.cancelWalk=()=>{};c.renderStep=()=>frames++;c.stepWalk=()=>{steps++;frames++;};
 load('goTo',c);assert.equal(c.goTo(2,1,false),true);assert.equal(steps,1);assert.equal(frames,1);assert.equal(c.G.goal.x,2);
});
console.log(groups+' walking checks passed.');
