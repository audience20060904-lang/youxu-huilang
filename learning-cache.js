/* Immutable word-pool indexes and weighted draws; no progress or RNG is cached. */
var LearningCache=(function(){
  'use strict';
  let scopes=new WeakMap();
  function scope(pool,levels,all){
    const key=Array.from(new Set(levels)).sort((a,b)=>a-b).join(',');
    let entries=scopes.get(pool);if(!entries){entries=new Map();scopes.set(pool,entries);}
    const previous=entries.get(key);if(previous&&previous.all===all)return previous.words;
    const want=new Set(levels),selected=pool.filter(w=>want.has(w.lv||1));
    const fallback=selected.length>=6?selected:all.filter(w=>want.has(w.lv||1));
    const words=fallback.length>=6?fallback:pool;
    entries.set(key,{all,words});return words;
  }
  // One cumulative entry per word replaces up to 15 repeated references per word.
  function weighted(pool,weight,random){
    const sums=new Float64Array(pool.length);let total=0;
    for(let i=0;i<pool.length;i++){total+=Math.max(0,Math.floor(weight(pool[i])||0));sums[i]=total;}
    return function(){
      if(!total)return null;
      const needle=Math.min(total-1,Math.floor((random||Math.random)()*total));
      let lo=0,hi=pool.length-1;
      while(lo<hi){const mid=(lo+hi)>>>1;if(sums[mid]>needle)hi=mid;else lo=mid+1;}
      return pool[lo];
    };
  }
  return {scope,weighted,clear:function(){scopes=new WeakMap();}};
})();
if(typeof module!=='undefined')module.exports=LearningCache;
