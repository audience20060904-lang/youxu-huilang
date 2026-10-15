/* 本局码（YXR…）解码 —— 不上线，给 Claude 复现用户那一局用。
   用法：node dev/decode-run.js <码 或 存着码的文件>   → 打印整份 JSON
   码的格式见 game.js 的「本局码」一节（JSON → UTF-8 → 每 3 字节 2 个生僻字，前 2 字节是校验）。
   要在游戏里复现：镇上设置页「粘贴存档码」粘进去就是那一局。*/
const fs = require("fs");
let txt = process.argv[2] || "";
if(fs.existsSync(txt)) txt = fs.readFileSync(txt, "utf8");
txt = txt.replace(/[\s​-‍﻿]+/g, "");
if(txt.indexOf("YXR") !== 0){ console.error("不是本局码（应以 YXR 开头）"); process.exit(1); }
const s = txt.slice(3), bytes = [];
for(let i = 0; i < s.length; i += 2){
  const v = (s.charCodeAt(i) - 0x3400) * 4096 + (s.charCodeAt(i + 1) - 0x3400);
  bytes.push(v >> 16, (v >> 8) & 255, v & 255);
}
const body = bytes.slice(2);
let h = 0x9E37;
for(const b of body) h = (h * 31 + b) & 0xFFFF;
if(h !== (bytes[0] | (bytes[1] << 8))){ console.error("校验对不上：码不完整"); process.exit(1); }
while(body.length && body[body.length - 1] === 0) body.pop();
const o = JSON.parse(Buffer.from(body).toString("utf8"));
console.log(JSON.stringify(o, null, 1));
