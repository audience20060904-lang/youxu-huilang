/* 幽墟回廊 · SVG 美术
   剪影一律用 fill="currentColor"，颜色由 CSS 控制（地图上是蓝色，战斗立绘里是深灰褐）。
   挖空处（眼窝、嘴）用 #F5EEDD，跟立绘底色一致，看起来像镂空。*/
"use strict";

var HERO =
'<svg viewBox="0 0 20 20" aria-hidden="true">' +
'<path d="M10 1.9c1.7 0 3 1.4 3 3.1 0 1.2-.6 2.2-1.6 2.7l.5 1.1H8.1l.5-1.1A3.1 3.1 0 0 1 7 5c0-1.7 1.3-3.1 3-3.1z" fill="currentColor"/>' +
'<path d="M10 8.7c2.7 0 4.5 3 4.8 9.4H5.2C5.5 11.7 7.3 8.7 10 8.7z" fill="currentColor"/>' +
'<path d="M17.5 2.9l1.1 1.1-4.8 4.8-1.1-1.1z" fill="#C9971F"/>' +
'</svg>';

var ART = {
rat:'<svg viewBox="0 0 100 100"><ellipse cx="57" cy="65" rx="30" ry="21" fill="currentColor"/>' +
 '<path d="M86 67c14 3 15 14 9 22" stroke="currentColor" stroke-width="5" fill="none" stroke-linecap="round"/>' +
 '<circle cx="19" cy="32" r="9" fill="currentColor"/><circle cx="38" cy="29" r="9" fill="currentColor"/>' +
 '<circle cx="29" cy="49" r="18" fill="currentColor"/>' +
 '<circle cx="21" cy="47" r="3.2" fill="#E0453A"/><circle cx="34" cy="45" r="3.2" fill="#E0453A"/>' +
 '<circle cx="12" cy="55" r="3" fill="#F5EEDD"/></svg>',
slime:'<svg viewBox="0 0 100 100"><path d="M16 84c0-32 12-48 34-48s34 16 34 48z" fill="currentColor"/>' +
 '<ellipse cx="50" cy="84" rx="34" ry="6" fill="currentColor"/>' +
 '<ellipse cx="33" cy="48" rx="8" ry="4" fill="#FFFFFF" opacity=".2"/>' +
 '<circle cx="39" cy="60" r="5.5" fill="#F5EEDD"/><circle cx="62" cy="60" r="5.5" fill="#F5EEDD"/>' +
 '<path d="M40 74q10 8 20 0" stroke="#F5EEDD" stroke-width="3.4" fill="none" stroke-linecap="round"/></svg>',
spider:'<svg viewBox="0 0 100 100"><g stroke="currentColor" stroke-width="4.5" fill="none" stroke-linecap="round">' +
 '<path d="M33 52 12 34"/><path d="M32 62 7 60"/><path d="M33 71 13 86"/><path d="M38 78 28 94"/>' +
 '<path d="M67 52 88 34"/><path d="M68 62 93 60"/><path d="M67 71 87 86"/><path d="M62 78 72 94"/></g>' +
 '<circle cx="50" cy="62" r="21" fill="currentColor"/><circle cx="50" cy="38" r="13" fill="currentColor"/>' +
 '<circle cx="44" cy="35" r="2.8" fill="#E0453A"/><circle cx="56" cy="35" r="2.8" fill="#E0453A"/>' +
 '<circle cx="46" cy="42" r="2" fill="#E0453A"/><circle cx="54" cy="42" r="2" fill="#E0453A"/></svg>',
bone:'<svg viewBox="0 0 100 100"><path d="M50 16c-17 0-28 12-28 27 0 10 4 17 10 21v12h36V64c6-4 10-11 10-21 0-15-11-27-28-27z" fill="currentColor"/>' +
 '<circle cx="39" cy="46" r="7.5" fill="#F5EEDD"/><circle cx="61" cy="46" r="7.5" fill="#F5EEDD"/>' +
 '<path d="M46 59h8l-4 8z" fill="#F5EEDD"/>' +
 '<path d="M40 76v8M50 76v8M60 76v8" stroke="#F5EEDD" stroke-width="2.6"/>' +
 '<rect x="26" y="84" width="48" height="6" rx="3" fill="currentColor"/></svg>',
statue:'<svg viewBox="0 0 100 100"><rect x="31" y="16" width="38" height="46" rx="3" fill="currentColor"/>' +
 '<rect x="23" y="62" width="54" height="22" rx="2" fill="currentColor"/>' +
 '<rect x="18" y="84" width="64" height="8" rx="2" fill="currentColor"/>' +
 '<rect x="38" y="33" width="10" height="5" rx="1" fill="#E0A83A"/><rect x="53" y="33" width="10" height="5" rx="1" fill="#E0A83A"/>' +
 '<path d="M50 16l-6 17 7 10-5 13" stroke="#F5EEDD" stroke-width="2.4" fill="none"/></svg>',
ghost:'<svg viewBox="0 0 100 100"><path d="M22 88V52a28 28 0 0 1 56 0v36l-9-8-9 8-10-8-10 8z" fill="currentColor" opacity=".9"/>' +
 '<circle cx="39" cy="50" r="6.5" fill="#F5EEDD"/><circle cx="61" cy="50" r="6.5" fill="#F5EEDD"/>' +
 '<ellipse cx="50" cy="67" rx="6" ry="8" fill="#F5EEDD"/></svg>',
warden:'<svg viewBox="0 0 100 100">' +
 '<path d="M24 36C14 30 9 18 11 8c11 2 19 9 23 18z" fill="currentColor"/>' +
 '<path d="M76 36c10-6 15-18 13-28-11 2-19 9-23 18z" fill="currentColor"/>' +
 '<path d="M50 14c-20 0-32 14-32 31 0 11 5 20 12 25v14h40V70c7-5 12-14 12-25 0-17-12-31-32-31z" fill="currentColor"/>' +
 '<circle cx="38" cy="46" r="8" fill="#F5EEDD"/><circle cx="62" cy="46" r="8" fill="#F5EEDD"/>' +
 '<circle cx="38" cy="46" r="3.4" fill="#E0A83A"/><circle cx="62" cy="46" r="3.4" fill="#E0A83A"/>' +
 '<path d="M44 60h12l-6 10z" fill="#F5EEDD"/>' +
 '<path d="M38 78v8M50 78v8M62 78v8" stroke="#F5EEDD" stroke-width="3"/></svg>'
};

