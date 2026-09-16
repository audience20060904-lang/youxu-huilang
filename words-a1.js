/* 第一章词库 · CEFR A1 → B1，共 430 词
   格式：[英文, 中文, 类别, 难度]   难度：1=A1  2=A2  3=B1

   **难度跟层数挂钩**：越深越靠近 B1，映射写在 game.js 的 wordLevels()。
   加词直接往 WORDS 里加，四个字段都要给；类别要在 CAT_CN 里有对应中文名。
   **英文不能重复** —— WMAP 按英文做键，重了会静默覆盖。
   怪物按类别出题（见 content.js 里每只怪的 cat 字段）。*/
"use strict";

var CAT_CN = {
  animal:"动物", food:"食物", color:"颜色", body:"身体", people:"人",
  thing:"物品", nature:"自然", verb:"动作", adj:"描述",
  time:"时间", place:"地点", feel:"情绪"
};

var WORDS = [
["cat","猫","animal",1],["dog","狗","animal",1],["bird","鸟","animal",1],["fish","鱼","animal",1],
["horse","马","animal",1],["pig","猪","animal",1],["cow","奶牛","animal",1],["duck","鸭子","animal",1],
["rabbit","兔子","animal",1],["mouse","老鼠","animal",1],["bear","熊","animal",1],["tiger","老虎","animal",1],
["lion","狮子","animal",1],["monkey","猴子","animal",1],["sheep","绵羊","animal",1],["chicken","鸡","animal",1],

["bread","面包","food",1],["milk","牛奶","food",1],["egg","鸡蛋","food",1],["rice","米饭","food",1],
["apple","苹果","food",1],["banana","香蕉","food",1],["water","水","food",1],["meat","肉","food",1],
["cake","蛋糕","food",1],["soup","汤","food",1],["tea","茶","food",1],["juice","果汁","food",1],
["sugar","糖","food",1],["salt","盐","food",1],["noodles","面条","food",1],

["red","红色的","color",1],["blue","蓝色的","color",1],["green","绿色的","color",1],["yellow","黄色的","color",1],
["black","黑色的","color",1],["white","白色的","color",1],["brown","棕色的","color",1],["pink","粉色的","color",1],

["hand","手","body",1],["head","头","body",1],["eye","眼睛","body",1],["ear","耳朵","body",1],
["nose","鼻子","body",1],["mouth","嘴","body",1],["foot","脚","body",1],["hair","头发","body",1],
["arm","手臂","body",1],["leg","腿","body",1],

["mother","妈妈","people",1],["father","爸爸","people",1],["sister","姐妹","people",1],["brother","兄弟","people",1],
["family","家庭","people",1],["friend","朋友","people",1],["baby","婴儿","people",1],["boy","男孩","people",1],
["girl","女孩","people",1],["teacher","老师","people",1],

["book","书","thing",1],["pen","钢笔","thing",1],["chair","椅子","thing",1],["table","桌子","thing",1],
["door","门","thing",1],["window","窗户","thing",1],["bed","床","thing",1],["box","盒子","thing",1],
["key","钥匙","thing",1],["bag","包","thing",1],["clock","钟","thing",1],["cup","杯子","thing",1],
["phone","电话","thing",1],["car","汽车","thing",1],["bike","自行车","thing",1],["ball","球","thing",1],
["shoe","鞋","thing",1],["hat","帽子","thing",1],["coat","外套","thing",1],["map","地图","thing",1],

["sun","太阳","nature",1],["moon","月亮","nature",1],["star","星星","nature",1],["tree","树","nature",1],
["flower","花","nature",1],["rain","雨","nature",1],["snow","雪","nature",1],["wind","风","nature",1],
["fire","火","nature",1],["stone","石头","nature",1],["river","河","nature",1],["mountain","山","nature",1],
["sky","天空","nature",1],["sea","海","nature",1],["night","夜晚","nature",1],["day","白天","nature",1],

["run","跑","verb",1],["walk","走","verb",1],["eat","吃","verb",1],["drink","喝","verb",1],
["sleep","睡觉","verb",1],["read","读","verb",1],["write","写","verb",1],["sing","唱歌","verb",1],
["jump","跳","verb",1],["open","打开","verb",1],["close","关上","verb",1],["look","看","verb",1],
["sit","坐","verb",1],["stand","站","verb",1],["give","给","verb",1],["help","帮助","verb",1],
["come","来","verb",1],["go","去","verb",1],["take","拿","verb",1],["find","找到","verb",1],

["big","大的","adj",1],["small","小的","adj",1],["hot","热的","adj",1],["cold","冷的","adj",1],
["good","好的","adj",1],["bad","坏的","adj",1],["new","新的","adj",1],["old","旧的","adj",1],
["happy","快乐的","adj",1],["sad","伤心的","adj",1],["fast","快的","adj",1],["slow","慢的","adj",1],
["long","长的","adj",1],["short","短的","adj",1],["strong","强壮的","adj",1],["tired","累的","adj",1]
/* ---------- A2（第 13 层起开始掺，第 21 层起成为主力） ---------- */
,["wolf","狼","animal",2],["snake","蛇","animal",2],
["bee","蜜蜂","animal",2],["ant","蚂蚁","animal",2],["goat","山羊","animal",2],["deer","鹿","animal",2],
["frog","青蛙","animal",2],["eagle","鹰","animal",2],["shark","鲨鱼","animal",2],["salad","沙拉","food",2],["cheese","奶酪","food",2],["butter","黄油","food",2],
["pepper","胡椒","food",2],["onion","洋葱","food",2],["potato","土豆","food",2],["tomato","西红柿","food",2],
["carrot","胡萝卜","food",2],["lemon","柠檬","food",2],["grape","葡萄","food",2],["honey","蜂蜜","food",2],
["sausage","香肠","food",2],["biscuit","饼干","food",2],

["grey","灰色的","color",2],["purple","紫色的","color",2],["golden","金色的","color",2],["silver","银色的","color",2],
["dark","深色的","color",2],["bright","明亮的","color",2],

["shoulder","肩膀","body",2],["knee","膝盖","body",2],["elbow","手肘","body",2],["finger","手指","body",2],
["throat","喉咙","body",2],["stomach","胃","body",2],["tooth","牙齿","body",2],["skin","皮肤","body",2],
["bone","骨头","body",2],["blood","血","body",2],

["neighbour","邻居","people",2],["stranger","陌生人","people",2],["guest","客人","people",2],["owner","主人","people",2],
["soldier","士兵","people",2],["farmer","农民","people",2],["artist","艺术家","people",2],["singer","歌手","people",2],
["writer","作家","people",2],["leader","领导者","people",2],["customer","顾客","people",2],["partner","伙伴","people",2],

["ticket","票","thing",2],["wallet","钱包","thing",2],["mirror","镜子","thing",2],["candle","蜡烛","thing",2],
["blanket","毯子","thing",2],["pillow","枕头","thing",2],["needle","针","thing",2],["rope","绳子","thing",2],
["ladder","梯子","thing",2],["hammer","锤子","thing",2],["basket","篮子","thing",2],["envelope","信封","thing",2],
["stamp","邮票","thing",2],["engine","发动机","thing",2],["wheel","轮子","thing",2],["screen","屏幕","thing",2],

["forest","森林","nature",2],["desert","沙漠","nature",2],["island","岛","nature",2],["valley","山谷","nature",2],
["storm","暴风雨","nature",2],["thunder","雷","nature",2],["fog","雾","nature",2],["ice","冰","nature",2],
["sand","沙子","nature",2],["rock","岩石","nature",2],["branch","树枝","nature",2],["root","根","nature",2],
["shadow","影子","nature",2],["wave","波浪","nature",2],

["borrow","借入","verb",2],["lend","借出","verb",2],["climb","攀爬","verb",2],["throw","扔","verb",2],
["catch","接住","verb",2],["choose","选择","verb",2],["decide","决定","verb",2],["explain","解释","verb",2],
["repeat","重复","verb",2],["describe","描述","verb",2],["compare","比较","verb",2],["collect","收集","verb",2],
["repair","修理","verb",2],["destroy","摧毁","verb",2],["protect","保护","verb",2],["follow","跟随","verb",2],
["hide","躲藏","verb",2],["search","搜寻","verb",2],["arrive","到达","verb",2],["return","返回","verb",2],
["prepare","准备","verb",2],["practise","练习","verb",2],["invite","邀请","verb",2],["promise","承诺","verb",2],

["heavy","重的","adj",2],["light","轻的","adj",2],["empty","空的","adj",2],["full","满的","adj",2],
["deep","深的","adj",2],["narrow","窄的","adj",2],["wide","宽的","adj",2],["sharp","锋利的","adj",2],
["smooth","光滑的","adj",2],["rough","粗糙的","adj",2],["quiet","安静的","adj",2],["loud","响亮的","adj",2],
["strange","奇怪的","adj",2],["famous","著名的","adj",2],["modern","现代的","adj",2],["ancient","古老的","adj",2],
["safe","安全的","adj",2],["dangerous","危险的","adj",2],["simple","简单的","adj",2],["difficult","困难的","adj",2],

/* ---------- 新类别：时间 / 地点 / 情绪 ---------- */
["morning","早晨","time",1],["week","星期","time",1],["year","年","time",1],
["today","今天","time",1],["tomorrow","明天","time",1],["hour","小时","time",2],["minute","分钟","time",2],
["season","季节","time",2],["spring","春天","time",2],["summer","夏天","time",2],["autumn","秋天","time",2],
["winter","冬天","time",2],["future","未来","time",2],["past","过去","time",2],["moment","时刻","time",2],

["school","学校","place",1],["shop","商店","place",1],["home","家","place",1],["room","房间","place",1],
["station","车站","place",2],["airport","机场","place",2],["hospital","医院","place",2],["market","市场","place",2],
["library","图书馆","place",2],["factory","工厂","place",2],["village","村庄","place",2],["bridge","桥","place",2],
["corner","角落","place",2],["gate","大门","place",2],["tower","塔","place",2],["cave","洞穴","place",2],["angry","生气的","feel",2],["afraid","害怕的","feel",2],["bored","无聊的","feel",2],["excited","兴奋的","feel",2],["nervous","紧张的","feel",2],
["proud","自豪的","feel",2],["lonely","孤独的","feel",2],["surprised","惊讶的","feel",2],["worried","担心的","feel",2],
/* ---------- B1（第 31 层起掺入，第 41 层起成为主力） ---------- */
["creature","生物","animal",3],["insect","昆虫","animal",3],["beast","野兽","animal",3],["prey","猎物","animal",3],
["nest","巢","animal",3],["herd","兽群","animal",3],["feather","羽毛","animal",3],["claw","爪子","animal",3],

["recipe","食谱","food",3],["flavour","味道","food",3],["ingredient","配料","food",3],["portion","一份","food",3],
["diet","饮食","food",3],["harvest","收成","food",3],["supply","供给","food",3],["spice","香料","food",3],

["pale","苍白的","color",3],["shade","色调","color",3],["faded","褪色的","color",3],["glowing","发光的","color",3],

["muscle","肌肉","body",3],["nerve","神经","body",3],["breath","呼吸","body",3],["wound","伤口","body",3],
["scar","疤痕","body",3],["pulse","脉搏","body",3],["spine","脊柱","body",3],["flesh","血肉","body",3],

["witness","目击者","people",3],["expert","专家","people",3],["manager","经理","people",3],["citizen","公民","people",3],
["rival","对手","people",3],["ancestor","祖先","people",3],["servant","仆人","people",3],["thief","小偷","people",3],
["guard","守卫","people",3],["priest","祭司","people",3],

["device","装置","thing",3],["weapon","武器","thing",3],["shield","盾牌","thing",3],["chain","锁链","thing",3],
["lock","锁","thing",3],["trap","陷阱","thing",3],["torch","火把","thing",3],["banner","旗帜","thing",3],
["coin","硬币","thing",3],["treasure","宝藏","thing",3],["fragment","碎片","thing",3],["tool","工具","thing",3],
["container","容器","thing",3],["material","材料","thing",3],

["cliff","悬崖","nature",3],["stream","溪流","nature",3],["swamp","沼泽","nature",3],
["dust","尘土","nature",3],["flame","火焰","nature",3],["ash","灰烬","nature",3],["crystal","水晶","nature",3],
["surface","表面","nature",3],["depth","深处","nature",3],["silence","寂静","nature",3],["echo","回声","nature",3],

["discover","发现","verb",3],["survive","幸存","verb",3],["escape","逃脱","verb",3],["defend","防御","verb",3],
["attack","攻击","verb",3],["struggle","挣扎","verb",3],["achieve","达成","verb",3],["require","需要","verb",3],
["contain","包含","verb",3],["reveal","揭示","verb",3],["avoid","避开","verb",3],["approach","接近","verb",3],
["vanish","消失","verb",3],["gather","聚集","verb",3],["whisper","低语","verb",3],["crawl","爬行","verb",3],
["swallow","吞下","verb",3],["bury","埋葬","verb",3],["carve","雕刻","verb",3],["forge","锻造","verb",3],
["betray","背叛","verb",3],["endure","忍受","verb",3],["summon","召唤","verb",3],["awaken","唤醒","verb",3],["hollow","空心的","adj",3],["fragile","脆弱的","adj",3],["solid","坚固的","adj",3],
["bitter","苦的","adj",3],["cruel","残酷的","adj",3],["gentle","温和的","adj",3],["silent","无声的","adj",3],
["endless","无尽的","adj",3],["hidden","隐藏的","adj",3],["sacred","神圣的","adj",3],["cursed","被诅咒的","adj",3],
["brave","勇敢的","adj",3],["greedy","贪婪的","adj",3],["patient","有耐心的","adj",3],["curious","好奇的","adj",3],
["obvious","明显的","adj",3],["certain","确定的","adj",3],["possible","可能的","adj",3],["familiar","熟悉的","adj",3],

["century","世纪","time",3],["decade","十年","time",3],["delay","延迟","time",3],
["period","时期","time",3],["recent","最近的","time",3],["sudden","突然的","time",3],["eternal","永恒的","time",3],

["palace","宫殿","place",3],["temple","神庙","place",3],["prison","监狱","place",3],["tunnel","隧道","place",3],
["chamber","密室","place",3],["ruin","废墟","place",3],["border","边界","place",3],["shelter","庇护所","place",3],
["region","地区","place",3],["path","小径","place",3],

["fear","恐惧","feel",3],["hope","希望","feel",3],["anger","愤怒","feel",3],["shame","羞耻","feel",3],
["regret","后悔","feel",3],["relief","宽慰","feel",3],["courage","勇气","feel",3],["despair","绝望","feel",3],
["doubt","怀疑","feel",3],["trust","信任","feel",3],["desire","渴望","feel",3],["grief","悲痛","feel",3]
];

/* 派生索引 —— 加词后自动生效，不用手动维护 */
var WMAP = {};
WORDS.forEach(function(w){ WMAP[w[0]] = {en:w[0], cn:w[1], cat:w[2], lv:w[3] || 1}; });
var BYCAT = {};
WORDS.forEach(function(w){ (BYCAT[w[2]] = BYCAT[w[2]] || []).push(WMAP[w[0]]); });
/* 按难度分桶，出题时按层数挑桶 */
var BYLV = {1:[], 2:[], 3:[]};
WORDS.forEach(function(w){ BYLV[w[3] || 1].push(WMAP[w[0]]); });
var ALLW = WORDS.map(function(w){ return WMAP[w[0]]; });
