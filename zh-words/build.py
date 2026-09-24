"""中文词库的生成脚本（不上线）—— 生成仓库根目录的 words-zh.js。
用法（在仓库根目录）：
    pip install pypinyin
    curl -sSo zh-words/complete.json https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/complete.json
    python3 zh-words/build.py
complete.json 太大（10MB）不进仓库，用完可以删。
词表的「真相」是 zh-words/g1~g5 / g1b~g5b / g6.txt（HSK 3.0 的 1~6 级，逐条手写的英文释义）：
    汉字|英文释义|类别代码[|词性][|拼音]
    类别代码：an 动物 fo 食物 co 颜色 bo 身体 pe 人 th 物品 na 自然 ve 动作 ad 描述 ti 时间 pl 地点 fe 情绪 nu 数字 av 副词
    词性不写就按类别推（ve→v ad/fe/co→adj av→adv nu→num 其余→n）；拼音不写就用 HSK 数据里的（单字用 pypinyin）。
⚠️ 跟英语词库一样：**只许往最后追加**（改到 g5.txt 末尾也行，但别在中间插、别删、别换顺序）——
   存档码按词库下标存熟练度。同一级别里英文释义不许重复（脚本会报）。
"""
import json,re,collections,unicodedata,sys,os
HERE=os.path.dirname(os.path.abspath(__file__))
from pypinyin import pinyin as PY, Style
d=json.load(open(os.path.join(HERE,'complete.json'),encoding='utf-8'))
DATA={}
for e in d:
    DATA.setdefault(e['simplified'],e)
CAT={'an':'animal','fo':'food','co':'color','bo':'body','pe':'people','th':'thing','na':'nature','ve':'verb','ad':'adj','ti':'time','pl':'place','fe':'feel','nu':'num','av':'adv'}
DEFPOS={'verb':'v','adj':'adj','adv':'adv','num':'num','feel':'adj','color':'adj'}
PM={'n':'n','v':'v','a':'adj','adj':'adj','d':'adv','adv':'adv','m':'num','num':'num'}
def join_py(s):
    syl=s.split()
    out=syl[0]
    for x in syl[1:]:
        base=unicodedata.normalize('NFD',x)[0].lower()
        out+=("'" if base in 'aoe' else '')+x
    return out
def data_py(w):
    e=DATA.get(w)
    if not e: return None
    forms=e['forms']
    low=[f for f in forms if not f['transcriptions']['pinyin'][:1].isupper()]
    f=(low or forms)[0]
    return join_py(f['transcriptions']['pinyin'])
def pyof(w):
    if len(w)==1 or not DATA.get(w):
        return join_py(' '.join(x[0] for x in PY(w,style=Style.TONE)))
    return data_py(w)

# ---------------- 近义词（2026-09-24，用户：「词 4 选一时不要出现近义词」）----------------
# 同一难度里两个词算「近义」的四条路（任意一条成立，game.js 就不让它们同时出现在一道四选一里）：
#   ① 我们自己的英文释义有相同的说法（去掉 to/a/the 和括号；括号里的每一段也算一个说法）
#   ② CC-CEDICT 义项（complete.json，只取跟我们读音一样的那一组）有一条完全一样
#   ③ 一个词包含另一个（出 / 出去、刚 / 刚刚）—— 释义几乎一样，放一起最像出错题
#   ④ synonyms.txt 手写的组（英文说法完全不同的：开心 cheerful / 快乐 joyful）
# 一个说法在同一级别里超过 8 个词都有，就当它太笼统、不算（比如 "time"）。
SYN_STOP={'to','a','an','the','be','of','sth','sb','one','ones','oneself',"one's",'someone','something','for','in','on','at','with',
          'up','out','off','down','and','or','very','go','get','make','do','have','take','come','put','give'}
SYN_SOFT={'feel','just','become','really','quite','so','all','being','is','are','got','felt','kind','sort','bit','little','much',
          'more','most','person','people','thing','things','state','act','way'}
SYN_BAD=re.compile(r'surname|variant of|abbr\.|classifier|used in|see |radical|\(onom|particle|pr\. |loanword|kangxi|name of',re.I)
def syn_norm(m):
    m=m.lower()
    m=re.sub(r'\(.*?\)|\[.*?\]','',m)
    m=re.sub(r"\bsth's\b|\bsb's\b|\bsth\b|\bsb\b",'',m)
    m=re.sub(r'^\s*(to|a|an|the)\s+','',m.strip())
    return re.sub(r'\s+',' ',m).strip(' .,;!?')
def syn_stem(w):
    for suf in ('iness','ness','ily','ly','ies','es','s','ed','ing'):
        if len(w)>4 and w.endswith(suf): return w[:-len(suf)]+('y' if suf in ('iness','ily','ies') else '')
    return w
def syn_ckey(q, most):
    t=sorted({syn_stem(w) for w in re.findall(r"[a-z']+",q) if w not in SYN_STOP and w not in SYN_SOFT})
    return ('#'+' '.join(t)) if 0<len(t)<=most else None
def syn_senses(r):
    zh,gl,py=r[0],r[1],r[5].replace("'","").lower()
    s=set()
    for p in [gl.split('(')[0]]+re.findall(r'\((.*?)\)',gl):
        for q in re.split(r'[,/;]',p):
            q=syn_norm(q)
            if q and q not in SYN_STOP:
                s.add(q); k=syn_ckey(q,2)
                if k: s.add(k)
    e=DATA.get(zh)
    if e:
        for f in e['forms']:
            if f['transcriptions']['pinyin'].replace(' ','').replace("'","").lower()!=py: continue
            for m in f['meanings'][:6]:
                if SYN_BAD.search(m): continue
                q=syn_norm(m)
                if q and q not in SYN_STOP and len(q)>2:
                    s.add(q); k=syn_ckey(q,2)
                    if k and ' ' in k: s.add(k)           # CEDICT 的单个词太杂（一词多义），只认两个词的组合
    return s
