"""「哪一句在说这个词」那一题的英文释义句（不上线）—— 生成仓库根目录的 defs-en.js：DEFS_EN = {英文词: 释义句}。
用户 2026-09-28：给一个单词，下面四句英文描述，只有一句在说它。不限时。

用法（在仓库根目录）：
    python3 def-words/build.py

真相是 def-words/en1.txt（A1）、en3_01.txt ~（B1，一档拆成好几个文件）…… 一行一条：英文词|释义句，# 开头是注释。
写法：一句只写这个词**最常用的那个意思**（跟中文释义对得上），只用 A1/A2 的简单词，
名词写「a/an …」、动词写「to …」、形容词副词直接写性质。实在不好说的虚词可以用 ___ 挖空举例（"as in "I ___ happy""）。
脚本拦：
  ① 词不在词库里（或者难度跟文件对不上）
  ② 同一个词写了两遍、两个词的释义一字不差
  ③ **释义里带这个词自己**（按词干比，driver 的释义里出现 drives 也算）
  ④ 太长：超过 MAX_LEN 个字符（360 宽的屏上两行就装不下了）
  ⑤ apart.txt 里写的词还没有释义
apart.txt：意思太近的词一行一组，game.js 挑干扰项时不让它们同框（生成 DEFS_APART）。
没写释义的词不出这种题，所以可以一档一档慢慢补。
"""
import json, os, re, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
MAX_LEN = 70
import glob
# en1.txt、en3_01.txt、en3_02.txt …：文件名里 en 后面那个数字就是难度，一档可以拆成好几个文件
FILES = [(os.path.basename(f), int(os.path.basename(f)[2])) for f in sorted(glob.glob(os.path.join(HERE, 'en[1-5]*.txt')))]

# 词库：借 node 把 words-a1.js 跑一遍，拿 [英文, 中文, 类别, 难度, 词性]
js = ("const vm=require('vm'),fs=require('fs');const c={window:{}};vm.createContext(c);"
      "vm.runInContext(fs.readFileSync('words-a1.js','utf8')+';this.W=WORDS;',c);"
      "process.stdout.write(JSON.stringify(c.W));")
WORDS = json.loads(subprocess.check_output(['node', '-e', js], cwd=ROOT))
LV = {w[0]: w[3] for w in WORDS}

def stem(w):
    w = w.lower()
    for suf in ('ing', 'er', 'ed', 'es', 's', 'e', 'y', 'ly', 'ful'):
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            return w[:-len(suf)]
    return w

errs, out, seen_def = [], {}, {}
for fn, lv in FILES:
    p = os.path.join(HERE, fn)
    if not os.path.exists(p):
        continue
    for n, line in enumerate(open(p, encoding='utf-8'), 1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.count('|') != 1:
            errs.append(f'{fn}:{n} 格式不对：{line}'); continue
        w, d = [x.strip() for x in line.split('|')]
        where = f'{fn}:{n} {w}'
        if w not in LV:
            errs.append(f'{where}：词库里没有这个词'); continue
        if LV[w] != lv:
            errs.append(f'{where}：词库里是难度 {LV[w]}，不是 {lv}')
        if w in out:
            errs.append(f'{where}：写了两遍')
        if d.lower() in seen_def:
            errs.append(f'{where}：跟 {seen_def[d.lower()]} 的释义一字不差')
        seen_def[d.lower()] = w
        if re.search(r'\b' + re.escape(stem(w)), d.lower()):
            errs.append(f'{where}：释义里带了这个词自己 —— {d}')
        if len(d) > MAX_LEN:
            errs.append(f'{where}：{len(d)} 个字符，超过 {MAX_LEN} —— {d}')
        out[w] = d

apart = []                                     # 不许同框的组（apart.txt）
for n, line in enumerate(open(os.path.join(HERE, 'apart.txt'), encoding='utf-8'), 1):
    line = line.strip()
    if not line or line.startswith('#'):
        continue
    g = line.split()
    for w in g:
        if w not in out:
            errs.append(f'apart.txt:{n} {w}：还没写释义')
    apart.append(g)

if errs:
    print('\n'.join(errs))
    raise SystemExit(f'{len(errs)} 处要改，没有生成')

by_lv = {}
for w in out:
    by_lv[LV[w]] = by_lv.get(LV[w], 0) + 1
total = {lv: sum(1 for w in WORDS if w[3] == lv) for lv in range(1, 6)}
head = ('/* 「哪一句在说这个词」那一题的英文释义句（用户 2026-09-28）。\n'
        '   ⚠️ 这个文件是 def-words/build.py 生成的，别手改 —— 改 def-words/en*.txt 再跑一遍。\n'
        '   没写释义的词不出这种题（game.js 的 defOf()）。按词做键，不按下标，所以不碰存档码。\n'
        '   覆盖：' + ' / '.join(f'难度{lv} {by_lv.get(lv, 0)}/{total[lv]}' for lv in range(1, 6)) + ' */\n')
body = 'var DEFS_EN = {\n' + ',\n'.join(f'  {json.dumps(w)}: {json.dumps(d, ensure_ascii=False)}' for w, d in out.items()) + '\n};\n'
body += '/* 意思太近、不许出在同一道题里的组（def-words/apart.txt）*/\nvar DEFS_APART = ' + json.dumps(apart) + ';\n'
open(os.path.join(ROOT, 'defs-en.js'), 'w', encoding='utf-8').write(head + body)
print(f'defs-en.js：{len(out)} 条（' + '，'.join(f'难度{lv} {by_lv[lv]}' for lv in sorted(by_lv)) + '）')
