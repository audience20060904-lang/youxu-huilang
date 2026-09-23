"""日语词库的生成脚本（不上线）—— 生成仓库根目录的 words-ja.js。
用法（在仓库根目录）：
    python3 ja-words/build.py            # 检查 + 生成（有错就不写，--write 强写）
    python3 ja-words/build.py --prune    # 把重复的行（后出现的那一份）直接从源文件删掉
词表的「真相」是 ja-words/g1~g5.txt（1~5 = JLPT N5 / N4 / N3 / N2 / N1，跟英语词库同一套五档）：
    写法|读音|英文释义|类别代码|词性
    读音：写法里有漢字就必须给（平假名 / 片假名）；写法本来就是假名的**留空**（拼写题就拼写法本身）。
    类别代码：an 动物 fo 食物 co 颜色 bo 身体 pe 人 th 物品 na 自然 ve 动作 ad 描述 ti 时间 pl 地点 fe 情绪 nu 数字 av 副词
    词性不写就按类别推（ve→v ad/fe/co→adj av→adv nu→num 其余→n）。
⚠️ 跟别的词库一样：**只许往最后追加**（加新文件接在 FILES 末尾，或者往最后一个文件末尾加行）——
   存档码按词库下标存熟练度。脚本会拦：写法重复、同一级别英文释义重复、读音超过 8 个假名（拼写题的字格）、
   有漢字没读音、读音里混了别的字。
   跟中文词库写法一样的词（学生 / 大学…）**是允许的**：日语的熟练度在 LEX 里存成 "ja:词"（game.js 的 lexKey），不会串。
"""
import os, sys, collections, unicodedata, json, re
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
CAT = {'an':'animal','fo':'food','co':'color','bo':'body','pe':'people','th':'thing','na':'nature','ve':'verb',
       'ad':'adj','ti':'time','pl':'place','fe':'feel','nu':'num','av':'adv'}
DEFPOS = {'verb':'v','adj':'adj','adv':'adv','num':'num','feel':'adj','color':'adj'}
PM = {'n':'n','v':'v','adj':'adj','adv':'adv','num':'num'}
# 顺序就是词库下标：**新加的文件只许接在最后**（g3b 这种是同一档的第二批）
FILES = [('g1.txt', 1), ('g2.txt', 2), ('g3.txt', 3), ('g3b.txt', 3), ('g4.txt', 4), ('g4b.txt', 4),
         ('g5.txt', 5), ('g5b.txt', 5)]
KANA = re.compile(r'^[ぁ-ゖァ-ヺー]+$')
WORD = re.compile(r'^[ぁ-ゖァ-ヺー々ヶ一-鿿]+$')
MAXK = 8

seen = set(); out = []; errs = []; lines = {}
for fn, L in FILES:
    p = os.path.join(HERE, fn)
    if not os.path.exists(p): continue
    for ln, line in enumerate(open(p, encoding='utf-8'), 1):
        line = unicodedata.normalize('NFC', line.rstrip('\n'))
        if not line.strip() or line.startswith('#'): continue
        f = line.split('|')
        while len(f) < 5: f.append('')
        w, rd, gl, c, pos = [x.strip() for x in f[:5]]
        where = '%s:%d %s' % (fn, ln, w)
        if w in seen: errs.append('dup word ' + where); continue
        cat = CAT.get(c)
        if not cat: errs.append('bad cat ' + where); continue
        pos = PM.get(pos) if pos else DEFPOS.get(cat, 'n')
        if not pos: errs.append('bad pos ' + where); continue
        if not WORD.match(w): errs.append('bad chars ' + where); continue
        if KANA.match(w):
            if rd and rd != w: errs.append('kana word with reading ' + where)
            rd = ''
        elif not rd: errs.append('no reading ' + where); continue
        if rd and not KANA.match(rd): errs.append('bad reading ' + where); continue
        if len(rd or w) > MAXK: errs.append('too long ' + where); continue
        if not gl: errs.append('no gloss ' + where); continue
        seen.add(w)
        out.append([w, gl, cat, L, pos, rd])

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
if '--prune' in sys.argv:
    kill = collections.defaultdict(set)
    for e in errs:
        m = re.match(r'(?:dup word|too long) (g\w+\.txt):(\d+) ', e)
        if m: kill[m.group(1)].add(int(m.group(2)))
    for fn, ls in kill.items():
        p = os.path.join(HERE, fn); rows = open(p, encoding='utf-8').read().split('\n')
        rows = [r for i, r in enumerate(rows, 1) if i not in ls]
        open(p, 'w', encoding='utf-8').write('\n'.join(rows))
        print('pruned', fn, len(ls))
print('total', len(out), 'errors', len(errs))

if '--write' in sys.argv or not errs:
    head = open(os.path.join(HERE, 'header.txt'), encoding='utf-8').read()
    tail = open(os.path.join(HERE, 'footer.txt'), encoding='utf-8').read()
    body = ',\n'.join(json.dumps(r, ensure_ascii=False) for r in out)
    with open(os.path.join(ROOT, 'words-ja.js'), 'w', encoding='utf-8') as f:
        f.write(head + body + tail)
    print('wrote words-ja.js,', len(out), 'words')
