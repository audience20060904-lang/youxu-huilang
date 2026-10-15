/* 幽墟回廊 · SVG 美术
   ------------------------------------------------------------------
   配色规矩（改图前先读这段）：
   · 主体一律 fill="currentColor"，颜色交给 CSS ——
     地图上的人是 --hero，泉是 --frost，商是 --torch；
     战斗立绘里是 #57503F（深灰褐），BOSS 是 #8A3223。
   · **明暗不要写死灰色**，一律用黑白半透明叠在 currentColor 上：
     暗部 fill="#000" opacity≈.15，亮部 fill="#fff" opacity≈.2。
     这样同一张图换成红色（BOSS）、蓝色（主角）都还成立。
   · 眼白用 #FBF6E7（贴近立绘底色 #FFFCF4→#E9E0CD 的亮端），
     深孔/瞳仁用 #2A2620，发光的眼用 #E0A83A（金）或 #D8412F（血）。
   · **不要用 clipPath / mask**：立绘和地图格子可能同时出现，
     重名 id 会互相串。明暗块一律手工收在轮廓内部。
   ------------------------------------------------------------------
   尺寸：地图上的东西是 20×20（格子只有二三十像素，剪影要在那个尺寸下认得出来），
   战斗立绘是 100×100（显示 58~96px，细节可以多一点）。*/
"use strict";

/* ===== 地图上的主角 =====
   披斗篷的冒险者：兜帽里是一团阴影（不画五官，二十几像素画不出来），
   背后斜插一把剑。左亮右暗，让这团蓝色不至于是一块死色。*/
var HERO =
'<svg viewBox="0 0 20 20" aria-hidden="true">' +
 '<ellipse cx="10" cy="18.4" rx="4.9" ry="1.05" fill="#1E2A33" opacity=".16"/>' +      /* 地影 */
 '<path d="M17.2 2.2 18.4 3.4 13.2 8.6 12 7.4z" fill="#DFB645"/>' +                    /* 剑刃 */
 '<path d="M17.2 2.2 18.4 3.4 13.2 8.6z" fill="#FFF3CB" opacity=".55"/>' +             /* 刃上的高光 */
 '<path d="M11.4 6.8 13.6 9" stroke="#8A6A16" stroke-width="1.6" stroke-linecap="round"/>' + /* 护手 */
 '<path d="M12.2 7.6 11 8.8" stroke="#6E5312" stroke-width="1.8" stroke-linecap="round"/>' + /* 握把 */
 '<path d="M10 8.2c3.1 0 4.9 3.3 5.2 9.7H4.8C5.1 11.5 6.9 8.2 10 8.2z" fill="currentColor"/>' + /* 斗篷 */
 '<path d="M10 8.2c3.1 0 4.9 3.3 5.2 9.7h-2.6C12.9 11.8 11.9 9.3 10 8.2z" fill="#000" opacity=".18"/>' +
 '<path d="M10 8.2c-3.1 0-4.9 3.3-5.2 9.7h1.8C6.9 11.8 8.1 9.3 10 8.2z" fill="#fff" opacity=".15"/>' +
 '<path d="M7 12.7h6" stroke="#0E2233" stroke-width="1.1" opacity=".22"/>' +           /* 腰带 */
 '<path d="M7.7 9.1h4.6l.6 1.6c-1.8-.7-4-.7-5.8 0z" fill="#fff" opacity=".18"/>' +     /* 领口 */
 '<path d="M10 1.6c1.9 0 3.4 1.5 3.4 3.5 0 1.4-.7 2.5-1.8 3.1l.4 1.2H8l.4-1.2A3.5 3.5 0 0 1 6.6 5.1C6.6 3.1 8.1 1.6 10 1.6z" fill="currentColor"/>' + /* 兜帽 */
 '<path d="M10 1.6c1.9 0 3.4 1.5 3.4 3.5 0 1.4-.7 2.5-1.8 3.1l.4 1.2h-2z" fill="#000" opacity=".16"/>' +
 '<path d="M7.9 4.8h4.2c.1 2-.9 3.5-2.1 3.5S7.8 6.8 7.9 4.8z" fill="#0C1B27" opacity=".34"/>' + /* 兜帽下的脸 */
 '<circle cx="10" cy="6.2" r=".55" fill="#CFE6F5" opacity=".8"/>' +                    /* 阴影里的一点反光 */
'</svg>';

/* ===== 地图上的泉 =====
   俯视：一圈砌石 + 一潭水 + 往上冒的气泡。
   石圈画两遍（下面一枚偏下、偏暗，上面一枚偏上、偏亮），错开半个像素就有厚度了。
   水是 currentColor（--frost），石头用固定色 —— 石头不该跟着水变色。*/
var SPRING =
'<svg viewBox="0 0 20 20" aria-hidden="true">' +
 '<ellipse cx="10" cy="16.6" rx="7" ry="1.5" fill="#6B5836" opacity=".16"/>' +         /* 地影 */
 '<ellipse cx="10" cy="12.8" rx="7.6" ry="4.8" fill="#AFA083"/>' +                     /* 石圈·暗（下层）*/
 '<ellipse cx="10" cy="11.9" rx="7.6" ry="4.8" fill="#D2C6AB"/>' +                     /* 石圈·亮（上层）*/
 '<g stroke="#9C8E72" stroke-width=".8" opacity=".5" stroke-linecap="round">' +        /* 石缝 */
  '<path d="M10 7.1v1.6"/><path d="M2.4 11.9h2.1"/><path d="M15.5 11.9h2.1"/>' +
  '<path d="M4.8 9.1 6.2 10"/><path d="M15.2 9.1 13.8 10"/></g>' +
 '<ellipse cx="10" cy="11.9" rx="5.5" ry="3.2" fill="currentColor"/>' +                /* 水面 */
 '<path d="M4.5 11.9a5.5 3.2 0 0 0 11 0z" fill="#000" opacity=".16"/>' +               /* 水的深处 */
 '<path d="M6.5 10.9q1.7-.9 3.4 0" stroke="#EAF7F9" stroke-width=".8" fill="none" opacity=".75" stroke-linecap="round"/>' +
 '<path d="M10.5 12.9q1.4-.8 2.7 0" stroke="#EAF7F9" stroke-width=".7" fill="none" opacity=".55" stroke-linecap="round"/>' +
 '<circle cx="8.9" cy="7.4" r="1.5" fill="currentColor" opacity=".55"/>' +             /* 气泡 */
 '<circle cx="11.7" cy="4.9" r="1" fill="currentColor" opacity=".4"/>' +
 '<circle cx="9.4" cy="3.1" r=".7" fill="currentColor" opacity=".26"/>' +
'</svg>';

/* ===== 地图上的商 =====
   一个支棱起来的摊子：条纹雨棚 + 扇贝棚沿 + 柜台，台上摆着一袋货和一枚币。
   剪影（宽梯形压着一道横条）在二十像素下也认得出来，不会跟金币堆搞混。*/
var SHOP =
'<svg viewBox="0 0 20 20" aria-hidden="true">' +
 '<ellipse cx="10" cy="17.4" rx="6.8" ry="1.3" fill="#6B5836" opacity=".16"/>' +       /* 地影 */
 '<path d="M4 9.4v7.6M16 9.4v7.6" stroke="#8A6E3E" stroke-width="1.2" stroke-linecap="round"/>' + /* 支柱 */
 '<path d="M5.4 12.2c-.1-1.4.6-2.2 1.5-2.2s1.6.8 1.5 2.2z" fill="#8A6E3E"/>' +         /* 货袋 */
 '<circle cx="12.6" cy="11.2" r="1.1" fill="#E3B23C" stroke="#8C6412" stroke-width=".5"/>' + /* 台上一枚币 */
 '<rect x="3" y="12.2" width="14" height="4.6" rx=".8" fill="currentColor"/>' +        /* 柜台 */
 '<rect x="3" y="14.7" width="14" height="2.1" fill="#000" opacity=".18"/>' +
 '<rect x="3" y="12.2" width="14" height="1.1" rx=".55" fill="#fff" opacity=".24"/>' +
 '<path d="M2 9.4 4.6 5.2h10.8L18 9.4z" fill="currentColor"/>' +                       /* 雨棚 */
 '<path d="M7.2 5.2 5.5 9.4h2.2L8.9 5.2z" fill="#fff" opacity=".26"/>' +
 '<path d="M11.1 5.2 12.3 9.4h2.2L12.8 5.2z" fill="#fff" opacity=".26"/>' +
 '<path d="M2 9.4a1.6 1.6 0 0 1 3.2 0 1.6 1.6 0 0 1 3.2 0 1.6 1.6 0 0 1 3.2 0 1.6 1.6 0 0 1 3.2 0 1.6 1.6 0 0 1 3.2 0z" fill="currentColor"/>' + /* 扇贝棚沿 */
'</svg>';

/* ===== 地图上的箱 =====
   圆盖木箱 + 一道铁箍 + 一把金锁。箱子里是拼写题，锁画得显眼一点。*/
var CHEST =
'<svg viewBox="0 0 20 20" aria-hidden="true">' +
 '<ellipse cx="10" cy="17.4" rx="6.6" ry="1.2" fill="#6B5836" opacity=".16"/>' +
 '<path d="M3.2 9.8c0-2.7 3-4.5 6.8-4.5s6.8 1.8 6.8 4.5z" fill="currentColor"/>' +   /* 箱盖 */
 '<path d="M3.2 9.8c0-2.7 3-4.5 6.8-4.5v4.5z" fill="#fff" opacity=".2"/>' +
 '<rect x="3.2" y="9.6" width="13.6" height="7.2" rx=".8" fill="currentColor"/>' +   /* 箱体 */
 '<rect x="3.2" y="9.6" width="13.6" height="1" fill="#fff" opacity=".22"/>' +
 '<rect x="3.2" y="14.8" width="13.6" height="2" fill="#000" opacity=".16"/>' +
 '<rect x="8.9" y="5.3" width="2.2" height="11.5" fill="#000" opacity=".22"/>' +     /* 铁箍 */
 '<rect x="8.3" y="10.2" width="3.4" height="3.2" rx=".6" fill="#E3B23C" stroke="#8C6412" stroke-width=".5"/>' +
 '<circle cx="10" cy="11.6" r=".6" fill="#8C6412"/>' +                               /* 锁孔 */
'</svg>';

/* ===== 地图上的坛 =====
   石台上悬着一颗宝石。石头是固定色，**宝石走 currentColor**（CSS 给的是遗物紫）——
   一眼看出这是能换东西的地方，不是又一个箱子。*/
var ALTAR =
'<svg viewBox="0 0 20 20" aria-hidden="true">' +
 '<ellipse cx="10" cy="17.6" rx="6.4" ry="1.2" fill="#6B5836" opacity=".16"/>' +
 '<path d="M4.4 17.4 5.8 12.8h8.4l1.4 4.6z" fill="#B3A488"/>' +                      /* 台座 */
 '<path d="M4.4 17.4 5.8 12.8h2.4l-1.6 4.6z" fill="#fff" opacity=".22"/>' +
 '<rect x="4.4" y="11.2" width="11.2" height="2" rx=".5" fill="#C9BCA0"/>' +         /* 台面 */
 '<rect x="4.4" y="11.2" width="11.2" height=".8" rx=".4" fill="#E4DAC3"/>' +
 '<path d="M10 3.1 12.7 6.9 10 10.7 7.3 6.9z" fill="currentColor"/>' +               /* 悬着的宝石 */
 '<path d="M10 3.1 12.7 6.9H10z" fill="#fff" opacity=".35"/>' +
 '<circle cx="6.4" cy="8.6" r=".7" fill="currentColor" opacity=".5"/>' +             /* 飘着的微光 */
 '<circle cx="13.7" cy="5.6" r=".55" fill="currentColor" opacity=".4"/>' +
'</svg>';

/* ===== 地图上的阶梯 =====
   就是原来那个倒三角（用户 2026-09 要回退）。画成 SVG 而不是 ▼ 字符，
   只为跟地图上别的东西走同一条路（`art` 收口、尺寸不看字体），**看到的还是那个倒三角**。
   中间试过画成四级往下退的台阶，用户不要，别再改回去。*/
var STAIR =
'<svg viewBox="0 0 20 20" aria-hidden="true">' +
 '<path d="M4.4 5.8h11.2L10 15.6z" fill="currentColor"/>' +
'</svg>';

/* ===== 地图上的怪 =====
   跟立绘不是一回事：格子只有二三十像素，**这里只有轮廓**——
   没有地影、没有明暗、没有装饰，一个主形加一对眼睛，别再往里加细节，加了只会糊成一团。
   区分靠的是外形差异（弓背 / 水滴 / 八条腿 / 方塔 / 吊钟 / 菱形…），不是靠内部花纹。
   键是 `def.id`，跟 content.js 的 FOES / BOSS / GATEKEEPER 对齐；
   找不到的 id 会自动退回原来那个汉字，所以加新怪不画图也不会开天窗。*/
