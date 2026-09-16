/* 全部词库 · CEFR A1 / A2 / B1，共 1135 词（A1 500 / A2 500 / B1 135）
   **A1 + A2 = 1000 个核心词** —— 按 A1-A2 高频核心词表补齐（用户 2026-09 要的「1000 总量」）。
   格式：[英文, 中文, 类别, 难度]   难度：1=A1  2=A2  3=B1

   **一个难度就是一章，章与章之间的词不重复**（用户定的）：
   第一章「石廊」只出难度 1，第二章「锈庭」只出难度 2，难度 3 留给还没做的第三章。
   哪一章用哪个难度写在 content.js 的 `CHAPTERS[].wordLv` 上。
   加词直接往 WORDS 里加，四个字段都要给；类别要在 CAT_CN 里有对应中文名。
   **英文不能重复** —— WMAP 按英文做键，重了会静默覆盖。
   **同一难度里中文释义也不能重复** —— 选择题的干扰项就在同难度里挑，
   两个词共用一个中文会出现「两个选项都对」。加词后跑一遍同级释义查重。
   怪物按类别出题（见 content.js 里每只怪的 cat 字段）。*/
"use strict";

var CAT_CN = {
  animal:"动物", food:"食物", color:"颜色", body:"身体", people:"人",
  thing:"物品", nature:"自然", verb:"动作", adj:"描述",
  time:"时间", place:"地点", feel:"情绪",
  /* 下面三类是补到 1000 核心词时新加的：数字、副词、虚词（代词/介词/连词/冠词/疑问词）。
     没有怪物专吃这三类（FOES 里没配），但 Boss 弱点和平时的随机出题都会抽到。 */
  num:"数字", adv:"副词", func:"虚词"
};

