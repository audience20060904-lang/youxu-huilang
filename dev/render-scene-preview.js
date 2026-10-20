/* Static art contact sheet, not a browser screenshot or a WebGL benchmark.
   SCENE_SHARP can point at a bundled sharp module; output path is required. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sharp=require(process.env.SCENE_SHARP||'sharp'),D=require('../dungeon-decor'),R=require('../dungeon-rooms'),V=require('../dungeon-view');
const root=path.join(__dirname,'..'),output=process.argv[2];if(!output)throw Error('Pass an output PNG path');
const c=vm.createContext({});for(const f of ['content.js','art.js','monster-art.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c);
const source=fs.readFileSync(path.join(root,'dungeon-gpu.js'),'utf8'),start=source.indexOf('  function paintTile('),end=source.indexOf('  async function prepare(',start),paint=new Function(source.slice(start,end)+'\nreturn paintTile;')();
function tile(type,palette,v){
 const parts=[];let d='';const ctx={fillStyle:'#000',strokeStyle:'#000',lineWidth:1,
  fillRect(x,y,w,h){parts.push('<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+this.fillStyle+'"/>');},beginPath(){d='';},moveTo(x,y){d+='M'+x+' '+y;},lineTo(x,y){d+='L'+x+' '+y;},closePath(){d+='Z';},fill(){parts.push('<path d="'+d+'" fill="'+this.fillStyle+'"/>');},stroke(){parts.push('<path d="'+d+'" fill="none" stroke="'+this.strokeStyle+'" stroke-width="'+this.lineWidth+'"/>');}};
 paint(ctx,type,palette,v);return parts.join('');
}
function image(svg,x,y,w,h,color){const vb=svg.match(/viewBox="([^"]*)"/)[1],body=svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'').replace(/currentColor/g,color||'#ffffff');return '<svg x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" viewBox="'+vb+'" preserveAspectRatio="none">'+body+'</svg>';}
const assets=Object.fromEntries(D.assets().map(a=>['decor:'+a.id,a.svg]));
function panel(id,index){
 const r=R.byId[id],map=R.shape(r.layout,33,25).map,plan=D.layout(map,id,1),terrain=V.terrain(map),floor=[];for(let y=0;y<25;y++)for(let x=0;x<33;x++)if(map[y][x])floor.push({x,y});
 const minX=Math.min(...floor.map(p=>p.x))-2,minY=Math.min(...floor.map(p=>p.y))-2,maxX=Math.max(...floor.map(p=>p.x))+2,maxY=Math.max(...floor.map(p=>p.y))+2,sz=26;
 const width=(maxX-minX+1)*sz,height=(maxY-minY+1)*sz,px=(index%2)*500+10,py=Math.floor(index/2)*465+10;
 let s='<g transform="translate('+px+' '+py+')"><rect width="488" height="453" rx="10" fill="#373e34" stroke="#8d9579"/><text x="20" y="30" font-family="Microsoft YaHei, sans-serif" font-size="21" fill="#e3dcc4">'+r.n+'</text><svg x="'+((488-width)/2)+'" y="49" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'">';
 for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const t=terrain[y*33+x],type=t===1?'floor':t===2?'wall':'rock';s+='<svg x="'+((x-minX)*sz)+'" y="'+((y-minY)*sz)+'" width="'+sz+'" height="'+sz+'" viewBox="0 0 64 64">'+tile(type,V.palettes[1],(x*13+y*7)%3)+'</svg>';}
 for(const d of plan.ground)s+=image(assets[d.key],(d.x-minX+.5-d.width/2)*sz,(d.y-minY+.5-d.height/2)*sz,d.width*sz,d.height*sz).replace('<svg ','<svg opacity="'+d.alpha+'" ');
 for(const d of plan.shadows){const dir=d.key.split(':')[1],x=(d.x-minX)*sz,y=(d.y-minY)*sz;for(let i=0;i<8;i++){const z=i*sz/64,pos=dir==='n'?[x,y+z,sz,sz/64]:dir==='s'?[x,y+sz-z-sz/64,sz,sz/64]:dir==='w'?[x+z,y,sz/64,sz]:[x+sz-z-sz/64,y,sz/64,sz];s+='<rect x="'+pos[0]+'" y="'+pos[1]+'" width="'+pos[2]+'" height="'+pos[3]+'" fill="#162018" opacity="'+(.2*(1-i/8))+'"/>';}}
 const cx=Math.round((minX+maxX)/2),cy=Math.round((minY+maxY)/2),objects=plan.props.map(d=>({depth:d.y+1,svg:image(assets[d.key],(d.x-minX+.5-d.width/2)*sz,(d.y-minY+1-d.height)*sz,d.width*sz,d.height*sz).replace('<svg ','<svg opacity="'+d.alpha+'" ')}));
 for(const [x,y,id] of [[cx-3,cy,'rat'],[cx+3,cy-1,'slime']])if(map[y]?.[x])objects.push({depth:y+1,svg:image(c.MOB_ART[id],(x-minX)*sz,(y-minY)*sz,sz,sz,'#a93729')});
 objects.push({depth:cy+4,svg:image(c.HERO_ART.adv,(cx-minX)*sz,(cy+3-minY)*sz,sz,sz,'#245E8C')});objects.sort((a,b)=>a.depth-b.depth);s+=objects.map(o=>o.svg).join('');return s+'</svg></g>';
}
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1010" height="940" viewBox="0 0 1010 940"><rect width="1010" height="940" fill="#20271f"/>'+['vault','library','nest','camp'].map(panel).join('')+'</svg>';
fs.writeFileSync(output.replace(/\.png$/i,'.svg'),svg);sharp(Buffer.from(svg)).png().toFile(output).then(()=>console.log('Static scene art preview: '+output)).catch(e=>{console.error(e);process.exitCode=1;});
