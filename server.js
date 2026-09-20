/* 幽墟回廊 · 联机服务器
   零依赖：只用 Node 自带的 http / crypto / fs / os / path —— 不许 npm install ws。
   同时干两件事：
     1. 静态文件服务器 —— 把这个目录当网站根目录发出去（手机开 coop.html 用这个）
     2. 房间服务器 —— 自己实现 WebSocket 握手和帧解析（协议见 联机方案.md）

   启动：node server.js
   然后手机和电脑连同一个 WiFi，手机浏览器打开 http://<电脑的局域网 IP>:8080/coop.html
   （电脑上用 ipconfig / ifconfig 查局域网 IP；第一次跑 Windows 会弹防火墙警报，要勾「专用网络」）

   ⚠️ 这个文件只做转发和极少量的「谁先谁是房主」这类房间状态，不 require 任何游戏文件、
   不认识 content.js / game.js 里的任何数值 —— 客户端把算好的东西发上来，这里只负责转发。
   详细设计见仓库根目录的 联机方案.md。*/
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");

const PORT = process.env.PORT ? +process.env.PORT : 8080;
const ROOT = __dirname;
const WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const HEARTBEAT_MS = 25000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".md": "text/plain; charset=utf-8"
};

/* ================= 静态文件 ================= */
function serveStatic(req, res){
  let p = decodeURIComponent((req.url || "/").split("?")[0]);
  if(p === "/") p = "/coop.html";
  // 挡住 .. 往上跳出仓库目录
  p = path.normalize(p).replace(/^([.]{2}[\/\\])+/, "");
  const file = path.join(ROOT, p);
  if(!file.startsWith(ROOT)){ res.writeHead(403); res.end("forbidden"); return; }
  fs.readFile(file, function(err, data){
    if(err){ res.writeHead(404, {"Content-Type": "text/plain; charset=utf-8"}); res.end("404 没有这个文件：" + p); return; }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {"Content-Type": MIME[ext] || "application/octet-stream"});
    res.end(data);
  });
}

