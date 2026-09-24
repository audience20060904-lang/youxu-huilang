"""四选一的近义词表（不上线）—— 生成仓库根目录的 syn.js：SYN_EN / SYN_ES / SYN_JA。
用户 2026-09-24：「词 4 选一时不要出现近义词」「所有语言都要优化近义词」。
中文那份在 words-zh.js 的 ZH_SYN 里（zh-words/build.py 生成，规矩一样），这里不管。

用法（在仓库根目录）：
    pip install nltk
    # WordNet：nltk.download() 走不了代理，手动下
    mkdir -p ~/nltk_data/corpora && cd ~/nltk_data/corpora && \\
      curl -sSO https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/corpora/wordnet.zip && unzip -q wordnet.zip
    python3 syn-words/build.py

同一难度里两个词算「近义」（任意一条成立；game.js 的 nearSyn() 挑干扰项时跳过）：
  英语（词是英文、释义是中文）
    ① 两个英文词在 WordNet 里同义：只看各自最常用的前 3 个义项（冷门义会把 get / begin 这种凑一起），
       外加形容词的 similar_tos、动词的 verb_groups（pretty ~ beautiful）
    ② 中文释义相同，或一个包含另一个（去掉括号、结尾的「的 / 地」；单字只认「看 / 看见」这种两字词以它开头的）
  西语 / 日语（释义是英文）
    ③ 英文释义有相同的说法（去掉 to/a/the 和括号，括号里每一段也算一个说法）
    ④ 英文释义的主干词在 WordNet 里同义（同上，前 3 个义项）
    ⑤ 日语：一个写法包含另一个（手 / 手紙 这种放一起像出错题）
  每门语言都有一份手写组 manual-en.txt / manual-es.txt / manual-ja.txt（一行一组，空格隔开）
一个说法在同一级别里超过 8 个词都有，就当它太笼统、不算。
"""
import json, re, os, collections, itertools
from nltk.corpus import wordnet as wn

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
errs = []

def load_en():
    src = open(os.path.join(ROOT, 'words-a1.js'), encoding='utf-8').read()
    body = src[src.index('var WORDS = ['):]
    body = body[:body.index('\n];')]
    return [[m[0], m[1], m[2], int(m[3]), m[4]] for m in
            re.findall(r'\["((?:[^"\\]|\\.)*)","((?:[^"\\]|\\.)*)","(\w+)",(\d+),"(\w+)"\]', body)]

def load_json_rows(fn, var):
    src = open(os.path.join(ROOT, fn), encoding='utf-8').read()
    body = src[src.index('var %s = [' % var):]
    body = body[:body.index('\n];')]
    return [json.loads(l.strip().rstrip(',')) for l in body.split('\n') if l.strip().startswith('[')]

STOP = {'to', 'a', 'an', 'the', 'be', 'of', 'sth', 'sb', 'one', 'ones', 'oneself', "one's", 'someone', 'something', 'for',
        'in', 'on', 'at', 'with', 'up', 'out', 'off', 'down', 'and', 'or', 'very', 'go', 'get', 'make', 'do', 'have',
        'take', 'come', 'put', 'give', 'feel', 'just', 'become', 'really', 'quite', 'so', 'all', 'being', 'is', 'are',
        'kind', 'sort', 'bit', 'little', 'much', 'more', 'most', 'person', 'people', 'thing', 'things', 'state', 'way'}

def norm_en(m):
    m = m.lower()
    m = re.sub(r'\(.*?\)|\[.*?\]', '', m)
    m = re.sub(r'^\s*(to|a|an|the)\s+', '', m.strip())
    return re.sub(r'\s+', ' ', m).strip(' .,;!?')

def en_phrases(gl):
    out = set()
    for p in [gl.split('(')[0]] + re.findall(r'\((.*?)\)', gl):
        for q in re.split(r'[,/;]', p):
            q = norm_en(q)
            if q and q not in STOP: out.add(q)
    return out

def head_word(gl):
    """英文释义的主干词：去掉括号和 to/a/the 之后剩一个实词才算（多词短语不拿去查 WordNet）"""
    t = [w for w in re.findall(r"[a-z]+", norm_en(gl.split('(')[0])) if w not in STOP]
    return t[0] if len(t) == 1 else None

_wn = {}
def wn_keys(word, top=3):
    """这个英文词最常用的前 top 个义项（synset 名字）"""
    if word not in _wn:
        ks = set()
        for s in wn.synsets(word)[:top]:
            ks.add(s.name())
            for t in s.similar_tos() + s.verb_groups(): ks.add(t.name())   # 形容词的「近似」、动词的「同组」（pretty ~ beautiful）
        _wn[word] = ks
    return _wn[word]