var MOB_ART = {

/* 灰鼠：弓背、尖鼻朝左、圆耳、卷尾 */
rat:'<svg viewBox="0 0 20 20" aria-hidden="true">' +
 '<path d="M15.4 13.4c2.4.4 3.4 1.6 2.9 2.9" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>' +
 '<circle cx="6.6" cy="5.6" r="2.5" fill="currentColor"/>' +
 '<path d="M2.4 12.4c.3-1.9 1.7-3.4 3.8-4.2C7.6 5.3 10.3 3.7 13 4.3c3.2.7 5.3 3.3 5.3 6.3 0 3.2-2.9 5.6-6.9 5.6-4.7 0-8.1-1.8-8.9-3.2-.2-.3-.2-.5-.1-.6z" fill="currentColor"/>' +
 '<circle cx="6.3" cy="10.2" r=".95" fill="#fff" opacity=".9"/>' +
'</svg>',

/* 泥怪：水滴坐在地上摊开 */
slime:'<svg viewBox="0 0 20 20" aria-hidden="true">' +
 '<path d="M4.6 16.4c-.7-3.5-.4-6.4.8-8.5C6.4 6.2 8 5.1 10 5.1s3.6 1.1 4.6 2.8c1.2 2.1 1.5 5 .8 8.5z" fill="currentColor"/>' +
 '<ellipse cx="10" cy="16.4" rx="7.2" ry="1.5" fill="currentColor"/>' +
 '<circle cx="8" cy="10.8" r="1.15" fill="#fff" opacity=".92"/>' +
 '<circle cx="12" cy="10.8" r="1.15" fill="#fff" opacity=".92"/>' +
'</svg>',

/* 长足蛛：六条腿就够撑出剪影了，八条在这个尺寸下会连成一片 */
spider:'<svg viewBox="0 0 20 20" aria-hidden="true">' +
 '<g stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none">' +
  '<path d="M6.8 10.4 2.9 7.4"/><path d="M6.6 12.8 2.3 13.4"/><path d="M7.6 14.8 5.2 17.6"/>' +
  '<path d="M13.2 10.4 17.1 7.4"/><path d="M13.4 12.8 17.7 13.4"/><path d="M12.4 14.8 14.8 17.6"/></g>' +
 '<ellipse cx="10" cy="12.6" rx="4.4" ry="4.1" fill="currentColor"/>' +
 '<circle cx="10" cy="7.4" r="2.7" fill="currentColor"/>' +
 '<circle cx="8.9" cy="6.9" r=".62" fill="#fff" opacity=".92"/>' +
 '<circle cx="11.1" cy="6.9" r=".62" fill="#fff" opacity=".92"/>' +
'</svg>',

/* 残骨兵：颅骨 + 分开的下颌 */
bone:'<svg viewBox="0 0 20 20" aria-hidden="true">' +
 '<path d="M10 2.6c-3.5 0-5.8 2.5-5.8 5.6 0 1.9.9 3.4 2.1 4.4v1.3h7.4v-1.3c1.2-1 2.1-2.5 2.1-4.4 0-3.1-2.3-5.6-5.8-5.6z" fill="currentColor"/>' +
 '<path d="M6.3 14.6h7.4v1.7c0 1-.8 1.8-1.8 1.8H8.1c-1 0-1.8-.8-1.8-1.8z" fill="currentColor"/>' +
 '<circle cx="7.6" cy="8.2" r="1.75" fill="#fff" opacity=".92"/>' +
 '<circle cx="12.4" cy="8.2" r="1.75" fill="#fff" opacity=".92"/>' +
 '<path d="M10 10.5 8.9 12.5h2.2z" fill="#fff" opacity=".85"/>' +
'</svg>',

/* 守门石像：方头、宽身、一块底座 */
statue:'<svg viewBox="0 0 20 20" aria-hidden="true">' +
 '<rect x="7.5" y="2.4" width="5" height="4.6" rx=".8" fill="currentColor"/>' +
 '<path d="M6.2 7.4h7.6l1.3 8.2H4.9z" fill="currentColor"/>' +
 '<rect x="3.4" y="15.6" width="13.2" height="2.4" rx=".5" fill="currentColor"/>' +
 '<rect x="8.1" y="4.1" width="1.5" height="1.1" rx=".5" fill="#fff" opacity=".92"/>' +
 '<rect x="10.4" y="4.1" width="1.5" height="1.1" rx=".5" fill="#fff" opacity=".92"/>' +
'</svg>',

/* 低语幽魂：圆顶 + 撕开的下摆 + 张成 O 的嘴 */
ghost:'<svg viewBox="0 0 20 20" aria-hidden="true">' +
 '<path d="M4.4 17.4V9.2a5.6 5.6 0 0 1 11.2 0v8.2l-1.9-1.7-1.9 1.7-1.8-1.7-1.8 1.7-1.9-1.7z" fill="currentColor"/>' +
 '<circle cx="7.9" cy="9.2" r="1.25" fill="#fff" opacity=".92"/>' +
 '<circle cx="12.1" cy="9.2" r="1.25" fill="#fff" opacity=".92"/>' +
 '<ellipse cx="10" cy="12.9" rx="1" ry="1.5" fill="#fff" opacity=".8"/>' +
'</svg>',

/* 锈钟怪：吊钟，底下坠着钟舌 */
clock:'<svg viewBox="0 0 20 20" aria-hidden="true">' +
 '<circle cx="10" cy="2.9" r="1.5" fill="none" stroke="currentColor" stroke-width="1.1"/>' +
 '<path d="M5.1 14.8c0-4.7 1.5-8.6 4.9-8.6s4.9 3.9 4.9 8.6z" fill="currentColor"/>' +
 '<rect x="3.7" y="14.6" width="12.6" height="1.8" rx=".7" fill="currentColor"/>' +
 '<circle cx="10" cy="17.9" r="1.2" fill="currentColor"/>' +
 '<circle cx="8.3" cy="11.2" r="1.05" fill="#fff" opacity=".92"/>' +
 '<circle cx="11.7" cy="11.2" r="1.05" fill="#fff" opacity=".92"/>' +
'</svg>',

/* 回廊游影：**尖顶**、更瘦、下摆撕得更碎，眼睛是两道斜缝。
   ⚠️ 别画成圆顶 —— 圆顶配圆眼就是幽魂，两个在 20px 的格子里根本分不出来。*/
warden2:'<svg viewBox="0 0 20 20" aria-hidden="true">' +
 '<path d="M10 2.2c2.7 1.7 4.3 4.6 4.5 8.1.2 2.7 0 5-.6 7.1l-1.4-2.1-1.3 2.1-1.2-2.1-1.2 2.1-1.4-2.1c-.6-2.1-.8-4.4-.6-7.1C5.7 6.8 7.3 3.9 10 2.2z" fill="currentColor"/>' +
 '<path d="M7.9 10 9.5 10.9M12.1 10 10.5 10.9" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".92"/>' +
'</svg>',

/* 吞惧者：一张咬开的大嘴 */
dread:'<svg viewBox="0 0 20 20" aria-hidden="true">' +
 '<circle cx="10" cy="10.4" r="7.2" fill="currentColor"/>' +
 '<path d="M4.2 9.6h11.6c0 3.3-2.6 5.8-5.8 5.8s-5.8-2.5-5.8-5.8z" fill="#fff" opacity=".9"/>' +
 '<path d="M5.6 9.6 6.9 11.8 8.2 9.6zM9 9.6l1.3 2.4 1.3-2.4zM12.4 9.6l1.3 2.2 1.3-2.2z" fill="currentColor"/>' +
 '<circle cx="7.4" cy="6.2" r=".95" fill="#fff" opacity=".92"/>' +
 '<circle cx="12.6" cy="6.2" r=".95" fill="#fff" opacity=".92"/>' +
'</svg>',

/* 碎色棱：一块菱形晶体，中间裂着一道 */
prism:'<svg viewBox="0 0 20 20" aria-hidden="true">' +
 '<path d="M10 1.8 16.6 10 10 18.2 3.4 10z" fill="currentColor"/>' +
 '<path d="M10 5.9 12.3 10 10 14.1 7.7 10z" fill="#fff" opacity=".9"/>' +
 '<path d="M10 1.8v4.1M10 14.1v4.1" stroke="#fff" stroke-width=".9" opacity=".45"/>' +
'</svg>',

/* 石廊守卫（章末 Boss）：带角的头盔 + 肩 */
warden:'<svg viewBox="0 0 20 20" aria-hidden="true">' +
 '<path d="M2.4 3.2c2.7.7 5 2.8 6.2 5.4l-1.2 1C6.2 6.9 4.4 5 2.4 3.2z" fill="currentColor"/>' +
 '<path d="M17.6 3.2c-2.7.7-5 2.8-6.2 5.4l1.2 1c1.2-2.7 3-4.6 5-6.4z" fill="currentColor"/>' +
 '<path d="M10 4.1c-3.1 0-5.2 2.3-5.2 5.2 0 2 .9 3.6 2.3 4.6v1.5h5.8v-1.5c1.4-1 2.3-2.6 2.3-4.6 0-2.9-2.1-5.2-5.2-5.2z" fill="currentColor"/>' +
 '<path d="M5.8 15.4h8.4l1 2.6H4.8z" fill="currentColor"/>' +
 '<circle cx="8.2" cy="9.3" r="1.15" fill="#fff" opacity=".92"/>' +
 '<circle cx="11.8" cy="9.3" r="1.15" fill="#fff" opacity=".92"/>' +
'</svg>',

/* 层间守者：一道堵在路上的拱门，门缝里盯着一只眼 */
gate:'<svg viewBox="0 0 20 20" aria-hidden="true">' +
 '<path d="M3.6 17.8V8.8a6.4 6.4 0 0 1 12.8 0v9z" fill="currentColor"/>' +
 '<path d="M10 3.1v14.7" stroke="#fff" stroke-width=".9" opacity=".5"/>' +
 '<circle cx="10" cy="9.6" r="2.1" fill="#fff" opacity=".9"/>' +
 '<circle cx="10" cy="9.6" r=".95" fill="currentColor"/>' +
'</svg>',

/* 烬渊祭司（第三章 Boss）：尖兜帽 + 平底的袍子，身侧一根带火的杖。
   ⚠️ 跟回廊游影（warden2）都是尖顶，靠**平底 + 杖头那颗火**分开，别把杖删了。*/
priest:'<svg viewBox="0 0 20 20" aria-hidden="true">' +
 '<path d="M10 2.4c-3.2 2.4-5 5.9-5 10 0 2.2.2 4.1.6 5.8h8.8c.4-1.7.6-3.6.6-5.8 0-4.1-1.8-7.6-5-10z" fill="currentColor"/>' +
 '<path d="M16.5 6.6 15.3 17.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
 '<circle cx="16.9" cy="4.1" r="2.1" fill="#E0A83A"/>' +
 '<circle cx="8.3" cy="9.8" r="1.15" fill="#fff" opacity=".92"/>' +
 '<circle cx="11.7" cy="9.8" r="1.15" fill="#fff" opacity=".92"/>' +
'</svg>',

/* 墟心冕者（第四章 Boss）：头顶五枚尖刺的冕，胸口一颗亮着的墟心 */
crown:'<svg viewBox="0 0 20 20" aria-hidden="true">' +
 '<path d="M4.4 18 6 9.2h8l1.6 8.8z" fill="currentColor"/>' +
 '<path d="M5.6 9.6 4.7 2.4 7.6 5.3 10 1.4 12.4 5.3 15.3 2.4 14.4 9.6z" fill="currentColor"/>' +
 '<circle cx="8.3" cy="12" r="1.1" fill="#fff" opacity=".92"/>' +
 '<circle cx="11.7" cy="12" r="1.1" fill="#fff" opacity=".92"/>' +
 '<path d="M10 14.2 11.4 16.1 10 18 8.6 16.1z" fill="#E0A83A"/>' +
'</svg>'
};

/* ===== 战斗立绘 =====
   每只都是：地影 → 远侧肢体 → 主体 → 明暗 → 五官 → 高光。
   明暗块的坐标是照着主体轮廓手算的，别随手挪主体不改明暗，会漏色。*/
