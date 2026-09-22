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
