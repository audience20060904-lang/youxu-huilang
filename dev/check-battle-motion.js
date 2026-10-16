/* node dev/check-battle-motion.js — real FX timeline in an arena, compositing and cancellation. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'..','dungeon-fx.js'),'utf8');let groups=0;
function check(name,fn){fn();groups++;console.log('PASS '+name);}
function setup(){
 let now=0,id=0,reads=0,max=0;const timers=new Map(),ids={},created=[],listeners={},hits=[];
 function el(name,rect){return {id:name,style:{setProperty(k,v){this[k]=v;}},children:[],className:'',textContent:'',innerHTML:'',hidden:false,
  setAttribute(){},addEventListener(){},getClientRects:()=>[{}],getBoundingClientRect(){reads++;return rect||{left:0,top:0,width:30,height:30};},
  appendChild(n){n.parent=this;this.children.push(n);max=Math.max(max,this.children.length);if(n.className.includes('round-hit'))hits.push({at:now,n});},
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);},
  querySelector(){return this.svg||null;},animate(frames,options){const a={frames,options,cancelled:false,cancel(){this.cancelled=true;},finished:new Promise(()=>{})};this.motion=a;return a;}};}
 for(const name of ['veilBattle','battleEffects','foeArt','meArt','foeFill','foeTxt','battlePet','combo',...Array.from({length:12},(_,i)=>'battleSoul'+i)]){
  const rect=name==='battleEffects'?{left:100,top:50,width:360,height:280}:name==='foeArt'?{left:300,top:80,width:40,height:40}:{left:130,top:240,width:40,height:40};
  ids[name]=el(name,rect);if(['foeArt','meArt','battlePet'].includes(name)||name.startsWith('battleSoul')){ids[name].svg=el(name+'SVG');ids[name].svg.outerHTML='<svg data-avatar="'+name+'"></svg>';}
 }
 const body=el('body'),media={matches:false,addEventListener(_,fn){this.change=fn;}};
 const document={body,hidden:false,getElementById:id=>ids[id],querySelector:()=>ids.battlePet,createElement(){const n=el();created.push(n);return n;},addEventListener:(k,f)=>listeners[k]=f};
 const c=vm.createContext({window:{matchMedia:q=>q.includes('prefers-reduced-motion')?media:{matches:true},addEventListener:(k,f)=>listeners[k]=f},document,L:(a,b)=>b,setTimeout(fn,ms){timers.set(++id,{fn,at:now+(ms||0)});return id;},clearTimeout:n=>timers.delete(n)});
 vm.runInContext(code,c);
 function advance(to){while(true){const n=[...timers].filter(x=>x[1].at<=to).sort((a,b)=>a[1].at-b[1].at)[0];if(!n)break;now=n[1].at;timers.delete(n[0]);n[1].fn();}now=to;}
 const fx=c.window.DungeonFX;
 return {fx,ids,body,media,document,listeners,created,hits,advance,get reads(){return reads},get max(){return max},get now(){return now},get pending(){return timers.size}};
}
check('Projectiles arrive with hits; effects use clipped arena coordinates and animate only avatar SVGs',()=>{
 const t=setup(),{fx,ids}=t;ids.foeFill.style.width='70%';ids.foeTxt.textContent='70 / 100';
 fx.playRound([{hero:'adv',kind:'strike',damage:30}],{hp:100,max:100,end:70});assert.equal(t.reads,3);
 t.advance(0);const bolt=t.created.find(n=>n.className==='dfx dfx-bolt');assert.equal(bolt.parent,ids.battleEffects);assert.equal(bolt.style.left,'50px');assert.equal(bolt.style.top,'210px');
 assert.equal(bolt.motion.options.duration,90);assert.equal(bolt.motion.frames.at(-1).opacity,0);assert(bolt.motion.frames.at(-1).transform.includes('170px'));assert(bolt.motion.frames.at(-1).transform.includes('-160px'));
 assert(ids.meArt.svg.motion);assert.equal(ids.meArt.motion,undefined);assert.equal(t.body.children.length,0);
 t.advance(89);assert.equal(t.hits.length,0);t.advance(90);assert.equal(t.hits.length,1);assert(ids.foeArt.svg.motion);assert.equal(t.reads,3);
});
check('Soul, pet and spell use their own sources and shapes without moving the pet with the hero',()=>{
 const t=setup(),{fx,ids}=t;
 fx.playRound([{hero:'necro',kind:'soul',index:0,damage:5},{hero:'tamer',kind:'pet',damage:5},{hero:'mage',kind:'strike',damage:5}],{hp:100,max:100,end:85});
 t.advance(0);assert(ids.battleSoul0.svg.motion);assert.equal(ids.meArt.svg.motion,undefined);assert(t.created.at(-1).innerHTML.includes('M23 80V43'));
 t.advance(150);assert(ids.battlePet.svg.motion);assert(t.created.at(-1).innerHTML.includes('M23 8Q20'));
 t.advance(300);assert(ids.meArt.svg.motion);assert(t.created.at(-1).innerHTML.includes('M52 5Q76'));
 t.advance(390);assert.equal(t.hits.length,3);
});
check('Segmented health uses transform rather than width frames and restores a lethal zero-width bar',()=>{
 const t=setup(),{fx,ids}=t;ids.foeFill.style.width='0%';ids.foeTxt.textContent='0 / 100';
 fx.playRound([{hero:'adv',damage:30},{hero:'adv',damage:70}],{hp:100,max:100,end:0});assert.equal(ids.foeFill.style.width,'100%');
 t.advance(90);assert.equal(ids.foeTxt.textContent,'70 / 100');assert.equal(ids.foeFill.motion.frames.at(-1).transform,'scaleX(0.7)');assert(ids.foeFill.motion.frames.every(f=>!('width' in f)));
 t.advance(240);assert.equal(ids.foeFill.motion.frames.at(-1).transform,'scaleX(0)');t.advance(340);assert.equal(ids.foeFill.style.width,'0%');assert(ids.foeFill.motion.cancelled);
 fx.resetRound();assert.equal(ids.foeFill.style.width,'0%');assert.equal(ids.foeTxt.textContent,'0 / 100');
});
check('Interrupting a round restores authoritative health and cancels every pending impact and avatar motion',()=>{
 const t=setup(),{fx,ids}=t;ids.foeFill.style.width='45%';ids.foeTxt.textContent='45 / 100';
 fx.playRound(Array.from({length:12},()=>({hero:'adv',damage:5})),{hp:100,max:100,end:45});t.advance(100);assert.equal(t.hits.length,1);
 fx.resetRound();assert.equal(ids.foeFill.style.width,'45%');assert.equal(ids.foeTxt.textContent,'45 / 100');assert(ids.meArt.svg.motion.cancelled);assert.equal(t.pending,0);assert.equal(ids.battleEffects.children.length,0);
 t.advance(3000);assert.equal(t.hits.length,1);
});
check('A player damage/guard response survives simultaneous outgoing hits, but is cancelled by a new question',()=>{
 const t=setup(),{fx,ids}=t;fx.hurt(3,2);fx.playRound([{hero:'adv',damage:5}],{hp:100,max:100,end:95});
 t.advance(89);assert(!t.created.some(n=>n.className==='dfx dfx-hurt'));t.advance(90);
 for(const cls of ['dfx dfx-hurt','dfx dfx-guard'])assert(t.created.some(n=>n.className===cls));assert.equal(t.hits.length,1);
 fx.resetRound();const count=t.created.length;fx.hurt(2,0);fx.resetRound();t.advance(2000);assert(!t.created.slice(count).some(n=>n.className==='dfx dfx-hurt'));assert.equal(ids.battleEffects.children.length,0);
});
check('Dense critical summons keep all hits, stagger numbers, cache geometry and emit one small critical burst',()=>{
 const t=setup(),{fx}=t;fx.playRound(Array.from({length:12},(_,i)=>({hero:'necro',kind:'soul',index:i,damage:1,crit:true})),{hp:100,max:100,end:88});assert.equal(t.reads,14);
 t.advance(2000);assert.equal(t.hits.length,12);assert.equal(t.reads,14);assert(t.max<=48);
 const numbers=t.created.filter(n=>n.className.includes('round-number'));assert.equal(numbers.length,12);assert.equal(new Set(numbers.map(n=>n.style.left)).size,3);
 assert.equal(t.created.filter(n=>n.className==='dfx dfx-text critical').length,1);assert.equal(t.created.filter(n=>n.className==='dfx dfx-spark critical').length,2);
});
check('Hidden/reduced-motion cleanup restores bars; dodge ghosts exclude pets and defeat animates only the model',()=>{
 const t=setup(),{fx,ids}=t;ids.foeFill.style.width='90%';ids.foeTxt.textContent='90 / 100';fx.playRound([{hero:'adv',damage:10}],{hp:100,max:100,end:90});
 t.document.hidden=true;t.listeners.visibilitychange();assert.equal(ids.foeFill.style.width,'90%');assert.equal(t.pending,0);assert.equal(ids.battleEffects.children.length,0);
 t.document.hidden=false;fx.dodge();const ghost=t.created.find(n=>n.className==='dfx dfx-ghost');assert.equal(ghost.innerHTML,'<svg data-avatar="meArt"></svg>');fx.resetBattle();
 fx.kill();assert.equal(ids.foeArt.svg.motion.options.fill,'forwards');assert.equal(ids.foeArt.svg.motion.frames.at(-1).opacity,0);assert.equal(ids.foeArt.motion,undefined);
 t.media.matches=true;t.media.change();assert.equal(ids.battleEffects.children.length,0);assert.equal(fx.playRound([{damage:1}],{hp:10,max:10,end:9}),0);
});
check('Arena-local paths compensate for the entrance scale animation',()=>{
 const t=setup(),{fx,ids}=t;ids.battleEffects.clientWidth=400;ids.battleEffects.clientHeight=280;
 fx.playRound([{hero:'adv',damage:1}],{hp:100,max:100,end:99});t.advance(0);
 const bolt=t.created.find(n=>n.className==='dfx dfx-bolt');assert(Math.abs(parseFloat(bolt.style.left)-50/.9)<.0001);assert.equal(bolt.style.top,'210px');
 t.advance(90);const impact=t.hits[0].n;assert(Math.abs(parseFloat(impact.style.left)-220/.9)<.0001);assert.equal(impact.style.top,'50px');
});
console.log(groups+' battle motion checks passed.');
