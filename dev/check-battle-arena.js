/* node dev/check-battle-arena.js — final risk stage, owner-specific statuses, UI structure. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/\r\n/g,'\n'),source=read('game.js');
let groups=0;function check(name,fn){fn();groups++;console.log('PASS '+name);}
const c=vm.createContext({B:{wager:true},active:new Set(),hero:false,heroTier:1,heroValue:60,
 hasRelic:id=>c.active.has(id),hx:(id,v)=>v,CUSHION_MULT:1.8,HERO_ROGUE_X:1.5,
 heroOn:(id,tier=1)=>c.hero&&id==='rogue'&&c.heroTier>=tier,heroV:()=>c.heroValue});
function load(name){const i=source.indexOf('function '+name+'('),j=source.indexOf('\n}',i);assert(i>=0&&j>i);vm.runInContext(source.slice(i,j+2),c);}
['wagerX','wagerOutX','wagerScale'].forEach(load);
check('Risk multiplies final post-armor outgoing damage, including flat additions and critical results',()=>{
 for(const ordinary of [1,3,20,137,123456])assert.equal(c.wagerScale(ordinary,false),ordinary*2);
 c.B.wager=false;assert.equal(c.wagerScale(137,false),137);assert.equal(c.wagerOutX(true),2);c.B.wager=true;
 assert(!source.includes('pct += tg("p", "@wager"'));assert(!/B\.wager.*rogue.*pct \+=/.test(source));
 assert(source.indexOf('wagerScale(beforeRisk, false)')>source.indexOf('const beforeRisk = Math.max(1, raw - armor)'));
 assert(source.includes('lastDmgRec.rows["@wager"] = dmg - beforeRisk'));
});
check('Risk is after mitigation/caps and before shields or delayed damage; zero stays zero',()=>{
 assert.equal(c.wagerScale(0,true),0);assert.equal(c.wagerScale(6,true),12);
 const a=source.indexOf('const mit = mitigate(dmg, s, {wrong:true'),b=source.indexOf('dmg = wagerScale(mit.dmg, true)',a),z=source.indexOf('note = takeHit(dmg, m, wasHaunted)',a);
 assert(a>=0&&b>a&&z>b);assert(!source.includes('dmg * wagerX()'));
 c.active.add('cushion');assert.equal(c.wagerScale(10,true),18);c.active.add('boldheart');assert.equal(c.wagerScale(10,true),10);c.active.clear();
 c.B=null;assert.equal(c.wagerScale(10,true),10);c.B={wager:true};
});
check('Rogue strengthens only the outer risk stage and preserves the fifth-star safety cap',()=>{
 c.hero=true;assert.equal(c.wagerOutX(),2.6);assert.equal(c.wagerScale(10,false),26);
 c.heroTier=5;assert.equal(c.wagerX(),1.5);c.active.add('boldheart');assert.equal(c.wagerX(),1);c.active.clear();c.hero=false;c.heroTier=1;
});
check('Solo and coop keep combat owners/controls in the arena and all questions in the learning region',()=>{
 for(const file of ['index.html','coop.html']){const html=read(file),battle=html.slice(html.indexOf('id="veilBattle"'),html.indexOf('id="veilSpring"')),split=battle.indexOf('<section class="battle-learning"');assert(split>0);
  const arena=battle.slice(0,split),learn=battle.slice(split);
  for(const id of ['foeArt','meArt','foeStatuses','playerStatuses','btnFlee','btnWager','combatFeedback'])assert(arena.includes('id="'+id+'"'),file+' '+id);
  for(const id of ['qWord','qLabel','combo','opts','letters','spellBar','verdict','btnNextQ'])assert(learn.includes('id="'+id+'"'),file+' '+id);
  assert(!learn.includes('id="bHpBar"'));assert(html.indexOf('id="mapStatuses"')>html.indexOf('id="xpFill"'));
 }
});
check('Learning feedback contains only answer results and definitions; combo contains only the count',()=>{
 const i=source.indexOf('function renderCombo()'),j=source.indexOf('\n}',i),combo=source.slice(i,j);assert(!combo.includes('cmb-p'));assert(!combo.includes('cmb-next'));assert(combo.includes('aria-label'));
 assert(source.includes('renderCombatFeedback(head, note)'));assert(!source.includes('$("verdict").innerHTML = head'));
});
check('Status rendering caches identical HTML and removes expired states without mutating the owner',()=>{
 const el={_html:'',writes:0,get innerHTML(){return this._html},set innerHTML(v){this._html=v;this.writes++}},owner={status:{stone:2}};
 c.$=()=>el;c.statusChips=o=>o.status.stone?'stone '+o.status.stone:'';load('renderStatusOwner');
 const before=JSON.stringify(owner);c.renderStatusOwner('mapStatuses',owner);c.renderStatusOwner('mapStatuses',owner);assert.equal(el.writes,1);assert.equal(el.hidden,false);assert.equal(JSON.stringify(owner),before);
 owner.status.stone=0;c.renderStatusOwner('mapStatuses',owner);assert.equal(el.hidden,true);assert.equal(el.innerHTML,'');
 assert(source.includes('["playerStatuses","foeStatuses","mapStatuses"]'));
});
console.log(groups+' battle arena checks passed.');
