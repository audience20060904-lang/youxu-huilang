const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const cache=require('../learning-cache'),source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8').replace(/\r\n/g,'\n');
let groups=0;function check(name,f){f();groups++;console.log('PASS '+name);}
check('Cached pools preserve the old six-word fallback and isolate language arrays',()=>{
 const all=Array.from({length:60},(_,i)=>({en:String(i),lv:1+i%3})),small=all.slice(0,3);
 const a=cache.scope(all,[1,2],all);assert.equal(a.length,40);assert.equal(cache.scope(all,[2,1,1],all),a);
 assert.deepEqual(cache.scope(small,[1],all),all.filter(w=>w.lv===1));assert.equal(cache.scope(small,[9],all),small);
 const changed=all.slice();assert.notEqual(cache.scope(changed,[1,2],changed),a);cache.clear();assert.notEqual(cache.scope(all,[1,2],all),a);
});
check('Prefix draws match every original integer-bag position, including zero weights',()=>{
 const words=['a','b','c','d','e'],weights=[4,0,11,1,7],bag=words.flatMap((w,i)=>Array(weights[i]).fill(w));
 let value=0;const draw=cache.weighted(words,w=>weights[words.indexOf(w)],()=>value);
 for(let i=0;i<bag.length;i++){value=(i+.25)/bag.length;assert.equal(draw(),bag[i]);}
 assert.equal(cache.weighted([],()=>1)(),null);
});
check('Weights are rebuilt from current progress while static scope cache remains valid',()=>{
 let weights={a:4,b:1};const words=['a','b'];let point=.5;const first=cache.weighted(words,w=>weights[w],()=>point);
 assert.equal(first(),'a');weights={a:1,b:4};const next=cache.weighted(words,w=>weights[w],()=>point);assert.equal(next(),'b');
});
const load=(name,c)=>{const i=source.indexOf('function '+name+'('),j=source.indexOf('\n}',i);assert(i>=0&&j>i,name);vm.runInContext(source.slice(i,j+2),c);};
check('Hidden information and inventory perform no stat/LEX/list rendering; bag count stays current',()=>{
 const ids={bagDot:{},viewInfo:{classList:{contains:()=>false}},viewRelic:{classList:{contains:()=>false}}};let mate=0,relic=0;
 const c=vm.createContext({P:{relics:['a','b']},$:id=>ids[id],renderMate:()=>mate++,renderRelics:()=>relic++});load('renderSheets',c);c.renderSheets({});
 assert.equal(ids.bagDot.textContent,2);assert.equal(ids.bagDot.hidden,false);assert.equal(mate,1);assert.equal(relic,0);
 ids.viewRelic.classList.contains=()=>true;c.renderSheets({});assert.equal(relic,1);
});
check('Map redraws do not rewrite unchanged classes or scan solo cells for teammates',()=>{
 const c=vm.createContext({COOP:false});load('paintMapCell',c);load('paintMapClass',c);let classes=0,html=0,queries=0,value='c floor dot',markup='';
 const cell={get className(){return value;},set className(v){classes++;value=v;},set innerHTML(v){html++;markup=v;},querySelector(){queries++;}};
 for(let i=0;i<100;i++){c.paintMapClass(cell,'c floor dot');c.paintMapCell(cell,'');}
 assert.equal(classes,0);assert.equal(html,1);assert.equal(queries,0);c.paintMapClass(cell,'c floor mob');assert.equal(classes,1);
});
console.log(groups+' learning performance checks passed.');
