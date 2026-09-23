/* 英文界面的全部文案（2026-09-23，见 CLAUDE.md「多语言与新手教程」）
   ⚠️ 这个文件是**生成的底稿 + 手改**：I18N 的键是 game.js / index.html 里的**中文原文，一字不差**，
      改了那边的中文，这里对应那一条就失效（界面会退回显示中文，不会报错）。
      加新文案：game.js 里写 T("中文")，再到这里补一条；拼接顺序对不上英文的句子直接用 L("中文","English")。
   只在界面语言是英文时才生效（UI_EN），中文界面下这个文件什么都不做。
   战场模式（battle.html）和宝珠**没有英文版**，英文界面下主城把入口藏起来了（game.js 的 showScene / renderTown）。*/
"use strict";
Object.assign(I18N, {
"这一层的怪还没清完 —— 两人先一起点「寻路」走。": "Monsters remain on this floor — both of you tap \"Path\" to move together.",
"存档写不进去 —— 浏览器多半开了无痕模式，或者禁掉了本地存储。这一趟关掉页面就没了，换个普通窗口再来。": "Can't save — your browser is probably in private mode or blocks local storage. This run will be lost when you close the page; try a normal window.",
"石门在身后合上。走廊里只有火把的回声。": "The stone door shuts behind you. Only the echo of torches fills the corridor.",
"这一层有几只东西待在原地不动 —— 找到它们，念对那个词。": "A few things wait motionless on this floor — find them and name the word.",
"<b>练习模式</b>：护甲 +50，攻击减半。": "<b>Practice mode</b>: armor +50, ATK halved.",
"</b>：": "</b>: ",
"。": ".",
"循迹 —— 这一层打错得比上一层少，多了 <b>": "Retrace — fewer mistakes than last floor: +<b>",
"</b> 点护盾。": "</b> shield.",
"稳步 —— 上一层没沾泉／坛／箱／商，回了 <b>": "Steady Pace — no spring/altar/chest/merchant last floor: restored <b>",
"</b> 点生命。": "</b> HP. ",
"惜盾 —— 护盾没破，多给你 <b>": "Cherished Shield — your shield held: +<b>",
"</b> 点。": "</b>.",
"盾誓在身前合拢 —— 护盾 <b>": "Shield Oath closes in front of you — shield <b>",
"</b>。": "</b>.",
"候门 —— 门后有东西在等你，护盾 <b>": "Gatekeeper's Wait — something waits behind the door. Shield <b>",
"，回 <b>": ", healed <b>",
"</b> 点生命": "</b> HP",
"章末的门在身后合上 —— <b>第": "The chapter's last door closes behind you — <b>Chapter ",
"章通关</b>。这一趟的通关已经记下了。": " cleared</b>. This run's clear has been recorded.",
"等待房主生成这一层的地图…": "Waiting for the host to generate this floor…",
" 第 ": " · Floor ",
" 层": "",
" · 深渊": " · Abyss",
"门在身后合上，这一层没有阶梯。<b>无终之影</b>站在屋子中间 —— 它的血没有底，打穿一层还有一层。想把这一趟的宝石带走，撤退之后「放弃」就行。": "The door closes behind you. There are no stairs on this floor. <b>The Endless Shade</b> stands in the middle of the room — its HP has no bottom; break one layer and there's another. To keep this run's gems, retreat and then tap \"Give up\".",
"空气冷得发硬。这一层尽头有东西在等。": "The air is cold and hard. Something waits at the end of this floor.",
"门在身后落下。一间屋子，一只 ": "The door drops behind you. One room, one ",
"这一层有 ": "This floor has ",
" 只敌人。清干净才能下去。": " enemies. Clear them all to go down.",
"无终之影碎了 <b>": "The Endless Shade breaks <b>",
"</b> 层（累计 ": "</b> layers (total ",
" 层）—— 底下那层 <b>": ") — the next layer has <b>",
"</b> 血，一口 <b>": "</b> HP and bites for <b>",
"已清": "Clear",
"队友": "Teammate",
"倒地": "Down",
" <span class=\"shn\">盾 ": " <span class=\"shn\">Shield ",
"攻击": "ATK",
"护甲": "Armor",
"暴击": "Crit",
"已掌握": "Mastered",
"已遇见": "Seen",
"总数": "Total",
"累计学词": "Answered",
" 次": "×",
"答对": "Correct",
"答错": "Wrong",
"正确率": "Accuracy",
"击杀": "Kills",
"等级": "Level",
"经验": "XP",
"那边过不去 —— 有东西挡着路。": "Can't get through there — something is in the way.",
"你拾起 <b>": "You pick up <b>",
"</b> 金币。": "</b> gold.",
" 层 · 已清空": " · Cleared",
"最后一道石门": "The last stone door",
"阶梯通向第 ": "Stairs down to floor ",
"下去就算<b>通关</b>，宝石照给。<br>再往下是<b>深渊</b>：里面那只东西血量没有底，打穿一层还有一层，没有阶梯也没有下一层 —— 走到倒下为止。": "Going down counts as a <b>clear</b> — gems included.<br>Below lies the <b>Abyss</b>: the thing there has bottomless HP; break one layer and there's another, with no stairs and no next floor — you go until you fall.",
"下面是一间屋子，里面<b>只有一只 BOSS</b>。": "Below is a single room with <b>just one BOSS</b>. ",
"下去之后<b>这一层不会再回来</b>。进下一层时会存一次档。": "Once you go down, <b>you can't come back to this floor</b>. The game saves when you enter the next floor.",
"下去 ▼": "Go down ▼",
"你从阶梯上退开一步。想走的时候，再点一下那个 ▼。": "You step off the stairs. When you're ready, tap the ▼ again.",
"你在阶梯口停住了。想走的时候，再点一下脚下那格。": "You stop at the top of the stairs. When you're ready, tap your own tile again.",
"深渊 · 血量无限，打穿一层还有一层": "Abyss · infinite HP — break one layer and there's another",
"章节首领 · 全部词类": "Chapter boss · all word types",
"遭遇 · ": "Encounter · ",
"类词": " words",
"你撞上了 ": "You run into the ",
"上一场的连击 <b>×": "Your combo of <b>×",
"</b> 还留着 —— 别断。": "</b> from the last fight is still going — don't break it.",
"弱点 · <b>": "Weakness · <b>",
"</b>类词伤害更高": "</b> words hit harder",
" · 第 ": " · Layer ",
"队友 ": "Teammate ",
"<span class=\"cmb-n\">连击 <b>×": "<span class=\"cmb-n\">Combo <b>×",
"\">伤害 +": "\">Damage +",
"<span class=\"cmb-next\">再对 ": "<span class=\"cmb-next\">",
" 个 +": " more → +",
"沙漏替你咽下了这一下 —— 这一层的读条只剩 <b>": "The Hourglass swallows the blow — this floor's timer is down to <b>",
"</b> 秒了。": "</b> seconds.",
"时间到，但破盾余威替你接住了这一口。题还在，接着答。": "Time's up, but Shattering Echo catches the blow. The question stays — answer it.",
"时间到 —— 你侧了半步躲开。题还在，接着答。": "Time's up — you sidestep half a pace. The question stays — answer it.",
"时间到，": "Time's up — ",
" 咬了你 <b>": " bites you for <b>",
"</b> 点。题还在，接着答。": "</b>. The question stays — answer it.",
"继续": "Continue",
"这个词是什么意思？": "What does this word mean?",
"用英语怎么说？": "How do you say it in Chinese?",
"冒险中 · 双倍赌注": "Risking · double stakes",
"冒险 · 我确定": "Risk it · I'm sure",
"已锁定：每题自动冒险": "Locked: every question is Risked",
"对了伤害翻倍，错了受伤翻倍": "Right: double damage. Wrong: double hurt.",
"拼出这个词 · 对了双倍经验": "Build the word · double XP if right",
" <span class=\"sys\">(割裂割满 ": " <span class=\"sys\">(Rend has cut ",
" 点，从此不再割)</span>": " HP and stops cutting)</span>",
" <span class=\"sys\">(追猎 · 回 ": " <span class=\"sys\">(Hunt · healed ",
" 点)</span>": ")</span>",
" <span class=\"sys\">(续弦 · 连击 ×": " <span class=\"sys\">(Restring · combo ×",
"，回 ": ", healed ",
" 点": "",
"伤害 +8%（本场累计 ": "Damage +8% (this battle total ",
"%）": "%)",
"回 ": "Healed ",
" 点生命": " HP",
"+60 金": "+60 gold",
" <span class=\"sys\">(无常 · ": " <span class=\"sys\">(Whim · ",
" <span class=\"sys\">(回响之厅又补了 ": " <span class=\"sys\">(Hall of Echoes added ",
" <span class=\"sys\">(反震 +": " <span class=\"sys\">(Recoil +",
"% 打了出去)</span>": "% unleashed)</span>",
" <span class=\"sys\">(不死鸟回了 ": " <span class=\"sys\">(Phoenix healed ",
" <span class=\"sys\">(学徒帽 · 回 ": " <span class=\"sys\">(Apprentice Cap · healed ",
" <span class=\"sys\">(长歌 · 护盾 +": " <span class=\"sys\">(Long Song · shield +",
" <span class=\"sys\">(驱邪 · 回 ": " <span class=\"sys\">(Exorcism · healed ",
" <span class=\"sys\">(刹那攒满了 —— 下一刀 +": " <span class=\"sys\">(Instant is charged — next strike +",
" <span class=\"sys\">(凝盾 · 护盾 ": " <span class=\"sys\">(Aegis · shield ",
"冒对了！": "Risk paid off!",
"暴击！": "Critical!",
"拼对了！": "Spelled it!",
"命中！": "Hit!",
"你砍中 ": "You hit ",
"，造成 <b>": " for <b>",
"</b> 点伤害": "</b> damage",
"（正中弱点）": " (weak spot!)",
"，浪涌炸开": ", the surge bursts",
"（额外伤害 +": " (bonus damage +",
"）": ")",
"（+": " (+",
"，其中连击 +": ", combo +",
" <span class=\"sys\">(反刍回了 ": " <span class=\"sys\">(Rumination healed ",
" 点生命)</span>": " HP)</span>",
" <span style=\"color:var(--venom)\">心魔散了，回 ": " <span style=\"color:var(--venom)\">The haunt fades — healed ",
" 点生命。</span>": " HP.</span>",
" <span class=\"sys\">(铁胆 · 连击留住 ×": " <span class=\"sys\">(Iron Nerve · combo kept at ×",
"，本层还剩 ": "; left this floor: ",
" 次)</span>": ")</span>",
" <span class=\"sys\">(归位 · 连击缓冲回 ×": " <span class=\"sys\">(Rebound · combo restored to ×",
" <span class=\"sys\">(筑盾 · 护盾 ": " <span class=\"sys\">(Scar Tissue · shield ",
"<span class=\"big no\">断链 —— 链子替你挨了</span>": "<span class=\"big no\">Broken Chain — the chain took it</span>",
"连击 −": "Combo −",
"，血一点没掉。": ", no HP lost.",
"<span class=\"big no\">无惧 —— 旧账咬不动你</span>": "<span class=\"big no\">Fearless — old debts can't bite</span>",
"心魔答错不掉血，这个词也没再加重。": "Wrong on a haunt word, but no HP lost and the haunt didn't worsen.",
"<span class=\"big no\">默诵替你挡下了</span>": "<span class=\"big no\">Recitation blocked it</span>",
"这一层的免伤还剩 ": "Free blocks left this floor: ",
" 次。": ".",
"<span class=\"big no\">慎笔 —— 笔尖悬住了</span>": "<span class=\"big no\">Careful Pen — the tip hovered</span>",
"拼错了，但这一下没落到身上。": "Misspelled, but the blow didn't land.",
"<span class=\"big no\">回声替你挡下了</span>": "<span class=\"big no\">Echo blocked it</span>",
"这一层的第一次失手，不掉血": "First slip on this floor: no HP lost",
"，还回了 ": ", and healed ",
"<span class=\"big no\">错身 —— 没碰到你</span>": "<span class=\"big no\">Sidestep — it missed you</span>",
"你侧了半步，这一下落空了（连击照断）。": "You slip half a pace aside and the blow misses (combo still breaks).",
"冒险失手": "Risk failed",
"失手": "Miss",
"<span class=\"big no\">失手</span>": "<span class=\"big no\">Miss</span>",
"这一下没让你掉血。": "That one didn't cost you any HP.",
" 赤鳞反弹了 <b>": " Red Scales reflect <b>",
"</b>　": "</b>  ",
"　<span style=\"color:var(--faint)\">": "  <span style=\"color:var(--faint)\">",
" <span class=\"sys\">(拼对 · 连击 +": " <span class=\"sys\">(Spelled · combo +",
"，本场经验 ×": ", battle XP ×",
"答对 ": "Correct: ",
"答错 ": "Wrong: ",
"晃了一下，血条空了 —— 等确认最后一下。": " staggers, its HP bar empty — waiting to confirm the last blow.",
"薪火在胸口炸开 —— 你带着 ": "The Undying Ember bursts in your chest — you stand with ",
" 点生命站住了。": " HP.",
"回魂 —— 你数到第二次心跳，又站了起来（": "Revival — on your second heartbeat, you rise again (",
" 点生命，本局还剩 ": " HP, ",
" 次）。": " left this run).",
" <span class=\"sys\">(屏息卸掉一半，这一层还剩 ": " <span class=\"sys\">(Held Breath halves it; left this floor: ",
" <span class=\"sys\">(余温还护着你，减半，剩 ": " <span class=\"sys\">(Lingering Warmth halves it; left: ",
"石胎": "Stone Womb",
"钝痛": "Dull Ache",
"把这一下压到 ": " caps this hit at ",
" <span class=\"sys\">(尚存削掉了这记重击的 ": " <span class=\"sys\">(Endure cuts this heavy blow by ",
"借甲趁护盾破的那一下，立刻又撑起 <b>": "As the shield breaks, Borrowed Plate instantly raises <b>",
"破盾余威 —— 下一次失手会被它接住。": "Shattering Echo — your next slip will be caught.",
"圆满 —— 裂口自己合上了，回 <b>": "Wholeness — the wound seals itself: healed <b>",
"</b> 点生命（这一层就这一次）。": "</b> HP (once this floor).",
" 咬中你，": " bites you — ",
"护盾吃掉 <b>": "shield absorbs <b>",
"</b> 点": "</b>",
"，你失去 <b>": ", you lose <b>",
"，血一点没掉": ", no HP lost",
"你失去 <b>": "you lose <b>",
"（心魔加重）": " (haunt: worse)",
" 化成了灰。<span class=\"sys\">(+": " turns to ash. <span class=\"sys\">(+",
"，+": ", +",
" 金": " gold",
"，回复 ": ", healed ",
" 生命": " HP",
"这一层清空了。": "This floor is clear. Where the ",
" 倒下的地方裂开了 —— 阶梯 ▼ 就在那儿。": " fell, the ground splits open — the stairs ▼ are right there.",
"这一层干净了 —— 收尾替你补了 <b>": "Floor clean — Finale restores <b>",
"，溢出的化成 <b>": ", overflow becomes <b>",
"</b> 点护盾": "</b> shield",
"均富 —— 这一层清空了，回廊分给你 <b>": "Fair Share — floor cleared: the Hall pays you <b>",
"</b> 金。": "</b> gold.",
"你把壳留在原地，人退了出来 —— 这一层的第一次撤退不掉血。": "You leave your shell behind and slip away — the first retreat this floor costs no HP. The ",
" 伤口还在。": "'s wounds remain.",
"你转身退开 —— 空门露了一下，失去 <b>": "You turn and back off — for a moment you're exposed and lose <b>",
" 留在原地，伤口还在。": " stays behind, still wounded.",
"<b>等级提升！</b>你现在是 ": "<b>Level up!</b> You are now level ",
" 级 —— 攻击 ": " — ATK ",
"，生命上限 ": ", max HP ",
"你把这一层的泉水全喝了 —— 回复 <b>": "You drink every spring on this floor — restored <b>",
"你现在": "You now have",
"　盾 ": "  Shield ",
"喝下去": "Drink",
"回复 ": "Restore ",
" 点（上限的 ": " HP (",
"你已经是满的了": "You're already full",
"，溢出的化成 ": ", overflow becomes ",
" 点护盾": " shield",
"掬一捧喝下": "Drink a handful",
"喝不下了": "Can't drink more",
"这口泉只够喝一次 —— 喝完它就干了。不想现在喝，它会留在原地等你。": "This spring holds only one drink — then it dries up. If you don't want it now, it will wait here.",
"满血的时候喝它是浪费。留着，等真需要的时候回来。": "Drinking at full HP is a waste. Save it and come back when you need it.",
"你掬起一捧泉水 —— 回复了 <b>": "You scoop up spring water — restored <b>",
"</b> 点生命（": "</b> HP (",
"泉水留在原地，还冒着气泡。": "The spring stays where it is, still bubbling.",
"代价": "Cost",
" 点生命（你现在 ": " HP (you have ",
"回报": "Reward",
"一件遗物": "One relic",
"割一刀": "Cut yourself",
"血不够": "Not enough HP",
"还愿先耗掉了 <b>": "Atonement spends <b>",
"</b> 点护盾抵代价。": "</b> shield first.",
"你把手按在浅槽上。石台吸干了那一点血。": "You press your hand into the shallow basin. The altar drinks the blood.",
"石台吐出了": "The altar yields",
"你收回手，绕开了石台。": "You pull your hand back and walk around the altar.",
"<span class=\"rl\">点它 → 扔进炉子</span>": "<span class=\"rl\">Tap it → throw it in the furnace</span>",
"炉火吞了 ": "The furnace swallows ",
"，什么也没吐出来 —— 只剩 <b>": " and gives nothing back — only <b>",
"炉子吐出了": "The furnace yields",
"你把 ": "You throw ",
" 扔进炉子 —— ": " into the furnace — ",
"火苗窜起来，它<b>升了一档</b>": "the flames leap up and it <b>rises a rarity</b>",
"火舌卷下去，它<b>降了一档</b>": "the flames sink and it <b>drops a rarity</b>",
"形状变了，还是同一档": "its shape changes, same rarity",
"：": ": ",
"炉膛里的火还亮着。你什么也没扔进去。": "The furnace fire still burns. You throw nothing in.",
"锁上刻着一个词": "A word is carved into the lock",
"拼出「": "Spell “",
"」": "”",
"<span class=\"big ok\">咔哒 —— 开了</span>": "<span class=\"big ok\">Click — it opens</span>",
"<span class=\"big ok\">拼错了 —— 钥匙替你撬开了</span>": "<span class=\"big ok\">Misspelled — the Key pries it open anyway</span>",
"<span class=\"big no\">锁咬死了</span>": "<span class=\"big no\">The lock jams shut</span>",
"拿走": "Take it",
"认了": "Accept it",
"木箱开了，里面有 <b>": "The wooden chest opens — inside: <b>",
"箱底压着": "You find at the bottom of the chest",
"钥匙 · 箱底有两件": "Key · two things at the bottom",
"挑一件带走": "Take one",
"锁彻底咬死了。这箱子谁也打不开了。": "The lock has jammed for good. No one will open this chest now.",
"游商把布收了收，换了一批货。": "The merchant folds his cloth and lays out new wares.",
"你身上有 <b style=\"color:var(--torch)\">": "You have <b style=\"color:var(--torch)\">",
"<div class=\"bagempty\">他的布上空空如也 —— 你已经什么都有了。</div>": "<div class=\"bagempty\">His cloth is empty — you already have everything.</div>",
" · 遗物</span>": " · Relic",
"已售": "Sold",
"你付了 <b>": "You pay <b>",
"游商递给你": "The merchant hands you",
"生命上限 <b>+": "Max HP <b>+",
"</b> —— 当前生命跟着补上了（": "</b> — current HP rises to match (",
"）。": ").",
"寄存把这份钱的一角存成了 <b>": "Deposit stores part of this money as <b>",
"你拆了 ": "You take apart ",
"，换成 <b>": " for <b>",
"神圣已经是顶了，它没法当材料。": "Divine is already the top — it can't be used as material.",
"得是<b>同一个品质</b>的三件 —— 现在挑的是": "They must all be the <b>same rarity</b> — you're picking ",
"已经挑满 ": "Already picked ",
" 件了。": ".",
"、": ", ",
" 件": " ",
" → 1 件": " → 1 ",
"砸掉": "Destroy",
"花费": "Cost",
" 金（你有 ": " gold (you have ",
"换回": "Get",
" · 两件里挑一件": " · pick one",
"金币不够": "Not enough gold",
"花 ": "Fuse for ",
" 金合成": " gold",
"合成出": "Fusion produced",
"合成要 <b>": "Fusing costs <b>",
"</b> 金，你还不够。": "</b> gold — you don't have enough.",
"更高一档的遗物你已经拿齐了。": "You already own every relic of the next rarity.",
"</b> 金，把 ": "</b> gold and smash ",
"遗物砸在一起。": " relics together.",
"合成": "Fuse",
"件": " ",
"，挑一件": " — pick one",
" 成了：": " is born: ",
"遗物已经被你撑满了，折成 <b>": "Your relics are full — converted into <b>",
"你得到了": "You got",
"<span class=\"rl\">点它 → 直接卖掉，换 ": "<span class=\"rl\">Tap it → sell it for ",
" 金</span>": " gold</span>",
"<span class=\"rl\">点它 → 换成「": "<span class=\"rl\">Tap it → swap for “",
"」</span>": "”</span>",
"你放下 ": "You put down ",
"旧遗物": "the old relic",
"，换上了 ": " and take up ",
" 旧的那件碎成了 <b>": " The old one shatters into <b>",
"你没动手上的东西，": "You keep what you have; ",
" 折成了 <b>": " is converted into <b>",
"—— 初次发现：": "— New discovery: ",
" 层 · 清干净了": " · Cleared",
"给了你一样东西": " gives you something",
"你拿起了": "You pick up",
"你拿起了 ": "You pick up ",
"遗物 ": "Relics ",
"<div class=\"bagempty\">还没有。每清完一层会让你五选一。</div>": "<div class=\"bagempty\">None yet. Each cleared floor lets you choose one of five.</div>",
" · 已选": " · Selected",
"\">分解<em>": "\">Salvage<em>",
" 金</em></button>": " gold</em></button>",
"合成 · ": "Fuse · ",
" 件同品质 + ": " of one rarity + ",
" 金 → ": " gold → choose 1 of ",
" 选 1": "",
"取消选择": "Cancel",
"选择": "Select",
"合成（": "Fuse (",
"已挑 <b>": "Picked <b>",
"</b> 件": "</b> ",
"，合成后在 ": "; after fusing, choose from ",
" 件<b>": " <b>",
"</b>里挑一件，另付 <b>": "</b> relics; costs <b>",
"在上面点 <b>": "Tap <b>",
" 件同品质</b>的遗物。神圣已经是顶了，不能当材料。": " of the same rarity</b> above. Divine is the top and can't be used.",
"点「选择」，挑 ": "Tap \"Select\" and pick ",
" 件同品质的砸成一件更高的（另付 <b>": " of the same rarity to smash into a higher one (costs <b>",
"</b> 金）。你的<b>": "</b> gold). Your <b>",
"</b>已经够了。": "</b> are enough.",
"偏爱": "Favor",
"封印": "Seal",
"偏爱 · 同品质里出现概率 ": "Favor · ",
"%，拿到一次失效": "% chance among its rarity; ends once you get it",
"封印 · 本局永不出现": "Seal · never appears in a run",
"空着": "Empty",
"未开启": "Locked",
"点这里挑一件": "Tap to pick a ",
"遗物": "Relics",
"再点一次 = 花 ": "Tap again = spend ",
" 宝石开它": " gems to open it",
" 宝石开启": " gems to open",
"宝石还差 ": "Gems short: ",
"确认": "Confirm",
"开启": "Open",
"锁": "Lock",
"什么是你的最爱": "Which one is your favorite?",
"不想再见到哪一件？": "Which one never again?",
" · 现在钉着它": " · pinned now",
" · 现在": " · currently ",
"着，选了就换过来": "; picking it moves it here",
"<div class=\"relic hot\"><span class=\"rn\">没找到</span></div>": "<div class=\"relic hot\"><span class=\"rn\">Nothing found</span></div>",
"买下了一颗未鉴定的宝珠，放进背包了。": "Bought an unidentified orb — it's in your bag.",
"鉴定出来了：": "Identified: ",
" 次强化 +": " enhancement +",
" 点（共 ": " points (total ",
"　新词条：": "  New affix: ",
"　翻倍：": "  Doubled: ",
"六个位置都满了，先在「人物」里卸下一颗。": "All six slots are full — remove one under \"Character\" first.",
" 装备上了。": " equipped.",
"<em>点数 ": "<em>Points ",
"基础词缀：无": "Base affix: none",
"鉴定": "Identify",
"换上": "Swap in",
"装备": "Equip",
"已满": "Maxed",
"再点一次<br>": "Tap again<br>",
" 宝石": " gems",
"强化<br>": "Enhance<br>",
"卸下": "Remove",
"背包 ": "Bag ",
"未强化": "Not enhanced",
"点开鉴定": "Tap to identify",
"都戴在身上了。": "All equipped.",
"还没有宝珠。主城里的「宝珠商店」有卖。": "No orbs yet. The Orb Shop in town sells them.",
"取消": "Cancel",
"分解": "Salvage",
"点宝珠勾选": "Tap orbs to select",
"再点一次 · +": "Tap again · +",
"分解 ": "Salvage ",
" 颗 · +": " · +",
"空": "Empty",
"<div class=\"orbfx\"><b>词缀</b><span>": "<div class=\"orbfx\"><b>Affix</b><span>",
"<div class=\"orbfx\"><b>词条</b><span class=\"oa\">": "<div class=\"orbfx\"><b>Traits</b><span class=\"oa\">",
"<div class=\"bagempty\">还没有效果。同色 2 颗起生效。</div>": "<div class=\"bagempty\">No effects yet. 2 of the same color activate a bonus.</div>",
"第 ": "Floor ",
" 个位置": "",
" · 空着": " · empty",
"<div class=\"bagempty\">背包里没有鉴定过的宝珠": "<div class=\"bagempty\">No identified orbs in your bag",
"（还有 ": " (",
" 颗没鉴定）": " still unidentified)",
"。</div>": ".</div>",
"分解了 ": "Salvaged ",
" 颗，宝石 +": " — gems +",
"点数 ": "Points ",
" · 强化 ": " · Enhanced ",
"还没鉴定，看不出颜色": "Unidentified — color unknown",
"<p class=\"ob dim\">还没有词条 —— 强化点数每满 10 抽一条。</p>": "<p class=\"ob dim\">No traits yet — one is drawn every 10 enhancement points.</p>",
"再点一次 · ": "Tap again · ",
"强化 · ": "Enhance · ",
"已售出": "Sold out",
"未鉴定宝珠": "Unidentified orb",
"购买<br>": "Buy<br>",
" 宝石</button>": " gems</button>",
"刷新 · ": "Reroll · ",
"背包": "Bag",
"主城 · 灰岩镇": "Town · Greyrock",
"已开 ": "Opened ",
" / 10 个槽位": " / 10 slots",
"用宝石换永久的好处 · ": "Trade gems for permanent perks · ",
" 宝石一个槽位": " gems per slot",
"宝珠 · ": "Orbs · ",
" 宝石一颗，只在战场生效": " gems each, Battlefield only",
" · 练习后实际 ×": " · with practice: ×",
"选这档 ▸": "Pick this ▸",
"进入 ▸": "Enter ▸",
"练习模式 · 开": "Practice mode · ON",
"练习模式 · 关": "Practice mode · OFF",
"<span class=\"rpct\">遇见 ": "<span class=\"rpct\">Seen ",
"<span class=\"rgo\">进入 ▸</span>": "<span class=\"rgo\">Enter ▸</span>",
"<span class=\"rgo\">还没挖通</span>": "<span class=\"rgo\">Not dug through yet</span>",
"你回到了踏进这一层时的样子 —— 存档存在每层的入口。": "You're back as you were when you entered this floor — the game saves at each floor's entrance.",
"最大连击 ": "Max combo ",
"击败 ": "Defeated ",
" 只": "",
"正确率 ": "Accuracy ",
"没花完的 ": "Unspent ",
" 金币": " gold",
"通关": "Clears",
"深渊 · 打穿 ": "Abyss · layers broken: ",
"这一章": "This chapter",
"倒下了": " has fallen",
"你从深渊里退了出来": "You withdrew from the Abyss",
"无终之影把你压了下去": "The Endless Shade crushed you",
"你从第 ": "You withdrew from floor ",
" 层退了出来": "",
"你倒在第 ": "You fell on floor ",
"第": "Chapter ",
"章 · 通关": " · Cleared",
" · 深渊 ": " · Abyss ",
"主动撤离": "Withdrew",
"你被抬回了镇上": "You were carried back to town",
"<div class=\"accone\"><i>本局正确率</i><b>": "<div class=\"accone\"><i>This run</i><b>",
"<div class=\"accone\"><i>历史平均 · 第 ": "<div class=\"accone\"><i>Avg · floor ",
" 层</i><b>": "</i><b>",
"<div class=\"accdiff\">这一层还没有历史记录，这一趟就是第一笔。</div>": "<div class=\"accdiff\">No history on this floor yet — this run is the first entry.</div>",
"比你在这一层的平均高 ": "Above your average on this floor by ",
" 个百分点": " points",
"比你在这一层的平均低 ": "Below your average on this floor by ",
"跟你在这一层的平均持平": "Same as your average on this floor",
"<b>小计</b>": "<b>Subtotal</b>",
"到达第 ": "Reached floor ",
"难度 · 第": "Difficulty · Ch.",
"章 ": " ",
"<b>获得宝石</b>": "<b>Gems earned</b>",
"宝石合计": "Total gems",
"练习模式": "Practice mode",
"护甲 +50 · 攻击 −50%": "Armor +50 · ATK −50%",
"难度等级 · ": "Difficulty tier · ",
"丢在洞里": "Left in the cave",
" 件遗物 · ": " relics · ",
"这趟遇到的词": "Words met this run",
" 个": "",
"累计掌握": "Mastered overall",
"<div class=\"cx lost\"><div class=\"cn\">还没遇到任何词</div></div>": "<div class=\"cx lost\"><div class=\"cn\">No words met yet</div></div>",
"回到镇上": "Back to town",
"碎成了石块。第": " crumbles into stone. Chapter ",
"章结束。": " complete.",
"最深 <b>第 ": "Deepest <b>",
" 波</b>　击杀 <b>": " wave</b>  Kills <b>",
"</b>　下场 <b>": "</b>  Runs <b>",
"</b> 次": "</b>",
" 层</b>　通关 <b>": "</b>  Clears <b>",
"</b> 次　探索 <b>": "</b>  Runs <b>",
"战场遗物": "Battlefield relics",
"初见第 ": "First found on floor ",
" 层 · 拿过 ": " · taken ",
"还没拿到过": "Not found yet",
"词库": "Words",
"还没遇到": "Not met yet",
"　<span style=\"color:var(--blood)\">上次答错</span>": "  <span style=\"color:var(--blood)\">Wrong last time</span>",
"<div class=\"cx lost\"><div class=\"cn\">没找到「": "<div class=\"cx lost\"><div class=\"cn\">Nothing found for “",
"」</div></div>": "”</div></div>",
"码短了": "Code is too short",
"码里的条数比词库还多": "Code has more entries than the word bank",
"码里的条数对不上": "Entry count doesn't match",
"码里的下标超出范围": "Index out of range",
"码太短了": "Code is too short",
"校验对不上 —— 复制的时候少了一截或者多带了字符": "Checksum mismatch — part of it was lost when copying, or extra characters were added",
"这串码是别的版本生成的": "This code was made by a different version",
"词库变过了，这串码里的熟练度跳过了": "the word bank changed, so word progress in this code was skipped",
"遗物表变过了，图鉴跳过了": "the relic table changed, so the codex was skipped",
"；": "; ",
"剪贴板里没有存档码。": "No save code in the clipboard.",
"测试口令：宝石 +10000（现在 ": "Test code: gems +10000 (now ",
" 颗）。": ").",
"这段文本读不出来 —— 像是存档文件但缺了一截。": "Can't read this text — looks like a save file but part is missing.",
"这串码读不出来：": "Can't read this code: ",
"这串老码读不出来，多半是复制时漏了一截。": "Can't read this old code — probably part of it was lost when copying.",
"这不像存档码 —— 它应该以 ": "This doesn't look like a save code — it should start with ",
" 开头。": ".",
"这串码里没有存档数据。": "This code contains no save data.",
"导入成功：更新了 ": "Import successful: updated ",
" 个词，补上 ": " words, added ",
" 件遗物": " relics",
"，宝石 +": ", gems +",
" 颗": "",
"（": " (",
"不详": "Unknown",
" 分钟前": " min ago",
" 小时前": " h ago",
" 天前": " days ago",
"存档时间": "Saved at",
"上次游玩": "Last played",
"词汇": "Words",
"掌握 ": "Mastered ",
" / 遇到 ": " / seen ",
" / 共 ": " / total ",
"遗物图鉴": "Relic codex",
"最深 / 通关 / 探索": "Deepest / clears / runs",
" 层　": " · ",
" 次　": " · ",
" 趟": "",
"镇上宝石": "Town gems",
"没走完的探索": "Unfinished run",
" 层 · Lv.": " · Lv.",
" 血": " HP",
"无": "None",
"已导出 ": "Exported ",
"（约 ": " (about ",
" KB）—— 去浏览器的下载列表里找它。": " KB) — find it in your browser's downloads.",
"这个浏览器挡了下载。存档已经放进下面「云存档」那个框里，手动复制走一样能用。": "The browser blocked the download. The save has been put in the \"Cloud save\" box below — copy it manually instead.",
"这个文件是空的。": "This file is empty.",
"这个文件读不出来 —— 内容不完整，或者根本不是存档。": "Can't read this file — it's incomplete, or not a save at all.",
"文件里的导出码读不出来，多半是复制时漏了一截。": "Can't read the code in this file — probably part of it was lost when copying.",
"这不是幽墟回廊的存档文件。": "This isn't a Youxu save file.",
"这是别的东西的存档，不是幽墟回廊的。": "This is a save for something else, not Youxu.",
"文件里没有词汇数据，不像是这个游戏的存档。": "This file has no word data — it doesn't look like a save for this game.",
"这个文件有 ": "This file is ",
"MB，太大了，不像是存档。": " MB — too big to be a save.",
"正在读 ": "Reading ",
"这个文件读不出来 —— 换一份试试。": "Can't read this file — try another.",
"读出来了 —— 对一眼上面的数字，再决定怎么导入。": "Loaded — check the numbers above, then choose how to import.",
"你正在洞里。存档停在<b>第 ": "You're in the cave. The save is at <b>the entrance of floor ",
" 层的入口</b> —— ": "</b> — ",
"游戏只在<b>进入关卡、下一层、回到主城</b>这三个时候存。关掉页面，下次打开自动从这一层开头接着走，不会问你。": "the game only saves when you <b>enter a chapter, go down a floor, or return to town</b>. Close the page and next time you'll continue from the start of this floor automatically.",
"上次的探索停在<b>": "Your last run stopped at <b>",
" 层</b>（Lv.": "</b> (Lv.",
"）的入口。下次打开会自动接着走，也可以现在就继续。": ") entrance. Next time you open the game it continues automatically — or continue now.",
"存档只在<b>进入关卡、下一层、回到主城</b>这三个时候写，下次打开自动读档。你现在在镇上，没有在进行的探索。": "The game saves only when you <b>enter a chapter, go down a floor, or return to town</b>, and loads automatically. You're in town with no run in progress.",
"锁定冒险 · 开：每题自动押上": "Lock Risk · ON: every question is Risked",
"锁定冒险 · 关": "Lock Risk · OFF",
"锁定冒险：接下来每题都<b>自动押上</b> —— 对了伤害翻倍，错了受伤翻倍。": "Risk locked: every question will be <b>Risked automatically</b> — right: double damage, wrong: double hurt.",
"解除锁定：恢复成每题自己决定要不要冒险。": "Unlocked: you decide whether to Risk on each question.",
"你把这几样推了回去 —— 换一批。": "You push these back — new choices.",
"再点一次": "Tap again",
"放弃": "Give up",
"生成存档码时出错了：": "Error making the save code: ",
"已复制": "Copied",
"复制存档码": "Copy save code",
"存档码（": "The save code (",
" 个字符）已经在剪贴板里 —— 到另一台设备上点「粘贴存档码」。": " characters) is in your clipboard — on the other device tap \"Paste save code\".",
"这个浏览器不让网页写剪贴板 —— 码已经放在下面的框里并选中了，自己复制走。": "This browser won't let the page write to the clipboard — the code is selected in the box below; copy it yourself.",
"成功": "success",
"这个浏览器不让网页读剪贴板 —— 把存档码粘到下面的框里，再点一次「粘贴存档码」。": "This browser won't let the page read the clipboard — paste the save code into the box below and tap \"Paste save code\" again.",
"剪贴板里是空的 —— 先在旧设备上点「复制存档码」。要手输也行：粘到下面的框里再点一次。": "The clipboard is empty — tap \"Copy save code\" on the old device first. Or paste it into the box below and tap again.",
"已取消，什么都没动。": "Cancelled — nothing changed.",
"先选一个存档文件。": "Pick a save file first.",
"合并完成：更新 ": "Merged: updated ",
"，还接回了一趟没走完的探索。": ", and recovered an unfinished run.",
"再点一次确认覆盖": "Tap again to overwrite",
"整档覆盖": "Overwrite all",
"正在覆盖，马上重新载入…": "Overwriting — reloading in a moment…",
"幽墟回廊": "Youxu Corridors",
"复制": "Copy",
"你站在镇口": "You stand at the edge of town",
"石廊的风从洞口吹上来，带着铁锈味。": "Wind rises from the Stone Hall's mouth, smelling of rust.",
"宝石": "Gems",
"最深": "Deepest",
"倒下": "Falls",
"洞窟": "Caves",
"选一条路，下去": "Pick a path and descend",
"图鉴": "Codex",
"你认过的词、拿过的遗物": "Words you've met, relics you've held",
"祝福": "Blessings",
"用宝石换永久的好处": "Trade gems for permanent perks",
"宝珠商店": "Orb Shop",
"宝珠 · 只在战场生效": "Orbs · Battlefield only",
"战场": "Battlefield",
"能站多久？": "How long can you last?",
"石廊": "Stone Hall",
"金": "Gold",
"敌": "Foes",
"寻路": "Path",
"锁定冒险": "Lock Risk",
"属性 Attributes": "Attributes",
"本局战绩": "This run",
"词汇记录": "Vocabulary",
"查看图鉴 · 跨局记录": "Open codex · all-time records",
"遗物 0": "Relics 0",
"合成 · 3 件同品质 + 300 金 → 1 件更高": "Fuse · 3 of a rarity + 300 gold → 1 higher",
"点「选择」，然后在上面挑 3 件同品质的。": "Tap \"Select\", then pick 3 of the same rarity above.",
"人物": "Character",
"背包 0": "Bag 0",
"装备 · 最多 6 颗 · 点一个位置换宝珠": "Equipped · up to 6 · tap a slot to change",
"总效果": "Total effects",
"各颜色的效果": "Effects by color",
"设置 Settings": "Settings",
"答完自动朗读": "Read aloud after answering",
"每题答完念一遍这个词；也能自己点题面右上角的 🔊": "Speaks the word after each question; you can also tap 🔊 on the card",
"答对自动下一题": "Auto-advance when correct",
"关掉就每题都手动点继续": "Turn off to tap Continue after every question",
"存档 Save": "Save",
"打开网页自动读档；存档只在进入关卡、下一层、回到主城时写。": "Loads automatically; saves only when you enter a chapter, go down a floor, or return to town.",
"继续上次探索": "Continue last run",
"粘贴存档码": "Paste save code",
"云存档 · 换设备": "Cloud save · switch devices",
"别的": "Other",
"玩法说明": "How to play",
"冒险": "Adventure",
"信息": "Info",
"设置": "Settings",
"洞窟 · 选一条路": "Caves · choose a path",
"下去哪里？": "Where to?",
"开着：护甲 +50（每下只掉 1 血），但攻击减半": "ON: armor +50 (each hit costs 1 HP), but ATK halved",
"回镇上": "Back to town",
"洞窟 · 选难度": "Caves · choose difficulty",
"用哪一档下去？": "Which difficulty?",
"换条路": "Other path",
"遭遇": "Encounter",
"灰鼠": "Grey Rat",
"连击": "Combo",
"伤害 +0%": "Damage +0%",
"再对 5 个 +2%": "5 more → +2%",
"心魔 · 上次你答错了它": "Haunt · you got this one wrong before",
"朗读这个词": "Read this word aloud",
"播放读音": "Play pronunciation",
"撤退 · 掉一半血": "Retreat · lose half HP",
"石缝里的泉": "A spring in the rock",
"一小汪水，还冒着气泡": "A small pool, still bubbling",
"这口泉只够喝一次 —— 喝完它就干了。": "This spring holds only one drink — then it dries up.",
"先留着": "Save it",
"石廊 第 1 层 · 已清空": "Stone Hall · Floor 1 · Cleared",
"阶梯通向第 2 层": "Stairs down to floor 2",
"再待一会儿": "Stay a while",
"血祭坛": "Blood altar",
"石台上有一道浅槽": "A shallow groove runs across the stone",
"槽里积着暗色的东西，还没干透。": "Something dark pools in the groove, not yet dry.",
"走开": "Walk away",
"石台 · 炉膛还热着": "Altar · the furnace is still hot",
"把一件遗物扔进去？": "Throw a relic in?",
"什么也不扔": "Throw nothing",
"上锁的木箱": "Locked chest",
"先不开，走了": "Leave it for now",
"游商": "Merchant",
"他没抬头，只把布摊开": "He doesn't look up, just spreads out his cloth",
"刷新 · 换一批货": "Reroll · new wares",
"走了": "Leave",
"带不下了": "Too much to carry",
"换掉哪一件？": "Swap out which one?",
"不要了，折成金币": "Skip it, take gold",
"这一层清干净了": "Floor cleared",
"石廊给了你一样东西": "The Stone Hall gives you something",
"遗物只在这一趟里管用。选一个。": "Relics last for this run only. Pick one.",
"重掷 · 换一批": "Reroll · new choices",
"本次探索结束": "Run over",
"你倒在了石廊里": "You fell in the Stone Hall",
"这一趟遇到的词": "Words this run",
"再来一次": "Again",
"3 件同品质 → 1 件更高": "3 of a rarity → 1 higher",
"换到哪一件是随机的，砸下去就收不回来了。": "The result is random; once smashed there's no undo.",
"再想想": "Think again",
"两件，挑一件": "Pick one",
"祝福 · 跨局永久": "Blessings · permanent",
"把宝石押在两件事上": "Stake your gems on two things",
"关闭": "Close",
"偏爱 · 普通": "Favor · Common",
"搜索：名字 / 效果 / 铭文": "Search: name / effect / inscription",
"空出这个槽位": "Clear this slot",
"返回": "Back",
"宝珠商店 · 只在战场生效": "Orb Shop · Battlefield only",
"三颗没开过光的珠子": "Three unawakened orbs",
"刷新 · 2000 宝石": "Reroll · 2000 gems",
"宝珠": "Orb",
"装备宝珠": "Equip orb",
"第 1 个位置": "Slot 1",
"图鉴 · 跨局永久记录": "Codex · all-time records",
"搜索：英文 / 中文 / 遗物名": "Search: Chinese / English / pinyin / relic",
"语言 Language": "Language",
"母语": "Native",
"学习": "Learning",
"新手教程": "Tutorial",
"幽墟回廊 · 玩法": "Youxu Corridors · How to play",
"词就是你的剑": "Words are your sword"
});
var I18N_BLOCKS = {
"#veilForge .note": "One in three <b>rises a rarity</b>, one in three <b>becomes another of the same rarity</b>, one in three <b>drops a rarity</b>. There's no taking it back.",
"#veilChest .note": "<b>Spell it right</b> and the chest opens. Spell it wrong and the lock jams for good — one chance only.",
"#veilShop .note": "\"Cave money is spent in the cave. What you carry out, I can't collect.\" <span id=\"shopGold\"></span>",
"#veilSwap .note": "You can carry at most <b id=\"swapMax\">10</b>. Tap an old one to swap it out — <b>tap the new one above to sell it instead</b>.",
"#veilBless .note": "Gems <b id=\"blessGem\">0</b>  One slot <b id=\"blessCost\">2000</b>; once open, changing its relic is free.",
"#stairNote": "Once you go down, <b>you can't come back to this floor</b>. The game saves when you enter the next floor.",
"#panelCode .note": "One <b>save code</b> holds your <b>word progress, relic codex, records, gems and blessings</b>. Tap \"Copy\" on the old device and \"Paste\" on the new one. Importing <b>keeps the better of both</b>, so it never erases progress on this device; <b>an unfinished run isn't included</b>.",
"#veilHelp .rules": "<ul>\n<li><b>Walking</b>: <b>tap any floor tile and your hero walks there</b>. Tap a monster to fight it, tap <span style=\"color:var(--venom)\">▼</span> to head downstairs (there's no ▼ until the floor is cleared). To stop midway, tap elsewhere or press <span class=\"kbd\">Esc</span>.</li>\n<li><b>Exploring</b>: monsters stand still — you have to find them. Chapters 1–4 have <b>50 floors</b> each; Chapter 5 \"Endless\" <b>has no bottom</b>. Each floor has <b>about a dozen</b> monsters. <b>Clear them all</b> and the stairs appear — <b>where the last monster fell</b>.</li>\n<li><b>Fighting</b>: walk into a monster to fight. Each round is one word — <b>answer right and you strike; answer wrong and it bites</b>. A <b>7-second timer</b> runs above the question: if it runs out, the monster bites — but it <b>doesn't count as wrong</b>; the question stays and the timer restarts. <b>Spelling questions have no timer.</b></li>\n<li><b>Question types</b>: pick the English meaning of a Chinese word, pick the Chinese word for an English meaning, or (sometimes) <b>build the word from character tiles</b>. Pinyin is shown with the characters; tap 🔊 to hear it.</li>\n<li><b>Combo</b>: <b>every 5 combo</b> adds +2% damage (stacks, no cap). It carries over between monsters and floors, and breaks only on a <b>wrong answer</b>. Crits deal double.</li>\n<li><b>Spelling</b>: build it right for <b>combo +10 and double XP for that battle</b>. Build it wrong and the word becomes a <b>haunt</b> — it comes back after 10 more questions.</li>\n<li><b>Healing</b>: no potions. <b>Each kill heals 3</b>, leveling up heals 5, and a <span style=\"color:var(--frost)\">spring</span> restores <b>15% of max HP</b> — it asks first, so you can save it for later.</li>\n<li><b>Words</b>: <b>each chapter uses one level</b> — Chapter 1 <b>HSK 1</b>, Chapter 2 <b>HSK 2</b>, Chapter 3 <b>HSK 3</b>, Chapter 4 <b>HSK 4</b>; Chapter 5 \"Endless\" <b>mixes HSK 3–5</b>. Words you miss come back <b>more often</b> until you've got them.</li>\n<li><b>Retreat</b>: you can retreat from any fight; the monster keeps its wounds. But turning your back costs <b>half your max HP</b> (never below 1).</li>\n<li><b>Risk</b>: before answering, tap \"Risk it · I'm sure\" — <b>right: double damage and combo counts 2; wrong: you take double damage</b>. \"Lock Risk\" on the map Risks every question automatically.</li>\n<li><b>Weakness</b>: each monster fears one category of words (shown in battle). Hit it with that category for <b>+2 damage</b>.</li>\n<li><b>Relics</b>: <b>after each cleared floor, pick one of five</b>. You can carry <b>up to 15</b>. On the Relics tab you can <b>salvage</b> them for gold, or fuse <b>3 of a rarity + 500 gold</b> into a higher one — you choose from three. Relics last for this run only — they are <b>the only way to grow stronger</b>.</li>\n<li><b>Haunts</b>: words you missed this run <b>come back after 10 more questions</b>. Get them right to banish them and heal 2.</li>\n<li><b>Along the way</b>: <span style=\"color:var(--r3)\">altars</span> (from floor 10) trade 5 HP for a relic — sometimes it's a <b>furnace</b> that reforges one of yours; <span style=\"color:var(--torch)\">chests</span> open only if you spell a word (<b>one try</b>); <span style=\"color:var(--frost)\">merchants</span> sell relics for cave gold. <b>Auto-path walks around them</b> — tap one to use it.</li>\n<li><b>Saving</b>: the game <b>loads automatically</b>. It saves only when you <b>enter a chapter, go down a floor, or return to town</b> — close the page midway and you restart <b>from this floor's entrance</b>.</li>\n<li><b>Switching devices</b>: in Settings, tap <b>\"Copy save code\"</b> on the old device and <b>\"Paste save code\"</b> on the new one. Importing keeps the better of both.</li>\n<li><b>Scoring</b>: a run's end (fall or clear) scores <b>max combo, kills, accuracy and unspent gold</b>, multiplied by <b>floors reached</b> (floor ÷ 10, no cap) and the chapter's <b>difficulty</b>, and converted into <b>gems</b>. Spend gems on <b>Blessings</b> in town: 2000 opens a slot to make a relic more common (×3 within its rarity) or ban it from runs.</li>\n<li><b>Falling</b>: you're carried back to town and <b>lose your relics and gold</b> — but the run still pays out gems. Word progress and the codex are never lost.</li>\n</ul>"
};
var RELIC_EN = {
"quick": [
"Quick Recall",
"Every 5 combo: damage +4% more (max +40%)",
"Those who remember fast strike fast."
],
"whet": [
"Whetstone",
"ATK +3",
"The plainest stone, worn down by three generations of iron."
],
"iron": [
"Tin Plate",
"Armor +1",
"The dullest things are often the hardest to kill."
],
"heart": [
"Stone Heart",
"Max HP +6",
"The Hall slowly turns those who stay too long into stone."
],
"keen": [
"Keen Eye",
"Crit rate +5%",
"One glance, and she knows where to strike."
],
"gambler": [
"Gambler",
"Correct answers while Risking: damage +10",
"What he wagers was never money."
],
"stand": [
"Last Stand",
"Below 50% HP: armor +5",
"With nowhere left to retreat, the skin grows thick."
],
"plate": [
"Iron Scales",
"Armor +2",
"One plate over the next, like fish, like roof tiles."
],
"salve": [
"Salve",
"Defeating an enemy: 40% chance to restore 4 HP",
"Smells like pine resin, burns like fire."
],
"echo": [
"Echo",
"Your first wrong answer each floor costs no HP and restores 5% max HP",
"The Hall swallows your first cry."
],
"drain": [
"Devour",
"Correct answer: 10% chance to restore 4 HP",
"It doesn't eat flesh. It eats wounds."
],
"vamp": [
"Bloodsip",
"Crits restore 5 HP",
"Wounds are its bread and butter."
],
"reap": [
"Reap",
"Defeating an enemy restores 2 more HP",
"The first thing the dead say is always about living."
],
"undying": [
"Undying Ember",
"Once per floor: after lethal damage, restore 25% max HP",
"Beneath the ashes, one spark is always still red."
],
"thorns": [
"Red Scales",
"Wrong answer: reflect 30 bonus damage to the monster",
"It sat in the fire so long it learned to answer back."
],
"surge": [
"Tide",
"Correct answer: 25% chance for damage +25",
"When the tide goes out, it leaves more than shells."
],
"greed": [
"Scavenger",
"Gold income +20%",
"The ring's owner died in a pile of gold, smiling."
],
"nerve": [
"Iron Nerve",
"Right while Risking: damage +30%; twice per floor, a failed Risk keeps your combo",
"Shaky hands don't gamble. Once they do, they stop shaking."
],
"allin": [
"All In",
"Correct while Risking: 10% chance to restore 10% max HP",
"She smiled as she pushed in her last chip."
],
"dice": [
"Loaded Dice",
"Right: 50% chance for crit rate +25% (stacks this floor); resets when wrong",
"The dice remember every win — and when to quit."
],
"chain": [
"Long Chain",
"Wrong: combo halves instead of resetting; damage taken when wrong −10%",
"A chain missing a link is still a chain."
],
"snow": [
"Snowball",
"Every 5 combo: bonus damage +25",
"Things that roll faster never stop on their own."
],
"tempo": [
"Tempo",
"Combo ≥5: crit rate +25%",
"A smith relies on rhythm, not strength."
],
"spark": [
"Spark",
"Combo bonus steps every 2 instead of every 5; crit rate +20%",
"A fire doesn't start at once. It gathers spark by spark."
],
"carve": [
"Engraving",
"Spelling questions +15%; correct spelling: damage +90%",
"Words carved in stone are harder to take back."
],
"recite": [
"Recitation",
"Spelling +30%; spelled right: bonus damage +35; 1 miss per floor costs no HP",
"Say it wrong, say it again. The Hall won't rush you."
],
"bind": [
"Soulbind",
"Haunts appear twice as often; banishing one restores 4% max HP",
"It carries every debt you owe, so you can repay it gladly."
],
"scent": [
"Scent Trail",
"90% of questions use the foe's weak category; weakness hits: damage +20%",
"It doesn't need to look. One sniff and it knows your fear."
],
"flaw": [
"Weak Spot",
"Ignore monster armor; damage +30%",
"The gap in the armor is always in the same place."
],
"ember": [
"Dying Ember",
"Below 33% HP: damage +95%",
"A fire about to die burns brightest."
],
"rend": [
"Rend",
"Bonus damage +20; each question costs 1 HP, up to 100 total (never lethal)",
"It doesn't want the enemy's blood. It wants yours."
],
"hoard": [
"Miser",
"Every 100 gold you carry: damage +2%",
"He never spends — money weighs more in the pocket than in the hand."
],
"midas": [
"Midas",
"Correct answer: 25% chance for +10 gold",
"Every word she touches lands with a jingle."
],
"grind": [
"Grindstone",
"ATK +5, max HP −5",
"Ground all night before the edge would shine."
],
"vigor": [
"Blood Flask",
"Max HP +17, ATK −4",
"The one on the hunter's belt is still warm."
],
"edge": [
"Thin Blade",
"Crit damage +50% (×2 → ×2.5)",
"So thin you can see light through it."
],
"gird": [
"Girdle",
"Armor +1, max HP −2",
"Tighter, and the blood runs slower."
],
"nick": [
"Tally Marks",
"ATK +1, crit rate +4%",
"One notch per kill, until they're too many to count."
],
"rust": [
"Verdigris",
"Gold income +10%",
"Handle green coins long enough and your hands turn green."
],
"lamp": [
"Oil Lamp",
"Each new floor: restore 8% max HP",
"Only enough oil to reach the next corner."
],
"purse": [
"Coin Purse",
"Each new floor: +30 gold",
"There's a hole in the bottom, but it leaks slowly."
],
"ward": [
"Quiet Word",
"Max HP +7",
"Chanted not for victory, only to stand a little longer."
],
"soft": [
"Soft Armor",
"Damage taken −7%",
"Three layers of old cloth — cheaper than iron, and softer."
],
"hold": [
"Held Breath",
"The first 2 hits each floor: damage taken halved",
"Hold that breath and the Hall can't hear you."
],
"blunt": [
"Dull Ache",
"A single hit can't take more than 16% of max HP",
"Hurt long enough and there's only one kind of pain left."
],
"chew": [
"Rumination",
"Correct right after a wrong answer: restore 4% max HP",
"What you swallow, you chew again."
],
"slip": [
"Sidestep",
"Wrong answer: 20% chance to lose no HP (combo still breaks)",
"When the blade fell, she was already gone."
],
"study": [
"Thirst for Knowledge",
"XP gained +10%",
"She studies words like she's gnawing stone."
],
"adept": [
"Crash Course",
"XP needed to level −20%",
"Some take three years. Some take three nights."
],
"engrave": [
"Etched Heart",
"Each level: max HP +3 more (max +30)",
"Every word read stays in the body — a weight, and a brace."
],
"brand": [
"Brand",
"Each level: ATK +1 more (max +20)",
"Every lesson learned leaves a mark on the bone."
],
"dig": [
"Gold Digger",
"+3 gold piles per floor",
"Those who walk with heads down find the most."
],
"tome": [
"Ledger",
"Correct on a mastered word: +8 gold",
"Turn to any page of the old ledger and it's money."
],
"regular": [
"Regular",
"Merchant prices −15%",
"When he walks in, the owner hides the priciest item."
],
"spend": [
"Big Spender",
"Every 300 gold spent this run: damage +2% (max +40%)",
"Money in hand is money. In the pocket it's just stone."
],
"recipe": [
"Recipe",
"Fusing needs only 2 relics, and costs half the gold",
"Can't gather three? Make do with two."
],
"pack": [
"Rucksack",
"Relic slots +3",
"What he carries isn't stuff. It's what he can't let go."
],
"delve": [
"Delver",
"Each floor deeper: damage +0.5% (max +20%)",
"The deeper you go, the heavier the step — and the blade."
],
"flash": [
"Flash of Insight",
"Every 5 combo: that strike is a guaranteed crit",
"The instant it clicks, the hand beats the mind."
],
"boom": [
"Shout",
"Spelling combo bonus doubled (+10 → +20); spelled right: damage +395%",
"Hit that note and the whole corridor rings."
],
"slay": [
"Kingslayer",
"Damage +30%; +100% more against Bosses and gatekeepers",
"A crown is the easiest target."
],
"restring": [
"Restring",
"Right: 20% chance to restore this run's best combo and heal 5 HP",
"Wrong, but not all wrong."
],
"empty": [
"Empty Hands",
"For each relic under 15 you carry: damage +7%",
"He threw everything away and kept only his hands."
],
"whim": [
"Whim",
"Right: one of — damage +8% this battle / heal 5% max HP / +60 gold",
"The Hall promises nothing, but it always gives something."
],
"offer": [
"Sacrifice",
"Max HP halved, damage +100%",
"She traded half of herself for a blade."
],
"hall": [
"Hall of Echoes",
"Correct answer: 50% chance to strike again immediately",
"The Hall repeats your right answers for you."
],
"lesson": [
"Homework",
"Correct on a word you've never seen: +10 gold",
"A new word enters the eye like first light."
],
"chase": [
"Hunt",
"Hitting a weakness: combo +2 more and restore 10% max HP",
"Once it bites, it doesn't let go."
],
"synes": [
"Synesthesia",
"Every question hits a weakness; hitting a weakness: damage +30%",
"It doesn't look for soft spots. It sees the whole thing as soft."
],
"charge": [
"Gather Force",
"Each non-crit: crit rate +5%, stacking (resets on crit)",
"A drawn bow makes no sound. When it does, it's too late."
],
"maul": [
"Maul",
"Crit rate +10%, crit damage +100% (×2 → ×3)",
"One blow is enough, so make it count."
],
"crush": [
"Skullcrusher",
"Crits ignore armor; crit damage +350% (×2 → ×5.5)",
"The shell's use ends here."
],
"spare": [
"Altar Scraps",
"Altar offerings cost only 1 HP",
"The gods learned to haggle."
],
"key": [
"Key",
"Chests open even if misspelled; spell it right to choose 1 of 2 relics inside",
"Locks recognize keys, not scholarship."
],
"opening": [
"Opening",
"First 5 correct answers each floor: damage +100%",
"The first cut is always the cleanest."
],
"greet": [
"Greeting",
"First correct answer each battle: damage +130%",
"Hand over a blade first; talk later."
],
"finale": [
"Finale",
"Clearing a floor restores 30% max HP",
"Clean up first, then catch your breath."
],
"stroke": [
"Stroke Order",
"Spelling questions auto-fill one random letter",
"Once the first stroke lands, the hand takes over."
],
"clean": [
"Clean Script",
"Spelling questions show no decoy letters",
"Nothing on the desk but what you need."
],
"glass": [
"Hourglass",
"Timeouts cost no HP, but each one shortens this floor's timer by 0.5s (min 3s)",
"The more sand falls, the less remains."
],
"shed": [
"Molt",
"Damage taken −10%; your first retreat each floor costs no HP",
"The shell stays put; you're already far away."
],
"vow": [
"Shield Oath",
"Each new floor: shield refills to 20% of max HP",
"Every door you push, someone stands in front of you."
],
"aegis": [
"Aegis",
"Every 10 correct answers: +10 shield (max 300)",
"Every word she remembers forms another layer on her."
],
"unchain": [
"Broken Chain",
"Combo ≥ current floor: a wrong answer costs no HP, combo −current floor",
"Better the chain breaks in your hand than around your neck."
],
"hide": [
"Hide Armor",
"Damage taken −3%",
"Tanned three times, still with the beast's temper."
],
"pad": [
"Padding",
"Max HP +8",
"The old cotton stuffed in armor has soaked up plenty of blood."
],
"callus": [
"Callus",
"Armor +3, and armor +20%",
"What's worn in costs less than iron."
],
"build": [
"Scar Tissue",
"Wrong answer: gain 2 shield",
"Where it hurt, a layer grows back."
],
"thick": [
"Thick Shield",
"Each new floor: gain 7 shield",
"One more layer never hurt."
],
"well": [
"Wellspring",
"Each new floor: restore 20% max HP; overflow healing turns into shield (2 → 1)",
"When the cup is full, water frosts down its side."
],
"water": [
"Water",
"Each new floor: auto-drink every spring; overflow turns into shield (2 → 1)",
"She doesn't wait to be thirsty."
],
"mirror": [
"Mirror Shield",
"Each new floor: +30 shield; every 5 shield: damage +1 (max +200)",
"The shield reflects your foe — and its weak spots."
],
"breath": [
"Second Wind",
"Defeating an enemy restores 2% max HP",
"After each one, he stands and takes three breaths."
],
"burlap": [
"Burlap",
"First wrong answer each floor: damage taken −25%",
"Coarse sackcloth won't stop a blade — only the first blow."
],
"tough": [
"Calluses",
"Each floor deeper: damage taken −1% (max −15%)",
"Thirty floors in, the skin on his hands is thicker than armor."
],
"scale": [
"Reverse Scale",
"Below 50% HP: damage taken −15%",
"Dying things are the hardest to kill."
],
"phoenix": [
"Phoenix",
"Below 15% HP: correct answers restore 5% max HP",
"That cry from the ashes is its own."
],
"bastion": [
"Bastion",
"Armor +4; each point of armor: damage +3%",
"A wall can march too."
],
"recoil": [
"Recoil",
"Each time you lose HP, next strike: damage +50% (stacks 3)",
"He saves every blow he takes to repay."
],
"still": [
"Unmoving",
"Damage taken −20%",
"She stands there as if she grew there."
],
"womb": [
"Stone Womb",
"A single hit can't take more than 12% of max HP",
"Wrapped in stone, nothing outside can reach her."
],
"titan": [
"Iron Body",
"Max HP ×1.5",
"Something else was poured into the bones — heavy, unbreakable."
],
"mend": [
"Blood Return",
"Defeating an enemy restores 4% max HP",
"You caught its last breath."
],
"pulse": [
"Heartbeat",
"Correct answers restore 1% max HP",
"Say a word right and your heart skips."
],
"quell": [
"Suppress",
"Damage taken −20%; damage from Bosses −50% more",
"A crown weighs down others — and itself."
],
"deep": [
"Deep Dive",
"From floor 30: damage taken −15%",
"The deeper, the colder — until nothing hurts."
],
"heavy": [
"Heavy Armor",
"Armor +1, and armor ×4",
"Three layers of plate won't walk fast — but needn't."
],
"psyche": [
"Mind Mirror",
"Wrong on a haunt word: damage taken −15%",
"The you in the mirror can't hurt you."
],
"revive": [
"Revival",
"3 times per run: when you fall, restore 50% max HP and go on",
"On her second heartbeat, the Hall let go."
],
"calm": [
"Steady Answer",
"Wrong on a multiple-choice question: damage taken −7%",
"That half-second of hesitation cuts truer than a hand."
],
"caution": [
"Careful Pen",
"Spelling questions +2%; wrong spelling costs no HP",
"As the pen hovers, the blade slows half an inch."
],
"cushion": [
"Safety Net",
"A wrong Risk multiplies damage by ×1.8 instead of ×2",
"She pushed in every chip, but kept one hand under the table."
],
"buffer": [
"Buffer",
"Damage taken on timeouts −55%",
"When you can't answer, the bell takes half the blow."
],
"grit": [
"Aftershock",
"Each wrong answer this floor: damage taken −5% more (max −15%)",
"The first blow hurts most; after that even it gets tired."
],
"grudge": [
"Grudge",
"After hitting a monster once, damage taken from it −10%",
"Things you've hit three times hesitate before swinging."
],
"familiar": [
"Familiar Faces",
"Each same-category monster met this floor: damage taken −5% (max −15%)",
"By the third one with the same face, you're not afraid."
],
"twice": [
"Second Look",
"From the second wrong answer on the same word this run: damage taken −25%",
"Step in the same hole twice and your foot knows where to lean."
],
"nemesis": [
"Old Rival",
"Each Boss met this run: damage taken −5% (max −45%)",
"It moved to another floor to wait for you, but kept every move."
],
"corrode": [
"Corroded Armor",
"Right: armor +1 (max +5); each hit taken: armor −2; resets each floor",
"This armor feeds on your mistakes and repays your successes."
],
"dawn": [
"Dawn Armor",
"First 20 questions each floor: armor +5",
"The first steps past a door, the armor is still cold and hard."
],
"stack": [
"Layered Armor",
"Armor +5; after 2 floors in a row without losing HP: armor ×2",
"Walk clean long enough and a second shell grows."
],
"rustplate": [
"Rusted Plate",
"Armor +2, crit rate −6%",
"Heavy, dull, rusty — it blocks, but it won't swing fast."
],
"twoply": [
"Double Plate",
"Armor +4",
"The outer layer stops blades; the inner one stops death."
],
"deposit": [
"Deposit",
"Salvaging or swapping a relic grants shield equal to 10% of its salvage value",
"What you took apart wasn't thrown away — it became a thin light before you."
],
"atone": [
"Atonement",
"Altar offerings use shield first, then HP",
"The altar doesn't ask what you pay with, only whether you pay."
],
"borrow": [
"Borrowed Plate",
"Each floor: +20 shield; once per floor, a broken shield instantly refills",
"As the shield shatters, the smith is already handing you another."
],
"cherish": [
"Cherished Shield",
"Each new floor: +10 shield; if your shield survived last floor, +15% max HP more",
"An unbroken shield remembers, and grows thicker."
],
"shatter": [
"Shattering Echo",
"Each floor: +10 shield; once per battle, after it breaks, next wrong costs no HP",
"The sound of the shield breaking blocks the next blow."
],
"endure": [
"Endure",
"A single hit over 10% max HP: that damage −20%",
"That blow should have killed. It only hurt."
],
"brace": [
"Brace",
"The first hit each floor that drops you below 50% HP: damage taken −55%",
"As you fall, something always catches you first."
],
"warmth": [
"Lingering Warmth",
"After dropping below 50% HP or Undying Ember: next 5 wrong answers deal half",
"The fire's out, but the ash is too hot to touch."
],
"steady": [
"Composure",
"Below 25% HP: timer +3 seconds",
"When your blood runs low, time is willing to wait."
],
"rampart": [
"Ruined Wall",
"Armor +10; below 10% HP, damage taken is halved until you're back at 50%",
"Backed against the wall, the wall becomes your last armor."
],
"pace": [
"Steady Pace",
"No spring/altar/chest/merchant this floor: heal 55% max HP on the next",
"The floor where you open no doors is the steadiest."
],
"spry": [
"Travel Light",
"Each empty relic slot: armor +1 (max +7)",
"Keep nothing you pick up, and your shoulders feel light."
],
"ascetic": [
"Ascetic",
"Never drank a spring: each floor deeper, wrong-answer damage −5% (max −25%)",
"Leave the spring behind, and pain learns to arrive late."
],
"foresight": [
"Rainy Day Fund",
"On a new floor: restore 3% max HP per 100 gold you carry",
"A heavy purse on the hip means sounder sleep."
],
"veteran": [
"Veteran",
"Each new floor: +15 shield; every 5 times your shield breaks: armor +2 (max +10)",
"Those broken five times grow iron in their wounds."
],
"fullset": [
"Full Set",
"Carrying one Common, one Rare and one Epic: one extra relic reroll per floor",
"Fill your pockets with odds and ends, and fate turns one more card."
],
"wellread": [
"Well-Read",
"Mastered words in spelling questions show no decoy letters",
"Know a word well enough and your eyes filter out the noise."
],
"inertia": [
"Momentum",
"Combo ≥5: a wrong answer drops it to 5 instead of 0; combo ≥5: damage +40%",
"Thirty in a row builds momentum that won't stop at once."
],
"counter": [
"Counter",
"Every multiple of 10 combo: restore 10 HP",
"Count to ten and your chest loosens by itself."
],
"rebound": [
"Rebound",
"Once per floor: when a 10+ combo breaks, regain half of it and heal 20% max HP",
"The broken chain bounces back a little when it lands."
],
"track": [
"Retrace",
"Fewer wrong answers than last floor: start the next floor with 110 shield",
"Avoid where you slipped yesterday, and the ground grows firmer."
],
"alms": [
"Alms",
"Each gold pile: 30% chance to double",
"Now and then the Hall hands you the whole fistful."
],
"welfare": [
"Fair Share",
"Clearing a floor: gain gold equal to floor × 2",
"Sweep a floor clean and the Hall pays your share."
],
"clasp": [
"Copper Clasp",
"On a new floor: restore 2% max HP per 200 gold you carry (max 6%)",
"The purse on your belt warms you one floor at a time."
],
"needle": [
"Coarse Needle",
"4 times per floor: correct spelling grants 3 shield",
"Stitched on thread by thread — armor too."
],
"oldrope": [
"Old Rope",
"6 times per floor: every 8 combo grants 2 shield",
"Knot it tightly enough and it holds more than firewood."
],
"shedge": [
"Shield Edge",
"Each new floor: +8 shield; every 20 shield: damage +3% (max +12%)",
"The worn-thin rim of a shield is sharper than a knife."
],
"armpad": [
"Armor Pad",
"Armor +1; each new floor: 4 shield per point of armor (max 20)",
"The cloth under the armor is what really touches you."
],
"weight": [
"Steelyard Weight",
"Crit rate +3%; +2% more per 200 gold you carry (max +11%)",
"Something heavy in the hand lands truer than a bare fist."
],
"chainmail": [
"Chainmail",
"Armor +1; +1 more per 6 combo (max +3)",
"Ring through ring — the longer linked, the tighter."
],
"towel": [
"Sweat Towel",
"Each floor: heal 5%; per 10% healed this floor: damage +2% (max +12%)",
"Wipe the sweat and the blade warms up again."
],
"paperweight": [
"Paperweight",
"Max HP +6; every 40 max HP: ATK +1 (max +8)",
"A stone that holds down paper holds down a wrist too."
],
"cap": [
"Apprentice Cap",
"4 times per floor: correct spelling restores 3% max HP",
"Whoever copies it all out sleeps soundest."
],
"bile": [
"Gall",
"Damage taken −5%; each 10% permanent reduction: damage +2% (max +10%)",
"Those who guard themselves most strike hardest."
],
"shieldheart": [
"Shield Heart",
"Each new floor: +15 shield; shield ≥50: damage taken −18%",
"When the shield is thick enough, the heartbeat slows."
],
"underarmor": [
"Under Armor",
"Armor +2; each new floor: restore 2% max HP per point of armor (max 18%)",
"The warmth trapped under the plates is the last medicine."
],
"linked": [
"Linked",
"Damage taken −5%; −5% more per 4 combo (max −30%)",
"The smoother your answers, the lighter the blows."
],
"bloodplate": [
"Blood Plate",
"Every 40 max HP: armor +1 (max +6)",
"Armor raised on blood knows its master."
],
"spellblade": [
"Spellblade",
"4 times per floor: after a correct spelling, the next 5 questions deal damage +80%",
"Spelled out letter by letter — it becomes a blade."
],
"critshield": [
"Crit Shield",
"8 times per floor: crits grant 6 shield",
"Strike hard enough and the splash becomes armor."
],
"armblade": [
"Armor Blades",
"Armor +2; every 2 armor: crit rate +3% (max +18%)",
"Sharpen the plates and even standing still is a blade."
],
"goldplate": [
"Gold Plate",
"Damage taken −5%; −4% more per 300 gold you carry (max −16%)",
"Gold is soft — but pile enough and it stops blows."
],
"mirroredge": [
"Mirror Edge",
"Each new floor: +15 shield; every 15 shield: crit rate +4% (max +20%)",
"A shield that reflects you reflects your foe's openings too."
],
"glyph": [
"Glyph",
"Correct spelling: armor +2 this floor (max +6, resets each floor)",
"Words written right stay on the skin until the next floor."
],
"bloodmaul": [
"Blood Maul",
"Every 10 HP healed this floor: damage +3 (max +15); heal 10% on each new floor",
"The strength of a closing wound goes into the next blow."
],
"twin": [
"Twin Born",
"Each new floor: +25 shield; every 15 shield: armor +1 (max +8)",
"Shield and armor were born together, only parted at birth."
],
"shieldking": [
"Shield King",
"Each floor: +30 shield; per 30 shield: damage +5%, armor +1 (max 4 tiers)",
"Whoever can lift that shield never needs to strike first."
],
"ironvow": [
"Iron Oath",
"Armor +3; every 3 armor: damage +5%, damage taken −2% (max 5 tiers)",
"Oaths press on the armor, heavier layer by layer."
],
"longsong": [
"Long Song",
"4 times per floor: every 10 combo: gain 15 shield and restore 3% max HP",
"Whoever sings to the tenth verse grows a shield in the throat."
],
"moltengold": [
"Molten Gold",
"Every 100 gold you carry: ATK +2, crit rate +2% (max 12 tiers)",
"Once gold melts, you can't tell coin from blade."
],
"evervow": [
"Eternal Plate",
"Damage taken −6%; +20 shield per floor; per 8% reduction: armor +1 (max +6)",
"Every blow blocked sinks into the armor and stays."
],
"confluence": [
"Confluence",
"Per 50 shield / 5 armor / 10 combo: damage +6%, taken −2% (max 9 tiers)",
"Shield, armor, and answers in a row — in the end, one river."
],
"janus": [
"Janus",
"Damage +15%, taken −8%; each 10% cut → +6% damage, each 40% → −4% taken",
"One face toward where you came from, one toward where you're going."
],
"swift": [
"Quick Wit",
"Correct within 3 seconds: damage +12%",
"Quick thinkers have quick hands."
],
"offbeat": [
"Offbeat",
"Correct within 3 seconds: combo +1 more",
"Speak before the echo lands."
],
"secondhand": [
"Second Hand",
"4 times per floor: correct within 3 seconds grants 7 shield",
"Every tick of the hand is another layer of armor."
],
"snap": [
"Snap Answer",
"Correct within 3 seconds: bonus damage +20",
"The blade arrives before the words finish."
],
"poise": [
"Poise",
"Each second left on the timer: damage +10% (max +60%)",
"The calmer you are, the heavier the blow."
],
"longword": [
"Long Sentence",
"Correct on a word with 8+ letters (pinyin): damage +15%",
"Long things swing heavier."
],
"volume": [
"Tomes",
"Correct answer: bonus damage +4 per letter (pinyin) beyond 6",
"One letter, one inch of iron."
],
"ponder": [
"Long Thought",
"3 times per floor: correct on a word with 8+ letters (pinyin) grants 10 shield",
"The longer the spelling, the thicker the wall."
],
"sprout": [
"Growth Spurt",
"Level up: restore 4% max HP",
"The push of growing bones is medicine too."
],
"satori": [
"Satori",
"Level up: gain 8 shield",
"The instant it clicks, a shell forms."
],
"keenrise": [
"Rising Edge",
"After leveling up, the next 5 questions deal damage +120%",
"New teeth are the sharpest."
],
"ascend": [
"Ascent",
"Level up: armor +3 this floor (max +12) and restore 5% max HP",
"Step by step, building up."
],
"exorcise": [
"Exorcism",
"3 times per floor: correct on a haunt word restores 2% max HP",
"Speak the thing that haunts you and it disperses."
],
"calmsoul": [
"Soul Calming",
"3 times per floor: correct on a haunt word grants 5 shield",
"Pin it down and it becomes your brick."
],
"feeddemon": [
"Demon Keeper",
"Each haunt you carry: damage +5% (max +40%)",
"Kept ghosts bite for you too."
],
"fearless": [
"Fearless",
"Wrong on a haunt: no HP lost, it doesn't worsen; right on one: damage +80%",
"Another bite? Is that all?"
],
"full": [
"Brimming",
"Above 80% HP: damage +10%",
"With your blood still full, your hand is steadiest."
],
"vim": [
"Vim",
"At full HP: crit rate +30%",
"Not a drop lost, and fire in the eyes."
],
"ease": [
"Ease",
"Above 80% HP: damage taken −12%",
"With room to spare, you can afford to lose."
],
"keenfull": [
"Full Edge",
"Above 50% HP: bonus damage +30",
"A blade is sharpest when full."
],
"prime": [
"Prime",
"At full HP: damage +85%; for 3 questions after losing HP: damage +40%",
"The strongest moment is before the first hit."
],
"triplecut": [
"Triple Cut",
"3 kills in a row without losing HP: ATK +10",
"Cut down three in one breath and the hand runs hot."
],
"bamboo": [
"Unstoppable",
"Each consecutive kill: damage +4% (max +32%)",
"Push the first one over, and the rest fall on their own."
],
"reapfull": [
"Finishing Breath",
"Defeating an enemy restores 2.5% max HP",
"Drop one, catch a breath."
],
"slaughter": [
"Slaughter",
"5 kills in a row without losing HP: crit rate +50%, armor +6",
"By the fifth, the blood isn't yours anymore."
],
"fortune": [
"Fortune",
"All chance-based effects trigger 25% more often",
"The dice know who's watching them."
],
"reshake": [
"Reroll",
"When a chance-based effect fails: 20% chance to roll again",
"On an unlucky day, the Hall lets you shake again."
],
"omen": [
"Good Omen",
"Relic choices: +15% chance to be one rarity higher",
"You smell the gold before you enter the door."
],
"stockpile": [
"Stockpile",
"Each relic bought this run: damage +5% (max +30%)",
"Things you buy burn in your hands."
],
"gatewait": [
"Gatekeeper's Wait",
"Entering a Boss floor: gain 120 shield and restore 25% max HP",
"Before the door rings, buckle your armor."
],
"knock": [
"Knocking",
"On Boss floors: damage +50%, damage taken −20%",
"Knock again and again; the door will open."
],
"instant": [
"Instant",
"Right within 3s: sure crit; after 5 quick answers in a row, next hit +150%",
"So fast even the Hall didn't notice."
],
"whole": [
"Wholeness",
"Full HP: damage +80%, armor +8; once per floor below 50% HP, heal back to 80%",
"A thing in one piece can't be shattered."
]
};