var WORDS = [
/* ═══════ 难度 1　A1 · 第一章「石廊」　共 500 词 ═══════ */
/* 动物 24 */
["cat","猫","animal",1],["dog","狗","animal",1],["bird","鸟","animal",1],["fish","鱼","animal",1],
["horse","马","animal",1],["pig","猪","animal",1],["cow","奶牛","animal",1],["duck","鸭子","animal",1],
["rabbit","兔子","animal",1],["mouse","老鼠","animal",1],["bear","熊","animal",1],["tiger","老虎","animal",1],
["lion","狮子","animal",1],["monkey","猴子","animal",1],["sheep","绵羊","animal",1],["chicken","鸡","animal",1],
["elephant","大象","animal",1],["panda","熊猫","animal",1],["fox","狐狸","animal",1],["hen","母鸡","animal",1],
["spider","蜘蛛","animal",1],["butterfly","蝴蝶","animal",1],["animal","动物","animal",1],["pet","宠物","animal",1],
/* 食物 35 */
["bread","面包","food",1],["milk","牛奶","food",1],["egg","鸡蛋","food",1],["rice","米饭","food",1],
["apple","苹果","food",1],["banana","香蕉","food",1],["water","水","food",1],["meat","肉","food",1],
["cake","蛋糕","food",1],["soup","汤","food",1],["tea","茶","food",1],["juice","果汁","food",1],
["sugar","糖","food",1],["salt","盐","food",1],["noodles","面条","food",1],["coffee","咖啡","food",1],
["fruit","水果","food",1],["vegetable","蔬菜","food",1],["beef","牛肉","food",1],["pork","猪肉","food",1],
["orange","橙子","food",1],["chocolate","巧克力","food",1],["candy","糖果","food",1],["cookie","曲奇","food",1],
["sandwich","三明治","food",1],["pizza","比萨","food",1],["breakfast","早餐","food",1],["lunch","午餐","food",1],
["dinner","晚餐","food",1],["meal","一顿饭","food",1],["food","食物","food",1],["dish","菜肴","food",1],
["menu","菜单","food",1],["oil","油","food",1],["corn","玉米","food",1],
/* 颜色 10 */
["red","红色的","color",1],["blue","蓝色的","color",1],["green","绿色的","color",1],["yellow","黄色的","color",1],
["black","黑色的","color",1],["white","白色的","color",1],["brown","棕色的","color",1],["pink","粉色的","color",1],
["colour","颜色","color",1],["colourful","色彩鲜艳的","color",1],
/* 身体 19 */
["hand","手","body",1],["head","头","body",1],["eye","眼睛","body",1],["ear","耳朵","body",1],
["nose","鼻子","body",1],["mouth","嘴","body",1],["foot","脚","body",1],["hair","头发","body",1],
["arm","手臂","body",1],["leg","腿","body",1],["face","脸","body",1],["body","身体","body",1],
["back","后背","body",1],["neck","脖子","body",1],["heart","心脏","body",1],["toe","脚趾","body",1],
["lip","嘴唇","body",1],["tongue","舌头","body",1],["brain","大脑","body",1],
/* 人 29 */
["mother","妈妈","people",1],["father","爸爸","people",1],["sister","姐妹","people",1],["brother","兄弟","people",1],
["family","家庭","people",1],["friend","朋友","people",1],["baby","婴儿","people",1],["boy","男孩","people",1],
["girl","女孩","people",1],["teacher","老师","people",1],["man","男人","people",1],["woman","女人","people",1],
["child","孩子","people",1],["people","人们","people",1],["person","个人","people",1],["student","学生","people",1],
["doctor","医生","people",1],["nurse","护士","people",1],["police","警察","people",1],["driver","司机","people",1],
["worker","工人","people",1],["son","儿子","people",1],["daughter","女儿","people",1],["grandmother","奶奶","people",1],
["grandfather","爷爷","people",1],["uncle","叔叔","people",1],["aunt","姑姑","people",1],["husband","丈夫","people",1],
["wife","妻子","people",1],
/* 物品 55 */
["book","书","thing",1],["pen","钢笔","thing",1],["chair","椅子","thing",1],["table","桌子","thing",1],
["door","门","thing",1],["window","窗户","thing",1],["bed","床","thing",1],["box","盒子","thing",1],
["key","钥匙","thing",1],["bag","包","thing",1],["clock","钟","thing",1],["cup","杯子","thing",1],
["phone","电话","thing",1],["car","汽车","thing",1],["bike","自行车","thing",1],["ball","球","thing",1],
["shoe","鞋","thing",1],["hat","帽子","thing",1],["coat","外套","thing",1],["map","地图","thing",1],
["bus","公共汽车","thing",1],["train","火车","thing",1],["plane","飞机","thing",1],["boat","小船","thing",1],
["desk","书桌","thing",1],["paper","纸","thing",1],["pencil","铅笔","thing",1],["bottle","瓶子","thing",1],
["plate","盘子","thing",1],["bowl","碗","thing",1],["knife","刀","thing",1],["fork","叉子","thing",1],
["spoon","勺子","thing",1],["glass","玻璃杯","thing",1],["radio","收音机","thing",1],["computer","电脑","thing",1],
["camera","相机","thing",1],["picture","图画","thing",1],["photo","照片","thing",1],["letter","信","thing",1],
["card","卡片","thing",1],["money","钱","thing",1],["watch","手表","thing",1],["ring","戒指","thing",1],
["dress","连衣裙","thing",1],["shirt","衬衫","thing",1],["trousers","裤子","thing",1],["sock","袜子","thing",1],
["skirt","短裙","thing",1],["jacket","夹克","thing",1],["toy","玩具","thing",1],["game","游戏","thing",1],
["music","音乐","thing",1],["film","电影","thing",1],["wall","墙","thing",1],
/* 自然 28 */
["sun","太阳","nature",1],["moon","月亮","nature",1],["star","星星","nature",1],["tree","树","nature",1],
["flower","花","nature",1],["rain","雨","nature",1],["snow","雪","nature",1],["wind","风","nature",1],
["fire","火","nature",1],["stone","石头","nature",1],["river","河","nature",1],["mountain","山","nature",1],
["sky","天空","nature",1],["sea","海","nature",1],["night","夜晚","nature",1],["day","白天","nature",1],
["cloud","云","nature",1],["grass","草","nature",1],["leaf","树叶","nature",1],["lake","湖","nature",1],
["field","田野","nature",1],["hill","小山","nature",1],["earth","地球","nature",1],["world","世界","nature",1],
["air","空气","nature",1],["weather","天气","nature",1],["plant","植物","nature",1],["wood","木头","nature",1],
/* 动作 80 */
["run","跑","verb",1],["walk","走","verb",1],["eat","吃","verb",1],["drink","喝","verb",1],
["sleep","睡觉","verb",1],["read","读","verb",1],["write","写","verb",1],["sing","唱歌","verb",1],
["jump","跳","verb",1],["open","打开","verb",1],["close","关上","verb",1],["look","看","verb",1],
["sit","坐","verb",1],["stand","站","verb",1],["give","给","verb",1],["help","帮助","verb",1],
["come","来","verb",1],["go","去","verb",1],["take","拿","verb",1],["find","找到","verb",1],
["be","是","verb",1],["have","有","verb",1],["do","做","verb",1],["make","制作","verb",1],
["say","说","verb",1],["tell","告诉","verb",1],["ask","问","verb",1],["answer","回答","verb",1],
["know","知道","verb",1],["think","思考","verb",1],["want","想要","verb",1],["like","喜欢","verb",1],
["need","需要","verb",1],["work","工作","verb",1],["play","玩","verb",1],["study","学习","verb",1],
["learn","学会","verb",1],["teach","教","verb",1],["see","看见","verb",1],["hear","听见","verb",1],
["listen","倾听","verb",1],["speak","讲","verb",1],["talk","交谈","verb",1],["call","呼叫","verb",1],
["use","使用","verb",1],["put","放置","verb",1],["get","得到","verb",1],["buy","买","verb",1],
["pay","付钱","verb",1],["sell","卖","verb",1],["cook","做饭","verb",1],["wash","洗","verb",1],
["clean","打扫","verb",1],["wear","穿着","verb",1],["start","开始","verb",1],["stop","停止","verb",1],
["finish","完成","verb",1],["try","尝试","verb",1],["live","居住","verb",1],["stay","停留","verb",1],
["leave","离开","verb",1],["wait","等待","verb",1],["meet","遇见","verb",1],["visit","拜访","verb",1],
["travel","旅行","verb",1],["drive","驾驶","verb",1],["ride","骑","verb",1],["fly","飞","verb",1],
["swim","游泳","verb",1],["dance","跳舞","verb",1],["draw","画画","verb",1],["build","建造","verb",1],
["carry","搬运","verb",1],["bring","带来","verb",1],["send","寄送","verb",1],["show","展示","verb",1],
["move","移动","verb",1],["turn","转动","verb",1],["push","推","verb",1],["pull","拉","verb",1],
/* 描述 53 */
["big","大的","adj",1],["small","小的","adj",1],["hot","热的","adj",1],["cold","冷的","adj",1],
["good","好的","adj",1],["bad","坏的","adj",1],["new","新的","adj",1],["old","旧的","adj",1],
["happy","快乐的","adj",1],["sad","伤心的","adj",1],["fast","快的","adj",1],["slow","慢的","adj",1],
["long","长的","adj",1],["short","短的","adj",1],["strong","强壮的","adj",1],["tired","累的","adj",1],
["young","年轻的","adj",1],["tall","个子高的","adj",1],["high","高的","adj",1],["low","低的","adj",1],
["little","小小的","adj",1],["large","大型的","adj",1],["nice","不错的","adj",1],["fine","挺好的","adj",1],
["great","了不起的","adj",1],["beautiful","美丽的","adj",1],["pretty","漂亮的","adj",1],["dirty","脏的","adj",1],
["wet","湿的","adj",1],["dry","干的","adj",1],["warm","温暖的","adj",1],["cool","凉爽的","adj",1],
["rich","富有的","adj",1],["poor","贫穷的","adj",1],["easy","容易的","adj",1],["hard","难的","adj",1],
["busy","忙碌的","adj",1],["free","自由的","adj",1],["ready","准备好的","adj",1],["hungry","饥饿的","adj",1],
["thirsty","口渴的","adj",1],["ill","生病的","adj",1],["right","正确的","adj",1],["wrong","错误的","adj",1],
["true","真的","adj",1],["same","相同的","adj",1],["different","不同的","adj",1],["lovely","可爱的","adj",1],
["funny","滑稽的","adj",1],["important","重要的","adj",1],["delicious","美味的","adj",1],["sweet","甜的","adj",1],
["soft","柔软的","adj",1],
/* 时间 26 */
["afternoon","下午","time",1],["evening","傍晚","time",1],["month","月份","time",1],["yesterday","昨天","time",1],
["morning","早晨","time",1],["week","星期","time",1],["year","年","time",1],["today","今天","time",1],
["tomorrow","明天","time",1],["time","时间","time",1],["date","日期","time",1],["birthday","生日","time",1],
["holiday","假日","time",1],["weekend","周末","time",1],["noon","中午","time",1],["early","早的","time",1],
["late","晚的","time",1],["age","年龄","time",1],["now","现在","time",1],["Monday","星期一","time",1],
["Tuesday","星期二","time",1],["Wednesday","星期三","time",1],["Thursday","星期四","time",1],["Friday","星期五","time",1],
["Saturday","星期六","time",1],["Sunday","星期日","time",1],
/* 地点 26 */
["park","公园","place",1],["city","城市","place",1],["town","小镇","place",1],["street","街道","place",1],
["garden","花园","place",1],["school","学校","place",1],["shop","商店","place",1],["home","家","place",1],
["room","房间","place",1],["house","房子","place",1],["flat","公寓","place",1],["kitchen","厨房","place",1],
["bedroom","卧室","place",1],["bathroom","浴室","place",1],["office","办公室","place",1],["hotel","旅馆","place",1],
["restaurant","餐馆","place",1],["bank","银行","place",1],["farm","农场","place",1],["zoo","动物园","place",1],
["cinema","电影院","place",1],["country","国家","place",1],["road","公路","place",1],["way","路线","place",1],
["place","地方","place",1],["building","建筑","place",1],
/* 情绪 19 */
["love","爱","feel",1],["fun","有趣的","feel",1],["glad","高兴的","feel",1],["sorry","抱歉的","feel",1],
["worry","担心","feel",1],["calm","平静的","feel",1],["shy","害羞的","feel",1],["miss","想念","feel",1],
["kind","善良的","feel",1],["feeling","感受","feel",1],["wish","愿望","feel",1],["thank","感谢","feel",1],
["welcome","欢迎","feel",1],["enjoy","喜爱","feel",1],["luck","运气","feel",1],["hate","讨厌","feel",1],
["care","关心","feel",1],["dream","梦想","feel",1],["smile","微笑","feel",1],
/* 数字 26 */
["one","一","num",1],["two","二","num",1],["three","三","num",1],["four","四","num",1],
["five","五","num",1],["six","六","num",1],["seven","七","num",1],["eight","八","num",1],
["nine","九","num",1],["ten","十","num",1],["eleven","十一","num",1],["twelve","十二","num",1],
["twenty","二十","num",1],["thirty","三十","num",1],["forty","四十","num",1],["fifty","五十","num",1],
["hundred","一百","num",1],["thousand","一千","num",1],["zero","零","num",1],["first","第一","num",1],
["second","第二","num",1],["number","数目","num",1],["many","许多","num",1],["much","大量","num",1],
["few","少数","num",1],["half","一半","num",1],
/* 副词 30 */
["very","非常","adv",1],["too","太","adv",1],["also","也","adv",1],["only","仅仅","adv",1],
["just","刚刚","adv",1],["again","再次","adv",1],["still","仍然","adv",1],["already","已经","adv",1],
["soon","不久","adv",1],["then","然后","adv",1],["here","这里","adv",1],["there","那里","adv",1],
["always","总是","adv",1],["never","从不","adv",1],["often","经常","adv",1],["sometimes","有时","adv",1],
["usually","通常","adv",1],["together","一起","adv",1],["maybe","也许","adv",1],["really","确实","adv",1],
["well","很好地","adv",1],["quickly","迅速地","adv",1],["slowly","缓慢地","adv",1],["carefully","仔细地","adv",1],
["almost","差不多","adv",1],["enough","足够","adv",1],["more","更多","adv",1],["most","最多","adv",1],
["less","更少","adv",1],["ago","以前","adv",1],
/* 虚词 40 */
["I","我","func",1],["you","你","func",1],["he","他","func",1],["she","她","func",1],
["it","它","func",1],["we","我们","func",1],["they","他们","func",1],["my","我的","func",1],
["your","你的","func",1],["his","他的","func",1],["her","她的","func",1],["this","这个","func",1],
["that","那个","func",1],["who","谁","func",1],["what","什么","func",1],["where","哪里","func",1],
["when","何时","func",1],["why","为什么","func",1],["how","怎样","func",1],["and","和","func",1],
["but","但是","func",1],["or","或者","func",1],["because","因为","func",1],["so","所以","func",1],
["if","如果","func",1],["with","带着","func",1],["for","为了","func",1],["from","从","func",1],
["in","在里面","func",1],["on","在上面","func",1],["at","在某处","func",1],["under","在下面","func",1],
["the","（定冠词）这、那","func",1],["a","（不定冠词）一个","func",1],["some","一些","func",1],["all","全部","func",1],
["can","能够","func",1],["yes","是的","func",1],["no","不是","func",1],["hello","你好","func",1],

/* ═══════ 难度 2　A2 · 第二章「锈庭」　共 500 词 ═══════ */
/* 动物 25 */
["wolf","狼","animal",2],["snake","蛇","animal",2],["bee","蜜蜂","animal",2],["ant","蚂蚁","animal",2],
["goat","山羊","animal",2],["deer","鹿","animal",2],["frog","青蛙","animal",2],["eagle","鹰","animal",2],
["shark","鲨鱼","animal",2],["goose","鹅","animal",2],["owl","猫头鹰","animal",2],["mosquito","蚊子","animal",2],
["whale","鲸","animal",2],["lizard","蜥蜴","animal",2],["worm","虫子","animal",2],["snail","蜗牛","animal",2],
["pigeon","鸽子","animal",2],["donkey","驴","animal",2],["dragon","龙","animal",2],["giraffe","长颈鹿","animal",2],
["camel","骆驼","animal",2],["dolphin","海豚","animal",2],["turtle","乌龟","animal",2],["parrot","鹦鹉","animal",2],
["crab","螃蟹","animal",2],
/* 食物 35 */
["salad","沙拉","food",2],["cheese","奶酪","food",2],["butter","黄油","food",2],["pepper","胡椒","food",2],
["onion","洋葱","food",2],["potato","土豆","food",2],["tomato","西红柿","food",2],["carrot","胡萝卜","food",2],
["lemon","柠檬","food",2],["grape","葡萄","food",2],["honey","蜂蜜","food",2],["sausage","香肠","food",2],
["biscuit","饼干","food",2],["wine","葡萄酒","food",2],["beer","啤酒","food",2],["flour","面粉","food",2],
["cream","奶油","food",2],["jam","果酱","food",2],["pie","馅饼","food",2],["snack","零食","food",2],
["garlic","大蒜","food",2],["cabbage","卷心菜","food",2],["mushroom","蘑菇","food",2],["bean","豆子","food",2],
["peach","桃子","food",2],["cherry","樱桃","food",2],["pineapple","菠萝","food",2],["nut","坚果","food",2],
["sauce","酱汁","food",2],["taste","味道","food",2],["strawberry","草莓","food",2],["hamburger","汉堡","food",2],
["dumpling","饺子","food",2],["melon","甜瓜","food",2],["pear","梨","food",2],
/* 颜色 7 */
["grey","灰色的","color",2],["purple","紫色的","color",2],["golden","金色的","color",2],["silver","银色的","color",2],
["dark","深色的","color",2],["bright","明亮的","color",2],["shiny","闪亮的","color",2],
/* 身体 27 */
["shoulder","肩膀","body",2],["knee","膝盖","body",2],["elbow","手肘","body",2],["finger","手指","body",2],
["throat","喉咙","body",2],["stomach","胃","body",2],["tooth","牙齿","body",2],["skin","皮肤","body",2],
["bone","骨头","body",2],["blood","血","body",2],["wing","翅膀","body",2],["tail","尾巴","body",2],
["chest","胸口","body",2],["wrist","手腕","body",2],["ankle","脚踝","body",2],["nail","指甲","body",2],
["voice","嗓音","body",2],["waist","腰","body",2],["palm","手掌","body",2],["heel","脚跟","body",2],
["fist","拳头","body",2],["sight","视力","body",2],["beard","胡须","body",2],["cheek","脸颊","body",2],
["chin","下巴","body",2],["thumb","拇指","body",2],["eyebrow","眉毛","body",2],
/* 人 33 */
["neighbour","邻居","people",2],["stranger","陌生人","people",2],["guest","客人","people",2],["owner","主人","people",2],
["soldier","士兵","people",2],["farmer","农民","people",2],["artist","艺术家","people",2],["singer","歌手","people",2],
["writer","作家","people",2],["leader","领导者","people",2],["customer","顾客","people",2],["partner","伙伴","people",2],
["lawyer","律师","people",2],["engineer","工程师","people",2],["scientist","科学家","people",2],["classmate","同学","people",2],
["boss","老板","people",2],["actor","演员","people",2],["president","总统","people",2],["king","国王","people",2],
["queen","王后","people",2],["hero","英雄","people",2],["team","团队","people",2],["group","小组","people",2],
["crowd","人群","people",2],["couple","一对夫妻","people",2],["adult","成年人","people",2],["teenager","青少年","people",2],
["member","成员","people",2],["tourist","游客","people",2],["waiter","服务员","people",2],["cousin","表亲","people",2],
["parent","家长","people",2],
/* 物品 55 */
["ticket","票","thing",2],["wallet","钱包","thing",2],["mirror","镜子","thing",2],["candle","蜡烛","thing",2],
["blanket","毯子","thing",2],["pillow","枕头","thing",2],["needle","针","thing",2],["rope","绳子","thing",2],
["ladder","梯子","thing",2],["hammer","锤子","thing",2],["basket","篮子","thing",2],["envelope","信封","thing",2],
["stamp","邮票","thing",2],["engine","发动机","thing",2],["wheel","轮子","thing",2],["screen","屏幕","thing",2],
["button","纽扣","thing",2],["pocket","口袋","thing",2],["belt","腰带","thing",2],["glove","手套","thing",2],
["scarf","围巾","thing",2],["boot","靴子","thing",2],["sweater","毛衣","thing",2],["uniform","制服","thing",2],
["suitcase","手提箱","thing",2],["curtain","窗帘","thing",2],["carpet","地毯","thing",2],["shelf","架子","thing",2],
["drawer","抽屉","thing",2],["cupboard","橱柜","thing",2],["fridge","冰箱","thing",2],["oven","烤箱","thing",2],
["kettle","水壶","thing",2],["pan","平底锅","thing",2],["tray","托盘","thing",2],["battery","电池","thing",2],
["wire","电线","thing",2],["switch","开关","thing",2],["bell","铃铛","thing",2],["message","消息","thing",2],
["email","电子邮件","thing",2],["internet","互联网","thing",2],["website","网站","thing",2],["password","密码","thing",2],
["file","文件","thing",2],["page","书页","thing",2],["note","便条","thing",2],["list","清单","thing",2],
["bill","账单","thing",2],["price","价格","thing",2],["umbrella","雨伞","thing",2],["newspaper","报纸","thing",2],
["towel","毛巾","thing",2],["soap","肥皂","thing",2],["lamp","台灯","thing",2],
/* 自然 28 */
["forest","森林","nature",2],["desert","沙漠","nature",2],["island","岛","nature",2],["valley","山谷","nature",2],
["storm","暴风雨","nature",2],["thunder","雷","nature",2],["fog","雾","nature",2],["ice","冰","nature",2],
["sand","沙子","nature",2],["rock","岩石","nature",2],["branch","树枝","nature",2],["root","根","nature",2],
["shadow","影子","nature",2],["wave","波浪","nature",2],["sunshine","阳光","nature",2],["hole","洞","nature",2],
["mud","泥","nature",2],["smoke","烟","nature",2],["steam","蒸汽","nature",2],["coast","海岸","nature",2],
["pond","池塘","nature",2],["bush","灌木","nature",2],["soil","土壤","nature",2],["gas","气体","nature",2],
["nature","大自然","nature",2],["planet","行星","nature",2],["rainbow","彩虹","nature",2],["seed","种子","nature",2],
/* 动作 65 */
["borrow","借入","verb",2],["lend","借出","verb",2],["climb","攀爬","verb",2],["throw","扔","verb",2],
["catch","接住","verb",2],["choose","选择","verb",2],["decide","决定","verb",2],["explain","解释","verb",2],
["repeat","重复","verb",2],["describe","描述","verb",2],["compare","比较","verb",2],["collect","收集","verb",2],
["repair","修理","verb",2],["destroy","摧毁","verb",2],["protect","保护","verb",2],["follow","跟随","verb",2],
["hide","躲藏","verb",2],["search","搜寻","verb",2],["arrive","到达","verb",2],["return","返回","verb",2],
["prepare","准备","verb",2],["practise","练习","verb",2],["invite","邀请","verb",2],["promise","承诺","verb",2],
["become","成为","verb",2],["change","改变","verb",2],["happen","发生","verb",2],["grow","生长","verb",2],
["keep","保持","verb",2],["hold","握住","verb",2],["seem","似乎","verb",2],["feel","感觉","verb",2],
["mean","意味着","verb",2],["believe","相信","verb",2],["understand","明白","verb",2],["remember","记得","verb",2],
["forget","忘记","verb",2],["agree","同意","verb",2],["continue","继续","verb",2],["offer","提供","verb",2],
["lead","带领","verb",2],["point","指向","verb",2],["touch","触摸","verb",2],["hit","击中","verb",2],
["break","打破","verb",2],["cut","切","verb",2],["win","赢得","verb",2],["lose","丢失","verb",2],
["join","加入","verb",2],["save","节省","verb",2],["spend","花费","verb",2],["allow","允许","verb",2],
["accept","接受","verb",2],["expect","期待","verb",2],["plan","计划","verb",2],["check","检查","verb",2],
["guess","猜测","verb",2],["imagine","想象","verb",2],["share","分享","verb",2],["count","数数","verb",2],
["fill","装满","verb",2],["drop","掉落","verb",2],["lift","举起","verb",2],["pass","经过","verb",2],
["reach","够到","verb",2],
/* 描述 52 */
["heavy","重的","adj",2],["light","轻的","adj",2],["empty","空的","adj",2],["full","满的","adj",2],
["deep","深的","adj",2],["narrow","窄的","adj",2],["wide","宽的","adj",2],["sharp","锋利的","adj",2],
["smooth","光滑的","adj",2],["rough","粗糙的","adj",2],["quiet","安静的","adj",2],["loud","响亮的","adj",2],
["strange","奇怪的","adj",2],["famous","著名的","adj",2],["modern","现代的","adj",2],["ancient","古老的","adj",2],
["safe","安全的","adj",2],["dangerous","危险的","adj",2],["simple","简单的","adj",2],["difficult","困难的","adj",2],
["interesting","有意思的","adj",2],["real","真实的","adj",2],["sure","确信的","adj",2],["clear","清楚的","adj",2],
["near","近的","adj",2],["far","远的","adj",2],["whole","整个的","adj",2],["own","自己的","adj",2],
["main","主要的","adj",2],["special","特别的","adj",2],["normal","正常的","adj",2],["common","常见的","adj",2],
["popular","受欢迎的","adj",2],["perfect","完美的","adj",2],["terrible","糟糕的","adj",2],["wonderful","极好的","adj",2],
["boring","令人厌烦的","adj",2],["serious","严肃的","adj",2],["polite","有礼貌的","adj",2],["rude","粗鲁的","adj",2],
["friendly","友好的","adj",2],["honest","诚实的","adj",2],["clever","聪明的","adj",2],["stupid","愚蠢的","adj",2],
["lazy","懒惰的","adj",2],["healthy","健康的","adj",2],["fresh","新鲜的","adj",2],["comfortable","舒适的","adj",2],
["expensive","昂贵的","adj",2],["cheap","便宜的","adj",2],["sour","酸的","adj",2],["ugly","丑陋的","adj",2],
/* 时间 33 */
["hour","小时","time",2],["minute","分钟","time",2],["season","季节","time",2],["spring","春天","time",2],
["summer","夏天","time",2],["autumn","秋天","time",2],["winter","冬天","time",2],["future","未来","time",2],
["past","过去","time",2],["moment","时刻","time",2],["January","一月","time",2],["February","二月","time",2],
["March","三月","time",2],["April","四月","time",2],["May","五月","time",2],["June","六月","time",2],
["July","七月","time",2],["August","八月","time",2],["September","九月","time",2],["October","十月","time",2],
["November","十一月","time",2],["December","十二月","time",2],["daily","每天的","time",2],["history","历史","time",2],
["sunrise","日出","time",2],["sunset","日落","time",2],["weekday","工作日","time",2],["quarter","一刻钟","time",2],
["schedule","日程","time",2],["timetable","时间表","time",2],["calendar","日历","time",2],["tonight","今晚","time",2],
["midnight","午夜","time",2],
/* 地点 32 */
["station","车站","place",2],["airport","机场","place",2],["hospital","医院","place",2],["market","市场","place",2],
["library","图书馆","place",2],["factory","工厂","place",2],["village","村庄","place",2],["bridge","桥","place",2],
["corner","角落","place",2],["gate","大门","place",2],["tower","塔","place",2],["cave","洞穴","place",2],
["cafe","咖啡馆","place",2],["university","大学","place",2],["college","学院","place",2],["theatre","剧院","place",2],
["harbour","港口","place",2],["square","广场","place",2],["centre","中心","place",2],["area","区域","place",2],
["yard","院子","place",2],["garage","车库","place",2],["pool","游泳池","place",2],["gym","健身房","place",2],
["supermarket","超市","place",2],["capital","首都","place",2],["entrance","入口","place",2],["exit","出口","place",2],
["classroom","教室","place",2],["museum","博物馆","place",2],["church","教堂","place",2],["beach","海滩","place",2],
/* 情绪 25 */
["angry","生气的","feel",2],["afraid","害怕的","feel",2],["bored","无聊的","feel",2],["excited","兴奋的","feel",2],
["nervous","紧张的","feel",2],["proud","自豪的","feel",2],["lonely","孤独的","feel",2],["surprised","惊讶的","feel",2],
["worried","担心的","feel",2],["pleased","高兴的","feel",2],["upset","心烦的","feel",2],["jealous","嫉妒的","feel",2],
["confused","困惑的","feel",2],["relaxed","放松的","feel",2],["confident","自信的","feel",2],["cheerful","愉快的","feel",2],
["grateful","感激的","feel",2],["emotion","情感","feel",2],["mood","心情","feel",2],["tear","眼泪","feel",2],
["pain","疼痛","feel",2],["comfort","安慰","feel",2],["pity","遗憾","feel",2],["joy","欢乐","feel",2],
["interest","兴趣","feel",2],
/* 数字 20 */
["thirteen","十三","num",2],["fourteen","十四","num",2],["fifteen","十五","num",2],["sixteen","十六","num",2],
["seventeen","十七","num",2],["eighteen","十八","num",2],["nineteen","十九","num",2],["sixty","六十","num",2],
["seventy","七十","num",2],["eighty","八十","num",2],["ninety","九十","num",2],["million","一百万","num",2],
["twice","两次","num",2],["double","双倍的","num",2],["single","单个的","num",2],["pair","一双","num",2],
["dozen","一打","num",2],["several","好几个","num",2],["total","总数","num",2],["percent","百分比","num",2],
/* 副词 28 */
["away","离开地","adv",2],["down","向下","adv",2],["up","向上","adv",2],["out","向外","adv",2],
["off","离开","adv",2],["around","四周","adv",2],["along","沿着","adv",2],["across","横过","adv",2],
["through","穿过","adv",2],["inside","在里面","adv",2],["outside","在外面","adv",2],["upstairs","楼上","adv",2],
["everywhere","到处","adv",2],["anywhere","任何地方","adv",2],["somewhere","某个地方","adv",2],["probably","很可能","adv",2],
["certainly","当然","adv",2],["actually","实际上","adv",2],["finally","最终","adv",2],["suddenly","突然","adv",2],
["easily","轻松地","adv",2],["hardly","几乎不","adv",2],["nearly","将近","adv",2],["instead","作为替代","adv",2],
["however","然而","adv",2],["else","别的","adv",2],["even","甚至","adv",2],["ever","曾经","adv",2],
/* 虚词 35 */
["our","我们的","func",2],["their","他们的","func",2],["its","它的","func",2],["these","这些","func",2],
["those","那些","func",2],["which","哪一个","func",2],["whose","谁的","func",2],["to","到","func",2],
["of","（所属）…的","func",2],["over","在…上方","func",2],["between","在…之间","func",2],["behind","在…后面","func",2],
["before","在…之前","func",2],["after","在…之后","func",2],["about","关于","func",2],["without","没有","func",2],
["against","反对","func",2],["during","在…期间","func",2],["until","直到","func",2],["since","自从","func",2],
["while","当…的时候","func",2],["although","尽管","func",2],["than","比","func",2],["both","两者都","func",2],
["any","任何","func",2],["every","每个","func",2],["each","各自","func",2],["will","将要","func",2],
["must","必须","func",2],["should","应该","func",2],["could","可以","func",2],["would","会","func",2],
["not","不","func",2],["something","某事","func",2],["everyone","每个人","func",2],

/* ═══════ 难度 3　B1 · 留给还没做的第三章　共 135 词 ═══════ */
/* 动物 8 */
["creature","生物","animal",3],["insect","昆虫","animal",3],["beast","野兽","animal",3],["prey","猎物","animal",3],
["nest","巢","animal",3],["herd","兽群","animal",3],["feather","羽毛","animal",3],["claw","爪子","animal",3],
/* 食物 8 */
["recipe","食谱","food",3],["flavour","味道","food",3],["ingredient","配料","food",3],["portion","一份","food",3],
["diet","饮食","food",3],["harvest","收成","food",3],["supply","供给","food",3],["spice","香料","food",3],
/* 颜色 4 */
["pale","苍白的","color",3],["shade","色调","color",3],["faded","褪色的","color",3],["glowing","发光的","color",3],
/* 身体 8 */
["muscle","肌肉","body",3],["nerve","神经","body",3],["breath","呼吸","body",3],["wound","伤口","body",3],
["scar","疤痕","body",3],["pulse","脉搏","body",3],["spine","脊柱","body",3],["flesh","血肉","body",3],
/* 人 10 */
["witness","目击者","people",3],["expert","专家","people",3],["manager","经理","people",3],["citizen","公民","people",3],
["rival","对手","people",3],["ancestor","祖先","people",3],["servant","仆人","people",3],["thief","小偷","people",3],
["guard","守卫","people",3],["priest","祭司","people",3],
/* 物品 14 */
["device","装置","thing",3],["weapon","武器","thing",3],["shield","盾牌","thing",3],["chain","锁链","thing",3],
["lock","锁","thing",3],["trap","陷阱","thing",3],["torch","火把","thing",3],["banner","旗帜","thing",3],
["coin","硬币","thing",3],["treasure","宝藏","thing",3],["fragment","碎片","thing",3],["tool","工具","thing",3],
["container","容器","thing",3],["material","材料","thing",3],
/* 自然 11 */
["cliff","悬崖","nature",3],["stream","溪流","nature",3],["swamp","沼泽","nature",3],["dust","尘土","nature",3],
["flame","火焰","nature",3],["ash","灰烬","nature",3],["crystal","水晶","nature",3],["surface","表面","nature",3],
["depth","深处","nature",3],["silence","寂静","nature",3],["echo","回声","nature",3],
/* 动作 24 */
["discover","发现","verb",3],["survive","幸存","verb",3],["escape","逃脱","verb",3],["defend","防御","verb",3],
["attack","攻击","verb",3],["struggle","挣扎","verb",3],["achieve","达成","verb",3],["require","需要","verb",3],
["contain","包含","verb",3],["reveal","揭示","verb",3],["avoid","避开","verb",3],["approach","接近","verb",3],
["vanish","消失","verb",3],["gather","聚集","verb",3],["whisper","低语","verb",3],["crawl","爬行","verb",3],
["swallow","吞下","verb",3],["bury","埋葬","verb",3],["carve","雕刻","verb",3],["forge","锻造","verb",3],
["betray","背叛","verb",3],["endure","忍受","verb",3],["summon","召唤","verb",3],["awaken","唤醒","verb",3],
/* 描述 19 */
["hollow","空心的","adj",3],["fragile","脆弱的","adj",3],["solid","坚固的","adj",3],["bitter","苦的","adj",3],
["cruel","残酷的","adj",3],["gentle","温和的","adj",3],["silent","无声的","adj",3],["endless","无尽的","adj",3],
["hidden","隐藏的","adj",3],["sacred","神圣的","adj",3],["cursed","被诅咒的","adj",3],["brave","勇敢的","adj",3],
["greedy","贪婪的","adj",3],["patient","有耐心的","adj",3],["curious","好奇的","adj",3],["obvious","明显的","adj",3],
["certain","确定的","adj",3],["possible","可能的","adj",3],["familiar","熟悉的","adj",3],
/* 时间 7 */
["century","世纪","time",3],["decade","十年","time",3],["delay","延迟","time",3],["period","时期","time",3],
["recent","最近的","time",3],["sudden","突然的","time",3],["eternal","永恒的","time",3],
/* 地点 10 */
["palace","宫殿","place",3],["temple","神庙","place",3],["prison","监狱","place",3],["tunnel","隧道","place",3],
["chamber","密室","place",3],["ruin","废墟","place",3],["border","边界","place",3],["shelter","庇护所","place",3],
["region","地区","place",3],["path","小径","place",3],
/* 情绪 12 */
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