var ART = {

/* 灰鼠：头在左。弓背一笔画出来，耳朵、爪子、卷尾另加。 */
rat:'<svg viewBox="0 0 100 100">' +
 '<ellipse cx="54" cy="90" rx="35" ry="5" fill="#000" opacity=".1"/>' +
 '<circle cx="52" cy="24" r="9.5" fill="currentColor" opacity=".7"/>' +               /* 远侧的耳朵 */
 '<path d="M78 70c13 2 19 8 17 14-1 5-7 7-12 4" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round"/>' +
 '<ellipse cx="34" cy="86" rx="7" ry="4.5" fill="currentColor"/>' +                   /* 前爪 */
 '<ellipse cx="58" cy="88" rx="8" ry="4.5" fill="currentColor"/>' +
 '<path d="M14 63c0-6 5-11 13-14 7-14 22-22 36-20 17 2 30 16 30 32 0 15-15 27-33 27-21 0-40-9-46-19-1-2-1-4 0-6z" fill="currentColor"/>' +
 '<ellipse cx="64" cy="44" rx="24" ry="11" fill="#000" opacity=".13"/>' +             /* 背上的暗 */
 '<ellipse cx="54" cy="74" rx="28" ry="10" fill="#fff" opacity=".15"/>' +             /* 腹部的亮 */
 '<circle cx="34" cy="27" r="12" fill="currentColor"/>' +                             /* 近侧的耳朵 */
 '<circle cx="34" cy="28" r="6.5" fill="#000" opacity=".24"/>' +
 '<g stroke="#000" opacity=".26" stroke-width="1.4" stroke-linecap="round">' +
  '<path d="M17 58 3 50"/><path d="M16 63 2 62"/><path d="M17 68 4 73"/></g>' +       /* 胡须 */
 '<circle cx="31" cy="52" r="4.2" fill="#D8412F"/>' +
 '<circle cx="29.6" cy="50.8" r="1.3" fill="#fff" opacity=".85"/>' +
 '<circle cx="15" cy="63" r="3.2" fill="#C9695C"/>' +                                 /* 鼻头 */
 '<path d="M18 69h5l-2.5 7z" fill="#FBF6E7"/>' +                                      /* 门牙 */
'</svg>',

/* 泥怪：软趴趴地坐在地上，整体半透明，肚子里还悬着没化完的东西。 */
slime:'<svg viewBox="0 0 100 100">' +
 '<ellipse cx="50" cy="90" rx="34" ry="5" fill="#000" opacity=".1"/>' +
 '<path d="M25 86c-4-18-2-33 4-43 5-8 12-13 21-13s16 5 21 13c6 10 8 25 4 43z" fill="currentColor" opacity=".92"/>' +
 '<ellipse cx="50" cy="86" rx="35" ry="6.5" fill="currentColor" opacity=".92"/>' +    /* 摊在地上的裙边 */
 '<ellipse cx="50" cy="78" rx="22" ry="9" fill="#000" opacity=".13"/>' +              /* 底下积的厚处 */
 '<circle cx="33" cy="73" r="4" fill="#E3B23C" opacity=".72" stroke="#8C6412" stroke-width=".9"/>' + /* 化了一半的币 */
 '<g fill="#EDE4CE" opacity=".72" transform="rotate(18 60 72)">' +                    /* 化了一半的骨头 */
  '<rect x="52" y="70" width="16" height="4" rx="2"/>' +
  '<circle cx="52" cy="69" r="2.6"/><circle cx="52" cy="75" r="2.6"/>' +
  '<circle cx="68" cy="69" r="2.6"/><circle cx="68" cy="75" r="2.6"/></g>' +
 '<ellipse cx="42" cy="57" rx="5.5" ry="6.8" fill="#FBF6E7"/>' +
 '<circle cx="43" cy="58.5" r="3" fill="#2A2620"/>' +
 '<ellipse cx="58" cy="57" rx="5.5" ry="6.8" fill="#FBF6E7"/>' +
 '<circle cx="59" cy="58.5" r="3" fill="#2A2620"/>' +
 '<path d="M43 71q7 7 14 0" stroke="#2A2620" stroke-width="3" fill="none" stroke-linecap="round" opacity=".72"/>' +
 '<ellipse cx="41" cy="44" rx="9" ry="5" fill="#fff" opacity=".42" transform="rotate(-22 41 44)"/>' +
 '<circle cx="52" cy="37" r="3" fill="#fff" opacity=".34"/>' +
 '<path d="M85 58c2.2 3.2 3.2 5.6 3.2 7.4a3.2 3.2 0 0 1-6.4 0c0-1.8 1-4.2 3.2-7.4z" fill="currentColor" opacity=".8"/>' + /* 甩出去的一滴 */
'</svg>',

/* 长足蛛：腿分两节、有关节，远侧四条画在身子后面且更淡。顶上垂一根丝。 */
spider:'<svg viewBox="0 0 100 100">' +
 '<path d="M50 28V3" stroke="currentColor" stroke-width="1.6" opacity=".4"/>' +       /* 蛛丝 */
 '<g stroke="currentColor" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".5">' +
  '<path d="M38 56 20 44 8 50"/><path d="M38 70 22 78 16 92"/>' +
  '<path d="M62 56 80 44 92 50"/><path d="M62 70 78 78 84 92"/></g>' +               /* 远侧四条 */
 '<g stroke="currentColor" stroke-width="4.8" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M37 61 14 57 3 68"/><path d="M40 75 30 87 31 97"/>' +
  '<path d="M63 61 86 57 97 68"/><path d="M60 75 70 87 69 97"/></g>' +               /* 近侧四条 */
 '<ellipse cx="50" cy="66" rx="22" ry="19" fill="currentColor"/>' +                   /* 腹部 */
 '<path d="M50 51 57 63 50 75 43 63z" fill="#000" opacity=".2"/>' +                   /* 腹纹 */
 '<circle cx="40" cy="77" r="3" fill="#000" opacity=".16"/>' +
 '<circle cx="60" cy="77" r="3" fill="#000" opacity=".16"/>' +
 '<ellipse cx="43" cy="58" rx="7" ry="4.5" fill="#fff" opacity=".2" transform="rotate(-25 43 58)"/>' +
 '<path d="M44 50c-1 4-3 6.5-5.5 7.5M56 50c1 4 3 6.5 5.5 7.5" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" fill="none"/>' + /* 螯肢 */
 '<ellipse cx="50" cy="40" rx="14" ry="12" fill="currentColor"/>' +                   /* 头胸 */
 '<ellipse cx="45" cy="34" rx="6" ry="3.5" fill="#fff" opacity=".18" transform="rotate(-18 45 34)"/>' +
 '<circle cx="44" cy="36" r="3.6" fill="#D8412F"/><circle cx="56" cy="36" r="3.6" fill="#D8412F"/>' +
 '<circle cx="38" cy="39" r="2" fill="#D8412F"/><circle cx="62" cy="39" r="2" fill="#D8412F"/>' +
 '<circle cx="46" cy="43" r="1.7" fill="#D8412F"/><circle cx="54" cy="43" r="1.7" fill="#D8412F"/>' +
 '<circle cx="42.8" cy="34.8" r="1.1" fill="#fff" opacity=".8"/>' +
 '<circle cx="54.8" cy="34.8" r="1.1" fill="#fff" opacity=".8"/>' +
'</svg>',

/* 残骨兵：颅骨 + 分开的下颌 + 一副肋骨，背后立着一把豁了口的剑。眼窝里点着金火。 */
bone:'<svg viewBox="0 0 100 100">' +
 '<ellipse cx="50" cy="96" rx="26" ry="3.6" fill="#000" opacity=".09"/>' +
 '<g opacity=".55">' +                                                                /* 插在地上的破剑 */
  '<rect x="82" y="14" width="5" height="11" rx="2.5" fill="currentColor"/>' +        /* 握把 */
  '<circle cx="84.5" cy="13" r="3.6" fill="currentColor"/>' +                         /* 柄头 */
  '<rect x="73" y="25" width="23" height="4.6" rx="2.3" fill="currentColor"/>' +      /* 护手 */
  '<path d="M80 30h9v9l-6 4.5 6 4.5v18l-4.5 7-4.5-7z" fill="currentColor"/>' +        /* 剑身，右刃上崩了一口 */
  '<path d="M80 30h3.5v43l-3.5-7z" fill="#fff" opacity=".3"/></g>' +
 '<path d="M50 12c-16 0-26 11-26 25 0 8 3 14 8 18l2 6h32l2-6c5-4 8-10 8-18 0-14-10-25-26-25z" fill="currentColor"/>' +
 '<ellipse cx="42" cy="26" rx="10" ry="6" fill="#fff" opacity=".22" transform="rotate(-20 42 26)"/>' +
 '<path d="M44 15l4 9-3 5" stroke="#2A2620" stroke-width="1.6" fill="none" opacity=".28"/>' + /* 颅顶的裂 */
 '<ellipse cx="38.5" cy="40" rx="8" ry="9" fill="#2A2620" opacity=".82"/>' +
 '<ellipse cx="61.5" cy="40" rx="8" ry="9" fill="#2A2620" opacity=".82"/>' +
 '<circle cx="38.5" cy="41" r="3.2" fill="#E0A83A"/><circle cx="61.5" cy="41" r="3.2" fill="#E0A83A"/>' +
 '<path d="M50 48l-4.5 8h9z" fill="#2A2620" opacity=".78"/>' +                        /* 鼻腔 */
 '<path d="M34 61h32v6c0 4-3 7-7 7H41c-4 0-7-3-7-7z" fill="currentColor"/>' +         /* 下颌 */
 '<path d="M34 63h32" stroke="#2A2620" stroke-width="1.5" opacity=".3"/>' +
 '<g stroke="#2A2620" opacity=".42" stroke-width="1.8"><path d="M42 63v11M50 63v11M58 63v11"/></g>' +
 '<rect x="25" y="77" width="50" height="5" rx="2.5" fill="currentColor"/>' +         /* 锁骨 */
 '<rect x="47" y="79" width="6" height="17" fill="currentColor"/>' +                  /* 脊 */
 '<g stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round">' +
  '<path d="M47 85c-8 0-14 2-17 5"/><path d="M53 85c8 0 14 2 17 5"/>' +
  '<path d="M47 93c-7 0-12 2-14.5 4"/><path d="M53 93c7 0 12 2 14.5 4"/></g>' +       /* 肋骨 */
'</svg>',

/* 守门石像：方盔、宽肩、立在底座上，右手扶一杆长戟。身上有裂缝，眼是两道金光。 */
statue:'<svg viewBox="0 0 100 100">' +
 '<ellipse cx="50" cy="96" rx="33" ry="3.6" fill="#000" opacity=".1"/>' +
 '<path d="M81 6v84" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>' + /* 戟杆 */
 '<path d="M81 2l6 11-6 9-6-9z" fill="currentColor"/>' +                              /* 戟头 */
 '<path d="M81 3l6 10-6 9z" fill="#000" opacity=".16"/>' +
 '<rect x="44" y="27" width="12" height="9" fill="currentColor"/>' +                  /* 脖子 */
 '<rect x="44" y="27" width="12" height="9" fill="#000" opacity=".2"/>' +             /* 缩在头盔底下，整段压暗 */
 '<path d="M34 38h32l5 44H29z" fill="currentColor"/>' +                               /* 躯干 */
 '<path d="M34 38h6l-4 44h-7z" fill="#fff" opacity=".18"/>' +
 '<path d="M66 38h-5l4 44h6z" fill="#000" opacity=".15"/>' +
 '<path d="M28 42c0-6 5-11 11-11h22c6 0 11 5 11 11l-2 6H30z" fill="currentColor"/>' + /* 肩甲 */
 '<path d="M28 42c0-6 5-11 11-11h8l-2 17H30z" fill="#fff" opacity=".16"/>' +
 '<path d="M30 48h40" stroke="#000" stroke-width="2" opacity=".17"/>' +               /* 肩甲压着躯干的那道边 */
 '<path d="M67 54h15v8H67z" fill="currentColor"/>' +                                  /* 扶着戟的手臂 */
 '<path d="M50 56l7 5v9l-7 6-7-6v-9z" fill="#000" opacity=".2"/>' +                    /* 胸口纹章 */
 '<path d="M40 4h20c3 0 5 2 5 5v14c0 3-2 5-5 5H40c-3 0-5-2-5-5V9c0-3 2-5 5-5z" fill="currentColor"/>' + /* 方盔 */
 '<path d="M40 4h8v24h-8c-3 0-5-2-5-5V9c0-3 2-5 5-5z" fill="#fff" opacity=".15"/>' +
 '<rect x="38.5" y="13" width="9" height="4.5" rx="2.2" fill="#E0A83A"/>' +
 '<rect x="52.5" y="13" width="9" height="4.5" rx="2.2" fill="#E0A83A"/>' +
 '<g stroke="#000" opacity=".22" stroke-width="1.8" fill="none" stroke-linecap="round">' +
  '<path d="M39 52l5 9-3 7"/><path d="M62 66l-4 9"/><path d="M45 8l3 6"/></g>' +       /* 裂缝 */
 '<path d="M21 82h58v7H21z" fill="currentColor"/>' +                                  /* 底座 */
 '<path d="M21 82h58v2.5H21z" fill="#fff" opacity=".2"/>' +
 '<path d="M15 89h70v8H15z" fill="currentColor"/>' +
 '<path d="M15 89h70v2.5H15z" fill="#fff" opacity=".16"/>' +
'</svg>',

/* 低语幽魂：整体半透明，下摆撕成几绺，两条袖子虚虚地垂着，嘴张成一个"O"。 */
ghost:'<svg viewBox="0 0 100 100">' +
 '<path d="M29 48c-11 4-18 13-19 24-.4 4 4.6 5 5.9 1.2 2.6-7.5 7.9-12.8 14.1-15z" fill="currentColor" opacity=".7"/>' + /* 空荡荡的袖子 */
 '<path d="M71 48c11 4 18 13 19 24 .4 4-4.6 5-5.9 1.2-2.6-7.5-7.9-12.8-14.1-15z" fill="currentColor" opacity=".7"/>' +
 '<path d="M50 9c16 0 27 13 27 31v38c0 3-3 4-5 2l-6-6c-2-2-4-2-6 0l-5 6c-2 2-4 2-6 0l-5-6c-2-2-4-2-6 0l-6 6c-2 2-5 1-5-2V40c0-18 11-31 27-31z" fill="currentColor" opacity=".88"/>' +
 '<path d="M50 9c16 0 27 13 27 31v38c0 3-3 4-5 2l-6-6c-2-2-4-2-6 0l-2 2V10z" fill="#000" opacity=".12"/>' +
 '<ellipse cx="41" cy="26" rx="10" ry="6" fill="#fff" opacity=".24" transform="rotate(-20 41 26)"/>' +
 '<ellipse cx="39" cy="44" rx="7" ry="9" fill="#2A2620" opacity=".72"/>' +
 '<ellipse cx="61" cy="44" rx="7" ry="9" fill="#2A2620" opacity=".72"/>' +
 '<circle cx="39" cy="46" r="2.2" fill="#BFE3EA" opacity=".85"/>' +
 '<circle cx="61" cy="46" r="2.2" fill="#BFE3EA" opacity=".85"/>' +
 '<ellipse cx="50" cy="63" rx="5.5" ry="8" fill="#2A2620" opacity=".62"/>' +
'</svg>',

/* 锈钟怪：一口吊着的铜钟成了精，钟裙是它的下摆，钟舌在底下晃。身上带锈斑。
   不画地影 —— 它是吊着的，脚下没东西。 */
clock:'<svg viewBox="0 0 100 100">' +
 '<circle cx="50" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="5"/>' + /* 吊环 */
 '<path d="M22 74c0-27 8-48 28-48s28 21 28 48z" fill="currentColor"/>' +              /* 钟体 */
 '<path d="M22 74c0-24 6-43 18-47-7 10-10 26-10 47z" fill="#fff" opacity=".2"/>' +
 '<path d="M78 74c0-24-6-43-18-47 7 10 10 26 10 47z" fill="#000" opacity=".16"/>' +
 '<circle cx="67" cy="50" r="5" fill="#000" opacity=".14"/>' +                        /* 锈斑 */
 '<circle cx="35" cy="64" r="3.5" fill="#000" opacity=".12"/>' +
 '<path d="M58 34c4 2 5 5 4 8-3-2-5-4-4-8z" fill="#000" opacity=".14"/>' +
 '<ellipse cx="40" cy="53" rx="7" ry="8" fill="#FBF6E7"/>' +
 '<circle cx="41" cy="55" r="3.8" fill="#2A2620"/>' +
 '<ellipse cx="60" cy="53" rx="7" ry="8" fill="#FBF6E7"/>' +
 '<circle cx="61" cy="55" r="3.8" fill="#2A2620"/>' +
 /* 眉压着眼、嘴角朝下。⚠️ 没有这两笔它就是个笑脸铃铛，一点都不像怪 */
 '<path d="M31 41 46 47M69 41 54 47" stroke="#2A2620" stroke-width="4.5" opacity=".55" stroke-linecap="round"/>' +
 '<path d="M39 70q11-8 22 0" stroke="#2A2620" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".7"/>' +
 '<path d="M17 74h66v8a5 5 0 0 1-5 5H22a5 5 0 0 1-5-5z" fill="currentColor"/>' +      /* 钟裙 */
 '<path d="M17 80h66v2a5 5 0 0 1-5 5H22a5 5 0 0 1-5-5z" fill="#000" opacity=".2"/>' +
 '<rect x="47" y="87" width="6" height="6" fill="currentColor"/>' +                   /* 钟舌 */
 '<circle cx="50" cy="95" r="5.5" fill="currentColor"/>' +
'</svg>',

/* 回廊游影：比幽魂凶。尖顶、下摆撕成七条、两道金色斜缝当眼、左右甩出影翼。 */
warden2:'<svg viewBox="0 0 100 100">' +
 /* 影翼：两片破布。⚠️ 别画成细斜条，那看着是两根拐棍 */
 '<path d="M30 46 6 76c6 2 12 0 17-5 5-5 8-13 9-22z" fill="currentColor" opacity=".6"/>' +
 '<path d="M70 46 94 76c-6 2-12 0-17-5-5-5-8-13-9-22z" fill="currentColor" opacity=".6"/>' +
 '<path d="M50 4c15 9 24 27 25 47 1 15 1 29-1 41l-6-10-6 10-6-10-6 10-6-10-6 10-6-10-6 10c-2-12-2-26-1-41C26 31 35 13 50 4z" fill="currentColor" opacity=".92"/>' +
 '<path d="M50 4c15 9 24 27 25 47 1 15 1 29-1 41l-6-10-6 10-6-10-6 10V4z" fill="#000" opacity=".13"/>' +
 '<ellipse cx="41" cy="27" rx="7" ry="12" fill="#fff" opacity=".18" transform="rotate(18 41 27)"/>' +
 '<path d="M38 44 48 50M62 44 52 50" stroke="#E0A83A" stroke-width="5" stroke-linecap="round"/>' +
'</svg>',

/* 吞惧者：一张吞东西的大嘴，上面顶着三只不对称的血眼。 */
dread:'<svg viewBox="0 0 100 100">' +
 '<circle cx="50" cy="50" r="36" fill="currentColor"/>' +
 '<path d="M50 14c20 0 36 16 36 36S70 86 50 86c14-8 22-21 22-36S64 22 50 14z" fill="#000" opacity=".13"/>' +
 '<ellipse cx="34" cy="30" rx="11" ry="7" fill="#fff" opacity=".22" transform="rotate(-25 34 30)"/>' +
 '<path d="M16 46h68c0 19-15 34-34 34S16 65 16 46z" fill="#FBF6E7"/>' +               /* 张开的口 */
 '<path d="M26 58c4 13 13 22 24 22s20-9 24-22z" fill="#2A2620" opacity=".55"/>' +     /* 口里的深处 */
 '<path d="M18 46l4 9 4-9zM30 46l4.5 10 4.5-10zM43 46l4.5 10 4.5-10zM56 46l4.5 10 4.5-10zM69 46l4 9 4-9z" fill="currentColor"/>' + /* 上牙 */
 '<path d="M31 70.5 34.5 62l3.5 9.5zM44 76l3.5-9 3.5 9zM58 71.5 61.5 62l3.5 8.5z" fill="currentColor"/>' + /* 下牙 */
 '<circle cx="34" cy="32" r="4.5" fill="#FBF6E7"/><circle cx="34.5" cy="33" r="2.4" fill="#D8412F"/>' +
 '<circle cx="52" cy="26" r="3.6" fill="#FBF6E7"/><circle cx="52.5" cy="27" r="2" fill="#D8412F"/>' +
 '<circle cx="66" cy="33" r="3" fill="#FBF6E7"/><circle cx="66.5" cy="34" r="1.7" fill="#D8412F"/>' +
'</svg>',

/* 碎色棱：一块菱形晶体，左右棱面一明一暗，核心是只金瞳，周围飘着崩下来的碎片。 */
prism:'<svg viewBox="0 0 100 100">' +
 '<path d="M12 26 20 34 12 42 4 34z" fill="currentColor" opacity=".6"/>' +            /* 崩下来的碎片 */
 '<path d="M88 60 95 68 88 76 81 68z" fill="currentColor" opacity=".55"/>' +
 '<path d="M77 17 83 23 77 29 71 23z" fill="currentColor" opacity=".45"/>' +
 '<path d="M50 6 80 50 50 94 20 50z" fill="currentColor"/>' +
 '<path d="M50 6 20 50 50 94z" fill="#fff" opacity=".16"/>' +                         /* 左棱面亮 */
 '<path d="M50 6 80 50 50 94z" fill="#000" opacity=".15"/>' +                         /* 右棱面暗 */
 '<path d="M20 50h60" stroke="#fff" stroke-width="1.6" opacity=".28"/>' +
 '<path d="M50 6 38 50M50 94 62 50" stroke="#fff" stroke-width="1.2" opacity=".2"/>' + /* 裂纹 */
 '<path d="M50 33 62.5 50 50 67 37.5 50z" fill="#FBF6E7"/>' +                         /* 核心 */
 '<path d="M50 39 57.5 50 50 61 42.5 50z" fill="#E0A83A"/>' +
 '<path d="M50 44.5 53.5 50 50 55.5 46.5 50z" fill="#2A2620"/>' +                     /* 瞳孔 */
'</svg>',

/* 石廊守卫（BOSS）：双角头盔 + T 形面罩 + 肩甲 + 披风，右手一柄重斧。
   立绘颜色被 .portrait.boss 换成 #8A3223，所以身上不能有写死的灰。 */
warden:'<svg viewBox="0 0 100 100">' +
 '<ellipse cx="50" cy="96" rx="35" ry="4" fill="#000" opacity=".12"/>' +
 '<path d="M32 60c-11 6-16 20-16 35h13l5-31z" fill="currentColor" opacity=".5"/>' +   /* 披风 */
 '<path d="M68 60c11 6 16 20 16 35H71l-5-31z" fill="currentColor" opacity=".5"/>' +
 /* 斧举在身侧。⚠️ 刃别往上挪到 y<36 —— 那是角的地盘，两样东西会糊成一团；
    刃的内缘要向外凸成月牙，画成平的就只是一个方块，认不出是斧。 */
 '<path d="M80 34v58" stroke="currentColor" stroke-width="5.5" stroke-linecap="round"/>' + /* 斧柄 */
 '<path d="M81 36c11 1 17 7 17 14s-6 13-17 14c4-5 6-9 6-14s-2-9-6-14z" fill="currentColor"/>' + /* 斧刃 */
 '<path d="M81 36c11 1 17 7 17 14H87c0-5-2-9-6-14z" fill="#fff" opacity=".2"/>' +
 /* 角：粗根细尖、朝外上方横着弯出去。
    ⚠️ 别把角画成竖直的叶片 —— 试过，配上红色立刻变成一对兔耳朵。 */
 '<path d="M30 22C22 20 12 18 5 14c3 8 6 14 12 18 4 3 9 4 14 4z" fill="currentColor"/>' +
 '<path d="M70 22c8-2 18-4 25-8-3 8-6 14-12 18-4 3-9 4-14 4z" fill="currentColor"/>' +
 '<path d="M5 14c3 8 6 14 12 18 4 3 9 4 14 4v-4c-4 0-8-1-11-3-5-4-10-9-15-15z" fill="#000" opacity=".22"/>' +
 '<path d="M95 14c-3 8-6 14-12 18-4 3-9 4-14 4v-4c4 0 8-1 11-3 5-4 10-9 15-15z" fill="#fff" opacity=".16"/>' +
 '<g stroke="#000" opacity=".16" stroke-width="1.6" fill="none" stroke-linecap="round">' + /* 角上的环纹 */
  '<path d="M21 20c-2 3-3 6-3 9"/><path d="M12 17c-2 3-2 5-2 8"/>' +
  '<path d="M79 20c2 3 3 6 3 9"/><path d="M88 17c2 3 2 5 2 8"/></g>' +
 '<path d="M23 61c-7 3-11 10-12 18h19l2-16z" fill="currentColor"/>' +                 /* 肩甲 */
 '<path d="M77 61c7 3 11 10 12 18H70l-2-16z" fill="currentColor"/>' +
 '<path d="M23 61c-7 3-11 10-12 18h7c1-7 3-12 7-15z" fill="#fff" opacity=".16"/>' +
 '<path d="M36 63h28l6 31H30z" fill="currentColor"/>' +                               /* 躯干 */
 '<path d="M36 63h6l-5 31h-7z" fill="#fff" opacity=".16"/>' +
 '<path d="M64 63h-5l5 31h6z" fill="#000" opacity=".16"/>' +
 '<path d="M50 68v25" stroke="#000" opacity=".22" stroke-width="2.6"/>' +             /* 胸甲的中脊和两道分节 */
 '<path d="M42 76h16M41 85h18" stroke="#000" opacity=".15" stroke-width="2.2"/>' +
 '<rect x="66" y="69" width="16" height="8" rx="2.5" fill="currentColor"/>' +         /* 握着斧柄的手 */
 '<rect x="66" y="69" width="16" height="8" rx="2.5" fill="#000" opacity=".12"/>' +
 '<path d="M50 13c-14 0-23 10-23 23 0 9 4 16 10 20v7h26v-7c6-4 10-11 10-20 0-13-9-23-23-23z" fill="currentColor"/>' + /* 头盔 */
 '<path d="M50 13c-14 0-23 10-23 23 0 9 4 16 10 20v7h5V13z" fill="#fff" opacity=".17"/>' +
 '<path d="M37 33h26v8H37z" fill="#2A2620" opacity=".8"/>' +                          /* 面罩横缝 */
 '<path d="M46 33h8v23h-8z" fill="#2A2620" opacity=".8"/>' +                          /* 面罩竖缝 */
 '<circle cx="41.5" cy="37" r="3.4" fill="#E0A83A"/><circle cx="58.5" cy="37" r="3.4" fill="#E0A83A"/>' +
'</svg>',

/* 烬渊祭司（第三章 BOSS）：兜帽祭司，右手一根杖，杖头吊着烧着的香炉。
   剪影跟守卫（角 + 斧）完全不撞：尖兜帽 + 铺到地上的袍子 + 身侧那根杖。
   立绘颜色被 .portrait.boss 换成 #8A3223，所以身上不许有写死的灰。 */
priest:'<svg viewBox="0 0 100 100">' +
 '<ellipse cx="48" cy="96" rx="33" ry="4" fill="#000" opacity=".12"/>' +
 /* 袍子：肩窄、下摆铺到地上，是个梯形 */
 '<path d="M50 34c-12 0-19 8-23 24l-6 36h58l-6-36c-4-16-11-24-23-24z" fill="currentColor"/>' +
 '<path d="M50 34c-12 0-19 8-23 24l-6 36h12l4-36c2-13 6-21 13-24z" fill="#fff" opacity=".16"/>' +
 '<path d="M50 34c12 0 19 8 23 24l6 36H67l-4-36c-2-13-6-21-13-24z" fill="#000" opacity=".16"/>' +
 '<path d="M44 58h12l2 36H42z" fill="#000" opacity=".14"/>' +
 '<path d="M30 92h40" stroke="#000" opacity=".12" stroke-width="3"/>' +
 /* 两只袖子 */
 '<path d="M30 60c-9 5-13 14-13 27l12 2 5-23z" fill="currentColor"/>' +
 '<path d="M70 60c9 5 13 14 13 27l-12 2-5-23z" fill="currentColor"/>' +
 '<path d="M70 60c9 5 13 14 13 27h-6c0-11-3-19-9-24z" fill="#000" opacity=".15"/>' +
 '<path d="M30 60c-9 5-13 14-13 27h6c0-11 3-19 9-24z" fill="#fff" opacity=".16"/>' +
 /* 兜帽：尖顶，罩住整张脸 */
 '<path d="M50 6c-13 8-20 21-20 35 0 5 .7 9 2 13h36c1.3-4 2-8 2-13 0-14-7-27-20-35z" fill="currentColor"/>' +
 '<path d="M50 6c-13 8-20 21-20 35 0 5 .7 9 2 13h7c-1.4-4-2.2-8-2.2-13 0-13 5-25 13-33z" fill="#fff" opacity=".18"/>' +
 '<path d="M50 6c13 8 20 21 20 35 0 5-.7 9-2 13h-7c1.4-4 2.2-8 2.2-13 0-13-5-25-13-33z" fill="#000" opacity=".15"/>' +
 /* 帽子里是一团空洞，只剩两点火 */
 '<path d="M50 20c-8 0-13 8-13 18 0 5 1 10 3 13h20c2-3 3-8 3-13 0-10-5-18-13-18z" fill="#2A2620" opacity=".9"/>' +
 '<circle cx="44" cy="37" r="3.4" fill="#E0A83A"/><circle cx="56" cy="37" r="3.4" fill="#E0A83A"/>' +
 /* 法杖 + 吊炉，握在右手里（画在最后，压在袖子上面） */
 '<path d="M85 28v62" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>' +
 '<rect x="76" y="66" width="16" height="9" rx="3" fill="currentColor"/>' +
 '<rect x="76" y="66" width="16" height="9" rx="3" fill="#000" opacity=".14"/>' +
 '<path d="M76 26h18l-3 10a6.5 6.5 0 0 1-12 0z" fill="currentColor"/>' +
 '<path d="M76 26h18l-1 3.4H77z" fill="#000" opacity=".2"/>' +
 '<path d="M85 4c5 7 8 12 8 16a8 8 0 0 1-16 0c0-4 3-9 8-16z" fill="#E0A83A"/>' +
 '<path d="M85 11c2.6 4 4 7 4 9.4a4 4 0 0 1-8 0c0-2.4 1.4-5.4 4-9.4z" fill="#FBF6E7"/>' +
 /* 飘起来的余烬 */
 '<circle cx="19" cy="30" r="2.2" fill="#E0A83A" opacity=".6"/>' +
 '<circle cx="13" cy="47" r="1.5" fill="#E0A83A" opacity=".45"/>' +
 '<circle cx="24" cy="15" r="1.6" fill="#E0A83A" opacity=".4"/>' +
'</svg>',

/* 墟心冕者（第四章 BOSS）：五枚尖刺的冕 + 宽大氅 + 胸口那颗亮着的墟心。
   跟守卫、祭司都不撞：它是「宽肩 + 头顶一圈尖刺 + 胸前一颗菱形的光」。
   ⚠️ 面甲只有**一只**眼（守卫和祭司都是两只），小尺寸下靠这个认。 */
crown:'<svg viewBox="0 0 100 100">' +
 '<ellipse cx="50" cy="96" rx="34" ry="4" fill="#000" opacity=".12"/>' +
 '<circle cx="50" cy="38" r="32" fill="none" stroke="currentColor" stroke-width="3" opacity=".3" stroke-dasharray="15 10"/>' +
 /* 大氅 */
 '<path d="M50 44c-17 0-28 9-32 26l-4 24h72l-4-24c-4-17-15-26-32-26z" fill="currentColor"/>' +
 '<path d="M50 44c-17 0-28 9-32 26l-4 24h13l3-24c2-15 8-23 20-26z" fill="#fff" opacity=".16"/>' +
 '<path d="M50 44c17 0 28 9 32 26l4 24H73l-3-24c-2-15-8-23-20-26z" fill="#000" opacity=".16"/>' +
 /* 肩甲 */
 '<path d="M22 56c-9 4-14 12-15 23h21l3-21z" fill="currentColor"/>' +
 '<path d="M78 56c9 4 14 12 15 23H72l-3-21z" fill="currentColor"/>' +
 '<path d="M78 56c9 4 14 12 15 23h-6c-1-9-5-16-10-19z" fill="#000" opacity=".16"/>' +
 '<path d="M22 56c-9 4-14 12-15 23h6c1-9 5-16 10-19z" fill="#fff" opacity=".16"/>' +
 /* 胸口的墟心 */
 '<path d="M50 56 61 74 50 92 39 74z" fill="#2A2620" opacity=".5"/>' +
 '<path d="M50 61 57 74 50 87 43 74z" fill="#E0A83A"/>' +
 '<path d="M50 66.5 53.5 74 50 81.5 46.5 74z" fill="#FBF6E7"/>' +
 '<g stroke="#E0A83A" stroke-width="1.5" opacity=".4" fill="none" stroke-linecap="round">' +
  '<path d="M39 74 28 69"/><path d="M61 74 72 69"/><path d="M50 92l3 6"/></g>' +
 /* 头 + 面甲 */
 '<path d="M50 16c-9 0-14 7-14 16 0 8 5 14 14 17 9-3 14-9 14-17 0-9-5-16-14-16z" fill="currentColor"/>' +
 '<path d="M50 16c-9 0-14 7-14 16 0 8 5 14 14 17z" fill="#fff" opacity=".17"/>' +
 '<path d="M37 29h26v8H37z" fill="#2A2620" opacity=".85"/>' +
 '<circle cx="50" cy="33" r="5.4" fill="#FBF6E7"/>' +
 '<circle cx="50" cy="33" r="3" fill="#E0A83A"/>' +
 '<circle cx="50" cy="33" r="1.3" fill="#2A2620"/>' +
 /* 冕：五枚尖刺，中间最高 */
 '<path d="M33 24 32 6 41 14 50 2 59 14 68 6 67 24z" fill="currentColor"/>' +
 '<path d="M33 24 32 6 41 14 50 2v22z" fill="#fff" opacity=".17"/>' +
 '<path d="M32 18h36v6H32z" fill="#000" opacity=".16"/>' +
 '<circle cx="50" cy="9" r="2.4" fill="#E0A83A"/>' +
 '<circle cx="32.6" cy="12" r="1.7" fill="#E0A83A"/><circle cx="67.4" cy="12" r="1.7" fill="#E0A83A"/>' +
'</svg>'
};