def synonyms(rows):
    import itertools
    pairs=set()
    for L in sorted({r[3] for r in rows}):
        idx=[i for i,r in enumerate(rows) if r[3]==L]
        inv=collections.defaultdict(list)
        for i in idx:
            for q in syn_senses(rows[i]): inv[q].append(i)
        for q,lst in inv.items():
            if 1<len(lst)<=8: pairs.update(itertools.combinations(lst,2))
        for a,b in itertools.combinations(idx,2):
            if rows[a][0] in rows[b][0] or rows[b][0] in rows[a][0]: pairs.add((a,b))
    W={r[0]:i for i,r in enumerate(rows)}
    for ln,line in enumerate(open(os.path.join(HERE,'synonyms.txt'),encoding='utf-8'),1):
        line=line.split('#')[0].split()
        for w in line:
            if w not in W: errs.append(f'synonyms.txt 第 {ln} 行：词库里没有「{w}」')
        g=[W[w] for w in line if w in W]
        pairs.update(itertools.combinations(sorted(g),2))
    pairs={(a,b) for a,b in pairs if a!=b and rows[a][3]==rows[b][3]}   # 干扰项只在同一难度里挑，跨难度的对子用不上
    m=collections.defaultdict(set)
    for a,b in pairs: m[rows[min(a,b)][0]].add(rows[max(a,b)][0])          # 只存一个方向，game.js 读的时候两边都挂上
    print('近义词：', len(pairs), '对')
    return {k:'|'.join(sorted(v)) for k,v in sorted(m.items())}

def read_past(rows):
    """replaced.txt：原位换掉的词（下标|旧词|新词）→ ZH_PAST（老存档码按旧词算校验，game.js 的 lexList() 读它）"""
    past = {}
    for line in open(os.path.join(HERE, 'replaced.txt'), encoding='utf-8'):
        line = line.strip()
        if not line or line.startswith('#'): continue
        i, old, new = line.split('|')
        i = int(i)
        if rows[i][0] != new: errs.append(f'replaced.txt: 下标 {i} 现在是 {rows[i][0]}，不是 {new}')
        past[i] = old
    return past

def write_js(rows):
    head = open(os.path.join(HERE, 'header.txt'), encoding='utf-8').read()
    tail = open(os.path.join(HERE, 'footer.txt'), encoding='utf-8').read()
    body = ',\n'.join(json.dumps(r, ensure_ascii=False) for r in rows)
    past = read_past(rows)
    tail = tail.replace('\n];\n', '\n];\n\n/* 原位换掉过的词（下标 → 旧词，zh-words/replaced.txt 生成）：老存档码的校验按旧词算，game.js 的 lexList() 用它 */\n'
                        'var ZH_PAST = [' + json.dumps({str(k): v for k, v in sorted(past.items())}, ensure_ascii=False) + '];\n'
                        '\n/* 近义词（下标无关，按词存；| 隔开）：四选一里不让它们同框，game.js 的 nearSyn() 读它。build.py 的 synonyms() 生成 */\n'
                        'var ZH_SYN = ' + json.dumps(synonyms(rows), ensure_ascii=False) + ';\n', 1)
    with open(os.path.join(HERE, '..', 'words-zh.js'), 'w', encoding='utf-8') as f:
        f.write(head + body + tail)
    print('wrote words-zh.js,', len(rows), 'words')

FIXPY={'切':'qiē','划':'huá','好处':'hǎochù'}
seen=set();out=[];errs=[]
# 顺序就是词库下标：g1~g5 是第一批（2026-09-23），g1b~g5b + g6 是第二批（同一天扩到约 4800 词）——
# ⚠️ 只许往后面加文件 / 往文件末尾加行，别往前面插（存档码按下标存熟练度）
FILES = [(f'g{L}.txt', L) for L in range(1, 6)] + [(f'g{L}b.txt', L) for L in range(1, 6)] + [('g6.txt', 6)]
for fn, L in FILES:
    for ln,line in enumerate(open(os.path.join(HERE,fn),encoding='utf-8'),1):
        line=line.rstrip('\n')
        if not line.strip(): continue
        p=line.split('|')
        while len(p)<5: p.append('')
        zh,gl,c,pos,py=p[:5]
        if zh in seen: errs.append(f'dup word {zh} L{L}'); continue
        seen.add(zh)
        cat=CAT.get(c)
        if not cat: errs.append(f'bad cat {line}'); continue
        pos=PM[pos] if pos else DEFPOS.get(cat,'n')
        py=py or FIXPY.get(zh) or pyof(zh)
        if len(zh)>4: errs.append('long '+zh)
        out.append([zh,gl,cat,L,pos,py])
# checks
for L in range(1,7):
    g=collections.Counter(r[1].lower() for r in out if r[3]==L)
    for k,v in g.items():
        if v>1: errs.append(f'L{L} dup gloss "{k}": '+' '.join(r[0] for r in out if r[3]==L and r[1].lower()==k))
    pc=collections.Counter(r[4] for r in out if r[3]==L)
    cc=collections.Counter(r[2] for r in out if r[3]==L)
    print(L,sum(pc.values()),dict(pc)); print('  ',dict(cc))
write_js(out)
print('\n'.join(errs))
