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
  const stories={
    adv:[
      '冒险者出发时摘下了村口的旧路牌。他怕走得太远，忘记回家的方向。',
      '这枚绳结是冒险者第一次独自打的。后来每救回一个同伴，他便在绳上添一个结。',
      '暴雪埋住了来路，冒险者却仍把营旗朝着故乡插好。掉队的人循着那一点红找到了火。',
      '伙伴们各留了一截木柴给冒险者。最后一人离开后，他仍守着那堆不肯熄灭的火。',
      '冒险者终于走到地图尽头，行囊里没有财宝，只有一路替人捎带、还未送达的家书。'
    ],
    clerk:[
      '书吏舍不得丢掉这支短笔。城门关闭前，最后一个获准入城的名字便是用它写下的。',
      '书吏把涂错的姓名另抄在一页纸上。他说，写错可以重来，漏掉的人却未必会回来。',
      '大水带走了档案室，书吏却从衣襟里取出另一份名册。纸上每一个字都曾抄过两遍。',
      '书吏每晚磨墨时都会念一遍失踪者的名字。池底早已干涸，笔尖却仍能蘸起墨来。',
      '无名的墓碑旁，书吏誊录了最后一个真名。那一夜，城外久久不散的脚步声终于停了。'
    ],
    duelist:[
      '剑客第一次落败，剑鞘也裂了一道口。他没有修补，怕忘记那把比自己更快的剑。',
      '剑客把师父的旧绑带缠在脚踝。师父教他的第一招不是拔剑，而是让开半步。',
      '剑客曾在桥头等一只燕子归巢。雨停时，他终于看清它折返前那一瞬的停顿。',
      '那场决斗没有开始。剑客接过白手套，替病倒的对手守了一夜门。',
      '剑客留下的空地上没有剑痕。只有曾与他交手的人记得，风是如何忽然停住的。'
    ],
    hermit:[
      '隐士进山时只带了这张草垫。许多年后，垫子旁多了一个给过路人留的位置。',
      '隐士等香燃尽才回答来客的问题。许多来客在这段寂静里，已经找到了自己的答案。',
      '寺院荒废后，隐士仍在清晨敲响木鱼。山谷中的回声，比从前的钟声还要远。',
      '山洪来时，隐士把印石压在摇晃的桥板上。等最后一个人过桥，他才松开手。',
      '人们寻遍深山，也没有找到隐士的居所。后来有人记起，他从不把门关上。'
    ],
    pioneer:[
      '地图缺失的那一角，是拓荒者故意撕去的。那里葬着第一个愿意替他带路的人。',
      '拓荒者用铜针量过河谷与山脊。针尖磨钝后，他开始在地图上标出可以歇脚的屋子。',
      '同行的人争论该给山谷起什么名字。拓荒者只在旗上写了日期，以及每个人的姓名。',
      '城里许诺给拓荒者整片新土。他退回地契，请他们先修一条能让孩子安全走过的路。',
      '拓荒者最后画下的不是终点，而是一扇敞开的门。门外的路，留给后来的人去走。'
    ],
    keeper:[
      '守夜人把破裂的灯罩补了又补。夜归的人认得这盏灯，不愿他换成别的。',
      '值簿上记录着关门的时刻，也记录着那些迟迟未归的人。守夜人从不替他们画上句号。',
      '最后一盒火柴受潮了。守夜人在掌心护住两块火石，直到街角重新亮起微光。',
      '接班的人始终没有来，守夜人便多站了一夜。黎明时，他替熟睡的孩子掖好了围巾。',
      '长夜终于结束，守夜人没有熄灯。他说，或许还有人刚刚踏上归途。'
    ],
    exorcist:[
      '驱魔人第一次收起符纸，是因为门后的哭声太像一个迷路的孩子。',
      '红绳原本用来缚住恶梦。驱魔人后来把它系在门把上，让屋里的人知道自己并不孤单。',
      '镜中从不显出妖魔的面孔。驱魔人只能看见，它们生前最后一次害怕的模样。',
      '驱魔人把剑印留在空屋里，却没有封门。他答应过，会让困在这里的魂找到出口。',
      '那晚没有咒语，也没有剑声。驱魔人逐一念完姓名，天亮时，旧宅里只剩风。'
    ],
    rogue:[
      '狂徒输掉最后一枚筹码时，才发现桌对面的人把缺角的一枚又推了回来。',
      '这副骰子从未掷出过最好的点数。狂徒仍带着它，因为最坏的一夜已经过去了。',
      '酒馆的人以为狂徒在等好运。他只是端着那只旧杯，等同伴坐回原来的位置。',
      '狂徒在契约上押下自己的名字，把其他人的名字一笔一笔划掉了。',
      '命运要狂徒押上最后的性命。他把赌桌掀了，说这一次，谁都不用再下注。'
    ],
    reader:[
      '晨读者把最喜欢的一页折起，赶在天亮前读给病中的母亲听。',
      '木签上每天多一道刻痕。晨读者记的不是读过多少书，而是多少个仍有灯亮的早晨。',
      '买不起墨水时，晨读者用清水临字。太阳升起，那些看不见的笔画仍留在他心里。',
      '窗边的灯已经亮了一百日。邻居们渐渐习惯，循着晨读者翻书的声音起床。',
      '书里的最后一页是空白。晨读者没有合上它，而是推开窗，让第一束光落了进去。'
    ],
    naturalist:[
      '博物学者夹起的第一朵花没有学名。是带他走进森林的孩子告诉他，这花能找到春天。',
      '博物学者用透镜看清虫翼后，打开了采集盒。那只小虫在他指尖停了一会儿才飞走。',
      '标本盘的中央始终空着。博物学者说，有些东西只有活在林间时才算完整。',
      '图鉴的页边挤满不同笔迹。博物学者坚持让每个带路的人，亲手写下自己看见的事物。',
      '博物学者最后的收藏是一只敞口瓶。苔藓、雨水与一粒种子，在里面度过了整个冬天。'
    ],
    poet:[
      '造句者把墨条折成两半，才终于给那封写了三年的信落下句点。',
      '纸鹤飞不过城墙，造句者便把诗写在它的翅膀里，托守门人带给墙外的人。',
      '银尺量得准每一个字，却量不出思念。造句者把尺子收起，第一次写了不齐整的诗行。',
      '长诗还缺最后一句，收信的人却已不在。造句者仍每天坐回桌前，替她续写明天。',
      '人们忘了造句者的名字，却记得他写过的河流、炊烟和归家的路。那些地方从未荒芜。'
    ],
    bard:[
      '乐师的旧拨片只剩半截。另一半被一个孩子带走，说要靠它认出父亲最爱的曲子。',
      '乐师曾跟不上队伍的脚步。有人在铜环上轻轻敲了四下，从此所有人都走慢了一点。',
      '音叉在空剧场里响起时，乐师仿佛又听见了散场前那一句安可。',
      '原本有四个人约好一起演奏。乐师留下四副琴弦，独自弹完了他们来不及合奏的乐章。',
      '战争结束后，乐师沿着旧战线演奏。没有人点歌，他便为每一座无名坟墓停留一曲。'
    ],
    clock:[
      '钟表匠修过无数座钟，却一直没修好女儿送来的这枚小齿轮。她说停着也很好看。',
      '钟表匠总比约定早到一刻钟。他把多出来的等待留在发条里，慢慢攒成了习惯。',
      '擒纵器第一次倒转时，钟表匠听见了昨日的雨。他伸出手，掌心却仍是干的。',
      '来客求借一天，钟表匠只借给他一秒。那一秒，足够他握住正在松开的手。',
      '午夜之后，钟表匠听见了第十三声钟响。他没有追上去，只把怀表放在空着的椅子旁。'
    ],
    examiner:[
      '追问者小时候总把问号夹在书页里。老师说，一个好问题值得留到明天。',
      '问签的背面写着另一种答案。追问者每次看完，都会把签子再翻过去。',
      '追问者戴上墨镜，反复查看同一处旧痕迹。直到有一天，他发现自己一直站错了位置。',
      '追问录的最后几页没有结论。追问者留下不同人的证词，不愿替任何人删去一句。',
      '临别时，学生问追问者是否已经找到了所有答案。他笑着问，那你还想知道什么？'
    ],
    heir:[
      '后继者第一次披上旧披肩，扣子便落了下来。师父替他缝好，说衣服还得陪他走很远。',
      '手套的掌心烧穿过一次。后继者接过火把时，才明白师父为何一直没有松手。',
      '交接时没有仪式。后继者只收到一枚钥匙，和一张写着待办事项的旧纸条。',
      '后继者读完誓约，划去了自己的名字。他想等真正做到了，再堂堂正正地签回去。',
      '王冠交到后继者手中时，城墙已经坍塌。他没有加冕，只把它放在重建后的第一块砖旁。'
    ],
    mage:[
      '法师保留着第一次烧焦的木杖。每逢学徒施法失误，他就把这根杖拿给他们看。',
      '戒指结霜的那年，法师终于学会收住火焰。窗边冻伤的花，在春天重新开了。',
      '法师让火、霜与新芽轮流住进石中。三个互不相容的小东西，竟慢慢安静下来。',
      '魔法塔失火时，法师没有熄灭所有火焰。他把最后一点火种，送进了冬日的村庄。',
      '原初魔典的第一句并非咒语。法师写道：施法之前，先想想有什么需要被留下。'
    ],
    astro:[
      '星象师把童年落在窗台的一粒亮砂藏进盘中。后来他走到哪里，都能找到那扇窗。',
      '黄昏里，星象师透过棱镜看见四种颜色。他说夜色不是降临，而是在慢慢展开。',
      '守塔的人睡着以后，星象师仍守着星轨，为海上最后一艘船标出方向。',
      '天球停在深夜与黎明之间。星象师没有拨动它，静静等第一只鸟开口。',
      '星象师留下的星图没有中心。每一个抬头的人，都能在图中找到自己的位置。'
    ],
    smith:[
      '锻造师用这把铁钳夹过第一块热铁。师父留下的烫痕，正好落在他的手指旁。',
      '护腕里缝着一片冷却的铁屑。锻造师说，记住退火的时刻，比记住炉温更难。',
      '风箱破了以后，锻造师用旧皮袄补好缺口。那年冬天，镇上没有一间铺子断过炭火。',
      '无数名剑从锻砧上诞生，锻造师最满意的作品却是一副替老兵做的拐杖。',
      '锻造师封炉前，把剩下的兵器全部熔了。第二年开春，田里用上了新打的犁。'
    ],
    necro:[
      '招魂者点燃蜡烛后，先在门口留一双鞋。他不想让第一次回家的人感到拘束。',
      '每一声魂铃，都有一个名字回应。招魂者把铃声放得很轻，怕惊醒已安睡的人。',
      '招魂者从不收取渡河的钱。那枚铜钱，是一个终于等到家人的亡魂执意留下的。',
      '提灯照不见前方，只照得见身后的脚印。招魂者举着它，陪走错路的魂再走一遍。',
      '冥河彼岸没有军号。招魂者展开旧旗，让最后一队亡魂认出归乡时的路标。'
    ],
    bounty:[
      '赏金猎人拔下悬赏钉，才发现画像背面是一张孩子画的全家福。',
      '皮带里藏着两份干粮。赏金猎人习惯多带一份，追上的人未必还走得动。',
      '望镜里出现目标的那一刻，赏金猎人先看见了挡在对方身前的小女孩。',
      '赏金猎人撕掉了那张血契，只留下印章。他需要记得，有些钱不能拿。',
      '最后一份契约没有赏金。赏金猎人答应一个垂死的人，把他的狗送回家。'
    ],
    medium:[
      '灵媒拾起骨珠时，听见的不是咒怨，而是一位母亲没唱完的摇篮曲。',
      '薄纱隔开生者与亡者的目光。灵媒掀起它时，总会先问一声：你愿意被看见吗？',
      '镜面映出无数张陌生的脸。灵媒在镜背写下自己的名字，提醒每一位来客不必久留。',
      '三支蜡烛各有一段未竟的心愿。灵媒等它们依次燃尽，再把空位留给下一位来客。',
      '所有声音散去后，灵媒终于听见自己的心跳。她把窗打开，向空屋道了一声晚安。'
    ],
    apothecary:[
      '药剂师每天清晨用小勺收集叶上的露水。学徒问为何如此仔细，他说总有人只差这一滴。',
      '纱布的边缘绣着笨拙的针脚。那是药剂师救回的孩子，偷偷替他补好的。',
      '药剂师把溢出的药液另装一瓶。天冷时，总有买不起整剂药的人来敲门。',
      '两种药液一清一浊，必须慢慢摇匀。药剂师等病人平静下来，才把药杯递过去。',
      '疫病过去后，药剂师仍每天熬上一釜清汤。曾来求药的人，如今可以坐下来好好吃饭。'
    ],
    debater:[
      '辩手第一次登台，草稿被风吹散。他只好放下准备好的胜负，认真听对方说完。',
      '铜铃只在有人被打断时响起。辩手从未用它替自己抢过一次发言。',
      '徽章背面刻着辩手输掉的那场辩论。他常说，那是自己最值得记住的一次胜利。',
      '法槌落下之前，辩手请求再听一遍证词。最后一个开口的人，改变了整个判决。',
      '议庭里没有争吵，却也没有人被迫沉默。辩手把铃留在桌上，等所有人慢慢说完。'
    ],
    mentor:[
      '导师用红笔圈出了学生唯一写对的一个字。那张作业，后来一直贴在讲台旁。',
      '手札里夹着许多笨拙的提问。导师没有改正它们，只在旁边留下自己的思考。',
      '教尺从未落在学生手上。导师拿它支住破窗，让怕冷的孩子坐得离风远一点。',
      '学生们各刻了一片叶子送给导师。印面拼好时，他发现自己已记不清收过多少份谢意。',
      '旧学堂拆除那天，导师没有带走讲坛。愿意教别人的学生，早已把它带往更远的地方。'
    ],
    merchant:[
      '商人把秤砣磨亮，连看不清刻度的老人，也能放心称走一袋米。',
      '暗袋里总有几枚找不开的零钱。商人记得每一位顾客，也记得谁说过下次再补。',
      '算盘上少了一颗珠子。商人把它送给赶路的孩子，让他记住回家的车费已经付清。',
      '城里的人争着给宝石估价，商人却把一碗热粥放上天平。他想知道饥饿该值多少钱。',
      '商人最后一次开市，没有标价。人们带来种子、手艺和故事，带走自己真正缺少的东西。'
    ],
    tamer:[
      '驯兽师捡到幼兽时，颈绳勒进了皮肉。他剪断绳结，坐在远处等它自己走近。',
      '骨哨被咬得满是牙印。驯兽师从不责怪，因为那是幼兽第一次愿意留在他身旁。',
      '兽笛没有命令的曲调。驯兽师只吹两声，让林中的伙伴知道自己正往哪边走。',
      '兽群包围营地那晚，驯兽师取下牙环，走到火光之外。天亮时，他和它们一同回来。',
      '驯兽师解开了最后一道围栏。没有一只兽立刻离去，它们只是在风里抬起了头。'
    ],
    warcrier:[
      '战吼者还不会放声呐喊时，就用这只口哨提醒走散的伙伴：我在这里。',
      '喉甲遮住一道旧伤。战吼者声音沙哑，却从未让求援的人等到第二次呼喊。',
      '号角原本用来催人冲锋。战吼者学会的第一支曲子，却是召回所有人。',
      '桥快要断的时候，战吼者敲响战鼓。最后一个人听着鼓点，终于走到了对岸。',
      '战吼者失去声音以后，山谷仍回应着他的呼喊。同行的人开始替他喊出彼此的名字。'
    ],
    collector:[
      '收藏家给一枚生锈的纽扣编号。卖旧货的人笑了，他却说，这是某个人认真缝上去的。',
      '手套干净得像从未用过。收藏家每次触碰旧物前，都会先把双手洗净。',
      '陈列台上没有价签。收藏家把来访者的回忆写在旁边，偶尔请他们亲自讲一遍。',
      '轮盘每转一次，就停在一件不起眼的旧物前。收藏家从不催促，等故事自己开口。',
      '收藏家离去时没有留下钥匙。整座星库都敞着门，让每件遗物有机会再被人记起。'
    ],
    rewinder:[
      '回溯者第一次拨动指针，只为多听一遍朋友的道别。第二遍，他终于说出了再见。',
      '沙漏里装着昨日街角落下的细沙。回溯者带着它，却再也找不到同一场雨。',
      '怀表里藏着一张模糊的合影。回溯者试过许多次，最后仍留下了每个人最自然的笑容。',
      '时镜出现裂纹时，回溯者没有修补。他记得，是有人穿过碎裂的光把自己拉了回来。',
      '回溯者终于找到能留住一刻的锚，却没有抛下去。他想和同行的人，一起走到明天。'
    ],
    saint:[
      '剑圣初学握剑时，在这块石头前站了整日。师父只问他，听见风了吗？',
      '剑铃只在归鞘时轻响。剑圣说，拔剑的理由总有许多，收剑却只需要一个。',
      '木匣里没有名剑，只有一柄磨钝的练习剑。剑圣每年归来，都会替它换一层新布。',
      '剑匣最后一次开启时，旁观者什么也没有看见。剑圣已转过身，替身后的孩子挡住风。',
      '晚年的剑圣把名剑一一归还原主。院中只留一根木枝，等下一个想学剑的孩子来。'
    ]
  };
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
      pw:statNames[stat]+' +'+statScale[stat][q]+(stat==='crit'?'%':'')+'；每'+every+(trigger==='sand'?'秒':'次')+triggers[trigger]+'：'+text+(revive?'；每层一次致死时回复 '+Math.round(revive[1]*100)+'% 生命':'')+'。',
      lore:stories[hero][q]});
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
