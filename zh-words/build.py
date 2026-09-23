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

def write_js(rows):
    head = open(os.path.join(HERE, 'header.txt'), encoding='utf-8').read()
    tail = open(os.path.join(HERE, 'footer.txt'), encoding='utf-8').read()
    body = ',\n'.join(json.dumps(r, ensure_ascii=False) for r in rows)
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
print('\n'.join(errs))
write_js(out)