/* 地上的金币。以前是一个 ◎ 字符，跟别的符号混在一起认不出来。
   现在是一枚立着的币：外圈描边 + 币面内圈 + 一道斜高光，
   币身用 currentColor（颜色交给 CSS 的 .c.gold，记忆中的格子会自动变淡）。*/
var COIN =
'<svg viewBox="0 0 20 20" aria-hidden="true">' +
 '<ellipse cx="10" cy="16.4" rx="6" ry="1.5" fill="#6B5836" opacity=".22"/>' +           /* 落在地上的影 */
 '<circle cx="10" cy="9.6" r="6.6" fill="currentColor" stroke="#8A5F0C" stroke-width="1.1"/>' +
 '<circle cx="10" cy="9.6" r="4.3" fill="none" stroke="#8A5F0C" stroke-width=".9" opacity=".55"/>' +
 '<path d="M10 6.6v6M8.1 8.1h3.8M8.1 11.1h3.8" stroke="#8A5F0C" stroke-width="1" stroke-linecap="round" opacity=".75"/>' +
 '<path d="M6.4 6.6a4.8 4.8 0 0 1 3.1-2.1" stroke="#FFF3D0" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".85"/>' +
'</svg>';

/* 粒子用的小图形：金币碎屑 / 遗物碎屑。飞的时候只有几像素大，不用画细。*/
var MOTE_COIN = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4.2" fill="currentColor" stroke="#8A5F0C" stroke-width=".9"/></svg>';
var MOTE_GEM  = '<svg viewBox="0 0 10 10"><path d="M5 .8 9.2 5 5 9.2.8 5z" fill="currentColor"/></svg>';