/* 地上的金币。以前是一个 ◎ 字符，跟别的符号混在一起认不出来；
   现在是一小堆币：后面压着一枚，前面立着一枚。
   地图格子只有二三十像素，所以只画得下三样东西 ——
   厚实的外圈、一圈内缘、中间一颗四角星，再补一道高光和一片影。
   币身用 currentColor（颜色交给 CSS 的 .c.gold，走出视野会自动变淡）。*/
var COIN =
'<svg viewBox="0 0 20 20" aria-hidden="true">' +
 '<ellipse cx="10.2" cy="16.6" rx="6.2" ry="1.5" fill="#6B5836" opacity=".18"/>' +        /* 地上的影 */
 '<circle cx="13.6" cy="12" r="4.4" fill="currentColor" stroke="#8C6412" stroke-width="1"/>' +    /* 压在后面的那枚 */
 '<circle cx="8.6" cy="9.4" r="6.3" fill="currentColor" stroke="#8C6412" stroke-width="1.2"/>' +  /* 正面这枚 */
 '<circle cx="8.6" cy="9.4" r="4.4" fill="none" stroke="#8C6412" stroke-width=".9" opacity=".5"/>' +
 '<path d="M8.6 6.5 9.8 8.8l2.3 1.2-2.3 1.2-1.2 2.3-1.2-2.3L5.1 10l2.3-1.2z" fill="#8C6412" opacity=".8"/>' +
 '<path d="M4.9 7A5.4 5.4 0 0 1 7.8 4.3" stroke="#FFF4D4" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".9"/>' +
