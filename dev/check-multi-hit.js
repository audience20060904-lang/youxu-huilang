/* node dev/check-multi-hit.js — staggered summon attacks, cancellation and preserved totals. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/\r\n/g,'\n');let groups=0;
function check(name,fn){fn();groups++;console.log('PASS '+name);}
const game=read('game.js'),c=vm.createContext({B:{fxHits:[]},P:{hero:'necro'}});
const i=game.indexOf('function queueVisualHit('),j=game.indexOf('\n}',i);vm.runInContext(game.slice(i,j+2),c);
check('Splitting an integer damage budget never duplicates or drops damage, including small totals',()=>{
 for(const total of [0,1,5,81,10001])for(const n of [1,5,12,17]){c.B.fxHits=[];c.queueVisualHit('necro','soul',total,n,0,false);assert.equal(c.B.fxHits.length,n);assert.equal(c.B.fxHits.reduce((n,h)=>n+h.damage,0),total);assert(c.B.fxHits.every(h=>Number.isInteger(h.damage)&&h.damage>=0));}
 c.B={};assert.equal(c.queueVisualHit('tamer','pet',10),false);
});
let now=0,id=0,maxNodes=0;const timers=new Map(),events=[],listeners={},ids={};
function el(name){return {id:name,hidden:false,style:{setProperty(){}},children:[],className:'',textContent:'',
 setAttribute(){},addEventListener(){},getClientRects:()=>[{}],getBoundingClientRect:()=>({left:name==='meArt'?20:140,top:name==='foeArt'?30:160,width:32,height:32}),
 appendChild(n){n.parent=this;this.children.push(n);maxNodes=Math.max(maxNodes,this.children.length);if(n.className.includes('round-hit'))events.push({time:now,kind:n.className});},
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);},
 animate(frames,options){const a={frames,options,cancelled:false,cancel(){this.cancelled=true},finished:new Promise(()=>{})};this.motion=a;return a;}};}
for(const id of ['veilBattle','meArt','foeArt','foeFill','foeTxt','battleSoul0','battlePet'])ids[id]=el(id);
const body=el('body'),media={matches:false,addEventListener(_,fn){this.change=fn;}},document={hidden:false,body,getElementById:id=>ids[id],querySelector:()=>ids.battlePet,createElement:()=>el(),addEventListener:(k,f)=>listeners[k]=f};
const ctx=vm.createContext({window:{matchMedia:q=>q.includes('prefers-reduced-motion')?media:{matches:false},addEventListener:(k,f)=>listeners[k]=f},document,L:a=>a,setTimeout(f,ms){const n=++id;timers.set(n,{fn:f,at:now+(ms||0)});return n;},clearTimeout:n=>timers.delete(n)});
vm.runInContext(read('dungeon-fx.js'),ctx);const fx=ctx.window.DungeonFX;
function advance(target){while(true){const next=[...timers].filter(x=>x[1].at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=target;}
check('Player, soul and pet have distinct launch times, impact times and source actors',()=>{
 ids.foeTxt.textContent='40 / 100';ids.foeFill.style.width='40%';const duration=fx.playRound([{hero:'necro',kind:'strike',damage:20},{hero:'necro',kind:'soul',damage:30,index:0},{hero:'tamer',kind:'pet',damage:10}],{hp:100,max:100,end:40});
 assert.equal(duration,550);advance(0);assert(ids.meArt.motion);assert(!ids.battleSoul0.motion);assert.equal(events.length,0);
 advance(90);assert.equal(events.length,1);assert.equal(ids.foeTxt.textContent,'80 / 100');
 advance(150);assert(ids.battleSoul0.motion);advance(240);assert.equal(events.length,2);assert.equal(ids.foeTxt.textContent,'50 / 100');
 advance(300);assert(ids.battlePet.motion);advance(390);assert.deepEqual(events.map(x=>x.time),[90,240,390]);assert.equal(ids.foeTxt.textContent,'40 / 100');assert.equal(ids.foeFill.motion.frames.at(-1).transform,'scaleX(0.4)');advance(490);assert.equal(ids.foeFill.style.width,'40%');assert(ids.foeFill.motion.cancelled);
});
check('Starting another question cancels pending hits and restores authoritative health text',()=>{
 fx.resetRound();events.length=0;ids.foeTxt.textContent='80 / 100';const start=now;
 fx.playRound([{hero:'necro',kind:'strike',damage:10},{hero:'necro',kind:'soul',damage:10}],{hp:100,max:100,end:80});advance(start+100);assert.equal(events.length,1);
 fx.resetRound();advance(start+1000);assert.equal(events.length,1);assert.equal(ids.foeTxt.textContent,'80 / 100');assert.equal(body.children.length,0);
});
check('Twelve soul attacks remain separate, remain bounded and are cleaned up after playback',()=>{
 events.length=0;const start=now;const hits=Array.from({length:12},(_,i)=>({hero:'necro',kind:'soul',damage:1,index:i}));
 fx.playRound(hits,{hp:100,max:100,end:88});advance(start+2000);assert.equal(events.length,12);assert(events.every((x,i)=>!i||x.time-events[i-1].time===85));assert(maxNodes<=48);fx.resetRound();assert.equal(body.children.length,0);
});
check('Reduced motion and hidden pages cancel the queue and prevent decorative work',()=>{
 media.matches=true;media.change();assert.equal(fx.playRound([{damage:1}],{hp:10,max:10,end:9}),0);assert.equal(body.children.length,0);
 media.matches=false;fx.playRound([{hero:'tamer',kind:'pet',damage:1}],{hp:10,max:10,end:9});document.hidden=true;listeners.visibilitychange();advance(now+1000);assert.equal(body.children.length,0);document.hidden=false;
});
check('Large queues stay short and bounded; shared/infinite health text keeps real-time updates',()=>{
 fx.resetRound();events.length=0;maxNodes=0;const start=now;
 ids.foeTxt.textContent='Live HP';const duration=fx.playRound(Array.from({length:30},()=>({hero:'necro',kind:'soul',damage:1})),{hp:100,max:100,end:70,study:true});
 ids.foeTxt.textContent='Peer updated HP';advance(start+duration+1000);assert.equal(events.length,30);assert(duration<=1500);assert(maxNodes<=48);
 assert.equal(ids.foeTxt.textContent,'Peer updated HP');fx.resetRound();assert.equal(ids.foeTxt.textContent,'Peer updated HP');assert.equal(body.children.length,0);
});
console.log(groups+' multi-hit checks passed.');
