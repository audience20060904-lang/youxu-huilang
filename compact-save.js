/* Synchronous, dependency-free save transport. Old readers remain in game.js. */
var CompactSave = (function(){
  function hash(a){ let h=2166136261; for(const b of a) h=Math.imul(h^b,16777619); return h>>>0; }
  function zip(a){
    const out=[], seen=new Map(); let p=0;
    while(p<a.length){ const at=out.length; out.push(0); let flags=0;
      for(let bit=0;bit<8 && p<a.length;bit++){
        const key=p+2<a.length ? (a[p]<<16)|(a[p+1]<<8)|a[p+2] : -1;
        const q=seen.get(key); let n=0;
        if(key>=0 && q!==undefined && p-q<=65535) while(n<258 && p+n<a.length && a[q+n]===a[p+n]) n++;
        const end=p+(n>=4?n:1);
        if(n>=4){ flags|=1<<bit; const d=p-q; out.push(d&255,d>>>8,n-3); }
        else out.push(a[p]);
        while(p<end){ if(p+2<a.length) seen.set((a[p]<<16)|(a[p+1]<<8)|a[p+2],p); p++; }
      } out[at]=flags;
    } return out;
  }
  function pack(tag,input){
    const a=Array.from(input), z=zip(a), c=z.length<a.length, body=c?z:a, h=hash(a);
    const b=[c?1:0,a.length&255,(a.length>>>8)&255,(a.length>>>16)&255,(a.length>>>24)&255,h&255,(h>>>8)&255,(h>>>16)&255,h>>>24].concat(body);
    let v=0,n=0,s=tag;
    for(const x of b){ v|=x<<n; n+=8; while(n>=15){ s+=String.fromCharCode(0x4e00+(v&32767)); v>>>=15;n-=15; } }
    if(n) s+=String.fromCharCode(0x4e00+v); return s;
  }
  function unpack(tag,txt){
    if(txt.slice(0,tag.length)!==tag) throw Error('存档码类型不符');
    const b=[];let v=0,n=0;
    for(const ch of txt.slice(tag.length)){ const x=ch.charCodeAt(0)-0x4e00; if(x<0 || x>32767) throw Error('存档码包含无效字符'); v|=x<<n;n+=15;while(n>=8){ b.push(v&255);v>>>=8;n-=8; } }
    const size=(b[1]|b[2]<<8|b[3]<<16|b[4]<<24)>>>0, h=(b[5]|b[6]<<8|b[7]<<16|b[8]<<24)>>>0;
    if(b.length<9 || b[0]>1 || size>16777216) throw Error('存档码长度无效');
    const a=[];let p=9;
    if(!b[0]){ if(b.length-p<size) throw Error('存档码不完整'); for(let i=0;i<size;i++) a.push(b[p++]); }
    else while(a.length<size){ if(p>=b.length) throw Error('存档码不完整'); const f=b[p++]; for(let bit=0;bit<8 && a.length<size;bit++){
      if(f&(1<<bit)){ if(p+2>=b.length) throw Error('存档码不完整'); const d=b[p++]|(b[p++]<<8),len=b[p++]+3; if(!d || d>a.length || a.length+len>size) throw Error('存档码压缩数据损坏'); for(let k=0;k<len;k++) a.push(a[a.length-d]); }
      else { if(p>=b.length) throw Error('存档码不完整');a.push(b[p++]); }
    } }
    if(b.slice(p).some(x=>x!==0) || v || hash(a)!==h || pack(tag,a)!==txt) throw Error('存档码校验不符'); return new Uint8Array(a);
  }
  return {pack:pack,unpack:unpack};
})();
if(typeof module!=='undefined') module.exports=CompactSave;
