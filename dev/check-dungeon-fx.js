/* Run: node dev/check-dungeon-fx.js. UI lifecycle + actual damage settlement hooks. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..'),timers=new Map(),nodes=[],listeners={};let nextTimer=0,groups=0,layoutReads=0;
function element(id){
 const el={id,children:[],style:{setProperty(k,v){this[k]=v;}},className:'',hidden:false,offsetWidth:30,offsetHeight:30,offsetLeft:0,offsetTop:0,
  setAttribute(k,v){this[k]=v;},addEventListener(){},getClientRects(){return [{}];},getBoundingClientRect(){layoutReads++;return {left:10,top:10,width:40,height:40};},
  appendChild(n){n.parentNode=this;this.children.push(n);},remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);},
  animate(frames,options){const a={frames,options,cancelled:false,cancel(){this.cancelled=true;},finished:new Promise(()=>{})};this.lastMotion=a;return a;}};
 return el;
}
const ids={};['veilBattle','foeArt','meArt','combo'].forEach(id=>ids[id]=element(id));
const body=element('body'),media={matches:false,addEventListener(k,f){this.changed=f;}};
const document={body,hidden:false,getElementById:id=>ids[id],createElement(){const n=element();nodes.push(n);return n;},addEventListener(k,f){listeners[k]=f;}};
const window={matchMedia:()=>media,addEventListener(k,f){listeners[k]=f;}};
const c=vm.createContext({window,document,L:a=>a,console,setTimeout(f){const i=++nextTimer;timers.set(i,f);return i;},clearTimeout:i=>timers.delete(i)});
vm.runInContext(fs.readFileSync(path.join(root,'dungeon-fx.js'),'utf8'),c);const fx=window.DungeonFX;
function drain(){for(const [id,f] of [...timers]){timers.delete(id);f();}}
function check(name,f){f();groups++;console.log('PASS '+name);}
const count=type=>body.children.filter(n=>n.className.includes(type)).length;
check('Attack and critical hits are distinct, decorative, and bounded under rapid input',()=>{
 fx.attack(false);assert.equal(count('dfx-slash'),1);assert.equal(count('dfx-spark'),5);
 assert(body.children.every(n=>n['aria-hidden']==='true'));
 fx.resetBattle();fx.attack(true);assert.equal(count('dfx-slash'),2);assert.equal(count('dfx-spark'),9);
 for(let i=0;i<20;i++)fx.attack(true);assert(body.children.length<=48);drain();assert.equal(body.children.length,0);
});
check('Critical and kill particle bursts share geometry reads instead of one layout read per particle',()=>{
 fx.resetBattle();let before=layoutReads;fx.attack(true);assert.equal(layoutReads-before,2);drain();
 before=layoutReads;fx.kill();assert.equal(layoutReads-before,3);fx.resetBattle();drain();
});
check('Attacks travel toward the other lane; incoming attacks reverse direction and clean up',()=>{
 const foeRect=ids.foeArt.getBoundingClientRect,meRect=ids.meArt.getBoundingClientRect;
 ids.foeArt.getBoundingClientRect=()=>({left:180,top:30,width:40,height:40});
 ids.meArt.getBoundingClientRect=()=>({left:30,top:180,width:40,height:40});
 fx.resetBattle();fx.attack(false);
 let bolt=body.children.find(n=>n.className==='dfx dfx-bolt');assert(bolt);
 assert(bolt.lastMotion.frames.at(-1).transform.includes('150px'));
 assert(bolt.lastMotion.frames.at(-1).transform.includes('-150px'));
 assert.match(ids.meArt.lastMotion.frames[1].transform,/translate\([\d.]+px,-[\d.]+px\)/);
 fx.resetBattle();fx.block();bolt=body.children.find(n=>n.className==='dfx dfx-bolt');assert(bolt);
 assert.match(ids.foeArt.lastMotion.frames[1].transform,/translate\(-[\d.]+px,[\d.]+px\)/);
 const animation=bolt.lastMotion;drain();assert(animation.cancelled);assert.equal(body.children.length,0);
 ids.foeArt.getBoundingClientRect=foeRect;ids.meArt.getBoundingClientRect=meRect;
});
check('Shield, HP damage, dodge, and healing have separate feedback',()=>{
 fx.hurt(0,8);assert.equal(count('dfx-guard'),1);assert.equal(count('dfx-hurt'),0);drain();
 fx.hurt(3,2);assert.equal(count('dfx-guard'),1);assert.equal(count('dfx-hurt'),1);drain();
 fx.dodge();assert.equal(count('dfx-ghost'),1);assert.equal(count('dfx-hurt'),0);drain();
 fx.heal();assert.equal(count('dfx-heal'),1);drain();
});
check('Combo milestones burst; kills stay dissolved until battle reset',()=>{
 fx.combo(4,false);assert.equal(count('combo-burst'),0);fx.combo(5,true);assert.equal(count('combo-burst'),1);drain();
 fx.kill();const death=ids.foeArt.lastMotion;assert.equal(death.options.fill,'forwards');assert.equal(death.frames.at(-1).opacity,0);
 fx.resetBattle();assert(death.cancelled);assert.equal(body.children.length,0);
});
check('Movement trails track world coordinates; stationary renders and teleports do not spawn them',()=>{
 const map=element('map'),world=[],cells=Array.from({length:8},(_,i)=>{const n=element();n.offsetLeft=i%4*30;n.offsetTop=Math.floor(i/4)*30;return n;});
 const move=(x,y,w=world)=>fx.move(map,cells,4,w,x,y,'<svg></svg>',' hr-adv');
 move(0,0);assert.equal(map.children.length,0);move(1,0);assert.equal(map.children.length,3);
 assert.equal(map.children[0].style.left,'0px');assert.equal(map.children[2].style.left,'20px');
 move(1,0);assert.equal(map.children.length,3);move(3,1);assert.equal(map.children.length,3);
 move(0,0,[]);assert.equal(map.children.length,0);move(0,0);
 for(let i=0;i<20;i++)move(i%2?0:1,0);assert(map.children.length<=12);drain();assert.equal(map.children.length,0);
});
check('Reduced motion, hidden documents, and hidden battle skip effects and clean up',()=>{
 fx.attack(true);media.matches=true;media.changed();assert.equal(body.children.length,0);fx.attack(true);assert.equal(body.children.length,0);
 media.matches=false;fx.attack(false);document.hidden=true;listeners.visibilitychange();assert.equal(body.children.length,0);fx.hurt(3,0);assert.equal(body.children.length,0);
 document.hidden=false;ids.veilBattle.hidden=true;fx.kill();assert.equal(body.children.length,0);ids.veilBattle.hidden=false;
});
// Extract real settlement functions so effects cannot drift from damage semantics.
const source=fs.readFileSync(path.join(root,'game.js'),'utf8').replace(/\r\n/g,'\n'),calls=[];
Object.assign(c,{DungeonFX:{hurt:(...v)=>calls.push(['hurt',...v]),block:()=>calls.push(['block']),dodge:()=>calls.push(['dodge']),heal:()=>calls.push(['heal'])},
 studyNoHurt:()=>false,HR:null,lastHurtRec:null,clampShield(){},hasRelic:()=>false,heroOn:()=>false,heirEvent(){},flaskDrink(){},floatNum(){},T:x=>x,P:{},G:{},B:{},stats:()=>({maxHp:100})});
window.DungeonFX=c.DungeonFX;
for(const name of ['hurtEnd','landHit','healUp']){const i=source.indexOf('function '+name+'('),j=source.indexOf('\n}',i);assert(i>=0&&j>i);vm.runInContext(source.slice(i,j+2),c);}
check('Actual damage hook reports HP and shield amounts without changing damage',()=>{
 c.P={hp:100,shield:7};c.G={};c.HR=null;calls.length=0;c.landHit(5,{name:'Test'},false);
 assert.equal(c.P.hp,100);assert.equal(c.P.shield,2);assert.deepEqual(calls,[['hurt',0,5]]);
 calls.length=0;c.landHit(5,{name:'Test'},false);assert.equal(c.P.hp,97);assert.equal(c.P.shield,0);assert.deepEqual(calls,[['hurt',3,2]]);
});
check('Actual avoidance hook distinguishes dodge, full block, practice, and ordinary damage',()=>{
 for(const [rows,final,expected] of [[{slip:-5},0,'dodge'],[{glimmer:-5},0,'dodge'],[{echo:-5},0,'block'],[{},3,null]]){
  calls.length=0;c.HR={rows};c.hurtEnd(final);assert.deepEqual(calls,expected?[[expected]]:[]);assert.equal(c.lastHurtRec.total,final);assert.equal(c.HR,null);
 }
 c.studyNoHurt=()=>true;c.HR={rows:{'@practice':-5}};calls.length=0;c.hurtEnd(0);assert.equal(calls.length,0);
});
check('Healing feedback requires actual HP recovery in battle',()=>{
 c.P={hp:90};c.B={};calls.length=0;c.healUp(5);assert.equal(c.P.hp,95);assert.deepEqual(calls,[['heal']]);
 c.P.hp=100;calls.length=0;c.healUp(5);assert.equal(calls.length,0);
 c.P.hp=90;c.B=null;c.healUp(5);assert.equal(c.P.hp,95);assert.equal(calls.length,0);
});
console.log(groups+' animation checks passed.');
