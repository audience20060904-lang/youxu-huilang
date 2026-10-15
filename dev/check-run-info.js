/* node dev/check-run-info.js — actual info helpers: no RNG or combat mutations. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8'),source=read('game.js').replace(/\r\n/g,'\n');
const c=vm.createContext({T:x=>x,L:a=>a,UI_EN:false,Math,console,P:null,RMASK:null,B:null,active:new Set(),
  hasRelic:id=>c.active.has(id),rmul:()=>2,hx:(id,n)=>n,heroArtHtml:()=>'<svg/>',TOWN:{hero:{own:{}}}});
for(const f of ['content.js','hero-system.js','heirlooms.js'])vm.runInContext(read(f),c);
function load(name){const i=source.indexOf('function '+name+'('),line=source.indexOf('\n',i),j=source.slice(i,line).trimEnd().endsWith('}')?line-2:source.indexOf('\n}',i);assert(i>=0&&j>i,name);vm.runInContext(source.slice(i,j+2),c);}
['heroById','heroValAt','heroFmt','heroOn','heroGuest','heroV','heroEx','infoLuckRate','borrowedSkillsHtml'].forEach(load);
let groups=0;function check(name,fn){fn();groups++;console.log('PASS '+name);}
check('Medium shows the actual inherited passive value and only available third/fifth-star traits',()=>{
 c.P={hero:'medium',heroLv:30,heroStar:6,heroGuest:[{id:'mage',lv:20,star:6},{id:'tamer',lv:15,star:3},{id:'debater',lv:10,star:1}]};
 const before=JSON.stringify(c.P),html=c.borrowedSkillsHtml();assert.equal(JSON.stringify(c.P),before);
 const cards=html.split('<article class="borrowed-card">').slice(1);assert.equal(cards.length,3);
 assert(cards[0].includes(c.heroFmt(c.heroV('mage'))+'%'));assert(cards[0].includes('陨星'));assert(cards[0].includes('继承至 5'));
 assert(cards[1].includes(c.heroFmt(c.heroV('tamer'))+'%'));assert(cards[1].includes('三星效果'));assert(!cards[1].includes('五星效果'));
 assert(!cards[2].includes('三星效果'));assert(!cards[2].includes('五星效果'));assert(!html.includes('615.4%')||html.includes('增加攻击力 615.4%'));
});
check('Low-star Medium caps guest inheritance and does not display unearned skills',()=>{
 c.P.heroStar=1;let html=c.borrowedSkillsHtml();assert(!html.includes('三星效果'));assert(!html.includes('五星效果'));assert(html.includes('继承至 1'));
 c.P.heroStar=3;html=c.borrowedSkillsHtml();assert(html.includes('三星效果'));assert(!html.includes('五星效果'));
});
check('No guest, stale guest and non-Medium states are safe',()=>{
 c.P.heroGuest=[{id:'removed'}];assert(c.borrowedSkillsHtml().includes('没有可借用'));
 c.P.hero='adv';assert.equal(c.borrowedSkillsHtml(),'');c.P=null;assert.equal(c.borrowedSkillsHtml(),'');
});
check('Displayed proc chance includes blessing multipliers, Fortune and Reshake without rolling',()=>{
 c.active=new Set();assert.equal(c.infoLuckRate(.2,'slip'),.4);
 c.active=new Set(['fortune','reshake']);const q=Math.min(1,.4*(1+c.FORTUNE_X/100));
 assert(Math.abs(c.infoLuckRate(.2,'slip')-(q+(1-q)*c.RESHAKE_P*q))<1e-10);
 assert.equal(c.infoLuckRate(0),0);assert.equal(c.infoLuckRate(1),1);
});
check('All hero kits and 150 item descriptions state mechanics without vague bite terminology',()=>{
 for(const h of c.HEROES)for(const key of ['p','s3','s5']){assert(!/咬|愣住|一口/.test(h[key]),h.id+key);assert(h[key].endsWith('。'));}
 for(const r of c.Heirlooms.items){assert(!/攻击 ×|扑击 ×|追击 ×|层数 \d/.test(r.pw),r.id);assert(r.lore.length>15);}
});
check('Every dungeon monster has detailed self-contained art and alias coverage',()=>{
 const ctx=vm.createContext({});vm.runInContext(read('art.js'),ctx);const keys=Object.keys(ctx.MOB_ART);vm.runInContext(read('monster-art.js'),ctx);
 for(const id of keys){const svg=ctx.MOB_ART[id];assert(svg.includes('viewBox="0 0 100 100"'),id);assert(!/\bid=/.test(svg));assert(svg.includes('aria-hidden="true"'));assert(svg.includes('<ellipse'));}
 assert.equal(new Set(['rat','slime','spider','bone','statue','ghost','clock','warden2','dread','prism','warden','gate','priest','crown'].map(k=>ctx.MOB_ART[k])).size,14);
});
console.log(groups+' information and art checks passed.');
