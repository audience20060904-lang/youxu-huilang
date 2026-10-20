/* Real startup controller with simulated network/paint, including failure paths. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'..','preload.js'),'utf8');
async function run(fail,coop=false,style=true){
 const events=[],listeners={},ids={};for(const id of ['gameLoader','loadStatus','loadProgress','loadCount','loadRetry','gameStyle'])ids[id]={hidden:false,dataset:{},addEventListener(){}};
 ids.loadRetry.hidden=true;ids.gameStyle.sheet=style?{}:null;const app={inert:false};let c;
 const done=new Promise(resolve=>listeners.done=resolve);
 const document={head:{appendChild(el){
  if(el.rel){events.push(['preload',el.href]);return;}
  events.push(['script',el.src]);Promise.resolve().then(()=>{
   if(el.src.startsWith(fail+'?')){el.onerror();return;}
   if(el.src.startsWith('game.js?'))c.window.GameBoot.register({prepare:[{label:'words',run(){events.push(['prepare']);}},{label:'art',run(){events.push(['prepare']);}}],start(){events.push(['start']);}});
   el.onload();
  });}},
  getElementById:id=>ids[id],querySelector:s=>s==='.app'?app:coop?{}:null,createElement:()=>({remove(){}}),
  addEventListener(k,f){listeners[k]=f;},removeEventListener(k){delete listeners[k];},documentElement:{classList:{remove(){}}},
  dispatchEvent(e){events.push([e.type]);listeners.done();}};
 const window={addEventListener(){}};
 c=vm.createContext({window,document,location:{reload(){}},Event:class{constructor(type){this.type=type;}},setTimeout,clearTimeout,requestAnimationFrame:f=>{events.push(['frame']);Promise.resolve().then(f);}});
 vm.runInContext(code,c);await done;return {events,app,ids,window};
}
(async()=>{
 let groups=0;
 for(const coop of [false,true]){
  const r=await run(null,coop),scripts=r.events.filter(e=>e[0]==='script').map(e=>e[1].split('?')[0]),preloads=r.events.filter(e=>e[0]==='preload');
  assert.equal(scripts.length,25);assert.equal(preloads.length,25);assert.equal(scripts[0],'util.js');assert.equal(scripts.at(-1),'game.js');
  assert(scripts.indexOf('art.js')<scripts.indexOf('monster-art.js'));assert(scripts.indexOf('learning-cache.js')<scripts.indexOf('game.js'));
  assert(scripts.includes(coop?'net.js':'i18n-en.js'));for(const file of scripts)assert(fs.existsSync(path.join(__dirname,'..',file)),file);assert.equal(r.app.inert,false);assert.equal(r.ids.gameLoader.hidden,true);assert.equal(r.ids.loadCount.textContent,'100%');
  assert.equal(r.events.filter(e=>e[0]==='prepare').length,2);assert(r.events.filter(e=>e[0]==='frame').length>=40);
  assert(r.events.findIndex(e=>e[0]==='start')>r.events.findIndex(e=>e[0]==='prepare'));groups++;console.log('PASS '+(coop?'Coop':'Solo')+' preloads once, executes in dependency order, paints progress, prepares before starting');
 }
 for(const file of ['pixi.min.js','dungeon-gpu.js']){const r=await run(file);assert(r.events.some(e=>e[0]==='start'));assert.equal(r.app.inert,false);assert.equal(r.ids.gameLoader.hidden,true);groups++;console.log('PASS Optional '+file+' failure still starts compatible game');}
 for(const [file,style] of [['content.js',true],[null,false]]){
  const r=await run(file,false,style);assert(!r.events.some(e=>e[0]==='start'));assert.equal(r.app.inert,true);assert.equal(r.ids.loadRetry.hidden,false);assert.equal(r.ids.gameLoader.hidden,false);assert.equal(r.ids.gameLoader.dataset.failed,'true');
  groups++;console.log('PASS '+(style?'Module':'Stylesheet')+' failure keeps game gated and offers retry');
 }
 console.log(groups+' preload checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