def norm_zh(g):
    g = re.sub(r'[（(][^）)]*[）)]', '', g)
    out = set()
    for p in re.split(r'[；;，,、/]', g):
        p = p.strip()
        p = re.sub(r'[的地]$', '', p)
        if p: out.add(p)
    return out

def pairs_by_keys(idx, keyf):
    inv = collections.defaultdict(list)
    for i in idx:
        for k in keyf(i): inv[k].append(i)
    ps = set()
    for k, lst in inv.items():
        if 1 < len(lst) <= 8: ps.update(itertools.combinations(lst, 2))
    return ps

def manual(fn, rows):
    W = {r[0]: i for i, r in enumerate(rows)}
    ps = set()
    path = os.path.join(HERE, fn)
    if not os.path.exists(path): return ps
    for ln, line in enumerate(open(path, encoding='utf-8'), 1):
        ws = line.split('#')[0].split()
        for w in ws:
            if w not in W: errs.append(f'{fn} 第 {ln} 行：词库里没有「{w}」')
        ps.update(itertools.combinations(sorted(W[w] for w in ws if w in W), 2))
    return ps

def table(rows, ps, name):
    ps = {(a, b) for a, b in ps if a != b and rows[a][3] == rows[b][3]}   # 干扰项只在同一难度里挑
    m = collections.defaultdict(set)
    for a, b in ps: m[rows[min(a, b)][0]].add(rows[max(a, b)][0])     # 只存一个方向，game.js 两边都挂上
    print(f'{name}: {len(rows)} 词，近义词 {len(ps)} 对')
    return {k: '|'.join(sorted(v)) for k, v in sorted(m.items())}

def build_en():
    rows = load_en()
    ps = set()
    for L in sorted({r[3] for r in rows}):
        idx = [i for i, r in enumerate(rows) if r[3] == L]
        ps |= pairs_by_keys(idx, lambda i: wn_keys(rows[i][0]))                       # ①
        ps |= pairs_by_keys(idx, lambda i: norm_zh(rows[i][1]))                        # ② 相同
        zs = [(i, norm_zh(rows[i][1])) for i in idx]
        long_ = collections.defaultdict(list)                                           # ② 包含：按字建个索引省得 n²
        for i, s in zs:
            for p in s:
                for c in set(p): long_[c].append((i, p))
        for i, s in zs:
            for p in s:
                for j, q in long_.get(p[0], []):
                    if j == i or len(q) <= len(p) or p not in q: continue
                    if len(p) >= 2 or (len(q) == 2 and q[0] == p):    # 单字只认「看 / 看见」这种两字词以它开头的
                        ps.add((min(i, j), max(i, j)))
    ps |= manual('manual-en.txt', rows)
    return rows, table(rows, ps, 'EN')

def build_gloss_lang(rows, fn, name, contain=False):
    ps = set()
    for L in sorted({r[3] for r in rows}):
        idx = [i for i, r in enumerate(rows) if r[3] == L]
        ps |= pairs_by_keys(idx, lambda i: en_phrases(rows[i][1]))                       # ③
        ps |= pairs_by_keys(idx, lambda i: wn_keys(head_word(rows[i][1])) if head_word(rows[i][1]) else set())  # ④
        if contain:                                                                      # ⑤
            for a, b in itertools.combinations(idx, 2):
                x, y = rows[a][0], rows[b][0]
                if x in y or y in x: ps.add((a, b))
    ps |= manual(fn, rows)
    return table(rows, ps, name)

if __name__ == '__main__':
    _, en = build_en()
    es = build_gloss_lang(load_json_rows('words-es.js', 'ES_WORDS'), 'manual-es.txt', 'ES')
    ja = build_gloss_lang(load_json_rows('words-ja.js', 'JA_WORDS'), 'manual-ja.txt', 'JA', contain=True)
    with open(os.path.join(ROOT, 'syn.js'), 'w', encoding='utf-8') as f:
        f.write('/* 四选一的近义词表：同一难度里这些词不会同时出现在一道题里（game.js 的 nearSyn()）。\n'
                '   syn-words/build.py 生成，别手改 —— 要补就改 syn-words/manual-*.txt 再跑一遍。\n'
                '   格式：{词: "近义词1|近义词2"}，只存一个方向。中文那份在 words-zh.js 的 ZH_SYN。*/\n')
        for var, t in (('SYN_EN', en), ('SYN_ES', es), ('SYN_JA', ja)):
            f.write('var %s = %s;\n' % (var, json.dumps(t, ensure_ascii=False, separators=(',', ':'))))
    print('\n'.join(errs) or 'ok')
