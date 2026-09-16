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
function save(k, v){
  try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){}
}

var CAN_SPEAK = !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
function speak(w){
  if(!CAN_SPEAK) return;
  try{
    const u = new SpeechSynthesisUtterance(w);
    u.lang = "en-US"; u.rate = .85;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }catch(e){}
}
