/* 幽墟回廊 · 战场模式的英文（2026-09-23，见 CLAUDE.md「多语言与新手教程」那一节）
   ---------------------------------------------------------------------------
   只有 battle.html 加载，排在 battle.js **后面**（这里要改 battle.js 定义的那几张表）——
   boot() 等 DOMContentLoaded 才跑，所以改完表再开场，一点不晚。
   三件事：
     1. 怪 / Boss / 特殊遗物 / 塔 / 难度层的英文，**按 id 就地覆盖**（battle.js 的表一个字没动）；
     2. battle.html 里写死的中文（按钮、弹窗标题、说明）→ I18N 字典，i18nDom() 换掉；
     3. battle.js 里拼出来的文案**不在这儿**，那边直接写 L("中文", "English")。
   ⚠️ 209 件遗物的战场英文词条在 i18n-en.js 的 BFW_EN（主城图鉴也要用），宝珠的英文在 i18n-en.js 的 ORB_EN。
   ⚠️ 加新塔 / 新怪 / 新特殊遗物：battle.js 那张表加一条，**这里也补一条英文**，漏了就显示中文（不报错）。
   中文界面下这个文件什么都不做。*/
"use strict";

var BF_EN = {
  foes: {rat:"Corridor Rat", slime:"Pantry Slime", spider:"Longleg Cave Spider", bone:"Bone Soldier",
    ghost:"Whispering Ghost", prism:"Shattered Prism", statue:"Gate Statue", clock:"Rusty Bell",
    warden2:"Wandering Shade", dread:"Fear Eater", gate:"Floor Warden",
    swarm:"Shadow Swarm", splitter:"Shellsplitter", shard:"Shell Shard", mender:"Stitcher",
    bulwark:"Barricade", warder:"Binder", bomber:"Blastsac", siege:"Siege Eye", gate2:"Deep Hall Warden",
    leech:"Shield Eater", phaser:"Phase Beast", hive:"Brood Mother", spawnling:"Broodling", sniper:"Piercer",
    gate3:"Ember Abyss Warden", juggernaut:"Juggernaut", revenant:"Undying", stormcaller:"Stormcaller",
    sapper:"Sapper", voidling:"Voidling", gate4:"Ruin's Heart Warden"},
  bosses: {warden:"Stone Hall Warden", steward:"Rust Court Steward", priest:"Ember Priest", crown:"Crowned of the Ruin"},
  tiers: {1:["Tier 1", "Start here"], 2:["Tier 2", "Tougher, denser foes"], 3:["Tier 3", "You can't clear them all"],
    4:["Tier 4", "No relics, no wave 10"], 5:["Tier 5", "Few get this far"]},
  /* 特殊遗物：[名字, 效果, 铭文] */
  special: {
    sp_whirl:   ["Whirl", "Your blade swings a full circle (360° arc)", "He learned to stop looking for which side they came from."],
    sp_reach:   ["Long Arm", "Blade reach +60%, knockback doubled", "Those with long arms needn't come so close."],
    sp_haste:   ["Gale", "Attack speed +60%", "Where the wind passes, not even the echo keeps up."],
    sp_second:  ["Follow-up", "Every swing is followed by a second (70% damage)", "The first strike asks; the second answers."],
    sp_burst:   ["Burst", "Kills explode: radius 80, damage = 60% of that foe's max HP, can chain", "The grander the death, the louder the bang."],
    sp_chain:   ["Chain Lightning", "Every hit arcs to the 3 nearest enemies for 40% damage each", "It only knows the nearest one, one after another."],
    sp_wave:    ["Skycleave", "Every swing fires a piercing shockwave (70% damage)", "The blade stops mid-air; the wind keeps going."],
    sp_orbit:   ["Hovering Blades", "Two blades orbit you; enemies they touch take 60% damage every 0.4s", "They take no orders. They just keep turning."],
    sp_trample: ["Trample", "While moving, deal 35% damage to nearby enemies every 0.3s", "Roads are made by walking. So are corpses."],
    sp_thorn:   ["Bramble", "Every second, deal 50% damage to all enemies within 130", "Standing still, and still killing."],
    sp_exec:    ["Execute", "Hitting an enemy below 25% HP kills it outright (not Bosses)", "That last blow — he never bothers with it."],
    sp_vortex:  ["Vortex", "Every 3s, drag nearby enemies to your side", "No need to find them. Let them come."],
    sp_frost:   ["Frost Ring", "Enemies within 220 move 40% slower", "The closer they get, the more it's like running through water."],
    sp_horde:   ["Sea of Foes", "Each nearby enemy: damage +3%", "The more that surround him, the wider he grins."],
    sp_rampage: ["Rampage", "Each kill: attack speed +5% for 4s, stacks up to 15", "Stop and you're done. So don't stop."],
    sp_skull:   ["Skullsplitter", "Crits explode on the target: radius 100, 130% damage (max 3 per swing)", "A skull makes the finest fuse."],
    sp_magnet:  ["Lodestone", "Pickup range ×4; each coin picked up: next swing damage +3% (resets on swing)", "Gold clings to him. So does the blade."],
    sp_feast:   ["Feast", "From now on, each kill restores 1% max HP and gives +1 max HP (max +400)", "He grew up on the dead of this corridor."],
    sp_ember:   ["Embers", "Hit enemies burn for 3s, taking 20% of your ATK each second", "The edge still holds the heat of the last fire."],
    sp_deflect: ["Parry", "Swings bat enemy projectiles back, each dealing 120% of your ATK", "Whatever flies in goes back the same way."],
    sp_rain:    ["Blade Rain", "Every 1.2s, a blade falls on a random enemy (150% damage, radius 60)", "Someone up there is swinging too."],
    sp_clone:   ["Afterimage", "A shadow follows you and swings with you (50% damage)", "He looked back once, and never dared again."],
    sp_spike:   ["Backlash", "When hit, deal 8% of your max HP to all enemies within 160", "Take one, return a crowd."],
    sp_ice:     ["Shatter Ice", "Double damage to slowed enemies; killing them causes an explosion (radius 90)", "Frozen things break the most satisfyingly."],
    sp_quake:   ["Earthsplit", "Every 4 swings, the ground cracks around you (radius 210, 120% damage)", "When the fourth strike lands, the earth splits with it."],
    sp_flurry:  ["Frenzy Blade", "After 12 hits in a row, next swing has double reach and arc and always crits", "Save it up, then take it all in one stroke."],
    sp_blink:   ["Phantom Step", "Every 4s: when cornered, blink away, leaving an explosion (radius 110, 200% damage)", "The hand that caught him caught only smoke."],
    sp_reso:    ["Resonance", "Each swing makes your nearest tower fire at once", "Even stone understands the sound of a blade."],
    sp_leech:   ["Thirsting Blade", "Each hit restores 0.4% max HP (up to 6 per swing)", "It fears hunger more than you do."],
    sp_tide:    ["Raging Tide", "At each new wave, then every 6s, release a screen-wide blade ring (200% damage)", "That opening blow is struck for everyone in the wave."]
  },
  /* 塔：[名字, 说明, ★★, ★★★, 铭文] */
  towers: {
    tw_bolt:    ["Arrow Tower", "Shoots the nearest enemy in range every 1.0s.", "Shoots two arrows at once", "Arrows pierce every enemy in a line", "The honest one — never asks who it's shooting."],
    tw_spike:   ["Spike Plate", "Every 0.5s, damages all enemies in range. Very short range.", "Range +60%", "Each attack stuns enemies in range for 0.4s", "It only minds the ring under its feet."],
    tw_sling:   ["Catapult", "Every 1.8s, lobs a stone that bursts in radius 48. It flies slowly — enemies may dodge.", "Lobs two at once", "Bursts in radius 120 and slows enemies it hits by 35% for 1.2s", "It aims where the enemy just was."],
    tw_lantern: ["Frost Lamp", "No damage. Enemies in range move 20% slower.", "The slow covers the whole field", "Every 5s, freezes all enemies on the field for 0.7s", "The lamp isn't cold to touch, yet all who pass it slow down."],
    tw_drum:    ["War Drum", "No damage. Other towers in range: attack speed +20%.", "Other towers in range also get damage +15%", "The drumbeat covers the whole field — every tower gets it", "Drums don't kill. Those who keep the beat do."],
    tw_well:    ["Spring Altar", "No damage. Every 8s, restores 2.5% max HP while you stand in range.", "Heals also grant 8 shield", "Heals reach you anywhere; each heal clears your slow and cuts damage taken 20% for 3s", "The water is cool. Stand here a while and the pain fades."],
    tw_coin:    ["Scavenger's Banner", "No damage. Enemies in range drop 35% more gold.", "Gold dropped in range goes straight to your purse", "Enemies in range have a 25% chance to drop gold twice", "It kills no one. It just stands where they fall."],
    tw_fan:     ["Scatter Tower", "Every 1.3s, fires 3 pebbles in a fan, each hitting separately. Short range.", "Fires 5 at once", "Pebbles pierce every enemy in a line", "It never aims. It just throws out whatever it has."],
    tw_tack:    ["Caltrops", "Every 3s, buries a spike nearby that bursts in radius 55 when stepped on. Up to 3 at once.", "Up to 6 at once", "Bursts in radius 80 and stuns enemies hit for 0.5s", "Bury it and forget it. Someone always steps on it."],
    tw_frost:   ["Frost Crystal", "Every 1.4s, fires a shot that slows its target by 40% for 1.5s.", "The ice shot bounces 2 more times", "Hits burst in radius 60 and stun for 0.6s", "Whatever it hits falls a half-beat late."],
    tw_lure:    ["Spirit Lure", "No damage. Every 2.5s, pulls enemies in range 90 toward itself.", "Area +50%", "After pulling, stuns enemies for 0.8s", "It does nothing. It only beckons."],
    tw_arc:     ["Arc Tower", "Every 1.2s, lightning jumps between the 3 nearest enemies.", "Lightning jumps to 6", "Every jump bursts in radius 40", "It picks the nearest one, one after another."],
    tw_mirror:  ["Spy Mirror", "No damage. Every 1.8s, marks 3 enemies in range for 4s; marked enemies take +25% damage.", "Marks 8 at once", "Marked enemies explode on death (radius 90, 40% of their max HP)", "Once reflected, nothing can hide again."],
    tw_mint:    ["Mint", "No damage. Every 10s, makes \"6 + wave\" gold at its feet.", "Its gold goes straight to your purse", "Makes 2 more gold for every tower on the field", "It never stops counting what's left of this run."],
    tw_sniper:  ["Longsight Tower", "Every 2.4s, shoots the enemy in range with the most HP. Very long range.", "Fires two in a row", "Enemies below 12% HP after a hit die outright", "It never watches the nearest one."],
    tw_cannon:  ["Heavy Cannon", "Fires every 2.8s: a 0.8s windup, then a shell that bursts in radius 60. Huge damage, easy to miss.", "Fires twice after the windup", "Bursts in radius 120 and stuns enemies hit for 0.6s", "It never chases. It waits for them to step in."],
    tw_beam:    ["Searing Beam", "A beam locks onto one enemy, burning it every 0.25s. Switches only when the target dies.", "Locks two enemies at once", "Hotter the longer it holds: +15% per tick, up to +150%, resets on switch", "It doesn't blink. So don't move."],
    tw_bramble: ["Bramble Garden", "Every second, damages all enemies in range and slows them 25%.", "Range +70%", "Enemies in range below 15% HP die outright", "Easy to get in. Getting out costs you something."],
    tw_horn:    ["Horn Banner", "No damage. Other towers in range: damage +30%.", "Other towers in range also get range +20%", "The horn covers the whole field — every tower gets it", "When the horn sounds, everyone hits a little harder."],
    tw_chapel:  ["Chapel", "No damage. Every 6s, restores 4% max HP while you stand in range.", "Heals also grant 15 shield", "Once per wave: dropping below 35% HP instantly restores 25% max HP", "No idol — only an empty bench."],
    tw_vault:   ["Vault", "No damage. +60 extra gold on each deploy.", "Income +60 more and 3 free shop refreshes", "Two free tower cards, plus \"6 × wave\" gold", "The key's long gone, yet it opens itself every five waves."],
    tw_rend:    ["Armor Breaker", "Every 1.6s, fires a shot that permanently strips 2 armor from its target (stacks).", "Strips 5 armor instead", "Hits burst in radius 80, stripping armor from everything inside", "It's in no hurry. It pries them off one plate at a time."],
    tw_banner:  ["War Banner", "No damage. While you stand in range: attack speed +25%, blade reach +15%.", "In range you also take 10% less damage", "The banner's shadow covers the whole field", "A banner swings no blade — it just makes you swing faster."],
    tw_storm:   ["Thunder Pillar", "Every 2.0s, strikes the densest cluster of enemies in range, bursting in radius 80.", "Strikes three times at once", "Each bolt chains between 4 enemies", "It always strikes where the crowd is."],
    tw_gravity: ["Collapse Core", "Every 4s, opens a 1.5s vortex that drags enemies to its center, then bursts.", "Deals damage every 0.5s while the vortex lasts", "When it ends, enemies in range below 20% HP die outright", "The ground sinks in on its own."],
    tw_forge:   ["Forge", "No damage. Other towers in range: attack speed +35%, damage +20%.", "Other towers in range attack 15% more often", "The fire covers the whole field — every tower gets it", "It heats everyone red-hot, and never moves itself."],
    tw_grove:   ["Tree of Life", "No damage. Every 4s, restores 3% max HP while you stand in range.", "Heals also grant 12 shield", "Heals reach the whole field; overflow turns into shield", "It's always damp under the tree."],
    tw_rail:    ["Stonepiercer", "Every 2.6s, fires a piercing bolt through every enemy in a line.", "Fires two in a row", "Every enemy hit bursts in radius 60", "A straight line. Whatever's behind is not its problem."],
    tw_judge:   ["Ring of Judgment", "Every second, damages all enemies in range; double damage to slowed or marked enemies.", "Range +50%", "Enemies in range below 25% HP die outright", "It asks no questions. It just draws a line."],
    tw_obelisk: ["Obelisk of Return", "No damage. Other towers in range attack 25% more often with +25% range; you take 20% less damage in range.", "Other towers in range: damage +25%", "Its shadow covers the whole field, damage taken −10% more", "The stone bears no words, yet all in its shadow remember the way home."],
    tw_clock:   ["Stopped Clock", "No damage. Enemies in range move 15% slower and are stunned for 1.5s every 8s.", "Stuns every 5s instead", "The chime covers the whole field", "The hands stopped long ago. So do those who pass it."],
    tw_boomer:  ["Disc Thrower", "Every 1.6s, throws a disc to max range and back, hitting on both passes.", "Throws two at once", "The disc spins in place at max range for 1s, shredding enemies around it", "What you throw out always comes back."],
    tw_bellows: ["Fire Vent", "Breathes flame at the nearest enemy; enemies in a 60° cone take damage every 0.35s. Very short range.", "Flame cone 60° → 120°", "Scorched enemies burn for 3s, taking damage again each second (doubled)", "The wind blows up from underground, carrying fire."],
    tw_hive:    ["Beehive", "Every 1.8s, releases 2 wasps that chase the nearest enemies.", "Releases 4 at once", "Wasps survive their sting and seek the next target (up to 3 stings each)", "The hive has never been empty."],
    tw_prism:   ["Refracting Prism", "Every 1.5s, fires a prism ray that splits into 3 shards on hit (50% damage each).", "Splits into 5", "Shards split once more on hit", "One ray goes in, a handful comes out."],
    tw_miasma:  ["Miasma Jar", "Every 3.2s, lobs a jar that leaves a 4s poison cloud (radius 70); enemies inside take damage every 0.5s.", "The cloud lasts 7s", "Enemies in the cloud take +30% damage from all towers", "Once the jar breaks, what's inside stays."],
    tw_quake:   ["Quake Hammer", "Every 2.4s, slams the ground, splitting a fissure toward its target that damages and knocks back every enemy on the line.", "Splits three fissures (in a fan)", "Enemies on the fissure are stunned for 0.7s", "It doesn't hit people. It hits the ground."],
    tw_leech:   ["Blood Vine", "Vines bind the 3 nearest enemies, draining them every 0.3s; while you're in range, 3% of the damage heals you.", "Binds 5 at once", "Bound enemies move 50% slower and are strangled below 15% HP (not Bosses)", "It grows slowly, but once it binds, it never lets go."],
    tw_lance:   ["Focus Cannon", "Every 3.6s, charges for 1s, then fires a 420-long laser through every enemy in a line.", "The laser leaves a burning trail that deals damage for 2s", "Fires three at once (in a fan)", "It's been quiet too long — beware the moment it speaks."],
    tw_rift:    ["Void Rift", "Every 5s, tears a rift at the densest spot (radius 90, 2.5s); enemies inside are slowed 60% and take damage every 0.25s.", "The rift drifts after the nearest enemy", "As it closes, it drags everything inside to the center and bursts (4× damage)", "There was nothing there before. There's nothing now either."],
    tw_barracks:["Barracks", "Houses 2 soldiers who rush out to block enemies in range and strike every 0.9s; blocked enemies stop to fight them. Fallen soldiers return after 10s.", "2 → 3 soldiers", "Every strike sweeps the area around the soldier, and each soldier can block 2 enemies at once", "When the horn sounds, someone always walks out the gate. Nobody ever asks why."],
    tw_pendulum:["Whirling Blade", "A long blade circles the tower nonstop (one lap per 1.4s), damaging every enemy it sweeps.", "Two blades", "Swept enemies burn for 3s, taking damage every second", "It never aims. It just never stops."],
    tw_bumper:  ["Repulsor Post", "Every 1.6s, pulses to shove enemies in range a big step outward, dealing a little damage.", "Area +50%", "Shoved enemies are stunned for 0.5s", "Stand beside it and you never need to watch your back."],
    tw_ward:    ["Interceptor", "No damage. Every 0.5s, shoots down the enemy projectile nearest the tower within range.", "Shoots down two at a time", "Downed projectiles fly back and hit whoever fired them (not Bosses)", "It only watches the sky. The ground is someone else's problem."],
    tw_tome:    ["Academy", "No damage. Enemies that fall in range give +40% XP.", "Area +60%", "Covers the whole field, XP bonus 40% → 70%", "Every fallen thing — someone is writing down how it fell."],
    tw_fence:   ["Shock Fence", "Strings a live wire to the nearest tower within 260; enemies crossing it take damage every 0.4s. Does nothing with no tower nearby.", "Links to the two nearest towers", "Enemies touching the wire move 50% slower", "Between the two posts there's nothing — except the one thing you shouldn't touch."],
    tw_soul:    ["Soul Lantern", "Collects a soul for each enemy that falls in range (max 30, reset each deploy); every 1.6s fires a soulfire bolt, +10% damage per soul.", "Soulfire explodes on hit (radius 50)", "One extra bolt per 10 souls stored", "Better not ask what the lamp oil is made of."],
    tw_knight:  ["Knight Order", "Houses 1 heavy knight who blocks 3 enemies and sweeps the area every 1.0s. Returns 12s after falling.", "Two knights", "Knights take half damage and explode when they fall (3× damage)", "They guard only one thing: the line behind them."],
    tw_mimic:   ["Mimic Mirror", "No attack of its own. Copies the nearest damage tower within 200, firing the same attack from its own spot (80% damage).", "Copies the two nearest", "Copied attacks carry that tower's 3★ effects", "The tower in the mirror believes in itself more than the real one."],
    tw_bell:    ["Death Knell", "Tolls every 6s: every enemy in range loses 12% of its current HP (Bosses 4%), plus a chunk of damage.", "The toll stuns enemies for 0.6s", "Tolls across the whole field; struck enemies take +30% damage from all towers for 3s", "For whom does it toll? For everyone who can hear."]
  }
};

