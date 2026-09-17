/* 幽墟回廊 · 全局小工具
   必须最先加载：data.js 和 game.js 都依赖这里的函数 */
"use strict";

function ri(a, b){ return a + Math.floor(Math.random() * (b - a + 1)); }
function pick(a){ return a[Math.floor(Math.random() * a.length)]; }
function $(id){ return document.getElementById(id); }

function load(k, f){
  try{ const r = localStorage.getItem(k); return r ? JSON.parse(r) : f; }
  catch(e){ return f; }
}
/* 写成了返回 true，写不进去（无痕模式、存储被禁、配额满）返回 false。
   game.js 的 put() 靠这个返回值把失败顶到页面上，别再静默丢档。 */
function save(k, v){
  try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; }
}

var CAN_SPEAK = !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
var _spkWait = null;                 // speakQueued 的等待轮询，手动点朗读时要掐掉
function speak(w){
  if(!CAN_SPEAK) return;
  if(_spkWait){ clearInterval(_spkWait); _spkWait = null; }   // 有人手动点了，就别再补那一段
  try{
    const u = new SpeechSynthesisUtterance(w);
    u.lang = "en-US"; u.rate = .85;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }catch(e){}
}
/* 排队版：**等上一段读音念完了再念**（用户 2026-09 要的，拼写题那次自动朗读走这条）。
   speak() 自己会先 cancel 掉正在念的那一段，所以想接在后面只能等。
   最多等 4 秒 —— 有的浏览器 speaking 会卡住不落，不能无限等下去。*/
function speakQueued(w){
  if(!CAN_SPEAK) return;
  try{
    if(_spkWait){ clearInterval(_spkWait); _spkWait = null; }
    if(!speechSynthesis.speaking && !speechSynthesis.pending){ speak(w); return; }
    const t0 = Date.now();
    _spkWait = setInterval(function(){
      if((!speechSynthesis.speaking && !speechSynthesis.pending) || Date.now() - t0 > 4000){
        clearInterval(_spkWait); _spkWait = null;
        speak(w);
      }
    }, 120);
  }catch(e){}
}
