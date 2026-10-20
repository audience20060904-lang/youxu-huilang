/* Map footer status, reader lifecycle and viewport budget; no real browser layout claim. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n');
const setup=read('dev/check-dungeon-builds.js').split("check('Twelve appended")[0];
const {c,reset}=new Function('require','__dirname',setup+'\nreturn {c,reset};')(require,__dirname);
vm.runInContext(read('dungeon-rooms.js'),c);let groups=0;
function check(name,fn){fn();groups++;console.log('PASS '+name);}
const nodes={};function el(id){return nodes[id]||(nodes[id]={id,hidden:true,attrs:{},style:{setProperty(k,v){this[k]=v}},textContent:'',_html:'',writes:0,get innerHTML(){return this._html},set innerHTML(v){this._html=v;this.writes++},classList:{contains(){return false}},setAttribute(k,v){this.attrs[k]=v},getAttribute(k){return this.attrs[k]},focus(){this.focused=(this.focused||0)+1}});}
reset([],{floor:2});c.SCENE='run';c.B=null;c.P.roomRun={seed:77,history:[]};c.G.routeRoom=c.DungeonRooms.enter(c.P,2,false,'market');c.G.roomPersonal={};c.$=el;c.L=(a,b)=>c.UI_EN?b:a;
check('The footer shows current room and real status stacks, removes expired effects and caches repeated renders',()=>{
 c.P.status={drain:4,weak:2};const before=JSON.stringify({p:c.P,g:c.G});c.renderMapStatus();c.renderMapStatus();
 assert.equal(el('roomLabel').textContent,'黑市驿站');assert(el('mapStatuses').innerHTML.includes('汲能 <b>4</b>'));assert(el('mapStatuses').innerHTML.includes('negative'));assert.equal(el('mapStatuses').writes,1);assert(el('mapStatusEmpty').hidden);assert.equal(JSON.stringify({p:c.P,g:c.G}),before);
 c.P.status={};c.renderMapStatus();assert(el('mapStatuses').hidden);assert(!el('mapStatusEmpty').hidden);c.UI_EN=true;c.renderMapStatus();assert.equal(el('mapStatusEmpty').textContent,'No active blessings or ailments');assert.equal(el('btnExpandStatus').textContent,'Expand ↗');c.UI_EN=false;
});
check('Expand opens active-effect and room details, blocks map keys and returns focus without changing the run',()=>{
 let stopped=0;c.autoOff=()=>stopped++;c.cancelWalk=()=>stopped++;c.P.status={drain:4,weak:2};c.P.heirGuard=1;const before=JSON.stringify({p:c.P,g:c.G});
 c.openMapStatus();assert.equal(stopped,2);assert.equal(c.anyVeil().id,'veilDungeonRules');assert.equal(el('rulesTitle').textContent,'当前冒险状态');assert.equal(el('btnExpandStatus').attrs['aria-expanded'],'true');assert(el('btnCloseDungeonRules').focused);
 for(const text of ['汲能 ×4','答对后每层回复 1% 最大生命','黑市驿站','遗物格挡 ×1'])assert(el('rulesList').innerHTML.includes(text),text);
 c.closeDungeonRules();assert(el('veilDungeonRules').hidden);assert.equal(el('btnExpandStatus').attrs['aria-expanded'],'false');assert(el('btnExpandStatus').focused);assert.equal(JSON.stringify({p:c.P,g:c.G}),before);
});
check('Town hides the footer and a run reveals it while the old log stays hidden in both scenes',()=>{
 const size=c.sizeMap,lookup=c.$;let sizes=0;c.sizeMap=()=>sizes++;c.$=id=>id==='navBag'?null:el(id);
 c.SCENE='town';c.showScene();assert(el('adventureStatus').hidden);assert(el('log').hidden);const count=el('rulesList').writes;c.openMapStatus();assert.equal(el('rulesList').writes,count);
 c.SCENE='run';c.showScene();assert(!el('adventureStatus').hidden);assert(!el('stageBox').hidden);assert(el('log').hidden);assert.equal(sizes,1);c.sizeMap=size;c.$=lookup;
});
check('Both pages move statuses out of the map, reserve a fixed footer and budget its height once at several viewport sizes',()=>{
 const css=read('style.css'),bar=css.match(/\.adventure-status\{([^}]+)/)[1],button=css.match(/\.status-expand\{([^}]+)/)[1];for(const rule of ['flex:0 0 96px','height:96px','min-height:96px','max-height:96px','overflow:hidden'])assert(bar.includes(rule));assert(button.includes('position:absolute')&&button.includes('right:8px')&&button.includes('bottom:5px'));
 for(const file of ['index.html','coop.html']){const html=read(file),a=html.indexOf('<section class="adventure-status"'),b=html.indexOf('</section>',a),footer=html.slice(a,b);for(const id of ['roomLabel','mapStatuses','mapStatusEmpty','btnExpandStatus']){assert(footer.includes('id="'+id+'"'));assert.equal(html.split('id="'+id+'"').length,2);}assert(!html.slice(html.indexOf('id="mapUi"'),a).includes('id="mapStatuses"'));assert(html.includes('<div id="log" hidden aria-hidden="true">'));}
 const stage=el('stageBox'),view=el('viewAdv'),map=el('map');stage.offsetHeight=300;el('adventureStatus').offsetHeight=96;el('log').offsetHeight=0;view.children=[stage,el('adventureStatus'),el('log')];view.clientWidth=393;c.document={querySelector:()=>stage};c.getComputedStyle=()=>({marginLeft:'0',marginRight:'0'});c.VIEW={};c.camera=()=>{};
 for(const height of [400,520,760,1040]){view.clientHeight=height;c.sizeMap();const availH=height-96-10,BW=c.CHAPTER.view.w,BH=c.CHAPTER.view.h,cell=Math.max(14,Math.min(46,Math.floor(389/BW),Math.floor((availH-2)/BH))),rows=Math.max(BH,Math.min(c.CHAPTER.viewMax.h,c.H,Math.floor((availH-2)/cell)));assert.equal(map._cellSize,cell);assert.equal(stage.style.height,(rows*cell+2)+'px');assert(rows*cell+2<=availH);}
});
console.log(groups+' map status checks passed.');