/* ================= WebSocket 帧 ================= */
function encodeFrame(opcode, payload){
  const len = payload.length;
  let header;
  if(len < 126){
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = len;
  } else if(len < 65536){
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}
function sendText(socket, str){
  if(!socket || socket.destroyed) return;
  try{ socket.write(encodeFrame(0x1, Buffer.from(str, "utf8"))); }catch(e){}
}
function sendPing(socket){ if(!socket || socket.destroyed) return; try{ socket.write(encodeFrame(0x9, Buffer.alloc(0))); }catch(e){} }
function sendPong(socket, payload){ if(!socket || socket.destroyed) return; try{ socket.write(encodeFrame(0xA, payload || Buffer.alloc(0))); }catch(e){} }
function sendClose(socket){ if(!socket || socket.destroyed) return; try{ socket.write(encodeFrame(0x8, Buffer.alloc(0))); }catch(e){} }

/* 从缓冲区里尝试解出**一整帧**（客户端发来的帧一定是 masked）。
   TCP 会把一帧拆成好几个 data 事件，所以要一直攒着直到够长。
   返回 {fin, opcode, payload, total} 或者 null（还不够）。*/
function tryParseFrame(buf){
  if(buf.length < 2) return null;
  const b0 = buf[0], b1 = buf[1];
  const fin = (b0 & 0x80) !== 0;
  const opcode = b0 & 0x0f;
  const masked = (b1 & 0x80) !== 0;
  let len = b1 & 0x7f;
  let offset = 2;
  if(len === 126){
    if(buf.length < 4) return null;
    len = buf.readUInt16BE(2);
    offset = 4;
  } else if(len === 127){
    if(buf.length < 10) return null;
    len = Number(buf.readBigUInt64BE(2));
    offset = 10;
  }
  let maskKey = null;
  if(masked){
    if(buf.length < offset + 4) return null;
    maskKey = buf.slice(offset, offset + 4);
    offset += 4;
  }
  if(buf.length < offset + len) return null;
  let payload = buf.slice(offset, offset + len);
  if(masked){
    const un = Buffer.alloc(len);
    for(let i=0;i<len;i++) un[i] = payload[i] ^ maskKey[i % 4];
    payload = un;
  }
  return { fin: fin, opcode: opcode, payload: payload, total: offset + len };
}

/* ================= 房间 =================
   一个房间最多两个人：先连上的是房主（peers[0]），后来的是队友（peers[1]）。
   服务器不认识游戏内容，只转发消息 + 记极少量的「谁 ready 了」「世界包存的哪份」。*/
var rooms = new Map();
function getRoom(code){
  let r = rooms.get(code);
  if(!r){
    r = {
      code: code,
      peers: [null, null],
      world: null, worldFloor: 0,
      ready: {},                 // {move:[bool,bool], floor:[bool,bool], enter:[bool,bool]}
      route: null, practice: false
    };
    rooms.set(code, r);
  }
  return r;
}
function sendTo(room, idx, obj){
  const c = room.peers[idx];
  if(c) sendText(c.socket, JSON.stringify(obj));
}
function broadcast(room, obj){
  const s = JSON.stringify(obj);
  room.peers.forEach(function(c){ if(c) sendText(c.socket, s); });
}

function doJoin(conn, msg){
  const code = String(msg.room || "").trim().toUpperCase().slice(0, 16);
  const name = String(msg.name || "旅人").trim().slice(0, 20) || "旅人";
  if(!code){ sendText(conn.socket, JSON.stringify({t:"err", why:"房间号不能为空"})); return; }
  if(conn.room){ sendText(conn.socket, JSON.stringify({t:"err", why:"已经在一个房间里了"})); return; }
  const room = getRoom(code);
  let idx = -1;
  for(let i=0;i<2;i++) if(!room.peers[i]){ idx = i; break; }
  if(idx < 0){ sendText(conn.socket, JSON.stringify({t:"err", why:"房间已经有两个人了"})); return; }
  room.peers[idx] = conn;
  conn.room = room; conn.role = idx; conn.name = name;
  const mateIdx = 1 - idx, mate = room.peers[mateIdx];
  sendText(conn.socket, JSON.stringify({t:"joined", host: idx === 0, mate: !!mate}));
  if(mate){
    sendTo(room, mateIdx, {t:"joined", host: mateIdx === 0, mate: true});
    sendTo(room, mateIdx, {t:"resume"});
    // 断线重连：把已知的世界/路线/练习模式状态立刻补发给新连接，别让他从零开始等
    if(room.world) sendText(conn.socket, JSON.stringify({t:"world", floor: room.worldFloor, pack: room.world}));
    if(room.route) sendText(conn.socket, JSON.stringify({t:"route", id: room.route}));
    if(room.practice) sendText(conn.socket, JSON.stringify({t:"practice", on: room.practice}));
  }
}

function onMessage(conn, msg){
  if(!msg || typeof msg !== "object" || typeof msg.t !== "string") return;
  if(msg.t === "join"){ doJoin(conn, msg); return; }
  const room = conn.room;
  if(!room) return;
  const idx = room.peers.indexOf(conn);
  if(idx < 0) return;
  const mateIdx = 1 - idx;
  switch(msg.t){
    case "world":
      if(idx !== 0) return;              // 只有房主能发世界包
      room.world = msg.pack; room.worldFloor = msg.floor;
      sendTo(room, mateIdx, {t:"world", floor: msg.floor, pack: msg.pack});
      break;
    case "route":
      if(idx !== 0) return;
      room.route = msg.id;
      sendTo(room, mateIdx, {t:"route", id: msg.id});
      break;
    case "practice":
      if(idx !== 0) return;
      room.practice = !!msg.on;
      sendTo(room, mateIdx, {t:"practice", on: room.practice});
      break;
    case "enterConfirm":
      if(idx !== 1) return;              // 只有队友能发这条（房主自己选路线不用确认自己）
      sendTo(room, mateIdx, {t:"enterConfirm", id: msg.id});
      break;
    case "ready": {
      const what = msg.what;
      if(!what) return;
      if(!room.ready[what]) room.ready[what] = [false, false];
      room.ready[what][idx] = !!msg.on;
      if(!msg.on){
        broadcast(room, {t:"go", what: what, on:false});
      } else if(room.peers[0] && room.peers[1] && room.ready[what][0] && room.ready[what][1]){
        broadcast(room, {t:"go", what: what, on:true});
        // 一次性事件（下一层 / 进洞）触发后自动复位；"move" 是常驻开关，保留到有人主动关掉
        if(what !== "move"){ room.ready[what][0] = false; room.ready[what][1] = false; }
      }
      break;
    }
    case "path":
      if(idx !== 0) return;
      sendTo(room, mateIdx, {t:"path", steps: msg.steps});
      break;
    case "me":
      sendTo(room, mateIdx, Object.assign({}, msg, {t:"mate"}));
      break;
    case "used":
      sendTo(room, mateIdx, msg);
      break;
  }
}

function onDisconnect(conn){
  const room = conn.room;
  if(!room) return;
  const idx = room.peers.indexOf(conn);
  if(idx < 0) return;
  room.peers[idx] = null;
  const mate = room.peers[1 - idx];
  if(idx === 0 && mate){
    // 房主掉线：剩下那个人自动扶正成房主（联机方案.md 第二轮拍板的规则）
    room.peers[0] = mate; room.peers[1] = null;
    mate.role = 0;
    sendText(mate.socket, JSON.stringify({t:"joined", host:true, mate:false}));
    sendText(mate.socket, JSON.stringify({t:"pause", why:"disconnect"}));
  } else if(mate){
    sendText(mate.socket, JSON.stringify({t:"pause", why:"disconnect"}));
  }
  if(!room.peers[0] && !room.peers[1]) rooms.delete(room.code);
}

/* ================= 连接生命周期 ================= */
var allConns = new Set();
function wrapSocket(socket){
  const conn = { socket: socket, room: null, role: -1, name: "", alive: true, awaitingPong: false, pendingChunks: null, pendingOpcode: 0 };
  allConns.add(conn);
  let buf = Buffer.alloc(0);
  socket.on("data", function(chunk){
    buf = Buffer.concat([buf, chunk]);
    while(true){
      const frame = tryParseFrame(buf);
      if(!frame) break;
      buf = buf.slice(frame.total);
      handleFrame(conn, frame);
    }
  });
  function done(){
    allConns.delete(conn);
    onDisconnect(conn);
  }
  socket.on("close", done);
  socket.on("error", done);
}

function handleFrame(conn, frame){
  if(frame.opcode === 0x8){ sendClose(conn.socket); try{ conn.socket.end(); }catch(e){} return; }
  if(frame.opcode === 0x9){ sendPong(conn.socket, frame.payload); return; }
  if(frame.opcode === 0xA){ conn.alive = true; conn.awaitingPong = false; return; }
  // 文本帧（0x1）或延续帧（0x0）—— 浏览器发的小 JSON 消息基本不会分片，这里顺手兜一下分片
  if(frame.opcode === 0x1){
    conn.pendingChunks = [frame.payload]; conn.pendingOpcode = 0x1;
  } else if(frame.opcode === 0x0 && conn.pendingChunks){
    conn.pendingChunks.push(frame.payload);
  } else {
    return;
  }
  if(frame.fin && conn.pendingChunks){
    const full = Buffer.concat(conn.pendingChunks);
    conn.pendingChunks = null;
    let msg;
    try{ msg = JSON.parse(full.toString("utf8")); }catch(e){ return; }
    onMessage(conn, msg);
  }
}

function acceptKey(key){
  return crypto.createHash("sha1").update(key + WS_MAGIC).digest("base64");
}
function handleUpgrade(req, socket){
  if(!req.headers.upgrade || req.headers.upgrade.toLowerCase() !== "websocket"){ socket.destroy(); return; }
  const key = req.headers["sec-websocket-key"];
  if(!key){ socket.destroy(); return; }
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
    "Upgrade: websocket\r\n" +
    "Connection: Upgrade\r\n" +
    "Sec-WebSocket-Accept: " + acceptKey(key) + "\r\n\r\n"
  );
  socket.setNoDelay(true);
  wrapSocket(socket);
}

