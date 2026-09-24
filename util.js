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
/* ---- 挑声音（用户 2026-09-24：「浏览器的发音怪怪的」）----
   以前不指定 voice，浏览器拿「系统默认」那个：Mac 上可能是 Albert / Bubbles 这种搞怪声线，
   学中文可能落到粤语（zh-HK），没装这门语言的语音就拿英语口音硬念。
   现在按「语言对 → 音质」给这台设备上的每个声音打分，挑最高的；玩家也能在设置里自己挑（SPEAK_PREF.voice）。
   ⚠️ Google 那几个是**联网**声音，国内常常连不上、一声不吭 —— 所以 2 秒没开口 / 报错就拉黑它，换本地最好的那个重念。 */
var SPEAK_PREF = {voice:"", rate:.9};    // game.js 读 OPT 之后写进来；战场页不设就是自动 + 标准语速
var _voices = [], _badVoice = {}, _voiceCbs = [], _spkU = null, _spkTimer = null;
function loadVoices(){
  try{ _voices = speechSynthesis.getVoices() || []; }catch(e){ _voices = []; }
  _voiceCbs.forEach(function(f){ try{ f(); }catch(e){} });
}
function onVoices(f){ _voiceCbs.push(f); }
if(CAN_SPEAK){
  loadVoices();
  try{ speechSynthesis.addEventListener("voiceschanged", loadVoices); }
  catch(e){ speechSynthesis.onvoiceschanged = loadVoices; }
}
/* 搞怪 / 失真声线（macOS 的 novelty + Eloquence 那一批），一律不用 */
var VOICE_JUNK = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|princess|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;
/* 各语言公认顺耳的系统声音（Apple / Windows / Android 常见名字）*/
var VOICE_GOOD = {
  en: /samantha|ava|allison|susan|zoe|karen|daniel|serena|aria|jenny|guy|libby|sonia|zira/i,
  zh: /tingting|ting-ting|婷婷|lili|yu-shu|xiaoxiao|yunxi|xiaoyi|huihui|yaoyao|meijia|美佳/i,
  es: /m[oó]nica|paulina|marisol|elvira|alvaro|helena|laura|sabina|jorge/i,
  ja: /kyoko|o-ren|otoya|hattori|nanami|keita|haruka|ayumi|sayaka|ichiro/i
};
function speakLang(){ return (typeof SPEAK_LANG === "string" && SPEAK_LANG) || "en-US"; }
/* 这个声音能不能念这门语言，能的话多顺耳（-1 = 不能用）*/
function voiceScore(v, lang){
  var vl = String(v.lang || "").replace(/_/g, "-").toLowerCase(), want = lang.toLowerCase(), base = want.split("-")[0];
  if(vl.split("-")[0] !== base || VOICE_JUNK.test(v.name)) return -1;
  if(base === "zh" && /hk|yue|mo/.test(vl)) return -1;              // 粤语，念普通话会很怪
  var s = 10;
  if(vl === want) s += 20;
  else if(base === "zh" && /tw|hant/.test(vl)) s += 5;                 // 台湾普通话，口音差一点但能用
  if(/natural|neural|premium|enhanced|online|siri/i.test(v.name)) s += 40;
  if(/google/i.test(v.name)) s += 30;
  if(VOICE_GOOD[base] && VOICE_GOOD[base].test(v.name)) s += 15;
  if(/compact/i.test(v.name)) s -= 20;
  if(v["default"]) s += 2;
  return s;
}
/* 这门语言能用的声音，好的排前面（设置页的下拉框也用它）*/
function voicesFor(lang){
  lang = lang || speakLang();
  return _voices.map(function(v){ return {v:v, s:voiceScore(v, lang)}; })
    .filter(function(x){ return x.s >= 0; })
    .sort(function(a, b){ return b.s - a.s; })
    .map(function(x){ return x.v; });
}
function pickVoice(){
  var list = voicesFor(), want = SPEAK_PREF.voice;
  if(want) for(var i = 0; i < list.length; i++)
    if(list[i].name === want && !_badVoice[list[i].voiceURI || list[i].name]) return list[i];
  for(var j = 0; j < list.length; j++) if(!_badVoice[list[j].voiceURI || list[j].name]) return list[j];
  return null;
}
function speak(w, retry){
  if(!CAN_SPEAK) return;
  if(_spkWait){ clearInterval(_spkWait); _spkWait = null; }   // 有人手动点了，就别再补那一段
  if(_spkTimer){ clearTimeout(_spkTimer); _spkTimer = null; }
  try{
    if(!_voices.length) loadVoices();
    const u = new SpeechSynthesisUtterance(w), v = pickVoice();
    /* 念「要学的那门语言」：i18n.js 定的 SPEAK_LANG（学中文是 zh-CN）。战场页不加载 i18n.js，兜成英语 */
    u.lang = v ? v.lang : speakLang();
    if(v) u.voice = v;
    u.rate = SPEAK_PREF.rate || .9;
    _spkU = u;                         // 留个引用：Chrome 会把没人引用的 utterance 回收掉，onstart / onerror 就不来了
    let started = false;
    u.onstart = function(){ started = true; if(_spkTimer){ clearTimeout(_spkTimer); _spkTimer = null; } };
    /* 联网声音连不上：拉黑它、换下一个重念一次 */
    const fail = function(){
      if(_spkU !== u || started || retry || !v || v.localService !== false) return;
      _badVoice[v.voiceURI || v.name] = true;
      _voiceCbs.forEach(function(f){ try{ f(); }catch(e){} });   // 设置页「自动 · 某某」跟着换
      speak(w, true);
    };
    u.onerror = function(e){ if(!e || (e.error !== "interrupted" && e.error !== "canceled")) fail(); };
    if(v && v.localService === false) _spkTimer = setTimeout(function(){ _spkTimer = null; if(!started && _spkU === u){ speechSynthesis.cancel(); fail(); } }, 2000);
    speechSynthesis.cancel();
    try{ speechSynthesis.resume(); }catch(e){}   // Chrome 闲置久了会卡在 paused，不 resume 就一直不出声
    speechSynthesis.speak(u);
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