/* battle.html 里写死的中文 */
Object.assign(I18N, {
  "幽墟回廊 · 战场": "Youxu Corridor · Battlefield",
  "暂停": "Pause",
  "第 1 波": "Wave 1",
  "连击": "Combo",
  "信息": "Info",
  "遗物": "Relics",
  "特殊": "Special",
  "部署": "Deploy",
  "0 金": "0 gold",
  "等级 1 · 人口 0/1": "Lv 1 · Pop 0/1",
  "开战": "Fight",
  "商店": "Shop",
  "升级": "Level up",
  "出售": "Sell",
  "战场": "Battlefield",
  "走位躲怪，刀会自己挥。每升一级从四件遗物里挑一件。轮数没有尽头。": "Dodge the horde — your blade swings on its own.",
  "回主城": "Back to town",
  "继续": "Continue",
  "进入": "Enter",
  "刷新": "Refresh",
  "返回": "Back",
  "升到 2 级": "Level 2",
  "挑一件带走": "Pick one to keep",
  "换一批": "Reroll",
  "都不要": "None of these",
  "遗物带满了": "Relics full",
  "算了": "Never mind",
  "换掉一件，换下来的当场分解成金币": "Swap one out — it's salvaged into gold on the spot",
  "身上的": "Carried",
  "特殊遗物": "Special relics",
  "打倒 Boss 才有，不占遗物位，也不能分解或当合成材料。": "Only from Bosses. They take no relic slot and can't be salvaged or fused.",
  "特殊遗物满了": "Special relics full",
  "最多带 5 件。换掉一件，或者不要这件新的。": "You can carry 5. Swap one out, or skip the new one.",
  "不要了": "Skip it",
  "Boss 倒下了": "The Boss has fallen",
  "从三件特殊遗物里挑一件 —— 它不占遗物位": "Pick 1 of 3 special relics — it takes no relic slot",
  "遗物 0 / 15": "Relics 0 / 15",
  "选择材料": "Pick materials",
  "合成": "Fuse",
  "游商": "Merchant",
  "金币 0": "Gold 0",
  "走了": "Leave",
  "挑一件": "Pick one",
  "放弃这一趟": "Abandon this run",
  "倒下了": "You fell",
  "再来一次": "Try again"
});

(function(){
  if(!UI_EN) return;
  var k, i;
  for(k in BF_FOES) if(BF_EN.foes[k]) BF_FOES[k].name = BF_EN.foes[k];
  for(k in BF_BOSS) if(BF_EN.bosses[k]) BF_BOSS[k].name = BF_EN.bosses[k];
  BF_TIERS.forEach(function(t){ var e = BF_EN.tiers[t.id]; if(e){ t.name = e[0]; t.desc = e[1]; } });
  BF_SPECIAL.forEach(function(d){ var e = BF_EN.special[d.id]; if(e){ d.n = e[0]; d.pw = e[1]; d.lore = e[2]; } });
  BF_TOWERS.forEach(function(d){
    var e = BF_EN.towers[d.id]; if(!e) return;
    d.n = e[0]; d.pw = e[1];
    if(d.s2) d.s2.t = e[2];
    if(d.s3) d.s3.t = e[3];
    d.lore = e[4];
  });
  i18nDom(document.body);
  document.title = T("幽墟回廊 · 战场");
})();
