/* 幽墟回廊 · 多语言（2026-09-23，见 CLAUDE.md「多语言与新手教程」那一节）
   ---------------------------------------------------------------------------
   两件事分开管：
     · **界面语言 LANG_UI** = 玩家的母语（zh 中文 / en English）—— 所有按钮、日志、遗物文案；
     · **学习语言 LANG_LEARN** = 背哪一门的词（en 英语 / zh 中文）—— 词库、朗读、拼写题。
   能选的组合在 LANG_PAIRS 里（要有「这门语言的词 + 母语释义」那一份词库才算数）：
     中文母语 → 学英语（words-a1.js，游戏本来的样子）/ 英语母语 → 学中文（words-zh.js）。
   选择存在设置 OPT（youxu.opt.v1）的 `lang` 字段上 —— 它是「这台设备怎么显示」，不是进度。
   ⚠️ **必须在 util.js 之后、词库之前加载**：words-zh.js 要读 LANG_LEARN 决定换不换词库。
   ⚠️ 换语言一律**重载页面**（词库和静态文案都是加载时定死的），见 game.js 的 setLang()。
   ⚠️ 联机（coop.html）固定中文界面 + 学英语：两个人的题目、服务器都是按英语词库写的。

   翻译的写法（只在界面是英文时生效，中文界面下这两个函数原样返回中文，零改动）：
     T("中文原文")      —— 查 I18N 字典（i18n-en.js 填的），查不到就原样返回中文；
     L("中文", "English") —— 就地二选一，给拼接顺序中英对不上的句子用。*/
"use strict";

var LANG_PAIRS = [
  {ui:"zh", learn:"en"},
  {ui:"en", learn:"zh"}
];
var LANG_NAME = {zh:"中文", en:"English"};
var LANG_UI = "zh", LANG_LEARN = "en", LANG_SET = false;
function langPairOk(ui, learn){
  for(var i = 0; i < LANG_PAIRS.length; i++)
    if(LANG_PAIRS[i].ui === ui && LANG_PAIRS[i].learn === learn) return true;
  return false;
}
(function(){
  var o = load("youxu.opt.v1", null);
  if(o && o.lang && langPairOk(o.lang.ui, o.lang.learn)){
    LANG_UI = o.lang.ui; LANG_LEARN = o.lang.learn; LANG_SET = true;
  }
  if(window.__COOP){ LANG_UI = "zh"; LANG_LEARN = "en"; LANG_SET = true; }
})();
var UI_EN = LANG_UI === "en";
var LEARN_ZH = LANG_LEARN === "zh";
/* util.js 的 speak() 读它 —— 念的是「要学的那门语言」 */
var SPEAK_LANG = LEARN_ZH ? "zh-CN" : "en-US";
try{ document.documentElement.lang = UI_EN ? "en" : "zh-CN"; }catch(e){}

var I18N = {};
function T(s){
  if(!UI_EN || s == null) return s;
  var t = I18N[s];
  return t == null ? s : t;
}
function L(zh, en){ return UI_EN ? en : zh; }

/* 静态页面的翻译：把 HTML 里写死的中文文本节点和几个属性按 I18N 字典换掉。
   只换「整段就是字典里那一条」的（前后空白不算），拼出来的动态文案归 game.js 自己的 T()。*/
var I18N_ATTRS = ["placeholder", "aria-label", "title"];
function i18nDom(root){
  if(!UI_EN || !root) return;
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, list = [];
  while((n = walker.nextNode())) list.push(n);
  list.forEach(function(t){
    var raw = t.nodeValue, key = raw.trim();
    if(!key || !/[　-鿿＀-￯]/.test(key)) return;
    var hit = I18N[key];
    if(hit != null) t.nodeValue = raw.replace(key, hit);
  });
  Array.prototype.forEach.call(root.querySelectorAll("*"), function(el){
    I18N_ATTRS.forEach(function(a){
      var v = el.getAttribute(a);
      if(v && I18N[v.trim()] != null) el.setAttribute(a, I18N[v.trim()]);
    });
  });
}