/* 心跳：手机锁屏时 TCP 连接常常不会干净地关掉，靠 ping/pong 探活。
   每 HEARTBEAT_MS 探一轮：上一轮的 pong 没回来就当它已经断了。*/
setInterval(function(){
  allConns.forEach(function(conn){
    if(conn.awaitingPong){
      try{ conn.socket.destroy(); }catch(e){}
      return;
    }
    conn.awaitingPong = true;
    sendPing(conn.socket);
  });
}, HEARTBEAT_MS);

/* ================= 启动 ================= */
const server = http.createServer(serveStatic);
server.on("upgrade", handleUpgrade);
server.listen(PORT, function(){
  const nets = os.networkInterfaces();
  const ips = [];
  Object.keys(nets).forEach(function(name){
    (nets[name] || []).forEach(function(n){
      if(n.family === "IPv4" && !n.internal) ips.push(n.address);
    });
  });
  console.log("幽墟回廊 · 联机服务器已启动");
  console.log("电脑上打开： http://localhost:" + PORT + "/coop.html");
  if(ips.length){
    console.log("手机（同一个 WiFi）打开：");
    ips.forEach(function(ip){ console.log("  http://" + ip + ":" + PORT + "/coop.html"); });
  } else {
    console.log("没查到局域网 IP —— 命令行里用 ipconfig（Windows）/ ifconfig（Mac）自己看一下。");
  }
  console.log("按 Ctrl+C 关掉服务器。");
});
