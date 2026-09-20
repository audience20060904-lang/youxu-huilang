/* 幽墟回廊 · 联机客户端
   只有 coop.html 加载它（index.html 单人版完全不碰这个文件）。
   在 game.js 之前加载，提供全局的 NET：连房间、收发消息、按类型分发。
   协议（消息里的 t 字段）跟 server.js 对齐，详细表在 联机方案.md。 */
"use strict";
var NET = (function(){
  var ws = null, room = "", name = "", isHost = false, hasMate = false, connected = false;
  var handlers = {};
  var retryTimer = null, retryDelay = 1500, manualClose = false;

  function on(type, fn){
    if(!handlers[type]) handlers[type] = [];
    handlers[type].push(fn);
  }
  function fire(type, msg){
    (handlers[type] || []).forEach(function(fn){ try{ fn(msg); }catch(e){ console.error(e); } });
  }
  function send(obj){
    if(!ws || ws.readyState !== 1) return false;
    try{ ws.send(JSON.stringify(obj)); return true; }catch(e){ return false; }
  }
  function wsUrl(){
    var proto = location.protocol === "https:" ? "wss:" : "ws:";
    return proto + "//" + location.host + "/";
  }
  function connect(r, n){
    room = r; name = n; manualClose = false;
    open();
  }
  function open(){
    if(retryTimer){ clearTimeout(retryTimer); retryTimer = null; }
    try{ ws = new WebSocket(wsUrl()); }catch(e){ scheduleRetry(); return; }
    ws.onopen = function(){
      retryDelay = 1500;
      send({t:"join", room: room, name: name});
    };
    ws.onmessage = function(ev){
      var msg;
      try{ msg = JSON.parse(ev.data); }catch(e){ return; }
      if(!msg || typeof msg.t !== "string") return;
      if(msg.t === "joined"){
        connected = true; isHost = !!msg.host; hasMate = !!msg.mate;
      } else if(msg.t === "resume"){
        hasMate = true;
      } else if(msg.t === "pause"){
        hasMate = false;
      }
      fire(msg.t, msg);
    };
    ws.onclose = function(){
      connected = false;
      fire("_close", {});
      if(!manualClose) scheduleRetry();
    };
    ws.onerror = function(){ try{ ws.close(); }catch(e){} };
  }
  function scheduleRetry(){
    if(retryTimer) return;
    retryTimer = setTimeout(function(){
      retryTimer = null;
      retryDelay = Math.min(8000, retryDelay * 1.4);
      open();
    }, retryDelay);
  }
  function close(){
    manualClose = true;
    if(retryTimer){ clearTimeout(retryTimer); retryTimer = null; }
    if(ws){ try{ ws.close(); }catch(e){} }
  }

  return {
    connect: connect,
    close: close,
    send: send,
    on: on,
    isHost: function(){ return isHost; },
    hasMate: function(){ return hasMate; },
    isConnected: function(){ return connected; },
    roomCode: function(){ return room; }
  };
})();