'</svg>';

/* 粒子用的小图形：金币碎屑 / 遗物碎屑。飞的时候只有几像素大，不用画细。*/
var MOTE_COIN = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4.2" fill="currentColor" stroke="#8A5F0C" stroke-width=".9"/></svg>';
var MOTE_GEM  = '<svg viewBox="0 0 10 10"><path d="M5 .8 9.2 5 5 9.2.8 5z" fill="currentColor"/></svg>';

/* 第二章的 Boss「锈庭主事」共用守卫那张小图（战斗立绘走 def.art，也是 warden）。
   MOB_ART 的键是 def.id，所以这里得单独挂一个别名，不然地图上只会画出「庭」字。 */
MOB_ART.steward = MOB_ART.warden;

/* 深渊那只「无终之影」（前四章第 51 层，见 content.js 的 ABYSS）的**地图小图**：借冕者那张。
   战斗立绘不在这儿 —— 它现取当前这一章章末 Boss 的 art（game.js 的 makeAbyssFoe）。 */
MOB_ART.abyss = MOB_ART.crown;
MOB_ART.study = MOB_ART.warden;          // 纯净学习模式的「书灵」：借守卫的小图（立绘现取章末 Boss 的）
/* 学中文才有的第五章「书冢」的章末 Boss（content.js 的 scribe）：借祭司的小图，颜色在 style.css 的 m-scribe */
MOB_ART.scribe = MOB_ART.priest;

/* ===== 圣器（用户 2026-10-01）：信息页三个方格 / 二选一卡片上的小图 =====
   一律 48×48、主体 currentColor（CSS 里染成圣金色），描边写死深金 #6E4A0A，高光白。简洁为主，格子只有六七十像素。*/
