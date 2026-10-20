/* Deterministic scenery contracts; props are never collision or loot entities. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),D=require('../dungeon-decor'),R=require('../dungeon-rooms');let groups=0;
function check(name,fn){fn();groups++;console.log('PASS '+name);}
check('Every room has a distinct scenery recipe; all vector assets are local, self-contained and atlas-sized',()=>{
 const assets=D.assets(),ids=new Set(assets.map(a=>a.id));assert.equal(ids.size,assets.length);assert(assets.length<=40);const recipes=new Set();
 for(const r of R.items){const t=D.themes[r.id];assert(t,r.id);recipes.add(t.props.join(',')+':'+t.ground);for(const id of [...t.props,t.ground])assert(ids.has(id),r.id+' '+id);}
 assert.equal(recipes.size,20);for(const a of assets){assert(a.svg.includes('viewBox="0 0 64 64"'));assert(!/\bid=|<image|<filter|<animate|https?:/.test(a.svg));}
});
check('Scenery never mutates floors: tall props stay on walls, decals stay in open rooms and density is bounded',()=>{
 for(const r of R.items)for(let chapter=1;chapter<=5;chapter++){
  const map=R.shape(r.layout,33,25).map,before=JSON.stringify(map),p=D.layout(map,r.id,chapter);assert.equal(JSON.stringify(map),before);assert(p.props.length<=10);assert(p.ground.length<=18);assert(p.props.length>=3,r.id);
  for(const q of p.props){assert.equal(map[q.y][q.x],0);assert(map[q.y+1][q.x]||map[q.y-1][q.x]);assert(q.height>1&&q.height<2);}
  for(const q of p.ground){assert(map[q.y][q.x]&&map[q.y-1][q.x]&&map[q.y+1][q.x]&&map[q.y][q.x-1]&&map[q.y][q.x+1]);}
 }
});
check('Identical worlds and room identities reproduce the same scene; repeated snapshots reuse a cached plan',()=>{
 const a=R.shape('pillars',33,25).map,b=a.map(r=>r.slice()),p=D.layout(a,'library',1);assert.equal(D.layout(a,'library',1),p);assert.deepEqual(D.layout(b,'library',1),p);assert.notDeepEqual(D.layout(a,'vault',1),p);assert.equal(D.layout(a,'unknown',1).id,'outpost');
});
check('Contact shadows attach only to wall-facing floor edges and do not create fog or hide walkable tiles',()=>{
 const map=R.shape('cross',33,25).map,p=D.layout(map,'spring',2),dirs={n:[0,-1],e:[1,0],s:[0,1],w:[-1,0]};assert(p.shadows.length>0);
 for(const q of p.shadows){const [dx,dy]=dirs[q.key.split(':')[1]];assert.equal(map[q.y][q.x],1);assert.equal(map[q.y+dy][q.x+dx],0);}
});
check('Boss/study themes and empty maps have safe deterministic scenes without creating interactable objects',()=>{
 const map=R.shape('court',33,25).map;assert.equal(D.layout(map,'boss',3).id,'boss');assert.equal(D.layout(map,'study',1).id,'study');const empty=Array.from({length:25},()=>Array(33).fill(0));assert.deepEqual(D.layout(empty,'camp',1),{id:'camp',props:[],ground:[],shadows:[]});for(const p of D.layout(map,'camp',1).props)assert(!('kind'in p)&&!('hp'in p));
});
check('Scene assets are prepared before the renderer; pure walking and collision source remain untouched',()=>{
 const preload=fs.readFileSync(path.join(__dirname,'..','preload.js'),'utf8'),game=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');assert(preload.indexOf("['dungeon-decor.js'")<preload.indexOf("['dungeon-gpu.js'"));assert(game.includes('scenery:DungeonDecor.assets()'));assert(game.includes('DungeonGPU.interact(x,y,"gold")'));assert(game.includes('DungeonGPU.interact(th.x,th.y,"chest")'));
 const cp=require('node:child_process'),base=cp.execFileSync('git',['show','97d292e:game.js'],{cwd:path.join(__dirname,'..'),encoding:'utf8'}).replace(/\r\n/g,'\n');for(const name of ['tryMove','stepWalk','goTo','findPath','camera','renderStep']){const a=game.indexOf('function '+name+'('),b=base.indexOf('function '+name+'(');assert.equal(game.slice(a,game.indexOf('\n}',a)+2).replace(/\r\n/g,'\n'),base.slice(b,base.indexOf('\n}',b)+2),name);}
});
console.log(groups+' scenery checks passed.');
