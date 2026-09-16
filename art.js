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
