/* 五品质职业遗物。heroOnly 是出典，不是穿戴限制；所有职业共享同一套触发条件。 */
var Heirlooms=(function(){
  'use strict';
  // 每行：出典、偏向属性、五件独立遗物名、各自的触发事件/次数/动作。
  const sets=[
    ['adv','atk','磨旧路牌,探路绳结,归途营旗,不灭营火,世界尽头的行囊',[
      'right/3/ward:1','battle/1/shield:.06','fresh/2/stone:2,ward:1','kill/2/guard:1,renew:2','battle/1/guard:1,extend:1,ward:3']],
    ['clerk','crit','削尖铅笔,错字笺,复写纸,不竭墨池,真名誊录本',[
      'spell/1/echo:1','spell/1/clarity:2','right/3/echo:2,cleanse:1','spell/1/hit:.8,foe.exposed:2','spell/1/echohit:.5,mirror:1,echo:3']],
    ['duelist','atk','裂口剑鞘,抢步绑带,燕返剑穗,决斗白手套,无隙剑域',[
      'fast/2/edge:1','fast/3/foe.bleed:1','fast/3/echohit:.3','fast/4/guard:1,edge:2','fast/3/echohit:.7,foe.exposed:3']],
    ['hermit','hp','山居草垫,止息香,空谷木鱼,不动山印,一念净土',[
      'patient/1/stone:1','patient/2/cleanse:1','patient/2/renew:2,ward:1','patient/3/guard:1,cleanse:2','patient/3/mirror:1,guard:1,extend:1']],
    ['pioneer','atk','缺角地图,测绘铜针,初见标旗,无名地契,万径之门',[
      'fresh/1/fury:1','fresh/2/heal:.04','fresh/3/foe.exposed:2','fresh/3/spread:.35,ward:2','fresh/3/spread:.8,guard:1,clarity:3']],
    ['keeper','hp','值夜灯罩,旧日值簿,续灯火石,长明守誓,永夜终灯',[
      'due/1/renew:1','due/2/shield:.08','due/3/cleanse:2,ward:2','due/3/guard:1,extend:1','due/3/heal:.12,guard:1,mirror:1']],
    ['exorcist','crit','褪色符纸,缚魇红绳,照心铜镜,封魔剑印,万魇归寂',[
      'haunt/1/clarity:1','haunt/1/cleanse:1','haunt/2/foe.weak:2,echo:2','haunt/2/mirror:1,guard:1','haunt/2/mirror:1,echohit:.9,clarity:3']],
    ['rogue','crit','崩角筹码,压命骰,背水酒杯,孤注血契,逆命赌桌',[
      'wager/1/drain:1','wager/2/edge:2','wager/2/foe.bleed:2,heal:.04','wager/3/guard:1,echohit:.5','wager/3/guard:1,spendshield:.5,drain:3']],
    ['reader','hp','晨读折页,日课刻签,曙光墨水,百日读灯,破晓经卷',[
      'unique/3/renew:1','unique/4/clarity:2','unique/5/extend:1,renew:2','unique/6/guard:1,ward:2','unique/6/cleanse:5,extend:2,echo:3']],
    ['naturalist','hp','干花夹,虫翼透镜,分类标本盘,万象图鉴,小小生态圈',[
      'variety/2/fury:1','variety/3/renew:2','variety/3/foe.poison:2,stone:2','variety/4/extend:1,ward:3','variety/4/spread:.7,foe.poison:3,renew:3']],
    ['poet','atk','断句墨条,转韵纸鹤,对仗银尺,未完长诗,万言成世界',[
      'verse/2/echo:1','verse/3/edge:2','verse/3/echohit:.35','verse/4/foe.burn:3,extend:1','verse/4/echohit:.8,mirror:1,echo:3']],
    ['bard','hp','松弦拨片,定拍铜环,回声音叉,四重奏弦匣,众生安魂曲',[
      'rhythm/1/renew:1','rhythm/2/ward:2','rhythm/3/heal:.06,echo:2','rhythm/4/extend:1,guard:1','rhythm/4/cleanse:5,renew:3,ward:3,echo:3']],
    ['clock','crit','停摆齿轮,蓄时发条,双向擒纵器,借秒怀表,第十三刻',[
      'sand/10/clarity:1','sand/15/shield:.06','sand/18/guard:1','sand/20/extend:1,echohit:.4','sand/24/guard:1,extend:2,echohit:.7']],
    ['examiner','crit','问号书夹,反面问签,循环墨镜,穷根追问录,最后一个为什么',[
      'repeat/1/echo:1','repeat/1/foe.exposed:1','repeat/2/echohit:.4','repeat/2/mirror:1,edge:2','repeat/2/echohit:.9,guard:1,foe.exposed:3']],
    ['heir','hp','旧披肩扣,承火手套,交接信物,薪火誓约,未熄王冠',[
      'battle/1/ward:1','kill/2/shield:.08','combo/3/extend:1,stone:2','floor/1/guard:1,renew:2','kill/3/guard:1,extend:2,ward:3']],
    ['mage','atk','炭化木杖,霜纹戒,三相催化石,元素回环,原初魔典',[
      'right/3/foe.burn:1','spell/1/ward:2','right/4/cycle:2','spell/2/cycle:3,echohit:.5','right/4/cycle:4,cycle:4,cycle:4']],
    ['astro','crit','星砂盘,暮色棱镜,昼夜星轨,四象天球,群星交汇点',[
      'battle/1/edge:1','right/4/phase:2','right/4/phase:3,foe.exposed:1','right/5/phase:3,extend:1','right/5/phase:4,phase:4,guard:1']],
    ['smith','def','余温铁钳,回火护腕,淬火风箱,百炼锻砧,永燃熔炉',[
      'battle/1/stone:1','shielded/3/ward:2','blocked/1/edge:2','wardbreak/1/guard:1,fury:3','shielded/3/spendshield:.6,ward:3,foe.burn:3']],
    ['necro','hp','引魂烛,魂铃链,渡河铜钱,归魂提灯,冥河军旗',[
      'kill/1/drain:1','kill/2/ward:2','marked/3/echohit:.4','kill/2/guard:1,echo:3','kill/1/soul:1']],
    ['bounty','crit','悬赏钉,猎踪皮带,追缉望镜,血契印章,必达契约',[
      'fast/3/edge:1','kill/2/gold:10','marked/3/foe.bleed:2','marked/3/echohit:.6,foe.exposed:2','marked/3/echohit:1,foe.bleed:3,drain:3']],
    ['medium','hp','听灵骨珠,通灵薄纱,换面银镜,三灵烛台,千面归一',[
      'right/4/echo:1','afflicted/1/mirror:1','right/4/phase:2','right/5/mirror:1,phase:3','right/5/mirror:1,phase:4,phase:4,extend:1']],
    ['apothecary','hp','量露小勺,止血纱,溢露储瓶,双相药剂,不竭生命釜',[
      'low/2/heal:.03','afflicted/2/cleanse:1,renew:1','right/4/heal:.05,shield:.05','low/3/guard:1,heal:.1','right/4/cleanse:5,heal:.12,ward:3']],
    ['debater','def','辩词草稿,截句铜铃,反证徽章,止语法槌,无声议庭',[
      'right/3/foe.weak:1','reversal/1/clarity:2','marked/3/foe.exposed:2','reversal/1/guard:1,echohit:.4','right/4/mirror:1,guard:1,foe.weak:3']],
    ['mentor','hp','批注红笔,传薪手札,示范教尺,桃李印,万世讲坛',[
      'fresh/2/clarity:1','spell/2/renew:2','reversal/1/echo:2,cleanse:1','unique/5/extend:1,ward:3','unique/5/guard:1,clarity:3,renew:3,echo:3']],
    ['merchant','crit','磨亮铜秤,零钱暗袋,流金算盘,等价天平,万物流通印',[
      'kill/2/gold:4','rich/4/ward:1','rich/4/gold:12,edge:2','rich/5/spendgold:30','rich/5/spendgold:50,guard:1,ward:3']],
    ['tamer','atk','幼兽颈绳,磨牙骨哨,并肩兽笛,血契牙环,万兽同契',[
      'battle/1/pet:.25','right/3/pet:.4','marked/2/pet:.55,foe.bleed:1','right/3/pet:.8,drain:2','right/3/pet:1.1,pet:.6,foe.bleed:3']],
    ['warcrier','atk','裂纹口哨,回声喉甲,战阵号角,撼地战鼓,天地同声',[
      'right/4/spread:.15','combo/3/fury:2','right/4/spread:.3,foe.weak:1','combo/4/spread:.6,stone:2','combo/4/spread:1,foe.exposed:3,guard:1']],
    ['collector','crit','藏品编号牌,无尘手套,共鸣陈列台,奇珍轮盘,万藏星库',[
      'collection/3/echo:1','collection/3/phase:2','collection/4/extend:1','collection/4/phase:3,guard:1','collection/4/phase:4,phase:4,extend:2']],
    ['rewinder','hp','倒走指针,昨日细沙,留影怀表,未碎时镜,逆时之锚',[
      'reversal/1/stone:1','reversal/1/heal:.04','reversal/1/mirror:1','reversal/2/guard:1,extend:1','right/5/cleanse:5,revive:.25']],
    ['saint','atk','试剑石,听风剑铃,藏锋匣,无相剑匣,万剑归宗',[
      'right/4/echohit:.2','fast/3/foe.exposed:1','right/4/echohit:.4','marked/3/echohit:.55,edge:2','right/3/echohit:.6,echohit:.6,foe.exposed:3']]
  ];
  const triggers={right:'答对',spell:'拼写答对',fast:'3 秒内答对',patient:'用时至少 3 秒答对',fresh:'答对生词',due:'答对到期复习词',haunt:'答对心魔词',wager:'冒险答对',unique:'答对本件尚未记录的不同词',variety:'答对本轮尚未记录的不同类别',verse:'相邻两题词性不同且答对',rhythm:'相邻两次答对用时相差不超过 1 秒',sand:'答对存入剩余秒数（每题最多 6 秒，非限时题记 3 秒）',repeat:'答对本件曾记录的词',battle:'进入战斗',kill:'击杀',combo:'连击至少 5 时答对',floor:'进入新层',shielded:'持盾答对',blocked:'护盾吸收伤害',wardbreak:'护盾被击破',marked:'答对有负面状态的敌人',afflicted:'身有负面状态时答对',low:'半血以下答对',rich:'持有至少 100 金时答对',collection:'集齐至少三种遗物品质时答对',reversal:'失手后首次答对'};
  const actionNames={hit:'追加攻击 ×',echohit:'剑气追击 ×',pet:'宠物扑击 ×',spread:'震荡攻击 ×（其它怪最低留 1 血）',heal:'回复最大生命 ',shield:'获得最大生命护盾 ',cleanse:'净化负面状态层数 ',guard:'获得格挡次数 ',extend:'仍存续的祝福各延长层数 ',mirror:'将一种负面状态转移给敌人 ',gold:'获得金币 ',spendshield:'消耗最多 10% 生命上限的现有护盾，按消耗值造成伤害 ×',cycle:'元素轮转：灼蚀→灵盾→回春，层数 ',phase:'星象轮转：锋芒→烈意→回春→灵盾，层数 ',soul:'收集游魂（最多 5）；此后每次答对，每魂追击攻击的 10%，新增魂 ',spendgold:'花费金币换一次攻击 ×1、破绽 2 层，金币 ',revive:'每层一次致死时回复最大生命 '};
  const statScale={atk:[2,3,4,5,7],hp:[4,7,10,14,20],crit:[2,3,5,7,10],def:[1,1,2,2,3]};
  const statNames={atk:'攻击',hp:'最大生命',crit:'暴击率',def:'护甲'};
  function actions(rule){return rule.split(',').map(s=>{const [key,n]=s.split(':');return [key,Number(n)];});}
  function legacyR(hero){return ['naturalist','poet','bard','necro','bounty','medium','collector','rewinder','saint'].includes(hero)?3:2;}
  function id(hero,q){return q===legacyR(hero)?'hx_'+hero:'hx_'+hero+'_'+q;}
  const items=[];
  for(const [hero,stat,names,rules] of sets)for(let q=0;q<5;q++){
    const [trigger,every,raw]=rules[q].split('/'),acts=actions(raw),name=names.split(',')[q];
    const text=acts.filter(a=>a[0]!=='revive').map(([key,n])=>{
      if(key.startsWith('foe.'))return '敌人获得'+HeroRules.effects[key.slice(4)][0]+' '+n+' 层';
      if(HeroRules.effects[key])return '获得'+HeroRules.effects[key][0]+' '+n+' 层';
      return (actionNames[key]||key)+(['heal','shield'].includes(key)?Math.round(n*100)+'%':n);
    }).join('；');
    const revive=acts.find(a=>a[0]==='revive');
    items.push({id:id(hero,q),r:q,n:name,heroOnly:hero,nobf:true,heirloom:true,stat:stat,amount:statScale[stat][q],trigger:trigger,every:Number(every),actions:acts,
      pw:statNames[stat]+' +'+statScale[stat][q]+(stat==='crit'?'%':'')+'；每'+every+(trigger==='sand'?'秒':'次')+triggers[trigger]+'：'+text+(revive?'；每层一次致死时回复 '+Math.round(revive[1]*100)+'% 生命':'')+'。所有角色穿戴效果相同。',
      lore:'出典：'+(typeof HEROES!=='undefined'?(HEROES.find(h=>h.id===hero)||{}).n:hero)+'。清层专属池产出；不可合成获得，不存在升阶。'});
  }
  const byId=Object.fromEntries(items.map(r=>[r.id,r]));
  function sacredChance(floor){return floor<=50?0:Math.min(.06,.01*(1+Math.floor((floor-50)/10)));}
  function weights(floor){return floor<=10?[7,1,0,0]:floor<=20?[15,5,0,0]:floor<=30?[12,7,1,0]:floor<=40?[10,8,2,0]:[7,9,3,1];}
  function roll(floor,own,random){
    const rand=random||Math.random,pool=items.filter(r=>!own.includes(r.id));
    const holy=pool.filter(r=>r.r===4);
    if(sacredChance(floor)>0 && rand()<sacredChance(floor) && holy.length)return holy[Math.min(holy.length-1,Math.floor(rand()*holy.length))];
    const w=weights(floor),sum=w.reduce((a,b)=>a+b,0);let draw=rand()*sum,q=0;
    while(q<3 && (draw-=w[q])>=0)q++;
    // 品质耗尽时仅退到已开放的更低品质，不抬出未开放或神圣。
    for(let r=q;r>=0;r--){const candidates=pool.filter(x=>x.r===r);if(candidates.length)return candidates[Math.min(candidates.length-1,Math.floor(rand()*candidates.length))];}
    const opened=pool.filter(r=>r.r<4 && w[r.r]>0);
    return opened.length?opened[Math.min(opened.length-1,Math.floor(rand()*opened.length))]:null;
  }
  function equipped(p,mask){return [...new Set(p&&p.relics||[])].map(id=>byId[id]).filter(r=>r && !(mask && (mask==='all'||mask[r.id])));}
  function bonus(p,stat,mask){return equipped(p,mask).reduce((n,r)=>n+(r.stat===stat?r.amount:0),0);}
  function test(trigger,c,s){
    const right=c.event==='right',debuff=o=>Object.keys(o?.status||{}).some(k=>HeroRules.negative.includes(k)&&o.status[k]>0);
    if(trigger===c.event)return 1;if(!right)return 0;
    switch(trigger){
      case 'spell':return +!!c.spell;case 'fast':return +!!c.fast;case 'patient':return +(c.seconds>=3);
      case 'fresh':return +!!c.fresh;case 'due':return +!!c.due;case 'haunt':return +!!c.haunt;case 'wager':return +!!c.wager;
      case 'unique':case 'variety':{const k=trigger==='unique'?c.word:c.cat;if(!k)return 0;s.seen=s.seen||[];if(s.seen.includes(k))return 0;s.seen.push(k);return 1;}
      case 'verse':{const ok=s.pos&&c.pos&&s.pos!==c.pos;s.pos=c.pos;return +!!ok;}
      case 'rhythm':{const ok=Number.isFinite(s.seconds)&&Math.abs(c.seconds-s.seconds)<=1;s.seconds=c.seconds;return +ok;}
      case 'sand':return Math.min(6,c.untimed?3:Math.max(0,c.left||0));
      case 'repeat':{s.words=s.words||[];const has=s.words.includes(c.word);if(!has)s.words.push(c.word);return +has;}
      case 'combo':return +(c.p.combo>=5);case 'shielded':return +((c.p.shield||0)>0);case 'marked':return +debuff(c.mob);
      case 'afflicted':return +debuff(c.p);case 'low':return +(c.p.hp<=c.stats.maxHp*.5);case 'rich':return +(c.p.gold>=100);
      case 'collection':return +(new Set((c.p.relics||[]).map(id=>c.rarity(id))).size>=3);
      case 'reversal':{const armed=s.armed;s.armed=false;return +!!armed;}
    }return 0;
  }
  function settle(c){
    if(!c.p || c.p.hp<=0 || c.p.study || c.p.tut)return;
    const state=c.p.heirState||(c.p.heirState={});
    for(const item of equipped(c.p,c.mask)){
      const s=state[item.id]||(state[item.id]={n:0});
      if(c.event==='floor'){if(s.visited===c.floor)continue;s.visited=c.floor;}
      if(c.event==='battle'){
        if(s.battleFloor!==c.floor){s.battleFloor=c.floor;s.battles=[];}
        const key=c.mob?c.mob.x+','+c.mob.y:'?';s.battles=s.battles||[];if(s.battles.includes(key))continue;s.battles.push(key);
      }
      if(c.event==='wrong'){s.armed=true;if(item.trigger==='verse'||item.trigger==='rhythm'){delete s.pos;delete s.seconds;}continue;}
      if(c.event==='right' && s.souls)c.act(item,'echohit',s.souls*.1);
      const n=test(item.trigger,c,s);if(!n)continue;s.n=(s.n||0)+n;if(s.n<item.every)continue;s.n%=item.every;
      if(item.trigger==='variety')s.seen=[];
      for(const [key,amount] of item.actions){
        if(key==='revive')continue;
        if(key==='soul'){s.souls=Math.min(5,(s.souls||0)+amount);continue;}
        if(key==='cycle'||key==='phase'){const sequence=key==='cycle'?['foe.burn','ward','renew']:['edge','fury','renew','ward'];c.act(item,sequence[(s.phase||0)%sequence.length],amount);s.phase=(s.phase||0)+1;}
        else c.act(item,key,amount);
      }
      if(c.fx)c.fx(item);
    }
  }
  function rescue(p,floor,mask){
    if(p.hp>0)return null;const state=p.heirState||(p.heirState={});
    for(const r of equipped(p,mask)){const a=r.actions.find(a=>a[0]==='revive'),s=state[r.id]||(state[r.id]={n:0});if(a&&s.revived!==floor){s.revived=floor;return {item:r,pct:a[1]};}}
    return null;
  }
  function normalize(p){delete p.heroRelicRanks;p.heirState=p.heirState&&typeof p.heirState==='object'?p.heirState:{};p.heirGuard=Math.max(0,Math.min(2,Number(p.heirGuard)||0));}
  return {items,byId,id,bonus,equipped,settle,rescue,normalize,roll,sacredChance,weights};
})();
if(typeof RELICS!=='undefined'){
  // 原有 30 个 ID 的下标保持不变，旧短码/图鉴哈希仍然可以读取。
  for(const h of HEROES)RELICS.push(Heirlooms.byId['hx_'+h.id]);
  for(const r of Heirlooms.items)if(!RELICS.some(x=>x.id===r.id))RELICS.push(r);
  if(typeof HOLY_NO_BLESS!=='undefined')for(const r of Heirlooms.items)if(!HOLY_NO_BLESS.includes(r.id))HOLY_NO_BLESS.push(r.id);
}
if(typeof module!=='undefined')module.exports=Heirlooms;
