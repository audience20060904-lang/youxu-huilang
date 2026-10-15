/* node dev/check-dungeon-scene.js: retained SVG actors, resize, camera discontinuities. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
let created=0,groups=0;
function node(){return {children:[],style:{setProperty(k,v){this[k]=v;}},dataset:{},offsetWidth:30,offsetLeft:0,offsetTop:0,isConnected:false,
 setAttribute(){},appendChild(n){n.parent=this;n.isConnected=true;this.children.push(n);},remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.isConnected=false;}};}
const c=vm.createContext({document:{createElement(){created++;return node();},getElementById(){return null;}}});
vm.runInContext('var COIN,CHEST,SPRING,ALTAR,SHOP,STAIR;'+fs.readFileSync(path.join(__dirname,'..','dungeon-scene.js'),'utf8'),c);
const scene=c.DungeonScene,map=node(),grid=[[1,1]],cells=[node(),node()];cells[1].offsetLeft=30;
function paint(x=0,g=grid,pet=true){scene.paint(map,cells,2,g,x,0,'<svg><path/></svg>',pet,1);}
function check(name,f){f();groups++;console.log('PASS '+name);}
check('All six scene assets are self-contained SVGs with no colliding IDs',()=>{
 for(const name of ['COIN','CHEST','SPRING','ALTAR','SHOP','STAIR']){assert(c[name].startsWith('<svg'));assert(c[name].includes('viewBox="0 0 32 32"'));assert(!/\bid=/.test(c[name]));assert(c[name].includes('aria-hidden="true"'));}
});
check('Repeated renders retain the same actor/SVG nodes and a single companion',()=>{
 paint();const actor=map.children[0],pet=map.children[1];assert.equal(created,2);
 for(let i=0;i<20;i++)paint(i%2);assert.equal(created,2);assert.equal(map.children.length,2);assert.equal(map.children[0],actor);assert.equal(map.children[1],pet);assert.equal(actor.style.transition,'');
});
check('Resize snaps positions without recreating currentColor SVG actors',()=>{
 const actor=map.children[0];cells.forEach(n=>n.offsetWidth=20);cells[1].offsetLeft=20;paint(1);
 assert.equal(created,2);assert.equal(map.children[0],actor);assert.equal(actor.style.width,'20px');assert.equal(actor.style.transform,'translate(20px,0px)');assert.equal(actor.style.transition,'none');
 paint(0);assert.equal(actor.style.transition,'');paint(0,grid,false);assert.equal(map.children[1].hidden,true);
});
check('New floors discard old actors; ordinary movement interpolates, teleports and resize snap',()=>{
 const old=map.children[0];paint(0,[[1,1]]);assert(!old.isConnected);assert.equal(map.children.length,2);
 scene.camera(map,0,0,grid,20);assert.equal(map.style.transition,'none');scene.camera(map,-20,0,grid,20);assert.equal(map.style.transition,'');
 scene.camera(map,-200,0,grid,20);assert.equal(map.style.transition,'none');scene.camera(map,-210,0,grid,10);assert.equal(map.style.transition,'none');scene.camera(map,-220,0,[],10);assert.equal(map.style.transition,'none');
});
console.log(groups+' scene checks passed.');
