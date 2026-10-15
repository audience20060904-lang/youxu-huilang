/* Six-star growth and round-based statuses. Pure rules are shared with dev checks. */
var HeroRules=(function(){
  const effects={
    stone:['磐岩誓印','Stone oath','每层减伤 +5%','−5% incoming damage per stack'],
    fury:['烈意','Fervor','每层伤害 +8%','+8% damage per stack'],
    renew:['回春灵息','Renewal','回合末每层回复 2% 最大生命','Heal 2% max HP per stack at round end'],
    edge:['锋芒','Keen edge','每层暴击率 +5%','+5% critical chance per stack'],
    ward:['灵盾','Aegis','回合末每层获得 3% 最大生命护盾','Gain 3% max HP shield per stack at round end'],
    clarity:['澄明','Clarity','每层抵消 3% 伤害降低；回合末净化一种负面状态一层','Offset 3% weakened damage per stack; cleanse one debuff stack at round end'],
    echo:['余响','Echo','每层伤害 +6%','+6% damage per stack'],
    drain:['汲能','Siphon','答对后每层回复 1% 最大生命','Heal 1% max HP per stack after a right answer'],
    exposed:['破绽','Exposed','每层受到的伤害 +5%','+5% incoming damage per stack'],
    weak:['衰弱','Weakness','每层造成的伤害 −6%','−6% damage per stack'],
    burn:['灼蚀','Scorch','回合末每层受到攻击力 12% 的伤害','Take 12% attack damage per stack at round end'],
    bleed:['裂伤','Bleed','回合末每层受到攻击力 10% 的伤害','Take 10% attack damage per stack at round end'],
    poison:['侵毒','Venom','回合末每层失去 1% 最大生命','Lose 1% max HP per stack at round end']
  };
  const negative=['exposed','weak','burn','bleed','poison'];
  const kits={
    adv:['stone','踏实之证','stone','ward'], clerk:['clarity','誊写银笔','clarity','edge'], duelist:['edge','无鞘之刃','edge','fury'],
    hermit:['stone','静山香炉','stone','renew'], pioneer:['renew','初途罗盘','renew','fury'], keeper:['renew','长夜灯芯','renew','ward'],
    exorcist:['clarity','驱魇符印','clarity','stone'], rogue:['fury','孤注骰盅','fury','drain'], reader:['renew','晨光书签','renew','clarity'],
    naturalist:['fury','万象标本匣','stone','renew'], poet:['echo','未竟诗卷','echo','fury'], bard:['renew','四拍弦琴','ward','echo'],
    clock:['clarity','不息摆轮','clarity','ward'], examiner:['echo','追问墨镜','echo','edge'], heir:['ward','传承披风','ward','stone'],
    mage:['fury','三相法核','fury','renew'], astro:['edge','巡星仪','edge','ward'], smith:['stone','恒温锻砧','stone','ward'],
    necro:['drain','归魂提灯','drain','ward'], bounty:['edge','血契印章','edge','fury'], medium:['echo','千面灵镜','echo','clarity'],
    apothecary:['renew','澄露药瓶','renew','clarity'], debater:['clarity','止语铜铃','clarity','echo'], mentor:['clarity','传薪手札','clarity','renew'],
    merchant:['ward','流金天平','ward','edge'], tamer:['fury','血契兽笛','fury','drain'], warcrier:['fury','裂空号角','fury','stone'],
    collector:['echo','无尽陈列架','echo','ward'], rewinder:['stone','逆时沙漏','stone','renew'], saint:['edge','无相剑匣','edge','echo']
  };
  const finales={
    naturalist:['万象轮转：每答对 3 题，获得磐岩、烈意、回春各 3 层，并使敌人破绽 3 层','Every 3 right answers: gain 3 Stone, Fervor and Renewal; apply 3 Exposed'],
    poet:['诗章成形：每答对 3 题，获得余响、锋芒各 4 层，敌人灼蚀 3 层','Every 3 right answers: gain 4 Echo and Edge; apply 3 Scorch'],
    bard:['终章合奏：每答对 4 题，获得回春、灵盾、烈意各 4 层','Every 4 right answers: gain 4 Renewal, Aegis and Fervor'],
    necro:['冥河军势：魂上限 12；每答对 3 题召回 1 魂，敌人裂伤、衰弱各 3 层','Soul cap 12; every 3 right answers gain 1 soul and apply 3 Bleed and Weakness'],
    bounty:['猎杀契约：每答对 3 题，敌人破绽 4 层、裂伤 3 层，获得 3 层汲能','Every 3 right answers: apply 4 Exposed and 3 Bleed; gain 3 Siphon'],
    medium:['三灵同席：每层请 3 位角色，继承其被动及已解锁的三星、五星职业效果；每答对 3 题获得余响、澄明各 3 层','Channel 3 heroes with their passive and unlocked third/fifth-star traits; every 3 right answers gain 3 Echo and Clarity'],
    collector:['藏品共鸣：每答对 3 题，获得随机 3 种祝福各 3 层','Every 3 right answers: gain 3 stacks of three random blessings'],
    rewinder:['逆时回响：每答对 3 题，清除全部负面状态、回复 8% 生命，获得磐岩 3 层','Every 3 right answers: cleanse all debuffs, heal 8% HP and gain 3 Stone'],
    saint:['无相三斩：追加斩击增至 3 刀；每答对 3 题施加破绽 3 层、获得锋芒 3 层','Follow-up strikes increased to 3; every 3 right answers apply 3 Exposed and gain 3 Edge']
  };
  function clean(s){ const o={};for(const k in effects){const n=Math.max(0,Math.min(12,Math.floor(Number(s&&s[k])||0)));if(n)o[k]=n;}return o; }
  function gain(s,k,n,cap){ if(effects[k]) s[k]=Math.min(cap,Math.max(0,s[k]||0)+n); }
  function decay(s){ for(const k in s){s[k]--;if(s[k]<=0)delete s[k];} }
  return {effects:effects,negative:negative,kits:kits,finales:finales,clean:clean,gain:gain,decay:decay,factor:star=>1+.12*(Math.max(1,Math.min(6,star))-1)};
})();
if(typeof HEROES!=='undefined') HEROES.forEach(function(h){
  const k=HeroRules.kits[h.id],en=typeof UI_EN!=='undefined'&&UI_EN;
  const name=key=>HeroRules.effects[key][en?1:0];
  h.growth=[en?'Base passive unlocked':'解锁基础被动',
    en?'Passive values +12%; every 2 right answers gain 2 '+name(k[0]):'被动数值累计 +12%；每答对 2 题获得 2 层'+name(k[0]),
    (en?'Passive values +24%; ':'被动数值累计 +24%；')+h.s3,
    en?'Passive values +36%; blessing caps +1; signature grants 3 stacks':'被动数值累计 +36%；所有祝福上限 +1；招牌祝福改为 3 层',
    (en?'Passive values +48%; ':'被动数值累计 +48%；')+h.s5,
    (en?'Passive values +60%; ':'被动数值累计 +60%；')+(HeroRules.finales[h.id]?HeroRules.finales[h.id][en?1:0]:en?'Every 3 right answers gain 3 '+name(k[2])+' and '+name(k[3])+'; apply 2 Weakness':'每答对 3 题获得'+name(k[2])+'、'+name(k[3])+'各 3 层，并使敌人衰弱 2 层')];
  if(['mage','tamer','debater'].includes(h.id))h.growth[1]+=en?'; every 3 right answers apply 2 '+(h.id==='mage'?'rotating Scorch / Weakness / Exposed':h.id==='tamer'?'Bleed':'Weakness'):'；每答对 3 题施加 2 层'+(h.id==='mage'?'灼蚀／衰弱／破绽（轮转）':h.id==='tamer'?'裂伤':'衰弱');
  if(typeof HOLY_NO_BLESS!=='undefined')HOLY_NO_BLESS.push('hx_'+h.id);
  RELICS.push({id:'hx_'+h.id,r:h.r===3?3:2,n:en?h.n+' · Heirloom':k[1],heroOnly:h.id,nobf:true,
    pw:en?'Exclusive · each rank: ATK +1; blessing caps +1 (max +3). Every right answer grants 1 '+name(k[0])+' (2 at rank 3). Every 3 right answers apply 2 Exposed. Reselect to rank up (max 999).':'角色专属 · 每阶攻击 +1、祝福上限 +1（上限最多 +3）；每次答对获得'+name(k[0])+' 1 层（三阶起 2 层）；每答对 3 题施加破绽 2 层。重复选择升阶，最高 999 阶。',
    lore:en?'Bound to '+h.n+'; only found in floor rewards.':'属于'+h.n+'的印记，只在清层五选一中出现。'});
});
if(typeof module!=='undefined') module.exports=HeroRules;