/* 数据表：按 id 换掉名字和说明（content.js 本身一个字不动 —— 战场那边还要读中文）。*/
var FOE_EN = {rat:"Corridor Rat", slime:"Pantry Slime", spider:"Longleg Cave Spider", bone:"Bone Soldier",
  statue:"Gate Statue", ghost:"Whispering Ghost", clock:"Rusty Bell", warden2:"Wandering Shade",
  dread:"Fear Eater", prism:"Shattered Prism", gate:"Floor Warden", abyss:"The Endless Shade",
  warden:"Stone Hall Warden", steward:"Rust Court Steward", priest:"Ember Priest", crown:"Crowned of the Ruin"};
var CH_EN = {1:"Stone Hall", 2:"Rust Court", 3:"Ember Abyss", 4:"Ruin's Heart", 5:"Endless"};
var DIFF_EN = {A:["Tier A", "Original", "No ATK bonus", "The game as it was built"],
  B:["Tier B", "A bit easier", "ATK +25%"], C:["Tier C", "Easier still", "ATK +50%"],
  D:["Tier D", "Easiest", "ATK +100%", "Exactly cancels out practice mode"]};
function i18nApplyContent(){
  /* 学中文时，章节的难度标签换成 HSK（学英语那一档还是 A1/A2/B1/B2）*/
  if(LEARN_ZH){
    var HSK = {1:"HSK 1", 2:"HSK 2", 3:"HSK 3", 4:"HSK 4", 5:"HSK 3–5"};
    CHAPTERS.forEach(function(c){ c.level = HSK[c.id] || c.level; });
  }
  if(!UI_EN) return;
  RELICS.forEach(function(r){ var e = RELIC_EN[r.id]; if(e){ r.n = e[0]; r.pw = e[1]; r.lore = e[2]; } });
  FOES.forEach(function(f){ if(FOE_EN[f.id]) f.name = FOE_EN[f.id]; });
  GATEKEEPER.name = FOE_EN.gate; ABYSS.name = FOE_EN.abyss;
  CHAPTERS.forEach(function(c){
    c.name = CH_EN[c.id] || c.name;
    if(c.boss && FOE_EN[c.boss.id]) c.boss.name = FOE_EN[c.boss.id];
  });
  var LV = {1:"HSK 1", 2:"HSK 2", 3:"HSK 3", 4:"HSK 4", 5:"HSK 3–5"};
  ROUTES.forEach(function(r){
    var c = chapterById0(r.ch);
    r.name = CH_EN[r.ch] || r.name;
    r.tag = "Chapter " + r.ch + " · " + (c ? c.level : "");
    r.desc = r.ch === 5 ? ((LEARN_ZH ? "HSK 3 / 4 / 5" : "B1 / B2 / C1") + " mixed · go until you fall")
                        : ((c ? c.level : "") + " words · 50 floors");
  });
  DIFFS.forEach(function(d){
    var e = DIFF_EN[d.id]; if(!e) return;
    d.name = e[0]; d.tag = e[1]; d.desc = e[2]; if(e[3]) d.note = e[3];
  });
  RAR_CN = ["Common", "Rare", "Epic", "Legendary", "Divine"];
  CAT_CN = {animal:"Animal", food:"Food", color:"Color", body:"Body", people:"People",
    thing:"Thing", nature:"Nature", verb:"Action", adj:"Description",
    time:"Time", place:"Place", feel:"Feeling", num:"Number", adv:"Adverb"};
  POS_CN = {n:"Noun", v:"Verb", adj:"Adjective", adv:"Adverb", num:"Numeral"};
}
function chapterById0(id){
  for(var i = 0; i < CHAPTERS.length; i++) if(CHAPTERS[i].id === id) return CHAPTERS[i];
  return null;
}
/* 静态页面：先整块换（玩法说明这类一段话被 <b> 切成十几截的），再逐个文本节点换。*/
function i18nApplyPage(){
  if(!UI_EN) return;
  Object.keys(I18N_BLOCKS).forEach(function(sel){
    Array.prototype.forEach.call(document.querySelectorAll(sel), function(el){ el.innerHTML = I18N_BLOCKS[sel]; });
  });
  i18nDom(document.body);
  document.title = T("幽墟回廊");
}
i18nApplyContent();
i18nApplyPage();
