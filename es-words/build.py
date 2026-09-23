"""西班牙语词库的生成脚本（不上线）—— 生成仓库根目录的 words-es.js。
用法（在仓库根目录）：
    python3 es-words/build.py            # 检查 + 生成
    python3 es-words/build.py --freq     # 另外用 wordfreq 报一下「级别跟词频对不上」的词（pip install wordfreq）
词表的「真相」是 es-words/g1~g5.txt（1~5 = A1 / A2 / B1 / B2 / B2–C1，跟英语词库同一套分档）：
    西语|英文释义|类别代码|词性|冠词
    类别代码：an 动物 fo 食物 co 颜色 bo 身体 pe 人 th 物品 na 自然 ve 动作 ad 描述 ti 时间 pl 地点 fe 情绪 nu 数字 av 副词
    词性不写就按类别推（ve→v ad/fe/co→adj av→adv nu→num 其余→n）。
    冠词只给名词写：m=el  f=la  mf=el/la  mp=los  fp=las  fe=el（阴性但用 el，比如 el agua）
⚠️ 跟别的词库一样：**只许往最后追加**（加新文件接在 FILES 末尾，或者往最后一个文件末尾加行）——
   存档码按词库下标存熟练度。脚本会拦：西语重复、同一级别英文释义重复、超过 11 个字母、带空格、
   跟英语词库拼写一样的词（pan / pie / once…）**是允许的**：西语的熟练度在 LEX 里存成 "es:词"（game.js 的 lexKey），不会串。
"""
import os, sys, collections, unicodedata, json, re
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
CAT = {'an':'animal','fo':'food','co':'color','bo':'body','pe':'people','th':'thing','na':'nature','ve':'verb',
       'ad':'adj','ti':'time','pl':'place','fe':'feel','nu':'num','av':'adv'}
DEFPOS = {'verb':'v','adj':'adj','adv':'adv','num':'num','feel':'adj','color':'adj'}
PM = {'n':'n','v':'v','adj':'adj','adv':'adv','num':'num'}
ART = {'m':'el','f':'la','mf':'el/la','mp':'los','fp':'las','fe':'el'}
FILES = [('g%d.txt' % L, L) for L in range(1, 6)]
LETTERS = re.compile(r"^[a-záéíóúüñ]+$")

src = open(os.path.join(ROOT, 'words-a1.js'), encoding='utf-8').read()
EN = set(re.findall(r'^\["([^"]*)"', src, re.M))

seen = set(); out = []; errs = []
for fn, L in FILES:
    p = os.path.join(HERE, fn)
    if not os.path.exists(p): continue
    for ln, line in enumerate(open(p, encoding='utf-8'), 1):
        line = unicodedata.normalize('NFC', line.rstrip('\n'))
        if not line.strip() or line.startswith('#'): continue
        f = line.split('|')
        while len(f) < 5: f.append('')
        w, gl, c, pos, ar = [x.strip() for x in f[:5]]
        where = '%s:%d %s' % (fn, ln, w)
        if w in seen: errs.append('dup word ' + where); continue
        cat = CAT.get(c)
        if not cat: errs.append('bad cat ' + where); continue
        pos = PM.get(pos) if pos else DEFPOS.get(cat, 'n')
        if not pos: errs.append('bad pos ' + where); continue
        if not LETTERS.match(w): errs.append('bad letters ' + where); continue
        if len(w) > 11: errs.append('too long ' + where); continue
        if pos == 'n':
            if ar not in ART: errs.append('noun needs article ' + where); continue
            ar = ART[ar]
        else:
            if ar: errs.append('article on non-noun ' + where)
            ar = ''
        if not gl: errs.append('no gloss ' + where); continue
        seen.add(w)
        out.append([w, gl, cat, L, pos, ar])

for L in range(1, 6):
    rows = [r for r in out if r[3] == L]
    g = collections.Counter(r[1].lower() for r in rows)
    for k, v in g.items():
        if v > 1: errs.append('L%d dup gloss "%s": %s' % (L, k, ' '.join(r[0] for r in rows if r[1].lower() == k)))
    pc = collections.Counter(r[4] for r in rows); cc = collections.Counter(r[2] for r in rows)
    print('L%d %d' % (L, len(rows)), dict(pc))
    print('   ', dict(sorted(cc.items(), key=lambda x: x[1])))
    low = [k for k in CAT.values() if cc.get(k, 0) < 6] + [k for k in PM.values() if pc.get(k, 0) < 6]
    if rows and low: print('    <6:', sorted(set(low)))
    long = [r[1] for r in rows if len(r[1]) > 30]
    if long: print('    long glosses:', long)
print('\n'.join(errs))
if '--prune' in sys.argv:   # 把「重复 / 太长 / 字母不对」的那几行直接从源文件里删掉（只删后出现的那一份）
    kill = collections.defaultdict(set)
    for e in errs:
        m = re.match(r'(?:dup word|too long|bad letters) (g\w+\.txt):(\d+) ', e)
        if m: kill[m.group(1)].add(int(m.group(2)))
    for fn, lines in kill.items():
        p = os.path.join(HERE, fn); rows = open(p, encoding='utf-8').read().split('\n')
        rows = [r for i, r in enumerate(rows, 1) if i not in lines]
        open(p, 'w', encoding='utf-8').write('\n'.join(rows))
        print('pruned', fn, len(lines))
print('total', len(out), 'errors', len(errs))

if '--freq' in sys.argv:
    from wordfreq import zipf_frequency as z
    band = {1:(3.0, 9), 2:(3.8, 9), 3:(3.2, 9), 4:(2.6, 5.6), 5:(1.5, 5.0)}
    for L in range(1, 6):
        lo, hi = band[L]
        odd = [(r[0], round(z(r[0], 'es'), 2)) for r in out if r[3] == L and not (lo <= z(r[0], 'es') <= hi)]
        print('L%d off-band (%d):' % (L, len(odd)), ' '.join('%s:%s' % x for x in sorted(odd, key=lambda x: x[1])))

if '--write' in sys.argv or not errs:
    head = open(os.path.join(HERE, 'header.txt'), encoding='utf-8').read()
    tail = open(os.path.join(HERE, 'footer.txt'), encoding='utf-8').read()
    body = ',\n'.join(json.dumps(r, ensure_ascii=False) for r in out)
    with open(os.path.join(ROOT, 'words-es.js'), 'w', encoding='utf-8') as f:
        f.write(head + body + tail)
    print('wrote words-es.js,', len(out), 'words')