var HOLY_ART = (function(){
  var o = "#6E4A0A";
  function svg(body){ return '<svg viewBox="0 0 48 48" aria-hidden="true">' + body + '</svg>'; }
  return {
    /* 圣光照耀：一轮太阳，八道光 */
    radiance: svg(
      '<g stroke="currentColor" stroke-width="3.2" stroke-linecap="round">' +
        '<path d="M24 4v7M24 37v7M4 24h7M37 24h7M9.9 9.9l5 5M33.1 33.1l5 5M38.1 9.9l-5 5M14.9 33.1l-5 5"/></g>' +
      '<circle cx="24" cy="24" r="9.5" fill="currentColor" stroke="' + o + '" stroke-width="1.6"/>' +
      '<circle cx="21" cy="21" r="3" fill="#fff" opacity=".55"/>'),
    /* 共鸣圣铃：一口钟 + 两道声波 */
    chime: svg(
      '<path d="M24 7c-7 0-11 5.5-11 13v8l-4 5h30l-4-5v-8c0-7.5-4-13-11-13z" fill="currentColor" stroke="' + o + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<circle cx="24" cy="37" r="3.6" fill="currentColor" stroke="' + o + '" stroke-width="1.4"/>' +
      '<rect x="22" y="3.5" width="4" height="4" rx="1" fill="' + o + '"/>' +
      '<path d="M18.5 14c1.2-2.4 3-3.4 5-3.6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".6"/>' +
      '<path d="M5 15c-2 3-2 7 0 10M43 15c2 3 2 7 0 10" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/>'),
    /* 殉道者之冠：带刺的冠 */
    crown: svg(
      '<path d="M8 34 6 15l9 8 9-14 9 14 9-8-2 19z" fill="currentColor" stroke="' + o + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<rect x="8" y="34" width="32" height="6" rx="1.5" fill="currentColor" stroke="' + o + '" stroke-width="1.6"/>' +
      '<circle cx="24" cy="27" r="3" fill="#A93729" stroke="' + o + '" stroke-width="1"/>' +
      '<path d="M12 37h2M18 37h2M28 37h2M34 37h2" stroke="' + o + '" stroke-width="1.6" stroke-linecap="round"/>' +
      '<path d="M13.5 28 15 24" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".55"/>'),
    /* 审判之锤：斜着的一柄锤 */
    judge: svg(
      '<path d="M22 26 9.5 38.5" stroke="' + o + '" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M22 26 9.5 38.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>' +
      '<rect x="20" y="6" width="14" height="24" rx="2.5" transform="rotate(45 27 18)" fill="currentColor" stroke="' + o + '" stroke-width="1.6"/>' +
      '<path d="M22.5 12.5 33.5 23.5" stroke="' + o + '" stroke-width="1.3" opacity=".55"/>' +
      '<path d="M24 9.5l3-3" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".6"/>'),
    /* 试炼圣骸：一颗颅骨，额上一道光 */
    trial: svg(
      '<path d="M24 6C14.5 6 9 12.5 9 21c0 5 2.3 8.6 5.5 10.5V37a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2v-5.5C36.7 29.6 39 26 39 21 39 12.5 33.5 6 24 6z" fill="currentColor" stroke="' + o + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<ellipse cx="18" cy="22" rx="4" ry="4.4" fill="#2A2620"/><ellipse cx="30" cy="22" rx="4" ry="4.4" fill="#2A2620"/>' +
      '<path d="M24 26.5l-2 4h4z" fill="#2A2620"/>' +
      '<path d="M20 39v-4M24 39v-4M28 39v-4" stroke="' + o + '" stroke-width="1.4"/>' +
      '<path d="M24 9v6M21 12h6" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>'),
    /* 公义天平：一根柱、一条梁、两只盘 */
    scales: svg(
      '<path d="M24 8v31M15 41h18" stroke="' + o + '" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M8 13h32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M10 13 5 26M10 13l5 13M38 13l-5 13M38 13l5 13" stroke="' + o + '" stroke-width="1.2"/>' +
      '<path d="M3.5 26h13a6.5 5 0 0 1-13 0zM31.5 26h13a6.5 5 0 0 1-13 0z" fill="currentColor" stroke="' + o + '" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<circle cx="24" cy="8" r="3" fill="currentColor" stroke="' + o + '" stroke-width="1.3"/>'),
    /* 万言圣典：一本摊开的书 */
    scripture: svg(
      '<path d="M24 13c-5-3.5-12-4-18-2.5v26c6-1.5 13-1 18 2.5 5-3.5 12-4 18-2.5v-26c-6-1.5-13-1-18 2.5z" fill="currentColor" stroke="' + o + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M24 13v26" stroke="' + o + '" stroke-width="1.6"/>' +
      '<path d="M10 17c3.5-.7 7-.4 10 1M10 22c3.5-.7 7-.4 10 1M10 27c3.5-.7 7-.4 10 1M28 18c3-1.4 6.5-1.7 10-1M28 23c3-1.4 6.5-1.7 10-1M28 28c3-1.4 6.5-1.7 10-1" stroke="' + o + '" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".7"/>' +
      '<path d="M24 4v5M21.5 6.5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
    /* 逆时沙漏：上下两只玻璃泡，沙子往上流 */
    hourglass: svg(
      '<rect x="10" y="5" width="28" height="4" rx="1.5" fill="' + o + '"/><rect x="10" y="39" width="28" height="4" rx="1.5" fill="' + o + '"/>' +
      '<path d="M14 9h20c0 8-6 11-6 15s6 7 6 15H14c0-8 6-11 6-15s-6-7-6-15z" fill="#fff" fill-opacity=".35" stroke="' + o + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M16.5 11h15c-.8 4-4.5 6.5-7.5 9-3-2.5-6.7-5-7.5-9z" fill="currentColor"/>' +
      '<path d="M20 37h8c-1-3-2.5-4-4-5-1.5 1-3 2-4 5z" fill="currentColor"/>' +
      '<path d="M24 30v-8" stroke="currentColor" stroke-width="1.6" stroke-dasharray="1.5 2"/>'),
    /* ---- 流派圣器（2026-10-02）---- */
    /* 血之圣杯：一只高脚杯，杯口一滴血 */
    grail: svg(
      '<path d="M11 8h26c0 10-5 17-13 17S11 18 11 8z" fill="currentColor" stroke="' + o + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M13.5 11h21c-.8 5.5-4.6 9.5-10.5 9.5S14.3 16.5 13.5 11z" fill="#A93729"/>' +
      '<path d="M22 25h4v9h-4z" fill="currentColor" stroke="' + o + '" stroke-width="1.4"/>' +
      '<path d="M14 40c0-3.5 4.5-6 10-6s10 2.5 10 6z" fill="currentColor" stroke="' + o + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M17 13.5c1 2.5 2.5 4 4.5 4.8" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".55"/>'),
    /* 不朽圣铠：一片胸甲，两道横纹 */
    bulwark: svg(
      '<path d="M10 9l8-3c2 3 10 3 12 0l8 3-2 9v14c0 5-5 9-12 10-7-1-12-5-12-10V18z" fill="currentColor" stroke="' + o + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M14 21c6 2 14 2 20 0M14 28c6 2 14 2 20 0M24 13v28" stroke="' + o + '" stroke-width="1.3" fill="none" opacity=".7"/>' +
      '<path d="M15 12.5l3-1" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".6"/>'),
    /* 战神之刃：一柄竖起来的剑 */
    warblade: svg(
      '<path d="M24 3l4 6v21h-8V9z" fill="currentColor" stroke="' + o + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M24 7v22" stroke="' + o + '" stroke-width="1.1" opacity=".55"/>' +
      '<rect x="13" y="30" width="22" height="4" rx="1.5" fill="currentColor" stroke="' + o + '" stroke-width="1.5"/>' +
      '<rect x="22" y="34" width="4" height="7" fill="' + o + '"/>' +
      '<circle cx="24" cy="43" r="2.6" fill="currentColor" stroke="' + o + '" stroke-width="1.3"/>' +
      '<path d="M22 11v13" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>'),
    /* 天命之眼：一只眼，瞳孔里一颗星 */
    fateeye: svg(
      '<path d="M3 24c5-8 12-12 21-12s16 4 21 12c-5 8-12 12-21 12S8 32 3 24z" fill="currentColor" stroke="' + o + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<circle cx="24" cy="24" r="8" fill="#FBF6E7" stroke="' + o + '" stroke-width="1.4"/>' +
      '<circle cx="24" cy="24" r="5" fill="#2A2620"/>' +
      '<path d="M24 20.5l1 2.4 2.5.2-1.9 1.6.6 2.5-2.2-1.4-2.2 1.4.6-2.5-1.9-1.6 2.5-.2z" fill="#E0A83A"/>' +
      '<path d="M24 4v4M10 8l2.5 3M38 8l-2.5 3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
    /* 圣徒之盾：一面盾，正中一个十字 */
    saintshield: svg(
      '<path d="M24 4l16 5v13c0 10-7 17-16 21C15 39 8 32 8 22V9z" fill="currentColor" stroke="' + o + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M24 11v24M15 20h18" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".85"/>' +
      '<path d="M24 11v24M15 20h18" stroke="' + o + '" stroke-width="1.2" stroke-linecap="round" opacity=".45"/>'),
    /* 永恒之链：三环相扣 */
    eternal: svg(
      '<g fill="none" stroke-width="5.5"><rect x="3" y="17" width="17" height="14" rx="7" stroke="' + o + '"/>' +
      '<rect x="15.5" y="17" width="17" height="14" rx="7" stroke="' + o + '"/>' +
      '<rect x="28" y="17" width="17" height="14" rx="7" stroke="' + o + '"/></g>' +
      '<g fill="none" stroke="currentColor" stroke-width="3"><rect x="3" y="17" width="17" height="14" rx="7"/>' +
      '<rect x="15.5" y="17" width="17" height="14" rx="7"/><rect x="28" y="17" width="17" height="14" rx="7"/></g>'),
    /* 黄金圣像（经济流，2026-10-02）：一摞金币，顶上一颗星 */
    goldidol: svg(
      '<ellipse cx="24" cy="40" rx="14" ry="4.5" fill="currentColor" stroke="' + o + '" stroke-width="1.5"/>' +
      '<path d="M10 40v-5M38 40v-5" stroke="' + o + '" stroke-width="1.5"/>' +
      '<ellipse cx="24" cy="35" rx="14" ry="4.5" fill="currentColor" stroke="' + o + '" stroke-width="1.5"/>' +
      '<path d="M12 35v-5M36 35v-5" stroke="' + o + '" stroke-width="1.5"/>' +
      '<ellipse cx="24" cy="30" rx="12" ry="4" fill="currentColor" stroke="' + o + '" stroke-width="1.5"/>' +
      '<ellipse cx="24" cy="30" rx="6" ry="1.8" fill="none" stroke="' + o + '" stroke-width="1" opacity=".6"/>' +
      '<path d="M24 4l3 6.5 7 .8-5.2 4.8 1.5 7-6.3-3.6-6.3 3.6 1.5-7L14 11.3l7-.8z" fill="currentColor" stroke="' + o + '" stroke-width="1.4" stroke-linejoin="round"/>' +
      '<path d="M21 11l2-3" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>'),
    /* 风暴之翼（攻击次数流）：一只翅膀，三道风刃 */
    storm: svg(
      '<path d="M6 34C10 18 22 8 40 6c-4 4-6 8-6 12 4-1 7-1 9 0-5 3-8 7-9 11 3 0 5 1 6 2-8 4-18 6-34 3z" fill="currentColor" stroke="' + o + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M12 31c6-9 14-15 24-19M14 33c7-4 14-6 22-6" stroke="' + o + '" stroke-width="1.2" fill="none" opacity=".55"/>' +
      '<path d="M8 41h14M14 45h16M4 37h8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
    /* 熔铸之心（熔铸流，2026-10-02）：一颗心坐在坩埚里，上面三条火舌 */
    meltheart: svg(
      '<path d="M7 26h34l-3 13c-.6 2.6-2.6 4-5.2 4H15.2c-2.6 0-4.6-1.4-5.2-4z" fill="currentColor" stroke="' + o + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M5 26h38" stroke="' + o + '" stroke-width="2.2" stroke-linecap="round"/>' +
      '<path d="M24 38c-6-4-9-7-9-10.5 0-2.4 1.8-4 4-4 2 0 3.6 1.2 5 3 1.4-1.8 3-3 5-3 2.2 0 4 1.6 4 4 0 3.5-3 6.5-9 10.5z" fill="#fff" opacity=".55"/>' +
      '<path d="M16 21c-2-4 1-6 0-10 4 2 5 6 3 10M24 20c-2.5-5 1-8-.5-14 5 3 6.5 9 3.5 14M32 21c-2-4 1-6 0-10 4 2 5 6 3 10" fill="currentColor" stroke="' + o + '" stroke-width="1.3" stroke-linejoin="round"/>'),
    /* 雷霆之匣（雷匣流）：一只方匣，盖子掀开一道缝，里面劈出一道闪电 */
    thunderbox: svg(
      '<rect x="7" y="24" width="34" height="18" rx="2.5" fill="currentColor" stroke="' + o + '" stroke-width="1.6"/>' +
      '<path d="M7 31h34" stroke="' + o + '" stroke-width="1.2" opacity=".6"/>' +
      '<rect x="20" y="29" width="8" height="5" rx="1" fill="none" stroke="' + o + '" stroke-width="1.3"/>' +
      '<path d="M6 22l35-6 1 4-35 6z" fill="currentColor" stroke="' + o + '" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<path d="M27 2l-9 11h6l-5 10 12-13h-6l5-8z" fill="currentColor" stroke="' + o + '" stroke-width="1.4" stroke-linejoin="round"/>' +
      '<path d="M25 6l-3 4" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>')
  };
})();

/* ===== 角色立绘 · 100×100 矢量模型 =====
   五类衣装、独立头饰与职业道具；在地图缩小时先读轮廓，在名册放大时再读细节。
   主色由 heroCss() 提供，明暗只叠黑白透明色；无引用 id，可同时重复显示。 */
var HERO_ART = (function(){
  function path(d, extra){ return '<path d="' + d + '" ' + (extra || '') + '/>'; }
  function line(d, w, opacity){ return path(d, 'fill="none" stroke="currentColor" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round"' + (opacity ? ' opacity="' + opacity + '"' : '')); }
  function dark(d, opacity){ return path(d, 'fill="#000" opacity="' + (opacity || .18) + '"'); }
  function light(d, opacity){ return path(d, 'fill="#fff" opacity="' + (opacity || .23) + '"'); }
  function circle(x,y,r,extra){return '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" '+(extra||'')+'/>';}
  function rect(x,y,w,h,r,extra){return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+r+'" '+(extra||'')+'/>';}
  function ring(x,y,r){return circle(x,y,r,'fill="none" stroke="currentColor" stroke-width="2"');}
  function gem(x,y,size){return '<g transform="translate('+x+' '+y+') scale('+size/10+')">'+path('M0-10 7 0 0 12-7 0Z')+light('M0-10 0 12-7 0Z',.35)+dark('M0-10 7 0 0 12Z',.2)+'</g>';}
  function spark(x,y,s){return path('M'+x+' '+(y-s)+' '+(x+1.6)+' '+(y-1.6)+' '+(x+s)+' '+y+' '+(x+1.6)+' '+(y+1.6)+' '+x+' '+(y+s)+' '+(x-1.6)+' '+(y+1.6)+' '+(x-s)+' '+y+' '+(x-1.6)+' '+(y-1.6)+'Z');}
  function book(x,y,w){return '<g transform="translate('+x+' '+y+') scale('+w/24+')">'+path('M-12-8Q-6-11 0-7 6-11 12-8V9Q6 6 0 10-6 6-12 9Z')+light('M-10-6Q-5-8-1-5V7Q-5 4-10 6ZM1-5Q5-8 10-6V6Q5 4 1 7Z',.5)+line('M0-7V10',1.3)+dark('M-8-3H-3M3-3H8M-8 1H-3M3 1H8',.18)+'</g>';}
  function sword(x,y,angle,long){return '<g transform="translate('+x+' '+y+') rotate('+angle+')">'+path('M-2 10H2V-31L0-'+(long||44)+'-2-31Z')+light('M0 10V-'+(long||44)+'L-2-31V10Z',.45)+rect(-9,9,18,3,1)+rect(-2,12,4,12,1)+circle(0,26,3)+dark('M-2 15H2V18H-2ZM-2 21H2V24H-2Z')+'</g>';}
  function flame(x,y,s){return '<g transform="translate('+x+' '+y+') scale('+s+')">'+path('M0-15C12-5 12 4 6 9-2 15-12 8-9 0-7-6-3-6-4-11-1-9 1-6 2-3 4-8 3-12 0-15Z')+light('M0-4C5 0 5 6 1 8-4 10-7 4-3 1-3 4-1 4 0-4Z',.55)+'</g>';}
  function soul(x,y,s){return '<g transform="translate('+x+' '+y+') scale('+s+')">'+path('M0-12C8-12 12-6 10 1 9 8 3 9 4 17L-1 12-5 14-6 8C-15 2-12-12 0-12Z','opacity=".55"')+circle(-3,-2,1.8,'fill="#fff" opacity=".8"')+circle(3,-2,1.8,'fill="#fff" opacity=".8"')+'</g>';}
  var bodies = {
    cloak: path('M34 36Q20 42 17 77L27 87 32 72 28 91H72L68 72 78 87 84 77Q80 43 66 36Z')+dark('M55 38 66 36Q80 43 84 77L78 87 68 72 72 91H54Z')+light('M34 38Q23 48 21 73L27 78 35 51 34 85 39 85 43 41Z',.16)+path('M42 37H58L61 56 50 65 39 56Z','fill="#000" opacity=".12"'),
    robe: path('M35 36Q22 39 17 63L28 69 34 54 26 92Q50 96 74 92L66 54 72 69 83 63Q78 39 65 36Z')+dark('M57 38 65 36Q78 39 83 63L72 69 66 54 74 92 56 94Z')+light('M35 40 29 60 24 59 29 45ZM37 62 31 89 36 90 44 65Z',.2)+line('M45 41 50 66 56 41',1.6,.6)+path('M47 66H53L56 91H44Z','fill="#fff" opacity=".12"'),
    coat: path('M33 37 23 43 17 65 26 70 34 54 29 83 45 88 50 76 55 88 72 83 66 54 75 70 84 65 77 43 66 37Z')+dark('M58 39 66 37 77 43 84 65 75 70 66 54 72 83 55 88 50 76Z')+light('M33 39 38 41 34 57 23 65 21 63 27 46Z',.2)+path('M41 36 50 44 59 36 57 59 44 59Z','fill="#fff" opacity=".18"')+line('M41 38 39 49 46 53M59 38 61 49 54 53',1.3,.55),
    armor: path('M31 36 20 42 17 57 27 62 34 53 31 73 37 84H63L70 73 66 53 75 62 85 57 80 42 68 36Z')+dark('M55 38 68 36 80 42 85 57 75 62 66 53 70 73 63 84H54Z')+path('M35 39 50 35 65 39 62 61 50 67 38 61Z')+light('M35 39 50 35 48 62 40 59Z',.23)+line('M38 43 50 47 62 43M39 56 50 60 61 56M20 48 29 51M72 51 82 48',2,.55)+path('M32 68H68L65 76H35Z','fill="#000" opacity=".2"'),
    apron: path('M32 37 23 43 16 63 27 68 34 53 31 85H70L66 53 75 68 84 63 77 43 67 37Z')+dark('M56 39 67 37 77 43 84 63 75 68 66 53 70 85H57Z')+path('M40 38H60L62 57 67 89H34L39 57Z','fill="#000" opacity=".16"')+light('M40 38H44L42 57 38 86H35L39 57Z',.2)+rect(42,57,17,13,2,'fill="#fff" opacity=".16"')+line('M41 38 39 52M60 38 62 52',1.5,.65)
  };
  var heads = {
    hood: path('M33 23Q34 6 50 4 66 6 67 23L63 39 56 43H44L37 39Z')+dark('M50 4Q66 6 67 23L63 39 56 43H51Z')+light('M35 23Q37 11 47 8L40 23 39 34 36 31Z',.18)+path('M40 23Q50 17 60 23L58 33Q50 42 42 33Z','fill="#000" opacity=".3"'),
    hair: path('M35 24Q31 12 40 9 46 1 59 8 68 11 65 26L61 37 51 42 40 36Z')+dark('M53 8Q68 11 65 26L61 37 51 42 52 23Z')+path('M39 23 44 15 53 20 60 18 61 30 56 36H45L40 31Z','fill="#fff" opacity=".24"')+light('M36 17Q39 7 51 8L43 13Z',.25),
    turban: path('M34 24Q31 10 44 7 56 3 64 12L67 25 63 34 58 40 42 40 36 33Z')+dark('M51 7Q62 7 64 12L67 25 63 34 58 40H52Z')+path('M39 26H62L59 34 50 38 42 34Z','fill="#000" opacity=".25"')+line('M35 17Q48 7 63 16M35 21Q49 12 66 22',2,.6)+light('M36 14Q44 8 52 9L42 14Z',.25),
    helm: path('M34 27V19Q34 6 50 6 66 6 66 19V27L60 40H40Z')+dark('M51 6Q66 6 66 19V27L60 40H51Z')+path('M39 25H61L58 33H42Z','fill="#000" opacity=".42"')+light('M36 23V17Q37 10 47 9L45 22Z',.25)+line('M50 9V23M39 35H46M54 35H61',1.5,.6),
    wizard: path('M35 30Q34 15 50 15 66 15 65 30L59 40H41Z')+dark('M51 16Q66 16 65 30L59 40H51Z')+path('M26 22 37 15 55 1 61 17 75 24Q53 32 26 22Z')+dark('M55 1 61 17 75 24 53 26Z')+light('M37 18 53 4 48 21Z',.24)+line('M37 20Q50 24 63 22',2,.65),
    widehat: path('M36 23H65V30L59 40H42L36 32Z')+path('M22 22 34 17 39 7Q50 3 61 7L66 17 80 22Q53 31 22 22Z')+dark('M52 6 61 7 66 17 80 22 52 26Z')+light('M39 9 48 7 46 17 36 18Z',.2)+line('M35 17Q50 20 66 17',2,.7),
    cone: path('M35 24H65V32L58 40H42L36 32Z')+path('M20 24 50 5 81 24Q51 34 20 24Z')+dark('M50 5 81 24Q66 30 50 29Z')+light('M25 24 48 9 40 26Z',.22)+line('M50 8V27',1,.6)
  };
  function model(body,head,back,front,face){
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">'+
      '<ellipse cx="50" cy="94" rx="32" ry="4" fill="#000" opacity=".12"/>'+(back||'')+
      path('M36 73H47L46 92 33 94 32 89ZM54 73H65L68 90 67 94 54 92Z')+dark('M36 83H46V91L33 93ZM55 83H65L67 93 55 91Z',.24)+
      bodies[body]+rect(33,61,35,5,1,'fill="#000" opacity=".25"')+rect(46,60,8,7,1,'fill="#fff" opacity=".4"')+rect(48,62,4,3,0,'fill="#000" opacity=".2"')+
      heads[head]+(face===false?'':circle(45,28,1.4,'fill="#fff" opacity=".8"')+circle(55,28,1.4,'fill="#fff" opacity=".8"'))+(front||'')+'</svg>';
  }
  return {
    /* 冒险者 · 轻甲短斗篷，肩上卷毯与宽刃。 */
    adv: model('cloak','hood',sword(24,52,-16,40),path('M65 39 77 50 74 76 65 73Z')+dark('M68 45 75 50 72 70 68 69Z')+line('M37 41 63 65',4)+circle(37,43,3,'fill="#fff" opacity=".3"')+rect(34,69,12,11,2)+light('M36 71H43V74H36Z')),
    /* 书吏 · 方帽、展开卷册、羽毛笔。 */
    clerk: model('coat','hair','',path('M32 15 32 7 50 3 68 7V15L50 20Z')+light('M34 8 50 5 64 8 49 12Z')+line('M66 11V29',1.5)+circle(66,29,2)+book(43,64,30)+path('M70 51Q69 28 85 25 85 43 70 51L64 72 62 71Z')+light('M74 44Q77 31 83 28L79 40Z',.4)+line('M67 60 80 33',1,.7)),
    /* 剑客 · 斗笠、束袖，拔出的横剑。 */
    duelist: model('coat','cone',path('M25 45 32 86 22 82 17 52Z','opacity=".6"'),sword(57,65,76,36)+path('M33 39 48 49 62 38 59 46 48 55Z','fill="#fff" opacity=".18"')+line('M34 68 28 81',3)+path('M58 48 73 40 89 44 71 46Z','opacity=".65"')),
    /* 隐士 · 高兜帽、长须与节杖。 */
    hermit: model('robe','hood','',line('M78 90 80 21Q80 10 89 13 95 19 86 23',4)+line('M79 51 85 51M78 76 84 76',2)+path('M42 32 50 37 58 32 55 49 50 56 45 49Z','fill="#fff" opacity=".45"')+path('M35 48 46 56 42 64 30 56Z')+line('M41 72 38 86M59 72 62 86',1.5,.7)),
    /* 拓荒者 · 高背包、绳圈和小镐。 */
    pioneer: model('coat','widehat',rect(14,31,24,43,5)+dark('M15 39H34V66H15Z')+rect(9,27,32,10,5)+light('M13 29H35V32H13Z'),line('M36 40 61 67',4)+ring(30,73,9)+ring(30,73,5)+line('M74 45 64 89',4)+path('M62 43Q75 34 91 47L80 45 72 47Z')+light('M65 43Q76 37 86 44L77 41Z')),
    /* 守夜人 · 肩披月徽、灯笼照亮手套。 */
    keeper: model('cloak','hood','',path('M31 39 21 49 36 55 43 40Z')+circle(31,47,4,'fill="#fff" opacity=".4"')+circle(33,46,3)+line('M76 56V62',2)+rect(65,62,22,3,1)+rect(66,65,20,20,2)+dark('M69 66H83V82H69Z',.4)+flame(76,75,.45)+line('M76 66V82',1.5)+rect(64,84,24,4,1)+path('M71 62V58Q76 52 81 58V62','fill="none" stroke="currentColor" stroke-width="2"')+circle(76,75,17,'opacity=".08"')),
    /* 驱魔人 · 符纸肩带与三枚驱邪铃。 */
    exorcist: model('robe','turban',line('M23 83 18 27',3)+path('M14 30 26 28 30 54 18 56Z')+light('M16 32 24 31 27 51 19 53Z',.5)+line('M19 36 24 41 20 44 25 49',1.5),path('M34 39 45 42 60 80 50 83Z','fill="#fff" opacity=".25"')+line('M42 49 49 54 45 58 53 63M49 68 54 71 52 75',1.5)+line('M72 47 74 78',2)+circle(73,54,5)+circle(74,66,5)+circle(75,78,5)+light('M71 51 73 50 74 54H71ZM72 63H74V67H72ZM73 75H75V79H73Z')),
    /* 狂徒 · 抛起的赌骰、飞扬的面巾。 */
    rogue: model('coat','hair',path('M63 38 80 32 90 36 77 39 87 45 69 44Z','opacity=".6"'),path('M37 30 62 30 60 38 44 41 38 37Z')+dark('M40 32H60V35H40Z')+rect(73,19,17,17,3)+light('M75 21H87V31H75Z',.4)+circle(78,24,1.4,'fill="#000" opacity=".5"')+circle(85,24,1.4,'fill="#000" opacity=".5"')+circle(81.5,28,1.4,'fill="#000" opacity=".5"')+line('M72 47 78 42M83 44 86 39',1.5,.45)+path('M25 54 33 49 43 62 39 69Z')),
    /* 晨读者 · 翻开的厚书、晨晖发冠。 */
    reader: model('robe','hair',circle(50,21,22,'opacity=".08"')+line('M24 13 19 9M50 0V3M76 13 81 9',2,.45),book(50,61,41)+path('M25 58 34 63 31 69 23 65ZM66 63 75 58 77 65 69 69Z')+path('M53 68V82L58 78 61 82V68Z','fill="#fff" opacity=".3"')+line('M37 14 43 10M57 10 63 14',2)),
    /* 博物学者 · 探察帽，叶标本与棱镜。 */
    naturalist: model('coat','widehat',path('M17 79Q8 62 15 44 30 48 31 62 28 72 17 79Z','opacity=".6"')+line('M16 73 20 51M19 63 14 56M19 63 26 57',1.5),rect(61,60,24,22,3)+dark('M65 64H81V78H65Z',.3)+path('M68 75Q66 65 77 65 78 74 68 75Z','fill="#fff" opacity=".5"')+line('M69 74 76 67',1)+line('M35 41 68 61',3)+ring(26,52,8)+line('M22 58 14 71',4)+circle(26,52,5,'fill="#fff" opacity=".2"')),
    /* 造句者 · 长卷和悬墨，宽袖文士。 */
    poet: model('robe','turban',rect(10,20,18,65,1)+light('M12 23H26V82H12Z',.55)+rect(7,17,24,5,2)+rect(7,84,24,5,2)+line('M17 30V48M22 30V58M17 54V72M22 65V77',1.4,.6),path('M38 8 51 3 63 8 58 15H42Z')+line('M75 47 87 17',4)+path('M74 48 70 59Q76 57 79 50Z','fill="#000" opacity=".65"')+path('M68 63Q72 66 68 70 64 67 68 63Z','opacity=".6"')+path('M62 45 78 43 76 54 63 58Z')+spark(82,70,5)),
    /* 乐师 · 月弧竖琴、羽饰与弦纹披肩。 */
    bard: model('coat','widehat',path('M62 13Q70-2 82 5 78 15 63 19Z')+light('M64 15 79 7 71 15Z',.35),path('M23 49Q20 76 38 81 56 76 54 49L48 44 43 48 46 68Q38 77 30 68L32 48Z')+dark('M28 51 31 67Q38 72 46 67V50Z')+line('M32 51V68M37 51V71M42 50V70',1.3)+line('M25 47 51 47',3)+line('M73 35V48M73 36 82 33V45',2)+circle(70,49,3)+circle(79,46,3)+light('M37 40 49 49 61 40 58 49 49 55 39 49Z')),
    /* 钟表匠 · 单镜、链条与大型怀表。 */
    clock: model('coat','hair',ring(23,27,12)+line('M23 15V18M11 27H14M23 36V39M32 27H35',1.4,.6),ring(55,27,5)+line('M50 27H47M59 30 62 47Q60 69 69 64',1.5)+circle(73,70,15)+circle(73,70,11,'fill="#fff" opacity=".5"')+line('M73 62V70L80 74',2)+line('M73 59V61M62 70H64M73 79V81M82 70H84',1.5)+rect(69,51,8,5,1)+ring(73,49,4)+path('M32 45 44 48 41 56 29 52Z')),
    /* 追问者 · 棱角眼镜、教鞭与问题卷。 */
    examiner: model('coat','hair','',rect(39,23,10,8,1,'fill="none" stroke="currentColor" stroke-width="2"')+rect(52,23,10,8,1,'fill="none" stroke="currentColor" stroke-width="2"')+line('M49 26H52',2)+line('M65 64 86 24',3)+path('M72 15Q73 6 82 7 92 9 87 17L81 23V28','fill="none" stroke="currentColor" stroke-width="3"')+circle(81,34,2)+rect(20,57,18,24,2)+light('M23 60H35V77H23Z',.4)+line('M26 64H32M26 69H32M26 74H30',1.3)),
    /* 后继者 · 家徽、传承火炬与缀边斗篷。 */
    heir: model('cloak','hair',path('M24 39Q9 44 13 77L24 86 24 60Z','opacity=".5"'),line('M75 90 78 40',5)+path('M69 40H88L84 49H73Z')+flame(79,28,1)+light('M28 47 35 42 33 80 27 83Z',.23)+path('M42 43H58V53L50 60 42 53Z','fill="#fff" opacity=".4"')+path('M50 46 54 51 50 56 46 51Z')+line('M41 76 50 82 59 76',2,.7)),
    /* 法师 · 弯尖帽、法杖与三元素轨迹。 */
    mage: model('robe','wizard',line('M78 90 82 28',4)+gem(82,18,9)+circle(24,54,16,'opacity=".1"'),circle(24,54,10)+light('M18 49Q21 43 27 47L22 54Z',.5)+ring(24,54,16)+flame(14,35,.35)+path('M28 74 31 67 34 74 31 80Z')+spark(42,83,4)+path('M48 39 56 45 50 54 43 45Z','fill="#fff" opacity=".3"')),
    /* 星象师 · 月冠、星盘与布满星点的长袍。 */
    astro: model('robe','hood',ring(50,27,26)+line('M50 0V4M24 27H20M76 27H80',1.5,.5)+spark(22,13,5)+spark(79,37,4),path('M41 6Q45-2 53 2 46 4 47 10 49 15 56 13 50 21 42 16Z')+ring(70,65,17)+ring(70,65,11)+line('M53 65H87M70 48V82M58 53 82 77',1.2)+gem(70,65,5)+spark(39,55,4)+spark(51,77,3)+circle(39,83,1.4,'fill="#fff" opacity=".6"')+circle(61,89,1.6,'fill="#fff" opacity=".6"')),
    /* 锻造师 · 宽肩皮围裙、铁锤与火花。 */
    smith: model('apron','hair','',line('M66 79 82 42',5)+rect(70,29,25,15,2,'transform="rotate(22 82 37)"')+light('M74 30 91 37 89 41 72 35Z',.35)+path('M35 28 42 32H58L65 28 61 42 51 47 40 42Z','fill="#000" opacity=".25"')+rect(41,58,17,12,2,'fill="none" stroke="currentColor" stroke-width="1.5"')+line('M45 60V66M50 60V66M55 60V66',1)+spark(88,58,4)+spark(80,68,3)+path('M16 76H37L33 83H24V88H15V84L20 81Z')),
    /* 招魂者 · 骨冠、曲镰与三团幽魂。 */
    necro: model('robe','hood',soul(18,27,.85)+soul(83,57,.8)+soul(18,72,.55)+line('M80 92V21',4)+path('M80 22Q67 6 90 5 98 7 98 16 91 9 82 16Z'),path('M34 17 31 5 41 12 50 2 59 12 69 5 66 17 59 22H41Z')+dark('M50 3 59 12 69 5 66 17 59 22H50Z')+path('M43 45 50 39 57 45 55 54H45Z','fill="#fff" opacity=".35"')+circle(47,47,1.5,'fill="#000" opacity=".5"')+circle(53,47,1.5,'fill="#000" opacity=".5"')+line('M40 65 35 85M60 65 65 85',1.4,.5)),
    /* 赏金猎人 · 羽边宽帽、皮护肩和通缉令。 */
    bounty: model('coat','widehat',line('M23 85 20 28',4)+path('M14 29 20 18 27 29 23 39H17Z'),path('M34 39 27 43 27 54 40 49Z')+light('M28 44 35 41 38 47 29 51Z')+line('M35 42 64 66',4)+rect(64,55,23,29,1)+light('M67 58H84V81H67Z',.5)+circle(75,66,5,'fill="#000" opacity=".3"')+dark('M69 76Q75 65 81 76Z',.3)+line('M69 79H81',1.5)+path('M37 29H62L60 35H39Z','fill="#000" opacity=".25"')),
    /* 灵媒 · 双重幻影、纱冠与悬浮水晶。 */
    medium: model('robe','turban',path('M18 32Q8 23 13 11 19 0 28 12L33 32 45 83H6Z','opacity=".16"')+path('M81 33Q92 23 87 11 80 0 72 12L66 32 58 83H95Z','opacity=".16"'),path('M32 17 38 8 50 4 63 8 69 17 63 19 50 14 38 19Z','fill="#fff" opacity=".22"')+gem(50,51,11)+circle(50,51,19,'opacity=".08"')+path('M24 57 42 66 50 61 58 66 77 57 75 67 57 74 50 69 43 74 25 67Z')+light('M30 60 43 67 49 64 43 70 30 65Z',.25)+spark(72,34,4)+spark(26,39,3)),
    /* 药剂师 · 鸟嘴护面、瓶带与圆肚药瓶。 */
    apothecary: model('apron','hood','',path('M39 24 57 22 67 34 53 37 43 33Z')+light('M43 26 55 25 62 32 53 32Z',.3)+circle(44,26,4,'fill="#000" opacity=".45"')+ring(44,26,4)+line('M34 42 61 68',4)+rect(34,48,6,13,2)+rect(42,55,6,13,2)+rect(50,62,6,13,2)+path('M74 52H83V61Q95 68 89 80 79 89 68 80 62 68 74 61Z')+rect(73,48,11,5,1)+light('M68 72Q79 77 90 72 89 84 79 84 69 82 68 72Z',.4)+light('M73 64Q68 68 70 72L73 72 75 65Z',.4),false),
    /* 辩手 · 抬手立论、金属胸针和声纹。 */
    debater: model('coat','hair','',path('M68 56 75 38 75 27Q78 22 80 28V41L83 36Q88 32 90 37L85 51 79 62Z')+light('M77 29V42L73 52 76 54 81 43 80 29Z',.3)+line('M86 20Q92 25 91 30M89 12Q99 20 97 30',2,.6)+path('M42 40 50 47 59 40 56 54 50 58 44 54Z','fill="#fff" opacity=".3"')+circle(50,50,3)+book(24,73,21)),
    /* 导师 · 方肩学袍、银须与教典。 */
    mentor: model('robe','hair','',path('M35 35 28 41 40 53 50 47 60 53 72 41 65 35 50 41Z')+light('M31 41 40 48 49 43 50 45 40 51Z')+path('M39 31 45 34 50 32 55 34 61 31 58 44 50 52 42 44Z','fill="#fff" opacity=".5"')+ring(44,26,4.5)+ring(56,26,4.5)+line('M49 26H51',1.5)+book(69,68,29)+line('M24 88 24 49',3)+circle(24,47,4)),
    /* 商人 · 裘边帽、鼓鼓的钱袋与腰链。 */
    merchant: model('coat','turban',path('M14 47 12 35 18 37 25 34 28 46Q40 57 34 75 24 85 12 76 6 59 14 47Z','opacity=".7"')+line('M12 47H29',3),path('M34 18Q48 11 66 18L67 23Q49 18 33 24Z','fill="#fff" opacity=".35"')+gem(50,17,4)+line('M41 42 44 59Q59 80 70 61',1.6)+circle(48,64,3)+circle(55,69,3)+circle(63,68,3)+path('M68 55 64 48 79 48 75 56Q89 64 84 78 74 88 64 79 58 66 68 55Z')+dark('M73 56Q89 64 84 78 79 84 73 83Z')+circle(73,70,7,'fill="#fff" opacity=".3"')+line('M73 65V75M70 67H76M70 73H76',1.4)),
    /* 驯兽师 · 毛领短衣、哨子与狼伙伴。 */
    tamer: model('coat','hair',path('M28 40 20 45 23 57 38 53 41 39 48 45 54 39 65 52 79 55 82 45 70 39 64 35 50 40 38 35Z','opacity=".6"'),path('M36 38 43 47 50 42 57 47 64 38 60 51 51 47 42 52Z','fill="#fff" opacity=".3"')+line('M46 46 48 59 54 61',1.6)+rect(51,58,9,5,1)+path('M65 85Q60 74 69 68L69 57 77 64 87 61 91 68 96 73 91 79V93H84V84H75V93H66Z')+dark('M83 66 87 63 91 69 94 73 88 75 87 89H84V81H76Z')+circle(86,70,1.4,'fill="#fff" opacity=".8"')+path('M65 85Q56 86 60 73 51 85 61 91H66Z')),
    /* 战吼者 · 外展战角、重甲与号角。 */
    warcrier: model('armor','helm',path('M36 17Q19 16 13 3 9 22 34 27ZM64 17Q81 16 87 3 91 22 66 27Z')+light('M16 10Q22 19 35 20L35 22Q21 22 16 10ZM84 10Q78 19 65 20L65 22Q79 22 84 10Z'),path('M56 37 63 39 73 37 81 29 87 40 76 46 65 47 58 44Z')+dark('M82 32 86 39 79 42 77 38Z',.3)+line('M88 23Q94 29 92 36M91 16Q101 26 98 38',2,.6)+path('M36 65 50 72 64 65 61 78 50 85 39 78Z')+light('M39 69 48 74 47 81 41 76Z')),
    /* 收藏家 · 高礼帽、单片镜与展藏匣。 */
    collector: model('coat','hair',path('M23 45 25 32H31L34 45Q39 67 29 88H16Q20 64 23 45Z','opacity=".5"'),path('M32 19H67V23H32ZM38 17V4Q50 0 61 4V17Z')+light('M41 6H46V15H41Z')+line('M38 15H61',2,.6)+ring(56,27,5)+line('M61 29 65 44',1.3)+rect(59,57,29,25,3)+dark('M62 60H85V79H62Z',.3)+gem(74,68,8)+path('M37 40 50 47 62 40 58 48H42Z','fill="#fff" opacity=".25"')+circle(50,53,2,'fill="#fff" opacity=".4"')),
    /* 回溯者 · 断环时轨、沙漏与分裂披风。 */
    rewinder: model('cloak','hood',line('M79 35A35 35 0 1 0 74 80',3,.55)+path('M82 39 69 35 80 26Z','opacity=".65"')+line('M18 29 22 32M17 65 22 63M56 87 54 82',2,.65),path('M63 40 75 45 72 59 78 64 73 78 80 85 70 91 62 76 63 63 57 54Z','fill="#fff" opacity=".2"')+rect(65,48,22,4,1)+rect(65,79,22,4,1)+path('M68 52H84Q84 62 76 66 68 62 68 52ZM68 79Q68 69 76 66 84 69 84 79Z','fill="#fff" opacity=".35"')+path('M71 55H81Q79 61 76 63 73 61 71 55ZM71 77 76 71 81 77Z')+line('M76 64V70',1.3)+path('M37 41 48 48 45 55 34 49Z')),
    /* 剑圣 · 双剑与剑环，层叠剑甲。 */
    saint: model('armor','hair',ring(50,25,24)+sword(23,53,-22,45)+sword(77,53,22,45),path('M37 15 45 10 50 14 55 10 63 15 59 19H41Z')+light('M40 15 45 12 50 16 55 12 59 15 56 17H43Z')+path('M32 37 18 42 24 48 37 47 43 39ZM68 37 82 42 76 48 63 47 57 39Z')+light('M21 43 33 40 34 43 25 46ZM79 43 67 40 66 43 75 46Z')+path('M36 67 50 73 64 67 61 74 50 80 39 74ZM39 77 50 83 61 77 60 85 50 91 40 85Z')+gem(50,52,5))
  };
})();

/* 简易召唤台 · 招募页可直接插入 SUMMON_ART，颜色跟随 currentColor。 */
var SUMMON_ART = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 170" fill="currentColor" aria-hidden="true">'+
  '<ellipse cx="140" cy="149" rx="113" ry="12" fill="#000" opacity=".1"/>'+
  '<path d="M38 119V136Q140 176 242 136V119Z"/><path d="M38 124V136Q140 176 242 136V124Q140 162 38 124Z" fill="#000" opacity=".24"/>'+
  '<ellipse cx="140" cy="119" rx="102" ry="30"/><ellipse cx="140" cy="117" rx="93" ry="24" fill="#fff" opacity=".15"/>'+
  '<path d="M60 110V122Q140 151 220 122V110Z"/><path d="M60 115V122Q140 151 220 122V115Q140 143 60 115Z" fill="#000" opacity=".17"/>'+
  '<ellipse cx="140" cy="109" rx="80" ry="24"/><ellipse cx="140" cy="108" rx="70" ry="18" fill="#000" opacity=".13"/>'+
  '<g fill="none" stroke="#fff" stroke-width="1.5" opacity=".5"><ellipse cx="140" cy="108" rx="61" ry="13"/>'+
  '<path d="M103 102 140 119 177 102M111 117 140 96 169 117M78 110H88M192 110H202M140 90V96M140 121V127"/></g>'+
  '<path d="M140 25 157 53 140 83 123 53Z"/><path d="M140 25V83L123 53Z" fill="#fff" opacity=".35"/><path d="M140 25 157 53 140 83 146 53Z" fill="#000" opacity=".15"/>'+
  '<path d="M123 53H157M140 25 146 53 140 83" fill="none" stroke="#fff" stroke-width="1.2" opacity=".5"/>'+
  '<ellipse cx="140" cy="106" rx="15" ry="4" opacity=".35"/><path d="M128 92 140 87 152 92" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".35"/>'+
  '<g opacity=".65"><path d="M104 54 107 61 114 64 107 67 104 74 101 67 94 64 101 61ZM181 30 183 35 188 37 183 39 181 44 179 39 174 37 179 35Z"/>'+
  '<circle cx="176" cy="78" r="2"/><circle cx="111" cy="27" r="1.6"/></g>'+
  '<g fill="none" stroke="#000" stroke-width="1.5" opacity=".18"><path d="M78 139 80 148M201 140 198 148M140 151V157M57 130 65 133 62 136M217 130 209 133 211 136"/></g></svg>';
