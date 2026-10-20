/* Ordered startup with parallel browser preload; game state stays in game.js. */
(function(){
  'use strict';
  const holder=document.getElementById('gameLoader');if(!holder)return;
  const status=document.getElementById('loadStatus'),bar=document.getElementById('loadProgress'),count=document.getElementById('loadCount'),retry=document.getElementById('loadRetry');
  const app=document.querySelector('.app'),coop=!!document.querySelector('[data-coop-page]');
  if(coop)window.__COOP=true;
  const version='20261020-gpu1';
  const asset=src=>src+'?v='+(src==='pixi.min.js'?'8.22.0':version);
  const stages=[
    ['util.js','准备基础资源'],['i18n.js','读取语言设置'],
    ['words-a1.js','载入英语词库'],['words-zh.js','载入中文词库'],['words-es.js','载入西语词库'],['words-ja.js','载入日语词库'],
    ['syn.js','载入词义索引'],['defs-en.js','载入释义题'],['content.js','准备冒险玩法'],['orb.js','载入主城资源'],
    ['art.js','载入角色模型'],['monster-art.js','载入地牢生物'],['dungeon-scene.js','载入洞窟场景'],
    ['dungeon-view.js','准备场景数据'],['pixi.min.js','载入绘图引擎',true],['dungeon-gpu.js','准备场景绘制',true],
    [coop?'net.js':'i18n-en.js',coop?'准备合作模式':'准备界面语言'],
    ['compact-save.js','准备存档'],['hero-system.js','准备角色技能'],['heirlooms.js','载入遗物'],
    ['dungeon-rules.js','准备流派与无尽词条'],['dungeon-rooms.js','准备房间与岔路'],['dungeon-fx.js','准备战斗动画'],['learning-cache.js','准备学习内容'],['game.js','整理游戏进度']
  ];
  let registration=null,fatal=null,finished=false;
  const total=stages.length+4;
  window.GameBoot={register:function(value){registration=value;}};
  if(app)app.inert=true;
  const english=()=>typeof window.UI_EN!=='undefined'&&window.UI_EN;
  function progress(n,label){
    status.textContent=english()?'Preparing your adventure…':label;
    bar.value=n;bar.max=total;count.textContent=Math.round(n/total*100)+'%';
  }
  // Yield a painted frame between parse/prepare stages, including on slow phones.
  const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const block=e=>{if(!finished&&e.target!==retry){e.preventDefault();e.stopImmediatePropagation();}};
  document.addEventListener('keydown',block,true);
  window.addEventListener('error',function(e){if(!finished&&e.error)fatal=e.error;});
  for(const [src] of stages){
    const link=document.createElement('link');link.rel='preload';link.as='script';link.href=asset(src);document.head.appendChild(link);
  }
  function script(src){
    return new Promise((resolve,reject)=>{
      const el=document.createElement('script');el.src=asset(src);el.async=false;
      const timeout=setTimeout(()=>{el.remove();reject(new Error('Resource timeout'));},45000);
      el.onload=()=>{clearTimeout(timeout);el.onload=el.onerror=null;fatal?reject(fatal):resolve();};
      el.onerror=()=>{clearTimeout(timeout);el.remove();reject(new Error('Resource unavailable'));};
      document.head.appendChild(el);
    });
  }
  async function load(){
    try{
      if(!document.getElementById('gameStyle').sheet)throw new Error('Styles unavailable');
      progress(0,'正在准备资源');await frame();
      for(let i=0;i<stages.length;i++){
        progress(i,stages[i][1]);await frame();
        try{await script(stages[i][0]);}catch(error){if(!stages[i][2])throw error;fatal=null;}
      }
      if(!registration)throw new Error('Game did not initialize');
      const tasks=registration.prepare||[];
      for(let i=0;i<tasks.length;i++){progress(stages.length+i,tasks[i].label);await frame();await tasks[i].run();}
      progress(total-1,'正在进入幽墟回廊');await frame();registration.start();
      if(fatal)throw fatal;
      progress(total,'准备就绪');await frame();
      finished=true;if(app)app.inert=false;document.removeEventListener('keydown',block,true);
      holder.hidden=true;document.documentElement.classList.remove('game-loading');
      document.dispatchEvent(new Event('dungeon-ready'));
    }catch(error){
      holder.dataset.failed='true';status.textContent=english()?'Loading failed. Please retry.':'资源加载失败，请检查网络后重试。';
      retry.textContent=english()?'Retry':'重新加载';retry.hidden=false;
      document.dispatchEvent(new Event('dungeon-load-error'));
    }
  }
  load();
})();
